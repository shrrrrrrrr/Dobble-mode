import { type ComponentProps, FormEvent, lazy, ReactNode, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { FeedbackEvent, Platform, Post, ProfessionalTab, Tab, UserProfile, Work } from './types'
import { compressImage } from './utils/image'
import { createRecapMedia } from './utils/recapMedia'
import { recapCopy } from './data/recapTemplates'
import { buildCalendarArt } from './utils/calendarArt'
import { type AppSession, getLocalAccountCandidates, verifyLocalAccount } from './services/auth'
import { importLegacyV1Data, markLegacyDismissed, markLegacyImported, shouldOfferLegacyImport } from './services/legacyImport'
import { emptyAppState, LocalAppRepository, normalizeAppState, touchAppState, type AppState } from './services/repository'
import { cloudEnabled, cloudSignIn, cloudSignOut, cloudSignUp, fetchCloudState, getCloudAccount, getPrimarySession, onPrimaryAuthStateChange, pushCloudState, type CloudAccount } from './services/cloud'
import { badgeRules, evaluateBadges } from './services/badges'
import { getThemePack, seasonPacks, themePacks, type SeasonId, type ThemeId } from './theme'
import { Modal } from './components/Modal'

// 专业模式仅在用户首次进入时加载，生活模式首屏无需下载和解析这部分代码。
const LazyProfessionalMode = lazy(() => import('./professional/ProfessionalMode').then(module => ({ default: module.ProfessionalMode })))

function ProfessionalMode(props: ComponentProps<typeof LazyProfessionalMode>) {
  return <Suspense fallback={<section className="page-head"><p className="eyebrow">专业模式</p><h1>正在整理创作资料...</h1></section>}><LazyProfessionalMode {...props} /></Suspense>
}

function hasSavedContent(state: AppState) {
  const hasRecords = state.works.length + state.feedback.length + state.posts.length + state.topics.length + state.scoreRecords.length + state.reviews.length > 0
  const hasPersonalSettings = state.profile.nickname !== '我' || state.profile.avatarLabel !== '我' || Boolean(state.profile.avatarImage) || state.theme !== 'mint' || state.mode !== 'life' || state.themeByMode.life !== 'mint' || state.themeByMode.professional !== 'cream'
  return hasRecords || hasPersonalSettings
}

function storageErrorMessage(error: unknown) {
  if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
    return '设备存储空间已满。请删除不再需要的大图后再试。'
  }
  return error instanceof Error ? error.message : '保存失败，请稍后再试。'
}

const compactNumberFormatter = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 })
const clockFormatter = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
const number = (value: number) => compactNumberFormatter.format(value)

function localDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getRecentSevenDays(reference = new Date()) {
  const end = new Date(reference)
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  return { start: localDateString(start), end: localDateString(end) }
}

function isInRecentSevenDays(date: string, window = getRecentSevenDays()) {
  return date >= window.start && date <= window.end
}

function formatClock(date: Date) {
  return clockFormatter.format(date)
}

function normalizeCloudState(userId: string, snapshot: { state: unknown; updatedAt: string }) {
  return { ...normalizeAppState(userId, snapshot.state as Partial<AppState>), updatedAt: snapshot.updatedAt }
}

function cloudStateIsNewer(snapshot: { updatedAt: string }, state: AppState) {
  const remoteTime = Date.parse(snapshot.updatedAt)
  const localTime = state.updatedAt ? Date.parse(state.updatedAt) : Number.NaN
  return Number.isFinite(remoteTime) && (!Number.isFinite(localTime) || remoteTime > localTime)
}

function formatPostTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return value
  const date = new Date(value)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  return sameDay ? time : `${date.getMonth() + 1}月${date.getDate()}日 ${time}`
}

