export type ThemeId = 'mint' | 'cream' | 'night'
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter'

export interface SeasonPack {
  id: SeasonId
  name: string
  image: string
  accent: string
}

export const seasonPacks: SeasonPack[] = [
  { id: 'spring', name: '春 · 春枝校徽', image: '/assets/seasons/spring.jpg', accent: '#d87891' },
  { id: 'summer', name: '夏 · 盛夏校园', image: '/assets/seasons/summer.jpg', accent: '#299b91' },
  { id: 'autumn', name: '秋 · 启航碑前', image: '/assets/seasons/autumn.jpg', accent: '#c7773e' },
  { id: 'winter', name: '冬 · 初雪窗台', image: '/assets/seasons/winter.jpg', accent: '#5e9ec9' },
]

export interface ThemePack {
  id: ThemeId
  name: string
  shortName: string
  description: string
  available: boolean
  backgroundVideo?: string
  poster?: string
}

export const themePacks: ThemePack[] = [
  { id: 'mint', name: '默认主题', shortName: '默认', description: '浅蓝像素桌面与动态骑行背景。', available: true, backgroundVideo: '/assets/pixel-loop.webm', poster: '/assets/pixel-loop-preview.png' },
  { id: 'cream', name: '北航四季', shortName: '北航', description: '蓝色校园像素材质与四季背景。', available: true },
  { id: 'night', name: '主题二', shortName: '待定', description: '视觉方案尚未确认。', available: false },
]

export function getThemePack(themeId?: string) {
  return themePacks.find(theme => theme.id === themeId && theme.available) ?? themePacks[0]
}
