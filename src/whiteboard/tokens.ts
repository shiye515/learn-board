export const whiteboardTokens = {
  statusBarHeight: 20,
  controlSize: 48,
  controlGap: 16,
  drawerWidth: 224,
  paletteWidth: 132,
  border: '#d7d7d7',
  controlBackground: '#ffffff',
  activeBackground: '#222222',
  mutedBackground: '#ededed',
  mutedForeground: '#aaaaaa',
  viewControlBackground: '#d2d2d2',
  canvasBackground: '#ffffff',
  menuBackground: '#ffffff',
  menuHeader: '#222222',
  overlay: 'rgba(0, 0, 0, 0.42)',
  colors: ['#222222', '#0033aa', '#cc0000'] as const,
} as const

export type WhiteboardTokens = typeof whiteboardTokens
