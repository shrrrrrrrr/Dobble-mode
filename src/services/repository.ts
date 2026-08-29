import type { ThemeId } from '../theme'
import { defaultScoreTemplate, initialProfile } from '../data'
import type { FeedbackEvent, Post, ScoreRecord, ScoreTemplate, Topic, UserProfile, Work, WorkReview } from '../types'

export type AppState = {
  works: Work[]
  feedback: FeedbackEvent[]
  posts: Post[]
  profile: UserProfile
  theme: ThemeId
  mode: 'life' | 'professional'
  topics: Topic[]
  scoreTemplates: ScoreTemplate[]
  scoreRecords: ScoreRecord[]
  reviews: WorkReview[]
  badges: Record<string, string>
  /** Last write timestamp (ISO). Used by cloud sync for last-write-wins. */
  updatedAt?: string
}

export interface AppRepository {
  load(): Promise<AppState>
  save(state: AppState): Promise<void>
}

export function emptyAppState(): AppState {
  return {
    works: [],
    feedback: [],
    posts: [],
    profile: { ...initialProfile },
    theme: 'mint',
    mode: 'life',
    topics: [],
    scoreTemplates: [{ ...defaultScoreTemplate, items: defaultScoreTemplate.items.map(item => ({ ...item })) }],
    scoreRecords: [],
    reviews: [],
    badges: {},
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPost(value: unknown): value is Post {
  return isRecord(value) && typeof value.id === 'string' && typeof value.author === 'string' && typeof value.content === 'string'
}

function isEntityWithId(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === 'string'
}

export function normalizeAppState(userId: string, parsed?: Partial<AppState> | null): AppState {
  const source = isRecord(parsed) ? parsed : {}
  const profile = isRecord(source.profile)
    ? { ...initialProfile, ...source.profile }
    : { ...initialProfile }
  const posts = Array.isArray(source.posts) ? source.posts.filter(isPost) : []
  const theme = source.theme === 'cream' || source.theme === 'night' ? source.theme : 'mint'
  const scoreTemplates = Array.isArray(source.scoreTemplates) && source.scoreTemplates.length > 0
    ? source.scoreTemplates.filter(isEntityWithId)
    : emptyAppState().scoreTemplates
  const badges = isRecord(source.badges)
    ? Object.fromEntries(Object.entries(source.badges).filter(([, value]) => typeof value === 'string'))
    : {}
  return {
    ...emptyAppState(),
    ...source,
    profile,
    theme,
    mode: source.mode === 'professional' ? 'professional' : 'life',
    works: Array.isArray(source.works) ? source.works : [],
    feedback: Array.isArray(source.feedback) ? source.feedback : [],
    posts: posts.map(post => ({
      ...post,
      // V1.5 adds stable ownership. Existing posts can be matched safely while
      // the old nickname is still the current nickname.
      userId: post.userId ?? (post.author === profile.nickname ? userId : undefined),
    })),
    topics: Array.isArray(source.topics) ? source.topics.filter(isEntityWithId) : [],
    scoreTemplates,
    scoreRecords: Array.isArray(source.scoreRecords) ? source.scoreRecords.filter(isEntityWithId) : [],
    reviews: Array.isArray(source.reviews) ? source.reviews.filter(isRecord) : [],
    badges,
  }
}

const dataKey = (userId: string) => `creator-life-v2:data:${userId}`

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export class LocalAppRepository implements AppRepository {
  private readonly storage: StorageLike
  private readonly userId: string
  private readonly key: string

  constructor(userId: string, storage: StorageLike = window.localStorage) {
    this.userId = userId
    this.key = dataKey(userId)
    this.storage = storage
  }

  async load(): Promise<AppState> {
    try {
      const saved = this.storage.getItem(this.key)
      const parsed = saved ? JSON.parse(saved) as Partial<AppState> : null
      return normalizeAppState(this.userId, parsed)
    } catch {
      return emptyAppState()
    }
  }

  async save(state: AppState): Promise<void> {
    this.storage.setItem(this.key, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }))
  }
}
