# Rspack、Rsbuild、rslib 全面面试题

> 本文档覆盖 Rspack 生态的核心知识点，包含概念理解、配置实践、性能优化等方面的面试题及详细解答。

---

## 一、基础概念

### 1. 什么是 Rspack？它与 webpack 有什么区别？

**参考答案：**

Rspack 是字节跳动开发的高性能 JavaScript 打包工具，基于 Rust 语言编写。

**与 webpack 的主要区别：**

| 特性 | Rspack | webpack |
|------|--------|---------|
| **语言** | Rust | JavaScript |
| **构建速度** | 极快（冷启动快 10-100 倍） | 相对较慢 |
| **并行处理** | 原生支持多线程 | 需要额外配置 thread-loader |
| **缓存策略** | 内置持久化缓存 | 需要 hard-source-webpack-plugin |
| **兼容性** | 支持 webpack 配置，但不完全兼容 | 完全支持自身配置 |
| **社区生态** | 相对较新，生态正在完善 | 成熟，插件丰富 |

**核心优势：**
- **速度**：Rust 的编译优化和并行处理能力，使构建速度大幅提升
- **内存效率**：更好的内存管理，减少内存占用
- **内置优化**：许多优化策略（如 Tree Shaking、代码分割）默认开启

---

### 2. Rsbuild 和 rslib 分别是什么？它们与 Rspack 的关系是什么？

**参考答案：**

- **Rsbuild**：基于 Rspack 的构建工具，提供更友好的上层 API 和默认配置。类似于 Vite 相对于 Rollup 的关系。

- **rslib**：基于 Rspack 的库打包工具，专门用于构建 npm 包。提供针对库场景的优化配置。

**关系图：**
```
Rspack (核心打包引擎)
    ├── Rsbuild (应用构建工具)
    └── rslib (库打包工具)
```

**各自定位：**
- **Rspack**：底层引擎，提供核心打包能力
- **Rsbuild**：面向应用开发者，提供开箱即用的配置
- **rslib**：面向库开发者，提供库打包最佳实践

---

### 3. Rspack 的构建流程是怎样的？

**参考答案：**

Rspack 的构建流程主要包括以下阶段：

1. **初始化阶段**
   - 读取配置文件
   - 解析入口文件
   - 初始化缓存系统

2. **模块解析阶段**
   - 解析入口文件及其依赖
   - 处理路径别名和模块解析
   - 加载对应的 loader

3. **转换阶段**
   - 使用 loader 转换代码（如 Babel、TypeScript）
   - 处理 CSS、图片等资源
   - 执行插件的 transform 钩子

4. **优化阶段**
   - Tree Shaking 消除未使用代码
   - 代码分割（Code Splitting）
   - 模块合并与优化

5. **生成阶段**
   - 生成最终的 bundle 文件
   - 生成 source map
   - 输出到指定目录

6. **持久化缓存**
   - 将构建结果缓存到磁盘
   - 下次构建时复用缓存

---

## 二、配置与使用

### 4. 如何初始化一个 Rsbuild 项目？

**参考答案：**

可以使用官方脚手架初始化：

```bash
# 使用 create-rspack 初始化
npm create rspack@6.5.0 .

# 或使用 rsbuild 初始化
npm create rsbuild@0.6.0 . -- --template react
```

初始化后会生成以下文件结构：

```
.
├── src/
│   ├── index.css
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── package.json
├── rsbuild.config.ts
└── tsconfig.json
```

---

### 5. Rsbuild 的基本配置结构是怎样的？

**参考答案：**

`rsbuild.config.ts` 的基本结构：

```typescript
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  // 入口配置
  entry: {
    index: './src/main.tsx',
  },
  
  // 输出配置
  output: {
    path: './dist',
    filename: '[name].[contenthash].js',
    clean: true,
  },
  
  // 开发服务器配置
  dev: {
    port: 3000,
    open: true,
    hot: true,
  },
  
  // 模块规则配置
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'builtin:swc-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  
  // 插件配置
  plugins: [
    // 可以添加自定义插件
  ],
  
  // 优化配置
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },
});
```

---

### 6. 如何在 Rsbuild 中配置路径别名？

**参考答案：**

在 `rsbuild.config.ts` 和 `tsconfig.json` 中都需要配置：

**rsbuild.config.ts：**
```typescript
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  resolve: {
    alias: {
      '@': './src',
      '@components': './src/components',
    },
  },
});
```