export default function App() {
  const [state, setState] = useState<AppState>(emptyAppState)
  const [stateUserId, setStateUserId] = useState<string | null>(null)
  const [session, setSession] = useState<AppSession | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [season, setSeason] = useState<SeasonId>('autumn')
  const repository = useMemo(() => session ? new LocalAppRepository(session.userId) : null, [session?.userId])
  const [tab, setTab] = useState<Tab>('home')
  const [proTab, setProTab] = useState<ProfessionalTab>('topics')
  const [showWorkForm, setShowWorkForm] = useState(false)
  const [showPostForm, setShowPostForm] = useState(false)
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [selectedWork, setSelectedWork] = useState<Work | null>(null)
  const [selectedRecap, setSelectedRecap] = useState(false)
  const [communityView, setCommunityView] = useState<'feed' | 'profile'>('feed')
  const [assistantPinned, setAssistantPinned] = useState(false)
  const [assistantHovered, setAssistantHovered] = useState(false)
  const [legacyImportOpen, setLegacyImportOpen] = useState(false)
  const [localMigrationOpen, setLocalMigrationOpen] = useState(false)
  const [localMigrationCandidates, setLocalMigrationCandidates] = useState<{ userId: string; username: string }[]>([])
  const [migrationReady, setMigrationReady] = useState(false)
  const [notice, setNotice] = useState('')
  const [feedbackWorkId, setFeedbackWorkId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('我在。想看看你最近留下了什么，还是聊聊一条作品？')
  const [cloudAccount, setCloudAccount] = useState<CloudAccount | null>(null)
  const [cloudMessage, setCloudMessage] = useState('')
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudSyncedAt, setCloudSyncedAt] = useState('')
  const cloudPushTimer = useRef<number | null>(null)
  const activeSessionUserId = useRef<string | null>(session?.userId ?? null)
  activeSessionUserId.current = session?.userId ?? null
  const companionRef = useRef<HTMLButtonElement | null>(null)
  const assistantPanelRef = useRef<HTMLDivElement | null>(null)

  function updateState(updater: (current: AppState) => AppState) {
    setState(current => {
      const next = updater(current)
      return next === current ? current : touchAppState(next)
    })
  }

  useEffect(() => {
    let cancelled = false
    if (!session || !repository) {
      setStateUserId(null)
      setLegacyImportOpen(false)
      setLocalMigrationOpen(false)
      setMigrationReady(false)
      return () => { cancelled = true }
    }
    setStateUserId(null)
    setMigrationReady(false)
    ;(async () => {
      let nextState = await repository.load()
      if (cloudEnabled) {
        const snapshot = await fetchCloudState()
        if (snapshot && cloudStateIsNewer(snapshot, nextState)) {
          const cloudState = normalizeCloudState(session.userId, snapshot)
          nextState = cloudState
          await repository.save(nextState)
          setCloudSyncedAt(new Date().toLocaleString('zh-CN'))
        }
      }
      if (cancelled) return
      setState(nextState)
      setStateUserId(session.userId)
      setLegacyImportOpen(shouldOfferLegacyImport(session.userId, nextState))
      if (!hasSavedContent(nextState)) {
        const candidates = [] as { userId: string; username: string }[]
        for (const candidate of getLocalAccountCandidates()) {
          const legacyState = await new LocalAppRepository(candidate.userId).load()
          if (hasSavedContent(legacyState)) candidates.push(candidate)
        }
        if (!cancelled && candidates.length) {
          setLocalMigrationCandidates(candidates)
          setLocalMigrationOpen(true)
          return
        }
      }
      if (!cancelled) setMigrationReady(true)
    })().catch(error => { if (!cancelled) setNotice(storageErrorMessage(error)) })
    return () => { cancelled = true }
  }, [session, repository])
  useEffect(() => {
    if (!session || !repository || stateUserId !== session.userId || !migrationReady) return
    repository.save(state).then(() => setNotice('')).catch(error => setNotice(storageErrorMessage(error)))
    if (cloudEnabled && cloudAccount) {
      if (cloudPushTimer.current) window.clearTimeout(cloudPushTimer.current)
      const scheduledUserId = session.userId
      cloudPushTimer.current = window.setTimeout(() => {
        cloudPushTimer.current = null
        if (activeSessionUserId.current !== scheduledUserId) return
        pushCloudState(state).then(result => {
          if (result.ok) setCloudSyncedAt(new Date().toLocaleTimeString('zh-CN'))
        })
      }, 2000)
    }
    return () => {
      if (cloudPushTimer.current) {
        window.clearTimeout(cloudPushTimer.current)
        cloudPushTimer.current = null
      }
    }
  }, [repository, session, state, stateUserId, migrationReady, cloudAccount?.email])
  useEffect(() => { document.body.dataset.theme = state.theme }, [state.theme])
  useEffect(() => { document.body.dataset.mode = state.mode }, [state.mode])
  useEffect(() => {
    if (!cloudEnabled) { setSession(null); setSessionReady(true); return }
    let active = true
    getPrimarySession().then(savedSession => { if (active) { setSession(savedSession); setSessionReady(true) } })
    const subscription = onPrimaryAuthStateChange(nextSession => { if (active) { setSession(nextSession); setSessionReady(true) } })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  useEffect(() => {
    const closePinnedAssistant = (event: globalThis.PointerEvent) => {
      const target = event.target as Node
      if (assistantPinned && !companionRef.current?.contains(target) && !assistantPanelRef.current?.contains(target)) setAssistantPinned(false)
    }
    window.addEventListener('pointerdown', closePinnedAssistant)
    return () => window.removeEventListener('pointerdown', closePinnedAssistant)
  }, [assistantPinned])
  useEffect(() => {
    if (!cloudEnabled) return
    let cancelled = false
    getCloudAccount().then(account => { if (!cancelled) setCloudAccount(account) })
    return () => { cancelled = true }
  }, [session?.userId])

  useEffect(() => {
    if (!cloudEnabled || !cloudAccount || !session || !repository || stateUserId !== session.userId || !migrationReady) return
    let cancelled = false
    ;(async () => {
      setCloudBusy(true)
      try {
        const snap = await fetchCloudState()
        if (cancelled) return
        if (snap && cloudStateIsNewer(snap, state)) {
          const next = normalizeCloudState(session.userId, snap)
          setState(next)
          await repository.save(next)
          setCloudSyncedAt(new Date().toLocaleString('zh-CN'))
          setCloudMessage('已从云端同步最新数据。')
        } else if (!snap || hasSavedContent(state)) {
          const result = await pushCloudState(state)
          if (!result.ok) throw new Error(result.error)
          setCloudSyncedAt(new Date().toLocaleString('zh-CN'))
          setCloudMessage('本地数据已同步到云端。')
        }
      } catch (error) {
        if (!cancelled) setCloudMessage(error instanceof Error ? error.message : '云同步失败，请稍后再试。')
      } finally {
        if (!cancelled) setCloudBusy(false)
      }
    })()
    return () => { cancelled = true }
  }, [cloudAccount?.email, stateUserId])

  async function syncCloudNow() {
    if (!cloudAccount) return
    setCloudBusy(true)
    setCloudMessage('')
    try {
      const snap = await fetchCloudState()
      if (snap && cloudStateIsNewer(snap, state)) {
        if (session) {
          const next = normalizeCloudState(session.userId, snap)
          setState(next)
          if (repository) await repository.save(next)
        }
        setCloudMessage('已从云端同步最新数据。')
      } else {
        const result = await pushCloudState(state)
        setCloudMessage(result.ok ? '本地数据已同步到云端。' : result.error)
      }
      setCloudSyncedAt(new Date().toLocaleString('zh-CN'))
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : '云同步失败，请稍后再试。')
    } finally {
      setCloudBusy(false)
    }
  }


  useEffect(() => {
    if (!session || stateUserId !== session.userId) return
    const next = evaluateBadges(state)
    if (Object.keys(next).length !== Object.keys(state.badges).length) {
      updateState(current => ({ ...current, badges: next }))
    }
  }, [state, stateUserId, session])

  const memories = useMemo(() => {
    const recentWindow = getRecentSevenDays()
    const recentWorks = state.works.filter(work => isInRecentSevenDays(work.publishedAt, recentWindow))
    const highlighted = recentWorks.slice().sort((a: Work, b: Work) => (b.likes + b.favorites) - (a.likes + a.favorites)).slice(0, 2)
    return highlighted.map((work: Work, index: number) => ({
      id: work.id,
      label: index === 0 ? '这七天被好好接住的一条作品' : '一段值得回头看的创作日常',
      title: work.title,
      detail: `${work.platform} · ${number(work.likes)} 个赞 · ${work.comments} 条留言`,
      note: work.note,
    }))
  }, [state.works])

  const recentWindow = getRecentSevenDays()
  const recentWorks = state.works.filter(work => isInRecentSevenDays(work.publishedAt, recentWindow))
  const recentFeedback = state.feedback.filter(item => isInRecentSevenDays(item.createdAt, recentWindow))
  const theme = state.theme
  const companionImage = getThemePack(theme).companionImage

  function changeTheme(nextTheme: ThemeId) {
    const pack = themePacks.find(item => item.id === nextTheme)
    if (pack?.available) updateState(current => ({
      ...current,
      theme: nextTheme,
      themeByMode: { ...current.themeByMode, [current.mode]: nextTheme },
    }))
  }

  function switchMode(nextMode: 'life' | 'professional') {
    updateState(current => ({ ...current, mode: nextMode, theme: current.themeByMode[nextMode] }))
    setSelectedWork(null)
    setSelectedRecap(false)
    setAssistantPinned(false)
    setAssistantHovered(false)
  }

  function openMyProfile() {
    updateState(current => current.mode === 'life' ? current : ({ ...current, mode: 'life', theme: current.themeByMode.life }))
    setTab('community')
    setCommunityView('profile')
    setSelectedWork(null)
    setSelectedRecap(false)
    setAssistantPinned(false)
  }

  async function saveWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const form = new FormData(event.currentTarget)
      const imageFile = form.get('coverImage')
      const recapFiles = form.getAll('recapMedia').filter((value): value is File => value instanceof File && value.size > 0)
      const recapMedia = recapFiles.length ? await createRecapMedia(recapFiles) : []
      const coverImage = imageFile instanceof File && imageFile.size > 0 ? await compressImage(imageFile) : recapMedia.find(item => item.kind === 'image')?.dataUrl
      const newWork: Work = {
        id: crypto.randomUUID(), title: String(form.get('title')).trim(), platform: form.get('platform') as Platform,
        publishedAt: String(form.get('publishedAt')), cover: String(form.get('cover')).trim() || '新作品',
        plays: Number(form.get('plays')) || 0, likes: Number(form.get('likes')) || 0,
        comments: Number(form.get('comments')) || 0, favorites: Number(form.get('favorites')) || 0,
        shares: Number(form.get('shares')) || 0, note: String(form.get('note')).trim(), mood: form.get('mood') as Work['mood'], coverImage, recapMedia,
      }
      updateState(current => ({ ...current, works: [newWork, ...current.works] }))
      setShowWorkForm(false)
      setNotice('')
    } catch (error) {
      setNotice(`作品保存失败：${storageErrorMessage(error)}`)
    }
  }

  async function savePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const form = new FormData(event.currentTarget)
      const content = String(form.get('content')).trim()
      if (!content) return
      const imageFile = form.get('image')
      const image = imageFile instanceof File && imageFile.size > 0 ? await compressImage(imageFile) : undefined
      const post: Post = { id: crypto.randomUUID(), userId: session?.userId, author: state.profile.nickname, avatar: state.profile.avatarLabel, content, image, imageCaption: String(form.get('imageCaption')).trim() || undefined, createdAt: new Date().toISOString(), likes: 0, liked: false, comments: [] }
      updateState(current => ({ ...current, posts: [post, ...current.posts] }))
      setShowPostForm(false)
      setNotice('')
    } catch (error) {
      setNotice(`社区发布失败：${storageErrorMessage(error)}`)
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      const form = new FormData(event.currentTarget)
      const nickname = String(form.get('nickname')).trim() || '我'
      const avatarFile = form.get('avatarImage')
      const avatarImage = avatarFile instanceof File && avatarFile.size > 0 ? await compressImage(avatarFile, 480, 0.88) : state.profile.avatarImage
      const profile: UserProfile = { nickname, avatarLabel: nickname.slice(0, 1), avatarImage }
      updateState(current => ({ ...current, profile }))
      setShowProfileForm(false)
      setNotice('')
    } catch (error) {
      setNotice(`资料保存失败：${storageErrorMessage(error)}`)
    }
  }

  function updateNote(workId: string, note: string) {
    updateState(current => ({ ...current, works: current.works.map((work: Work) => work.id === workId ? { ...work, note } : work) }))
  }

  function saveFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!feedbackWorkId) return
    const form = new FormData(event.currentTarget)
    const content = String(form.get('content')).trim()
    if (!content) return
    const feedback: FeedbackEvent = { id: crypto.randomUUID(), workId: feedbackWorkId, type: form.get('type') as FeedbackEvent['type'], content, createdAt: localDateString(new Date()) }
    updateState(current => ({ ...current, feedback: [feedback, ...current.feedback] }))
    setFeedbackWorkId(null)
    setNotice('')
  }

  function toggleLike(postId: string) {
    updateState(current => ({ ...current, posts: current.posts.map((post: Post) => post.id === postId ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) } : post) }))
  }

  function addComment(postId: string, comment: string) {
    if (!comment) return
    updateState(current => ({ ...current, posts: current.posts.map((post: Post) => post.id === postId ? { ...post, comments: [...post.comments, comment] } : post) }))
  }

  function askAssistant(event: FormEvent) {
    event.preventDefault()
    const query = question.trim()
    if (!query) return
    const likes = state.works.reduce((sum: number, work: Work) => sum + work.likes, 0)
    const best = state.works.slice().sort((a: Work, b: Work) => b.likes - a.likes)[0]
    const response = query.includes('数据') || query.includes('表现')
      ? `你现在记录了 ${state.works.length} 条作品，累计 ${number(likes)} 个赞。${best ? `《${best.title}》目前最受欢迎。` : ''}`
      : query.includes('回忆') ? `已经为你整理了 ${memories.length} 张回忆卡。最值得再看一眼的，是《${best?.title ?? '你的第一条作品'}》。`
      : `我看到你最近在记录创作。${best?.note ? `《${best.title}》里你写过：“${best.note}”` : '要不要先录入一条作品？'}`
    setAnswer(response)
    setQuestion('')
  }

  async function handleSignOut() {
    await cloudSignOut()
    setSession(null)
  }

  function acceptLegacyImport() {
    if (!session) return
    const legacy = importLegacyV1Data()
    if (!legacy) {
      setLegacyImportOpen(false)
      return
    }
    updateState(() => normalizeAppState(session.userId, legacy))
    markLegacyImported(session.userId)
    setLegacyImportOpen(false)
  }

  function dismissLegacyImport() {
    if (!session) return
    markLegacyDismissed(session.userId)
    setLegacyImportOpen(false)
  }

  const nav = [{ id: 'home', label: '首页' }, { id: 'works', label: '作品' }, { id: 'memories', label: '回忆' }, { id: 'community', label: '社区' }] as const
  const proNav = [{ id: 'topics', label: '选题' }, { id: 'scoring', label: '评分' }, { id: 'review', label: '复盘' }, { id: 'data', label: '数据' }] as const

  if (!sessionReady) return <main className="app-shell"><section className="auth-loading">正在打开你的创作桌面...</section></main>
  if (!cloudEnabled) return <SupabaseConfigRequired />
  if (!session) return <SupabaseAuthPage onAuthenticated={setSession} />

  return <main className="app-shell">
    <PixelBackground theme={theme} season={season} />
    <section className="mobile-frame">
      <header className="topbar"><button className="brand tile-interactive" onClick={() => { if (state.mode === 'professional') { setProTab('topics') } else { setTab('home'); setCommunityView('feed') } setAssistantPinned(false) }} aria-label="留白，返回首页">留白</button><button className={`mode-switch ${state.mode}`} role="switch" aria-checked={state.mode === 'professional'} aria-label={`切换到${state.mode === 'life' ? '专业' : '生活'}模式`} onClick={() => switchMode(state.mode === 'life' ? 'professional' : 'life')}><span className="mode-window" aria-hidden="true"><span className="mode-life-scene"><span className="cornflower">✿</span><i>♫</i><b>♪</b><em /></span><span className="mode-night-scene"><span className="mode-stars"><i>✦</i><i>·</i><i>✧</i></span><img src="/assets/mode/professional-lamp.png" alt="" /></span></span><span className="mode-label">{state.mode === 'life' ? '生活' : '专业'}</span></button><div className="theme-switcher" aria-label="主题选择"><button className={`theme-dot ${theme === 'mint' ? 'active' : ''}`} onClick={() => { changeTheme('mint'); setAssistantPinned(false) }} title="默认主题" aria-label="默认主题" /><button className={`theme-dot cream ${theme === 'cream' ? 'active' : ''}`} onClick={() => { changeTheme('cream'); setAssistantPinned(false) }} title="北航四季" aria-label="北航四季" /><button className={`theme-dot night ${theme === 'night' ? 'active' : ''}`} onClick={() => { changeTheme('night'); setAssistantPinned(false) }} title="樱花夜" aria-label="樱花夜" /></div>{theme === 'cream' && <div className="season-switcher" aria-label="北航四季选择">{seasonPacks.map(pack => <button key={pack.id} className={season === pack.id ? 'active' : ''} onClick={() => { setSeason(pack.id); setAssistantPinned(false) }} style={{ '--season-accent': pack.accent } as React.CSSProperties}>{pack.name.split(' · ')[0]}</button>)}</div>}<div className="account-summary"><button className="account-profile" onClick={openMyProfile} aria-label="打开我的主页"><span>{session.username}</span><i aria-hidden="true">我</i></button><button className="sign-out" onClick={() => { handleSignOut(); setAssistantPinned(false) }}>退出</button></div></header>
      <div className="content" onClick={event => { if (assistantPinned && event.target === event.currentTarget) setAssistantPinned(false) }}>
        {notice && <div className="app-notice" role="alert"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="关闭提示">关闭</button></div>}
        {state.mode === 'professional' ? <ProfessionalMode tab={proTab} works={state.works} topics={state.topics} templates={state.scoreTemplates} records={state.scoreRecords} reviews={state.reviews} onTopicsChange={topics => updateState(current => ({ ...current, topics }))} onTemplatesChange={scoreTemplates => updateState(current => ({ ...current, scoreTemplates }))} onRecordsChange={scoreRecords => updateState(current => ({ ...current, scoreRecords }))} onReviewsChange={reviews => updateState(current => ({ ...current, reviews }))} /> : selectedRecap ? <WeeklyRecap works={recentWorks} feedback={recentFeedback} onClose={() => setSelectedRecap(false)} /> : selectedWork ? <WorkDetail work={selectedWork} feedback={state.feedback.filter((item: FeedbackEvent) => item.workId === selectedWork.id)} onClose={() => setSelectedWork(null)} onSaveNote={updateNote} onFeedback={() => setFeedbackWorkId(selectedWork.id)} /> : <>
          {tab === 'home' && <Home works={recentWorks} feedback={recentFeedback} onAdd={() => setShowWorkForm(true)} onOpenWork={setSelectedWork} onNavigate={nextTab => { setTab(nextTab); if (nextTab === 'community') setCommunityView('feed') }} />}
          {tab === 'works' && <Works works={state.works} onAdd={() => setShowWorkForm(true)} onOpenWork={setSelectedWork} />}
          {tab === 'memories' && <Memories memories={memories} works={recentWorks} onOpenRecap={() => setSelectedRecap(true)} />}
          {tab === 'community' && <Community userId={session.userId} view={communityView} profile={state.profile} posts={state.posts} onAdd={() => setShowPostForm(true)} onLike={toggleLike} onComment={addComment} onViewChange={setCommunityView} onEditProfile={() => setShowProfileForm(true)} badgeWall={<BadgeWall badges={state.badges} state={state} />} cloudPanel={<CloudSyncPanel account={cloudAccount} busy={cloudBusy} message={cloudMessage} syncedAt={cloudSyncedAt} onSignOut={handleSignOut} onSyncNow={syncCloudNow} />} />}
        </>}
      </div>
      {!selectedWork && !selectedRecap && (state.mode === 'professional'
        ? <nav className="bottom-nav pro-nav">{proNav.map(item => <button key={item.id} className={proTab === item.id ? 'active' : ''} onClick={() => setProTab(item.id)}><span className="nav-mark" />{item.label}</button>)}</nav>
        : <nav className="bottom-nav">{nav.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); if (item.id === 'community') setCommunityView('feed') }}><span className="nav-mark" />{item.label}</button>)}</nav>)}
    </section>
    {state.mode === 'life' && <button ref={companionRef} className={`companion ${assistantPinned ? 'pinned' : ''}`} onPointerEnter={() => setAssistantHovered(true)} onPointerLeave={() => setAssistantHovered(false)} onClick={() => setAssistantPinned(open => !open)} aria-label="打开或关闭创作陪伴"><img src={companionImage} alt="" /><span>留</span></button>}
    {state.mode === 'life' && (assistantPinned || assistantHovered) && <div ref={assistantPanelRef} className="assistant-panel" onPointerEnter={() => setAssistantHovered(true)} onPointerLeave={() => setAssistantHovered(false)}><p className="eyebrow">创作陪伴</p><h2>今天也在记录。</h2><p className="assistant-answer">{answer}</p><form onSubmit={askAssistant}><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="问问我关于你的创作" /><button>发送</button></form></div>}
    {showWorkForm && <Modal title="记录一条作品" onClose={() => setShowWorkForm(false)}><WorkForm onSave={saveWork} /></Modal>}
    {showPostForm && <Modal title="发布到社区" onClose={() => setShowPostForm(false)}><PostForm onSave={savePost} /></Modal>}
    {showProfileForm && <Modal title="编辑个人资料" onClose={() => setShowProfileForm(false)}><ProfileForm profile={state.profile} onSave={saveProfile} /></Modal>}
    {feedbackWorkId && <Modal title="记录一个珍藏时刻" onClose={() => setFeedbackWorkId(null)}><FeedbackForm onSave={saveFeedback} /></Modal>}
    {localMigrationOpen && <Modal title="迁移旧本地账号" onClose={() => { setLocalMigrationOpen(false); setMigrationReady(true) }}><LocalDataMigration candidates={localMigrationCandidates} onMigrate={async (username, password) => {
      const legacySession = await verifyLocalAccount(username, password)
      const legacyState = await new LocalAppRepository(legacySession.userId).load()
      const migrated = touchAppState(normalizeAppState(session!.userId, legacyState))
      setState(migrated)
      if (repository) await repository.save(migrated)
      const result = await pushCloudState(migrated)
      if (!result.ok) throw new Error(result.error)
      setLocalMigrationOpen(false)
      setMigrationReady(true)
      setCloudSyncedAt(new Date().toLocaleString('zh-CN'))
    }} onSkip={() => { setLocalMigrationOpen(false); setMigrationReady(true) }} /></Modal>}
    {legacyImportOpen && <Modal title="发现旧版数据" onClose={dismissLegacyImport}><div className="legacy-import"><p>检测到这台设备上还有 V1.2 及以前的创作记录。要导入到当前账号吗？</p><p className="legacy-import-note">导入只会复制到当前账号，不会删除旧数据。如果跳过，之后不会再提示。</p><div className="legacy-import-actions"><button className="primary" onClick={acceptLegacyImport}>导入到当前账号</button><button className="text-action" onClick={dismissLegacyImport}>暂不导入</button></div></div></Modal>}
  </main>
}

