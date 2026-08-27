import { FormEvent, PointerEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { initialFeedback, initialPosts, initialWorks } from './data'
import type { FeedbackEvent, Platform, Post, Tab, Work } from './types'

const storageKey = 'creator-life-v1'

function loadState() {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved ? JSON.parse(saved) : { works: initialWorks, feedback: initialFeedback, posts: initialPosts }
  } catch {
    return { works: initialWorks, feedback: initialFeedback, posts: initialPosts }
  }
}

const number = (value: number) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
const today = new Date().toISOString().slice(0, 10)

export default function App() {
  const [state, setState] = useState(loadState)
  const [tab, setTab] = useState<Tab>('home')
  const [showWorkForm, setShowWorkForm] = useState(false)
  const [showPostForm, setShowPostForm] = useState(false)
  const [selectedWork, setSelectedWork] = useState<Work | null>(null)
  const [communityView, setCommunityView] = useState<'feed' | 'profile'>('feed')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [assistantPos, setAssistantPos] = useState({ x: 0, y: 0 })
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('我在。想看看你最近留下了什么，还是聊聊一条作品？')
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const didDrag = useRef(false)

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(state)) }, [state])

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

  function saveWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const newWork: Work = {
      id: crypto.randomUUID(), title: String(form.get('title')), platform: form.get('platform') as Platform,
      publishedAt: String(form.get('publishedAt')), cover: String(form.get('cover')) || '新作品',
      plays: Number(form.get('plays')) || 0, likes: Number(form.get('likes')) || 0,
      comments: Number(form.get('comments')) || 0, favorites: Number(form.get('favorites')) || 0,
      shares: Number(form.get('shares')) || 0, note: String(form.get('note')), mood: form.get('mood') as Work['mood'],
    }
    setState((current: typeof state) => ({ ...current, works: [newWork, ...current.works] }))
    setShowWorkForm(false)
  }

  function savePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const content = String(form.get('content')).trim()
    if (!content) return
    const post: Post = { id: crypto.randomUUID(), author: '我', avatar: '我', content, image: String(form.get('image')).trim() || undefined, createdAt: '刚刚', likes: 0, liked: false, comments: [] }
    setState((current: typeof state) => ({ ...current, posts: [post, ...current.posts] }))
    setShowPostForm(false)
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
    drag.current = { startX: event.clientX, startY: event.clientY, originX: assistantPos.x, originY: assistantPos.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return
    if (Math.abs(event.clientX - drag.current.startX) > 5 || Math.abs(event.clientY - drag.current.startY) > 5) didDrag.current = true
    setAssistantPos({ x: drag.current.originX + event.clientX - drag.current.startX, y: drag.current.originY + event.clientY - drag.current.startY })
  }
  function endDrag() { drag.current = null }

  const nav = [{ id: 'home', label: '首页' }, { id: 'works', label: '作品' }, { id: 'memories', label: '回忆' }, { id: 'community', label: '社区' }] as const

  return <main className="app-shell">
    <section className="mobile-frame">
      <header className="topbar"><span className="brand">留白</span><span className="mode-pill">生活模式</span></header>
      <div className="content">
        {selectedWork ? <WorkDetail work={selectedWork} feedback={state.feedback.filter((item: FeedbackEvent) => item.workId === selectedWork.id)} onClose={() => setSelectedWork(null)} onSaveNote={updateNote} onFeedback={addFeedback} /> : <>
          {tab === 'home' && <Home works={state.works} feedback={state.feedback} onAdd={() => setShowWorkForm(true)} onOpenWork={setSelectedWork} />}
          {tab === 'works' && <Works works={state.works} onAdd={() => setShowWorkForm(true)} onOpenWork={setSelectedWork} />}
          {tab === 'memories' && <Memories memories={memories} works={state.works} />}
          {tab === 'community' && <Community view={communityView} posts={state.posts} onAdd={() => setShowPostForm(true)} onLike={toggleLike} onComment={addComment} onViewChange={setCommunityView} />}
        </>}
      </div>
      {!selectedWork && <nav className="bottom-nav">{nav.map(item => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => setTab(item.id)}><span className="nav-mark" />{item.label}</button>)}</nav>}
    </section>
    <button className="companion" style={{ transform: `translate(${assistantPos.x}px, ${assistantPos.y}px)` }} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onClick={() => { if (!didDrag.current) setAssistantOpen(open => !open) }} aria-label="打开或关闭创作陪伴"><span>留</span></button>
    {assistantOpen && <div className="assistant-panel" style={{ transform: `translate(${assistantPos.x}px, ${assistantPos.y}px)` }}><p className="eyebrow">创作陪伴</p><h2>今天也在记录。</h2><p className="assistant-answer">{answer}</p><form onSubmit={askAssistant}><input value={question} onChange={e => setQuestion(e.target.value)} placeholder="问问我关于你的创作" /><button>发送</button></form></div>}
    {showWorkForm && <Modal title="记录一条作品" onClose={() => setShowWorkForm(false)}><WorkForm onSave={saveWork} /></Modal>}
    {showPostForm && <Modal title="发布到社区" onClose={() => setShowPostForm(false)}><PostForm onSave={savePost} /></Modal>}
  </main>
}