**tsconfig.json：**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"]
    }
  }
}
```

---

### 7. 如何使用 rslib 打包一个库？

**参考答案：**

首先安装 rslib：

```bash
npm install @rslib/core --save-dev
```

创建 `rslib.config.ts`：

```typescript
import { defineConfig } from '@rslib/core';

export default defineConfig({
  // 入口配置
  entry: {
    index: './src/index.ts',
  },
  
  // 输出配置
  output: {
    // 库的导出格式
    format: ['esm', 'cjs'],
    
    // 导出的全局变量名（UMD 格式）
    name: 'MyLibrary',
    
    // 是否生成类型声明文件
    declaration: true,
    
    // 目标目录
    dir: './dist',
  },
  
  // 外部依赖（不打包进库中）
  external: {
    react: 'React',
    'react-dom': 'ReactDOM',
  },
  
  // 是否生成 source map
  sourcemap: true,
  
  // 压缩配置
  minify: {
    js: true,
    css: true,
  },
});
```

在 `package.json` 中添加脚本：

```json
{
  "scripts": {
    "build": "rslib build",
    "dev": "rslib build --watch"
  }
}
```

---

### 8. 如何配置 Rsbuild 的开发服务器？

**参考答案：**

```typescript
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  dev: {
    // 端口号
    port: 3000,
    
    // 是否自动打开浏览器
    open: true,
    
    // 是否开启热更新
    hot: true,
    
    // 开启 HTTPS
    https: true,
    
    // 设置请求代理
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        pathRewrite: { '^/api': '' },
      },
    },
    
    // 设置响应头
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    
    // 自定义 HTML 模板
    html: {
      template: './public/index.html',
    },
  },
});
```

---

## 三、性能优化

### 9. Rspack 有哪些内置的性能优化策略？

**参考答案：**

Rspack 内置了多种性能优化策略：

1. **持久化缓存**
   - 默认开启文件系统缓存
   - 缓存策略基于内容哈希
   - 支持增量构建

2. **并行处理**
   - 原生多线程支持
   - 模块解析和转换并行执行

3. **Tree Shaking**
   - 基于 ES Module 的静态分析
   - 自动消除未使用的代码

4. **代码分割**
   - 自动分割第三方依赖
   - 支持动态导入分割

5. **SWC 编译**
   - 默认使用 SWC 进行 JavaScript/TypeScript 编译
   - 比 Babel 快 10-20 倍

6. **懒加载优化**
   - 支持动态 import()
   - 自动生成预加载提示

7. **资源优化**
   - 图片压缩
   - CSS 提取和压缩
   - 字体优化

---

### 10. 如何进一步优化 Rspack 的构建性能？

**参考答案：**

以下是一些额外的优化策略：

1. **配置 include/exclude**
   ```typescript
   module: {
     rules: [
       {
         test: /\.tsx?$/,
         include: './src',
         exclude: /node_modules/,
         use: 'builtin:swc-loader',
       },
     ],
   },
   ```

2. **使用 cache-loader**
   ```typescript
   module: {
     rules: [
       {
         test: /\.tsx?$/,
         use: ['cache-loader', 'builtin:swc-loader'],
       },
     ],
   },
   ```

3. **配置 resolve.modules**
   ```typescript
   resolve: {
     modules: ['./src', 'node_modules'],
   },
   ```

4. **关闭不必要的插件**
   - 开发环境关闭压缩
   - 按需加载插件

5. **使用 DLL 缓存**
   - 将第三方依赖预编译
   - 减少重复编译时间

6. **配置合理的缓存策略**
   ```typescript
   cache: {
     type: 'filesystem',
     cacheDirectory: './node_modules/.cache/rspack',
   },
   ```

---

### 11. 如何配置 Rsbuild 的代码分割策略？

**参考答案：**

```typescript
import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  optimization: {
    splitChunks: {
      // 哪些 chunk 需要分割
      chunks: 'all',
      
      // 最小分割大小
      minSize: 20000,
      
      // 最大异步请求数
      maxAsyncRequests: 30,
      
      // 最大初始请求数
      maxInitialRequests: 30,
      
      // 缓存组配置
      cacheGroups: {
        // 第三方依赖
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: -10,
          reuseExistingChunk: true,
        },
        
        // React 相关依赖
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
          name: 'react-vendor',
          priority: -5,
        },
        
        // Ant Design 组件
        antd: {
          test: /[\\/]node_modules[\\/](antd|@ant-design)[\\/]/,
          name: 'antd',
          priority: -4,
        },
        
        // 公共代码
        common: {
          name: 'common',
          minChunks: 2,
          priority: -20,
          reuseExistingChunk: true,
        },
      },
    },
    
    // 提取 runtime 代码
    runtimeChunk: {
      name: 'runtime',
    },
    
    // 稳定的模块 ID
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
  },
});
```

---

## 四、高级特性

### 12. 如何在 Rsbuild 中使用自定义插件？

**参考答案：**

创建自定义插件：

```typescript
// my-plugin.ts
import type { RsbuildPlugin } from '@rsbuild/core';

