# API接口与参数说明

基准前缀：`/api/v1`

统一响应结构：
```json
{
  "code": 0,
  "message": "OK",
  "data": {},
  "traceId": "..."
}
```

## 1. 通用约定
- 认证方式：`Authorization: Bearer <access_token>`
- 幂等接口统一使用服务端幂等拦截器
- 对外协议统一使用 `camelCase`
- 存储层字段统一使用 `snake_case`
- 四类业务统一互动计数字段：
  - `viewCount`
  - `favorCount`
  - `replyCount`
- 四类业务统一系统状态字段：
  - `reviewStatus`
  - `visibility`
- 当前业务提交后默认写入：
  - `review_status=approved`
  - `visibility=public`
- 公开接口统一只返回可公开内容：
  - `articles`：`published + approved + public + not deleted`
  - `books / topics / images`：`approved + public`

### 健康检查

#### `GET /health`
- 鉴权：公开
- 用途：部署后和运维侧存活检查
- 返回：
  - `status`：固定为 `ok`
  - `service`：固定为 `mononest-api`
  - `uptime`：当前 Node.js 进程运行秒数
  - `timestamp`：服务端 ISO 时间

## 2. Auth

### `POST /auth/register`
- 鉴权：公开
- Body：
  - `email`
  - `name`
  - `password`

### `POST /auth/login`
- 鉴权：公开
- Body：
  - `account`
  - `password`

### `POST /auth/refresh`
- 鉴权：公开
- Body：
  - `refreshToken`

### `POST /auth/logout`
- 鉴权：公开
- Body：
  - `refreshToken`

### `GET /auth/sessions`
- 鉴权：登录
- 返回当前用户会话列表

### `GET /auth/me`
- 鉴权：登录
- 返回当前用户认证态信息

### `POST /auth/authorize`
- 鉴权：登录
- Body：
  - `scope`
  - `redirectUri`
  - `state?`

### `GET /auth/oauth/:provider/url`
- 鉴权：公开
- 返回第三方登录授权地址

### `GET /auth/oauth/:provider/callback`
- 鉴权：公开
- Query：
  - `code`
  - `state`

## 3. Users

### `GET /users/me`
- 鉴权：登录
- 返回当前用户安全资料

### `PATCH /users/me`
- 鉴权：登录
- Body：
  - `name?`
  - `avatarUrl?`
  - `bio?`

### `GET /users/me/business-stats`
- 鉴权：登录
- 返回当前用户业务总量统计
- 当前聚合：
  - `articles`
  - `books`
  - `images`
  - `topics`
  - `drafts`
  - `comments`

### `GET /users/me/business-stats/daily`
- 鉴权：登录
- Query：
  - `days?`
- 返回当前用户按日业务统计
- 当前聚合口径与 `business-stats` 一致

### `GET /users/business-stats/daily`
- 鉴权：公开
- Query：
  - `days?`
- 返回公开业务按日统计
- 当前仅聚合四类公开业务：
  - `articles`
  - `books`
  - `images`
  - `topics`

### `GET /users/:id/profile`
- 鉴权：公开
- 返回指定用户公开资料
- 当前字段：
  - `id`
  - `name`
  - `avatarUrl`
  - `bio`

### `PATCH /users/:id/status`
- 鉴权：管理员 / 超级管理员
- Body：
  - `status`

## 4. Home

### `GET /home`
- 鉴权：公开
- 返回：
  - `articleSection`
  - `columnSection`
  - `bookshelfSection`
  - `gallerySection`
  - `generatedAt`

说明：
- `/home` 只负责首页主体聚合
- 当前不再返回：
  - `quickEntries`
  - `stats`
  - 顶层 `featured`
- 当前数量上限：
  - `articleSection.featured` 最多 `1`
  - `articleSection.items` 最多 `3`
  - `columnSection.items` 最多 `3`
  - `bookshelfSection.items` 最多 `2`
  - `gallerySection.items` 最多 `3`

### `articleSection`
- `featured`
  - `id`
  - `title`
  - `summary`
  - `cover`
  - `badge`
  - `tags`
  - `publishTime`
- `items[]`
  - `id`
  - `title`
  - `summary`
  - `cover`
  - `publishTime`

### `columnSection.items[]`
- `id`
- `topicId`
- `title`
- `summary`
- `cover`
- `author`
- `featureFlags`
- `featureFlagLabels`

### `bookshelfSection.items[]`
- `id`
- `title`
- `summary`
- `cover`
- `tags`
- `authorNames`

