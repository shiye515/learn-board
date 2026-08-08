import { z } from 'zod'
import type { Bounds, Point, StrokeElement, WhiteboardDocument } from './model'

export const NORMALIZATION_MODEL = '@cf/mistralai/mistral-small-3.1-24b-instruct' as const
export const NORMALIZATION_PROMPT_VERSION = 'shape-normalization-v7-characters-math' as const
export const SERVER_TIMEOUT_MS = 20_000
export const CLIENT_TIMEOUT_MS = 25_000
export const MAX_OUTPUT_TOKENS = 768
export const MAX_STROKES = 8
export const MAX_POINTS = 512
export const PREVIEW_SIZE = 256
export const MAX_PREVIEW_BYTES = 64 * 1024
export const MIN_SCREEN_EDGE = 12
export const KNOWN_SHAPE_CONFIDENCE = 0.8
export const COMMON_SYMBOL_CONFIDENCE = 0.85
export const CLOSURE_DISTANCE = 0.15
export const AXIS_RATIO_LIMIT = 1.15
export const REGULAR_SIDE_RATIO_LIMIT = 1.2
export const REGULAR_ANGLE_TOLERANCE_DEGREES = 18
export const CHARACTER_SYMBOL_NAME_PATTERN =
  /^(?:digit-[0-9]|letter-(?:uppercase|lowercase)-[a-z])$/
export const MATH_SYMBOL_NAME_PATTERN =
  /^math-(?:plus|minus|multiply|divide|equals|not-equal|less-than|greater-than|less-than-or-equal|greater-than-or-equal|plus-minus|percent|decimal-point|parenthesis-left|parenthesis-right|bracket-left|bracket-right|square-root|approximately-equal)$/
export const CONTOUR_RMS_LIMIT = 0.12
export const SYMBOL_CHAMFER_RMS_LIMIT = 0.15
export const SYMBOL_HAUSDORFF_LIMIT = 0.35
export const REGULAR_SIZE_CHANGE_LIMIT = 0.08

const finite = z.number().finite()
const tuple = z.tuple([finite, finite])
const endpoint = z.tuple([finite.min(0).max(1), finite.min(0).max(1)])
const control = z.tuple([finite.min(-0.25).max(1.25), finite.min(-0.25).max(1.25)])
const strokePayload = z
  .object({
    closed: z.boolean(),
    points: z.array(tuple).min(3).max(MAX_POINTS),
  })
  .strict()
const segment = z.union([
  z.object({ type: z.literal('move'), to: endpoint }).strict(),
  z.object({ type: z.literal('line'), to: endpoint }).strict(),
  z.object({ type: z.literal('quadratic'), control, to: endpoint }).strict(),
  z
    .object({ type: z.literal('cubic'), controls: z.tuple([control, control]), to: endpoint })
    .strict(),
])
const vectorPath = z
  .object({
    closed: z.boolean(),
    segments: z.array(segment).min(2).max(32),
  })
  .strict()

export const knownShapeLabelSchema = z.enum([
  'circle',
  'ellipse',
  'square',
  'rectangle',
  'triangle',
  'parallelogram',
  'pentagon',
  'hexagon',
  'five-point-star',
])

export const knownShapeSchema = z
  .object({
    kind: z.literal('known-shape'),
    shape: knownShapeLabelSchema,
    confidence: finite.min(0).max(1),
  })
  .strict()

const commonSymbolBaseSchema = z
  .object({
    kind: z.literal('common-symbol'),
    symbolName: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    confidence: finite.min(0).max(1),
    paths: z.array(vectorPath).min(1).max(8),
  })
  .strict()

