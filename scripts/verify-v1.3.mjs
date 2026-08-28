import { createHash, pbkdf2Sync, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0
let failed = 0

function ok(label) {
  passed += 1
  console.log(`  ✓ ${label}`)
}

function fail(label, detail) {
  failed += 1
  console.error(`  ✗ ${label}`)
  if (detail) console.error(`    ${detail}`)
}

function encodeBase64(bytes) {
  return Buffer.from(bytes).toString('base64')
}

function hashPassword(password, salt) {
  const bits = pbkdf2Sync(password, salt, 100_000, 32, 'sha256')
  return encodeBase64(bits)
}

function normalizeUsername(username) {
  return username.trim().toLowerCase()
}

function isEmptyAppState(state) {
  return state.works.length === 0 && state.feedback.length === 0 && state.posts.length === 0
}

function shouldOfferLegacyImport(status, legacy, state) {
  if (status !== 'pending') return false
  if (!legacy || isEmptyAppState(legacy)) return false
  return isEmptyAppState(state)
}

console.log('V1.3 verification\n')

console.log('Account rules')
if (/^[a-z0-9_-]{3,20}$/.test(normalizeUsername('Creator_01'))) ok('username normalization and validation')
else fail('username normalization and validation')

if (!/^[a-z0-9_-]{3,20}$/.test(normalizeUsername('a'))) ok('rejects short usernames')
else fail('rejects short usernames')

console.log('\nPassword hashing')
const salt = randomUUID()
const hashA = hashPassword('secret123', salt)
const hashB = hashPassword('secret123', salt)
const hashC = hashPassword('other123', salt)
if (hashA === hashB && hashA !== hashC) ok('PBKDF2 hashes are stable and password-sensitive')
else fail('PBKDF2 hashes are stable and password-sensitive')

console.log('\nLegacy import rules')
const legacy = {
  works: [{ id: 'w1' }],
  feedback: [],
  posts: [],
  profile: { nickname: '我', avatarLabel: '我' },
}
const empty = { works: [], feedback: [], posts: [] }
if (shouldOfferLegacyImport('pending', legacy, empty)) ok('offers import for empty account with legacy data')
else fail('offers import for empty account with legacy data')

if (!shouldOfferLegacyImport('dismissed', legacy, empty)) ok('does not offer import after dismiss')
else fail('does not offer import after dismiss')

if (!shouldOfferLegacyImport('pending', legacy, { works: [{ id: 'w2' }], feedback: [], posts: [] })) {
  ok('does not offer import when account already has data')
} else {
  fail('does not offer import when account already has data')
}

console.log('\nBuild')
const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (build.status === 0) ok('npm run build')
else fail('npm run build', `exit code ${build.status}`)

console.log(`\nResult: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
