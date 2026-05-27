# Commit Workflow

## 提交前门禁

默认：

```bash
pnpm test
pnpm lint
pnpm build
```

触及生产依赖、部署包、PM2 或 GitHub Actions 时追加：

```bash
pnpm deps:prod:check
```

## 提交信息

使用 Conventional Commits：

```text
<type>: <subject>
```

常用类型：

- `feat`
- `fix`
- `refactor`
- `docs`
- `test`
- `chore`

示例：

```text
docs: add mononest agent guide and workflow docs
fix: keep comment counts consistent on reply creation
refactor: split admin content command service
```

## 提交流程

1. 同步最新代码。
2. 按改动范围执行门禁。
3. 暂存改动。
4. 使用规范 commit message 提交。
5. 推送分支或 main。

## 文档同步

以下变化需要同步文档：

- API 协议变化：`docs/API接口与参数说明.md`
- 业务规则或架构边界变化：`docs/业务与架构设计说明.md`
- 运行、环境、部署、排障变化：`docs/工程目录与运行指南.md` 或 `docs/workflows/deploy.md`
- AI 编码硬规则变化：`docs/spec.md`