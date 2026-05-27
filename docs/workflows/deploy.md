# Deploy Workflow

MonoNest 后端生产部署由 GitHub Actions push `main` 自动触发。

## 发布结构

```text
/www/apps/backend
├─ releases/<git-sha>
├─ shared/backend.tar.gz
└─ current -> releases/<git-sha>

/www/env/backend/.env
```

PM2 应用名：`mononest-api`。

运行入口：

```text
dist/src/main.js
```

## 自动部署

入口：

```text
.github/workflows/deploy-backend.yml
```

触发：

```text
push main
```

核心步骤：

1. Setup Node.js 20 与 `pnpm@10.11.0`。
2. `pnpm install --frozen-lockfile`。
3. `pnpm build`。
4. `pnpm deps:prod:check`。
5. 打包 `dist`、`package.json`、`pnpm-lock.yaml`、`ecosystem.config.cjs`。
6. 上传 `backend.tar.gz` 到 `/www/apps/backend/shared`。
7. 解压到 `/www/apps/backend/releases/<git-sha>`。
8. 服务器执行 `pnpm install --prod --frozen-lockfile`。
9. 复制 `/www/env/backend/.env` 到 release。
10. 切换 `/www/apps/backend/current`。
11. 重启 PM2 `mononest-api`。
12. 配置 `pm2-logrotate`。
13. 健康检查 `GET /<API_PREFIX>/health`。
14. 仅保留最近 5 个 release。

## 回滚

入口：

```text
.github/workflows/rollback-backend.yml
```

触发方式：GitHub Actions 手动 `workflow_dispatch`，输入 `release_id`。

回滚会校验：

- release id 格式
- release 目录存在
- `ecosystem.config.cjs` 存在
- `dist/src/main.js` 存在
- `/www/env/backend/.env` 存在

## 服务器前置条件

```bash
mkdir -p /www/apps/backend/shared /www/apps/backend/releases /www/env/backend /var/lib/mononest/media
corepack enable
corepack prepare pnpm@10.11.0 --activate
npm install -g pm2
```

生产环境变量文件：

```text
/www/env/backend/.env
```

模板：`deploy/env.production.example`。

GitHub Secrets：

- `SERVER_HOST`
- `SERVER_USER`
- `SERVER_PORT`
- `SERVER_SSH_KEY`

## PM2

配置入口：`ecosystem.config.cjs`。

固定事实：

- `name=mononest-api`
- `script=dist/src/main.js`
- `exec_mode=fork`
- `instances=1`
- `max_memory_restart=512M`
- `NODE_ENV=production`

常用命令：

```bash
pnpm pm2:start
pnpm pm2:reload
pnpm pm2:logs
pnpm pm2:stop
pm2 save
```

## Nginx 契约

后端建议仅监听本机，由 Nginx 代理 `/api/`：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

如果 NestJS 使用 `app.setGlobalPrefix('api/v1')`，`proxy_pass` 不带尾部 `/`，让 `/api/v1/...` 原样转发。

## 上线前检查

- `/www/env/backend/.env` 存在且 `NODE_ENV=production`。
- `MONGO_URI` 指向生产数据库。
- JWT secret 不是示例值。
- `CORS_ORIGINS` 只包含真实前端地址。
- `MEDIA_STORAGE_ROOT` 指向持久化目录且 PM2 用户可写。
- GitHub Secrets 已配置。
- `curl http://127.0.0.1:3000/api/v1/health` 可访问。
- 首次部署或 schema 索引变化后，在维护窗口执行 `pnpm db:indexes:sync`。