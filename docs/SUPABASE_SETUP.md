# V1.2 云端接入

## 1. 创建项目

创建一个 Supabase 项目，在项目根目录新建 `.env.local`，并填入：

```text
VITE_SUPABASE_URL=你的项目 URL
VITE_SUPABASE_ANON_KEY=你的匿名公钥
```

前端已自动识别这两个配置。未配置时，登录页使用本地预览验证码 `123456`；配置完成后会自动切换为真实邮箱验证码。

## 2. 邮箱验证码

在 Supabase Auth 的 Email 模板中，将登录邮件设置为 OTP 形式，并保留验证码变量。前端使用 `signInWithOtp` 请求验证码，再以 `verifyOtp` 完成登录。

## 3. 数据库与存储

在 Supabase SQL Editor 执行 `supabase/migrations/0001_life_mode.sql`。随后创建私有 Storage bucket：`creator-media`。

作品、便签、反馈和回看均为用户私有数据。社区帖子、评论和点赞是公开层数据；不要把私有作品链接直接暴露在社区帖子中。

## 4. 上线前检查

- 将站点地址加入 Auth Redirect URLs。
- 在生产环境只部署 `.env.local` 中的公开前端配置，不提交真实密钥。
- 为 Storage bucket 添加只允许本人上传、读取自己私有文件的权限策略。
