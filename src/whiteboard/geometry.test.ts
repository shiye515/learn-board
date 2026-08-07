import { describe, expect, it } from 'vitest'
import { fitViewportToBounds, screenToWorld, zoomAt } from './geometry'

describe('whiteboard geometry', () => {
  it('round trips screen and world coordinates', () => {
    const viewport = { x: 120, y: -40, scale: 2 }
    expect(screenToWorld({ x: 220, y: 60 }, viewport)).toMatchObject({ x: 50, y: 50 })
  })

  it('keeps the zoom anchor stable', () => {
    const before = { x: 100, y: 50, scale: 1 }
    const after = zoomAt(before, { x: 240, y: 180 }, 2)
    expect(screenToWorld({ x: 240, y: 180 }, after)).toEqual(
      screenToWorld({ x: 240, y: 180 }, before),
    )
  })

  it('fits content inside a padded viewport', () => {
    const viewport = fitViewportToBounds({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 500, 400, 50)
    expect(viewport.scale).toBe(3)
    expect(viewport.x).toBe(100)
    expect(viewport.y).toBe(50)
  })
})
