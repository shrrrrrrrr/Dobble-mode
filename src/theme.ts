export type ThemeId = 'mint' | 'cream' | 'night'
export type SeasonId = 'spring' | 'summer' | 'autumn' | 'winter'

export interface SeasonPack {
  id: SeasonId
  name: string
  image: string
  accent: string
}

export const seasonPacks: SeasonPack[] = [
  { id: 'spring', name: '春 · 春日校园', image: '/assets/seasons/spring-ui.jpg', accent: '#d87891' },
  { id: 'summer', name: '夏 · 盛夏校园', image: '/assets/seasons/summer.jpg', accent: '#299b91' },
  { id: 'autumn', name: '秋 · 秋日校园', image: '/assets/seasons/autumn.jpg', accent: '#c7773e' },
  { id: 'winter', name: '冬 · 冬日校园', image: '/assets/seasons/winter-ui.jpg', accent: '#5e9ec9' },
]

export interface ThemePack {
  id: ThemeId
  name: string
  shortName: string
  description: string
  available: boolean
  /** 按界面实际显示尺寸生成的轻量角色图，原始素材仍保留用于后续设计。 */
  companionImage: string
  backgroundVideo?: string
  poster?: string
}

export const themePacks: ThemePack[] = [
  { id: 'mint', name: '默认主题', shortName: '默认', description: '浅蓝像素桌面与动态骑行背景。', available: true, companionImage: '/assets/companions/mint-companion-ui.png', backgroundVideo: '/assets/pixel-original-clean.mp4', poster: '/assets/pixel-original-poster.jpg' },
  { id: 'cream', name: '北航四季', shortName: '北航', description: '蓝色校园像素材质与四季背景。', available: true, companionImage: '/assets/companions/cream-companion-ui.png' },
  { id: 'night', name: '樱花夜', shortName: '樱花', description: '明亮樱花背景与循环飘落花瓣。', available: true, companionImage: '/assets/companions/night-companion-ui.png', poster: '/assets/sakura/background.jpg' },
]

export function getThemePack(themeId?: string) {
  return themePacks.find(theme => theme.id === themeId && theme.available) ?? themePacks[0]
}
