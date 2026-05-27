# Test Workflow

## 测试栈

- Jest 30
- ts-jest
- Supertest
- Nest Testing Module

配置入口：

- 单元测试：`jest.config.ts`
- E2E：`test/jest-e2e.json`

## 命令

```bash
pnpm test
pnpm test:watch
pnpm test:cov
pnpm test:e2e
```

## 当前测试分布

已有较多 `.spec.ts` 分布在模块旁，例如：

- `admin`
- `ai`
- `books`
- `comments`
- `common/utils`
- `favorites`
- `health`
- `history`
- `home`
- `infra/audit`
- `interactions`
- `media`
- `notification`
- `search`
- `topics`
- `users`
- `workspace`

## 补测试原则

- 改业务逻辑，优先补最小必要测试。
- 改计数、关系、删除、私密、后台治理，必须覆盖主链路和异常/边界分支。
- 改 DTO 校验，补 DTO 或 controller 层测试。
- 改 repository 查询，至少覆盖过滤条件、分页、可见性口径。
- 改最终一致侧写，测试主链路不被阻塞，同时确认失败可观测。

## 合并前建议

```bash
pnpm test
pnpm lint
pnpm build
```

触及部署包或生产依赖时追加：

```bash
pnpm deps:prod:check
```