# 留白 · 创作生活

面向内容创作者的双模式工具。生活模式记录作品、过程感受与值得记住的反馈，并整理成短期回看；专业模式管理选题、评分与复盘。

当前版本：**V3.10**（Android 原生壳、按需代码加载、轻量主题素材）

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

## Android 安装包

项目已接入 Capacitor 原生 Android 壳，应用 ID 为 `com.dobblemode.app`，显示名称为「留白」。首次可安装调试包由以下命令生成：

```bash
npm run android:apk
```

生成位置为 `android/app/build/outputs/apk/debug/app-debug.apk`。这是一份可直接安装到 Android 真机的调试包；不需要 AVD。完整的本机配置、安装步骤和正式发布流程见 [docs/ANDROID_BUILD.md](docs/ANDROID_BUILD.md)。

## 模式切换

顶栏「生活 / 专业」分段开关切换两种模式，模式偏好随当前账号保存：

- **生活模式：** 首页创作桌面、作品、最近七天回看、社区、AI 陪伴角色「留」
- **专业模式：** 选题库（灵感→规划→创作→发布）、评分模板与评分记录、专业复盘、数据看板。专业视图只展示作品数据，**不显示生活便签、心情与反馈**（硬边界）

## 当前认证与数据

- **登录方式：** Supabase 邮箱 + 密码（主登录）
- **存储位置：** 当前设备有本地缓存，并自动同步到当前 Supabase 账号
- **数据隔离：** 每个账号独立保存全部数据（`creator-life-v2:data:{userId}`）
- **社区身份：** 新帖子保存稳定 `userId`；新帖子时间使用标准时间戳
- **会话：** 刷新页面保持登录；点击「退出」后需重新登录

### 云端同步与迁移（V3.7）

Supabase 邮箱 + 密码是主登录。首次登录会识别本机旧本地账号，验证旧密码后复制数据到当前云账号；旧数据不会删除。

启用步骤：

1. 复制 `.env.example` 为 `.env.local`，填入 Supabase 项目 URL 和 **Anon Key**（不要用 Service Role Key）
2. 在 Supabase SQL Editor 执行 `supabase/migrations/0002_cloud_state.sql`
3. 重新 `npm run dev` / `npm run build`

同步语义：整账号状态快照（JSONB，owner-only RLS）；两台设备都改过时以最后保存的一端为准。不配置环境变量时应用会显示账号配置页。服务器环境变量配置见 docs/SUPABASE_SETUP.md 和 docs/DEPLOYMENT.md。

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
  services/auth.ts             旧本地账号验证 / 迁移支持
  services/repository.ts       应用数据访问接口与本地实现
  services/cloud.ts            Supabase 主会话与云端同步
  services/badges.ts           徽章规则与计算
  services/legacyImport.ts     V1 旧数据导入
  utils/image.ts               图片压缩
  utils/recapMedia.ts          视频多时间点截图与去重
  data/recapTemplates.ts       可编辑回忆文案
  utils/calendarArt.ts         日历像素日期绘制
  theme.ts                     主题注册表
  types.ts                     数据类型
supabase/migrations/           云端表结构与 RLS
scripts/verify-final.mjs       验收脚本
docs/                          ROADMAP / HANDOFF / 部署 / Supabase 文档
android/                       Capacitor 生成的 Android 原生工程
capacitor.config.ts            Android 壳的应用标识与构建配置
```

## 开发约定

- 主分支：`master`
- 版本标签：`v1.0.0` … `v1.6.0`，见 [docs/ROADMAP.md](docs/ROADMAP.md)
- 专业模式参考仓库 [creator-topic-library](https://github.com/shrrrrrrrr/creator-topic-library)，不作为本仓库推送目标
