# 部署指南（V2.1）

> 目标：把「留白」构建为静态站点并部署到你自己的服务器，得到一个可分享的 HTTPS 地址。
> 前端是纯静态产物（`dist/`），不依赖 Node 运行时；云端能力（可选）由 Supabase 托管。

## 1. 构建

```bash
npm install
npm run build
```

产物在 `dist/`，包含 index.html、JS/CSS 和全部主题素材。

**重要：环境变量在构建时注入。** 如果要启用云同步，构建前需要创建 `.env.local`：

```
VITE_SUPABASE_URL=https://zsrhgtplolhxrbzxwfkq.supabase.co
VITE_SUPABASE_ANON_KEY=<你的 Anon Key>
```

- 只使用 Anon Key（公开密钥，安全性由 RLS 行级策略保证）。
- 绝对不要把 Service Role Key 放进任何前端环境变量。
- 不配置这两个变量时，应用以纯本地模式运行，云同步入口会显示「云端未配置」。

## 2. 部署到你的服务器（nginx 示例）

把 `dist/` 上传到服务器，例如 `/var/www/liubai/`，然后：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/liubai;
    index index.html;

    # SPA 路由回退（当前为单页应用，必须保留）
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源带指纹，可以长缓存
    location /assets/ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

之后用 certbot 申请 HTTPS 证书：

```bash
sudo certbot --nginx -d your-domain.com
```

## 3. Supabase 侧配置（启用云同步时）

1. 在 Supabase SQL Editor 中依次执行：
   - `supabase/migrations/0001_life_mode.sql`（若尚未执行）
   - `supabase/migrations/0002_cloud_state.sql`
2. Authentication → URL Configuration：把 `https://your-domain.com` 加入 Site URL 和 Redirect URLs。
3. Authentication → Providers → Email：确认启用；如果不想让任何人注册，开启 "Confirm email" 并只给自己注册。
4. 项目设置 → API：复制 Project URL 和 anon public key 填入 `.env.local`。

## 4. 安全清单

- [x] 前端只包含 Anon Key（设计上公开），数据隔离由 RLS 保证。
- [x] 生产构建没有本地预览后门（旧邮箱 OTP 适配层与预览验证码 `123456` 已在 V1.3 移除，可全局搜索确认）。
- [ ] `.env.local` 已加入 `.gitignore`，不会被提交（提交前用 `git status` 确认）。
- [ ] 服务器启用 HTTPS 后再对外分享地址。

## 5. 更新版本

每次更新：`git pull && npm install && npm run build`，然后重新上传 `dist/`。
GitHub Actions（`.github/workflows/build.yml`）会在每次 push 时自动跑 `npm run verify`，保证构建不回归。
