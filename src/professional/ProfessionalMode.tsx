import { FormEvent, useState } from 'react'
import type { ProfessionalTab, ScoreRecord, ScoreTemplate, Topic, TopicSource, TopicStatus, Work, WorkReview } from '../types'
import { Modal } from '../components/Modal'

const number = (value: number) => new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)

function localDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const topicStatusLabel: Record<TopicStatus, string> = {
  idea: '待定',
  planning: '规划中',
  creating: '创作中',
  published: '已发布',
  archived: '已归档',
}

const topicStatusOrder: TopicStatus[] = ['idea', 'planning', 'creating', 'published', 'archived']

const topicSources: TopicSource[] = ['灵感', '热点', '日常', '改编']

export function ProfessionalMode({ tab, onTabChange, works, topics, templates, records, reviews, onTopicsChange, onTemplatesChange, onRecordsChange, onReviewsChange }: {
  tab: ProfessionalTab
  onTabChange: (tab: ProfessionalTab) => void
  works: Work[]
  topics: Topic[]
  templates: ScoreTemplate[]
  records: ScoreRecord[]
  reviews: WorkReview[]
  onTopicsChange: (topics: Topic[]) => void
  onTemplatesChange: (templates: ScoreTemplate[]) => void
  onRecordsChange: (records: ScoreRecord[]) => void
  onReviewsChange: (reviews: WorkReview[]) => void
}) {
  return <div className="professional">
    <section className="page-head pro-head">
      <p className="eyebrow">专业模式</p>
      <h1>选题、评分<br />和复盘，连成一条线。</h1>
      <div className="pro-tabs" role="tablist" aria-label="专业模式导航">
        <button className={tab === 'topics' ? 'active' : ''} onClick={() => onTabChange('topics')}>选题库</button>
        <button className={tab === 'scoring' ? 'active' : ''} onClick={() => onTabChange('scoring')}>评分</button>
        <button className={tab === 'review' ? 'active' : ''} onClick={() => onTabChange('review')}>复盘</button>
        <button className={tab === 'data' ? 'active' : ''} onClick={() => onTabChange('data')}>数据</button>
      </div>
    </section>
    {tab === 'topics' && <TopicBoard works={works} topics={topics} onTopicsChange={onTopicsChange} />}
    {tab === 'scoring' && <ScoreStudio works={works} templates={templates} records={records} onTemplatesChange={onTemplatesChange} onRecordsChange={onRecordsChange} />}
    {tab === 'review' && <ReviewBoard works={works} records={records} reviews={reviews} onReviewsChange={onReviewsChange} />}
    {tab === 'data' && <DataBoard works={works} records={records} />}
  </div>
}

