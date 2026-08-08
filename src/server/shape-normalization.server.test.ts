import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runtimeEnv: {
    AI: { run: vi.fn() },
    AI_ACTOR_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    AI_COLO_RATE_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
  },
}))

vi.mock('cloudflare:workers', () => ({ env: mocks.runtimeEnv }))

import { inferShape } from './shape-normalization.server'

const validInput = {
  strokes: [
    {
      closed: false,
      points: [
        [0, 0],
        [0.5, 0.1],
        [1, 1],
      ],
    },
  ],
  aspectRatio: 1,
  preview: {
    mimeType: 'image/png' as const,
    width: 256 as const,
    height: 256 as const,
    base64: btoa('\x89PNG\r\n\x1a\n'),
    byteLength: 8,
  },
}

describe('Workers AI shape service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runtimeEnv.AI_ACTOR_RATE_LIMITER.limit.mockResolvedValue({ success: true })
    mocks.runtimeEnv.AI_COLO_RATE_LIMITER.limit.mockResolvedValue({ success: true })
  })

  it('rejects invalid data before consuming rate limits or calling AI', async () => {
    const result = await inferShape({ ...validInput, strokes: [] }, 'request-1', 'unknown')
    expect(result.kind).toBe('invalid-input')
    expect(mocks.runtimeEnv.AI_ACTOR_RATE_LIMITER.limit).not.toHaveBeenCalled()
    expect(mocks.runtimeEnv.AI.run).not.toHaveBeenCalled()
  })

  it('applies actor then colo limits and returns a public rate-limited result', async () => {
    mocks.runtimeEnv.AI_COLO_RATE_LIMITER.limit.mockResolvedValue({ success: false })
    const result = await inferShape(validInput, 'request-2', 'actor')
    expect(result).toEqual({ kind: 'rate-limited', requestId: 'request-2' })
    expect(mocks.runtimeEnv.AI_ACTOR_RATE_LIMITER.limit).toHaveBeenCalledBefore(
      mocks.runtimeEnv.AI_COLO_RATE_LIMITER.limit,
    )
    expect(mocks.runtimeEnv.AI.run).not.toHaveBeenCalled()
  })

  it('validates model output and exposes only the public descriptor', async () => {
    mocks.runtimeEnv.AI.run.mockResolvedValue({
      response: JSON.stringify({
        recognizable: true,
        category: 'circle',
        symbolName: '',
        confidence: 0.95,
        secret: 'removed',
      }),
    })
    const result = await inferShape(validInput, 'request-3', 'actor', vi.fn())
    expect(result).toEqual({ kind: 'invalid-output', requestId: 'request-3' })
  })

  it('returns a schema-validated known shape through native guided JSON', async () => {
    mocks.runtimeEnv.AI.run.mockResolvedValue({
      response: JSON.stringify({
        recognizable: true,
        category: 'circle',
        symbolName: '',
        confidence: 0.95,
      }),
    })
    const result = await inferShape(validInput, 'request-4', 'actor', vi.fn())
    expect(result).toEqual({ kind: 'known-shape', shape: 'circle', confidence: 0.95 })
    expect(mocks.runtimeEnv.AI.run).toHaveBeenCalledWith(
      '@cf/mistralai/mistral-small-3.1-24b-instruct',
      expect.objectContaining({ guided_json: expect.any(Object), max_tokens: 256, temperature: 0 }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(mocks.runtimeEnv.AI.run).toHaveBeenCalledTimes(1)
  })

  it('uses a conservative confidence when a recognizable known shape omits it', async () => {
    mocks.runtimeEnv.AI.run.mockResolvedValue({
      response: JSON.stringify({
        recognizable: true,
        category: 'rectangle',
        symbolName: '',
      }),
    })
    const result = await inferShape(validInput, 'request-confidence', 'actor', vi.fn())
    expect(result).toEqual({ kind: 'known-shape', shape: 'rectangle', confidence: 0.9 })
  })

  it('accepts a known shape when optional semantic fields are omitted', async () => {
    mocks.runtimeEnv.AI.run.mockResolvedValue({
      response: JSON.stringify({ category: 'parallelogram' }),
    })
    const result = await inferShape(validInput, 'request-optional-fields', 'actor', vi.fn())
    expect(result).toEqual({ kind: 'known-shape', shape: 'parallelogram', confidence: 0.9 })
  })

  it('recovers a classified shape from a short model explanation', async () => {
    mocks.runtimeEnv.AI.run.mockResolvedValue({
      response: 'The category is parallelogram and confidence is 0.9.',
    })
    const result = await inferShape(validInput, 'request-text-recovery', 'actor', vi.fn())
    expect(result).toEqual({ kind: 'known-shape', shape: 'parallelogram', confidence: 0.9 })
  })

  it('generates a vector template only after classifying a common symbol', async () => {
    mocks.runtimeEnv.AI.run
      .mockResolvedValueOnce({
        response: JSON.stringify({
          recognizable: true,
          category: 'common-symbol',
          symbolName: 'heart',
          confidence: 0.95,
        }),
      })
      .mockResolvedValueOnce({
        response: JSON.stringify({
          kind: 'common-symbol',
          symbolName: 'heart',
          confidence: 0.95,
          paths: [
            {
              closed: true,
              segments: [
                { type: 'move', to: { x: 0.5, y: 1 } },
                { type: 'line', to: { x: 0.1, y: 0.4 } },
              ],
            },
          ],
        }),
      })
    const result = await inferShape(validInput, 'request-5', 'actor', vi.fn())
    expect(result.kind).toBe('common-symbol')
    expect(mocks.runtimeEnv.AI.run).toHaveBeenCalledTimes(2)
  })
})