export function myPlugin(): RsbuildPlugin {
  return {
    name: 'my-plugin',
    
    // 在配置阶段修改配置
    setup(api) {
      // 修改入口配置
      api.modifyConfig((config) => {
        config.entry = {
          ...config.entry,
          custom: './src/custom.ts',
        };
        return config;
      });
      
      // 添加新的 loader
      api.modifyBundlerChain((chain) => {
        chain.module
          .rule('my-rule')
          .test(/\.custom$/)
          .use('my-loader')
          .loader(require.resolve('./my-loader'));
      });
      
      // 添加自定义插件
      api.onBeforeBuild(({ bundlerConfigs }) => {
        bundlerConfigs.forEach((config) => {
          config.plugins?.push(new MyWebpackPlugin());
        });
      });
    },
  };
}
```

使用插件：

```typescript
// rsbuild.config.ts
import { defineConfig } from '@rsbuild/core';
import { myPlugin } from './my-plugin';

export default defineConfig({
  plugins: [myPlugin()],
});
```

---

### 13. 如何实现 Rspack 与 webpack 的迁移？

**参考答案：**

迁移步骤：

1. **安装依赖**
   ```bash
   npm install @rspack/core @rspack/cli --save-dev
   ```

2. **创建配置文件**
   ```typescript
   // rspack.config.ts
   import { defineConfig } from '@rspack/core';
   
   export default defineConfig({
     entry: './src/main.tsx',
     output: {
       path: './dist',
       filename: '[name].[contenthash].js',
     },
     module: {
       rules: [
         {
           test: /\.tsx?$/,
           use: 'builtin:swc-loader',
         },
         {
           test: /\.css$/,
           use: ['style-loader', 'css-loader'],
         },
       ],
     },
     plugins: [],
   });
   ```

3. **更新 package.json 脚本**
   ```json
   {
     "scripts": {
       "build": "rspack build",
       "dev": "rspack serve"
     }
   }
   ```

4. **处理兼容性问题**
   - 部分 webpack 插件可能不兼容
   - 某些 loader 配置需要调整
   - 需要测试构建产物是否正常

5. **逐步迁移**
   - 先在开发环境测试
   - 再迁移生产环境
   - 保留 webpack 配置作为备选

---

### 14. 如何在 Rsbuild 中集成 Tailwind CSS 3？

**参考答案：**

步骤：

1. **安装依赖**
   ```bash
   npm install tailwindcss @tailwindcss/vite --save-dev
   ```

2. **配置 Rsbuild**
   ```typescript
   import { defineConfig } from '@rsbuild/core';
   import tailwindcss from '@tailwindcss/vite';
   
   export default defineConfig({
     plugins: [tailwindcss()],
     
     module: {
       rules: [
         {
           test: /\.css$/,
           use: ['style-loader', 'css-loader', 'postcss-loader'],
         },
       ],
     },
   });
   ```

3. **创建 postcss.config.js**
   ```javascript
   module.exports = {
     plugins: {
       tailwindcss: {},
       autoprefixer: {},
     },
   };
   ```

4. **在 CSS 中引入 Tailwind**
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```

---

### 15. 如何配置 Rsbuild 的环境变量？

**参考答案：**

1. **创建环境变量文件**
   ```bash
   # .env.development
   API_URL=http://localhost:8080
   APP_NAME=MyApp
   
   # .env.production
   API_URL=https://api.example.com
   APP_NAME=MyApp Production
   ```

2. **在 Rsbuild 中配置**
   ```typescript
   import { defineConfig } from '@rsbuild/core';
   
   export default defineConfig({
     env: {
       // 定义环境变量前缀
       prefix: ['API_', 'APP_'],
       
       // 是否在 HTML 中注入环境变量
       injectHtml: true,
     },
   });
   ```