export const commonSymbolSchema = commonSymbolBaseSchema.superRefine((value, context) => {
  const segmentCount = value.paths.reduce((total, path) => total + path.segments.length, 0)
  const pointCount = value.paths.reduce(
    (total, path) =>
      total +
      path.segments.reduce(
        (count, segment) =>
          count + (segment.type === 'cubic' || segment.type === 'quadratic' ? 16 : 1),
        0,
      ),
    0,
  )
  value.paths.forEach((path, index) => {
    if (path.segments[0]?.type !== 'move')
      context.addIssue({
        code: 'custom',
        path: ['paths', index, 'segments'],
        message: 'path must begin with move',
      })
    if (path.segments.filter((segment) => segment.type === 'move').length !== 1)
      context.addIssue({
        code: 'custom',
        path: ['paths', index, 'segments'],
        message: 'path must contain exactly one move',
      })
  })
  if (segmentCount > 32)
    context.addIssue({ code: 'custom', path: ['paths'], message: 'too many segments' })
  if (pointCount > MAX_POINTS)
    context.addIssue({ code: 'custom', path: ['paths'], message: 'too many sampled points' })
})

export const unsupportedSchema = z
  .object({
    kind: z.literal('unsupported'),
    confidence: finite.min(0).max(1),
  })
  .strict()

export const shapeInferenceSchema = z.discriminatedUnion('kind', [
  knownShapeSchema,
  commonSymbolSchema,
  unsupportedSchema,
])

const modelEndpoint = z.object({ x: finite.min(0).max(1), y: finite.min(0).max(1) }).strict()
const modelControl = z
  .object({ x: finite.min(-0.25).max(1.25), y: finite.min(-0.25).max(1.25) })
  .strict()
const modelSegment = z.discriminatedUnion('type', [
  z.object({ type: z.literal('move'), to: modelEndpoint }).strict(),
  z.object({ type: z.literal('line'), to: modelEndpoint }).strict(),
  z.object({ type: z.literal('quadratic'), control: modelControl, to: modelEndpoint }).strict(),
  z
    .object({
      type: z.literal('cubic'),
      controls: z.array(modelControl).length(2),
      to: modelEndpoint,
    })
    .strict(),
])
export const modelShapeClassificationSchema = z
  .object({
    category: z.union([
      knownShapeLabelSchema,
      z.literal('common-symbol'),
      z.literal('unsupported'),
    ]),
    recognizable: z.boolean().default(true),
    symbolName: z
      .string()
      .regex(/^$|^[a-z][a-z0-9-]{0,63}$/)
      .default(''),
    confidence: finite.min(0).max(1).optional(),
  })
  .strict()

