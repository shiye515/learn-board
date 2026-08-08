import { describe, expect, it } from 'vitest'
import {
  commonSymbolAcceptanceCorpus,
  invalidNormalizationAcceptanceCorpus,
  knownShapeAcceptanceCorpus,
  unsupportedAcceptanceCorpus,
} from './acceptance-corpus'

describe('normalization acceptance corpus', () => {
  it('contains the fixed known-shape, symbol, unsupported, and invalid-input sets', () => {
    expect(knownShapeAcceptanceCorpus).toHaveLength(9 * 5)
    expect(new Set(knownShapeAcceptanceCorpus.map(({ shape }) => shape)).size).toBe(9)
    expect(commonSymbolAcceptanceCorpus).toHaveLength(20)
    expect(unsupportedAcceptanceCorpus).toHaveLength(20)
    expect(invalidNormalizationAcceptanceCorpus).toHaveLength(4)
  })
})
