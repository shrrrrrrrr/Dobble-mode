import { FormEvent, PointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { initialFeedback, initialPosts, initialProfile, initialWorks } from './data'
import type { FeedbackEvent, Platform, Post, Tab, UserProfile, Work } from './types'
import { compressImage } from './utils/image'
import { AppSession, authMode, getSession, requestEmailCode, signOut, verifyEmailCode } from './services/auth'

const storageKey = 'creator-life-v1'

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey)
    const parsed = saved ? JSON.parse(saved) : null
    return parsed ? { ...parsed, profile: parsed.profile ?? initialProfile } : { works: initialWorks, feedback: initialFeedback, posts: initialPosts, profile: initialProfile }
  } catch {
    return { works: initialWorks, feedback: initialFeedback, posts: initialPosts, profile: initialProfile }
  }
}

const number = (value: number) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
const today = new Date().toISOString().slice(0, 10)

export default function App() {
  const [state, setState] = useState(loadState)
  const [session, setSession] = useState<AppSession | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [tab, setTab] = useState<Tab>('home')
  const [showWorkForm, setShowWorkForm] = useState(false)
  const [showPostForm, setShowPostForm] = useState(false)
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [selectedWork, setSelectedWork] = useState<Work | null>(null)
  const [selectedRecap, setSelectedRecap] = useState(false)
  const [communityView, setCommunityView] = useState<'feed' | 'profile'>('feed')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantPos, setAssistantPos] = useState({ x: 0, y: 0 })
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('我在。想看看你最近留下了什么，还是聊聊一条作品？')
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number; minX: number; maxX: number; minY: number; maxY: number } | null>(null)
  const didDrag = useRef(false)
  const frameRef = useRef<HTMLElement | null>(null)

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(state)) }, [state])
  useEffect(() => { getSession().then(setSession).finally(() => setSessionReady(true)) }, [])

  const memories = useMemo(() => {
    const highlighted = state.works.slice().sort((a: Work, b: Work) => (b.likes + b.favorites) - (a.likes + a.favorites)).slice(0, 2)
    return highlighted.map((work: Work, index: number) => ({
      id: work.id,
      label: index === 0 ? '这个月被好好接住的一条作品' : '一段值得回头看的创作日常',
      title: work.title,
      detail: `${work.platform} · ${number(work.likes)} 个赞 · ${work.comments} 条留言`,
      note: work.note,
    }))
  }, [state.works])

  async function saveWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const imageFile = form.get('coverImage')
    const coverImage = imageFile instanceof File && imageFile.size > 0 ? await compressImage(imageFile) : undefined
    const newWork: Work = {
      id: crypto.randomUUID(), title: String(form.get('title')), platform: form.get('platform') as Platform,
      publishedAt: String(form.get('publishedAt')), cover: String(form.get('cover')) || '新作品',
      plays: Number(form.get('plays')) || 0, likes: Number(form.get('likes')) || 0,
      comments: Number(form.get('comments')) || 0, favorites: Number(form.get('favorites')) || 0,
      shares: Number(form.get('shares')) || 0, note: String(form.get('note')), mood: form.get('mood') as Work['mood'], coverImage,
    }
    setState((current: typeof state) => ({ ...current, works: [newWork, ...current.works] }))
    setShowWorkForm(false)
  }

  async function savePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const content = String(form.get('content')).trim()
    if (!content) return
    const imageFile = form.get('image')
    const image = imageFile instanceof File && imageFile.size > 0 ? await compressImage(imageFile) : undefined
    const post: Post = { id: crypto.randomUUID(), author: state.profile.nickname, avatar: state.profile.avatarLabel, content, image, imageCaption: String(form.get('imageCaption')).trim() || undefined, createdAt: '刚刚', likes: 0, liked: false, comments: [] }
    setState((current: typeof state) => ({ ...current, posts: [post, ...current.posts] }))
    setShowPostForm(false)
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const nickname = String(form.get('nickname')).trim() || '我'
    const avatarFile = form.get('avatarImage')
    const avatarImage = avatarFile instanceof File && avatarFile.size > 0 ? await compressImage(avatarFile, 480, 0.88) : state.profile.avatarImage
    const profile: UserProfile = { nickname, avatarLabel: nickname.slice(0, 1), avatarImage }
    setState((current: typeof state) => ({ ...current, profile }))
    setShowProfileForm(false)
  }

  function updateNote(workId: string, note: string) {
    setState((current: typeof state) => ({ ...current, works: current.works.map((work: Work) => work.id === workId ? { ...work, note } : work) }))
  }

  function addFeedback(workId: string) {
    const content = window.prompt('记下这个时刻：')?.trim()
    if (!content) return
    const feedback: FeedbackEvent = { id: crypto.randomUUID(), workId, type: '自我认可', content, createdAt: today }
    setState((current: typeof state) => ({ ...current, feedback: [feedback, ...current.feedback] }))
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

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    didDrag.current = false
    const companionBounds = event.currentTarget.getBoundingClientRect()
    const frameBounds = frameRef.current?.getBoundingClientRect()
    const left = Math.max(0, frameBounds?.left ?? 0)
    const right = Math.min(window.innerWidth, frameBounds?.right ?? window.innerWidth)
    const top = Math.max(0, frameBounds?.top ?? 0)
    const bottom = Math.min(window.innerHeight, frameBounds?.bottom ?? window.innerHeight)
    drag.current = { startX: event.clientX, startY: event.clientY, originX: assistantPos.x, originY: assistantPos.y, minX: assistantPos.x + left - companionBounds.left, maxX: assistantPos.x + right - companionBounds.right, minY: assistantPos.y + top - companionBounds.top, maxY: assistantPos.y + bottom - companionBounds.bottom }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return
    if (Math.abs(event.clientX - drag.current.startX) > 5 || Math.abs(event.clientY - drag.current.startY) > 5) didDrag.current = true
    const x = drag.current.originX + event.clientX - drag.current.startX
    const y = drag.current.originY + event.clientY - drag.current.startY
    setAssistantPos({ x: Math.max(drag.current.minX, Math.min(drag.current.maxX, x)), y: Math.max(drag.current.minY, Math.min(drag.current.maxY, y)) })
  }
  function endDrag() { drag.current = null }

  async function handleSignOut() {
    await signOut()
    setSession(null)
  }

  const nav = [{ id: 'home', label: '首页' }, { id: 'works', label: '作品' }, { id: 'memories', label: '回忆' }, { id: 'community', label: '社区' }] as const

  if (!sessionReady) return <main className="app-shell"><section className="auth-loading">正在打开你的创作桌面...</section></main>
  if (!session) return <EmailAuthPage onAuthenticated={setSession} />

  return <main className="app-shell">
    <section className="mobile-frame" ref={frameRef}>
      <header className="topbar"><span className="brand">留白</span><span className="mode-pill">生活模式</span><div className="account-summary"><span>{session.email}</span><button onClick={handleSignOut}>退出</button></div></header>
      <div className="content">
        {selectedRecap ? <WeeklyRecap works={state.works} feedback={state.feedback} onClose={() => setSelectedRecap(false)} /> : selectedWork ? <WorkDetail work={selectedWork} feedback={state.feedback.filter((item: FeedbackEvent) => item.workId === selectedWork.id)} onClose={() => setSelectedWork(null)} onSaveNote={updateNote} onFeedback={addFeedback} /> : <>
          {tab === 'home' && <Home profile={state.profile} works={state.works} feedback={state.feedback} onAdd={() => setShowWorkForm(true)} onOpenWork={setSelectedWork} onNavigate={nextTab => { setTab(nextTab); if (nextTab === 'community') setCommunityView('feed') }} onOpenProfile={() => { setTab('community'); setCommunityView('profile') }} />}
          {tab === 'works' && <Works works={state.works} onAdd={() => setShowWorkForm(true)} onOpenWork={setSelectedWork} />}
          {tab === 'memories' && <Memories memories={memories} works={state.works} onOpenRecap={() => setSelectedRecap(true)} />}
          {tab === 'community' && <Community view={communityView} profile={state.profile} posts={state.posts} onAdd={() => setShowPostForm(true)} onLike={toggleLike} onComment={addComment} onViewChange={setCommunityView} onEditProfile={() => setShowProfileForm(true)} />}
        </>}
      </div>
      {!selectedWork && !selectedRecap && <nav className="bottom-nav">{nav.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => { setTab(item.id); if (item.id === 'community') setCommunityView('feed') }}><span className="nav-mark" />{item.label}</button>)}</nav>}
    </section>
    <button className="companion" style={{ transform: `translate(${assistantPos.x}px, ${assistantPos.y}px)` }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onClick={() => { if (!didDrag.current) setAssistantOpen(open => !open) }} aria-label="打开或关闭创作陪伴"><span>留</span></button>
    {assistantOpen && <div className="assistant-panel" style={{ transform: `translate(${assistantPos.x}px, ${assistantPos.y}px)` }}><p className="eyebrow">创作陪伴</p><h2>今天也在记录。</h2><p className="assistant-answer">{answer}</p><form onSubmit={askAssistant}><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="问问我关于你的创作" /><button>发送</button></form></div>}
    {showWorkForm && <Modal title="记录一条作品" onClose={() => setShowWorkForm(false)}><WorkForm onSave={saveWork} /></Modal>}
    {showPostForm && <Modal title="发布到社区" onClose={() => setShowPostForm(false)}><PostForm onSave={savePost} /></Modal>}
    {showProfileForm && <Modal title="编辑个人资料" onClose={() => setShowProfileForm(false)}><ProfileForm profile={state.profile} onSave={saveProfile} /></Modal>}
  </main>
}

