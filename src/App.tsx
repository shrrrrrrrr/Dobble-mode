import { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import type { FeedbackEvent, Platform, Post, ProfessionalTab, Tab, UserProfile, Work } from './types'
import { compressImage } from './utils/image'
import { buildCalendarArt } from './utils/calendarArt'
import { AppSession, getSession, registerLocalAccount, signInLocalAccount, signOut } from './services/auth'
import { importLegacyV1Data, markLegacyDismissed, markLegacyImported, shouldOfferLegacyImport } from './services/legacyImport'
import { emptyAppState, LocalAppRepository, normalizeAppState, type AppState } from './services/repository'
import { cloudEnabled, cloudSignIn, cloudSignOut, cloudSignUp, fetchCloudState, getCloudAccount, pushCloudState, type CloudAccount } from './services/cloud'
import { badgeRules, evaluateBadges } from './services/badges'
import { seasonPacks, themePacks, type SeasonId, type ThemeId } from './theme'
import { ProfessionalMode } from './professional/ProfessionalMode'
import { Modal } from './components/Modal'

function storageErrorMessage(error: unknown) {
  if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
    return '设备存储空间已满。请删除不再需要的大图后再试。'
  }
  return error instanceof Error ? error.message : '保存失败，请稍后再试。'
}

const number = (value: number) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

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

