---
name: mononest-spec-coding
description: Use this skill for MonoNest backend tasks that must follow docs/spec.md, including NestJS API implementation, MongoDB schema/repository/service changes, data consistency fixes, refactors, code review fixes, deployment scripts, tests, cleanup, and requests like 按 spec 编码、遵守后端约束、清理冗余代码.
---

# MonoNest Spec Coding

## 目标

在 MonoNest 内编码时，以 `docs/spec.md` 为项目约束源。这个 skill 规定工作流程、场景判断和交付要求，不复制完整业务文档。

## 任务开始

1. 先读 `docs/spec.md`。
2. 涉及模块结构或工程事实时，读 `docs/overview.md`。
3. 涉及命令、测试、构建、提交或部署时，读 `docs/workflows/README.md` 和对应子文档。
4. 涉及接口协议时，读 `docs/API接口与参数说明.md`。
5. 涉及业务规则、内容生命周期或前后端契约时，读 `docs/业务与架构设计说明.md`。
6. 涉及生产环境、PM2、GitHub Actions、回滚或排障时，读 `docs/工程目录与运行指南.md`。

## 编码循环

1. 先确认现有模块边界，再决定落点。
2. 默认沿 `Controller -> Service/Application -> Repository -> Schema` 分层实现。
3. 先识别主链路与侧写链路，再决定事务、容错和日志策略。
4. 数据一致性优先于结构优雅度；权限、可见性、计数、关系不能各走各的口径。
5. 只有真实重复、职责失衡或边界稳定时才拆 presenter、query service、command service 或 util。
6. 不保留兼容分支、旧字段、旧 DTO、重复 mapper、fallback 协议或临时别名。
7. 行为迁移时同步清理残留代码、测试和文档。
8. 后端只保存真实业务值或语义一致的空值，不写前端占位图、占位文案等展示策略。

## 场景路由

命中以下场景时，按 `docs/spec.md` 对应章节执行：

- 新增或调整 API：保持路由语义、DTO、返回结构和当前前端消费模型一致。
- 服务或模块重构：确保边界更清楚，而不是调用链更长。
- 计数、关系、收藏、评论、删除、私密、后台治理：优先强一致并处理关联清理。
- 通知、历史、用户侧审计：允许最终一致，但失败必须有明确日志。
- 媒体上传、ZIP、预览、下载：检查大小、并发、临时文件、持久化目录和运行时依赖。
- 部署与生产依赖：对齐 `.github/workflows/deploy-backend.yml`、`ecosystem.config.cjs` 和 `scripts/check-production-dependencies.js`。

## 交付前

1. 按改动范围运行最小有效校验。
2. 默认优先考虑 `pnpm test`、`pnpm lint`、`pnpm build`。
3. 触及生产部署或依赖边界时，运行 `pnpm deps:prod:check` 前需先 `pnpm build`。
4. 如果校验无法运行，说明原因。
5. 总结变更时说明职责边界、数据一致性处理方式和清理掉的残留。