function TopicBoard({ works, topics, onTopicsChange }: { works: Work[]; topics: Topic[]; onTopicsChange: (topics: Topic[]) => void }) {
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | TopicStatus>('all')
  const visible = topics.filter(topic => filter === 'all' || topic.status === filter)

  function addTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const topic: Topic = {
      id: crypto.randomUUID(),
      title: String(form.get('title')).trim(),
      source: form.get('source') as TopicSource,
      note: String(form.get('note')).trim(),
      status: 'idea',
      potential: Number(form.get('potential')) || 3,
      createdAt: localDate(),
    }
    onTopicsChange([topic, ...topics])
    setShowForm(false)
  }

  function advance(topic: Topic) {
    const next = topicStatusOrder[Math.min(topicStatusOrder.indexOf(topic.status) + 1, topicStatusOrder.length - 1)]
    onTopicsChange(topics.map(item => item.id === topic.id ? { ...item, status: next } : item))
  }

  function linkWork(topicId: string, workId: string) {
    onTopicsChange(topics.map(item => item.id === topicId ? { ...item, workId: workId || undefined } : item))
  }

  function remove(topicId: string) {
    onTopicsChange(topics.filter(item => item.id !== topicId))
  }

  return <section className="pro-board">
    <div className="board-toolbar">
      <div className="chip-row">
        {(['all', 'idea', 'planning', 'creating', 'published', 'archived'] as const).map(key => (
          <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{key === 'all' ? '全部' : topicStatusLabel[key]}</button>
        ))}
      </div>
      <button className="primary compact-static" onClick={() => setShowForm(true)}>新选题</button>
    </div>
    {visible.length ? visible.map(topic => {
      const nextStatus = topicStatusOrder[Math.min(topicStatusOrder.indexOf(topic.status) + 1, topicStatusOrder.length - 1)]
      return <article className="topic-card tile-interactive" key={topic.id}>
        <div className="topic-head">
          <h3>{topic.title}</h3>
          <span className={`topic-status ${topic.status}`}>{topicStatusLabel[topic.status]}</span>
        </div>
        <p className="topic-meta">{topic.source} · 潜力 {'★'.repeat(topic.potential)}{'☆'.repeat(5 - topic.potential)} · {topic.createdAt}</p>
        {topic.note && <p className="topic-note">{topic.note}</p>}
        {topic.workId && works.some(work => work.id === topic.workId) && <p className="topic-linked">已关联作品：{works.find(work => work.id === topic.workId)?.title}</p>}
        <div className="topic-actions">
          {topic.status !== 'archived' && <button onClick={() => advance(topic)}>进入{topicStatusLabel[nextStatus]}</button>}
          {topic.status === 'published' && <select value={topic.workId ?? ''} onChange={event => linkWork(topic.id, event.target.value)} aria-label="关联作品">
            <option value="">关联作品…</option>
            {works.map(work => <option key={work.id} value={work.id}>{work.title}</option>)}
          </select>}
          <button className="text-action" onClick={() => remove(topic.id)}>删除</button>
        </div>
      </article>
    }) : <p className="empty">还没有选题。从一条灵感开始，把它一步步推进到发布。</p>}
    {showForm && <Modal title="新选题" onClose={() => setShowForm(false)}>
      <form className="entry-form" onSubmit={addTopic}>
        <label>标题<input name="title" required placeholder="这个选题叫什么？" /></label>
        <div className="two-columns">
          <label>来源<select name="source" defaultValue="灵感">{topicSources.map(source => <option key={source}>{source}</option>)}</select></label>
          <label>潜力<select name="potential" defaultValue="3">{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</option>)}</select></label>
        </div>
        <label>想法<textarea name="note" placeholder="为什么值得做？差异化在哪？" /></label>
        <button className="primary" type="submit">保存选题</button>
      </form>
    </Modal>}
  </section>
}

