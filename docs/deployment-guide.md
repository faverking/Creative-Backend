# Monorepo 前后端自动化部署指南

本文记录从零开始在阿里云服务器上部署 MongoDB、NestJS 后端、前端 Monorepo 多子应用，并接入 GitHub Actions 自动化部署的完整流程。

当前部署目标：

- 服务器：Alibaba Cloud Linux 4
- 数据库：MongoDB
- 后端：NestJS + PM2
- 前端：Monorepo，包含 `portal-web` 和 `admin-web`
- 访问方式：公网 IP，暂不上域名
- 前端路由：
  - `portal-web` 映射 `/`
  - `admin-web` 映射 `/admin/`
- 后端 API：
  - Nginx `/api/` 反向代理到 NestJS

---

## 1. 总体架构

最终访问链路：

```text
浏览器
  ↓
http://公网IP/
  ↓
Nginx
  ↓
portal-web 静态资源

浏览器
  ↓
http://公网IP/admin/
  ↓
Nginx
  ↓
admin-web 静态资源

浏览器
  ↓
http://公网IP/api/xxx
  ↓
Nginx
  ↓
NestJS:127.0.0.1:3000
  ↓
MongoDB:127.0.0.1:27017
```

部署链路：

```text
后端：
push main
  ↓
GitHub Actions
  ↓
构建 NestJS
  ↓
上传服务器
  ↓
安装生产依赖
  ↓
PM2 重启服务

前端：
push tag web-v*
  ↓
GitHub Actions
  ↓
构建 portal-web + admin-web
  ↓
上传统一前端 release 包
  ↓
切换 current 软链接
  ↓
Nginx reload
```

---

## 2. 服务器基础环境

服务器需要提前准备：

```text
Node.js
pnpm / corepack
MongoDB
Nginx
PM2
Git
tar / unzip 等基础工具
```

建议目录结构：

```text
/www
  /apps
    /backend
      /releases
      /shared
      /current -> 某个 release

    /frontend
      /releases
      /shared
      /current -> 某个 web-v* release

  /env
    /backend
      .env.production

  /logs

  /backups
    /mongodb
```

创建基础目录：

```bash
sudo mkdir -p /www/apps/backend/releases
sudo mkdir -p /www/apps/backend/shared
sudo mkdir -p /www/apps/frontend/releases
sudo mkdir -p /www/apps/frontend/shared
sudo mkdir -p /www/env/backend
sudo mkdir -p /www/logs
sudo mkdir -p /www/backups/mongodb
```

---

## 3. MongoDB 安装与启动

Alibaba Cloud Linux 4 使用 MongoDB 官方源可能会遇到网络或镜像同步问题，因此可以使用 RPM 直链或阿里云镜像源安装。

安装后需要确认：

```bash
sudo systemctl status mongod
mongosh
```

推荐 MongoDB 只监听本机：

```yaml
net:
  port: 27017
  bindIp: 127.0.0.1
```

不要开放 MongoDB 公网端口 `27017`。

---

## 4. MongoDB 启动踩坑记录

### 4.1 `/tmp/mongodb-27017.sock` 无法删除

曾出现错误：

```text
Failed to unlink socket file
path: /tmp/mongodb-27017.sock
error: Operation not permitted
```

修复方式：

```bash
sudo systemctl stop mongod

sudo chattr -i /tmp/mongodb-27017.sock 2>/dev/null || true
sudo rm -f /tmp/mongodb-27017.sock

sudo systemctl restart mongod
```

### 4.2 数据目录不存在

曾出现错误：

```text
NonExistentPath: Data directory /data/db not found
```

修复：

```bash
sudo mkdir -p /data/db
sudo chown -R mongod:mongod /data/db
sudo chmod 755 /data/db
```

### 4.3 `storage.dbPath` 重复

曾出现错误：

```text
Error parsing YAML config: duplicate key: storage.dbPath
```

说明 `/etc/mongod.conf` 中重复配置了 `storage.dbPath`。

正确示例：

```yaml
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log

storage:
  dbPath: /data/db

processManagement:
  fork: true

net:
  port: 27017
  bindIp: 127.0.0.1
```

---

## 5. 后端部署方案

后端使用：

```text
NestJS
PM2
GitHub Actions
```

后端服务器目录：

```text
/www/apps/backend
  /releases
    /<git-sha>
  /shared
    backend.tar.gz
  /current -> /www/apps/backend/releases/<git-sha>
```

生产环境变量放在：

```text
/www/env/backend/.env.production
```

