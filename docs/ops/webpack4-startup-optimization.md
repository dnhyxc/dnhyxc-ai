# webpack 4 项目启动慢优化全方案（生产级配置 / esbuild-loader 迁移 / 面试回答）

> 适用场景：前端项目仍基于 webpack 4（`webpack-cli 3.x/4.x`、`webpack-dev-server 3.x`），
> `npm start` 冷启动或改码后的 HMR 响应明显慢于心理预期，需要一份既能落地又能讲清楚的完整资料。
>
> 本文把以下内容合并到一个文档，方便复制 / 对照 / 面试复盘：
>
> 1. 先定位再优化的**诊断工具**
> 2. 生产级 webpack 4 配置（5 个层次）
> 3. 从 `babel-loader` 迁移到 `esbuild-loader` 的双轨制方案
> 4. 面试结构化回答模板与高频追问
> 5. CI / 工程基建与量化验证

---

## 1. 先诊断再优化：收集瓶颈证据

> 原则：**不看数据就不做优化**。一次只改一个变量，便于归因。

### 1.1 工具清单

| 工具 | 用途 |
| --- | --- |
| `speed-measure-webpack-plugin` | 测量每个 loader / plugin 的耗时分布 |
| `webpack-bundle-analyzer` | 分析产物大小与被打入的依赖 |
| `time npm start` / `time npm run build` | 粗粒度耗时基线（macOS/Linux） |
| `webpack --progress --profile` | webpack 4 自带的阶段耗时 |
| `du -sh node_modules` | 依赖体积是否异常 |
| `ls -la node_modules/.cache` | 缓存目录是否真实写入 |

### 1.2 诊断时临时套一层 smp

```js
// webpack.dev.js（仅用于诊断，上线可移除）
const SpeedMeasurePlugin = require('speed-measure-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');

const smp = new SpeedMeasurePlugin();
const base = { /* 你的原配置 */ };
base.plugins.push(new BundleAnalyzerPlugin({ analyzerMode: 'server', openAnalyzer: false }));
module.exports = smp.wrap(base);
```

启动后看终端里哪一行 loader 耗时最长——通常是 `babel-loader` / `ts-loader`。

---

## 2. 生产级配置（五层优化）

按**改动最小 → 改动较大**排列：先做前三层，再评估是否上 esbuild-loader。

### 2.1 第一层：缩小搜索与编译范围

#### `include` / `exclude` 必须明确

```js
// ❌ 什么都不限制，node_modules 也过一遍 loader
{ test: /\.(js|jsx|ts|tsx)$/, use: ['babel-loader'] }

// ✅ 只编译 src，排除 node_modules
{
  test: /\.(js|jsx|ts|tsx)$/,
  include: path.resolve(__dirname, 'src'),
  exclude: /node_modules/,
  use: ['babel-loader'],
},
```

#### `resolve.modules` 显式声明，避免层层向上回溯

```js
resolve: {
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  modules: [path.resolve(__dirname, 'src'), 'node_modules'],
  alias: {
    '@': path.resolve(__dirname, 'src'),
    react: path.resolve(__dirname, 'node_modules/react'),
    'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
  },
  mainFields: ['browser', 'module', 'main'],
},
```

#### `module.noParse` 跳过已有 dist 的大型库

> 只能加在**自包含、无外部 require/import** 的最终产物文件上，否则运行时报错。

```js
module: {
  noParse: [
    /\/node_modules\/(react|react-dom|lodash|jquery|moment)\/(dist|build)\//,
  ],
},
```

### 2.2 第二层：缓存（第二次启动要比第一次快一个量级）

#### babel 自身缓存

```js
{
  loader: 'babel-loader',
  options: {
    cacheDirectory: true,        // 写到 node_modules/.cache/babel-loader
    cacheCompression: false,     // 不压缩缓存文件（省 CPU）
    presets: [
      ['@babel/preset-env', { useBuiltIns: 'usage', corejs: 3, modules: false }],
      '@babel/preset-react',
      '@babel/preset-typescript',
    ],
    plugins: [
      ['import', { libraryName: 'antd', libraryDirectory: 'es', style: 'css' }, 'antd'],
      ['import', { libraryName: 'lodash', libraryDirectory: '', camel2DashComponentName: false }, 'lodash'],
      '@babel/plugin-syntax-dynamic-import',
    ],
  },
},
```