function EmailAuthPage({ onAuthenticated }: { onAuthenticated: (session: AppSession) => void }) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const result = await requestEmailCode(email.trim())
      setSent(true)
      setMessage(result.previewCode ? `本地预览验证码：${result.previewCode}` : '验证码已发送，请前往邮箱查看。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '验证码发送失败，请稍后再试。')
    } finally { setLoading(false) }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      onAuthenticated(await verifyEmailCode(email.trim(), code.trim()))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '登录失败，请重新尝试。')
    } finally { setLoading(false) }
  }

  return <main className="auth-shell"><section className="auth-card"><div className="auth-sticker">留</div><p className="eyebrow">创作生活</p><h1>先把你自己<br />带进来。</h1><p className="auth-copy">用邮箱验证码进入。手机号登录和免登录会作为移动端的后续认证方式。</p>{!sent ? <form className="auth-form" onSubmit={sendCode}><label>邮箱地址<input type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@example.com" required autoFocus /></label><button className="primary" disabled={loading}>{loading ? '发送中...' : '获取验证码'}</button></form> : <form className="auth-form" onSubmit={verifyCode}><label>验证码<input inputMode="numeric" value={code} onChange={event => setCode(event.target.value)} placeholder="输入 6 位验证码" maxLength={6} required autoFocus /></label><button className="primary" disabled={loading}>{loading ? '验证中...' : '进入创作桌面'}</button><button className="text-action" type="button" onClick={() => setSent(false)}>更换邮箱</button></form>}<p className="auth-message">{message}</p>{authMode === 'local-preview' && <p className="auth-preview">当前为本地开发预览，未配置真实邮件服务。</p>}</section></main>
}