function ScoreStudio({ works, templates, records, onTemplatesChange, onRecordsChange }: { works: Work[]; templates: ScoreTemplate[]; records: ScoreRecord[]; onTemplatesChange: (templates: ScoreTemplate[]) => void; onRecordsChange: (records: ScoreRecord[]) => void }) {
  const [editingTemplate, setEditingTemplate] = useState<ScoreTemplate | null>(null)
  const [scoring, setScoring] = useState(false)

  const workTitle = (id: string) => works.find(work => work.id === id)?.title ?? '已删除的作品'
  const templateName = (id: string) => templates.find(template => template.id === id)?.name ?? '已删除的模板'

  function saveTemplate(next: ScoreTemplate) {
    onTemplatesChange(templates.some(template => template.id === next.id)
      ? templates.map(template => template.id === next.id ? next : template)
      : [next, ...templates])
    setEditingTemplate(null)
  }

  return <section className="pro-board">
    <div className="board-toolbar">
      <p className="eyebrow">评分模板</p>
      <div className="toolbar-actions">
        <button onClick={() => setEditingTemplate({ id: crypto.randomUUID(), name: '新模板', items: [{ id: crypto.randomUUID(), label: '维度一', weight: 100 }] })}>新建模板</button>
        <button className="primary compact-static" onClick={() => setScoring(true)} disabled={!works.length}>开始评分</button>
      </div>
    </div>
    <div className="template-list">
      {templates.map(template => <article className="template-card tile-interactive" key={template.id}>
        <h3>{template.name}</h3>
        <ul>{template.items.map(item => <li key={item.id}><span>{item.label}</span><b>{item.weight}%</b></li>)}</ul>
        <div className="topic-actions">
          <button onClick={() => setEditingTemplate(JSON.parse(JSON.stringify(template)) as ScoreTemplate)}>编辑</button>
          {template.id !== 'tpl-default' && <button className="text-action" onClick={() => onTemplatesChange(templates.filter(item => item.id !== template.id))}>删除</button>}
        </div>
      </article>)}
    </div>
    <p className="eyebrow section-gap">评分记录</p>
    {records.length ? records.map(record => <article className="score-record" key={record.id}>
      <span className="score-total">{record.total}</span>
      <div className="score-copy">
        <strong>{workTitle(record.workId)}</strong>
        <small>{templateName(record.templateId)} · {record.createdAt}</small>
        {record.comment && <p>{record.comment}</p>}
      </div>
      <button className="text-action" onClick={() => onRecordsChange(records.filter(item => item.id !== record.id))}>删除</button>
    </article>) : <p className="empty">还没有评分记录。选一条作品，用模板打一次分。</p>}
    {editingTemplate && <Modal title="编辑评分模板" onClose={() => setEditingTemplate(null)}>
      <TemplateForm template={editingTemplate} onSave={saveTemplate} />
    </Modal>}
    {scoring && <Modal title="作品评分" onClose={() => setScoring(false)}>
      <ScoreForm works={works} templates={templates} onSave={record => { onRecordsChange([record, ...records]); setScoring(false) }} />
    </Modal>}
  </section>
}

function TemplateForm({ template, onSave }: { template: ScoreTemplate; onSave: (template: ScoreTemplate) => void }) {
  const [draft, setDraft] = useState<ScoreTemplate>(JSON.parse(JSON.stringify(template)) as ScoreTemplate)
  const weightSum = draft.items.reduce((sum, item) => sum + item.weight, 0)

  function updateItem(itemId: string, patch: Partial<{ label: string; weight: number }>) {
    setDraft(current => ({ ...current, items: current.items.map(item => item.id === itemId ? { ...item, ...patch } : item) }))
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const items = draft.items.filter(item => item.label.trim())
    if (!draft.name.trim() || items.length === 0) return
    const sum = items.reduce((total, item) => total + item.weight, 0)
    const normalized = sum > 0
      ? items.map(item => ({ ...item, weight: Math.round(item.weight / sum * 100) }))
      : items.map(item => ({ ...item, weight: Math.round(100 / items.length) }))
    onSave({ ...draft, name: draft.name.trim(), items: normalized })
  }

  return <form className="entry-form" onSubmit={save}>
    <label>模板名称<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} required maxLength={20} /></label>
    <div className="template-items">
      {draft.items.map(item => <div className="template-item" key={item.id}>
        <input value={item.label} onChange={event => updateItem(item.id, { label: event.target.value })} placeholder="评分维度" maxLength={12} />
        <input type="number" min={0} max={100} value={item.weight} onChange={event => updateItem(item.id, { weight: Number(event.target.value) || 0 })} aria-label="权重" />
        <span>%</span>
        <button type="button" className="text-action" onClick={() => setDraft({ ...draft, items: draft.items.filter(x => x.id !== item.id) })} disabled={draft.items.length <= 1}>删除</button>
      </div>)}
    </div>
    <div className="toolbar-actions">
      <button type="button" onClick={() => setDraft({ ...draft, items: [...draft.items, { id: crypto.randomUUID(), label: '', weight: 10 }] })}>添加维度</button>
      <small className={weightSum === 100 ? '' : 'weight-warning'}>当前权重合计 {weightSum}%（保存时自动归一到 100%）</small>
    </div>
    <button className="primary" type="submit">保存模板</button>
  </form>
}

