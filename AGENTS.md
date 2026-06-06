# AGENTS.md

本文件是给 AI 代理的仓库入口索引：先用它定位约束、文档和模块，再回到对应 docs 查细节。任何编码约束冲突时，以 `docs/spec.md` 为准。

## 必读顺序

1. 每个新的编码会话先读 `docs/spec.md`。
2. 涉及工程结构、模块边界、启动链路或运行事实时，再读 `docs/overview.md`。
3. 涉及命令、测试、构建、提交或部署时，再读 `docs/workflows/README.md` 和对应子文档。
4. 按任务命中补读：
   - 接口协议：`docs/API接口与参数说明.md`
   - 业务规则、架构设计、AI 编辑辅助：`docs/业务与架构设计说明.md`
   - 运行、环境、生产部署、排障：`docs/工程目录与运行指南.md`
   - 前后端一体化部署历史 runbook：`docs/deployment-guide.md`

## 默认 Skill

- 在 MonoNest 中做实现、重构、review 修复、清理、API、数据一致性、部署或测试任务时，使用 `.codex/skills/mononest-spec-coding/SKILL.md`。
- `docs/spec.md` 是约束源；详细文档只补充事实，不覆盖 spec。

## 仓库定位

- MonoNest 是 `NestJS 11 + MongoDB/Mongoose + JWT/OAuth` 的内容平台后端。
- 服务对象：`MonoApp`、`portal-web` 公开读取侧、`admin-web` 管理编辑侧，以及登录态 AI 编辑辅助场景。
- 稳定能力：公开内容读取、管理端治理、媒体上传/预览/下载/ZIP、搜索推荐、评论收藏通知历史、AI 编辑辅助。
- 运行要求：Node.js `>=20`，pnpm `10.11.0`，MongoDB 必需，Redis 可选，PM2 用于生产进程管理。
- 默认 API 前缀：`/api/v1`；健康检查：`GET /api/v1/health`。

## 架构地图

- 根启动：`src/main.ts` 负责 traceId、helmet、body limit、ValidationPipe、CORS、global prefix；`src/app.module.ts` 负责模块装配、全局 guard/interceptor/filter。
- 默认分层：`Controller -> Service/Application -> Repository -> Schema`。
- `controller`：路由、鉴权、DTO 校验、参数拆解。
- `service/application`：业务编排、事务边界、副作用协调、结果映射。
- `repository`：数据访问与查询表达。
- `schema`：集合结构、索引和持久化字段。
- 只有当真实重复、职责失衡或边界稳定时，才拆 `presenter`、`query service`、`command service`、`domain service` 或共享 `util`。

## 模块索引

- 核心内容：`articles` 情报、`topics` 游戏、`books` 书库、`images` 图包。
- 内容配套：`comments` 评论与回复、`favorites` 收藏关系、`drafts` 草稿、`notification` 消息通知、`history` 浏览历史、`featured-contents` 精选配置。
- 聚合与发现：`home` 首页聚合、`search` 搜索/精选/相关推荐。
- 后台与辅助：`admin` 内容治理与汇总、`ai` 管理端 AI 编辑辅助、`media` 上传预览下载 ZIP、`report` 预留报表域。
- 用户与认证：`auth` 登录/刷新/OAuth/授权，`users` 用户资料与业务统计。
- 横切与基础设施：`common` 守卫/装饰器/拦截器/常量/工具，`config` 环境配置与校验，`infra` Mongo/Redis/logger/storage/audit/mail/metrics，`interactions` 收藏/评论计数与关系校验。
- 内部跨域能力：`workspace` 跨内容摘要、关系清理、访问记录；不单独暴露 HTTP 控制器。
- 类型聚合：`types` 只放共享类型，不作为业务模块。

## 启动与全局机制

- 环境文件读取：非生产 `.env.local -> .env.dev -> .env`；生产只读 `.env`。
- 全局模块装配顺序核心：`ConfigModule`、`ThrottlerModule`、Mongo/Redis/Logger/Storage/Mail/Metrics/Audit，再加载业务模块。
- 全局 guard：`ThrottlerGuard`、`JwtAuthGuard`、`RolesGuard`。
- 全局 interceptor：`IdempotencyInterceptor`、`ResponseInterceptor`。
- 全局 exception filter：`AllExceptionsFilter`。
- 生产环境变量固定放在服务器 `/www/env/backend/.env`，不进入 Git 或发布包。

## 文档路由

- `docs/spec.md`：AI 编码硬约束、分层边界、数据一致性、业务场景硬规则、校验矩阵。
- `docs/overview.md`：工程事实、顶层目录、源码模块、启动链路、环境变量组、入口脚本。
- `docs/API接口与参数说明.md`：所有对外协议，覆盖 Auth、Users、Home、Search、Admin、四类内容、Drafts、Comments、Favorites、Notifications、History、Media、Admin AI。
- `docs/业务与架构设计说明.md`：四类核心内容语义、内容生命周期、首页/搜索/精选、模块边界、AI 编辑辅助契约、稳定字典。
- `docs/工程目录与运行指南.md`：目录结构、环境变量、索引同步、本地运行、阿里云发布、PM2、回滚、上线检查、排障。
- `docs/workflows/README.md`：命令流程入口；子文档为 `build.md`、`test.md`、`commit.md`、`deploy.md`。

## 硬规则