function Home({ profile, works, feedback, onAdd, onOpenWork, onNavigate, onOpenProfile }: { profile: UserProfile; works: Work[]; feedback: FeedbackEvent[]; onAdd: () => void; onOpenWork: (work: Work) => void; onNavigate: (tab: Tab) => void; onOpenProfile: () => void }) {
  const totalLikes = works.reduce((sum, work) => sum + work.likes, 0)
  const latest = works[0]
  return <div className="studio-layout">
    <aside className="creator-aside">
      <button className="avatar-sticker tile-interactive" onClick={onOpenProfile} aria-label="打开我的主页">{profile.avatarImage ? <img src={profile.avatarImage} alt="我的头像" /> : profile.avatarLabel}</button>
      <div><h2>今天的<br />创作桌面</h2><p>慢一点，也没关系。</p></div>
      <nav className="studio-nav" aria-label="创作桌面导航">
        <button className="side-link tile-interactive" onClick={() => onNavigate('works')}><i />作品档案</button>
        <button className="side-link tile-interactive" onClick={() => onNavigate('memories')}><i />短期回看</button>
        <button className="side-link tile-interactive" onClick={() => onNavigate('community')}><i />创作社区</button>
      </nav>
      <button className="aside-note tile-interactive" onClick={onOpenProfile}>我的徽章与发帖</button>
    </aside>
    <section className="studio-stage">
      <section className="hero studio-hero"><p className="eyebrow">八月 27 日，星期四</p><h1>把创作过成<br />自己的生活。</h1><p>不用急着解释数据，先把每一次认真留下来。</p><button className="primary tile-interactive" onClick={onAdd}>记录新作品</button></section>
      {latest && <button className="latest-tile tile-interactive" onClick={() => onOpenWork(latest)}><span className="tile-label">最近发布</span><WorkCard work={latest} /><span className="tile-hint">查看这条作品</span></button>}
      <section className="moments-board"><p className="eyebrow">今天值得记住</p>{feedback.slice(0, 2).map(item => <article className="moment tile-interactive" key={item.id}><span>{item.type}</span><p>{item.content}</p></article>)}</section>
    </section>
    <aside className="dashboard-rail">
      <article className="clock-widget tile-interactive"><span>创作时间</span><strong>20:26</strong><small>留给自己的十分钟</small></article>
      <article className="calendar-widget tile-interactive"><p>2026 / 08</p><div className="week-row"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div><div className="date-grid">{Array.from({ length: 31 }, (_, index) => <span className={index === 26 ? 'today' : ''} key={index}>{index + 1}</span>)}</div></article>
      <article className="metric-widget tile-interactive"><p>这个月</p><div><strong>{works.length}</strong><span>条作品</span></div><div><strong>{number(totalLikes)}</strong><span>个喜欢</span></div><div><strong>{feedback.length}</strong><span>次收藏</span></div></article>
    </aside>
  </div>
}

