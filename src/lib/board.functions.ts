import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getActivityStream, getBoardSnapshot } from './board.server'

export const getBoard = createServerFn({ method: 'GET' })
  .validator(z.object({ view: z.enum(['today', 'week']) }))
  .handler(({ data }) => getBoardSnapshot(data.view))

export const streamActivity = createServerFn({ method: 'GET' }).handler(async function* () {
  for await (const chunk of getActivityStream()) yield chunk
})

export const saveFocusNote = createServerFn({ method: 'POST' })
  .validator(z.object({ note: z.string().trim().min(1).max(240) }))
  .handler(async ({ data }) => ({ saved: true, preview: data.note, savedAt: new Date().toISOString() }))