type Background = { key: string; kind: 'image' | 'video'; source: string; poster?: string; pixelSize?: number; className: string; focalPoint: { x: number; y: number } }

function backgroundFor(theme: ThemeId, season: SeasonId): Background | null {
  if (theme === 'cream') {
    const pack = seasonPacks.find(item => item.id === season)
    return { key: `cream-${season}`, kind: 'image', source: pack?.image ?? '', pixelSize: 5, className: `season-background season-${season}`, focalPoint: { x: .5, y: .5 } }
  }
  if (theme === 'night') return { key: 'night', kind: 'image', source: '/assets/sakura/background.jpg', pixelSize: 5, className: 'sakura-background', focalPoint: { x: .14, y: .5 } }
  const pack = themePacks.find(item => item.id === theme && item.available) ?? themePacks[0]
  return pack.backgroundVideo ? { key: `video-${theme}`, kind: 'video', source: pack.backgroundVideo, poster: pack.poster, className: 'pixel-video-theme', focalPoint: { x: .31, y: .55 } } : null
}

function PixelBackground({ theme, season }: { theme: ThemeId; season: SeasonId }) {
  const current = backgroundFor(theme, season)
  const [previous, setPrevious] = useState<Background | null>(null)
  const currentKey = current?.key ?? ''
  const currentBackgroundRef = useRef<Background | null>(current)

  useEffect(() => {
    if (currentBackgroundRef.current?.key === currentKey) return
    setPrevious(currentBackgroundRef.current)
    currentBackgroundRef.current = current
    const timeout = window.setTimeout(() => setPrevious(null), 900)
    return () => window.clearTimeout(timeout)
  }, [current, currentKey])

  return <div className="theme-background-stage" aria-hidden="true">
    {previous && <BackgroundLayer background={previous} phase="leaving" />}
    {current && <BackgroundLayer key={current.key} background={current} phase={previous ? 'entering' : 'resting'} />}
  </div>
}

