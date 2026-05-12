# MonoNest Backend

基于 `NestJS + MongoDB + JWT/OAuth` 的内容平台后端脚手架（Redis 缓存层可选）。

## 核心特性

- 模块化单体：Auth / Users / Articles / Drafts / Comments / Favorites / Books / Topics / Images / Search
- 业务分层：`Controller -> Service/Application -> Repository -> Schema`
- 安全基线：Helmet、CORS 白名单、参数校验、限流、统一响应、全局异常过滤
- 认证体系：注册、登录、刷新令牌、登出、会话管理、授权校验
- 检索能力：全文检索（Mongo `$text`）+ 快速检索（关键词联想）
- 缓存策略：Redis 缓存层默认关闭，可通过 `REDIS_ENABLED=true` 手动开启

## 文档索引

- [实现约束 Spec](./docs/spec.md)
- [工程目录与运行指南](./docs/工程目录与运行指南.md)
- [API接口与参数说明（前端对接版）](./docs/API接口与参数说明.md)

## 本地启动（Node）

```bash
pnpm install
cp .env.dev
pnpm start
# 或开发热更新
pnpm start:dev
```

服务地址：`http://localhost:3000/api/v1`

前端本地联调时，如果开发服务器运行在 `5173`，请确保后端 `CORS_ORIGINS` 包含 `http://localhost:5173`

生产启动：

```bash
pnpm build
pnpm start:prod
```

## 一键启动（Docker Compose）

```bash
docker compose up -d --build
```

- API: `http://localhost:3000/api/v1`
- MongoDB: `mongodb://localhost:27017/mononest`
- Redis: `redis://localhost:6379`（可选，默认关闭）

停止：

```bash
docker compose down
```


