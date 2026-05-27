# AGENTS.md

## 必读顺序

- 每个新的编码会话先读 `docs/spec.md`。
- 涉及工程结构、模块边界或运行事实时，再读 `docs/overview.md`。
- 涉及命令、测试、构建、提交或部署时，再读 `docs/workflows/README.md` 和对应子文档。
- 涉及接口协议时读 `docs/API接口与参数说明.md`；涉及业务规则时读 `docs/业务与架构设计说明.md`；涉及生产环境与排障时读 `docs/工程目录与运行指南.md`。

## 默认 Skill

- 在 MonoNest 中做实现、重构、review 修复、清理、API、数据一致性、部署或测试任务时，使用 `.codex/skills/mononest-spec-coding/SKILL.md`。
- `docs/spec.md` 是约束源；详细文档只补充事实，不覆盖 spec。

## 硬规则

- 不使用破坏性 git 命令，不回退用户已有改动，除非用户明确要求。
- 按当前模块化单体边界实现：`Controller -> Service/Application -> Repository -> Schema`。
- 不为了分层而分层；只有真实重复、职责失衡或边界稳定时才抽象。
- 不保留兼容残留：旧字段、旧 DTO、双轨 mapper、fallback 协议和临时别名都应在迁移完成时清理。
- 先判断主链路与侧写链路：计数、关系、权限、可见性和后台治理优先强一致；历史、通知、用户侧审计可最终一致但必须可观测。
- 后端不写前端展示占位策略，只保存真实业务值或语义一致的空值。