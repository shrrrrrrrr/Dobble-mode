import type { AppState } from './repository'

export interface BadgeRule {
  id: string
  name: string
  description: string
  target: number
  progress: (state: AppState) => number
}

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function recordDays(state: AppState): Set<string> {
  const days = new Set<string>()
  for (const work of state.works) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(work.publishedAt)) days.add(work.publishedAt)
  }
  for (const item of state.feedback) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(item.createdAt)) days.add(item.createdAt)
  }
  for (const post of state.posts) {
    const day = post.createdAt.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) days.add(day)
  }
  return days
}

function streakDays(state: AppState): number {
  const days = recordDays(state)
  if (days.size === 0) return 0
  const cursor = new Date()
  if (!days.has(localDateString(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!days.has(localDateString(cursor))) return 0
  }
  let streak = 0
  while (days.has(localDateString(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export const badgeRules: BadgeRule[] = [
  { id: 'first-work', name: '第一条作品', description: '记录第一条已发布的作品', target: 1, progress: state => state.works.length },
  { id: 'works-10', name: '勤劳记录者', description: '累计记录 10 条作品', target: 10, progress: state => state.works.length },
  { id: 'first-feedback', name: '珍藏时刻', description: '保存第一条珍藏反馈', target: 1, progress: state => state.feedback.length },
  { id: 'feedback-10', name: '值得被记住', description: '累计保存 10 条珍藏反馈', target: 10, progress: state => state.feedback.length },
  { id: 'first-post', name: '社区新声', description: '在社区发布第一条内容', target: 1, progress: state => state.posts.length },
  { id: 'posts-5', name: '社区常驻', description: '累计发布 5 条社区内容', target: 5, progress: state => state.posts.length },
  { id: 'likes-100', name: '被看见', description: '作品的累计点赞达到 100', target: 100, progress: state => state.works.reduce((sum, work) => sum + work.likes, 0) },
  { id: 'streak-7', name: '连续记录者', description: '连续 7 天都有创作记录', target: 7, progress: streakDays },
]

/**
 * Evaluates all rules and merges newly earned badges with the stored map,
 * keeping the earliest earned date for each badge.
 */
export function evaluateBadges(state: AppState): Record<string, string> {
  const earned = { ...state.badges }
  const today = localDateString(new Date())
  for (const rule of badgeRules) {
    if (!(rule.id in earned) && rule.progress(state) >= rule.target) {
      earned[rule.id] = today
    }
  }
  return earned
}