function ScoreForm({ works, templates, onSave }: { works: Work[]; templates: ScoreTemplate[]; onSave: (record: ScoreRecord) => void }) {
  const [workId, setWorkId] = useState(works[0]?.id ?? '')
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '')
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const item of templates[0]?.items ?? []) initial[item.id] = 5
    return initial
  })
  const [comment, setComment] = useState('')
  const template = templates.find(item => item.id === templateId) ?? templates[0]

  function switchTemplate(nextId: string) {
    setTemplateId(nextId)
    const next = templates.find(item => item.id === nextId)
    const initial: Record<string, number> = {}
    for (const item of next?.items ?? []) initial[item.id] = 5
    setScores(initial)
  }

  const total = template
    ? Math.round(template.items.reduce((sum, item) => sum + (scores[item.id] ?? 5) / 10 * item.weight, 0))
    : 0

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!workId || !template) return
    const record: ScoreRecord = {
      id: crypto.randomUUID(),
      workId,
      templateId: template.id,
      scores: { ...scores },
      total,
      createdAt: localDate(),
      comment: comment.trim(),
    }
    onSave(record)
  }

  return <form className="entry-form" onSubmit={submit}>
    <label>作品<select value={workId} onChange={event => setWorkId(event.target.value)} required>
      {works.map(work => <option key={work.id} value={work.id}>{work.title}</option>)}
    </select></label>
    <label>模板<select value={templateId} onChange={event => switchTemplate(event.target.value)}>
      {templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select></label>
    {template?.items.map(item => <div className="score-input" key={item.id}>
      <span>{item.label}<small>{item.weight}%</small></span>
      <input type="range" min={1} max={10} value={scores[item.id] ?? 5} onChange={event => setScores({ ...scores, [item.id]: Number(event.target.value) })} />
      <b>{scores[item.id] ?? 5}</b>
    </div>)}
    <p className="score-live">加权总分：<strong>{total}</strong> / 100</p>
    <label>评分理由<textarea value={comment} onChange={event => setComment(event.target.value)} placeholder="为什么打这个分？记下当时的判断。" /></label>
    <button className="primary" type="submit">保存评分</button>
  </form>
}

function ReviewBoard({ works, records, reviews, onReviewsChange }: { works: Work[]; records: ScoreRecord[]; reviews: WorkReview[]; onReviewsChange: (reviews: WorkReview[]) => void }) {
  const [openId, setOpenId] = useState<string | null>(null)

  function saveReview(review: WorkReview) {
    onReviewsChange(reviews.some(item => item.workId === review.workId)
      ? reviews.map(item => item.workId === review.workId ? review : item)
      : [review, ...reviews])
    setOpenId(null)
  }

  return <section className="pro-board">
    {works.length ? works.map(work => {
      const review = reviews.find(item => item.workId === work.id)
      const workScores = records.filter(record => record.workId === work.id)
      const avg = workScores.length ? Math.round(workScores.reduce((sum, record) => sum + record.total, 0) / workScores.length) : null
      return <article className="review-card" key={work.id}>
        <button className="review-summary" onClick={() => setOpenId(openId === work.id ? null : work.id)}>
          <div className="review-title">
            <strong>{work.title}</strong>
            {avg !== null && <span className="score-badge">均分 {avg}</span>}
          </div>
          <small>{work.platform} · {work.publishedAt}</small>
          <span className="review-metrics">{number(work.plays)} 播放 · {number(work.likes)} 赞 · {number(work.comments)} 评论 · {number(work.favorites)} 收藏 · {number(work.shares)} 分享</span>
        </button>
        {openId === work.id && <ReviewEditor work={work} review={review} onSave={saveReview} />}
      </article>
    }) : <p className="empty">还没有作品记录。专业复盘基于已记录的作品数据。</p>}
  </section>
}

