# Supabase 云端接入（V2.0 更新）

> 历史说明：V1.2 曾尝试邮箱 OTP（Magic Link）方向，已废弃。当前认证为本地账号密码；云端采用**邮箱+密码的 Supabase Auth** 作为可选云同步层，不使用 OTP。

## 1. 项目现状

- Supabase 项目「双模」（ref: `zsrhgtplolhxrbzxwfkq`）已创建。
- `supabase/migrations/0001_life_mode.sql` 已实际执行（profiles / works / feedback_events / community_posts / community_comments / community_likes、RLS、trigger、私有桶 `creator-media`）。
- V2.0 新增 `supabase/migrations/0002_cloud_state.sql`：`app_state` 表（整账号 JSONB 快照 + owner-only RLS），**需要用户在 SQL Editor 手动执行**。

## 2. 启用云同步

1. 复制 `.env.example` 为 `.env.local`，填入：
   ```text
   VITE_SUPABASE_URL=https://zsrhgtplolhxrbzxwfkq.supabase.co
   VITE_SUPABASE_ANON_KEY=<项目设置 → API → anon public>
   ```
2. 在 SQL Editor 执行 `0002_cloud_state.sql`。
3. Authentication → Providers → Email：确认启用（推荐开启 Confirm email，避免陌生人在你的项目注册）。
4. 本地重启 `npm run dev`；应用内入口：社区 →「我的」→ 底部「云同步」。

不配置环境变量时，云端功能整体关闭，应用完全在本地运行。

## 3. 同步语义

- 整账号状态以 JSONB 快照存于 `app_state`，owner-only RLS（`auth.uid() = user_id`）。
- 登录云账号后自动对齐：云端较新则拉取，否则上传本地；平时保存后约 2 秒防抖推送。
- 两台设备都改过时，以最后保存的一端为准（last-write-wins）。
- 云账号与本地账号相互独立：云账号只管同步，不改变本地登录。

## 4. 上线前检查

- 将站点地址加入 Auth Redirect URLs（本地开发默认 `http://localhost:5173`）。
- 前端只放 Anon Key（公开密钥，安全由 RLS 保证）；**绝不放 Service Role Key**。
- 图片当前以压缩 Data URL 存于状态内；`creator-media` 桶上传与签名 URL 为 V2.2 候选。
- 部署流程见 `docs/DEPLOYMENT.md`。

## 5. V3.7 主登录：Supabase 邮箱 + 密码

现在登录页直接使用 Supabase Auth 的邮箱和密码，项目必须配置以下构建环境变量：

```text
VITE_SUPABASE_URL=https://zsrhgtplolhxrbzxwfkq.supabase.co
VITE_SUPABASE_ANON_KEY=<Project Settings → API → anon public>
```

本地开发写入根目录 `.env.local`（已被 git 忽略）；Vercel 在 **Project → Settings → Environment Variables** 中分别添加两项，并勾选 Production、Preview、Development 后重新部署。不要填写 Service Role Key。

Supabase 控制台还需要确认：Authentication → Providers → Email 已开启；Authentication → URL Configuration 的 Site URL 为 `https://dobble-mode.vercel.app`，并把该地址加入 Redirect URLs。开启 Confirm email 时，新用户需先点验证邮件再登录。

## 6. 旧本地账号迁移

首次用 Supabase 登录一个没有云端数据的账号时，应用会检测当前设备的旧本地账号数据。选择旧账号并输入旧密码后，数据会复制到当前 Supabase 身份、写入 `app_state` 并同步。旧 LocalStorage 不会被删除；不迁移可选择“暂不迁移”。
