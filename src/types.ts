export type Tab = 'home' | 'works' | 'memories' | 'community'
export type Platform = '抖音' | '小红书' | 'B站' | '视频号'

export type Mode = 'life' | 'professional'
export type ProfessionalTab = 'topics' | 'scoring' | 'review' | 'data'

export type TopicStatus = 'idea' | 'planning' | 'creating' | 'published' | 'archived'
export type TopicSource = '灵感' | '热点' | '日常' | '改编'

export interface Topic {
  id: string
  title: string
  source: TopicSource
  note: string
  status: TopicStatus
  /** 1–5 创作潜力评分 */
  potential: number
  createdAt: string
  /** Links the topic to a published work. */
  workId?: string
}

export interface ScoreTemplateItem {
  id: string
  label: string
  /** Percentage weight; template items should sum to 100. */
  weight: number
}

export interface ScoreTemplate {
  id: string
  name: string
  items: ScoreTemplateItem[]
}

export interface ScoreRecord {
  id: string
  workId: string
  templateId: string
  /** itemId -> score 1..10 */
  scores: Record<string, number>
  /** Weighted total, 0–100. */
  total: number
  createdAt: string
  comment: string
}

export interface WorkReview {
  workId: string
  strengths: string
  problems: string
  next: string
  updatedAt: string
}

export interface Work {
  id: string
  title: string
  platform: Platform
  publishedAt: string
  cover: string
  coverImage?: string
  plays: number
  likes: number
  comments: number
  favorites: number
  shares: number
  note: string
  mood: '雀跃' | '平静' | '疲惫' | '骄傲'
}

export interface FeedbackEvent {
  id: string
  workId: string
  type: '点赞突破' | '暖心评论' | '被转发' | '自我认可'
  content: string
  createdAt: string
}

export interface Post {
  id: string
  /** Stable local account identity. Optional only for pre-V1.5 data. */
  userId?: string
  author: string
  avatar: string
  content: string
  image?: string
  imageCaption?: string
  createdAt: string
  likes: number
  liked: boolean
  comments: string[]
}

export interface UserProfile {
  nickname: string
  avatarLabel: string
  avatarImage?: string
}
