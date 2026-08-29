import { appendFileSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const handoff = join(root, 'HANDOFF.md')
const note = process.argv.slice(2).join(' ').trim()

if (!note) {
  console.error('用法：npm run handoff -- "本轮完成内容；验证结果；未决问题"')
  process.exit(1)
}

const source = readFileSync(handoff, 'utf8')
if (!source.startsWith('# 留白')) {
  console.error('HANDOFF.md 格式异常，已停止写入。')
  process.exit(1)
}

let head = 'unknown'
let status = ''
try {
  head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
  status = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim()
} catch {
  status = '无法读取 Git 状态'
}

const now = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date())
const entry = `\n\n### 工作日志 ${now}\n\n- 记录：${note}\n- 记录时 HEAD：\`${head}\`\n- 工作区状态：${status ? `\n\n\`\`\`text\n${status}\n\`\`\`` : '干净'}\n`
appendFileSync(handoff, entry, 'utf8')
console.log('已更新 HANDOFF.md。')
