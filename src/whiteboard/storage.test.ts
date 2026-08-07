import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument } from './model'
import { createPersistedBoard, loadBoard, saveBoard, STORAGE_KEY } from './storage'

describe('local whiteboard storage', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    })
    window.localStorage.clear()
  })

  it('falls back to localStorage when IndexedDB is unavailable', async () => {
    const document = {
      ...createEmptyDocument(),
      elements: [
        {
          kind: 'note' as const,
          id: 'note',
          x: 1,
          y: 2,
          width: 100,
          height: 40,
          text: 'saved',
          createdAt: 1,
        },
      ],
    }
    const board = createPersistedBoard(document, { x: 10, y: 20, scale: 2 }, '#222222', 3)
    expect(await saveBoard(board)).toBe('saved')
    expect(
      JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').document.elements,
    ).toHaveLength(1)
    expect((await loadBoard()).board.document.elements).toHaveLength(1)
  })

  it('recovers safely from malformed storage', async () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken')
    const result = await loadBoard()
    expect(result.recovered).toBe(true)
    expect(result.board.document.elements).toHaveLength(0)
  })
})
