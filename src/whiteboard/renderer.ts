import { boundsOfElement, worldToScreen } from './geometry'
import type {
  Point,
  SelectionState,
  ViewportTransform,
  WhiteboardDocument,
  WhiteboardElement,
} from './model'

export function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const ratio = Math.max(1, Math.min(3, window.devicePixelRatio || 1))
  const nextWidth = Math.max(1, Math.round(width * ratio))
  const nextHeight = Math.max(1, Math.round(height * ratio))
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth
    canvas.height = nextHeight
  }
  return ratio
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  viewport: ViewportTransform,
  color: string,
  width: number,
) {
  if (!points.length) return
  ctx.beginPath()
  const first = worldToScreen(points[0], viewport)
  ctx.moveTo(first.x, first.y)
  if (points.length === 1) {
    ctx.arc(first.x, first.y, Math.max(1, (width * viewport.scale) / 2), 0, Math.PI * 2)
  } else {
    for (let index = 1; index < points.length; index++) {
      const point = worldToScreen(points[index], viewport)
      ctx.lineTo(point.x, point.y)
    }
  }
  ctx.strokeStyle = color
  ctx.lineWidth = width * viewport.scale
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}

function drawNote(
  ctx: CanvasRenderingContext2D,
  element: Extract<WhiteboardElement, { kind: 'note' }>,
  viewport: ViewportTransform,
) {
  const topLeft = worldToScreen({ x: element.x, y: element.y }, viewport)
  const width = element.width * viewport.scale
  const height = element.height * viewport.scale
  ctx.fillStyle = '#fffbd3'
  ctx.strokeStyle = '#d5c37c'
  ctx.lineWidth = 1
  ctx.fillRect(topLeft.x, topLeft.y, width, height)
  ctx.strokeRect(topLeft.x + 0.5, topLeft.y + 0.5, width - 1, height - 1)
  ctx.fillStyle = '#222'
  ctx.font = `${14 * viewport.scale}px Inter, sans-serif`
  const lines = element.text.split('\n')
  lines.forEach((line, index) =>
    ctx.fillText(
      line,
      topLeft.x + 10 * viewport.scale,
      topLeft.y + (21 + index * 19) * viewport.scale,
    ),
  )
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  document: WhiteboardDocument,
  selection: SelectionState,
  viewport: ViewportTransform,
) {
  const elements = document.elements.filter((element) => selection.ids.includes(element.id))
  if (elements.length) {
    const bounds = elements.map(boundsOfElement).reduce((total, current) => ({
      minX: Math.min(total.minX, current.minX),
      minY: Math.min(total.minY, current.minY),
      maxX: Math.max(total.maxX, current.maxX),
      maxY: Math.max(total.maxY, current.maxY),
    }))
    const topLeft = worldToScreen({ x: bounds.minX, y: bounds.minY }, viewport)
    ctx.save()
    ctx.setLineDash([5, 4])
    ctx.strokeStyle = '#0033aa'
    ctx.lineWidth = 1
    ctx.strokeRect(
      topLeft.x,
      topLeft.y,
      (bounds.maxX - bounds.minX) * viewport.scale,
      (bounds.maxY - bounds.minY) * viewport.scale,
    )
    ctx.restore()
  }
  if (selection.marquee) {
    const topLeft = worldToScreen(
      { x: selection.marquee.minX, y: selection.marquee.minY },
      viewport,
    )
    ctx.save()
    ctx.fillStyle = 'rgba(0,51,170,.10)'
    ctx.strokeStyle = '#0033aa'
    ctx.setLineDash([5, 4])
    ctx.fillRect(
      topLeft.x,
      topLeft.y,
      (selection.marquee.maxX - selection.marquee.minX) * viewport.scale,
      (selection.marquee.maxY - selection.marquee.minY) * viewport.scale,
    )
    ctx.strokeRect(
      topLeft.x,
      topLeft.y,
      (selection.marquee.maxX - selection.marquee.minX) * viewport.scale,
      (selection.marquee.maxY - selection.marquee.minY) * viewport.scale,
    )
    ctx.restore()
  }
}

export function drawWhiteboard(
  canvas: HTMLCanvasElement,
  document: WhiteboardDocument,
  viewport: ViewportTransform,
  selection: SelectionState,
  transientStroke?: { points: Point[]; color: string; width: number },
  ratio = 1,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const width = canvas.width / ratio
  const height = canvas.height / ratio
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, width, height)
  for (const element of document.elements) {
    if (element.kind === 'stroke')
      drawStroke(ctx, element.points, viewport, element.color, element.width)
    else drawNote(ctx, element, viewport)
  }
  if (transientStroke)
    drawStroke(ctx, transientStroke.points, viewport, transientStroke.color, transientStroke.width)
  drawSelection(ctx, document, selection, viewport)
}
