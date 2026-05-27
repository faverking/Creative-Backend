# Build Workflow

## 准备

```bash
corepack enable
pnpm install
```

本地通常使用 `.env.local -> .env.dev -> .env`，生产只读取 `.env`。

## 本地启动

```bash
pnpm start:dev
```

默认地址：

```text
http://localhost:3000/api/v1
```

常用 PM2 命令：

```bash
pnpm pm2:start
pnpm pm2:reload
pnpm pm2:logs
pnpm pm2:stop
```

## 构建

```bash
pnpm build
```

产物入口：

```text
dist/src/main.js
```

生产启动：

```bash
pnpm start:prod
```

## 生产依赖检查

部署包只安装 `dependencies`。如果运行时代码引用了包，它必须在 `dependencies` 中。

```bash
pnpm build
pnpm deps:prod:check
```

`deps:prod:check` 会扫描 `dist/src/**/*.js` 中的 runtime require。

## 数据脚本

同步索引：

```bash
pnpm db:indexes:sync
```

搜索词回填：

```bash
pnpm db:search-terms:backfill
```

索引同步建议在开发环境或生产维护窗口执行。

## CI 对齐

后端自动部署流水线核心构建步骤：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm deps:prod:check
```

发布包包含：

- `dist`
- `package.json`
- `pnpm-lock.yaml`
- `ecosystem.config.cjs`