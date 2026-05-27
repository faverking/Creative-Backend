# MonoNest Workflow Playbook

本目录只记录可执行流程。项目边界和编码规则看 `docs/spec.md`。

## 基础

- Node.js：`>=20`
- pnpm：`10.11.0`
- 命令默认在仓库根目录执行

首次准备：

```bash
corepack enable
pnpm install
```

## 常用命令

| 目标 | 命令 |
| --- | --- |
| 开发启动 | `pnpm start:dev` |
| 构建 | `pnpm build` |
| lint | `pnpm lint` |
| 单元测试 | `pnpm test` |
| E2E 测试 | `pnpm test:e2e` |
| 生产依赖检查 | `pnpm build && pnpm deps:prod:check` |
| 同步 Mongo 索引 | `pnpm db:indexes:sync` |
| 回填搜索词 | `pnpm db:search-terms:backfill` |

## 快速选择

| 场景 | 推荐命令 |
| --- | --- |
| 提交前默认门禁 | `pnpm test && pnpm lint && pnpm build` |
| 改生产依赖或部署包 | `pnpm build && pnpm deps:prod:check` |
| 改 schema 索引 | 先评估，再在维护窗口执行 `pnpm db:indexes:sync` |
| 改 API 协议 | 同步 `docs/API接口与参数说明.md`，并跑相关测试 |
| 改业务规则 | 同步 `docs/业务与架构设计说明.md` 和必要测试 |
| 改部署链路 | 对齐 `.github/workflows/deploy-backend.yml` 与 `docs/工程目录与运行指南.md` |

## 子文档

- [构建与运行](./build.md)
- [测试流程](./test.md)
- [提交流程](./commit.md)
- [部署流程](./deploy.md)