const today = localDateString(new Date())
const todayLabel = (() => {
  const date = new Date()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日，星期${weekdays[date.getDay()]}`
})()
function formatClock(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date)
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
  const [clock, setClock] = useState(() => new Date())
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
  const [notice, setNotice] = useState('')
  const [feedbackWorkId, setFeedbackWorkId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('我在。想看看你最近留下了什么，还是聊聊一条作品？')
  const [cloudAccount, setCloudAccount] = useState<CloudAccount | null>(null)
  const [cloudMessage, setCloudMessage] = useState('')
  const [cloudBusy, setCloudBusy] = useState(false)
  const [cloudSyncedAt, setCloudSyncedAt] = useState('')
  const cloudPushTimer = useRef<number | null>(null)
  const companionRef = useRef<HTMLButtonElement | null>(null)
  const assistantPanelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!session) {
      setStateUserId(null)
      setLegacyImportOpen(false)
      return
    }
    setStateUserId(null)
    if (!repository) return
    repository.load().then(nextState => {
      setState(nextState)
      setStateUserId(session.userId)
      setLegacyImportOpen(shouldOfferLegacyImport(session.userId, nextState))
    })
  }, [session, repository])
  useEffect(() => {
    if (!session || !repository || stateUserId !== session.userId) return
    repository.save(state).then(() => setNotice('')).catch(error => setNotice(storageErrorMessage(error)))
    if (cloudEnabled && cloudAccount) {
      if (cloudPushTimer.current) window.clearTimeout(cloudPushTimer.current)
      cloudPushTimer.current = window.setTimeout(() => {
        pushCloudState(state).then(result => {
          if (result.ok) setCloudSyncedAt(new Date().toLocaleTimeString('zh-CN'))
        })
      }, 2000)
    }
  }, [repository, session, state, stateUserId])
  useEffect(() => { document.body.dataset.theme = state.theme }, [state.theme])
  useEffect(() => { document.body.dataset.mode = state.mode }, [state.mode])
  useEffect(() => { const timer = window.setInterval(() => setClock(new Date()), 1000); return () => window.clearInterval(timer) }, [])
  useEffect(() => { getSession().then(savedSession => { setSession(savedSession); setSessionReady(true) }) }, [])
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
    getCloudAccount().then(account => setCloudAccount(account))
  }, [])

  useEffect(() => {
    if (!cloudEnabled || !cloudAccount || !session || !repository || stateUserId !== session.userId) return
    let cancelled = false
    ;(async () => {
      setCloudBusy(true)
      try {
        const snap = await fetchCloudState()
        if (cancelled) return
        const localAt = state.updatedAt ?? ''
        if (snap && snap.updatedAt > localAt) {
          const next = normalizeAppState(session.userId, snap.state as Partial<AppState>)
          setState(next)
          await repository.save(next)
          setCloudSyncedAt(new Date().toLocaleString('zh-CN'))
          setCloudMessage('已从云端同步最新数据。')
        } else if (!snap || state.works.length + state.feedback.length + state.posts.length > 0) {
          await pushCloudState(state)
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
      if (snap && snap.updatedAt > (state.updatedAt ?? '')) {
        if (session) {
          const next = normalizeAppState(session.userId, snap.state as Partial<AppState>)
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

  async function handleCloudSignOut() {
    await cloudSignOut()
    setCloudAccount(null)
    setCloudMessage('')
    setCloudSyncedAt('')
  }

  useEffect(() => {
    if (!session || stateUserId !== session.userId) return
    const next = evaluateBadges(state)
    if (Object.keys(next).length !== Object.keys(state.badges).length) {
      setState(current => ({ ...current, badges: next }))
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

  function changeTheme(nextTheme: ThemeId) {
    const pack = themePacks.find(item => item.id === nextTheme)
    if (pack?.available) setState(current => ({
      ...current,
      theme: nextTheme,
      themeByMode: { ...current.themeByMode, [current.mode]: nextTheme },
    }))
  }

  function switchMode(nextMode: 'life' | 'professional') {
    setState(current => ({ ...current, mode: nextMode, theme: current.themeByMode[nextMode] }))
    setSelectedWork(null)
    setSelectedRecap(false)
    setAssistantPinned(false)
    setAssistantHovered(false)
  }

  function openMyProfile() {
    setState(current => current.mode === 'life' ? current : ({ ...current, mode: 'life', theme: current.themeByMode.life }))
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
      const coverImage = imageFile instanceof File && imageFile.size > 0 ? await compressImage(imageFile) : undefined
      const newWork: Work = {
        id: crypto.randomUUID(), title: String(form.get('title')).trim(), platform: form.get('platform') as Platform,
        publishedAt: String(form.get('publishedAt')), cover: String(form.get('cover')).trim() || '新作品',
        plays: Number(form.get('plays')) || 0, likes: Number(form.get('likes')) || 0,
        comments: Number(form.get('comments')) || 0, favorites: Number(form.get('favorites')) || 0,
        shares: Number(form.get('shares')) || 0, note: String(form.get('note')).trim(), mood: form.get('mood') as Work['mood'], coverImage,
      }
      setState((current: typeof state) => ({ ...current, works: [newWork, ...current.works] }))
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
      setState((current: typeof state) => ({ ...current, posts: [post, ...current.posts] }))
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
      setState((current: typeof state) => ({ ...current, profile }))
      setShowProfileForm(false)
      setNotice('')
    } catch (error) {
      setNotice(`资料保存失败：${storageErrorMessage(error)}`)
    }
  }

  function updateNote(workId: string, note: string) {
    setState((current: typeof state) => ({ ...current, works: current.works.map((work: Work) => work.id === workId ? { ...work, note } : work) }))
  }

  function saveFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!feedbackWorkId) return
    const form = new FormData(event.currentTarget)
    const content = String(form.get('content')).trim()
    if (!content) return
    const feedback: FeedbackEvent = { id: crypto.randomUUID(), workId: feedbackWorkId, type: form.get('type') as FeedbackEvent['type'], content, createdAt: today }
    setState((current: typeof state) => ({ ...current, feedback: [feedback, ...current.feedback] }))
    setFeedbackWorkId(null)
    setNotice('')
  }

  function toggleLike(postId: string) {
    setState((current: typeof state) => ({ ...current, posts: current.posts.map((post: Post) => post.id === postId ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) } : post) }))
  }

  function addComment(postId: string, comment: string) {
    if (!comment) return
    setState((current: typeof state) => ({ ...current, posts: current.posts.map((post: Post) => post.id === postId ? { ...post, comments: [...post.comments, comment] } : post) }))
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
    await signOut()
    setSession(null)
  }

  function acceptLegacyImport() {
    if (!session) return
    const legacy = importLegacyV1Data()
    if (!legacy) {
      setLegacyImportOpen(false)
      return
    }
    setState(normalizeAppState(session.userId, legacy))
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
  if (!session) return <LocalAuthPage onAuthenticated={setSession} />

  return <main className="app-shell">
    <PixelBackground theme={theme} season={season} />
    <section className="mobile-frame">
      <header className="topbar"><button className="brand tile-interactive" onClick={() => { if (state.mode === 'professional') { setProTab('topics') } else { setTab('home'); setCommunityView('feed') } setAssistantPinned(false) }} aria-label="留白，返回首页">留白</button><button className={`mode-switch ${state.mode}`} role="switch" aria-checked={state.mode === 'professional'} aria-label={`切换到${state.mode === 'life' ? '专业' : '生活'}模式`} onClick={() => switchMode(state.mode === 'life' ? 'professional' : 'life')}><span className="mode-window" aria-hidden="true"><span className="mode-life-scene"><span className="cornflower">✿</span><i>♫</i><b>♪</b><em /></span><span className="mode-night-scene"><span className="mode-stars"><i>✦</i><i>·</i><i>✧</i></span><img src="/assets/mode/professional-lamp.png" alt="" /></span></span><span className="mode-label">{state.mode === 'life' ? '生活' : '专业'}</span></button><div className="theme-switcher" aria-label="主题选择"><button className={`theme-dot ${theme === 'mint' ? 'active' : ''}`} onClick={() => { changeTheme('mint'); setAssistantPinned(false) }} title="默认主题" aria-label="默认主题" /><button className={`theme-dot cream ${theme === 'cream' ? 'active' : ''}`} onClick={() => { changeTheme('cream'); setAssistantPinned(false) }} title="北航四季" aria-label="北航四季" /><button className={`theme-dot night ${theme === 'night' ? 'active' : ''}`} onClick={() => { changeTheme('night'); setAssistantPinned(false) }} title="樱花夜" aria-label="樱花夜" /></div>{theme === 'cream' && <div className="season-switcher" aria-label="北航四季选择">{seasonPacks.map(pack => <button key={pack.id} className={season === pack.id ? 'active' : ''} onClick={() => { setSeason(pack.id); setAssistantPinned(false) }} style={{ '--season-accent': pack.accent } as React.CSSProperties}>{pack.name.split(' · ')[0]}</button>)}</div>}<div className="account-summary"><button className="account-profile" onClick={openMyProfile} aria-label="打开我的主页"><span>{session.username}</span><i aria-hidden="true">我</i></button><button className="sign-out" onClick={() => { handleSignOut(); setAssistantPinned(false) }}>退出</button></div></header>
      <div className="content" onClick={event => { if (assistantPinned && event.target === event.currentTarget) setAssistantPinned(false) }}>
        {notice && <div className="app-notice" role="alert"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="关闭提示">关闭</button></div>}
        {state.mode === 'professional' ? <ProfessionalMode tab={proTab} onTabChange={setProTab} works={state.works} topics={state.topics} templates={state.scoreTemplates} records={state.scoreRecords} reviews={state.reviews} onTopicsChange={topics => setState(current => ({ ...current, topics }))} onTemplatesChange={scoreTemplates => setState(current => ({ ...current, scoreTemplates }))} onRecordsChange={scoreRecords => setState(current => ({ ...current, scoreRecords }))} onReviewsChange={reviews => setState(current => ({ ...current, reviews }))} /> : selectedRecap ? <WeeklyRecap works={recentWorks} feedback={recentFeedback} onClose={() => setSelectedRecap(false)} /> : selectedWork ? <WorkDetail work={selectedWork} feedback={state.feedback.filter((item: FeedbackEvent) => item.workId === selectedWork.id)} onClose={() => setSelectedWork(null)} onSaveNote={updateNote} onFeedback={() => setFeedbackWorkId(selectedWork.id)} /> : <>
          {tab === 'home' && <Home works={recentWorks} feedback={recentFeedback} dateLabel={todayLabel} clockText={formatClock(clock)} clock={clock} onAdd={() => setShowWorkForm(true)} onOpenWork={setSelectedWork} onNavigate={nextTab => { setTab(nextTab); if (nextTab === 'community') setCommunityView('feed') }} />}
          {tab === 'works' && <Works works={state.works} onAdd={() => setShowWorkForm(true)} onOpenWork={setSelectedWork} />}
          {tab === 'memories' && <Memories memories={memories} works={recentWorks} onOpenRecap={() => setSelectedRecap(true)} />}
          {tab === 'community' && <Community userId={session.userId} view={communityView} profile={state.profile} posts={state.posts} onAdd={() => setShowPostForm(true)} onLike={toggleLike} onComment={addComment} onViewChange={setCommunityView} onEditProfile={() => setShowProfileForm(true)} badgeWall={<BadgeWall badges={state.badges} state={state} />} cloudPanel={<CloudSyncPanel account={cloudAccount} busy={cloudBusy} message={cloudMessage} syncedAt={cloudSyncedAt} onSignIn={async (email, password) => { const result = await cloudSignIn(email, password); if (result.ok) { setCloudAccount(result.data); setCloudMessage('') } return result.ok ? null : result.error }} onSignUp={async (email, password) => { const result = await cloudSignUp(email, password); if (result.ok) { setCloudAccount(result.data); setCloudMessage('') } return result.ok ? null : result.error }} onSignOut={handleCloudSignOut} onSyncNow={syncCloudNow} />} />}
        </>}
      </div>
      {!selectedWork && !selectedRecap && (state.mode === 'professional'
        ? <nav className="bottom-nav pro-nav">{proNav.map(item => <button key={item.id} className={proTab === item.id ? 'active' : ''} onClick={() => setProTab(item.id)}><span className="nav-mark" />{item.label}</button>)}</nav>
        : <nav className="bottom-nav">{nav.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); if (item.id === 'community') setCommunityView('feed') }}><span className="nav-mark" />{item.label}</button>)}</nav>)}
    </section>
    {state.mode === 'life' && <button ref={companionRef} className={`companion ${assistantPinned ? 'pinned' : ''}`} onPointerEnter={() => setAssistantHovered(true)} onPointerLeave={() => setAssistantHovered(false)} onClick={() => setAssistantPinned(open => !open)} aria-label="打开或关闭创作陪伴"><img src={`/assets/companions/${theme}-companion.png`} alt="" /><span>留</span></button>}
    {state.mode === 'life' && (assistantPinned || assistantHovered) && <div ref={assistantPanelRef} className="assistant-panel" onPointerEnter={() => setAssistantHovered(true)} onPointerLeave={() => setAssistantHovered(false)}><p className="eyebrow">创作陪伴</p><h2>今天也在记录。</h2><p className="assistant-answer">{answer}</p><form onSubmit={askAssistant}><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="问问我关于你的创作" /><button>发送</button></form></div>}
    {showWorkForm && <Modal title="记录一条作品" onClose={() => setShowWorkForm(false)}><WorkForm onSave={saveWork} /></Modal>}
    {showPostForm && <Modal title="发布到社区" onClose={() => setShowPostForm(false)}><PostForm onSave={savePost} /></Modal>}
    {showProfileForm && <Modal title="编辑个人资料" onClose={() => setShowProfileForm(false)}><ProfileForm profile={state.profile} onSave={saveProfile} /></Modal>}
    {feedbackWorkId && <Modal title="记录一个珍藏时刻" onClose={() => setFeedbackWorkId(null)}><FeedbackForm onSave={saveFeedback} /></Modal>}
    {legacyImportOpen && <Modal title="发现旧版数据" onClose={dismissLegacyImport}><div className="legacy-import"><p>检测到这台设备上还有 V1.2 及以前的创作记录。要导入到当前账号吗？</p><p className="legacy-import-note">导入只会复制到当前账号，不会删除旧数据。如果跳过，之后不会再提示。</p><div className="legacy-import-actions"><button className="primary" onClick={acceptLegacyImport}>导入到当前账号</button><button className="text-action" onClick={dismissLegacyImport}>暂不导入</button></div></div></Modal>}
  </main>
}

function PixelBackground({ theme, season }: { theme: ThemeId; season: SeasonId }) {
  if (theme === 'cream') return <PixelatedImageBackground source={seasonPacks.find(item => item.id === season)?.image ?? ''} pixelSize={3} className={`season-background season-${season}`} />
  if (theme === 'night') return <PixelatedImageBackground source="/assets/sakura/background.jpg" pixelSize={5} className="sakura-background" />
  const pack = themePacks.find(item => item.id === theme && item.available) ?? themePacks[0]
  if (!pack.backgroundVideo) return null
  return <PixelatedVideoBackground source={pack.backgroundVideo} poster={pack.poster} />
}

function PixelatedImageBackground({ source, pixelSize, className }: { source: string; pixelSize: number; className: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !source) return
    const context = canvas.getContext('2d')
    const image = new Image()
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
      context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
    }
    image.onload = draw
    image.src = source
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [source, pixelSize])
  return <canvas ref={canvasRef} className={`pixel-canvas-bg ${className}`} aria-hidden="true" />
}

function PixelatedVideoBackground({ source, poster }: { source: string; poster?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    let frame = 0
    const draw = () => {
      const context = canvas.getContext('2d')
      const width = Math.max(1, Math.ceil(window.innerWidth / 5))
      const height = Math.max(1, Math.ceil(window.innerHeight / 5))
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      if (context && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        context.imageSmoothingEnabled = false
        const scale = Math.max(width / video.videoWidth, height / video.videoHeight)
        const drawWidth = video.videoWidth * scale
        const drawHeight = video.videoHeight * scale
        context.drawImage(video, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
      }
      frame = window.requestAnimationFrame(draw)
    }
    video.play().catch(() => undefined)
    draw()
    return () => window.cancelAnimationFrame(frame)
  }, [source])
  return <><canvas ref={canvasRef} className="pixel-canvas-bg pixel-video-bg visible" aria-hidden="true" /><video ref={videoRef} className="pixel-video-source" autoPlay muted loop playsInline poster={poster}><source src={source} type="video/webm" /></video></>
}

function LocalAuthPage({ onAuthenticated }: { onAuthenticated: (session: AppSession) => void }) {
  const [registering, setRegistering] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const nextSession = registering ? await registerLocalAccount(username, password) : await signInLocalAccount(username, password)
      onAuthenticated(nextSession)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '操作失败，请重新尝试。')
    } finally { setLoading(false) }
  }

  return <main className="auth-shell"><section className="auth-card"><div className="auth-sticker">留</div><p className="eyebrow">创作生活</p><h1>{registering ? <>创建你的<br />创作桌面。</> : <>先把你自己<br />带进来。</>}</h1><p className="auth-copy">账号仅保存在当前设备。作品、回忆和社区记录会按账号分别保存。</p><form className="auth-form" onSubmit={submit}><label>账号<input value={username} onChange={event => setUsername(event.target.value)} placeholder="3–20 位字母、数字、下划线或短横线" maxLength={20} required autoFocus /></label><label>密码<input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="至少 6 位" minLength={6} required /></label><button className="primary" disabled={loading}>{loading ? '处理中...' : registering ? '创建并进入' : '进入创作桌面'}</button></form><button className="text-action auth-switch" onClick={() => { setRegistering(value => !value); setMessage('') }}>{registering ? '已有账号？直接登录' : '第一次来？创建本地账号'}</button><p className="auth-message">{message}</p><p className="auth-preview">当前为本地账号体验，不连接云端。若设备上有旧版数据，登录后可选择导入。</p></section></main>
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

function Home({ works, feedback, dateLabel, clockText, clock, onAdd, onOpenWork, onNavigate }: { works: Work[]; feedback: FeedbackEvent[]; dateLabel: string; clockText: string; clock: Date; onAdd: () => void; onOpenWork: (work: Work) => void; onNavigate: (tab: Tab) => void }) {
  const now = new Date()
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
      <section className="hero studio-hero"><p className="eyebrow">{dateLabel}</p><h1>把创作过成<br />自己的生活。</h1><p>不用急着解释数据，先把每一次认真留下来。</p><button className="primary tile-interactive" onClick={onAdd}>记录新作品</button></section>
      {latest && <button className="latest-tile tile-interactive" onClick={() => onOpenWork(latest)}><span className="tile-label">最近发布</span><WorkCard work={latest} /><span className="tile-hint">查看这条作品</span></button>}
      <section className="moments-board"><p className="eyebrow">最近七天值得记住</p>{feedback.length ? feedback.slice(0, 2).map(item => <article className="moment tile-interactive" key={item.id}><span>{item.type}</span><p>{item.content}</p></article>) : <p className="empty">这七天还没有收藏的时刻。记录一条作品，或给自己留句话。</p>}</section>
    </section>
    <aside className="dashboard-rail">
      <article className="clock-widget tile-interactive" aria-label={`像素时钟 ${clockText}`}><span>创作时间</span><strong className="pixel-clock" style={{ '--hour-angle': `${hourAngle}deg`, '--minute-angle': `${minuteAngle}deg`, '--second-angle': `${secondAngle}deg` } as React.CSSProperties}><i className="clock-hour" /><i className="clock-minute" /><i className="clock-second" /><b className="clock-center" /></strong><small>留给自己的十分钟</small></article>
      <article className="calendar-widget tile-interactive" aria-label={dateLabel}>{calendarArt ? <img src={calendarArt} alt={`台历，今天是${dateLabel}`} /> : null}</article>
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

function CloudSyncPanel({ account, busy, message, syncedAt, onSignIn, onSignUp, onSignOut, onSyncNow }: { account: CloudAccount | null; busy: boolean; message: string; syncedAt: string; onSignIn: (email: string, password: string) => Promise<string | null>; onSignUp: (email: string, password: string) => Promise<string | null>; onSignOut: () => void; onSyncNow: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [registering, setRegistering] = useState(false)
  const [formMessage, setFormMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormMessage('')
    const error = registering ? await onSignUp(email.trim(), password) : await onSignIn(email.trim(), password)
    if (error) setFormMessage(error)
    else { setPassword(''); setFormMessage('') }
    setSubmitting(false)
  }

  return <section className="cloud-sync">
    <p className="eyebrow">云同步</p>
    {!cloudEnabled && <p className="cloud-hint">云端未配置。在项目根目录创建 .env.local 并填入 Supabase 地址与 Anon Key 后，可开启跨设备同步。</p>}
    {cloudEnabled && !account && <form className="cloud-form" onSubmit={submit}>
      <p className="cloud-hint">云账号用于跨设备同步，与本地登录账号相互独立。使用邮箱和密码创建或登录。</p>
      <label>邮箱<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required autoComplete="email" /></label>
      <label>密码<input type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="至少 6 位" minLength={6} required autoComplete={registering ? 'new-password' : 'current-password'} /></label>
      <div className="cloud-actions">
        <button className="primary compact-static" type="submit" disabled={submitting}>{submitting ? '处理中...' : registering ? '创建云账号' : '登录云账号'}</button>
        <button type="button" className="text-action" onClick={() => { setRegistering(value => !value); setFormMessage('') }}>{registering ? '已有云账号？直接登录' : '第一次使用？创建云账号'}</button>
      </div>
      {formMessage && <p className="cloud-message">{formMessage}</p>}
    </form>}
    {cloudEnabled && account && <div className="cloud-status">
      <p><strong>{account.email}</strong></p>
      {syncedAt && <small>上次同步：{syncedAt}</small>}
      {message && <p className="cloud-message">{message}</p>}
      <div className="cloud-actions">
        <button className="primary compact-static" onClick={onSyncNow} disabled={busy}>{busy ? '同步中...' : '立即同步'}</button>
        <button type="button" className="text-action" onClick={onSignOut}>退出云账号</button>
      </div>
      <p className="cloud-hint">同一时间在一台设备上编辑即可；两台设备都改过时，以最后保存的一端为准。</p>
    </div>}
  </section>
}

function Community({ userId, view, profile, posts, onAdd, onLike, onComment, onViewChange, onEditProfile, badgeWall, cloudPanel }: { userId: string; view: 'feed' | 'profile'; profile: UserProfile; posts: Post[]; onAdd: () => void; onLike: (id: string) => void; onComment: (id: string, comment: string) => void; onViewChange: (view: 'feed' | 'profile') => void; onEditProfile: () => void; badgeWall: ReactNode; cloudPanel: ReactNode }) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const myPosts = posts.filter(post => post.userId === userId)
  if (view === 'profile') return <><section className="profile-page"><button className="profile-nav-button back-button" onClick={() => onViewChange('feed')}>返回社区</button><button className="profile-nav-button edit-profile-button" onClick={onEditProfile}>编辑资料</button><div className="profile-avatar">{profile.avatarImage ? <img src={profile.avatarImage} alt="我的头像" /> : profile.avatarLabel}</div><p className="eyebrow">个人主页</p><h1>{profile.nickname}的创作角落</h1><p className="profile-note">资料已保存在当前设备；接入账号后会同步至云端。</p>{badgeWall}{cloudPanel}</section><section className="section"><p className="eyebrow">我的发帖</p>{myPosts.length ? myPosts.map(post => <article className="post mine" key={post.id}><p className="post-content">{post.content}</p><small>{formatPostTime(post.createdAt)} · {post.likes} 次喜欢</small></article>) : <p className="empty">你还没有发布内容。去社区说说正在经历的创作吧。</p>}</section></>
  return <><section className="page-head community-head"><p className="eyebrow">创作者社区</p><h1>说说你正在<br />经历的创作。</h1><div className="community-actions"><button className="profile-nav-button" onClick={() => onViewChange('profile')}>我的</button><button className="primary compact" onClick={onAdd}>发布</button></div></section><div className="post-list">{posts.map(post => { const isMine = post.userId === userId; const author = isMine ? profile.nickname : post.author; const avatar = isMine ? profile.avatarLabel : post.avatar; return <article className="post" key={post.id}><div className="post-author"><span className="avatar">{avatar}</span><div><strong>{author}</strong><small>{formatPostTime(post.createdAt)}</small></div></div><p className="post-content">{post.content}</p>{post.image && <img className="post-image" src={post.image} alt={post.imageCaption || '社区图片'} />}{!post.image && post.imageCaption && <div className="post-image">{post.imageCaption}</div>}<div className="post-actions"><button className={post.liked ? 'liked' : ''} onClick={() => onLike(post.id)}>喜欢 {post.likes}</button><button onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}>回应 {post.comments.length}</button></div>{replyingTo === post.id && <form className="reply-form" onSubmit={event => { event.preventDefault(); onComment(post.id, draft.trim()); setDraft(''); setReplyingTo(null) }}><input value={draft} onChange={event => setDraft(event.target.value)} placeholder="写下你的回应" autoFocus /><button disabled={!draft.trim()}>发送</button></form>}{post.comments.slice(-2).map((comment, index) => <p className="comment" key={index}>{comment}</p>)}</article> })}</div></>
}

function WorkForm({ onSave }: { onSave: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) { return <form className="entry-form" onSubmit={onSave}><label>标题<input name="title" required placeholder="这条作品叫什么？" /></label><div className="two-columns"><label>平台<select name="platform" defaultValue="小红书"><option>抖音</option><option>小红书</option><option>B站</option><option>视频号</option></select></label><label>发布时间<input name="publishedAt" type="date" defaultValue={today} /></label></div><div className="two-columns"><label>观看/阅读<input name="plays" type="number" min="0" placeholder="0" /></label><label>点赞<input name="likes" type="number" min="0" placeholder="0" /></label></div><div className="two-columns"><label>评论<input name="comments" type="number" min="0" placeholder="0" /></label><label>收藏<input name="favorites" type="number" min="0" placeholder="0" /></label></div><label>分享<input name="shares" type="number" min="0" placeholder="0" /></label><label>封面印象<input name="cover" placeholder="例如：窗边、晚餐、街道" /></label><label>上传封面<input name="coverImage" type="file" accept="image/*" /></label><label>此刻的感受<select name="mood" defaultValue="平静"><option>雀跃</option><option>平静</option><option>疲惫</option><option>骄傲</option></select></label><label>作品便签<textarea name="note" placeholder="不必写得漂亮，留下当时的自己就好。" /></label><button className="primary" type="submit">保存作品</button></form> }

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
  const slides = recent.length ? [
    <><p className="eyebrow">本周创作回看</p><h1>这七天，<br />你没有白过。</h1><strong className="recap-number">{recent.length}</strong><p>条作品被认真留了下来。</p></>,
    <><p className="eyebrow">被更多人看见</p><h1>《{favorite?.title ?? '你的作品'}》</h1><strong className="recap-number">{number(favorite?.likes ?? 0)}</strong><p>个喜欢，是这周最明亮的回应。</p></>,
    <><p className="eyebrow">你当时写下</p><blockquote className="recap-quote">“{recent[0]?.note || '把这一周的感受，留给下一次自己。'}”</blockquote><p>不止数据，你也记住了那个时刻的自己。</p></>,
    <><p className="eyebrow">收下这些声音</p><h1>本周有 {recentFeedback.length} 个<br />值得收藏的时刻。</h1><p>{recentFeedback[0]?.content || '下一周，也继续为自己留下一个时刻。'}</p></>,
  ] : [
    <><p className="eyebrow">本周创作回看</p><h1>最近七天，<br />还没有作品记录。</h1><p>下一次记录作品时，这里会帮你收起当时的感受、数据和回应。</p></>,
  ]
  return <section className="weekly-recap"><button className="back-link" onClick={onClose}>返回回忆</button><div className={`recap-slide recap-slide-${page}`} key={page}>{slides[page]}</div><div className="recap-progress">{slides.map((_, index) => <span className={index === page ? 'active' : ''} key={index} />)}</div><button className="primary recap-next" onClick={() => { if (slides.length === 1) { onClose() } else { setPage(page === slides.length - 1 ? 0 : page + 1) } }}>{slides.length === 1 ? '返回回忆' : page === slides.length - 1 ? '重新播放' : '下一页'}</button></section>
}
