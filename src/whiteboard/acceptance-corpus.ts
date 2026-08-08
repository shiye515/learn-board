type Sample = { id: string; points: readonly (readonly [number, number])[] }

const samplePaths: readonly Sample[] = [
  {
    id: 'mouse-01',
    points: [
      [0.08, 0.12],
      [0.92, 0.12],
      [0.9, 0.88],
      [0.08, 0.86],
      [0.08, 0.12],
    ],
  },
  {
    id: 'mouse-02',
    points: [
      [0.12, 0.18],
      [0.86, 0.1],
      [0.9, 0.8],
      [0.16, 0.9],
      [0.12, 0.18],
    ],
  },
  {
    id: 'mouse-03',
    points: [
      [0.5, 0.06],
      [0.94, 0.5],
      [0.52, 0.94],
      [0.06, 0.52],
      [0.5, 0.06],
    ],
  },
  {
    id: 'touch-01',
    points: [
      [0.2, 0.08],
      [0.9, 0.3],
      [0.78, 0.9],
      [0.1, 0.72],
      [0.2, 0.08],
    ],
  },
  {
    id: 'touch-02',
    points: [
      [0.1, 0.28],
      [0.8, 0.08],
      [0.92, 0.72],
      [0.26, 0.92],
      [0.1, 0.28],
    ],
  },
]

const knownShapeLabels = [
  'circle',
  'ellipse',
  'square',
  'rectangle',
  'triangle',
  'parallelogram',
  'pentagon',
  'hexagon',
  'five-point-star',
] as const

export const knownShapeAcceptanceCorpus = knownShapeLabels.flatMap((shape) =>
  samplePaths.map((sample) => ({ shape, ...sample, id: `${shape}-${sample.id}` })),
)

const commonSymbolSlugs = [
  'heart',
  'cloud',
  'sun',
  'moon',
  'star',
  'arrow',
  'check',
  'cross',
  'plus',
  'minus',
  'question',
  'exclamation',
  'lightning',
  'house',
  'tree',
  'car',
  'envelope',
  'lock',
  'smiley',
  'location-pin',
] as const

export const commonSymbolAcceptanceCorpus = commonSymbolSlugs.map((symbolName, index) => ({
  id: `symbol-${String(index + 1).padStart(2, '0')}-${symbolName}`,
  symbolName,
  points: samplePaths[index % samplePaths.length].points,
}))

export const unsupportedAcceptanceCorpus = [
  'scribble',
  'partial-arc',
  'open-loop',
  'self-intersection',
  'short-mark',
  'single-dot',
  'noise',
  'ambiguous-angle',
  'broken-star',
  'broken-heart',
  'overlapping-lines',
  'multiple-shapes',
  'tiny-shape',
  'oversized-shape',
  'non-finite-input',
  'invalid-template',
  'low-confidence',
  'wrong-topology',
  'too-many-points',
  'unknown-symbol',
] as const

export const invalidNormalizationAcceptanceCorpus = [
  { id: 'unknown-field', payload: { kind: 'known-shape', shape: 'circle', extra: true } },
  {
    id: 'out-of-range-endpoint',
    payload: { kind: 'common-symbol', paths: [{ segments: [{ type: 'move', to: [-1, 0] }] }] },
  },
  {
    id: 'duplicate-move',
    payload: {
      kind: 'common-symbol',
      paths: [
        {
          segments: [
            { type: 'move', to: [0, 0] },
            { type: 'move', to: [1, 1] },
          ],
        },
      ],
    },
  },
  {
    id: 'too-many-segments',
    payload: {
      kind: 'common-symbol',
      paths: [{ segments: Array.from({ length: 33 }, () => ({ type: 'line', to: [0.5, 0.5] })) }],
    },
  },
] as const
