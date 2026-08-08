import type { Bounds, StrokeElement } from './model'
import {
  SYMBOL_CHAMFER_RMS_LIMIT,
  SYMBOL_HAUSDORFF_LIMIT,
  type ShapeInference,
} from './normalization'
import { principalAxis } from './shape-geometry'

type XY = [number, number]

function id() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `normalized-${Date.now()}-${Math.random().toString(36).slice(2)}`
  )
}

function pointOnEllipse(cx: number, cy: number, rx: number, ry: number, angle: number): XY {
  return [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry]
}

function regularPolygon(
  sides: number,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  rotation = -Math.PI / 2,
) {
  return Array.from({ length: sides + 1 }, (_, index) =>
    pointOnEllipse(cx, cy, radiusX, radiusY, rotation + (index * Math.PI * 2) / sides),
  )
}

function star(cx: number, cy: number, radiusX: number, radiusY: number) {
  return Array.from({ length: 11 }, (_, index) => {
    const radius = index % 2 === 0 ? 1 : 0.381966
    return pointOnEllipse(
      cx,
      cy,
      radiusX * radius,
      radiusY * radius,
      -Math.PI / 2 + (index * Math.PI) / 5,
    )
  })
}

function sampleCurve(
  from: XY,
  segment: { type: 'quadratic' | 'cubic'; control?: XY; controls?: [XY, XY]; to: XY },
) {
  const points: XY[] = []
  for (let index = 1; index <= 16; index++) {
    const t = index / 16
    if (segment.type === 'quadratic') {
      const control = segment.control!
      points.push([
        (1 - t) ** 2 * from[0] + 2 * (1 - t) * t * control[0] + t ** 2 * segment.to[0],
        (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * control[1] + t ** 2 * segment.to[1],
      ])
    } else {
      const [a, b] = segment.controls!
      points.push([
        (1 - t) ** 3 * from[0] +
          3 * (1 - t) ** 2 * t * a[0] +
          3 * (1 - t) * t ** 2 * b[0] +
          t ** 3 * segment.to[0],
        (1 - t) ** 3 * from[1] +
          3 * (1 - t) ** 2 * t * a[1] +
          3 * (1 - t) * t ** 2 * b[1] +
          t ** 3 * segment.to[1],
      ])
    }
  }
  return points
}

function mapTemplate(
  inference: Extract<ShapeInference, { kind: 'common-symbol' }>,
  bounds: Bounds,
) {
  const all = inference.paths.flatMap((path) =>
    path.segments.flatMap((segment) => ('to' in segment ? [segment.to] : [])),
  )
  const minX = Math.min(...all.map(([x]) => x)),
    maxX = Math.max(...all.map(([x]) => x))
  const minY = Math.min(...all.map(([, y]) => y)),
    maxY = Math.max(...all.map(([, y]) => y))
  const scaleX = (bounds.maxX - bounds.minX) / Math.max(maxX - minX, 1e-6)
  const scaleY = (bounds.maxY - bounds.minY) / Math.max(maxY - minY, 1e-6)
  const map = ([x, y]: XY): XY => [
    bounds.minX + (x - minX) * scaleX,
    bounds.minY + (y - minY) * scaleY,
  ]
  return inference.paths.map((path) => {
    let cursor: XY = [0, 0]
    const points: XY[] = []
    for (const segment of path.segments) {
      if (segment.type === 'move') {
        cursor = segment.to
        points.push(map(cursor))
        continue
      }
      if (segment.type === 'line') {
        cursor = segment.to
        points.push(map(cursor))
        continue
      }
      const sampled = sampleCurve(cursor, segment)
      points.push(...sampled.map(map))
      cursor = segment.to
    }
    if (
      path.closed &&
      points.length &&
      (points[0][0] !== points.at(-1)![0] || points[0][1] !== points.at(-1)![1])
    )
      points.push(points[0])
    return points
  })
}

function similarityGate(source: StrokeElement[], generated: XY[][], bounds: Bounds) {
  const width = Math.max(bounds.maxX - bounds.minX, 1e-6)
  const height = Math.max(bounds.maxY - bounds.minY, 1e-6)
  const sourcePoints = source
    .flatMap((stroke) => stroke.points)
    .map((point) => [(point.x - bounds.minX) / width, (point.y - bounds.minY) / height] as XY)
  const generatedPoints = generated
    .flat()
    .map((point) => [(point[0] - bounds.minX) / width, (point[1] - bounds.minY) / height] as XY)
  const distance = (a: XY, b: XY) => Math.hypot(a[0] - b[0], a[1] - b[1])
  const directed = (from: XY[], to: XY[]) =>
    from.map((point) => Math.min(...to.map((candidate) => distance(point, candidate))))
  const forward = directed(sourcePoints, generatedPoints)
  const reverse = directed(generatedPoints, sourcePoints)
  const rms = Math.sqrt(
    [...forward, ...reverse].reduce((sum, value) => sum + value ** 2, 0) /
      (forward.length + reverse.length),
  )
  return (
    rms <= SYMBOL_CHAMFER_RMS_LIMIT && Math.max(...forward, ...reverse) <= SYMBOL_HAUSDORFF_LIMIT
  )
}

function rotatePath(path: XY[], center: XY, angle: number): XY[] {
  const cosine = Math.cos(angle),
    sine = Math.sin(angle)
  return path.map(([x, y]) => {
    const dx = x - center[0],
      dy = y - center[1]
    return [center[0] + dx * cosine - dy * sine, center[1] + dx * sine + dy * cosine]
  })
}

function orientedBounds(points: XY[], angle: number) {
  const cosine = Math.cos(angle),
    sine = Math.sin(angle)
  return points.reduce(
    (result, [x, y]) => {
      const localX = x * cosine + y * sine
      const localY = -x * sine + y * cosine
      return {
        minX: Math.min(result.minX, localX),
        minY: Math.min(result.minY, localY),
        maxX: Math.max(result.maxX, localX),
        maxY: Math.max(result.maxY, localY),
      }
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  )
}

function fromOrientedCoordinates(x: number, y: number, angle: number): XY {
  const cosine = Math.cos(angle),
    sine = Math.sin(angle)
  return [x * cosine - y * sine, x * sine + y * cosine]
}

function samplePolygon(corners: XY[], subdivisions = 12): XY[] {
  const points: XY[] = []
  for (let index = 0; index < corners.length; index++) {
    const from = corners[index]
    const to = corners[(index + 1) % corners.length]
    for (let step = 0; step < subdivisions; step++) {
      const t = step / subdivisions
      points.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t])
    }
  }
  points.push(corners[0])
  return points
}