### `gallerySection.items[]`
- `id`
- `title`
- `meta`
- `badge`
- `images`
- `total`

说明：
- 图包首页预览当前最多返回 4 张图片
- `cover` 统一返回 `CoverView | null`

## 5. Search

### `GET /search/featured`
- 鉴权：公开
- Query：
  - `limit?` 最大 `40`
  - `types?=article,topic,book,image`
  - `groupByType?=true|false`
  - `perTypeLimit?` 最大 `20`
  - `includeAuthor?=true|false`
- 返回：
  - `limit`
  - `total`
  - `byType`
  - `bySource`
  - `totals`
  - `algorithm`
  - `items`
- `groupByType=true` 时额外返回：
  - `perTypeLimit`
  - `groups`

说明：
- 当前精选机制为“管理员精选优先，热度推荐补位”
- `items` 始终按全局推荐顺序返回
- `groups` 用于前端按类型分栏展示
- 精选当前只拉封面媒体，不展开完整媒体列表

`items[]` / `groups.*[]` 单项结构：
- `id`
- `type`
- `title`
- `summary`
- `cover`
- `badge`
- `kicker`
- `tags`
- `author?`
- `stats { viewCount, favorCount, replyCount }`
- `recommendSource=admin|hot`
- `recommendLabel`
- `featuredRank?`
- `heatScore?`
- `publishTime`

计数字段说明：
- `byType`：本次返回里各业务类型实际条数
- `bySource`：本次返回里 `admin/hot` 各自条数
- `totals`：当前可参与精选的各业务公开总量

### `GET /search/quick`
- 鉴权：公开
- Query：
  - `q`
  - `limit?` 最大 `20`
- 返回：
  - `query`
  - `limit`
  - `items`
  - `groups`

说明：
- 快搜当前走标题前缀匹配
- 仅覆盖四类公开业务：
  - `articles`
  - `books`
  - `images`
  - `topics`

### `GET /search/fulltext`
### `GET /search`
- 鉴权：公开
- Query：
  - `q`
  - `scope?=all|articles|books|images|topics`
  - `page?`
  - `limit?`

说明：
- `/search` 是 `/search/fulltext` 的别名
- 全文检索当前使用 Mongo text index
- 公开全文检索不再返回：
  - `drafts`
  - `comments`

### `GET /articles/:id/related`
### `GET /books/:id/related`
### `GET /topics/:id/related`
### `GET /images/:id/related`
- 鉴权：公开
- Query：
  - `limit?` 最大 `20`
- 作用：返回同内容类型下的相关推荐

## 6. Admin Featured Contents

### `GET /admin/featured-contents`
- 鉴权：管理员 / 超级管理员
- Query：
  - `page?`
  - `limit?`
  - `scene?`
  - `targetType?=article|book|topic|image`
  - `enabled?=true|false`
  - `activeOnly?=true|false`

### `POST /admin/featured-contents`
- 鉴权：管理员 / 超级管理员
- 幂等：是
- Body：
  - `scene?` 默认 `home_featured`
  - `targetType=article|book|topic|image`
  - `targetId`
  - `rank?`
  - `enabled?`
  - `startAt?`
  - `endAt?`
  - `note?`

### `POST /admin/featured-contents/cancel`
- 鉴权：管理员 / 超级管理员
- 幂等：是
- Body：
  - `scene?` 默认 `home_featured`
  - `targetType=article|book|topic|image`
  - `targetId`

## 7. Admin Content

### `GET /admin/content/summary`
- 鉴权：管理员 / 超级管理员
- Query：
  - `scene?`
- 作用：返回四类内容的后台治理汇总统计

### `GET /admin/content`
- 鉴权：管理员 / 超级管理员
- Query：
  - `page?`
  - `limit?`
  - `scene?`
  - `type=article|book|topic|image`
  - `keyword?`
  - `userId?`
  - `startDate?`
  - `endDate?`
  - `reviewStatus?=pending|approved|rejected`
  - `visibility?=public|private`
  - `featured?=true|false`
  - `deleted?=true|false`
  - `status?`
  - `themeId?`
  - `topicId?`
  - `typeId?`
  - `featureFlags?=1,3`
  - `part?`
  - `area?`
  - `bookStatus?`
  - `sort?=latest|hot`

### `GET /admin/content/:type/:id`
- 鉴权：管理员 / 超级管理员
- Path：
  - `type=article|book|topic|image`
- Query：
  - `scene?`
- 作用：返回后台内容详情与权限态

