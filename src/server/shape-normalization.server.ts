import { env } from 'cloudflare:workers'
import { z } from 'zod'
import {
  COMMON_SYMBOL_CONFIDENCE,
  CHARACTER_SYMBOL_NAME_PATTERN,
  MATH_SYMBOL_NAME_PATTERN,
  MAX_OUTPUT_TOKENS,
  NORMALIZATION_MODEL,
  NORMALIZATION_PROMPT_VERSION,
  modelCommonSymbolSchema,
  modelInferenceToPublic,
  modelShapeClassificationSchema,
  normalizationRequestSchema,
  publicNormalizationResultSchema,
  shapeInferenceSchema,
  knownShapeLabelSchema,
  SERVER_TIMEOUT_MS,
  type NormalizationRequest,
  type PublicNormalizationResult,
} from '../whiteboard/normalization'

const classificationPrompt = (request: NormalizationRequest) => [
  `Prompt version: ${NORMALIZATION_PROMPT_VERSION}.`,
  'Perform only the first-stage classification of the selected hand-drawn paths.',
  'The input is intentionally rough hand-drawn geometry. Do not return unsupported for a clear primitive.',
  'Use both the normalized points and the preview image. Ignore small wobble, gaps, and perspective-like skew.',
  'Known geometric labels are authoritative: circle, ellipse, square, rectangle, triangle, parallelogram, pentagon, hexagon, and five-point-star.',
  'A readable triangle, parallelogram, or five-point-star MUST use its known geometric label and MUST NOT use common-symbol.',
  'A closed contour with a continuous smooth rounded boundary and no stable sharp corners MUST be circle when its aspect ratio is near 1, or ellipse when its aspect ratio is clearly not near 1. Never classify a smooth rounded contour as pentagon, hexagon, square, or rectangle.',
  'Small closure overlaps, a short crossing at the join, and hand-drawn wobble do not create polygon corners.',
  'Never use common-symbol for a geometric outline. For a rough four-sided path, use parallelogram when the opposite sides are slanted but approximately parallel; use square for near-equal perpendicular sides and rectangle for other approximately perpendicular sides. The path may be slightly open.',
  'A convex four-sided outline with two slanted parallel-looking side pairs is a parallelogram even when perspective or hand jitter makes the angles imperfect.',
  'A rough three-sided path MUST be classified as triangle even if the final endpoint is slightly open. Prefer the closest known-shape label over unsupported whenever the topology is readable.',
  'Set recognizable=true for every readable primitive or everyday symbol. Set it false only for a blank, non-drawing, or genuinely unreadable selection.',
  'When the drawing is a handwritten digit, Latin letter, or mathematical operator, common-symbol takes priority over every geometric label. Do not classify a letter loop, stem, crossbar, diagonal, or open curved stroke as circle, ellipse, rectangle, triangle, or another geometric shape.',
  'Always provide the closest category. Use common-symbol for one handwritten Arabic digit, one Latin letter, or one mathematical symbol even when its contour contains a loop or resembles a geometric primitive.',
  'For a known geometric category, symbolName must be an empty string. For common-symbol, use a short lowercase kebab-case symbolName. For a digit, use exactly digit-0 through digit-9. For a Latin letter, use exactly letter-uppercase-a through letter-uppercase-z or letter-lowercase-a through letter-lowercase-z. For mathematics, use exactly math-plus (+), math-minus (− or -), math-multiply (× or *), math-divide (÷), math-equals (=), math-not-equal (≠), math-less-than (<), math-greater-than (>), math-less-than-or-equal (≤), math-greater-than-or-equal (≥), math-plus-minus (±), math-percent (%), math-decimal-point (.), math-parenthesis-left/right, math-bracket-left/right, math-square-root (√), or math-approximately-equal (≈). Do not use the visual character itself as symbolName, and do not generate vector paths in this stage.',
  'Never return SVG, code, URLs, text, metadata, or whiteboard data.',
  JSON.stringify({ aspectRatio: request.aspectRatio, strokes: request.strokes }),
]

const symbolPrompt = (request: NormalizationRequest, symbolName: string) => [
  `Prompt version: ${NORMALIZATION_PROMPT_VERSION}.`,
  `The first-stage classifier identified the selected drawing as ${symbolName}.`,
  'Return a small normalized vector DSL for that symbol while preserving orientation and topology. This includes Arabic digits, Latin letters, and the supported math-* operators; use one or more paths when a symbol has multiple strokes, such as equals or plus-minus.',
  'Represent every vector coordinate as an object with numeric x and y fields.',
  'Never return SVG, code, URLs, text, metadata, or whiteboard data.',
  JSON.stringify({ aspectRatio: request.aspectRatio, strokes: request.strokes }),
]

