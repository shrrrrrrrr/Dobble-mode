import type { AppSession } from './auth'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const cloudEnabled = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase: SupabaseClient | null = cloudEnabled
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export interface CloudAccount {
  email: string
}

export interface CloudSnapshot {
  state: unknown
  updatedAt: string
}

export type CloudResult<T> = { ok: true; data: T } | { ok: false; error: string }

type AuthUser = { id: string; email?: string | null }

// 会话恢复和登录状态事件必须生成同一份本地身份，集中转换可避免
// 后续字段调整后，启动恢复与实时登录状态出现不一致。
function toAppSession(user?: AuthUser | null): AppSession | null {
  if (!user?.email) return null
  return {
    userId: user.id,
    username: user.email.split('@')[0] || user.email,
    email: user.email,
    provider: 'supabase',
  }
}

export async function getCloudAccount(): Promise<CloudAccount | null> {
  const session = await getPrimarySession()
  return session?.email ? { email: session.email } : null
}

export async function cloudSignUp(email: string, password: string): Promise<CloudResult<CloudAccount>> {
  if (!supabase) return { ok: false, error: '云端未配置。' }
  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) return { ok: false, error: error.message }
  if (!data.session?.user?.email) {
    return { ok: false, error: '注册成功，但需要先在邮箱中完成验证后再登录。' }
  }
  return { ok: true, data: { email: data.session.user.email } }
}

export async function cloudSignIn(email: string, password: string): Promise<CloudResult<CloudAccount>> {
  if (!supabase) return { ok: false, error: '云端未配置。' }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { ok: false, error: error.message }
  if (!data.session?.user?.email) return { ok: false, error: '登录失败，请重试。' }
  return { ok: true, data: { email: data.session.user.email } }
}

export async function cloudSignOut(): Promise<void> {
  await supabase?.auth.signOut()
}

export async function fetchCloudState(): Promise<CloudSnapshot | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('app_state').select('state, updated_at').maybeSingle()
  if (error || !data) return null
  return { state: data.state, updatedAt: String(data.updated_at) }
}

export async function pushCloudState(state: unknown): Promise<CloudResult<string>> {
  if (!supabase) return { ok: false, error: '云端未配置。' }
  const stateRecord = typeof state === 'object' && state !== null && !Array.isArray(state) ? state as Record<string, unknown> : null
  const stateTimestamp = typeof stateRecord?.updatedAt === 'string' ? Date.parse(stateRecord.updatedAt) : Number.NaN
  const updatedAt = Number.isFinite(stateTimestamp) ? new Date(stateTimestamp).toISOString() : new Date().toISOString()
  const synchronizedState = stateRecord ? { ...stateRecord, updatedAt } : state
  const { data, error } = await supabase
    .from('app_state')
    .upsert({ state: synchronizedState, updated_at: updatedAt }, { onConflict: 'user_id' })
    .select('updated_at')
    .single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: String(data.updated_at) }
}


export async function getPrimarySession(): Promise<AppSession | null> {
  if (!supabase) return null
  const { data, error } = await supabase.auth.getSession()
  return error ? null : toAppSession(data.session?.user)
}

export function onPrimaryAuthStateChange(callback: (session: AppSession | null) => void) {
  if (!supabase) return { unsubscribe: () => undefined }
  const { data } = supabase.auth.onAuthStateChange((_event, next) => {
    callback(toAppSession(next?.user))
  })
  return data.subscription
}