### `PATCH /admin/content/:type/:id/private`
- 鉴权：管理员 / 超级管理员
- 幂等：是
- Path：
  - `type=article|book|topic|image`
- 作用：将指定内容设为私密，并同步处理精选等关联状态

### `DELETE /admin/content/:type/:id`
- 鉴权：超级管理员
- 幂等：是
- Path：
  - `type=article|book|topic|image`
- Query：
  - `cascadeMedia?=true|false`
- 作用：执行物理删除与关联清理
## 8. Articles

### `POST /articles`
- 鉴权：登录
- 幂等：是
- Body：
  - `title`
  - `desc`
  - `content`
  - `images?`
  - `themeId`
  - `status?`

### `PATCH /articles/:id`
- 鉴权：登录
- 幂等：是

### `GET /articles/me`
- 鉴权：登录
- Query：
  - `page?`
  - `limit?`
  - `title?`
  - `status?`
  - `startDate?`
  - `endDate?`

### `GET /articles/me/:id`
- 鉴权：登录

### `GET /articles`
- 鉴权：公开
- Query：
  - `page?`
  - `limit?`
  - `themeId?`
  - `userId?`
  - `sort?=latest|hot|recommend`
  - `includeAuthor?=true|false`

### `GET /articles/:id`
- 鉴权：公开
- 行为：详情访问会累加 `view_count`

返回关键字段：
- `summary`
- `images`
- `imageAssets`
- `coverMedia`
- `themeId`
- `status`
- `reviewStatus`
- `visibility`
- `viewCount`
- `favorCount`
- `replyCount`
- `postTime`
- `updateTime`
## 9. Books

### `POST /books`
- 鉴权：登录
- 幂等：是
- Body：
  - `author`
  - `part`
  - `style`
  - `status`
  - `area`
  - `name`
  - `cover`
  - `desc`
  - `releaseTime?`
  - `chapterList?`

### `PATCH /books/:id`
- 鉴权：登录
- 幂等：是

### `DELETE /books/:id`
- 鉴权：登录
- 幂等：是
- Query：
  - `cascadeMedia?=true|false`

### `PUT /books/:id/chapters`
- 鉴权：登录
- 幂等：是

### `GET /books/me`
- 鉴权：登录
- Query：
  - `page?`
  - `limit?`
  - `title?`
  - `startDate?`
  - `endDate?`

### `GET /books/me/:id`
- 鉴权：登录

### `GET /books`
- 鉴权：公开
- Query：
  - `page?`
  - `limit?`
  - `part?`
  - `status?`
  - `area?`
  - `keyword?`
  - `sort?=latest|hot|recommend`
  - `mediaVariant?=preview|download`

### `GET /books/:id`
- 鉴权：公开
- 行为：详情访问会累加 `view_count`

返回关键字段：
- `title`
- `summary`
- `authorNames`
- `part`
- `status`
- `area`
- `total`
- `tags`
- `cover`
- `coverMedia`
- `coverMediaId`
- `releaseTime`
- `reviewStatus`
- `visibility`
- `viewCount`
- `favorCount`
- `replyCount`

说明：
- 当前不再兼容旧字段 `hots`
## 10. Topics

### `POST /topics`
- 鉴权：登录
- 幂等：是
- Body：
  - `topicId`
  - `typeId`
  - `title`
  - `images?`
  - `content`
  - `desc`
  - `downloadUrl`
  - `featureFlags`

### `PATCH /topics/:id`
- 鉴权：登录
- 幂等：是

### `DELETE /topics/:id`
- 鉴权：登录
- 幂等：是
- Query：
  - `cascadeMedia?=true|false`

### `GET /topics/me`
- 鉴权：登录

### `GET /topics/me/:id`
- 鉴权：登录

### `GET /topics`
- 鉴权：公开
- Query：
  - `page?`
  - `limit?`
  - `topicId?`
  - `typeId?`
  - `featureFlags?=1,3`
  - `keyword?`
  - `sort?=latest|hot|recommend`
  - `includeAuthor?=true|false`

### `GET /topics/:id`
- 鉴权：公开
- 行为：详情访问会累加 `view_count`

返回关键字段：
- `summary`
- `images`
- `imageAssets`
- `coverMedia`
- `topicId`
- `typeId`
- `featureFlags`
- `featureFlagLabels`
- `author?`
- `downloadUrl`
- `reviewStatus`
- `visibility`
- `viewCount`
- `favorCount`
- `replyCount`

说明：
- 当前已移除专题更新周期字段
- 不再接收或返回 `scheduleLabel`
## 11. Images