#### `cache-loader` 在所有耗时 loader 前面放一层

```js
use: ['cache-loader', 'babel-loader'],
```

#### 模块级缓存：`hard-source-webpack-plugin`

> webpack 4 没有内置持久化缓存，用它当替代方案（该库已 deprecated，在 webpack 4 下仍稳定）。

```js
const HardSourceWebpackPlugin = require('hard-source-webpack-plugin');

plugins: [
  new HardSourceWebpackPlugin({
    cacheDirectory: path.resolve(__dirname, 'node_modules/.cache/hard-source/[confighash]'),
    // package-lock / yarn.lock / pnpm-lock 变动时自动失效
    environmentHash: {
      root: process.cwd(),
      directories: [],
      files: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
    },
  }),
],
```

### 2.3 第三层：并行（把多核 CPU 用起来）

#### `thread-loader` + babel

```js
use: [
  'cache-loader',
  {
    loader: 'thread-loader',
    options: {
      workers: require('os').cpus().length - 1,
      poolTimeout: 2000,
    },
  },
  'babel-loader',
],
```

#### `terser-webpack-plugin` 生产态并行压缩

```js
const TerserPlugin = require('terser-webpack-plugin');

optimization: {
  minimizer: [
    new TerserPlugin({
      parallel: true,
      cache: true,
      extractComments: false,
      terserOptions: { compress: { drop_console: true } },
    }),
  ],
},
```

### 2.4 第四层：开发态不做生产态的事

#### `devtool` 选对

```js
// 开发态推荐
devtool: 'cheap-module-source-map'   // ✅ 性价比最高

// 更快但列信息不准
devtool: 'eval'                      // ✅ 极快

// ❌ 开发态禁用
// devtool: 'source-map'             // 太慢，留给生产态
```

#### 开发态关闭压缩与代码分割

```js
optimization: {
  minimize: false,
  removeAvailableModules: false,
  removeEmptyChunks: false,
  splitChunks: false,          // HMR 更流畅
  namedModules: true,
  namedChunks: true,
},
```

#### watch 忽略 node_modules，降低 IO 压力

```js
watchOptions: {
  ignored: /node_modules/,
  aggregateTimeout: 300,
  poll: 1000,                    // Docker/Vagrant 等虚拟化环境需要轮询
},

devServer: {
  hot: true,
  historyApiFallback: true,
  compress: false,               // 开发态不开 gzip，省 CPU
  client: { progress: true, overlay: { errors: true, warnings: false } },
  static: path.resolve(__dirname, 'public'),
},
```

### 2.5 第五层：减小依赖体积与长期缓存

#### `IgnorePlugin` 忽略 moment 非中文 locale

```js
new webpack.IgnorePlugin({
  resourceRegExp: /^\.\/locale$/,
  contextRegExp: /moment$/,
}),
```

#### lodash / antd 按需

- `lodash` → 直接替换为 `lodash-es`，天然 tree-shake 友好；
- `antd` → `babel-plugin-import`（走 babel 时）或显式路径 `import Button from 'antd/es/button'`。

#### 生产态 splitChunks + runtimeChunk + 稳定 id

```js
optimization: {
  runtimeChunk: 'single',
  moduleIds: 'deterministic',
  chunkIds: 'deterministic',
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all',
      },
      antd: {
        test: /[\\/]node_modules[\\/](antd|@ant-design)[\\/]/,
        name: 'antd',
        priority: 10,
      },
      react: {
        test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
        name: 'react',
        priority: 20,
      },
    },
  },
},
```

> `moduleIds: 'deterministic'` 需 webpack ≥ 4.16；低版本可用 `webpack.HashedModuleIdsPlugin()`。

#### 产物 contenthash

