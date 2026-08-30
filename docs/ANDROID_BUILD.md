# Android 打包与验收

## 当前交付

- 原生容器：Capacitor Android 8
- 应用 ID：`com.dobblemode.app`
- 显示名称：留白
- 最低 Android 版本：Android 7.0（API 24）
- 当前产物：调试签名 APK，可直接安装到 Android 设备

## 本机重新生成 APK

先准备 Node.js、Java 21 和 Android SDK 36。Android Studio 的 SDK Manager 中安装以下项目即可：

- Android SDK Platform 36
- Android SDK Build-Tools 36.0.0
- Android SDK Platform-Tools

在项目根目录执行：

```bash
npm install
npm run android:apk
```

该命令会先构建网页资源、同步到 Android 工程，再生成调试 APK。产物位置：

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

只更新网页代码而不需要立刻打包时，可执行：

```bash
npm run android:sync
```

需要在 Android Studio 中查看原生工程时执行：

```bash
npm run android:open
```

## 真机验收

1. 将 `app-debug.apk` 传到 Android 手机。
2. 在手机为当前文件管理器或浏览器允许「安装未知应用」。
3. 安装后打开「留白」，使用已配置的 Supabase 邮箱和密码注册或登录。
4. 验收登录、模式切换、作品录入、图片/视频回忆素材、社区、专业模式，以及退出后重新打开时会话是否保留。

当前邮件确认会在浏览器中完成；确认后回到 App 再登录即可。原生深度链接自动返回 App 尚未接入，属于后续优化项。

## 安全边界

`.env.local` 中只允许配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`。它们会进入网页构建产物及 APK，必须使用 Supabase 的公开 Anon/Publishable Key；绝不能放入 `service_role` 或 Secret Key。

`android/local.properties` 仅保存本机 SDK 路径，已被 Git 忽略。调试 APK 的签名仅用于测试；发布到应用商店前必须创建独立的发布签名密钥，并生成签名的 release APK 或 AAB。

## 后续原生化路线

这一版采用「同一套 React 界面 + Capacitor WebView」：网页和 Android 使用同一份业务代码、主题和 Supabase 配置。后续只在确有必要时逐项加入原生能力，例如相册/文件选择、推送通知、深度链接、离线缓存和分享。