function BackgroundLayer({ background, phase }: { background: Background; phase: 'leaving' | 'entering' | 'resting' }) {
  const className = `${background.className} theme-background-layer ${phase}`
  return background.kind === 'image'
    ? <PixelatedImageBackground source={background.source} pixelSize={background.pixelSize ?? 5} className={className} focalPoint={background.focalPoint} />
    : <PixelatedVideoBackground source={background.source} poster={background.poster} className={className} focalPoint={background.focalPoint} />
}

function PixelatedImageBackground({ source, pixelSize, className, focalPoint }: { source: string; pixelSize: number; className: string; focalPoint: { x: number; y: number } }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !source) return
    const context = canvas.getContext('2d')
    const image = new Image()
    let resizeFrame = 0
    const draw = () => {
      if (!context || !image.naturalWidth) return
      const width = Math.max(1, Math.ceil(window.innerWidth / pixelSize))
      const height = Math.max(1, Math.ceil(window.innerHeight / pixelSize))
      canvas.width = width
      canvas.height = height
      context.imageSmoothingEnabled = false
      const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
      const drawWidth = image.naturalWidth * scale
      const drawHeight = image.naturalHeight * scale
      const focus = window.innerHeight > window.innerWidth ? focalPoint : { x: .5, y: .5 }
      const drawX = Math.min(0, Math.max(width - drawWidth, width / 2 - drawWidth * focus.x))
      const drawY = Math.min(0, Math.max(height - drawHeight, height / 2 - drawHeight * focus.y))
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight)
    }
    // 窗口缩放可能在一帧内触发多次 resize；合并到下一帧可避免重复清空和重绘 canvas。
    const scheduleDraw = () => {
      if (resizeFrame) return
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0
        draw()
      })
    }
    image.onload = draw
    image.src = source
    window.addEventListener('resize', scheduleDraw)
    return () => {
      image.onload = null
      window.removeEventListener('resize', scheduleDraw)
      if (resizeFrame) window.cancelAnimationFrame(resizeFrame)
    }
  }, [source, pixelSize, focalPoint.x, focalPoint.y])
  return <canvas ref={canvasRef} className={`pixel-canvas-bg ${className}`} aria-hidden="true" />
}

