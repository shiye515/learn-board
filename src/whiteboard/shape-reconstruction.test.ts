import { describe, expect, it } from 'vitest'
import { reconstructShape } from './shape-reconstruction'
import { principalAxis } from './shape-geometry'
import type { StrokeElement } from './model'
import { commit, createHistory, redo, undo } from './history'

const source: StrokeElement = {
  kind: 'stroke',
  id: 'source',
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
  ],
  color: '#cc0000',
  width: 7,
  createdAt: 10,
}
const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 80 }

describe('shape reconstruction', () => {
  it('places a rotated rectangle horizontally after reconstruction', () => {
    const angle = 0.42
    const cosine = Math.cos(angle)
    const sine = Math.sin(angle)
    const rotate = (x: number, y: number) => ({
      x: 180 + x * cosine - y * sine,
      y: 140 + x * sine + y * cosine,
    })
    const base = [
      [-70, -35],
      [-35, -35],
      [0, -35],
      [35, -35],
      [70, -35],
      [70, 0],
      [70, 35],
      [35, 35],
      [0, 35],
      [-35, 35],
      [-70, 35],
      [-70, 0],
      [-70, -35],
    ]
    const points = base.map(([x, y]) => rotate(x, y))
    const result = reconstructShape(
      { kind: 'known-shape', shape: 'rectangle', confidence: 0.98 },
      [{ ...source, points }],
      { minX: 100, minY: 70, maxX: 260, maxY: 210 },
    )
    expect(result).not.toBeNull()
    expect(result![0].points.length).toBeGreaterThan(5)
    const resultAxis = principalAxis(result![0].points)
    expect(Math.abs(Math.sin(resultAxis.angle))).toBeLessThan(0.05)
  })

  it('reconstructs a non-isosceles triangle from its fitted corner points', () => {
    const trianglePoints = [
      { x: 90, y: 20 },
      { x: 110, y: 53 },
      { x: 130, y: 87 },
      { x: 150, y: 120 },
      { x: 107, y: 130 },
      { x: 63, y: 140 },
      { x: 20, y: 150 },
      { x: 43, y: 107 },
      { x: 67, y: 63 },
      { x: 90, y: 20 },
    ]
    const result = reconstructShape(
      { kind: 'known-shape', shape: 'triangle', confidence: 0.98 },
      [{ ...source, points: trianglePoints }],
      { minX: 20, minY: 20, maxX: 150, maxY: 150 },
    )
    expect(result).not.toBeNull()
    expect(result![0].points.length).toBeGreaterThan(4)
    expect(result![0].points[0]).toEqual(result![0].points.at(-1))
    const maxY = Math.max(...result![0].points.map(({ y }) => y))
    expect(result![0].points.filter(({ y }) => Math.abs(y - maxY) < 0.01).length).toBeGreaterThan(1)
  })

  it('creates regular known shapes while preserving style', () => {
    const result = reconstructShape(
      { kind: 'known-shape', shape: 'five-point-star', confidence: 0.95 },
      [source],
      bounds,
    )!
    expect(result).toHaveLength(1)
    expect(result[0].points).toHaveLength(11)
    expect(result[0].color).toBe('#cc0000')
    expect(result[0].width).toBe(7)
    expect(result[0].id).not.toBe('source')
  })

  it('maps bounded common-symbol paths to the source bounds', () => {
    const sourceTriangle = {
      ...source,
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 80 },
      ],
    }
    const result = reconstructShape(
      {
        kind: 'common-symbol',
        symbolName: 'heart',
        confidence: 0.9,
        paths: [
          {
            closed: true,
            segments: [
              { type: 'move', to: [0.2, 0.2] },
              { type: 'line', to: [0.8, 0.2] },
              { type: 'line', to: [0.5, 0.9] },
            ],
          },
        ],
      },
      [sourceTriangle],
      bounds,
    )!
    expect(result[0].points[0]).toEqual({ x: 0, y: 0 })
    expect(result[0].points.at(-1)).toEqual(result[0].points[0])
  })

  it('supports every known shape label and preserves a single atomic timestamp', () => {
    const shapes = [
      'circle',
      'ellipse',
      'square',
      'rectangle',
      'triangle',
      'parallelogram',
      'pentagon',
      'hexagon',
      'five-point-star',
    ] as const
    for (const shape of shapes) {
      const result = reconstructShape(
        { kind: 'known-shape', shape, confidence: 0.95 },
        [source],
        bounds,
      )!
      expect(result.length).toBe(1)
      expect(result[0].color).toBe(source.color)
      expect(result[0].width).toBe(source.width)
    }
  })

  it('keeps replacement IDs and timestamps stable through undo and redo', () => {
    const replacement = reconstructShape(
      { kind: 'known-shape', shape: 'circle', confidence: 0.95 },
      [source],
      bounds,
    )!
    const before = { version: 1 as const, elements: [source] }
    const after = { version: 1 as const, elements: replacement }
    const history = commit(createHistory(), before, after, '标准化图形')
    const undone = undo(history, after)
    const redone = redo(undone.history, undone.document)
    expect(redone.document).toEqual(after)
  })

  it('returns no replacement only for unsupported or low-confidence results', () => {
    expect(reconstructShape({ kind: 'unsupported', confidence: 0.2 }, [source], bounds)).toBeNull()
    expect(
      reconstructShape(
        {
          kind: 'common-symbol',
          symbolName: 'heart',
          confidence: 0.84,
          paths: [
            {
              closed: true,
              segments: [
                { type: 'move', to: [0, 0] },
                { type: 'line', to: [1, 0] },
                { type: 'line', to: [1, 1] },
                { type: 'line', to: [0, 1] },
              ],
            },
          ],
        },
        [source],
        bounds,
      ),
    ).toBeNull()

    const elongatedSource: StrokeElement = {
      ...source,
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 40, y: 0 },
        { x: 60, y: 0 },
        { x: 80, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 4 },
        { x: 0, y: 4 },
      ],
    }
    expect(
      reconstructShape(
        { kind: 'known-shape', shape: 'circle', confidence: 0.95 },
        [elongatedSource],
        { minX: 0, minY: 0, maxX: 100, maxY: 4 },
      ),
    ).not.toBeNull()
  })

  it('accepts a normally sized multi-point circle using normalized contour distances', () => {
    const circleSource: StrokeElement = {
      ...source,
      points: Array.from({ length: 49 }, (_, index) => ({
        x: 80 + Math.cos((index * Math.PI * 2) / 48) * 80,
        y: 80 + Math.sin((index * Math.PI * 2) / 48) * 80,
      })),
    }
    const result = reconstructShape(
      { kind: 'known-shape', shape: 'circle', confidence: 1 },
      [circleSource],
      { minX: 0, minY: 0, maxX: 160, maxY: 160 },
    )
    expect(result).not.toBeNull()
  })

  it('converts a near-circle ellipse into a true circle', () => {
    const result = reconstructShape(
      { kind: 'known-shape', shape: 'ellipse', confidence: 0.95 },
      [
        {
          ...source,
          points: Array.from({ length: 49 }, (_, index) => ({
            x: 80 + Math.cos((index * Math.PI * 2) / 48) * 80,
            y: 80 + Math.sin((index * Math.PI * 2) / 48) * 86,
          })),
        },
      ],
      { minX: 0, minY: 0, maxX: 160, maxY: 172 },
    )!
    expect(principalAxis(result[0].points).ratio).toBeLessThan(1.02)
  })

  it('converts near-square rectangles and diamonds into squares', () => {
    const square = reconstructShape(
      { kind: 'known-shape', shape: 'rectangle', confidence: 0.95 },
      [
        {
          ...source,
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 105 },
            { x: 0, y: 105 },
            { x: 0, y: 0 },
          ],
        },
      ],
      { minX: 0, minY: 0, maxX: 100, maxY: 105 },
    )!
    const diamond = reconstructShape(
      { kind: 'known-shape', shape: 'parallelogram', confidence: 0.95 },
      [
        {
          ...source,
          points: [
            { x: 50, y: 0 },
            { x: 105, y: 50 },
            { x: 50, y: 105 },
            { x: 0, y: 50 },
            { x: 50, y: 0 },
          ],
        },
      ],
      { minX: 0, minY: 0, maxX: 105, maxY: 105 },
    )!
    expect(principalAxis(square[0].points).ratio).toBeLessThan(1.02)
    expect(principalAxis(diamond[0].points).ratio).toBeLessThan(1.02)
  })

  it('uses a circular radius for near-regular polygons', () => {
    const result = reconstructShape(
      { kind: 'known-shape', shape: 'pentagon', confidence: 0.95 },
      [source],
      { minX: 0, minY: 0, maxX: 100, maxY: 105 },
    )!
    expect(principalAxis(result[0].points).ratio).toBeLessThan(1.02)
  })
})
