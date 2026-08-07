import { describe, expect, it } from 'vitest'
import { commit, createHistory, redo, undo } from './history'
import { createEmptyDocument } from './model'

describe('whiteboard history', () => {
  it('undoes and redoes snapshots', () => {
    const before = createEmptyDocument()
    const after = {
      ...before,
      elements: [
        {
          kind: 'note' as const,
          id: 'a',
          x: 0,
          y: 0,
          width: 100,
          height: 40,
          text: 'hello',
          createdAt: 1,
        },
      ],
    }
    const history = commit(createHistory(), before, after, 'Add note')
    const undone = undo(history, after)
    expect(undone.document.elements).toHaveLength(0)
    expect(redo(undone.history, undone.document).document.elements).toHaveLength(1)
  })

  it('clears redo branches after a new commit', () => {
    const empty = createEmptyDocument()
    const one = {
      ...empty,
      elements: [
        {
          kind: 'note' as const,
          id: 'a',
          x: 0,
          y: 0,
          width: 100,
          height: 40,
          text: 'a',
          createdAt: 1,
        },
      ],
    }
    const two = {
      ...empty,
      elements: [
        {
          kind: 'note' as const,
          id: 'b',
          x: 0,
          y: 0,
          width: 100,
          height: 40,
          text: 'b',
          createdAt: 2,
        },
      ],
    }
    const history = commit(createHistory(), empty, one, 'one')
    const undone = undo(history, one)
    expect(commit(undone.history, undone.document, two, 'two').future).toHaveLength(0)
  })

  it('caps history at 100 entries', () => {
    let history = createHistory()
    let previous = createEmptyDocument()
    for (let i = 0; i < 101; i++) {
      const next = {
        ...previous,
        elements: [
          {
            kind: 'note' as const,
            id: String(i),
            x: i,
            y: i,
            width: 100,
            height: 40,
            text: String(i),
            createdAt: i,
          },
        ],
      }
      history = commit(history, previous, next, String(i))
      previous = next
    }
    expect(history.past).toHaveLength(100)
  })
})