function PixelatedVideoBackground({ source, poster, className, focalPoint }: { source: string; poster?: string; className: string; focalPoint: { x: number; y: number } }) {
  const useStaticMobileBackground = typeof window !== 'undefined' && window.matchMedia('(hover:none) and (pointer:coarse)').matches
  if (useStaticMobileBackground && poster) return <PixelatedImageBackground source={poster} pixelSize={5} className={className} focalPoint={focalPoint} />
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    // 2D context 在整个视频生命周期内保持不变，避免每一帧重复查询。
    const context = canvas.getContext('2d')
    if (!context) return
    let frame = 0
    const firstFrame = document.createElement('canvas')
    let capturedFirstFrame = false
    const posterImage = new Image()
    let posterReady = false
    const drawSource = (context: CanvasRenderingContext2D, image: CanvasImageSource, sourceWidth: number, sourceHeight: number, width: number, height: number) => {
      const scale = Math.max(width / sourceWidth, height / sourceHeight)
      const drawWidth = sourceWidth * scale
      const drawHeight = sourceHeight * scale
      const focus = window.innerHeight > window.innerWidth ? focalPoint : { x: .5, y: .5 }
      const drawX = Math.min(0, Math.max(width - drawWidth, width / 2 - drawWidth * focus.x))
      const drawY = Math.min(0, Math.max(height - drawHeight, height / 2 - drawHeight * focus.y))
      context.drawImage(image, drawX, drawY, drawWidth, drawHeight)
      return { drawX, drawY, drawWidth, drawHeight }
    }
    const captureFirstFrame = () => {
      if (!video.videoWidth || !video.videoHeight) return
      firstFrame.width = video.videoWidth
      firstFrame.height = video.videoHeight
      const firstContext = firstFrame.getContext('2d')
      if (!firstContext) return
      firstContext.imageSmoothingEnabled = false
      firstContext.drawImage(video, 0, 0)
      capturedFirstFrame = true
    }
    const draw = () => {
      const width = Math.max(1, Math.ceil(window.innerWidth / 5))
      const height = Math.max(1, Math.ceil(window.innerHeight / 5))
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      context.imageSmoothingEnabled = false
      context.clearRect(0, 0, width, height)
      if (posterReady) drawSource(context, posterImage, posterImage.naturalWidth, posterImage.naturalHeight, width, height)
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth) {
        const { drawX, drawY, drawWidth, drawHeight } = drawSource(context, video, video.videoWidth, video.videoHeight, width, height)
        const seamDuration = 0.28
        const remaining = video.duration - video.currentTime
        if (capturedFirstFrame && Number.isFinite(remaining) && remaining > 0 && remaining < seamDuration) {
          context.globalAlpha = 1 - remaining / seamDuration
          context.drawImage(firstFrame, drawX, drawY, drawWidth, drawHeight)
          context.globalAlpha = 1
        }
      }
      frame = window.requestAnimationFrame(draw)
    }
    video.addEventListener('loadeddata', captureFirstFrame, { once: true })
    if (poster) {
      posterImage.onload = () => { posterReady = true }
      posterImage.src = poster
    }
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) captureFirstFrame()
    video.play().catch(() => undefined)
    draw()
    return () => {
      window.cancelAnimationFrame(frame)
      video.removeEventListener('loadeddata', captureFirstFrame)
    }
  }, [source, poster, focalPoint.x, focalPoint.y])
  const mediaType = source.endsWith('.mp4') ? 'video/mp4' : 'video/webm'
  return <><canvas ref={canvasRef} className={`pixel-canvas-bg pixel-video-bg ${className}`} aria-hidden="true" /><video ref={videoRef} className="pixel-video-source" autoPlay muted loop playsInline preload="auto" poster={poster}><source src={source} type={mediaType} /></video></>
}