function Home({ works, feedback, onAdd, onOpenWork }: { works: Work[]; feedback: FeedbackEvent[]; onAdd: () => void; onOpenWork: (work: Work) => void }) {
  const totalLikes = works.reduce((sum, work) => sum + work.likes, 0)
  const latest = works[0]
  return <><section className="hero"><p className="eyebrow">八月 27 日，星期四</p><h1>把创作过成<br />自己的生活。</h1><p>不用急着解释数据，先把每一次认真留下来。</p><button className="primary" onClick={onAdd}>记录新作品</button></section><section className="quiet-stats"><div><strong>{works.length}</strong><span>已记录作品</span></div><div><strong>{number(totalLikes)}</strong><span>收到的赞</span></div><div><strong>{feedback.length}</strong><span>珍藏时刻</span></div></section>{latest && <section className="section"><div className="section-title"><p className="eyebrow">最近发布</p><button onClick={() => onOpenWork(latest)}>打开</button></div><WorkCard work={latest} /></section>}<section className="section"><div className="section-title"><p className="eyebrow">今天值得记住</p></div>{feedback.slice(0, 2).map(item => <article className="moment" key={item.id}><span>{item.type}</span><p>{item.content}</p></article>)}</section></>
}

function Works({ works, onAdd, onOpenWork }: { works: Work[]; onAdd: () => void; onOpenWork: (work: Work) => void }) {
  return <><section className="page-head"><p className="eyebrow">作品档案</p><h1>你做过的事，<br />都在这里。</h1><button className="primary compact" onClick={onAdd}>新增</button></section><div className="work-list">{works.map(work => <button className="work-button" onClick={() => onOpenWork(work)} key={work.id}><WorkCard work={work} /></button>)}</div></>
}

function WorkCard({ work }: { work: Work }) { return <article className={`work-card cover-${work.id.slice(-1)}`}><div className="cover"><span>{work.cover}</span><small>{work.platform}</small></div><div className="work-copy"><h3>{work.title}</h3><p>{work.publishedAt} · {number(work.plays)} 次观看</p><div className="work-metrics"><span>{number(work.likes)} 赞</span><span>{work.comments} 评论</span><span>{number(work.favorites)} 收藏</span></div>{work.note && <em>“{work.note}”</em>}</div></article> }

function Memories({ memories, works }: { memories: { id: string; label: string; title: string; detail: string; note: string }[]; works: Work[] }) { return <><section className="page-head memories-head"><p className="eyebrow">回忆陈列室</p><h1>有些时刻，<br />不必只看数字。</h1><p>回忆会随你留下的作品和感受慢慢长出来。</p></section><div className="memory-stack">{memories.map((memory, index) => <article className={`memory-card memory-${index}`} key={memory.id}><p>{memory.label}</p><h2>{memory.title}</h2><span>{memory.detail}</span><blockquote>{memory.note || '这一刻，值得被收起来。'}</blockquote></article>)}</div><p className="small-note">基于 {works.length} 条作品与创作记录生成</p></> }