示例：

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/mononest
JWT_SECRET=your_secret
```

部署时将它复制到当前 release：

```bash
cp /www/env/backend/.env.production "$RELEASE_DIR/.env"
```

---

## 6. PM2 配置

后端项目根目录需要有 PM2 配置，例如：

```js
module.exports = {
  apps: [
    {
      name: 'mononest-api',
      script: 'dist/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
}
```

注意：实际 `script` 路径要和 NestJS 构建产物一致。

如果构建产物是：

```text
dist/main.js
```

则写：

```js
script: 'dist/main.js'
```

如果构建产物是：

```text
dist/src/main.js
```

则写：

```js
script: 'dist/src/main.js'
```

常用命令：

```bash
pm2 list
pm2 logs mononest-api
pm2 restart mononest-api
pm2 save
```

日志切割使用 `pm2-logrotate`：

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 20M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
pm2 save
```

---

## 7. 后端 GitHub Actions

后端自动部署触发方式：

```text
push main
```

核心流程：

```text
checkout
setup node
pnpm install
pnpm build
打包 dist / package.json / pnpm-lock.yaml / ecosystem 配置
scp 上传服务器
ssh 到服务器解压
pnpm install --prod
复制 .env
切换 current 软链接
pm2 start
安装和配置 pm2-logrotate
curl 健康检查
```

需要配置 GitHub Secrets：

```text
SERVER_HOST
SERVER_USER
SERVER_PORT
SERVER_SSH_KEY
```

---

## 8. SSH Key 踩坑记录

### 8.1 私钥不能带 passphrase

曾出现错误：

```text
ssh.ParsePrivateKey: ssh: this private key is passphrase protected
```

原因：生成 SSH key 时输入了密码。

GitHub Actions 自动部署无法交互输入密码，因此部署专用 key 必须无 passphrase。

生成方式：

```bash
ssh-keygen -t ed25519 -C "github-actions-deploy" -f /root/.ssh/github_actions_deploy
```

提示输入 passphrase 时直接回车。

### 8.2 公钥必须加入 authorized_keys

```bash
cat /root/.ssh/github_actions_deploy.pub >> /root/.ssh/authorized_keys
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
chmod 600 /root/.ssh/github_actions_deploy
```

### 8.3 GitHub Secret 中放私钥

```bash
cat /root/.ssh/github_actions_deploy
```

完整复制到：

```text
SERVER_SSH_KEY
```

必须包含：

```text
-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

### 8.4 `Permission denied publickey`

如果本机测试：

```bash
ssh root@公网IP
```

出现：

```text
Permission denied (publickey,gssapi-keyex,gssapi-with-mic)
```

说明当前本机没有使用正确私钥。GitHub Actions 使用的是 `SERVER_SSH_KEY`，因此重点检查：

```text
1. 私钥是否完整
2. 私钥是否无密码
3. 对应公钥是否在服务器 authorized_keys
4. root 是否允许公钥登录
```

---

## 9. 后端依赖踩坑记录

曾出现：

```text
Error: Cannot find module 'express'
```

原因是生产环境执行了：

```bash
pnpm install --prod --frozen-lockfile
```

只安装 `dependencies`，不安装 `devDependencies`。

如果运行时代码依赖 `express`，则必须放在 `dependencies`：

```bash
pnpm add express
```

如果只是类型依赖：

```bash
pnpm add -D @types/express
```

但如果编译后的 JS 运行时 `require('express')`，则 `express` 必须是生产依赖。

---

## 10. Nginx 后端代理配置

后端只监听本机：

```text
127.0.0.1:3000
```

公网只通过 Nginx 访问：

```text
http://公网IP/api/xxx
```

Nginx `/api/` 配置：

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

如果 NestJS 使用：

```ts
app.setGlobalPrefix('api')
```

则 `proxy_pass` 推荐不带尾部 `/`：

```nginx
proxy_pass http://127.0.0.1:3000;
```

这样 `/api/xxx` 会原样转发到后端。

---

## 11. 前端 Monorepo 部署结构

当前前端是 monorepo，结构类似：

```text
apps
  /portal-web
  /admin-web
```

部署产物被打包为统一 release：

```text
.deploy-package
  /portal
    index.html
    assets/...
  /admin
    index.html
    assets/...
```

服务器解压后：

```text
/www/apps/frontend/releases/web-v1.0.0
  /portal
    index.html
    assets/...
  /admin
    index.html
    assets/...
```

统一 current 软链接：

```text
/www/apps/frontend/current -> /www/apps/frontend/releases/web-v1.0.0
```

最终 Nginx 实际读取：

```text
/www/apps/frontend/current/portal
/www/apps/frontend/current/admin
```

---

## 12. 前端 GitHub Actions

前端自动部署触发方式：

```text
push tag web-v*
```

示例：

```bash
git tag web-v1.0.0
git push origin web-v1.0.0
```

核心流程：

```text
checkout
setup node
pnpm install
pnpm lint / typecheck / test
准备前端构建环境变量
构建 portal-web
构建 admin-web
打包 portal + admin
上传服务器
解压到 releases/web-v*
切换 current 软链接
```

当前 workflow 的核心打包逻辑：

```bash
mkdir -p .deploy-package/portal .deploy-package/admin

cp -r apps/portal-web/dist/. .deploy-package/portal/
cp -r apps/admin-web/dist/. .deploy-package/admin/

test -f .deploy-package/portal/index.html
test -f .deploy-package/admin/index.html

tar -czf frontend.tar.gz -C .deploy-package .
```

服务器部署逻辑：

```bash
RELEASE_DIR="/www/apps/frontend/releases/$RELEASE_ID"
CURRENT_DIR="/www/apps/frontend/current"

tar -xzf "$SHARED_DIR/frontend.tar.gz" -C "$RELEASE_DIR"

ln -sfn "$RELEASE_DIR" "$NEXT_CURRENT_DIR"
mv -Tf "$NEXT_CURRENT_DIR" "$CURRENT_DIR"
```

---

## 13. 前端 Nginx 配置

因为当前前端 release 结构是：

```text
/www/apps/frontend/current
  /portal
  /admin
```

所以 Nginx 需要这样配置：

```nginx
server {
    listen 80 default_server;
    server_name _;

    client_max_body_size 20m;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;

        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location = /admin {
        return 301 /admin/;
    }

    location ^~ /admin/ {
        alias /www/apps/frontend/current/admin/;
        index index.html;
        try_files $uri $uri/ /admin/index.html;
    }

    location = /favicon.ico {
        root /www/apps/frontend/current/portal;
        try_files /favicon.ico =204;
    }

    location / {
        root /www/apps/frontend/current/portal;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
}
```

检查配置：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 14. Nginx 500 踩坑记录

曾出现访问 `/` 返回：

```text
500 Internal Server Error
```

Nginx 错误日志：

```text
rewrite or internal redirection cycle while internally redirecting to "/portal/index.html"
```

原因是 Nginx 的 SPA fallback 写错了。

错误写法：

```nginx
try_files $uri $uri/ /portal/index.html;
```

当前目录结构下，`portal-web` 已经通过：

```nginx
root /www/apps/frontend/current/portal;
```

映射到根路径 `/`，所以 fallback 应该是：

```nginx
try_files $uri $uri/ /index.html;
```

不能写 `/portal/index.html`。

正确理解：

```text
URL 路径：/
文件目录：/www/apps/frontend/current/portal
fallback：/index.html
```

---

## 15. admin-web 的 base 配置

`admin-web` 映射到：

```text
/admin/
```

因此构建配置必须设置 base。

如果使用 Vite：

```ts
export default defineConfig({
  base: '/admin/',
})
```

前端路由也要匹配。

Vue Router：

```ts
createWebHistory('/admin/')
```

React Router：

```tsx
<BrowserRouter basename="/admin">
```

否则可能出现：

```text
1. admin 页面资源请求到 /assets
2. 刷新 /admin/xxx 后 404
3. admin 页面空白
```

`portal-web` 映射 `/`，base 使用：

```ts
base: '/'
```

---

## 16. 前端接口地址

两个前端应用都推荐统一使用相对路径：

```ts
baseURL: '/api'
```

不要写死：

```text
http://公网IP:3000
http://公网IP/api
localhost:3000
```

这样可以避免跨域问题。

最终请求链路：

```text
前端请求 /api/xxx
  ↓
Nginx location /api/
  ↓
NestJS 127.0.0.1:3000/api/xxx
```

---

## 17. 安全组配置

阿里云安全组建议只开放：

```text
22    SSH
80    HTTP
```

暂时不上域名和 HTTPS，因此不需要开放：

```text
443
```

不要开放：

```text
3000     NestJS
27017    MongoDB
```

NestJS 和 MongoDB 都应该只允许本机访问。

---

## 18. MongoDB 备份

创建备份目录：

```bash
sudo mkdir -p /www/backups/mongodb
sudo mkdir -p /www/logs
```

手动测试备份：

```bash
mongodump --uri="mongodb://127.0.0.1:27017/mononest" --out=/www/backups/mongodb/$(date +%F_%H-%M-%S)
```

定时备份：

```bash
crontab -e
```

加入：

```cron
0 3 * * * mongodump --uri="mongodb://127.0.0.1:27017/mononest" --out=/www/backups/mongodb/$(date +\%F_\%H-\%M-\%S) >>/www/logs/mongodb-backup.log 2>&1

30 3 * * * find /www/backups/mongodb -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \; >>/www/logs/mongodb-clean.log 2>&1
```

注意：crontab 中 `%` 要写成 `\%`。

查看定时任务：

```bash
crontab -l
```

确认 cron 服务：

```bash
sudo systemctl status crond
```

---

## 19. 建议补充的回滚脚本

### 19.1 前端回滚

```bash
sudo vi /usr/local/bin/rollback-frontend
```

内容：

```bash
#!/bin/bash
set -e

TAG=$1
APP_ROOT="/www/apps/frontend"
RELEASE_DIR="$APP_ROOT/releases/$TAG"
CURRENT_DIR="$APP_ROOT/current"

if [ -z "$TAG" ]; then
  echo "Usage: rollback-frontend <web-v版本号>"
  exit 1
fi

if [ ! -d "$RELEASE_DIR" ]; then
  echo "Release not found: $RELEASE_DIR"
  exit 1
fi

if [ ! -f "$RELEASE_DIR/portal/index.html" ] || [ ! -f "$RELEASE_DIR/admin/index.html" ]; then
  echo "Invalid frontend release: missing portal/index.html or admin/index.html"
  exit 1
fi

ln -sfn "$RELEASE_DIR" "$CURRENT_DIR"

nginx -t
systemctl reload nginx

echo "Frontend rollback success: $TAG"
```

授权：

```bash
sudo chmod +x /usr/local/bin/rollback-frontend
```

使用：

```bash
rollback-frontend web-v1.0.0
```

### 19.2 后端回滚

```bash
sudo vi /usr/local/bin/rollback-backend
```

内容：

```bash
#!/bin/bash
set -e

RELEASE_ID=$1
APP_ROOT="/www/apps/backend"
RELEASE_DIR="$APP_ROOT/releases/$RELEASE_ID"
CURRENT_DIR="$APP_ROOT/current"

if [ -z "$RELEASE_ID" ]; then
  echo "Usage: rollback-backend <release-id>"
  exit 1
fi

if [ ! -d "$RELEASE_DIR" ]; then
  echo "Release not found: $RELEASE_DIR"
  exit 1
fi

ln -sfn "$RELEASE_DIR" "$CURRENT_DIR"

cd "$CURRENT_DIR"
pm2 delete mononest-api || true
pm2 start ecosystem.config.cjs --env production --update-env
pm2 save

echo "Backend rollback success: $RELEASE_ID"
```

授权：

```bash
sudo chmod +x /usr/local/bin/rollback-backend
```

---

## 20. 常用排查命令

### 20.1 服务状态

```bash
sudo systemctl status mongod
sudo systemctl status nginx
pm2 list
```

### 20.2 后端日志

```bash
pm2 logs mononest-api --lines 100
```

### 20.3 Nginx 日志

```bash
sudo tail -n 100 /var/log/nginx/error.log
sudo tail -n 100 /var/log/nginx/access.log
```

### 20.4 端口监听

```bash
sudo ss -lntp | grep 80
sudo ss -lntp | grep 3000
sudo ss -lntp | grep 27017
```

### 20.5 访问测试

```bash
curl -I http://127.0.0.1/
curl -I http://127.0.0.1/admin/
curl http://127.0.0.1:3000/api/v1/health
curl http://公网IP/api/v1/health
```

### 20.6 前端发布目录

```bash
ls -l /www/apps/frontend/current
ls -l /www/apps/frontend/current/portal/index.html
ls -l /www/apps/frontend/current/admin/index.html
```

### 20.7 后端发布目录

```bash
ls -lt /www/apps/backend/releases
ls -l /www/apps/backend/current
```

---

## 21. 当前部署体系完成度

目前已经完成：

```text
MongoDB 安装与启动
MongoDB 本机访问限制
NestJS 后端部署
PM2 后端进程管理
GitHub Actions 后端自动部署
Nginx /api 反向代理
前端 monorepo 双子应用构建
前端 tag 自动部署
portal-web 映射 /
admin-web 映射 /admin/
公网 IP 访问页面和 API
MongoDB 定时备份
NestJS /api/v1/health 健康检查
GitHub Actions 部署后自动 curl 健康检查
PM2 日志切割 pm2-logrotate
```

后续可选增强：

```text
1. 增加域名
2. 增加 HTTPS
3. MongoDB 开启账号密码认证
4. SSH 禁止密码登录，仅允许密钥登录
5. 切换 deploy 用户，减少 root 部署风险
6. 增加监控和告警
```

---

## 22. 下一阶段建议

短期建议优先做：

```text
1. MongoDB 开启认证
2. 后续有域名后接入 HTTPS
3. SSH 禁止密码登录，仅允许密钥登录
4. 切换 deploy 用户，减少 root 部署风险
```

当前阶段已经可以作为一个可维护的轻量生产部署方案使用。
