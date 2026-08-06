import { z } from 'zod'

export const boardSearchSchema = z.object({
  view: z.enum(['today', 'week']).catch('today'),
})

export const focusSearchSchema = z.object({
  session: z.coerce.number().int().min(15).max(120).catch(45),
})

export type BoardSearch = z.infer<typeof boardSearchSchema>