function Community({ view, posts, onAdd, onLike, onComment, onViewChange }: { view: 'feed' | 'profile'; posts: Post[]; onAdd: () => void; onLike: (id: string) => void; onComment: (id: string, comment: string) => void; onViewChange: (view: 'feed' | 'profile') => void }) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const myPosts = posts.filter(post => post.author === '我')
  if (view === 'profile') return <><section className="profile-page"><button className="back-link" onClick={() => onViewChange('feed')}>返回社区</button><div className="profile-avatar">我</div><p className="eyebrow">个人主页</p><h1>我的创作角落</h1><div className="badges"><span>连续记录者</span><span>社区新朋友</span></div></section><section className="section"><p className="eyebrow">我的发帖</p>{myPosts.length ? myPosts.map(post => <article className="post mine" key={post.id}><p className="post-content">{post.content}</p><small>{post.createdAt} · {post.likes} 次喜欢</small></article>) : <p className="empty">你还没有发布内容。去社区说说正在经历的创作吧。</p>}</section></>
  return <><section className="page-head community-head"><p className="eyebrow">创作者社区</p><h1>说说你正在<br />经历的创作。</h1><div className="community-actions"><button className="text-button" onClick={() => onViewChange('profile')}>我的</button><button className="primary compact" onClick={onAdd}>发布</button></div></section><div className="post-list">{posts.map(post => <article className="post" key={post.id}><div className="post-author"><span className="avatar">{post.avatar}</span><div><strong>{post.author}</strong><small>{post.createdAt}</small></div></div><p className="post-content">{post.content}</p>{post.image && <div className="post-image">{post.image}</div>}<div className="post-actions"><button className={post.liked ? 'liked' : ''} onClick={() => onLike(post.id)}>喜欢 {post.likes}</button><button onClick={() => setReplyingTo(replyingTo === post.id ? null : post.id)}>回应 {post.comments.length}</button></div>{replyingTo === post.id && <form className="reply-form" onSubmit={event => { event.preventDefault(); onComment(post.id, draft.trim()); setDraft(''); setReplyingTo(null) }}><input value={draft} onChange={event => setDraft(event.target.value)} placeholder="写下你的回应" autoFocus /><button disabled={!draft.trim()}>发送</button></form>}{post.comments.slice(-2).map((comment, index) => <p className="comment" key={index}>{comment}</p>)}</article>)}</div></>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) { return <div className="modal-backdrop" onMouseDown={onClose}><section className="modal" onMouseDown={event => event.stopPropagation()}><button className="close" onClick={onClose}>关闭</button><h2>{title}</h2>{children}</section></div> }

function WorkForm({ onSave }: { onSave: (event: FormEvent<HTMLFormElement>) => void }) { return <form className="entry-form" onSubmit={onSave}><label>标题<input name="title" required placeholder="这条作品叫什么？" /></label><div className="two-columns"><label>平台<select name="platform" defaultValue="小红书"><option>抖音</option><option>小红书</option><option>B站</option><option>视频号</option></select></label><label>发布时间<input name="publishedAt" type="date" defaultValue={today} /></label></div><div className="two-columns"><label>观看/阅读<input name="plays" type="number" min="0" placeholder="0" /></label><label>点赞<input name="likes" type="number" min="0" placeholder="0" /></label></div><div className="two-columns"><label>评论<input name="comments" type="number" min="0" placeholder="0" /></label><label>收藏<input name="favorites" type="number" min="0" placeholder="0" /></label></div><label>分享<input name="shares" type="number" min="0" placeholder="0" /></label><label>封面印象<input name="cover" placeholder="例如：窗边、晚餐、街道" /></label><label>此刻的感受<select name="mood" defaultValue="平静"><option>雀跃</option><option>平静</option><option>疲惫</option><option>骄傲</option></select></label><label>作品便签<textarea name="note" placeholder="不必写得漂亮，留下当时的自己就好。" /></label><button className="primary" type="submit">保存作品</button></form> }

function PostForm({ onSave }: { onSave: (event: FormEvent<HTMLFormElement>) => void }) { return <form className="entry-form" onSubmit={onSave}><label>想说的话<textarea name="content" required placeholder="只支持普通文字。" /></label><label>图片说明（V1 演示）<input name="image" placeholder="例如：我的工作台" /></label><button className="primary" type="submit">发布</button></form> }

function WorkDetail({ work, feedback, onClose, onSaveNote, onFeedback }: { work: Work; feedback: FeedbackEvent[]; onClose: () => void; onSaveNote: (id: string, note: string) => void; onFeedback: (id: string) => void }) { const [note, setNote] = useState(work.note); return <section className="work-detail-page"><button className="back-link" onClick={onClose}>返回</button><div className={`detail-cover cover-${work.id.slice(-1)}`}><span>{work.cover}</span></div><p className="eyebrow">{work.platform} · 发布于 {work.publishedAt}</p><h1>{work.title}</h1><p className="detail-mood">那时的你：{work.mood}</p><div className="detail-metrics"><span>{number(work.plays)}<small>观看</small></span><span>{number(work.likes)}<small>喜欢</small></span><span>{work.comments}<small>评论</small></span><span>{number(work.favorites)}<small>收藏</small></span><span>{work.shares}<small>分享</small></span></div><label className="note-field">生活便签<textarea value={note} onChange={e => setNote(e.target.value)} onBlur={() => onSaveNote(work.id, note)} /></label><div className="detail-head"><p className="eyebrow">珍藏反馈</p><button onClick={() => onFeedback(work.id)}>记录时刻</button></div>{feedback.length ? feedback.map(item => <article className="moment" key={item.id}><span>{item.type}</span><p>{item.content}</p></article>) : <p className="empty">留下一句评论或一个感受，它会在回忆里出现。</p>}</section> }