function Works({ works, onAdd, onOpenWork }: { works: Work[]; onAdd: () => void; onOpenWork: (work: Work) => void }) {
  return <><section className="page-head"><p className="eyebrow">作品档案</p><h1>你做过的事，<br />都在这里。</h1><button className="primary compact" onClick={onAdd}>新增</button></section><div className="work-list">{works.map(work => <button className="work-button" onClick={() => onOpenWork(work)} key={work.id}><WorkCard work={work} /></button>)}</div></>
}

function WorkCard({ work }: { work: Work }) { return <article className={`work-card cover-${work.id.slice(-1)}`}><div className="cover">{work.coverImage ? <img src={work.coverImage} alt={`${work.title}封面`} /> : <span>{work.cover}</span>}<small>{work.platform}</small></div><div className="work-copy"><h3>{work.title}</h3><p>{work.publishedAt} · {number(work.plays)} 次观看</p><div className="work-metrics"><span>{number(work.likes)} 赞</span><span>{work.comments} 评论</span><span>{number(work.favorites)} 收藏</span></div>{work.note && <em>“{work.note}”</em>}</div></article> }

function Memories({ memories, works, onOpenRecap }: { memories: { id: string; label: string; title: string; detail: string; note: string }[]; works: Work[]; onOpenRecap: () => void }) { return <><section className="page-head memories-head"><p className="eyebrow">短期回看</p><h1>这一周，<br />你留下些什么？</h1><p>回看不必等到年末。它会收起这一周的作品、感受和反馈。</p><button className="primary recap-entry" onClick={onOpenRecap}>打开本周回看</button></section><div className="memory-stack">{memories.map((memory, index) => <article className={`memory-card memory-${index}`} key={memory.id}><p>{memory.label}</p><h2>{memory.title}</h2><span>{memory.detail}</span><blockquote>{memory.note || '这一刻，值得被收起来。'}</blockquote></article>)}</div><p className="small-note">基于 {works.length} 条作品与创作记录生成</p></> }

