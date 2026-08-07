import { describe, expect, it } from 'vitest'
import { createEmptyDocument, type StrokeElement } from './model'

describe('whiteboard performance fixture', () => {
  it('creates the target 500-stroke / 100-point workload without shared mutable state', () => {
    const document = createEmptyDocument()
    const strokes: StrokeElement[] = Array.from({ length: 500 }, (_, strokeIndex) => ({
      kind: 'stroke',
      id: `fixture-${strokeIndex}`,
      color: '#222222',
      width: 3,
      createdAt: strokeIndex,
      points: Array.from({ length: 100 }, (_, pointIndex) => ({
        x: strokeIndex * 4 + pointIndex,
        y: (strokeIndex % 20) * 12 + Math.sin(pointIndex / 8) * 10,
        pressure: 0.5,
      })),
    }))

    const populated = { ...document, elements: strokes }
    expect(populated.elements).toHaveLength(500)
    expect(populated.elements.every(element => element.kind === 'stroke' && element.points.length === 100)).toBe(true)
    expect(populated.elements[0]).not.toBe(populated.elements[1])
  })
})