function orientedRectangle(points: XY[], angle: number, square: boolean): XY[] {
  const source = orientedBounds(points, angle)
  const sourceWidth = source.maxX - source.minX
  const sourceHeight = source.maxY - source.minY
  const width = square ? (sourceWidth + sourceHeight) / 2 : sourceWidth
  const height = square ? width : sourceHeight
  const centerX = (source.minX + source.maxX) / 2
  const centerY = (source.minY + source.maxY) / 2
  const corners = [
    [centerX - width / 2, centerY - height / 2],
    [centerX + width / 2, centerY - height / 2],
    [centerX + width / 2, centerY + height / 2],
    [centerX - width / 2, centerY + height / 2],
  ]
  return samplePolygon(corners.map(([x, y]) => fromOrientedCoordinates(x, y, angle)))
}

function triangleFromSource(points: XY[]): XY[] | null {
  const unique: XY[] = []
  const seen = new Set<string>()
  for (const point of points) {
    const key = `${point[0]}:${point[1]}`
    if (!seen.has(key)) {
      seen.add(key)
      unique.push(point)
    }
  }
  if (unique.length < 3) return null
  const step = Math.max(1, Math.ceil(unique.length / 64))
  const sampled = unique.filter((_, index) => index % step === 0)
  if (sampled.length < 3) return null
  let best: [XY, XY, XY] | null = null
  let bestArea = 0
  for (let first = 0; first < sampled.length - 2; first++) {
    for (let second = first + 1; second < sampled.length - 1; second++) {
      for (let third = second + 1; third < sampled.length; third++) {
        const [a, b, c] = [sampled[first], sampled[second], sampled[third]]
        const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]))
        if (area > bestArea) {
          bestArea = area
          best = [a, b, c]
        }
      }
    }
  }
  return bestArea > 1e-6 && best ? samplePolygon(best) : null
}