3. **在代码中使用**
   ```typescript
   // TypeScript 类型声明
   declare const process: {
     env: {
       API_URL: string;
       APP_NAME: string;
     };
   };
   
   // 使用环境变量
   console.log(process.env.API_URL);
   console.log(process.env.APP_NAME);
   ```

---

## 五、对比与选型

### 16. Rspack 与 Vite 有什么区别？如何选择？

**参考答案：**

| 特性 | Rspack | Vite |
|------|--------|------|
| **底层引擎** | 自研 Rust 引擎 | Rollup + esbuild |
| **冷启动速度** | 极快 | 快 |
| **HMR 速度** | 快 | 极快 |
| **兼容性** | webpack 兼容 | ESM 优先 |
| **生态成熟度** | 较新 | 成熟 |
| **配置复杂度** | 中等 | 简单 |
| **代码分割** | 强大 | 中等 |

**选择建议：**

- **选 Rspack**：
  - 需要 webpack 兼容的项目
  - 大型项目，需要更好的构建性能
  - 需要强大的代码分割能力

- **选 Vite**：
  - 新项目，追求简单配置
  - 需要极致的 HMR 体验
  - 以 ESM 为主的项目

---

### 17. rslib 与 tsup、unbuild 相比有什么优势？

**参考答案：**

| 特性 | rslib | tsup | unbuild |
|------|-------|------|---------|
| **底层引擎** | Rspack | esbuild | Rollup |
| **速度** | 极快 | 快 | 中等 |
| **类型声明** | 内置支持 | 需要配置 | 内置支持 |
| **多格式输出** | ESM/CJS/UMD | ESM/CJS | ESM/CJS |
| **CSS 支持** | 内置 | 需要配置 | 有限 |
| **代码分割** | 支持 | 有限 | 有限 |
| **插件系统** | 丰富 | 简单 | 中等 |

**rslib 的优势：**
- 基于 Rspack，构建速度快
- 内置类型声明生成
- 更好的 CSS 处理能力
- 强大的代码分割支持
- 与 Rsbuild 生态统一

---

## 六、实战场景

### 18. 如何构建一个使用 Rsbuild + React + TypeScript 的项目？

**参考答案：**

步骤：

