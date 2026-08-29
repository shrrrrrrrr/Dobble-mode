# 留白 · 创作生活

面向内容创作者的生活模式原型。记录作品、过程感受与值得记住的反馈，并整理成短期回看。

当前版本：**V1.5**（社区与资料体验加固；已通过用户验收）

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

## 当前认证与数据

- **登录方式：** 本地账号 + 密码（用户名 3–20 位字母、数字、下划线或短横线；密码至少 6 位）
- **存储位置：** 仅当前浏览器设备，不上传云端
- **数据隔离：** 每个账号独立保存作品、反馈、社区帖子和资料（`creator-life-v2:data:{userId}`）
- **社区身份：** 新帖子保存稳定 `userId`，展示时读取当前昵称；旧帖子会在作者昵称仍匹配时兼容归属
- **会话：** 刷新页面保持登录；点击「退出」后需重新登录

### 暂不包含

- 邮箱验证码登录
- 手机号登录
- Supabase 云端同步（schema 已预留，前端未连接）
- 真实多用户社区后端

### 旧版数据导入

若浏览器里仍有 V1.2 及以前的 `creator-life-v1` 数据，首次用新账号登录且该账号为空时，会提示是否导入。导入只复制到当前账号，不删除旧数据。

## V1.5 首轮能力

- 社区帖子使用稳定 `userId` 归属，修改昵称后新旧帖子仍能正确归入「我的发帖」；旧格式帖子保持兼容读取
- 「记录时刻」支持选择反馈类型并填写内容
- 图片上传检查格式、限制 20 MB，并提示读取或压缩失败
- LocalStorage 写入增加配额错误提示；作品、社区帖子和资料保存失败时会显示可理解的提示
- 账号切换时，只有对应账号的数据完成加载后才允许持久化，避免误写入空状态
- 徽章保留为 UI 占位，不设计获取规则

## 功能范围

- 首页、作品、回忆（最近七个自然日回看）、社区
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
  utils/image.ts          图片格式、大小和压缩处理
docs/
  ROADMAP.md              版本路线图
  HANDOFF.md              项目交接文档
```

## 开发约定

- 主分支：`master`
- 版本标签：`v1.0.0`、`v1.3.0`、`v1.4.0`、`v1.5.0` 等，见 [docs/ROADMAP.md](docs/ROADMAP.md)
- V1.5 已完成用户验收并发布：功能提交 `d71b363`，标签 `v1.5.0`
- 专业模式参考仓库 [creator-topic-library](https://github.com/shrrrrrrrr/creator-topic-library)，不作为本仓库推送目标