function SupabaseConfigRequired() {
  return <main className="auth-shell"><section className="auth-card"><div className="auth-sticker">留</div><p className="eyebrow">账号配置</p><h1>还差一点<br />就能登录。</h1><p className="auth-copy">这个版本已使用 Supabase 邮箱密码登录。请先在 Vercel 或本地环境变量中设置项目 URL 与 Anon Key。</p><p className="auth-message">具体位置见 docs/SUPABASE_SETUP.md。</p></section></main>
}

function SupabaseAuthPage({ onAuthenticated }: { onAuthenticated: (session: AppSession) => void }) {
  const [registering, setRegistering] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const result = registering ? await cloudSignUp(email.trim(), password) : await cloudSignIn(email.trim(), password)
      if (!result.ok) throw new Error(result.error)
      const nextSession = await getPrimarySession()
      if (!nextSession) { setMessage('注册成功。请先完成邮箱验证，再回来登录。'); return }
      onAuthenticated(nextSession)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败，请重新尝试。')
    } finally { setLoading(false) }
  }

  return <main className="auth-shell"><section className="auth-card"><div className="auth-sticker">留</div><p className="eyebrow">创作生活</p><h1>{registering ? <>创建你的<br />创作桌面。</> : <>先把你自己<br />带进来。</>}</h1><p className="auth-copy">使用邮箱和密码进入。数据将和 Supabase 账号绑定，可在已登录的设备之间同步。</p><form className="auth-form" onSubmit={submit}><label>邮箱<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required autoFocus autoComplete="email" /></label><label>密码<input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="至少 6 位" minLength={6} required autoComplete={registering ? 'new-password' : 'current-password'} /></label><button className="primary" disabled={loading}>{loading ? '处理中...' : registering ? '创建并进入' : '进入创作桌面'}</button></form><button className="text-action auth-switch" onClick={() => { setRegistering(value => !value); setMessage('') }}>{registering ? '已有账号？直接登录' : '第一次来？创建账号'}</button><p className="auth-message">{message}</p><p className="auth-preview">首次登录时，如检测到当前设备有旧本地账号，会要求验证旧账号后复制数据；旧数据不会被删除。</p></section></main>
}

function LocalDataMigration({ candidates, onMigrate, onSkip }: { candidates: { userId: string; username: string }[]; onMigrate: (username: string, password: string) => Promise<void>; onSkip: () => void }) {
  const [username, setUsername] = useState(candidates[0]?.username ?? '')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setMessage('')
    try { await onMigrate(username, password) } catch (error) { setMessage(error instanceof Error ? error.message : '迁移失败，请重试。') } finally { setBusy(false) }
  }
  return <form className="entry-form local-migration" onSubmit={submit}><p>检测到这台设备上有旧本地账号的创作记录。验证旧账号后，会将其复制到当前 Supabase 账号并同步；原本地数据不会删除。</p><label>旧账号<select value={username} onChange={event => setUsername(event.target.value)}>{candidates.map(candidate => <option value={candidate.username} key={candidate.userId}>{candidate.username}</option>)}</select></label><label>旧账号密码<input type="password" value={password} onChange={event => setPassword(event.target.value)} required autoComplete="current-password" /></label>{message && <p className="auth-message">{message}</p>}<button className="primary" disabled={busy}>{busy ? '迁移中...' : '验证并迁移数据'}</button><button type="button" className="text-action" onClick={onSkip}>暂不迁移</button></form>
}
function useCalendarArt(date: Date) {
  const [art, setArt] = useState('')
  const dateKey = localDateString(date)
  useEffect(() => {
    let cancelled = false
    buildCalendarArt(date).then(url => { if (!cancelled) setArt(url) })
    return () => { cancelled = true }
  }, [dateKey])
  return art
}

function Home({ works, feedback, onAdd, onOpenWork, onNavigate }: { works: Work[]; feedback: FeedbackEvent[]; onAdd: () => void; onOpenWork: (work: Work) => void; onNavigate: (tab: Tab) => void }) {
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const now = clock
  const clockText = formatClock(clock)
  const calendarLabel = `${clock.getMonth() + 1} 月 ${clock.getDate()} 日`
  const hourAngle = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5
  const minuteAngle = now.getMinutes() * 6 + now.getSeconds() * 0.1
  const secondAngle = now.getSeconds() * 6
  const totalLikes = works.reduce((sum, work) => sum + work.likes, 0)
  const latest = works[0]
  const calendarArt = useCalendarArt(clock)
  return <div className="studio-layout">
    <aside className="creator-aside">
      <div className="desk-title"><h2>今天的<br />创作桌面</h2><p>慢一点，也没关系。</p></div>
      <nav className="studio-nav" aria-label="创作桌面导航">
        <button className="side-link tile-interactive" onClick={() => onNavigate('works')}><i />作品档案</button>
        <button className="side-link tile-interactive" onClick={() => onNavigate('memories')}><i />短期回看</button>
        <button className="side-link tile-interactive" onClick={() => onNavigate('community')}><i />创作社区</button>
      </nav>
      <p className="aside-note">把每一次认真，都留在这里。</p>
    </aside>
    <section className="studio-stage">
      <section className="hero studio-hero"><h1>把创作过成<br />自己的生活。</h1><p>不用急着解释数据，先把每一次认真留下来。</p><button className="primary tile-interactive" onClick={onAdd}>记录新作品</button></section>
      {latest && <button className="latest-tile tile-interactive" onClick={() => onOpenWork(latest)}><span className="tile-label">最近发布</span><WorkCard work={latest} /><span className="tile-hint">查看这条作品</span></button>}
      <section className="moments-board"><p className="eyebrow">最近七天值得记住</p>{feedback.length ? feedback.slice(0, 2).map(item => <article className="moment tile-interactive" key={item.id}><span>{item.type}</span><p>{item.content}</p></article>) : <p className="empty">这七天还没有收藏的时刻。记录一条作品，或给自己留句话。</p>}</section>
    </section>
    <aside className="dashboard-rail">
      <article className="clock-widget tile-interactive" aria-label={`像素时钟 ${clockText}`}><span>创作时间</span><strong className="pixel-clock" style={{ '--hour-angle': `${hourAngle}deg`, '--minute-angle': `${minuteAngle}deg`, '--second-angle': `${secondAngle}deg` } as React.CSSProperties}><i className="clock-hour" /><i className="clock-minute" /><i className="clock-second" /><b className="clock-center" /></strong><small>留给自己的十分钟</small></article>
      <article className="calendar-widget tile-interactive" aria-label={calendarLabel}>{calendarArt ? <img src={calendarArt} alt={`台历，今天是${calendarLabel}`} /> : null}</article>
      <article className="metric-widget tile-interactive"><p>最近七天</p><div><strong>{works.length}</strong><span>条作品</span></div><div><strong>{number(totalLikes)}</strong><span>个喜欢</span></div><div><strong>{feedback.length}</strong><span>次收藏</span></div></article>
    </aside>
  </div>
}

