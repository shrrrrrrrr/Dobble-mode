# 留白 · 创作生活

面向内容创作者的生活模式原型。记录作品、过程感受与值得记住的反馈，并整理成短期回看。

当前版本：**V1.4**（最近七天回看 + 本地账号）

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

验收脚本：

```bash
npm run verify
```

## V1.3 认证与数据

- **登录方式：** 本地账号 + 密码（用户名 3–20 位字母、数字、下划线或短横线；密码至少 6 位）
- **存储位置：** 仅当前浏览器设备，不上传云端
- **数据隔离：** 每个账号独立保存作品、反馈、社区帖子和资料（`creator-life-v2:data:{userId}`）
- **会话：** 刷新页面保持登录；点击「退出」后需重新登录

### 暂不包含

- 邮箱验证码登录
- 手机号登录
- Supabase 云端同步（schema 已预留，前端未连接）

### 旧版数据导入

若浏览器里仍有 V1.2 及以前的 `creator-life-v1` 数据，首次用新账号登录且该账号为空时，会提示是否导入。导入只复制到当前账号，不删除旧数据。

## 功能范围

- 首页、作品、回忆（短期回看）、社区
- 作品与便签、珍藏反馈、四平台（抖音 / 小红书 / B站 / 视频号）
- 社区纯文本 + 单图发帖、点赞、内联评论
- 社区内「我的」与个人资料编辑（头像、昵称）
- 可拖动 AI 陪伴角色「留」（基于本地数据的规则问答，非真实大模型）

## 项目结构

```text
src/
  App.tsx                 主界面与页面
  services/auth.ts        本地账号注册 / 登录
  services/legacyImport.ts  V1 旧数据导入
  types.ts                数据类型
  styles.css              样式
docs/
  ROADMAP.md              版本路线图
  HANDOFF.md              项目交接文档
```

## 开发约定

- 主分支：`master`
- 版本标签：`v1.0.0`、`v1.3.0`、`v1.4.0` 等，见 [docs/ROADMAP.md](docs/ROADMAP.md)
- 专业模式参考仓库 [creator-topic-library](https://github.com/shrrrrrrrr/creator-topic-library)，不作为本仓库推送目标