function Community({ view, profile, posts, onAdd, onLike, onComment, onViewChange, onEditProfile }: { view: 'feed' | 'profile'; profile: UserProfile; posts: Post[]; onAdd: () => void; onLike: (id: string) => void; onComment: (id: string, comment: string) => void; onViewChange: (view: 'feed' | 'profile') => void; onEditProfile: () => void }) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const myPosts = posts.filter(post => post.author === profile.nickname)
  if (view === 'profile') return <><section className="profile-page"><button className="profile-nav-button back-button" onClick={() => onViewChange('feed')}>返回社区</button><button className="profile-nav-button edit-profile-button" onClick={onEditProfile}>编辑资料</button><div className="profile-avatar">{profile.avatarImage ? <img src={profile.avatarImage} alt="我的头像" /> : profile.avatarLabel}</div><p className="eyebrow">个人主页</p><h1>{profile.nickname}的创作角落</h1><p className="profile-note">资料已保存在当前设备；接入账号后会同步至云端。</p><div className="badges"><span>连续记录者</span><span>社区新朋友</span></div></section><section className="section"><p className="eyebrow">我的发帖</p>{myPosts.length ? myPosts.map(post => <article className="post mine" key={post.id}><p className="post-content">{post.content}</p><small>{post.createdAt} · {post.likes} 次喜欢</small></article>) : <p className="empty">你还没有发布内容。去社区说说正在经历的创作吧。</p>}</section></>
  return <><section className="page-head community-head"><p className="eyebrow">创作者社区</p><h1>说说你正在<br />经历的创作。</h1><div className="community-actions"><button className="profile-nav-button" onClick={() => onViewChange('profile')}>我的</button><button className="primary compact" onClick={onAdd}>发布</button></div></section><div className="post-list">{posts.map(post => <article className="post" key={post.id}><div className="post-author"><span className="avatar">{post.avatar}</span><div><strong>{post.author}</strong><small>{post.createdAt}</small></div></div><p className="post-content">{post.content}</p>{post.image && <img className="post-image" src={post.image} alt={post.imageCaption || '社区图片'} />}{!post.image && post.imageCaption && <div className="post-image">{post.imageCaption}</div>}<div className="post-actions"><button className={post.liked ? 'liked' : ''} onClick={() => onLike(post.id)}>喜欢 {post.likes}</button><button onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}>回应 {post.comments.length}</button></div>{replyingTo === post.id && <form className="reply-form" onSubmit={event => { event.preventDefault(); onComment(post.id, draft.trim()); setDraft(''); setReplyingTo(null) }}><input value={draft} onChange={event => setDraft(event.target.value)} placeholder="写下你的回应" autoFocus /><button disabled={!draft.trim()}>发送</button></form>}{post.comments.slice(-2).map((comment, index) => <p className="comment" key={index}>{comment}</p>)}</article>)}</div></>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" onMouseDown={event => event.stopPropagation()}><button className="close" onClick={onClose}>关闭</button><h2>{title}</h2>{children}</section></div> }