```js
output: {
  filename: 'js/[name].[contenthash:8].js',
  chunkFilename: 'js/[name].[contenthash:8].chunk.js',
},
```

---

## 3. 从 `babel-loader` 迁移到 `esbuild-loader`（生产级双轨制）

### 3.1 先明确可行性

| 项目 | 是否支持 esbuild-loader |
| --- | --- |
| TS / TSX / JS / JSX 转译 | ✅ |
| React JSX automatic runtime | ✅（`jsx: 'automatic'`） |
| polyfill（Promise/Map/Set…） | ❌ 需自己补齐 |
| babel-plugin-import 按需 | ❌ 需改成显式路径或保留 babel 逃生舱 |
| 自定义 babel 插件（CSS-in-JS、docgen…） | ❌ 保留 babel |
| TS 类型检查 | ❌ 用 `fork-ts-checker-webpack-plugin` 或 IDE/pre-commit |

### 3.2 依赖版本建议

```json
{
  "webpack": "^4.46.0",
  "webpack-cli": "^4.10.0",
  "webpack-dev-server": "^4.15.0",
  "esbuild-loader": "^2.21.0",
  "babel-loader": "^8.3.0",
  "@babel/core": "^7.23.0",
  "@babel/preset-env": "^7.23.0",
  "@babel/preset-react": "^7.22.0",
  "@babel/preset-typescript": "^7.23.0",
  "babel-plugin-import": "^1.13.8",
  "cache-loader": "^4.1.0",
  "mini-css-extract-plugin": "^2.7.6",
  "css-loader": "^6.8.1",
  "postcss-loader": "^7.3.3",
  "sass-loader": "^13.3.2",
  "fork-ts-checker-webpack-plugin": "^7.3.0",
  "html-webpack-plugin": "^4.5.2",
  "terser-webpack-plugin": "^4.2.3",
  "typescript": "^5.2.2"
}
```

### 3.3 路径定义

```js
// build/paths.js
const path = require('path');
const root = path.resolve(__dirname, '..');

module.exports = {
  root,
  src: path.join(root, 'src'),
  dist: path.join(root, 'dist'),
  public: path.join(root, 'public'),
  nodeModules: path.join(root, 'node_modules'),
  cacheDir: path.join(root, 'node_modules/.cache'),
  polyfills: path.join(root, 'src/polyfills.js'),
  entry: path.join(root, 'src/main.tsx'),
};
```

### 3.4 babel 逃生舱

```js
// build/babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['@babel/preset-env', { useBuiltIns: 'entry', corejs: 3, modules: false, bugfixes: true }],
      ['@babel/preset-react', { runtime: 'automatic' }],
      '@babel/preset-typescript',
    ],
    plugins: [
      ['import', { libraryName: 'antd', libraryDirectory: 'es', style: 'css' }, 'antd'],
      ['import', { libraryName: 'lodash', libraryDirectory: '', camel2DashComponentName: false }, 'lodash'],
    ],
  };
};
```

### 3.5 公共规则（双轨制）

