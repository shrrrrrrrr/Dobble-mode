import { pbkdf2Sync, randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
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
  return encodeBase64(pbkdf2Sync(password, salt, 100_000, 32, 'sha256'))
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

function source(path) {
  return readFileSync(join(root, ...path), 'utf8')
}

function isGitIgnored(root, file) {
  const check = spawnSync('git', ['-C', root, 'check-ignore', '-q', file])
  return check.status === 0
}

console.log('Account rules (V1.3+)')
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

console.log('\nRepository contract (V1.6+)')
const repositorySource = source(['src', 'services', 'repository.ts'])
const requiredRepositoryParts = [
  'export interface AppRepository',
  'export class LocalAppRepository',
  'creator-life-v2:data:${userId}',
  'normalizeAppState',
  'post.userId ??',
  'updatedAt',
  'topics',
  'scoreTemplates',
  'reviews',
  'badges',
]
for (const part of requiredRepositoryParts) {
  if (repositorySource.includes(part)) ok(`repository contains ${part}`)
  else fail(`repository contains ${part}`)
}
if (repositorySource.includes('export function touchAppState') && repositorySource.includes('Math.max(now, previous + 1)')) {
  ok('state versions advance monotonically')
} else {
  fail('state versions advance monotonically')
}

const appSource = source(['src', 'App.tsx'])
if (appSource.includes('repository.load()') && appSource.includes('repository.save(state)')) ok('App reads and writes through the repository')
else fail('App reads and writes through the repository')

console.log('\nCloud sync layer (V2.0)')
const cloudSource = source(['src', 'services', 'cloud.ts'])
if (cloudSource.includes('export const cloudEnabled')) ok('cloud layer is gated by env config')
else fail('cloud layer is gated by env config')
if (cloudSource.includes('pushCloudState') && cloudSource.includes('fetchCloudState')) ok('cloud state push/pull implemented')
else fail('cloud state push/pull implemented')
if (cloudSource.includes('synchronizedState') && appSource.includes('cloudStateIsNewer')) ok('cloud row and snapshot versions stay aligned')
else fail('cloud row and snapshot versions stay aligned')
if (appSource.includes('activeSessionUserId') && appSource.includes('window.clearTimeout(cloudPushTimer.current)')) ok('pending cloud writes are isolated by account and cleaned up')
else fail('pending cloud writes are isolated by account and cleaned up')
if (existsSync(join(root, 'supabase', 'migrations', '0002_cloud_state.sql'))) ok('cloud state migration SQL exists')
else fail('cloud state migration SQL exists')
const migrationSource = source(['supabase', 'migrations', '0002_cloud_state.sql'])
if (migrationSource.includes('enable row level security') && migrationSource.includes('auth.uid() = user_id')) ok('app_state is protected by owner-only RLS')
else fail('app_state is protected by owner-only RLS')
const allSrc = ['src/App.tsx', 'src/services/cloud.ts', 'src/services/repository.ts', 'src/services/badges.ts', 'src/professional/ProfessionalMode.tsx', 'src/components/Modal.tsx'].map(p => source(p.split('/'))).join('\n')
if (!/service_role/i.test(allSrc)) ok('no service role key references in frontend source')
else fail('no service role key references in frontend source')

console.log('\nPrimary authentication and recap media (V3.7/V3.8)')
const authSource = source(['src', 'services', 'auth.ts'])
if (cloudSource.includes('getPrimarySession') && cloudSource.includes('onPrimaryAuthStateChange') && appSource.includes('SupabaseAuthPage')) ok('Supabase email/password is the primary login')
else fail('Supabase email/password is the primary login')
if (authSource.includes('verifyLocalAccount') && appSource.includes('LocalDataMigration') && appSource.includes('getLocalAccountCandidates')) ok('old local accounts require verification before migration')
else fail('old local accounts require verification before migration')
const recapMediaSource = source(['src', 'utils', 'recapMedia.ts'])
if (recapMediaSource.includes('VIDEO_FRACTIONS') && recapMediaSource.includes('frameSignal') && recapMediaSource.includes('differentEnough')) ok('recap video uses multi-point quality-screened sampling')
else fail('recap video uses multi-point quality-screened sampling')
if (recapMediaSource.includes('MEDIA_WAIT_TIMEOUT_MS') && recapMediaSource.includes('window.clearTimeout(timer)')) ok('recap media waits have timeout cleanup')
else fail('recap media waits have timeout cleanup')
if (existsSync(join(root, 'src', 'data', 'recapTemplates.ts')) && existsSync(join(root, 'docs', 'RECAP_TEMPLATE_DESIGN.md'))) ok('recap copy and design guide are editable')
else fail('recap copy and design guide are editable')

console.log('\nProfessional mode (V3.0)')
if (appSource.includes('ProfessionalMode')) ok('App wires the professional mode UI')
else fail('App wires the professional mode UI')
if (appSource.includes("dataset.mode")) ok('mode is reflected on body dataset for theming')
else fail('mode is reflected on body dataset for theming')
if (appSource.includes('switchMode')) ok('life/professional mode switch exists')
else fail('life/professional mode switch exists')
const professionalSource = source(['src', 'professional', 'ProfessionalMode.tsx'])
const hardBoundaryLeaks = ['work.note', '.mood', 'feedback.filter']
const leaks = hardBoundaryLeaks.filter(fragment => professionalSource.includes(fragment))
if (leaks.length === 0) ok('professional views do not render life notes, mood or feedback')
else fail('professional views do not render life notes, mood or feedback', `found: ${leaks.join(', ')}`)
const typesSource = source(['src', 'types.ts'])
for (const typeName of ['Topic', 'ScoreTemplate', 'ScoreRecord', 'WorkReview', 'ProfessionalTab']) {
  if (typesSource.includes(typeName)) ok(`types define ${typeName}`)
  else fail(`types define ${typeName}`)
}
for (const icon of ['pro-1', 'pro-2', 'pro-3', 'pro-4']) {
  if (existsSync(join(root, 'public', 'assets', 'nav', `${icon}.png`))) ok(`professional nav icon ${icon} exists`)
  else fail(`professional nav icon ${icon} exists`)
}

console.log('\nBadge system (V3.1)')
const badgesSource = source(['src', 'services', 'badges.ts'])
if ((badgesSource.match(/id: '/g) ?? []).length >= 8) ok('at least 8 badge rules defined')
else fail('at least 8 badge rules defined')
if (badgesSource.includes('export function evaluateBadges')) ok('badge evaluation merges earned dates')
else fail('badge evaluation merges earned dates')
if (appSource.includes('BadgeWall')) ok('profile page renders the badge wall')
else fail('profile page renders the badge wall')

console.log('\nDeployment (V2.1)')
if (existsSync(join(root, '.github', 'workflows', 'build.yml'))) ok('CI build workflow exists')
else fail('CI build workflow exists')
if (existsSync(join(root, 'docs', 'DEPLOYMENT.md'))) ok('deployment guide exists')
else fail('deployment guide exists')
if (!existsSync(join(root, '.env.local')) || isGitIgnored(root, '.env.local')) ok('.env.local absent or properly git-ignored')
else fail('.env.local exists but is NOT git-ignored', 'secrets could be committed')

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