- 不使用破坏性 git 命令，不回退用户已有改动，除非用户明确要求。
- 贴合当前模块化单体边界，不平行新建第二套入口、服务或协议。
- 不为了分层而分层；抽象必须来自真实重复、职责失衡或稳定边界。
- 不保留兼容残留：旧字段、旧 DTO、双轨 mapper、fallback 协议、临时别名、冗余分支都应在迁移完成时清理。
- 行为迁移时同步清理残留代码、测试和文档。
- 后端不写前端展示占位策略，只保存真实业务值或语义一致的空值。
- 对外协议统一 `camelCase`；存储层字段统一 `snake_case`。
- API 返回要显式稳定，对外标识字段转字符串，不依赖 `ObjectId` 隐式序列化。

## 数据一致性

- 先判断主链路与侧写链路。
- 强一致：内容主记录、收藏关系、评论根记录、回复记录、`favorCount`、`replyCount`、权限、可见性、后台治理、管理审计。
- 最终一致：历史、通知、用户侧审计、非关键侧写。
- 强一致主链路不能接受“主记录成功、关系或计数失败但仍返回成功”。
- 最终一致不等于静默失败，必须保留明确日志。
- 删除、设私密、永久删除都必须评估收藏、历史、通知、评论可见性、精选配置、个人中心列表和计数清理。

## 稳定业务事实

- 四类内容统一具有 `reviewStatus`、`visibility`、`viewCount`、`favorCount`、`replyCount`。
- 新提交内容默认进入 `approved + public`。
- 公开接口只返回可公开内容；详情访问会累加 `view_count`。
- 公开可见口径：`articles = published + approved + public + not deleted`；`books/topics/images = approved + public`。
- 评论模型保持“根评论分页 + 回复预览 + 完整回复单拉”；详情主接口 `replyCount` 表示总讨论量。
- `POST /favorites/toggle` 是收藏关系统一入口，关系变化后同步回写目标内容 `favorCount`。
- 历史记录是最近访问模型，不是完整行为流水。
- 通知读模型优先满足可定位、可跳转、可标记已读，不堆额外 viewer state。
- 管理端设私密、取消精选、永久删除必须处理关联清理；后台治理和管理审计属于强一致链路。
- AI 模块只返回编辑建议，不自动保存、发布或回写业务库；流式接口中 `completed` 才是最终可应用结果。
- 媒体上传、预览、下载、ZIP 解包/打包要区分 HTTP 行为，不混用 `preview` 与 `download`。
- 不要恢复或兼容历史字段：图包 `width`/`height`、书籍 `hots`、游戏 `scheduleLabel`。

## 常用命令

- 首次准备：`corepack enable`，`pnpm install`。
- 本地开发：`pnpm start:dev`，默认 `http://localhost:3000/api/v1`。
- 基础校验：`pnpm test`，`pnpm lint`，`pnpm build`。
- E2E：`pnpm test:e2e`。
- 生产依赖检查：先 `pnpm build`，再 `pnpm deps:prod:check`。
- Mongo 索引同步：`pnpm db:indexes:sync`，仅在明确需要同步索引时执行，生产建议维护窗口。
- 搜索词回填：`pnpm db:search-terms:backfill`。
- PM2：`pnpm pm2:start`、`pnpm pm2:reload`、`pnpm pm2:logs`、`pnpm pm2:stop`。

## 校验矩阵

- 业务逻辑、DTO、service/application、repository、schema：默认 `pnpm test` + `pnpm lint` + `pnpm build`。
- 单模块窄改：相关 `.spec.ts` + `pnpm lint` + `pnpm build`。
- 部署、生产依赖、PM2、GitHub Actions：`pnpm build` + `pnpm deps:prod:check`。
- 数据库索引：只在明确需要时执行 `pnpm db:indexes:sync`。
- 文档：至少检查 diff；必要时运行 `git diff --check -- docs AGENTS.md`。

## 部署事实

- 生产主路径：push `main` -> GitHub Actions 构建 -> 上传阿里云 -> release 目录解压 -> PM2 启动当前 release。
- 自动部署入口：`.github/workflows/deploy-backend.yml`；回滚入口：`.github/workflows/rollback-backend.yml`。
- 发布包固定包含 `dist`、`package.json`、`pnpm-lock.yaml`、`ecosystem.config.cjs`。
- 服务器目录：`/www/apps/backend/releases/<git-sha>`，`/www/apps/backend/current`，`/www/apps/backend/shared`，`/www/env/backend/.env`。
- 生产默认 `MONGO_REQUIRE_TRANSACTIONS=true`；MongoDB 必须是 replica set 或 mongos，standalone 不满足强一致链路事务要求。
- PM2 固定事实：应用名 `mononest-api`，入口 `dist/src/main.js`，`fork` 单进程，`max_memory_restart=512M`。
- 运行时代码引用的包必须在 `dependencies`，不能只放 `devDependencies`。

## 文档同步规则

- API 协议变化：同步 `docs/API接口与参数说明.md`。
- 业务规则、模块边界、架构设计、AI 编辑辅助契约变化：同步 `docs/业务与架构设计说明.md`。
- 运行、环境、部署、排障变化：同步 `docs/工程目录与运行指南.md` 或 `docs/workflows/deploy.md`。
- 命令、测试、构建、提交、部署流程变化：同步 `docs/workflows/*`。
- AI 编码硬规则、分层边界、数据一致性、删除清理、评论/收藏/通知/历史/后台治理模式变化：同步 `docs/spec.md`。

## 快速检索

- 找路由：`rg "@(Get|Post|Patch|Delete|Put)" src`
- 找 DTO：`rg "class .*Dto" src`
- 找 schema：`rg "@Schema|SchemaFactory" src`
- 找 repository：`rg "Repository" src`
- 找测试：`rg --files -g "*.spec.ts" src test`
- 找内容字典：`rg "LABELS|TOPIC_TYPE|FEATURE_FLAG" src/common src`
