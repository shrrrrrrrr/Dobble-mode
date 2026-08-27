import { createClient } from '@supabase/supabase-js'

const localSessionKey = 'creator-life-auth-session'
const devCode = '123456'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null

export interface AppSession {
  userId: string
  email: string
  provider: 'supabase' | 'local-preview'
}

export const authMode = supabase ? 'supabase' : 'local-preview'

export async function getSession(): Promise<AppSession | null> {
  if (!supabase) {
    const saved = localStorage.getItem(localSessionKey)
    return saved ? JSON.parse(saved) as AppSession : null
  }
  const { data } = await supabase.auth.getSession()
  return data.session ? { userId: data.session.user.id, email: data.session.user.email ?? '', provider: 'supabase' } : null
}

export async function requestEmailCode(email: string): Promise<{ previewCode?: string }> {
  if (!supabase) return { previewCode: devCode }
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
  if (error) throw error
  return {}
}

export async function verifyEmailCode(email: string, token: string): Promise<AppSession> {
  if (!supabase) {
    if (token !== devCode) throw new Error('验证码不正确，请输入 123456。')
    const session: AppSession = { userId: `local-${email}`, email, provider: 'local-preview' }
    localStorage.setItem(localSessionKey, JSON.stringify(session))
    return session
  }
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
  if (error || !data.session) throw error ?? new Error('登录未完成，请重新获取验证码。')
  return { userId: data.session.user.id, email: data.session.user.email ?? email, provider: 'supabase' }
}

export async function signOut(): Promise<void> {
  if (!supabase) {
    localStorage.removeItem(localSessionKey)
    return
  }
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
