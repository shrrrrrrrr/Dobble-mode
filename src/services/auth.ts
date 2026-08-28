const accountsKey = 'creator-life-v2:accounts'
const sessionKey = 'creator-life-v2:session'

interface LocalAccount {
  id: string
  username: string
  passwordHash: string
  salt: string
}

export interface AppSession {
  userId: string
  username: string
  provider: 'local'
}

function readAccounts(): LocalAccount[] {
  try {
    const saved = localStorage.getItem(accountsKey)
    return saved ? JSON.parse(saved) as LocalAccount[] : []
  } catch {
    return []
  }
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase()
}

function encodeBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
}

async function hashPassword(password: string, salt: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100_000, hash: 'SHA-256' }, key, 256)
  return encodeBase64(new Uint8Array(bits))
}

function saveSession(account: LocalAccount): AppSession {
  const session: AppSession = { userId: account.id, username: account.username, provider: 'local' }
  localStorage.setItem(sessionKey, JSON.stringify(session))
  return session
}

export async function registerLocalAccount(username: string, password: string): Promise<AppSession> {
  const normalized = normalizeUsername(username)
  if (!/^[a-z0-9_-]{3,20}$/.test(normalized)) throw new Error('账号需为 3–20 位字母、数字、下划线或短横线。')
  if (password.length < 6) throw new Error('密码至少需要 6 位。')

  const accounts = readAccounts()
  if (accounts.some(account => account.username === normalized)) throw new Error('这个账号已存在，请直接登录。')

  const salt = crypto.randomUUID()
  const account: LocalAccount = { id: crypto.randomUUID(), username: normalized, salt, passwordHash: await hashPassword(password, salt) }
  localStorage.setItem(accountsKey, JSON.stringify([...accounts, account]))
  return saveSession(account)
}

export async function signInLocalAccount(username: string, password: string): Promise<AppSession> {
  const account = readAccounts().find(item => item.username === normalizeUsername(username))
  if (!account || account.passwordHash !== await hashPassword(password, account.salt)) throw new Error('账号或密码不正确。')
  return saveSession(account)
}

export async function getSession(): Promise<AppSession | null> {
  try {
    const saved = localStorage.getItem(sessionKey)
    return saved ? JSON.parse(saved) as AppSession : null
  } catch {
    return null
  }
}

export async function signOut(): Promise<void> {
  localStorage.removeItem(sessionKey)
}
