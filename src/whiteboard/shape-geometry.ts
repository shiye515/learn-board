import {
  AXIS_RATIO_LIMIT,
  CLOSURE_DISTANCE,
  CONTOUR_RMS_LIMIT,
  COMMON_SYMBOL_CONFIDENCE,
  KNOWN_SHAPE_CONFIDENCE,
  REGULAR_SIZE_CHANGE_LIMIT,
  SYMBOL_HAUSDORFF_LIMIT,
  type NormalizationStroke,
} from './normalization'
import type { Bounds, Point, StrokeElement } from './model'

export const SHAPE_STRATEGIES = {
  circle: { confidence: KNOWN_SHAPE_CONFIDENCE, closed: true },
  ellipse: { confidence: KNOWN_SHAPE_CONFIDENCE, closed: true },
  square: { confidence: KNOWN_SHAPE_CONFIDENCE, closed: true },
  rectangle: { confidence: KNOWN_SHAPE_CONFIDENCE, closed: true },
  triangle: { confidence: KNOWN_SHAPE_CONFIDENCE, closed: true },
  parallelogram: { confidence: KNOWN_SHAPE_CONFIDENCE, closed: true },
  pentagon: { confidence: KNOWN_SHAPE_CONFIDENCE, closed: true },
  hexagon: { confidence: KNOWN_SHAPE_CONFIDENCE, closed: true },
  'five-point-star': { confidence: KNOWN_SHAPE_CONFIDENCE, closed: true },
  'common-symbol': { confidence: COMMON_SYMBOL_CONFIDENCE, closed: false },
} as const

export type PrincipalAxis = { angle: number; major: number; minor: number; ratio: number }