function ReviewEditor({ work, review, onSave }: { work: Work; review?: WorkReview; onSave: (review: WorkReview) => void }) {
  const [strengths, setStrengths] = useState(review?.strengths ?? '')
  const [problems, setProblems] = useState(review?.problems ?? '')
  const [next, setNext] = useState(review?.next ?? '')

  return <div className="review-editor">
    <label>亮点<textarea value={strengths} onChange={event => setStrengths(event.target.value)} placeholder="这条作品做对了什么？" /></label>
    <label>问题<textarea value={problems} onChange={event => setProblems(event.target.value)} placeholder="哪里可以做得更好？" /></label>
    <label>下一步<textarea value={next} onChange={event => setNext(event.target.value)} placeholder="下一条作品要尝试什么？" /></label>
    <button className="primary compact-static" onClick={() => onSave({ workId: work.id, strengths: strengths.trim(), problems: problems.trim(), next: next.trim(), updatedAt: new Date().toISOString() })}>保存复盘</button>
  </div>
}

function DataBoard({ works, records }: { works: Work[]; records: ScoreRecord[] }) {
  const totals = works.reduce((acc, work) => ({
    plays: acc.plays + work.plays,
    likes: acc.likes + work.likes,
    comments: acc.comments + work.comments,
    favorites: acc.favorites + work.favorites,
    shares: acc.shares + work.shares,
  }), { plays: 0, likes: 0, comments: 0, favorites: 0, shares: 0 })

  const platforms = ['抖音', '小红书', 'B站', '视频号'] as const
  const byPlatform = platforms.map(platform => {
    const list = works.filter(work => work.platform === platform)
    return { platform, count: list.length, likes: list.reduce((sum, work) => sum + work.likes, 0) }
  })
  const maxCount = Math.max(1, ...byPlatform.map(item => item.count))
  const topWorks = works.slice().sort((a, b) => b.likes - a.likes).slice(0, 3)
  const avgScore = records.length ? Math.round(records.reduce((sum, record) => sum + record.total, 0) / records.length) : null
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`
  const recentCount = works.filter(work => work.publishedAt >= cutoffKey).length

  return <section className="pro-board data-board">
    <div className="metric-grid">
      <div className="metric-tile"><strong>{works.length}</strong><span>作品总数</span></div>
      <div className="metric-tile"><strong>{number(totals.plays)}</strong><span>总播放</span></div>
      <div className="metric-tile"><strong>{number(totals.likes)}</strong><span>总点赞</span></div>
      <div className="metric-tile"><strong>{number(totals.comments)}</strong><span>总评论</span></div>
      <div className="metric-tile"><strong>{number(totals.favorites)}</strong><span>总收藏</span></div>
      <div className="metric-tile"><strong>{number(totals.shares)}</strong><span>总分享</span></div>
      <div className="metric-tile"><strong>{avgScore ?? '—'}</strong><span>平均评分</span></div>
      <div className="metric-tile"><strong>{recentCount}</strong><span>近 30 天作品</span></div>
    </div>
    <div className="chart-card">
      <p className="eyebrow">平台分布</p>
      {byPlatform.map(item => <div className="bar-row" key={item.platform}>
        <span className="bar-label">{item.platform}</span>
        <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.round(item.count / maxCount * 100)}%` }} /></div>
        <small>{item.count} 条 · {number(item.likes)} 赞</small>
      </div>)}
    </div>
    <div className="chart-card">
      <p className="eyebrow">最受欢迎 TOP 3</p>
      {topWorks.length ? topWorks.map((work, index) => <div className="top-row" key={work.id}>
        <span className="top-rank">#{index + 1}</span>
        <strong>{work.title}</strong>
        <small>{number(work.likes)} 赞 · {number(work.plays)} 播放 · {work.platform}</small>
      </div>) : <p className="empty">记录作品后，这里会显示最受欢迎的三条。</p>}
    </div>
  </section>
}
