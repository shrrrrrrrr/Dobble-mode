import { initialProfile } from '../data'
import type { FeedbackEvent, Post, UserProfile, Work } from '../types'

export const legacyStorageKey = 'creator-life-v1'

export type LegacyAppState = {
  works: Work[]
  feedback: FeedbackEvent[]
  posts: Post[]
  profile: UserProfile
}

function importStatusKey(userId: string) {
  return `creator-life-v2:v1-import:${userId}`
}

export function isEmptyAppState(state: Pick<LegacyAppState, 'works' | 'feedback' | 'posts'>) {
  return state.works.length === 0 && state.feedback.length === 0 && state.posts.length === 0
}

export function readLegacyV1Data(): LegacyAppState | null {
  try {
    const saved = localStorage.getItem(legacyStorageKey)
    if (!saved) return null
    const parsed = JSON.parse(saved) as Partial<LegacyAppState>
    if (!parsed || typeof parsed !== 'object') return null
    return {
      works: Array.isArray(parsed.works) ? parsed.works : [],
      feedback: Array.isArray(parsed.feedback) ? parsed.feedback : [],
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      profile: parsed.profile ?? initialProfile,
    }
  } catch {
    return null
  }
}

export function hasLegacyV1Data() {
  const legacy = readLegacyV1Data()
  return legacy !== null && !isEmptyAppState(legacy)
}

export function getLegacyImportStatus(userId: string): 'pending' | 'imported' | 'dismissed' {
  const saved = localStorage.getItem(importStatusKey(userId))
  return saved === 'imported' || saved === 'dismissed' ? saved : 'pending'
}

export function shouldOfferLegacyImport(userId: string, state: Pick<LegacyAppState, 'works' | 'feedback' | 'posts'>) {
  if (getLegacyImportStatus(userId) !== 'pending') return false
  if (!hasLegacyV1Data()) return false
  return isEmptyAppState(state)
}

export function importLegacyV1Data(): LegacyAppState | null {
  const legacy = readLegacyV1Data()
  if (!legacy || isEmptyAppState(legacy)) return null
  return legacy
}

export function markLegacyImported(userId: string) {
  localStorage.setItem(importStatusKey(userId), 'imported')
}

export function markLegacyDismissed(userId: string) {
  localStorage.setItem(importStatusKey(userId), 'dismissed')
}