1. **初始化项目**
   ```bash
   npm create rsbuild@0.6.0 . -- --template react-ts
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **配置路径别名**（见问题 6）

4. **配置代码分割**（见问题 11）

5. **添加 Tailwind CSS**（见问题 14）

6. **配置环境变量**（见问题 15）

7. **添加路由**
   ```bash
   npm install react-router-dom
   ```

8. **创建页面组件**
   ```tsx
   // src/pages/Home.tsx
   import React from 'react';
   
   export default function Home() {
     return <div>Home Page</div>;
   }
   ```

9. **配置路由**
   ```tsx
   // src/App.tsx
   import { Routes, Route } from 'react-router-dom';
   import Home from './pages/Home';
   import About from './pages/About';
   
   export default function App() {
     return (
       <Routes>
         <Route path="/" element={<Home />} />
         <Route path="/about" element={<About />} />
       </Routes>
     );
   }
   ```

10. **构建项目**
    ```bash
    npm run build
    ```

---

### 19. 如何使用 rslib 构建一个 React 组件库？

**参考答案：**

步骤：

1. **初始化项目**
   ```bash
   mkdir my-component-lib
   cd my-component-lib
   npm init -y
   ```

2. **安装依赖**
   ```bash
   npm install @rslib/core react react-dom --save
   npm install typescript @types/react @types/react-dom --save-dev
   ```

3. **创建组件**
   ```tsx
   // src/Button.tsx
   import React from 'react';
   
   interface ButtonProps {
     children: React.ReactNode;
     variant?: 'primary' | 'secondary';
   }
   
   export function Button({ children, variant = 'primary' }: ButtonProps) {
     const styles = {
       primary: 'bg-blue-500 text-white',
       secondary: 'bg-gray-200 text-gray-800',
     };
     
     return (
       <button className={`px-4 py-2 rounded ${styles[variant]}`}>
         {children}
       </button>
     );
   }
   ```

4. **配置 rslib**
   ```typescript
   // rslib.config.ts
   import { defineConfig } from '@rslib/core';
   
   export default defineConfig({
     entry: {
       index: './src/index.ts',
     },
     output: {
       format: ['esm', 'cjs'],
       name: 'MyComponentLib',
       declaration: true,
       dir: './dist',
     },
     external: {
       react: 'React',
       'react-dom': 'ReactDOM',
     },
     sourcemap: true,
     minify: {
       js: true,
     },
   });
   ```

5. **创建入口文件**
   ```typescript
   // src/index.ts
   export { Button } from './Button';
   export type { ButtonProps } from './Button';
   ```

6. **配置 package.json**
   ```json
   {
     "main": "./dist/index.cjs",
     "module": "./dist/index.esm.js",
     "types": "./dist/index.d.ts",
     "scripts": {
       "build": "rslib build"
     }
   }
   ```

7. **构建库**
   ```bash
   npm run build
   ```

---

## 七、故障排查

### 20. 常见问题及解决方案

**问题 1：构建速度慢**

**解决方案：**
- 检查是否配置了 `include/exclude`
- 确保启用了缓存
- 检查是否有不必要的 loader 或 plugin
- 使用 `rspack build --profile` 分析性能瓶颈

**问题 2：模块解析失败**

**解决方案：**
- 检查路径别名配置是否正确
- 检查 `resolve.modules` 是否包含正确的目录
- 检查文件扩展名是否在 `resolve.extensions` 中

**问题 3：HMR 不生效**

**解决方案：**
- 确保 `dev.hot` 配置为 `true`
- 检查组件是否正确导出
- 检查是否有语法错误阻止 HMR

**问题 4：类型声明文件未生成**

**解决方案：**
- 在 rslib 配置中设置 `output.declaration: true`
- 检查 `tsconfig.json` 是否配置了 `declaration: true`
- 确保 TypeScript 版本正确

**问题 5：与 webpack 插件不兼容**

**解决方案：**
- 查找 Rspack 原生替代方案
- 使用 `@rspack/plugin-webpack-bridge` 兼容层
- 等待插件官方支持 Rspack

---

## 八、总结

### 21. Rspack 生态的核心优势是什么？

**参考答案：**

1. **性能卓越**：基于 Rust 编写，构建速度远超 webpack
2. **兼容性好**：支持 webpack 配置，迁移成本低
3. **生态完善**：提供 Rsbuild（应用构建）和 rslib（库打包）
4. **开箱即用**：默认配置已经过优化，减少配置复杂度
5. **持续演进**：字节跳动官方维护，更新频繁

### 22. 什么时候应该选择 Rspack 而不是 webpack？

**参考答案：**

- 需要更快的构建速度时
- 需要更好的内存管理时
- 项目规模较大，webpack 构建时间过长时
- 需要更好的缓存策略时
- 愿意尝试新技术，享受性能红利时

---

## 附录：常用配置模板

### Rsbuild 完整配置示例

```typescript
import { defineConfig } from '@rsbuild/core';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  entry: {
    index: './src/main.tsx',
  },
  
  output: {
    path: './dist',
    filename: '[name].[contenthash].js',
    clean: true,
  },
  
  resolve: {
    alias: {
      '@': './src',
    },
    modules: ['./src', 'node_modules'],
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
  },
  
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        include: './src',
        exclude: /node_modules/,
        use: ['cache-loader', 'builtin:swc-loader'],
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024,
          },
        },
      },
    ],
  },
  
  plugins: [tailwindcss()],
  
  dev: {
    port: 3000,
    open: true,
    hot: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          priority: -10,
        },
        common: {
          name: 'common',
          minChunks: 2,
          priority: -20,
        },
      },
    },
    runtimeChunk: 'single',
    moduleIds: 'deterministic',
    chunkIds: 'deterministic',
  },
  
  env: {
    prefix: ['API_', 'APP_'],
    injectHtml: true,
  },
});
```

---

### rslib 完整配置示例

```typescript
import { defineConfig } from '@rslib/core';

export default defineConfig({
  entry: {
    index: './src/index.ts',
  },
  
  output: {
    format: ['esm', 'cjs'],
    name: 'MyLibrary',
    declaration: true,
    dir: './dist',
    exports: 'named',
  },
  
  external: {
    react: 'React',
    'react-dom': 'ReactDOM',
    'lodash': '_',
  },
  
  sourcemap: true,
  
  minify: {
    js: true,
    css: true,
  },
  
  resolve: {
    alias: {
      '@': './src',
    },
  },
  
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'builtin:swc-loader',
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
});
```