### `POST /images`
- 鉴权：登录
- 幂等：是
- Body：
  - `title`
  - `desc`
  - `images`
  - `themeId`
  - `cover?`
  - `source?`

### `PATCH /images/:id`
- 鉴权：登录
- 幂等：是

### `DELETE /images/:id`
- 鉴权：登录
- 幂等：是
- Query：
  - `cascadeMedia?=true|false`

### `GET /images/me`
- 鉴权：登录

### `GET /images/me/:id`
- 鉴权：登录

### `GET /images`
- 鉴权：公开
- Query：
  - `page?`
  - `limit?`
  - `themeId?`
  - `keyword?`
  - `sort?=latest|hot|recommend`
  - `mediaVariant?=preview|download`

### `GET /images/:id`
- 鉴权：公开
- 行为：详情访问会累加 `view_count`

返回关键字段：
- `summary`
- `images`
- `imageAssets`
- `previewImages`
- `cover`
- `coverMedia`
- `themeId`
- `meta`
- `source?`
- `reviewStatus`
- `visibility`
- `viewCount`
- `favorCount`
- `replyCount`

说明：
- 图包至少需要 1 张图片
- 已移除 `width`、`height`
- `meta` 当前格式：
  - `XXP / 图包版块`
  - 或 `XXP / 图包版块 / source`
## 12. Drafts

### `POST /drafts`
- 鉴权：登录
- 幂等：是

### `GET /drafts/me`
- 鉴权：登录
- Query：
  - `page?`
  - `limit?`

### `GET /drafts/:id`
- 鉴权：登录

### `PATCH /drafts/:id`
- 鉴权：登录
- 幂等：是

### `DELETE /drafts/:id`
- 鉴权：登录
- 幂等：是

说明：
- 草稿是私有业务
- 不参与公开搜索、公开统计、首页聚合、精选推荐
## 13. Comments

### `POST /articles/:articleId/comments`
- 鉴权：登录
- 幂等：是
- Body：
  - `content`

### `GET /articles/:articleId/comments`
- 鉴权：公开
- Query：
  - `page?`
  - `limit?`

### `POST /books/:bookId/comments`
- 鉴权：登录
- 幂等：是
- Body：
  - `content`

### `GET /books/:bookId/comments`
- 鉴权：公开
- Query：
  - `page?`
  - `limit?`

### `POST /topics/:topicId/comments`
- 鉴权：登录
- 幂等：是
- Body：
  - `content`

### `GET /topics/:topicId/comments`
- 鉴权：公开
- Query：
  - `page?`
  - `limit?`

### `POST /images/:imageId/comments`
- 鉴权：登录
- 幂等：是
- Body：
  - `content`

### `GET /images/:imageId/comments`
- 鉴权：公开
- Query：
  - `page?`
  - `limit?`

### `POST /comments/:id/replies`
- 鉴权：登录
- 幂等：是
- Body：
  - `content`
  - `mentionUserId?`

### `GET /comments/:id/replies`
- 鉴权：公开
- Query：
  - `page?`
  - `limit?`

说明：
- 当前评论能力已覆盖四类公开内容：
  - `articles`
  - `books`
  - `topics`
  - `images`
- `replyCount` 会随着评论/回复同步回写到对应内容
- 回复里被提及用户信息由后端根据 `mentionUserId` 回查生成
## 14. Favorites

### `POST /favorites/toggle`
- 鉴权：登录
- 幂等：是
- Body：
  - `targetType=article|book|topic|image`
  - `targetId`

说明：
- 收藏与取消收藏共用一个接口
- 会按收藏表当前记录总数回写目标业务 `favorCount`
- 只允许对可公开内容进行收藏

### `GET /favorites/me`
- 鉴权：登录
- Query：
  - `page?`
  - `limit?`
  - `targetType?`
- 返回项：
  - `id`
  - `targetType`
  - `targetId`
  - `savedAt`
  - `title`
  - `summary`
  - `coverMedia?`
  - `meta`
  - `author?`
  - `tags?`

说明：
- 当前 `GET /favorites/me` 已升级为可直接渲染的展示态接口
- 前端不需要再按收藏关系二次 fan-out 拉详情
## 15. Notifications

### `GET /notifications/me`
- 鉴权：登录
- Query：
  - `page?`
  - `limit?`
  - `kind?=comment|reply`
  - `unread?=true|false`
- 返回项：
  - `id`
  - `unread`
  - `kind`
  - `createdAt`
  - `actor`
  - `excerpt`
  - `context?`
  - `target`
  - `primaryAction`
  - `secondaryAction?`