function Works({ works, onAdd, onOpenWork }: { works: Work[]; onAdd: () => void; onOpenWork: (work: Work) => void }) {
  return <><section className="page-head"><p className="eyebrow">作品档案</p><h1>你做过的事，<br />都在这里。</h1><button className="primary compact" onClick={onAdd}>新增</button></section><div className="work-list">{works.map(work => <button className="work-button" onClick={() => onOpenWork(work)} key={work.id}><WorkCard work={work} /></button>)}</div></>
}

function WorkCard({ work }: { work: Work }) { return <article className={`work-card cover-${work.id.slice(-1)}`}><div className="cover">{work.coverImage ? <img src={work.coverImage} alt={`${work.title}封面`} /> : <span>{work.cover}</span>}<small>{work.platform}</small></div><div className="work-copy"><h3>{work.title}</h3><p>{work.publishedAt} · {number(work.plays)} 次观看</p><div className="work-metrics"><span>{number(work.likes)} 赞</span><span>{work.comments} 评论</span><span>{number(work.favorites)} 收藏</span></div>{work.note && <em>“{work.note}”</em>}</div></article> }

function Memories({ memories, works, onOpenRecap }: { memories: { id: string; label: string; title: string; detail: string; note: string }[]; works: Work[]; onOpenRecap: () => void }) { return <><section className="page-head memories-head"><p className="eyebrow">短期回看</p><h1>这一周，<br />你留下些什么？</h1><p>回看不必等到年末。它会收起最近七天的作品、感受和反馈。</p><button className="primary recap-entry" onClick={onOpenRecap}>打开本周回看</button></section>{memories.length ? <div className="memory-stack">{memories.map((memory, index) => <article className={`memory-card memory-${index}`} key={memory.id}><p>{memory.label}</p><h2>{memory.title}</h2><span>{memory.detail}</span><blockquote>{memory.note || '这一刻，值得被收起来。'}</blockquote></article>)}</div> : <section className="empty memory-empty"><p>最近七天还没有作品回忆。</p><span>记录一条作品后，这里会为你整理本周值得回看的片段。</span></section>}<p className="small-note">基于最近七天的 {works.length} 条作品与创作记录生成</p></> }

function BadgeWall({ badges, state }: { badges: Record<string, string>; state: AppState }) {
  return <div className="badge-wall">
    {badgeRules.map(rule => {
      const earnedAt = badges[rule.id]
      const progress = Math.min(rule.progress(state), rule.target)
      return <article key={rule.id} className={`badge-card ${earnedAt ? 'earned' : 'locked'}`}>
        <span className="badge-icon" aria-hidden="true">{earnedAt ? '◆' : '◇'}</span>
        <strong>{rule.name}</strong>
        {earnedAt ? <small>{earnedAt} 获得</small> : <small>{rule.description}（{progress}/{rule.target}）</small>}
      </article>
    })}
  </div>
}

function CloudSyncPanel({ account, busy, message, syncedAt, onSignOut, onSyncNow }: { account: CloudAccount | null; busy: boolean; message: string; syncedAt: string; onSignOut: () => void; onSyncNow: () => void }) {
  return <section className="cloud-sync"><p className="eyebrow">账号与同步</p>{!account ? <p className="cloud-hint">正在确认当前账号的云端状态...</p> : <div className="cloud-status"><p><strong>{account.email}</strong></p>{syncedAt && <small>上次同步：{syncedAt}</small>}{message && <p className="cloud-message">{message}</p>}<div className="cloud-actions"><button className="primary compact-static" onClick={onSyncNow} disabled={busy}>{busy ? '同步中...' : '立即同步'}</button><button type="button" className="text-action" onClick={onSignOut}>退出账号</button></div><p className="cloud-hint">同一时间在一台设备上编辑即可；两台设备都改过时，以最后保存的一端为准。</p></div>}</section>
}

function Community({ userId, view, profile, posts, onAdd, onLike, onComment, onViewChange, onEditProfile, badgeWall, cloudPanel }: { userId: string; view: 'feed' | 'profile'; profile: UserProfile; posts: Post[]; onAdd: () => void; onLike: (id: string) => void; onComment: (id: string, comment: string) => void; onViewChange: (view: 'feed' | 'profile') => void; onEditProfile: () => void; badgeWall: ReactNode; cloudPanel: ReactNode }) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const myPosts = posts.filter(post => post.userId === userId)
  if (view === 'profile') return <><section className="profile-page"><button className="profile-nav-button back-button" onClick={() => onViewChange('feed')}>返回社区</button><button className="profile-nav-button edit-profile-button" onClick={onEditProfile}>编辑资料</button><div className="profile-avatar">{profile.avatarImage ? <img src={profile.avatarImage} alt="我的头像" /> : profile.avatarLabel}</div><p className="eyebrow">个人主页</p><h1>{profile.nickname}的创作角落</h1><p className="profile-note">资料已绑定当前账号，并同步到云端。</p>{badgeWall}{cloudPanel}</section><section className="section"><p className="eyebrow">我的发帖</p>{myPosts.length ? myPosts.map(post => <article className="post mine" key={post.id}><p className="post-content">{post.content}</p><small>{formatPostTime(post.createdAt)} · {post.likes} 次喜欢</small></article>) : <p className="empty">你还没有发布内容。去社区说说正在经历的创作吧。</p>}</section></>
  return <><section className="page-head community-head"><p className="eyebrow">创作者社区</p><h1>说说你正在<br />经历的创作。</h1><div className="community-actions"><button className="profile-nav-button" onClick={() => onViewChange('profile')}>我的</button><button className="primary compact" onClick={onAdd}>发布</button></div></section><div className="post-list">{posts.map(post => { const isMine = post.userId === userId; const author = isMine ? profile.nickname : post.author; const avatar = isMine ? profile.avatarLabel : post.avatar; return <article className="post" key={post.id}><div className="post-author"><span className="avatar">{avatar}</span><div><strong>{author}</strong><small>{formatPostTime(post.createdAt)}</small></div></div><p className="post-content">{post.content}</p>{post.image && <img className="post-image" src={post.image} alt={post.imageCaption || '社区图片'} />}{!post.image && post.imageCaption && <div className="post-image">{post.imageCaption}</div>}<div className="post-actions"><button className={post.liked ? 'liked' : ''} onClick={() => onLike(post.id)}>喜欢 {post.likes}</button><button onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}>回应 {post.comments.length}</button></div>{replyingTo === post.id && <form className="reply-form" onSubmit={event => { event.preventDefault(); onComment(post.id, draft.trim()); setDraft(''); setReplyingTo(null) }}><input value={draft} onChange={event => setDraft(event.target.value)} placeholder="写下你的回应" autoFocus /><button disabled={!draft.trim()}>发送</button></form>}{post.comments.slice(-2).map((comment, index) => <p className="comment" key={index}>{comment}</p>)}</article> })}</div></>
}