function publicFailure(
  kind: PublicNormalizationResult['kind'],
  requestId: string,
): PublicNormalizationResult {
  return publicNormalizationResultSchema.parse({ kind, requestId })
}

function recoverClassificationText(value: string) {
  const category = value.match(
    /\b(?:category|shape|label|classification|class|type|kind)\b\s*(?::|=|is)\s*["'`]?([a-z][a-z0-9-]*)/i,
  )
  if (!category) return null
  const symbolName = value.match(
    /\b(?:symbolName|symbol name|symbol)\b\s*(?::|=|is)\s*["'`]?([a-z][a-z0-9-]*)/i,
  )
  const confidence = value.match(/\bconfidence\b\s*(?::|=|is)\s*(0(?:\.\d+)?|1(?:\.0+)?)/i)
  const recognizable = !/\b(?:unreadable|not recognizable|unsupported)\b/i.test(value)
  return {
    category: category[1].toLowerCase(),
    recognizable,
    symbolName: symbolName?.[1]?.toLowerCase() ?? '',
    ...(confidence ? { confidence: Number(confidence[1]) } : {}),
  }
}

export async function inferShape(
  input: unknown,
  requestId: string,
  actorKey: string,
  log: (payload: Record<string, unknown>) => void = console.info,
): Promise<PublicNormalizationResult> {
  const parsed = normalizationRequestSchema.safeParse(input)
  if (!parsed.success) return publicFailure('invalid-input', requestId)
  if (!env.AI || !env.AI_ACTOR_RATE_LIMITER || !env.AI_COLO_RATE_LIMITER) {
    return publicFailure('unavailable', requestId)
  }

  try {
    const binary = atob(parsed.data.preview.base64)
    if (
      !binary.startsWith('\x89PNG\r\n\x1a\n') ||
      binary.length !== parsed.data.preview.byteLength
    ) {
      return publicFailure('invalid-input', requestId)
    }
  } catch {
    return publicFailure('invalid-input', requestId)
  }

  const started = Date.now()
  const actor = await env.AI_ACTOR_RATE_LIMITER.limit({ key: `${actorKey}:shape-normalization` })
  if (!actor.success) return publicFailure('rate-limited', requestId)
  const colo = await env.AI_COLO_RATE_LIMITER.limit({ key: 'shape-normalization' })
  if (!colo.success) return publicFailure('rate-limited', requestId)

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), SERVER_TIMEOUT_MS)
  try {
    const runStructured = async (schema: z.ZodType, text: string, maxTokens: number) => {
      const result = await env.AI.run(
        NORMALIZATION_MODEL,
        {
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${parsed.data.preview.mimeType};base64,${parsed.data.preview.base64}`,
                  },
                },
              ],
            },
          ],
          guided_json: z.toJSONSchema(schema),
          temperature: 0,
          max_tokens: maxTokens,
          seed: 17,
        },
        { signal: timeout.signal },
      )
      if (!result || typeof result !== 'object' || !('response' in result)) {
        log({
          requestId,
          latencyMs: Date.now() - started,
          errorKind: 'invalid-output',
          responseKeys: result && typeof result === 'object' ? Object.keys(result).sort() : [],
        })
        return null
      }
      const response = result.response
      if (response && typeof response === 'object') return response
      if (typeof response !== 'string') {
        log({
          requestId,
          latencyMs: Date.now() - started,
          errorKind: 'invalid-output',
          responseType: typeof response,
        })
        return null
      }
      const json = response
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
      try {
        return JSON.parse(json) as unknown
      } catch {
        const objectStart = json.indexOf('{')
        const objectEnd = json.lastIndexOf('}')
        if (objectStart >= 0 && objectEnd > objectStart) {
          try {
            return JSON.parse(json.slice(objectStart, objectEnd + 1)) as unknown
          } catch {
            // Continue to the redacted diagnostic below.
          }
        }
        const recovered = recoverClassificationText(json)
        if (recovered) return recovered
        log({
          requestId,
          latencyMs: Date.now() - started,
          errorKind: 'invalid-output',
          responseType: 'non-json-string',
          responseLength: response.length,
        })
        return null
      }
    }
    const classificationResult = await runStructured(
      modelShapeClassificationSchema,
      classificationPrompt(parsed.data).join('\n'),
      256,
    )
    const classificationCandidate =
      Array.isArray(classificationResult) && classificationResult.length === 1
        ? classificationResult[0]
        : classificationResult
    const classification = modelShapeClassificationSchema.safeParse(classificationCandidate)
    if (!classification.success) {
      const candidate =
        classificationResult && typeof classificationResult === 'object'
          ? (classificationCandidate as Record<string, unknown>)
          : {}
      log({
        requestId,
        latencyMs: Date.now() - started,
        errorKind: 'invalid-output',
        outputKeys: Object.keys(candidate).sort(),
        recognizableType: typeof candidate.recognizable,
        category: typeof candidate.category === 'string' ? candidate.category : undefined,
        symbolNameType: typeof candidate.symbolName,
        confidenceType: typeof candidate.confidence,
      })
      return publicFailure('invalid-output', requestId)
    }
    const aiKnownShape = knownShapeLabelSchema.safeParse(classification.data.symbolName)
    const classificationCategory =
      (classification.data.category === 'common-symbol' ||
        classification.data.category === 'unsupported') &&
      aiKnownShape.success
        ? aiKnownShape.data
        : classification.data.category
    const classificationConfidence =
      classification.data.confidence ?? (classification.data.recognizable ? 0.9 : 0)
    const classificationKind =
      classificationCategory === 'common-symbol' ? 'common-symbol' : 'known-shape'
    const classificationThreshold =
      classificationKind === 'common-symbol' ? COMMON_SYMBOL_CONFIDENCE : 0.8
    if (classificationConfidence < classificationThreshold) {
      log({
        requestId,
        model: NORMALIZATION_MODEL,
        promptVersion: NORMALIZATION_PROMPT_VERSION,
        latencyMs: Date.now() - started,
        resultKind: classificationKind,
        confidenceBucket: Math.floor(classificationConfidence * 10) / 10,
      })
      return publicFailure('low-confidence', requestId)
    }
    if (!classification.data.recognizable || classificationCategory === 'unsupported') {
      log({
        requestId,
        model: NORMALIZATION_MODEL,
        promptVersion: NORMALIZATION_PROMPT_VERSION,
        latencyMs: Date.now() - started,
        resultKind: 'unsupported',
        confidenceBucket: Math.floor(classificationConfidence * 10) / 10,
      })
      return publicFailure('unsupported', requestId)
    }

    let output: Exclude<PublicNormalizationResult, { requestId: string }>
    if (classificationCategory !== 'common-symbol') {
      output = shapeInferenceSchema.parse({
        kind: 'known-shape',
        shape: classificationCategory,
        confidence: classificationConfidence,
      })
    } else {
      if (!classification.data.symbolName) return publicFailure('invalid-output', requestId)
      if (
        classification.data.symbolName.startsWith('digit-') ||
        classification.data.symbolName.startsWith('letter-') ||
        classification.data.symbolName.startsWith('math-')
      ) {
        const validCharacter = CHARACTER_SYMBOL_NAME_PATTERN.test(classification.data.symbolName)
        const validMathSymbol = MATH_SYMBOL_NAME_PATTERN.test(classification.data.symbolName)
        if (!validCharacter && !validMathSymbol) return publicFailure('invalid-output', requestId)
      }
      const symbolResult = await runStructured(
        modelCommonSymbolSchema,
        symbolPrompt(parsed.data, classification.data.symbolName).join('\n'),
        MAX_OUTPUT_TOKENS,
      )
      const symbol = modelCommonSymbolSchema.safeParse(symbolResult)
      if (!symbol.success || symbol.data.symbolName !== classification.data.symbolName)
        return publicFailure('invalid-output', requestId)
      let converted: unknown
      try {
        converted = modelInferenceToPublic(symbol.data)
      } catch {
        return publicFailure('invalid-output', requestId)
      }
      const publicOutput = shapeInferenceSchema.safeParse(converted)
      if (!publicOutput.success || publicOutput.data.kind !== 'common-symbol')
        return publicFailure('invalid-output', requestId)
      output = publicOutput.data
    }
    log({
      requestId,
      model: NORMALIZATION_MODEL,
      promptVersion: NORMALIZATION_PROMPT_VERSION,
      strokeCount: parsed.data.strokes.length,
      pointCount: parsed.data.strokes.reduce((total, stroke) => total + stroke.points.length, 0),
      latencyMs: Date.now() - started,
      resultKind: output.kind,
      ...(output.kind === 'common-symbol'
        ? { symbolName: output.symbolName }
        : output.kind === 'known-shape'
          ? { shape: output.shape }
          : {}),
      confidenceBucket: Math.floor(output.confidence * 10) / 10,
    })
    return output
  } catch (error) {
    const kind =
      error && typeof error === 'object' && 'name' in error && error.name === 'AbortError'
        ? 'timeout'
        : 'provider-error'
    log({ requestId, latencyMs: Date.now() - started, errorKind: kind })
    return publicFailure(kind, requestId)
  } finally {
    clearTimeout(timer)
  }
}
