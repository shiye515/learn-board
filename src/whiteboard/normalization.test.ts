import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { createEmptyDocument, type StrokeElement } from './model'
import {
  commonSymbolSchema,
  knownShapeSchema,
  modelInferenceToPublic,
  modelShapeInferenceSchema,
  normalizationRequestSchema,
  normalizeSelectedStrokes,
  createPreviewPng,
  selectedStrokes,
  selectionIsEligible,
  simplifyRdp,
} from './normalization'

const stroke = (id: string, color: StrokeElement['color'] = '#222222'): StrokeElement => ({
  kind: 'stroke',
  id,
  color,
  width: 3,
  createdAt: 1,
  points: [
    { x: 0, y: 0, pressure: 0.4 },
    { x: 20, y: 0, pressure: 0.5 },
    { x: 20, y: 20, pressure: 0.6 },
  ],
})

describe('shape normalization contract', () => {
  it('rejects unknown fields and invalid vector templates', () => {
    expect(
      knownShapeSchema.safeParse({
        kind: 'known-shape',
        shape: 'circle',
        confidence: 0.9,
        extra: true,
      }).success,
    ).toBe(false)
    expect(
      commonSymbolSchema.safeParse({
        kind: 'common-symbol',
        symbolName: 'bell',
        confidence: 0.9,
        paths: [
          {
            closed: true,
            segments: [
              { type: 'move', to: [0, 0] },
              { type: 'line', to: [2, 0] },
            ],
          },
        ],
      }).success,
    ).toBe(false)
  })

  it('limits selection to same-style strokes and excludes notes', () => {
    const document = { ...createEmptyDocument(), elements: [stroke('a'), stroke('b')] }
    expect(selectedStrokes(document, ['a', 'b'])).toHaveLength(2)
    expect(selectionIsEligible(document, ['a', 'b'], 1)).toBe(true)
    expect(selectionIsEligible(document, ['a', 'missing'], 1)).toBe(false)
    expect(
      selectionIsEligible(
        {
          ...document,
          elements: [
            stroke('a'),
            {
              kind: 'note',
              id: 'n',
              x: 0,
              y: 0,
              width: 10,
              height: 10,
              text: 'private',
              createdAt: 1,
            },
          ],
        },
        ['a', 'n'],
        1,
      ),
    ).toBe(false)
  })

  it('normalizes paths to local units without pressure or style data', () => {
    const result = normalizeSelectedStrokes([stroke('a')])
    expect(result[0]).toEqual({
      closed: false,
      points: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
    })
    expect(
      normalizationRequestSchema.safeParse({
        strokes: result,
        aspectRatio: 1,
        preview: { mimeType: 'image/png', width: 256, height: 256, base64: 'x', byteLength: 1 },
      }).success,
    ).toBe(true)
  })

  it('uses deterministic RDP simplification', () => {
    expect(
      simplifyRdp(
        [
          { x: 0, y: 0 },
          { x: 0.01, y: 0 },
          { x: 1, y: 0 },
        ],
        0.02,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ])
  })

  it('reports the exact decoded PNG byte length when base64 has padding', () => {
    const context = {
      fillRect: () => undefined,
      beginPath: () => undefined,
      moveTo: () => undefined,
      lineTo: () => undefined,
      stroke: () => undefined,
    } as unknown as CanvasRenderingContext2D
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
      toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=',
    } as unknown as HTMLCanvasElement

    expect(createPreviewPng([stroke('a')], canvas).byteLength).toBe(8)
  })

  it('uses a Cloudflare-compatible model schema and converts coordinates to public tuples', () => {
    const schema = z.toJSONSchema(modelShapeInferenceSchema)
    const containsTupleItems = (value: unknown): boolean => {
      if (Array.isArray(value)) return value.some(containsTupleItems)
      if (!value || typeof value !== 'object') return false
      const record = value as Record<string, unknown>
      return Array.isArray(record.items) || Object.values(record).some(containsTupleItems)
    }
    expect(containsTupleItems(schema)).toBe(false)
    expect(
      modelInferenceToPublic({
        kind: 'common-symbol',
        symbolName: 'arrow',
        confidence: 0.9,
        paths: [
          {
            closed: false,
            segments: [
              { type: 'move', to: { x: 0, y: 0.5 } },
              { type: 'line', to: { x: 1, y: 0.5 } },
            ],
          },
        ],
      }),
    ).toEqual({
      kind: 'common-symbol',
      symbolName: 'arrow',
      confidence: 0.9,
      paths: [
        {
          closed: false,
          segments: [
            { type: 'move', to: [0, 0.5] },
            { type: 'line', to: [1, 0.5] },
          ],
        },
      ],
    })
  })
})
