import { boundsOfDocument } from './geometry'
import type { ViewportTransform, WhiteboardDocument } from './model'
import { drawWhiteboard, resizeCanvas } from './renderer'

export function exportBoardPng(board: WhiteboardDocument) {
  const bounds = boundsOfDocument(board)
  if (!bounds) return false
  const padding = 32
  const width = Math.max(1, Math.ceil(bounds.maxX - bounds.minX + padding * 2))
  const height = Math.max(1, Math.ceil(bounds.maxY - bounds.minY + padding * 2))
  const canvas = window.document.createElement('canvas')
  const viewport: ViewportTransform = { scale: 1, x: padding - bounds.minX, y: padding - bounds.minY }
  const ratio = resizeCanvas(canvas, width, height)
  drawWhiteboard(canvas, board, viewport, { ids: [], marquee: null }, undefined, ratio)
  const link = window.document.createElement('a')
  link.download = `canvas-room-${new Date().toISOString().slice(0, 10)}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
  return true
}