export const modelCommonSymbolSchema = z
  .object({
    kind: z.literal('common-symbol'),
    symbolName: z.string().regex(/^[a-z][a-z0-9-]{0,63}$/),
    confidence: finite.min(0).max(1),
    paths: z
      .array(
        z
          .object({
            closed: z.boolean(),
            segments: z.array(modelSegment).min(2).max(32),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict()

export const modelShapeInferenceSchema = z.discriminatedUnion('kind', [
  knownShapeSchema,
  modelCommonSymbolSchema,
  unsupportedSchema,
])

export function modelInferenceToPublic(
  inference: z.infer<typeof modelShapeInferenceSchema>,
): ShapeInference {
  if (inference.kind !== 'common-symbol') return inference
  const point = ({ x, y }: { x: number; y: number }): [number, number] => [x, y]
  return commonSymbolSchema.parse({
    ...inference,
    paths: inference.paths.map((path) => ({
      ...path,
      segments: path.segments.map((segment) => {
        if (segment.type === 'quadratic')
          return { ...segment, control: point(segment.control), to: point(segment.to) }
        if (segment.type === 'cubic')
          return {
            ...segment,
            controls: segment.controls.map(point),
            to: point(segment.to),
          }
        return { ...segment, to: point(segment.to) }
      }),
    })),
  })
}

const normalizationRequestBaseSchema = z
  .object({
    strokes: z.array(strokePayload).min(1).max(MAX_STROKES),
    aspectRatio: finite.positive().max(100),
    preview: z
      .object({
        mimeType: z.literal('image/png'),
        width: z.literal(PREVIEW_SIZE),
        height: z.literal(PREVIEW_SIZE),
        base64: z
          .string()
          .min(1)
          .max(MAX_PREVIEW_BYTES * 2),
        byteLength: z.number().int().positive().max(MAX_PREVIEW_BYTES),
      })
      .strict(),
  })
  .strict()

export const normalizationRequestSchema = normalizationRequestBaseSchema.superRefine(
  (value, context) => {
    const pointCount = value.strokes.reduce((total, stroke) => total + stroke.points.length, 0)
    if (pointCount > MAX_POINTS)
      context.addIssue({ code: 'custom', path: ['strokes'], message: 'too many points' })
  },
)

export const publicFailureSchema = z
  .object({
    kind: z.enum([
      'invalid-input',
      'rate-limited',
      'timeout',
      'unavailable',
      'provider-error',
      'invalid-output',
      'unsupported',
      'low-confidence',
      'cancelled',
    ]),
    requestId: z.string().min(1).max(80),
  })
  .strict()

export const publicNormalizationResultSchema = z.union([shapeInferenceSchema, publicFailureSchema])

export type NormalizationRequest = z.infer<typeof normalizationRequestSchema>
export type ShapeInference = z.infer<typeof shapeInferenceSchema>
export type PublicNormalizationResult = z.infer<typeof publicNormalizationResultSchema>
export type NormalizationStroke = z.infer<typeof strokePayload>

export function selectedStrokes(document: WhiteboardDocument, ids: string[]) {
  return document.elements.filter(
    (element): element is StrokeElement => ids.includes(element.id) && element.kind === 'stroke',
  )
}

export function selectionIsEligible(
  document: WhiteboardDocument,
  ids: string[],
  viewportScale = 1,
) {
  const elements = document.elements.filter((element) => ids.includes(element.id))
  const strokes = selectedStrokes(document, ids)
  if (
    elements.length !== ids.length ||
    elements.length !== strokes.length ||
    strokes.length < 1 ||
    strokes.length > MAX_STROKES
  ) {
    return false
  }
  if (strokes.some((stroke) => stroke.points.length < 3 || !Number.isFinite(stroke.width)))
    return false
  const first = strokes[0]
  if (strokes.some((stroke) => stroke.color !== first.color || stroke.width !== first.width))
    return false
  const bounds = strokes.reduce<Bounds | null>((result, stroke) => {
    for (const point of stroke.points) {
      result = result
        ? {
            minX: Math.min(result.minX, point.x),
            minY: Math.min(result.minY, point.y),
            maxX: Math.max(result.maxX, point.x),
            maxY: Math.max(result.maxY, point.y),
          }
        : { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y }
    }
    return result
  }, null)
  if (!bounds) return false
  return (
    Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * viewportScale >=
    MIN_SCREEN_EDGE
  )
}

function boundsOfStrokes(strokes: StrokeElement[]): Bounds {
  const points = strokes.flatMap((stroke) => stroke.points)
  return points.reduce<Bounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: points[0].x, minY: points[0].y, maxX: points[0].x, maxY: points[0].y },
  )
}

function distance(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function resampleByArcLength(points: Point[], count: number): Point[] {
  if (points.length <= 1 || count >= points.length) return points.map(({ x, y }) => ({ x, y }))
  const lengths = [0]
  for (let i = 1; i < points.length; i++)
    lengths.push(lengths[i - 1] + distance(points[i - 1], points[i]))
  const total = lengths.at(-1) ?? 0
  if (!total) return points.slice(0, count).map(({ x, y }) => ({ x, y }))
  return Array.from({ length: count }, (_, index) => {
    const target = (total * index) / (count - 1)
    let segmentIndex = 1
    while (segmentIndex < lengths.length && lengths[segmentIndex] < target) segmentIndex++
    const a = points[segmentIndex - 1]
    const b = points[Math.min(segmentIndex, points.length - 1)]
    const span = lengths[segmentIndex] - lengths[segmentIndex - 1] || 1
    const t = (target - lengths[segmentIndex - 1]) / span
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  })
}

function perpendicularDistance(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x,
    dy = end.y - start.y
  if (!dx && !dy) return distance(point, start)
  return (
    Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / Math.hypot(dx, dy)
  )
}

export function simplifyRdp(points: Point[], tolerance = 0.005): Point[] {
  if (points.length < 3) return points
  let maxDistance = tolerance,
    index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const current = perpendicularDistance(points[i], points[0], points.at(-1)!)
    if (current > maxDistance) {
      index = i
      maxDistance = current
    }
  }
  if (!index) return [points[0], points.at(-1)!]
  const left = simplifyRdp(points.slice(0, index + 1), tolerance)
  const right = simplifyRdp(points.slice(index), tolerance)
  return [...left.slice(0, -1), ...right]
}

export function normalizeSelectedStrokes(strokes: StrokeElement[]): NormalizationStroke[] {
  const bounds = boundsOfStrokes(strokes)
  const width = Math.max(bounds.maxX - bounds.minX, 1e-6)
  const height = Math.max(bounds.maxY - bounds.minY, 1e-6)
  const unitPoints = strokes.map((stroke) => {
    const raw = stroke.points.map((point) => ({
      x: (point.x - bounds.minX) / width,
      y: (point.y - bounds.minY) / height,
    }))
    const resampled = resampleByArcLength(raw, Math.min(raw.length, 128))
    const simplified = simplifyRdp(resampled)
    const closed =
      simplified.length > 2 && distance(simplified[0], simplified.at(-1)!) <= CLOSURE_DISTANCE
    return { closed, points: simplified.map((point) => [point.x, point.y] as [number, number]) }
  })
  return unitPoints
}

export function canonicalSourceString(document: WhiteboardDocument, ids: string[]) {
  return JSON.stringify(
    document.elements
      .filter((element) => ids.includes(element.id))
      .map((element) => ({
        id: element.id,
        kind: element.kind,
        createdAt: element.createdAt,
        ...(element.kind === 'stroke'
          ? { color: element.color, width: element.width, points: element.points }
          : {
              x: element.x,
              y: element.y,
              width: element.width,
              height: element.height,
              text: element.text,
            }),
      })),
  )
}

export async function sourceFingerprint(document: WhiteboardDocument, ids: string[]) {
  const bytes = new TextEncoder().encode(canonicalSourceString(document, ids))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createPreviewPng(strokes: StrokeElement[], canvas: HTMLCanvasElement) {
  canvas.width = PREVIEW_SIZE
  canvas.height = PREVIEW_SIZE
  const context = canvas.getContext('2d')
  if (!context) throw new Error('canvas-unavailable')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
  const bounds = boundsOfStrokes(strokes)
  const scale = Math.min(
    (PREVIEW_SIZE - 32) / Math.max(bounds.maxX - bounds.minX, 1),
    (PREVIEW_SIZE - 32) / Math.max(bounds.maxY - bounds.minY, 1),
  )
  context.strokeStyle = '#000'
  context.lineWidth = 6
  context.lineCap = 'round'
  context.lineJoin = 'round'
  for (const stroke of strokes) {
    context.beginPath()
    stroke.points.forEach((point, index) => {
      const x =
        16 +
        (point.x - bounds.minX) * scale +
        (PREVIEW_SIZE - 32 - (bounds.maxX - bounds.minX) * scale) / 2
      const y =
        16 +
        (point.y - bounds.minY) * scale +
        (PREVIEW_SIZE - 32 - (bounds.maxY - bounds.minY) * scale) / 2
      if (!index) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.stroke()
  }
  const dataUrl = canvas.toDataURL('image/png')
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
  const byteLength = Math.floor((base64.length * 3) / 4) - padding
  if (byteLength > MAX_PREVIEW_BYTES) throw new Error('preview-too-large')
  return {
    mimeType: 'image/png' as const,
    width: 256 as const,
    height: 256 as const,
    base64,
    byteLength,
  }
}
