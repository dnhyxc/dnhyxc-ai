# Webpack 4 优化——面试口语版

> 这是一份可以"直接跟面试官聊"的口语化版本，不讲概念定义，直接从问题出发，讲清楚"为什么这么做"、"解决了什么问题"、"我踩过什么坑"。

---

## 面试开头：先抛出痛点

"先讲背景。我们项目之前用 webpack 4，启动一次要 45 秒，改个组件 HMR 要 3 秒才能看到效果，开发体验特别差。后来做了优化，冷启动降到 18 秒，二次启动只要 6 秒，HMR 差不多 800 毫秒，提升还是很明显的。"

---

## 第一步：先诊断，不看数据不优化

"动手之前，我会先定位瓶颈在哪里。用两个工具："

- **speed-measure-webpack-plugin**：看每个 loader 和 plugin 各自花了多少时间；
- **webpack-bundle-analyzer**：看打包产物的体积分布。

"先跑一次 baseline，记录下冷启动时间、HMR 响应时间、主包体积这些数据。优化之后再对比，确保不是瞎改。"

---

## 五层优化：从改动最小到收益最大

### 第一层：缩小搜索范围

"这是最容易做、收益也明显的一步。"

**include/exclude 必须明确**：

"原来的配置是 `{ test: /\.(js|jsx)$/, use: 'babel-loader' }`，这样 webpack 会遍历整个项目，包括 node_modules。改成只编译 src 目录，排除 node_modules，能省不少时间。"

**resolve.modules 显式声明**：

"告诉 webpack 先从 src 找模块，找不到再去 node_modules，别一层层往上找。还可以加别名，比如 `@` 指向 src，代码里写 `@/components/Button` 就不用写相对路径了，webpack 查找也更快。"

**module.noParse 跳过已编译的库**：

"像 react、react-dom、lodash 这些库，它们的 dist 文件已经是编译好的，没有动态 require，可以让 webpack 跳过解析，直接当成黑盒子。"

### 第二层：加缓存

"缓存是提升二次启动速度的关键。"

**babel-loader 自身缓存**：

"给 babel-loader 加 `cacheDirectory: true`，它会把编译结果存到 `node_modules/.cache/babel-loader`，下次遇到相同代码直接用缓存。"

**cache-loader**：

"在 babel-loader 前面放一层 cache-loader，它会缓存 loader 的输出，不光 babel，其他耗时 loader 也能用。"

**hard-source-webpack-plugin**：

"webpack 4 没有内置持久化缓存，用这个插件做模块级缓存，效果特别明显。二次启动能从几十秒降到几秒。"

### 第三层：并行处理

"把多核 CPU 用起来。"

**thread-loader**：

"在 babel-loader 前面加 thread-loader，它会启动多个 worker 进程并行编译。worker 数量设为 CPU 核心数减 1，别把 CPU 占满。"

**terser-webpack-plugin 并行压缩**：

"生产构建时，压缩代码也可以并行。给 terser-webpack-plugin 加 `parallel: true`，速度能快不少。"

### 第四层：开发态不做生产态的事

"开发时不需要追求完美，能跑就行。"

**选对 devtool**：

"开发态用 `cheap-module-source-map`，性价比最高——能定位到源码行，又不会太慢。别用 `source-map`，那是给生产环境用的。"

**关闭不必要的优化**：

"开发时把 `minimize` 和 `splitChunks` 都关掉。压缩和代码分割很耗时，开发阶段不需要，HMR 反而更流畅。"

**watch 忽略 node_modules**：

"webpack 的 watch 模式会监听文件变化，忽略 node_modules 能减少 IO 压力，HMR 响应更快。"

### 第五层：减小依赖体积与长期缓存

**IgnorePlugin 剔除无用代码**：

"比如 moment.js 默认会打包所有语言的 locale 文件，我们只用中文，就用 IgnorePlugin 把其他 locale 去掉。"

**按需引入**：

"antd 用 `babel-plugin-import` 按需加载，lodash 换成 `lodash-es`，这样只会打包用到的部分。"

**生产态代码分割**：

"把第三方依赖、antd、react 分别抽成独立 chunk，配合 `contenthash` 和 `runtimeChunk`，实现长期缓存——只有代码变了，对应的文件 hash 才变，用户不用重复下载。"

---

## esbuild-loader 迁移：双轨制方案

"后来我们把 babel-loader 换成了 esbuild-loader，速度提升更明显。但 esbuild 不是万能的，所以用了双轨制。"