```js
// build/webpack.base.js
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const paths = require('./paths');

module.exports = {
  entry: {
    polyfills: paths.polyfills,
    app: paths.entry,
  },

  output: {
    path: paths.dist,
    publicPath: '/',
    filename: 'js/[name].js',
    chunkFilename: 'js/[name].chunk.js',
    clean: true,
  },

  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    modules: [paths.src, paths.nodeModules],
    alias: {
      '@': paths.src,
      react: path.join(paths.nodeModules, 'react'),
      'react-dom': path.join(paths.nodeModules, 'react-dom'),
      lodash: 'lodash-es',
    },
    mainFields: ['browser', 'module', 'main'],
  },

  module: {
    noParse: [/\/node_modules\/(react|react-dom|lodash-es|dayjs)\/(dist|build)\//],
    rules: [
      // 轨道 A：主流代码走 esbuild-loader
      {
        test: /\.(js|jsx|ts|tsx)$/,
        include: paths.src,
        exclude: [
          /node_modules/,
          /src[\\/]legacy-babel/,
          /src[\\/]components[\\/]antd-wrapper/,
        ],
        use: [
          {
            loader: 'cache-loader',
            options: { cacheDirectory: path.join(paths.cacheDir, 'esbuild-loader') },
          },
          {
            loader: 'esbuild-loader',
            options: {
              loader: 'tsx',
              target: 'es2018',
              jsx: 'automatic',
              tsconfigRaw: require('../tsconfig.json'),
            },
          },
        ],
      },

      // 轨道 B：逃生舱——antd 按需、legacy、自定义 babel 插件
      {
        test: /\.(js|jsx|ts|tsx)$/,
        include: [
          path.join(paths.src, 'legacy-babel'),
          path.join(paths.src, 'components/antd-wrapper'),
        ],
        use: [
          {
            loader: 'cache-loader',
            options: { cacheDirectory: path.join(paths.cacheDir, 'babel-loader') },
          },
          {
            loader: 'babel-loader',
            options: {
              configFile: path.resolve(__dirname, 'babel.config.js'),
              cacheDirectory: path.join(paths.cacheDir, 'babel-loader'),
              cacheCompression: false,
            },
          },
        ],
      },

      // 样式（开发态 style-loader，生产由 prod 覆盖）
      {
        test: /\.(css|scss)$/,
        include: paths.src,
        use: [
          'style-loader',
          { loader: 'css-loader', options: { importLoaders: 2 } },
          'postcss-loader',
          { loader: 'sass-loader', options: { sourceMap: false } },
        ],
      },
      // antd 自带样式（不经过 sass-loader）
      {
        test: /\.css$/,
        include: /node_modules[\\/](antd|@ant-design)[\\/]/,
        use: ['style-loader', 'css-loader'],
      },
      // 图片 / 字体
      {
        test: /\.(png|jpe?g|gif|bmp|webp)$/,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 8 * 1024 } },
        generator: { filename: 'images/[name].[hash:8][ext]' },
      },
      {
        test: /\.(woff2?|ttf|eot|otf)$/,
        type: 'asset/resource',
        generator: { filename: 'fonts/[name].[hash:8][ext]' },
      },
    ],
  },

  plugins: [
    new webpack.ProgressPlugin({ percentBy: 'entries' }),
    new HtmlWebpackPlugin({
      template: path.join(paths.public, 'index.html'),
      inject: true,
      chunksSortMode: 'manual',
      chunks: ['polyfills', 'app'],
    }),
    // 独立进程跑 TS 类型检查，避免转译阶段被阻塞
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        configFile: path.join(paths.root, 'tsconfig.json'),
        diagnosticOptions: { semantic: true, syntactic: true },
      },
      async: true,
      issue: { include: [{ file: '../src/**/*.{ts,tsx}' }] },
    }),
    // 稳定 module id
    new webpack.HashedModuleIdsPlugin({ hashFunction: 'sha256', hashDigest: 'hex', hashDigestLength: 8 }),
  ],

  stats: { preset: 'errors-warnings', colors: true, timings: true, assets: true, modules: false, children: false },
  performance: false,
};
```

### 3.6 开发态

```js
// build/webpack.dev.js
const { merge } = require('webpack-merge');
const webpack = require('webpack');
const base = require('./webpack.base.js');
const paths = require('./paths');

module.exports = merge(base, {
  mode: 'development',
  devtool: 'cheap-module-source-map',
  plugins: [
    new webpack.HotModuleReplacementPlugin(),
    new webpack.NoEmitOnErrorsPlugin(),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development'),
      __DEV__: true,
    }),
  ],
  optimization: {
    minimize: false,
    removeAvailableModules: false,
    removeEmptyChunks: false,
    splitChunks: false,
    namedModules: true,
    namedChunks: true,
  },
  devServer: {
    host: '0.0.0.0',
    port: 3000,
    hot: true,
    historyApiFallback: true,
    compress: false,
    static: { directory: paths.public, publicPath: '/' },
    client: { logging: 'warn', overlay: { errors: true, warnings: false }, progress: true },
    watchFiles: { paths: ['src/**/*'], options: { ignored: /node_modules/, aggregateTimeout: 300 } },
    devMiddleware: { stats: 'errors-warnings' },
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true, pathRewrite: { '^/api': '' } },
    },
  },
  watchOptions: { ignored: /node_modules/, aggregateTimeout: 300, poll: 1000 },
});
```