function WorkForm({ onSave }: { onSave: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) { return <form className="entry-form" onSubmit={onSave}><label>标题<input name="title" required placeholder="这条作品叫什么？" /></label><div className="two-columns"><label>平台<select name="platform" defaultValue="小红书"><option>抖音</option><option>小红书</option><option>B站</option><option>视频号</option></select></label><label>发布时间<input name="publishedAt" type="date" defaultValue={localDateString(new Date())} /></label></div><div className="two-columns"><label>观看/阅读<input name="plays" type="number" min="0" placeholder="0" /></label><label>点赞<input name="likes" type="number" min="0" placeholder="0" /></label></div><div className="two-columns"><label>评论<input name="comments" type="number" min="0" placeholder="0" /></label><label>收藏<input name="favorites" type="number" min="0" placeholder="0" /></label></div><label>分享<input name="shares" type="number" min="0" placeholder="0" /></label><label>封面印象<input name="cover" placeholder="例如：窗边、晚餐、街道" /></label><label>上传封面<input name="coverImage" type="file" accept="image/*" /></label><label>回忆画面（图片或视频，可多选）<input name="recapMedia" type="file" accept="image/*,video/*" multiple /></label><p className="form-hint">视频会从多个中段时间点采样，自动跳过过暗、低信息和相似画面，只保存用于回忆的压缩截图。</p><label>此刻的感受<select name="mood" defaultValue="平静"><option>雀跃</option><option>平静</option><option>疲惫</option><option>骄傲</option></select></label><label>作品便签<textarea name="note" placeholder="不必写得漂亮，留下当时的自己就好。" /></label><button className="primary" type="submit">保存作品</button></form> }

function PostForm({ onSave }: { onSave: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) { return <form className="entry-form" onSubmit={onSave}><label>想说的话<textarea name="content" required placeholder="只支持普通文字。" /></label><label>上传图片<input name="image" type="file" accept="image/*" /></label><label>图片说明<input name="imageCaption" placeholder="例如：我的工作台" /></label><button className="primary" type="submit">发布</button></form> }

function ProfileForm({ profile, onSave }: { profile: UserProfile; onSave: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) { return <form className="entry-form" onSubmit={onSave}><label>昵称<input name="nickname" defaultValue={profile.nickname} maxLength={18} required /></label><label>头像图片<input name="avatarImage" type="file" accept="image/*" /></label><p className="form-hint">图片会在当前设备压缩后保存。云端同步将在账号系统接入后启用。</p><button className="primary" type="submit">保存资料</button></form> }

function FeedbackForm({ onSave }: { onSave: (event: FormEvent<HTMLFormElement>) => void }) { return <form className="entry-form" onSubmit={onSave}><label>这是怎样的时刻？<select name="type" defaultValue="自我认可"><option>点赞突破</option><option>暖心评论</option><option>被转发</option><option>自我认可</option></select></label><label>记下它<textarea name="content" required autoFocus placeholder="例如：有人说这条内容让她重新振作起来。" /></label><p className="form-hint">它会出现在这条作品的珍藏反馈和最近七天回看里。</p><button className="primary" type="submit">保存时刻</button></form> }

function WorkDetail({ work, feedback, onClose, onSaveNote, onFeedback }: { work: Work; feedback: FeedbackEvent[]; onClose: () => void; onSaveNote: (id: string, note: string) => void; onFeedback: () => void }) { const [note, setNote] = useState(work.note); return <section className="work-detail-page"><button className="back-link" onClick={onClose}>返回</button><div className={`detail-cover cover-${work.id.slice(-1)}`}>{work.coverImage ? <img src={work.coverImage} alt={`${work.title}封面`} /> : <span>{work.cover}</span>}</div><p className="eyebrow">{work.platform} · 发布于 {work.publishedAt}</p><h1>{work.title}</h1><p className="detail-mood">那时的你：{work.mood}</p><div className="detail-metrics"><span>{number(work.plays)}<small>观看</small></span><span>{number(work.likes)}<small>喜欢</small></span><span>{work.comments}<small>评论</small></span><span>{number(work.favorites)}<small>收藏</small></span><span>{work.shares}<small>分享</small></span></div><label className="note-field">生活便签<textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => onSaveNote(work.id, note)} /></label><div className="detail-head"><p className="eyebrow">珍藏反馈</p><button onClick={onFeedback}>记录时刻</button></div>{feedback.length ? feedback.map(item => <article className="moment" key={item.id}><span>{item.type}</span><p>{item.content}</p></article>) : <p className="empty">留下一句评论或一个感受，它会在回忆里出现。</p>}</section> }

function WeeklyRecap({ works, feedback, onClose }: { works: Work[]; feedback: FeedbackEvent[]; onClose: () => void }) {
  const [page, setPage] = useState(0)
  const recentWindow = getRecentSevenDays()
  const recent = works.filter(work => isInRecentSevenDays(work.publishedAt, recentWindow)).slice(0, 3)
  const recentFeedback = feedback.filter(item => isInRecentSevenDays(item.createdAt, recentWindow))
  const favorite = recent.slice().sort((a, b) => b.likes - a.likes)[0]
  const recapMedia = favorite?.recapMedia?.slice(0, 3) ?? []
  const slides = recent.length ? [
    <><p className="eyebrow">{recapCopy.opening.eyebrow}</p><h1>{recapCopy.opening.title.split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h1><strong className="recap-number">{recent.length}</strong><p>{recapCopy.opening.suffix}</p></>,
    <><p className="eyebrow">{recapCopy.favorite.eyebrow}</p><h1>《{favorite?.title ?? '你的作品'}》</h1><strong className="recap-number">{number(favorite?.likes ?? 0)}</strong><p>{recapCopy.favorite.suffix}</p></>,
    ...(recapMedia.length ? [<><p className="eyebrow">{recapCopy.media.eyebrow}</p><h1>{recapCopy.media.title.split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h1><div className="recap-media-strip">{recapMedia.map(frame => <img key={frame.id} src={frame.dataUrl} alt={`来自${frame.sourceName}的回忆画面`} />)}</div><p>{recapCopy.media.suffix}</p></>] : []),
    <><p className="eyebrow">{recapCopy.note.eyebrow}</p><blockquote className="recap-quote">“{recent[0]?.note || '把这一周的感受，留给下一次自己。'}”</blockquote><p>{recapCopy.note.suffix}</p></>,
    <><p className="eyebrow">{recapCopy.feedback.eyebrow}</p><h1>本周有 {recentFeedback.length} 个<br />值得收藏的时刻。</h1><p>{recentFeedback[0]?.content || recapCopy.feedback.suffix}</p></>,
  ] : [
    <><p className="eyebrow">{recapCopy.empty.eyebrow}</p><h1>{recapCopy.empty.title.split('\n').map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h1><p>{recapCopy.empty.body}</p></>,
  ]
  return <section className="weekly-recap"><button className="back-link" onClick={onClose}>返回回忆</button><div className={`recap-slide recap-slide-${page}`} key={page}>{slides[page]}</div><div className="recap-progress">{slides.map((_, index) => <span className={index === page ? 'active' : ''} key={index} />)}</div><button className="primary recap-next" onClick={() => { if (slides.length === 1) { onClose() } else { setPage(page === slides.length - 1 ? 0 : page + 1) } }}>{slides.length === 1 ? '返回回忆' : page === slides.length - 1 ? '重新播放' : '下一页'}</button></section>
}
