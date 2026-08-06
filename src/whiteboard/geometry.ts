import type { Bounds, Point, ViewportTransform, WhiteboardDocument, WhiteboardElement } from './model'

export const MIN_SCALE = 0.1
export const MAX_SCALE = 8

export function clampScale(scale: number) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

export function screenToWorld(point: Point, viewport: ViewportTransform): Point {
  return { x: (point.x - viewport.x) / viewport.scale, y: (point.y - viewport.y) / viewport.scale, pressure: point.pressure }
}

export function worldToScreen(point: Point, viewport: ViewportTransform): Point {
  return { x: point.x * viewport.scale + viewport.x, y: point.y * viewport.scale + viewport.y, pressure: point.pressure }
}

export function zoomAt(viewport: ViewportTransform, screenPoint: Point, nextScale: number): ViewportTransform {
  const scale = clampScale(nextScale)
  const worldPoint = screenToWorld(screenPoint, viewport)
  return { scale, x: screenPoint.x - worldPoint.x * scale, y: screenPoint.y - worldPoint.y * scale }
}

export function normalizeBounds(bounds: Bounds): Bounds {
  return { minX: Math.min(bounds.minX, bounds.maxX), minY: Math.min(bounds.minY, bounds.maxY), maxX: Math.max(bounds.minX, bounds.maxX), maxY: Math.max(bounds.minY, bounds.maxY) }
}

export function boundsOfElement(element: WhiteboardElement): Bounds {
  if (element.kind === 'note') return { minX: element.x, minY: element.y, maxX: element.x + element.width, maxY: element.y + element.height }
  const padding = element.width / 2
  const points = element.points.length ? element.points : [{ x: 0, y: 0 }]
  return { minX: Math.min(...points.map((point) => point.x)) - padding, minY: Math.min(...points.map((point) => point.y)) - padding, maxX: Math.max(...points.map((point) => point.x)) + padding, maxY: Math.max(...points.map((point) => point.y)) + padding }
}

export function boundsOfDocument(document: WhiteboardDocument): Bounds | null {
  if (!document.elements.length) return null
  return document.elements.map(boundsOfElement).reduce((total, current) => ({ minX: Math.min(total.minX, current.minX), minY: Math.min(total.minY, current.minY), maxX: Math.max(total.maxX, current.maxX), maxY: Math.max(total.maxY, current.maxY) }))
}

export function fitViewportToBounds(bounds: Bounds | null, width: number, height: number, padding = 64): ViewportTransform {
  if (!bounds) return { x: width / 2, y: height / 2, scale: 1 }
  const contentWidth = Math.max(bounds.maxX - bounds.minX, 1)
  const contentHeight = Math.max(bounds.maxY - bounds.minY, 1)
  const scale = clampScale(Math.min((width - padding * 2) / contentWidth, (height - padding * 2) / contentHeight))
  return { scale, x: width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale, y: height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale }
}

export function expandBounds(bounds: Bounds | null, point: Point): Bounds {
  if (!bounds) return { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y }
  return { minX: Math.min(bounds.minX, point.x), minY: Math.min(bounds.minY, point.y), maxX: Math.max(bounds.maxX, point.x), maxY: Math.max(bounds.maxY, point.y) }
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function pointToSegmentDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return distance(point, start)
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)))
  return distance(point, { x: start.x + t * dx, y: start.y + t * dy })
}

export function elementIntersectsBounds(element: WhiteboardElement, bounds: Bounds) {
  const elementBounds = boundsOfElement(element)
  return !(elementBounds.maxX < bounds.minX || elementBounds.minX > bounds.maxX || elementBounds.maxY < bounds.minY || elementBounds.minY > bounds.maxY)
}
