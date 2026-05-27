# MonoNest Backend

`MonoNest` 是基于 `NestJS + MongoDB + JWT/OAuth` 的内容平台后端，服务公开内容读取、管理端内容治理、媒体上传、搜索推荐、用户互动和 AI 编辑辅助。

## 核心能力

- 模块化单体：Auth / Users / Articles / Books / Topics / Images / Comments / Favorites / Search
- 业务分层：`Controller -> Service/Application -> Repository -> Schema`
- 安全基线：Helmet、CORS 白名单、参数校验、限流、统一响应、全局异常过滤
- 检索能力：Mongo 全文检索、快速搜索、精选推荐、相关推荐
- 运维路径：GitHub Actions 自动构建发布到阿里云，生产进程由 PM2 管理，部署后执行健康检查

## 本地开发

要求：

- Node.js `>=20`
- pnpm `10.11.0`
- MongoDB
- Redis 可选

启动：

```bash
pnpm install
pnpm start:dev
```

默认地址：

```text
http://localhost:3000/api/v1
```

环境文件读取顺序：

- 非生产：`.env.local -> .env.dev -> .env`
- 生产：只读取 `.env`

## 常用命令

```bash
pnpm lint
pnpm test
pnpm build
pnpm start:prod
pnpm build && pnpm deps:prod:check
```

PM2：

```bash
pnpm pm2:start
pnpm pm2:reload
pnpm pm2:logs
pnpm pm2:stop
```

## 生产部署

生产主路径：

```text
push main -> GitHub Actions 构建 -> 上传阿里云 -> release 目录解压 -> PM2 启动当前 release
```

部署入口：

```text
.github/workflows/deploy-backend.yml
```

生产环境变量由服务器文件管理：

```text
/www/env/backend/.env
```

模板：

```text
deploy/env.production.example
```

健康检查：

```text
GET /api/v1/health
```

## 文档索引

- [AI 编码约束](./docs/spec.md)
- [工程概览](./docs/overview.md)
- [流程入口](./docs/workflows/README.md)
- [API 接口与参数说明](./docs/API接口与参数说明.md)
- [业务与架构设计说明](./docs/业务与架构设计说明.md)
- [工程目录与运行指南](./docs/工程目录与运行指南.md)
- [部署历史 runbook](./docs/deployment-guide.md)