export function reconstructShape(
  inference: ShapeInference,
  sources: StrokeElement[],
  bounds: Bounds,
): StrokeElement[] | null {
  if (
    !sources.length ||
    inference.kind === 'unsupported' ||
    (inference.kind === 'common-symbol' && inference.confidence < 0.85)
  )
    return null
  const style = sources[0]
  const cx = (bounds.minX + bounds.maxX) / 2,
    cy = (bounds.minY + bounds.maxY) / 2
  const width = Math.max(bounds.maxX - bounds.minX, 1),
    height = Math.max(bounds.maxY - bounds.minY, 1)
  const rx = width / 2,
    ry = height / 2
  const sourcePoints = sources.flatMap((stroke) => stroke.points.map(({ x, y }) => [x, y] as XY))
  const sourceAxis = principalAxis(sourcePoints.map(([x, y]) => ({ x, y })))
  const center: XY = [cx, cy]
  let paths: XY[][]
  if (inference.kind === 'common-symbol') {
    paths = mapTemplate(inference, bounds)
    if (!similarityGate(sources, paths, bounds)) return null
  } else {
    switch (inference.shape) {
      case 'circle': {
        const radius = (rx + ry) / 2
        paths = [
          Array.from({ length: 65 }, (_, index) =>
            pointOnEllipse(cx, cy, radius, radius, (index * Math.PI * 2) / 64),
          ),
        ]
        break
      }
      case 'ellipse':
        paths = [
          Array.from({ length: 65 }, (_, index) =>
            pointOnEllipse(cx, cy, rx, ry, (index * Math.PI * 2) / 64),
          ),
        ]
        break
      case 'square': {
        paths = [orientedRectangle(sourcePoints, sourceAxis.angle, true)]
        break
      }
      case 'rectangle':
        paths = [orientedRectangle(sourcePoints, sourceAxis.angle, false)]
        break
      case 'triangle': {
        const triangle = triangleFromSource(sourcePoints)
        paths = triangle ? [triangle] : []
        break
      }
      case 'parallelogram': {
        const skew = width * 0.18
        paths = [
          [
            [bounds.minX + skew, bounds.minY],
            [bounds.maxX, bounds.minY],
            [bounds.maxX - skew, bounds.maxY],
            [bounds.minX, bounds.maxY],
            [bounds.minX + skew, bounds.minY],
          ],
        ]
        break
      }
      case 'pentagon':
        paths = [regularPolygon(5, cx, cy, rx, ry)]
        break
      case 'hexagon':
        paths = [regularPolygon(6, cx, cy, rx, ry)]
        break
      case 'five-point-star':
        paths = [star(cx, cy, rx, ry)]
        break
    }
  }
  if (inference.kind === 'known-shape' && ['ellipse', 'parallelogram'].includes(inference.shape)) {
    paths = paths.map((path) => rotatePath(path, center, sourceAxis.angle))
  }
  const createdAt = Date.now()
  return paths
    .filter((path) => path.length > 1)
    .map((points) => ({
      kind: 'stroke',
      id: id(),
      points: points.map(([x, y]) => ({ x, y })),
      color: style.color,
      width: style.width,
      createdAt,
    }))
}
