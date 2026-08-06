export const DOCUMENT_VERSION = 1 as const

export type Tool = 'pen' | 'eraser' | 'note' | 'select' | 'pan'
export type StrokeColor = '#222222' | '#0033aa' | '#cc0000'

export type Point = {
  x: number
  y: number
  pressure?: number
}

export type StrokeElement = {
  kind: 'stroke'
  id: string
  points: Point[]
  color: StrokeColor
  width: number
  createdAt: number
}

export type NoteElement = {
  kind: 'note'
  id: string
  x: number
  y: number
  width: number
  height: number
  text: string
  createdAt: number
}

export type WhiteboardElement = StrokeElement | NoteElement

export type WhiteboardDocument = {
  version: typeof DOCUMENT_VERSION
  elements: WhiteboardElement[]
}

export type ViewportTransform = {
  x: number
  y: number
  scale: number
}

export type Bounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type SelectionState = {
  ids: string[]
  marquee: Bounds | null
}

export const DEFAULT_VIEWPORT: ViewportTransform = { x: 0, y: 0, scale: 1 }
export const EMPTY_SELECTION: SelectionState = { ids: [], marquee: null }

export function createEmptyDocument(): WhiteboardDocument {
  return { version: DOCUMENT_VERSION, elements: [] }
}

export function cloneDocument(document: WhiteboardDocument): WhiteboardDocument {
  return structuredClone(document)
}

export function isWhiteboardDocument(value: unknown): value is WhiteboardDocument {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<WhiteboardDocument>
  return candidate.version === DOCUMENT_VERSION && Array.isArray(candidate.elements)
}