function WorkForm({ onSave }: { onSave: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) { return <form className="entry-form" onSubmit={onSave}><label>标题<input name="title" required placeholder="这条作品叫什么？" /></label><div className="two-columns"><label>平台<select name="platform" defaultValue="小红书"><option>抖音</option><option>小红书</option><option>B站</option><option>视频号</option></select></label><label>发布时间<input name="publishedAt" type="date" defaultValue={today} /></label></div><div className="two-columns"><label>观看/阅读<input name="plays" type="number" min="0" placeholder="0" /></label><label>点赞<input name="likes" type="number" min="0" placeholder="0" /></label></div><div className="two-columns"><label>评论<input name="comments" type="number" min="0" placeholder="0" /></label><label>收藏<input name="favorites" type="number" min="0" placeholder="0" /></label></div><label>分享<input name="shares" type="number" min="0" placeholder="0" /></label><label>封面印象<input name="cover" placeholder="例如：窗边、晚餐、街道" /></label><label>上传封面<input name="coverImage" type="file" accept="image/*" /></label><label>此刻的感受<select name="mood" defaultValue="平静"><option>雀跃</option><option>平静</option><option>疲惫</option><option>骄傲</option></select></label><label>作品便签<textarea name="note" placeholder="不必写得漂亮，留下当时的自己就好。" /></label><button className="primary" type="submit">保存作品</button></form> }

function PostForm({ onSave }: { onSave: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) { return <form className="entry-form" onSubmit={onSave}><label>想说的话<textarea name="content" required placeholder="只支持普通文字。" /></label><label>上传图片<input name="image" type="file" accept="image/*" /></label><label>图片说明<input name="imageCaption" placeholder="例如：我的工作台" /></label><button className="primary" type="submit">发布</button></form> }

function ProfileForm({ profile, onSave }: { profile: UserProfile; onSave: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) { return <form className="entry-form" onSubmit={onSave}><label>昵称<input name="nickname" defaultValue={profile.nickname} maxLength={18} required /></label><label>头像图片<input name="avatarImage" type="file" accept="image/*" /></label><p className="form-hint">图片会在当前设备压缩后保存。云端同步将在账号系统接入后启用。</p><button className="primary" type="submit">保存资料</button></form> }

function WorkDetail({ work, feedback, onClose, onSaveNote, onFeedback }: { work: Work; feedback: FeedbackEvent[]; onClose: () => void; onSaveNote: (id: string, note: string) => void; onFeedback: (id: string) => void }) { const [note, setNote] = useState(work.note); return <section className="work-detail-page"><button className="back-link" onClick={onClose}>返回</button><div className={`detail-cover cover-${work.id.slice(-1)}`}>{work.coverImage ? <img src={work.coverImage} alt={`${work.title}封面`} /> : <span>{work.cover}</span>}</div><p className="eyebrow">{work.platform} · 发布于 {work.publishedAt}</p><h1>{work.title}</h1><p className="detail-mood">那时的你：{work.mood}</p><div className="detail-metrics"><span>{number(work.plays)}<small>观看</small></span><span>{number(work.likes)}<small>喜欢</small></span><span>{work.comments}<small>评论</small></span><span>{number(work.favorites)}<small>收藏</small></span><span>{work.shares}<small>分享</small></span></div><label className="note-field">生活便签<textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => onSaveNote(work.id, note)} /></label><div className="detail-head"><p className="eyebrow">珍藏反馈</p><button onClick={() => onFeedback(work.id)}>记录时刻</button></div>{feedback.length ? feedback.map(item => <article className="moment" key={item.id}><span>{item.type}</span><p>{item.content}</p></article>) : <p className="empty">留下一句评论或一个感受，它会在回忆里出现。</p>}</section> }

function WeeklyRecap({ works, feedback, onClose }: { works: Work[]; feedback: FeedbackEvent[]; onClose: () => void }) {
  const [page, setPage] = useState(0)
  const recent = works.slice(0, 3)
  const favorite = works.slice().sort((a, b) => b.likes - a.likes)[0]
  const slides = [
    <><p className="eyebrow">本周创作回看</p><h1>这七天，<br />你没有白过。</h1><strong className="recap-number">{recent.length}</strong><p>条作品被认真留了下来。</p></>,
    <><p className="eyebrow">被更多人看见</p><h1>《{favorite?.title ?? '你的作品'}》</h1><strong className="recap-number">{number(favorite?.likes ?? 0)}</strong><p>个喜欢，是这周最明亮的回应。</p></>,
    <><p className="eyebrow">你当时写下</p><blockquote className="recap-quote">“{recent[0]?.note || '把这一周的感受，留给下一次自己。'}”</blockquote><p>不止数据，你也记住了那个时刻的自己。</p></>,
    <><p className="eyebrow">收下这些声音</p><h1>本周有 {feedback.length} 个<br />值得收藏的时刻。</h1><p>{feedback[0]?.content || '下一周，也继续为自己留下一个时刻。'}</p></>,
  ]
  return <section className="weekly-recap"><button className="back-link" onClick={onClose}>返回回忆</button><div className={`recap-slide recap-slide-${page}`} key={page}>{slides[page]}</div><div className="recap-progress">{slides.map((_, index) => <span className={index === page ? 'active' : ''} key={index} />)}</div><button className="primary recap-next" onClick={() => setPage(page === slides.length - 1 ? 0 : page + 1)}>{page === slides.length - 1 ? '重新播放' : '下一页'}</button></section>
}