**为什么换？**

"esbuild 是用 Go 写的，转译速度比 babel 快很多。我们测试下来，转译时间从分钟级降到了秒级。"

**为什么双轨制？**

"esbuild 不处理 polyfill，也不支持自定义 babel 插件。所以我们让大部分代码走 esbuild-loader，需要 babel-plugin-import 的 antd 组件和一些遗留代码继续走 babel-loader。"

**具体做法**：

- 轨道 A：`/src` 下的主流代码，用 esbuild-loader；
- 轨道 B：`/src/legacy-babel` 和 `/src/components/antd-wrapper`，继续用 babel-loader；
- 类型检查交给 `fork-ts-checker-webpack-plugin` 单独跑，不阻塞转译。

**polyfill 怎么处理？**

"esbuild 不自动注入 polyfill，所以我们在入口文件手动 import core-js 和 regenerator-runtime。如果需要按浏览器按需注入，可以把 polyfill 文件单独交给 babel 处理。"

---

## 量化验证：用数据说话

"优化前后的数据对比很重要，这是证明优化有效的关键。"

| 指标 | 优化前 | 优化后 | 提升 |
|---|---|---|---|
| 冷启动（清缓存） | 45秒 | 18秒 | 60% |
| 二次启动（缓存命中） | 45秒 | 6秒 | 87% |
| HMR（改组件到刷新） | 3秒 | 800ms | 73% |
| 生产构建 | 90秒 | 35秒 | 61% |
| 主包 gzip 后 | 300KB | 180KB | 40% |

---

## CI 缓存与工程基建

"CI 环境也要做缓存，不然每次构建都从头来，太浪费时间。"

**缓存目录**：

"把 `node_modules/.cache` 下面的 esbuild-loader、babel-loader、hard-source 这些缓存目录都纳入 CI 缓存。GitHub Actions 里用 `actions/cache` 就能实现。"

**工程侧优化**：

- 类型检查和 lint 放到 pre-commit，别塞进 webpack loader；
- 统一 Node 版本，用 `.nvmrc` 约束；
- SSD + 把项目目录加入 Windows Defender 排除项，避免扫描拖慢 IO；
- 把构建时间纳入监控，慢了能报警。

---

## 面试高频追问

**Q：cheap-module-source-map 和 eval 的区别？**

"A：`cheap` 是不列信息，省体积和时间；`module` 是保留 loader 的原始 source，能准确定位到 tsx 源码；`eval` 是每个模块用 eval 包一层，最快但调试体验差。开发态首选 `cheap-module-source-map`。"

**Q：webpack 4 和 5 的核心区别？**

"A：webpack 5 内置了持久化缓存，不用再装 hard-source；有 asset modules，替代 url-loader 和 file-loader；tree-shaking 更彻底；默认移除 Node polyfill，产物更小。"

**Q：esbuild-loader 替换 babel 后 polyfill 怎么办？**

"A：入口文件手动 import core-js 和 regenerator-runtime；或者单独做一个 polyfill chunk，按 browserslist 目标注入。"

**Q：为什么开发态不建议 splitChunks？**

"A：splitChunks 需要计算 chunk 依赖关系，越复杂越慢。开发态关心的是改完立即看到效果，不是产物体积。"

**Q：怎么验证缓存真的生效了？**

"A：跑两次 npm start，看第二次耗时是不是明显减少；看 node_modules/.cache 下有没有生成对应目录；清缓存再跑，耗时应该会上升。"

**Q：noParse 为什么不能乱加？**

"A：它会完全跳过 webpack 的依赖解析。如果加在还有动态 require 的库上，运行时会报错。只能用在自包含的最终产物上。"

**Q：contenthash、chunkhash、hash 的区别？**

"A：`hash` 是一次构建所有文件都一样；`chunkhash` 基于 chunk 内容；`contenthash` 基于抽出后的文件内容，最适合长期缓存——比如 css 从 js 抽出后，css 的 hash 不会因为 js 变化而变。"

---

## 收尾总结

"总的来说，webpack 优化的思路是：先诊断拿数据，再按改动最小到最大的顺序来——先缩小范围、加缓存、选对 devtool，再上并行，最后评估是否换 esbuild-loader。每次只改一个变量，方便归因。"

"我们项目通过这些手段，冷启动从 45 秒降到 18 秒，二次启动 6 秒，HMR 800 毫秒，效果还是很显著的。"
