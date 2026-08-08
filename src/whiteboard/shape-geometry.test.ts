import { describe, expect, it } from 'vitest'
import {
  joinStrokeEndpoints,
  principalAxis,
  SHAPE_STRATEGIES,
  symmetricMetrics,
} from './shape-geometry'
import type { StrokeElement } from './model'

const make = (id: string, points: { x: number; y: number }[]): StrokeElement => ({
  kind: 'stroke',
  id,
  points,
  color: '#222222',
  width: 3,
  createdAt: 1,
})

describe('shape geometry strategies', () => {
  it('exposes fixed confidence gates and measures principal axes', () => {
    expect(SHAPE_STRATEGIES.circle.confidence).toBe(0.8)
    expect(
      principalAxis([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ]).ratio,
    ).toBeGreaterThan(10)
  })

  it('joins endpoint-connected paths and reverses when needed', () => {
    const joined = joinStrokeEndpoints(
      [
        make('a', [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ]),
        make('b', [
          { x: 20, y: 0 },
          { x: 10, y: 0 },
        ]),
      ],
      20,
    )!
    expect(joined).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
    ])
    expect(
      joinStrokeEndpoints(
        [
          make('a', [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
          ]),
          make('b', [
            { x: 10, y: 0 },
            { x: 20, y: 0 },
          ]),
          make('c', [
            { x: 10, y: 0 },
            { x: 10, y: 10 },
          ]),
        ],
        20,
      ),
    ).toBeNull()
  })

  it('calculates symmetric RMS and Hausdorff distances', () => {
    expect(
      symmetricMetrics(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
      ),
    ).toEqual({ rms: 0, hausdorff: 0 })
  })
})
