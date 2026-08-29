export type Tab = 'home' | 'works' | 'memories' | 'community'
export type Platform = '抖音' | '小红书' | 'B站' | '视频号'

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
