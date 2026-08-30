import { rmSync } from 'node:fs'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const nativeAssetsRoot = join(root, 'android', 'app', 'src', 'main', 'assets')
const generatedWebAssets = join(nativeAssetsRoot, 'public')
const generatedRelativePath = relative(nativeAssetsRoot, generatedWebAssets)

// Capacitor 默认只覆盖同名文件，不会删除上一版遗留资源。同步前仅清理
// Git 已忽略的 Web 构建副本，避免失效素材继续进入 APK。
if (isAbsolute(generatedRelativePath) || generatedRelativePath.startsWith('..')) {
  throw new Error('Android 生成资源目录不在预期范围内，已停止同步。')
}
rmSync(generatedWebAssets, { recursive: true, force: true })

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

// 复用启动本脚本的 npm CLI，跨平台直接由 Node 执行，避免 shell 参数拼接。
const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('无法定位当前 npm CLI，请通过 npm run android:sync 执行。')
run(process.execPath, [npmCli, 'run', 'build'])
run(process.execPath, [npmCli, 'exec', '--', 'cap', 'sync', 'android'])
