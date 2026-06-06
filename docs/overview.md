# MonoNest 工程概览

`docs/overview.md` 只记录工程事实；编码约束看 `docs/spec.md`，命令流程看 `docs/workflows/*`。

## 1. 一句话

MonoNest 是基于 `NestJS + MongoDB + JWT/OAuth` 的内容平台后端，服务公开内容读取、管理端内容治理、媒体上传、搜索推荐、用户互动和 AI 编辑辅助。

## 2. 技术与运行

- Node.js：`>=20`
- pnpm：`10.11.0`
- 框架：NestJS 11
- 数据库：MongoDB + Mongoose
- 可选基础设施：Redis
- 进程管理：PM2
- API 前缀默认：`/api/v1`
- 健康检查：`GET /api/v1/health`

## 3. 顶层目录

```text
src/                  后端源码
test/                 E2E 测试入口
docs/                 工程、接口、业务与流程文档
scripts/              索引同步、生产依赖检查、数据回填脚本
deploy/               生产环境变量模板
.github/workflows/    部署与回滚工作流
dist/                 构建产物
```

## 4. 源码模块

核心业务：

- `articles`：情报
- `topics`：游戏
- `books`：书库
- `images`：图包
- `comments`：评论与回复
- `favorites`：收藏关系
- `drafts`：草稿
- `notification`：消息通知
- `history`：浏览历史
- `featured-contents`：精选配置
- `home`：首页聚合
- `search`：搜索、精选、相关推荐

后台与辅助：

- `admin`：管理端内容治理与汇总
- `ai`：管理端 AI 编辑辅助
- `media`：上传、预览、下载、ZIP
- `users`、`auth`：用户、登录、刷新、OAuth、授权

横切与基础设施：

- `common`：守卫、装饰器、拦截器、常量、工具
- `config`：环境变量校验与 `registerAs` 配置
- `infra`：Mongo、Redis、logger、storage、audit、mail、metrics
- `workspace`：跨内容摘要、关系清理、访问记录等内部能力
- `types`：类型聚合

## 5. 启动链路

```text
ConfigModule.forRoot
-> ThrottlerModule
-> Mongo / Redis / Logger / Storage / Audit
-> Auth / Users / Media / Content Modules
-> Global Guards: Throttler + JWT + Roles
-> Global Interceptors: Idempotency + Response
-> Global Filter: AllExceptionsFilter
-> main.ts bootstrap
-> traceId / helmet / body limit / validation pipe / CORS / global prefix
```

## 6. 环境变量

读取顺序：

- 非生产：`.env.local -> .env.dev -> .env`
- 生产：只读取 `.env`

生产服务器环境文件固定为：

```text
/www/env/backend/.env
```

关键变量组：

- App：`NODE_ENV`、`PORT`、`API_PREFIX`、`CORS_ORIGINS`
- Mongo：`MONGO_URI`、`MONGO_DB_NAME`、`MONGO_SYNC_INDEXES_ON_BOOT`、`MONGO_REQUIRE_TRANSACTIONS`
- Redis：`REDIS_ENABLED`、`REDIS_URL`
- JWT：`JWT_ACCESS_SECRET`、`JWT_REFRESH_SECRET` 等
- OAuth：`AUTH_ENABLE_OAUTH`、`OAUTH_GOOGLE_*`
- AI：`OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL_ADMIN_COMPOSE`
- Media：`MEDIA_STORAGE_ROOT`、上传大小、ZIP 限制、预览并发等

模板：`deploy/env.production.example`。

## 7. 工程入口

根脚本：

- `start:dev`
- `lint`
- `test`
- `test:e2e`
- `build`
- `deps:prod:check`
- `db:indexes:sync`
- `db:search-terms:backfill`

部署：

- 自动发布：`.github/workflows/deploy-backend.yml`
- 手动回滚：`.github/workflows/rollback-backend.yml`
- PM2 配置：`ecosystem.config.cjs`
- 发布包：`dist`、`package.json`、`pnpm-lock.yaml`、`ecosystem.config.cjs`

## 8. 文档入口

1. `docs/spec.md`：AI 编码约束
2. `docs/API接口与参数说明.md`：接口协议
3. `docs/业务与架构设计说明.md`：业务规则与架构设计
4. `docs/工程目录与运行指南.md`：运行、部署、排障
5. `docs/workflows/README.md`：命令流程入口
6. `docs/deployment-guide.md`：前后端一体化部署历史 runbook