说明：
- 当前消息读模型由 `notification` 模块承担
- `target` 统一包含 `type / id / title / meta`
- `primaryAction` / `secondaryAction` 只返回动作类型与目标，不直接返回按钮文案

### `PATCH /notifications/:id/read`
- 鉴权：登录
- 作用：将单条消息标记为已读

### `POST /notifications/read-all`
- 鉴权：登录
- 作用：将当前用户全部未读消息标记为已读
## 16. History

### `GET /history/me`
- 鉴权：登录
- Query：
  - `page?`
  - `limit?`
  - `targetType?`
- 返回项：
  - `id`
  - `targetType`
  - `targetId`
  - `visitedAt`
  - `sourceLabel?`
  - `title`
  - `summary`
  - `coverMedia?`
  - `meta`
  - `author?`
  - `tags?`

说明：
- 历史记录按 `visitedAt` 倒序返回平铺列表
- 日期分组与“今天 / 昨天”类文案由前端按本地时区处理

### `DELETE /history/me`
- 鉴权：登录
- 作用：清空当前用户浏览历史
## 17. Media

### `POST /media/images/upload`
- 鉴权：登录
- 幂等：是
- 表单字段：
  - `files[]`

### `POST /media/audio/upload`
- 鉴权：登录
- 幂等：是
- 表单字段：
  - `file`

### `POST /media/zip/upload`
- 鉴权：登录
- 幂等：是
- Query：
  - `mode?=extract|direct`
- 表单字段：
  - `file`

### `GET /media`
- 鉴权：公开

### `POST /media/resolve`
- 鉴权：公开

### `POST /media/images/batch-download`
- 鉴权：公开

### `POST /media/zip/download`
- 鉴权：公开
- Body：
  - `mode?=package|direct`
  - `mediaIds?`
  - `mediaId?`
  - `fileName?`

### `GET /media/:id`
- 鉴权：公开

### `GET /media/:id/preview`
- 鉴权：公开

### `GET /media/:id/download`
- 鉴权：公开
- Query：
  - `disposition?=inline|attachment`
## 18. Admin

### `GET /admin/ping`
- 鉴权：管理员 / 超级管理员
- 作用：管理端联通性检查
## 19. Admin AI

### `POST /admin/ai/compose`
- 鉴权：登录
- 作用：基于当前编辑快照生成结构化 AI 建议
- Body：
  - `contentType=article|topic|book|image`
  - `task=rewrite-title|generate-summary|polish-summary|extract-highlights|structure-content|suggest-feature-flags|rewrite-selection|continue-content`
  - `source`
    - `title?`
    - `summary?`
    - `content?`
    - `selectionText?`
    - `selectionPrefix?`
    - `selectionSuffix?`
    - `cursorPrefix?`
    - `cursorSuffix?`
    - `themeId?`
    - `topicId?`
    - `typeId?`
    - `featureFlags?`
    - `downloadUrl?`
    - `author?`
    - `part?`
    - `status?`
    - `area?`
    - `chapterList?`
    - `source?`
    - `imageCount?`
  - `options?`
    - `tone?=neutral|official|community|promo`
    - `maxTitleLength?`
    - `maxSummaryLength?`
    - `includeReasons?`

说明：
- 输入来源固定为浏览器端当前编辑快照
- 不直接写业务库，不自动发布内容
- 返回按任务区分的结构化结果
- `rewrite-selection` 与 `continue-content` 当前仅支持 `article`
- `rewrite-selection` 只用于正文选中片段改写
- `continue-content` 只用于正文光标位置续写

返回主体：
- `task`
- `contentType`
- `model`
- `promptVersion`
- `traceId`
- `result`
- `usage?`

`result` 结构：
- `rewrite-title`：`{ title, reasons? }`
- `generate-summary` / `polish-summary`：`{ summary, reasons? }`
- `extract-highlights`：`{ highlights, reasons? }`
- `structure-content`：`{ outline, reasons? }`
- `suggest-feature-flags`：`{ featureFlagSuggestions: [{ id, label, reason }] }`
- `rewrite-selection` / `continue-content`：`{ content }`

### `POST /admin/ai/compose/stream`
- 鉴权：登录
- 作用：以 SSE 方式流式返回 AI 编辑建议
- Body：同 `POST /admin/ai/compose`

响应类型：
- `text/event-stream`

事件说明：
- `delta`：文本预览增量
- `completed`：完整结构化结果
- `error`：流式生成失败信息