export function pointsBounds(points: Point[]): Bounds | null {
  if (!points.length) return null
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

export function principalAxis(points: Point[]): PrincipalAxis {
  const center = points.reduce(
    (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
    { x: 0, y: 0 },
  )
  let xx = 0,
    xy = 0,
    yy = 0
  for (const point of points) {
    const x = point.x - center.x,
      y = point.y - center.y
    xx += x * x
    xy += x * y
    yy += y * y
  }
  const angle = 0.5 * Math.atan2(2 * xy, xx - yy)
  const trace = xx + yy
  const discriminant = Math.sqrt(Math.max(0, (xx - yy) ** 2 + 4 * xy ** 2))
  const major = Math.sqrt(Math.max(0, (trace + discriminant) / 2))
  const minor = Math.sqrt(Math.max(0, (trace - discriminant) / 2))
  return { angle, major, minor, ratio: major / Math.max(minor, 1e-6) }
}

export function isClosed(points: Point[], diagonal: number, threshold = CLOSURE_DISTANCE) {
  return (
    points.length > 2 &&
    Math.hypot(points[0].x - points.at(-1)!.x, points[0].y - points.at(-1)!.y) <=
      diagonal * threshold
  )
}

export function joinStrokeEndpoints(strokes: StrokeElement[], diagonal: number) {
  if (strokes.length < 2) return strokes[0]?.points ?? []
  const threshold = diagonal * 0.08
  const endpoints = strokes.flatMap((stroke, strokeIndex) => [
    { strokeIndex, point: stroke.points[0] },
    { strokeIndex, point: stroke.points.at(-1)! },
  ])
  if (
    endpoints.some(
      (endpoint, index) =>
        endpoints.filter(
          (candidate, candidateIndex) =>
            candidateIndex !== index &&
            candidate.strokeIndex !== endpoint.strokeIndex &&
            Math.hypot(
              candidate.point.x - endpoint.point.x,
              candidate.point.y - endpoint.point.y,
            ) <= threshold,
        ).length > 2,
    )
  )
    return null
  const remaining = strokes.map((stroke) => stroke.points.map(({ x, y }) => ({ x, y })))
  const result = remaining.shift()!
  while (remaining.length) {
    const end = result.at(-1)!
    let candidate = -1,
      reverse = false,
      best = threshold
    remaining.forEach((points, index) => {
      const startDistance = Math.hypot(end.x - points[0].x, end.y - points[0].y)
      const endDistance = Math.hypot(end.x - points.at(-1)!.x, end.y - points.at(-1)!.y)
      if (startDistance <= best) {
        best = startDistance
        candidate = index
        reverse = false
      }
      if (endDistance <= best) {
        best = endDistance
        candidate = index
        reverse = true
      }
    })
    if (candidate < 0) return null
    const next = remaining.splice(candidate, 1)[0]
    result.push(...(reverse ? next.reverse() : next).slice(1))
  }
  return result
}

export function cornerIndices(points: Point[], minimumAngle = 0.35) {
  const result: number[] = []
  for (let index = 1; index < points.length - 1; index++) {
    const a = points[index - 1],
      b = points[index],
      c = points[index + 1]
    const first = Math.atan2(a.y - b.y, a.x - b.x),
      second = Math.atan2(c.y - b.y, c.x - b.x)
    let angle = Math.abs(first - second)
    if (angle > Math.PI) angle = Math.PI * 2 - angle
    if (angle >= minimumAngle) result.push(index)
  }
  return result
}

export function directedDistance(from: Point[], to: Point[]) {
  return from.map((point) =>
    Math.min(...to.map((candidate) => Math.hypot(point.x - candidate.x, point.y - candidate.y))),
  )
}

export function symmetricMetrics(source: Point[], candidate: Point[]) {
  const forward = directedDistance(source, candidate),
    reverse = directedDistance(candidate, source)
  return {
    rms: Math.sqrt(
      [...forward, ...reverse].reduce((sum, value) => sum + value ** 2, 0) /
        (forward.length + reverse.length),
    ),
    hausdorff: Math.max(...forward, ...reverse),
  }
}

export function axisAlignedSizeChange(source: Bounds, candidate: Bounds) {
  return {
    width: Math.abs(
      (candidate.maxX - candidate.minX) / Math.max(source.maxX - source.minX, 1e-6) - 1,
    ),
    height: Math.abs(
      (candidate.maxY - candidate.minY) / Math.max(source.maxY - source.minY, 1e-6) - 1,
    ),
  }
}

export function passesRegularShapeMetrics(
  source: Point[],
  candidate: Point[],
  sourceBounds: Bounds,
) {
  const diagonal = Math.max(
    Math.hypot(sourceBounds.maxX - sourceBounds.minX, sourceBounds.maxY - sourceBounds.minY),
    1e-6,
  )
  const normalize = (points: Point[]) =>
    points.map((point) => ({
      x: (point.x - sourceBounds.minX) / diagonal,
      y: (point.y - sourceBounds.minY) / diagonal,
    }))
  const metrics = symmetricMetrics(normalize(source), normalize(candidate))
  const sourceAxis = principalAxis(source),
    candidateAxis = principalAxis(candidate)
  const projectBounds = (points: Point[], angle: number) => {
    const cosine = Math.cos(angle),
      sine = Math.sin(angle)
    return points.reduce(
      (bounds, point) => {
        const x = point.x * cosine + point.y * sine
        const y = -point.x * sine + point.y * cosine
        return {
          minX: Math.min(bounds.minX, x),
          minY: Math.min(bounds.minY, y),
          maxX: Math.max(bounds.maxX, x),
          maxY: Math.max(bounds.maxY, y),
        }
      },
      { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    )
  }
  const size = axisAlignedSizeChange(
    projectBounds(source, sourceAxis.angle),
    projectBounds(candidate, sourceAxis.angle),
  )
  return (
    metrics.rms <= CONTOUR_RMS_LIMIT &&
    metrics.hausdorff <= SYMBOL_HAUSDORFF_LIMIT &&
    Math.max(sourceAxis.ratio, candidateAxis.ratio) /
      Math.min(sourceAxis.ratio, candidateAxis.ratio) <=
      AXIS_RATIO_LIMIT &&
    size.width <= REGULAR_SIZE_CHANGE_LIMIT &&
    size.height <= REGULAR_SIZE_CHANGE_LIMIT
  )
}

export function normalizationStrokesToPoints(strokes: NormalizationStroke[]) {
  return strokes.flatMap((stroke) => stroke.points.map(([x, y]) => ({ x, y })))
}