### 3.7 生产态（esbuild-loader 压缩替代 terser）

```js
// build/webpack.prod.js
const path = require('path');
const { merge } = require('webpack-merge');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { ESBuildMinifyPlugin } = require('esbuild-loader');
const base = require('./webpack.base.js');
const paths = require('./paths');

module.exports = merge(base, {
  mode: 'production',
  devtool: 'hidden-source-map',
  output: {
    filename: 'js/[name].[contenthash:8].js',
    chunkFilename: 'js/[name].[contenthash:8].chunk.js',
  },
  module: {
    rules: [
      {
        test: /\.(css|scss)$/,
        include: paths.src,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: 'css-loader', options: { importLoaders: 2 } },
          'postcss-loader',
          'sass-loader',
        ],
      },
      {
        test: /\.css$/,
        include: /node_modules[\\/](antd|@ant-design)[\\/]/,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/[name].[contenthash:8].css',
      chunkFilename: 'css/[name].[contenthash:8].chunk.css',
      ignoreOrder: true,
    }),
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production'),
      __DEV__: false,
    }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new ESBuildMinifyPlugin({
        target: 'es2018',
        css: true,
        keepNames: false,
        legalComments: 'none',
        format: 'iife',
      }),
    ],
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
    runtimeChunk: { name: 'runtime' },
    splitChunks: {
      chunks: 'all',
      minSize: 20000,
      minRemainingSize: 0,
      minChunks: 1,
      maxAsyncRequests: 30,
      maxInitialRequests: 30,
      enforceSizeThreshold: 50000,
      cacheGroups: {
        defaultVendors: { test: /[\\/]node_modules[\\/]/, name: 'vendors', priority: -10, reuseExistingChunk: true },
        antd:           { test: /[\\/]node_modules[\\/](antd|@ant-design|rc-.+|dom-align|tinycolor2|dayjs)[\\/]/, name: 'antd', priority: 10, chunks: 'all' },
        react:          { test: /[\\/]node_modules[\\/](react|react-dom|scheduler|prop-types)[\\/]/, name: 'react-vendor', priority: 20, chunks: 'all' },
        polyfills:      { test: /[\\/]node_modules[\\/](core-js|regenerator-runtime|tslib)[\\/]/, name: 'polyfills', priority: 30, chunks: 'all' },
        default:        { minChunks: 2, priority: -20, reuseExistingChunk: true },
      },
    },
  },
});
```

### 3.8 polyfill 入口

esbuild-loader 不注入 API polyfill，由 `src/polyfills.js` 独立承担：

```js
// src/polyfills.js
import 'core-js/stable';
import 'regenerator-runtime/runtime';

if (typeof globalThis === 'undefined') {
  Object.defineProperty(Object.prototype, 'globalThis', {
    get() { return this; },
    configurable: true,
  });
}
```

> 如果希望 polyfill 按 `browserslist` 更精细地按需引入，可把此文件继续交由
> `babel-loader` + `@babel/preset-env`（`useBuiltIns: 'usage'`）处理。

### 3.9 tsconfig 对齐

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "ESNext",
    "moduleResolution": "node",
    "jsx": "react-jsx",
    "isolatedModules": true,
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "experimentalDecorators": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

### 3.10 `.browserslistrc`

```
> 0.2%
not dead
not op_mini all
Chrome >= 80
Firefox >= 80
Safari >= 13
Edge >= 80
iOS >= 12
Android >= 7
```

---

## 4. CI / 本机缓存与工程基建

### 4.1 CI 缓存清单

把下列目录纳入 GitHub Actions / GitLab CI / Jenkins 缓存：

