import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { inferShape } from './shape-normalization.server'
import { normalizationRequestSchema } from '../whiteboard/normalization'

export const normalizeSelectedShape = createServerFn({ method: 'POST' })
  .validator((input: unknown) => normalizationRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const requestId = crypto.randomUUID()
    const actorKey = getRequestHeader('cf-connecting-ip') || 'unknown'
    return inferShape(data, requestId, actorKey)
  })
