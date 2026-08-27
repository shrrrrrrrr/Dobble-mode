export interface ThemePack {
  id: string
  name: string
  description: string
  tokens: Record<string, string>
}

export const themePacks: ThemePack[] = [
  {
    id: 'mint-desk',
    name: '薄荷桌面',
    description: '默认主题：柔和薄荷、半透明纸片和暖橘色记录点。',
    tokens: {
      canvas: '#dcefe6',
      paper: '#f6fbf7',
      ink: '#243a36',
      accent: '#2caa97',
      signal: '#ef825e',
    },
  },
]
