# 留白 · 创作生活

面向内容创作者的双模式工具。生活模式记录作品、过程感受与值得记住的反馈，并整理成短期回看；专业模式管理选题、评分与复盘。

当前版本：**V3.1**（生活/专业双模式 + 云同步 + 徽章系统；云端激活与服务器部署需要用户侧配置）

仓库：[github.com/shrrrrrrrr/Dobble-mode](https://github.com/shrrrrrrrr/Dobble-mode)

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 Vite 提示的地址（通常是 `http://localhost:5173`）。

生产构建：

```bash
npm run build
npm run preview
```

验收脚本（42 项检查，含生产构建）：

```bash
npm run verify
```

## 模式切换

顶栏「生活 / 专业」分段开关切换两种模式，模式偏好随当前账号保存：

- **生活模式：** 首页创作桌面、作品、最近七天回看、社区、AI 陪伴角色「留」
- **专业模式：** 选题库（灵感→规划→创作→发布）、评分模板与评分记录、专业复盘、数据看板。专业视图只展示作品数据，**不显示生活便签、心情与反馈**（硬边界）

## 当前认证与数据

- **登录方式：** 本地账号 + 密码（用户名 3–20 位字母、数字、下划线或短横线；密码至少 6 位）
- **存储位置：** 默认仅当前浏览器设备
- **数据隔离：** 每个账号独立保存全部数据（`creator-life-v2:data:{userId}`）
- **社区身份：** 新帖子保存稳定 `userId`；新帖子时间使用标准时间戳
- **会话：** 刷新页面保持登录；点击「退出」后需重新登录

### 云同步（V2.0，可选）

本地账号照常使用；云账号（邮箱 + 密码，Supabase Auth）用于跨设备同步。在社区 →「我的」页面底部「云同步」开启。

启用步骤：

1. 复制 `.env.example` 为 `.env.local`，填入 Supabase 项目 URL 和 **Anon Key**（不要用 Service Role Key）
2. 在 Supabase SQL Editor 执行 `supabase/migrations/0002_cloud_state.sql`
3. 重新 `npm run dev` / `npm run build`

同步语义：整账号状态快照（JSONB，owner-only RLS）；两台设备都改过时以最后保存的一端为准。不配置环境变量时云端完全关闭，应用行为与纯本地一致。

### 暂不包含

- 邮箱验证码 / 手机号登录
- 真实多用户社区后端（云端表结构已预留）
- 真实大模型 AI

### 旧版数据导入

若浏览器里仍有 V1.2 及以前的 `creator-life-v1` 数据，首次用新账号登录且该账号为空时，会提示是否导入。导入只复制到当前账号，不删除旧数据。

## 功能范围

- 生活模式：首页、作品、回忆（最近七个自然日回看）、社区
- 作品与便签、珍藏反馈、四平台（抖音 / 小红书 / B站 / 视频号）
- 社区纯文本 + 单图发帖、点赞、内联评论
- 社区内「我的」与个人资料编辑（头像、昵称）
- 可拖动 AI 陪伴角色「留」（基于本地数据的规则问答，非真实大模型）
- 专业模式：选题库、评分模板/记录、专业复盘、数据看板
- 徽章系统：8 条规则（作品/反馈/社区/连续记录），个人页展示获得日期与进度
- 主题包：默认（骑行像素视频）、北航四季（春夏秋冬像素背景）、樱花夜

## 部署

见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。前端为纯静态产物，nginx + HTTPS 即可；GitHub Actions 会在每次 push 时自动运行 `npm run verify`。

## 项目结构

```text
src/
  App.tsx                      主界面、页面状态、云同步与徽章接线
  professional/                专业模式页面（选题/评分/复盘/数据）
  components/Modal.tsx         共享弹窗
  services/auth.ts             本地账号注册 / 登录
  services/repository.ts       应用数据访问接口与本地实现
  services/cloud.ts            Supabase 云同步（可选）
  services/badges.ts           徽章规则与计算
  services/legacyImport.ts     V1 旧数据导入
  utils/image.ts               图片压缩
  utils/calendarArt.ts         日历像素日期绘制
  theme.ts                     主题注册表
  types.ts                     数据类型
supabase/migrations/           云端表结构与 RLS
scripts/verify-final.mjs       验收脚本
docs/                          ROADMAP / HANDOFF / 部署 / Supabase 文档
```

## 开发约定

- 主分支：`master`
- 版本标签：`v1.0.0` … `v1.6.0`，见 [docs/ROADMAP.md](docs/ROADMAP.md)
- 专业模式参考仓库 [creator-topic-library](https://github.com/shrrrrrrrr/creator-topic-library)，不作为本仓库推送目标