```
node_modules/.cache/esbuild-loader
node_modules/.cache/babel-loader
node_modules/.cache/fork-ts-checker-webpack-plugin
node_modules/.cache/hard-source
node_modules/.cache/terser-webpack-plugin
node_modules/.cache/mini-css-extract-plugin
# npm/yarn/pnpm
~/.npm
~/.cache/yarn
~/.local/share/pnpm
```

GitHub Actions 示例：

```yaml
- name: Cache webpack
  uses: actions/cache@v3
  with:
    path: node_modules/.cache
    key: ${{ runner.os }}-webpack-${{ hashFiles('package-lock.json', 'build/**') }}

- name: Cache npm
  uses: actions/cache@v3
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('package-lock.json') }}
```

### 4.2 工程侧并行与拆分

- `lint-staged + husky`：把 eslint / stylelint 挪到 pre-commit，不要塞进 webpack loader；
- `tsc --noEmit` 或 `fork-ts-checker-webpack-plugin`：单独进程做类型检查；
- SSD + Windows Defender 排除项：把项目目录和 `node_modules` 加入排除，避免扫描拖 IO；
- 统一 Node 版本：`.nvmrc` + `package.json > engines`；
- 构建时间入监控（Grafana / Prometheus），慢了能报警。

---

## 5. 量化验证：不说"变快了"，说具体数字

在优化前后分别跑 3 次，记录下表：

| 指标 | 基线 | 优化后 | 提升 |
| --- | --- | --- | --- |
| 冷启动 `npm start`（清 `node_modules/.cache`） | _45s_ | _18s_ | _60%_ |
| 二次启动 `npm start`（缓存命中） | _45s_ | _6s_ | _87%_ |
| 增量 HMR（改一个 React 组件到浏览器刷新完成） | _3s_ | _800ms_ | _73%_ |
| `npm run build` | _90s_ | _35s_ | _61%_ |
| 主包 `vendors.js` gzip 后 | _300KB_ | _180KB_ | _40%_ |
| `antd` 相关代码在主包占比 | _25%_ | _抽离为独立 chunk_ | — |

---

## 6. 面试回答模板

> 按「**先定位 → 五层优化 → 最后量化与迁移**」的顺序讲，既有结构也有细节。

### 6.1 开场一句话

> "webpack 启动慢我会先搞清楚是**冷启动慢（第一次 compile）、HMR 响应慢，还是生产构建慢**，
> 三种场景的解法完全不同。动手之前先用 `speed-measure-webpack-plugin` 和 `webpack-bundle-analyzer`
> 拿到数据，看哪个 loader / plugin 是瓶颈。"

### 6.2 五层优化（对应本文 §2）

1. **缩小搜索范围**：`include`/`exclude` + `resolve.modules` + `module.noParse`；
2. **缓存**：`babel-loader.cacheDirectory` + `cache-loader` + `hard-source-webpack-plugin`；
3. **并行**：`thread-loader` + `terser-webpack-plugin.parallel`；
4. **开发态不做生产态工作**：`cheap-module-source-map` + `splitChunks:false` + `compress:false`；
5. **减小依赖体积与长期缓存**：`IgnorePlugin` + `babel-plugin-import` + `contenthash` + `runtimeChunk` + 稳定 id。

### 6.3 esbuild-loader 迁移结论

> "esbuild-loader 确实能把转译时间从分钟级降到秒级，但它不处理 polyfill、也不跑自定义
> babel 插件。我在生产项目里采用的是**双轨制**：大部分代码走 esbuild-loader，对需要
> `babel-plugin-import` / 自定义插件的特殊目录继续走 babel-loader，并把类型检查交给
> `fork-ts-checker-webpack-plugin` 或 `tsc --noEmit` 独立进程。压缩阶段再用
> `ESBuildMinifyPlugin` 替换 terser，整体构建时间再降一大截。"

### 6.4 收尾一句（体现优先级判断）

> "总的做法是：**先诊断拿数据 → 上 include/exclude + 缓存 + devtool（改动最小、收益最大） →
> 并行 → 再评估是否上 esbuild-loader → 最后做 CI 缓存与监控**。从不一次改一堆配置。"

