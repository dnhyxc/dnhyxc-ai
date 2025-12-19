## 创建模块

使用命令 `nest g MODULE_NAME FILE_NAME [--no-spec] [-d]` 创建模块。

```bash
# --no-spec 不创建测试文件文件，即 prompt.container.spec.ts 文件
# -d 只在终端中显示最终创建出来的文件路径，不会在项目中添加该文件
$ nest g container prompt --no-spec -d
```

创建 `prompt` module 模块：

```bash
$ nest g module prompt
```

执行完成之后就会在 `src` 目录下创建 `prompt` 目录，目录下包含 `prompt.module.ts` 文件。

创建 `prompt` controller 控制器：

```bash
$ nest g controller prompt
```

执行完成之后就会在 `src` 目录下创建 `prompt` 目录，目录下包含 `prompt.controller.ts` 文件。

创建 `prompt` service 服务：

```bash
$ nest g service prompt
```

执行完成之后就会在 `src` 目录下创建 `prompt` 目录，目录下包含 `prompt.service.ts` 文件。

## 日志配置

安装依赖：[nestjs-winston](https://www.npmjs.com/package/nest-winston)、[winston-daily-rotate-file](https://www.npmjs.com/package/winston-daily-rotate-file)

```bash
pnpm i winston nestjs-winston
pnpm i winston-daily-rotate-file
```