---

## 7. 面试高频追问速查

| 追问 | 要点 |
| --- | --- |
| `cheap-module-source-map` 和 `eval` 的区别？ | `cheap` = 不列信息，省体积与时间；`module` = 保留 loader 的原始 source，能准确定位到 tsx；`eval` = 每个模块用 eval 包一层，最快但调试体验差。 |
| webpack 4 和 webpack 5 最核心的区别？ | webpack 5 内置 `cache: filesystem`（替代 hard-source）、持久化缓存、`asset modules`（替代 url-loader/file-loader）、tree-shaking `sideEffects`、Node polyfill 自动移除。 |
| esbuild-loader 替换 babel-loader 后 polyfill 怎么办？ | 入口文件手动 `import 'core-js/stable'; import 'regenerator-runtime/runtime';`；或者独立 polyfill chunk，由 browserslist 决定目标。 |
| 为什么开发态不建议做 splitChunks？ | HMR 需要计算 chunk 依赖关系，越复杂越慢；开发态关心的是改完立即看到，而不是体积。 |
| 怎么验证 cache 真的生效了？ | 跑两次 `npm start`，看第二次耗时；看 `node_modules/.cache/` 下是否有对应目录；清缓存再跑，耗时应显著上升。 |
| `noParse` 为什么不能乱加？ | 加在仍有动态 `require/import` 的库上会导致运行时报错，它完全跳过了 webpack 的依赖解析。 |
| `contenthash` / `chunkhash` / `hash` 的区别？ | `hash` 一次构建相同；`chunkhash` 基于 chunk 内容；`contenthash` 基于**抽出后的文件内容**（css 从 js 中抽出时，css 的 hash 应与 js 无关），最适合长期缓存。 |

---

## 8. 典型收益参考表

| 手段 | 冷启动 | 二次启动 | HMR | 主包体积 |
| --- | --- | --- | --- | --- |
| `include` + `exclude` | 5–10% | — | 小 | — |
| `babel-loader.cacheDirectory` | — | 30–50% | 小 | — |
| `cache-loader` | — | 20–40% | 小 | — |
| `hard-source` | — | 40–70% | 中 | — |
| `thread-loader` | 20–40% | — | — | — |
| `cheap-module-source-map`（替换 source-map） | 15–30% | 15–30% | 明显 | — |
| 开发态关闭 splitChunks/minimize | 10–20% | 10–20% | 明显 | — |
| `antd` 按需 / `lodash-es` | 小 | 小 | 小 | 20–40% |
| `esbuild-loader` 替换 babel-loader | **40–70%** | **40–70%** | **明显** | — |
| `ESBuildMinifyPlugin` 替换 terser | — | — | — | 相当 |
| `contenthash` + `runtimeChunk` + `deterministic` ids | — | — | — | 浏览器缓存命中显著↑ |

---

## 9. 迁移验收清单（上线前必走）

- [ ] 类型检查仍跑：`npm run typecheck`（即 `tsc --noEmit`）无报错；
- [ ] 低版本浏览器冒烟：Chrome 70 / Safari 12 / iOS 12 打开测试环境，`Promise`/`Map`/`Set`/`async` 正常；
- [ ] HMR 可用：改一个 React 组件，页面增量刷新；
- [ ] antd 样式与按需引入：保留 babel 逃生舱或显式路径，样式正常；
- [ ] 产物分析：`webpack-bundle-analyzer` 确认主包体积下降、polyfill 被抽到独立 chunk；
- [ ] 性能对比：记录 §5 表格基线并对比；
- [ ] CI 缓存命中：下次构建能复用 `node_modules/.cache/*`。

---

## 10. 长期路线建议

- **迁 webpack 5**：用 `cache: { type: 'filesystem' }` 替代 hard-source，缓存更稳更官方；
- **迁 Vite / Rspack**：开发态通常秒级启动；如果已经在用 React 18 + ES Modules，迁移收益最大；
- **监控构建时间**：把每次 `npm run build` 耗时写入监控，设定阈值报警。
