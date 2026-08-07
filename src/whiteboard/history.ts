import { cloneDocument, createEmptyDocument, type WhiteboardDocument } from './model'

export type HistoryEntry = { label: string, before: WhiteboardDocument, after: WhiteboardDocument }
export type HistoryState = { past: HistoryEntry[], future: HistoryEntry[] }

export const HISTORY_LIMIT = 100

export function createHistory(): HistoryState {
  return { past: [], future: [] }
}

export function commit(history: HistoryState, before: WhiteboardDocument, after: WhiteboardDocument, label: string): HistoryState {
  const past = [...history.past, { label, before: cloneDocument(before), after: cloneDocument(after) }]
  return { past: past.slice(-HISTORY_LIMIT), future: [] }
}

export function undo(history: HistoryState, document: WhiteboardDocument): { history: HistoryState, document: WhiteboardDocument } {
  const entry = history.past.at(-1)
  if (!entry) return { history, document }
  return { history: { past: history.past.slice(0, -1), future: [entry, ...history.future] }, document: cloneDocument(entry.before) }
}

export function redo(history: HistoryState, document: WhiteboardDocument): { history: HistoryState, document: WhiteboardDocument } {
  const entry = history.future[0]
  if (!entry) return { history, document }
  return { history: { past: [...history.past, entry].slice(-HISTORY_LIMIT), future: history.future.slice(1) }, document: cloneDocument(entry.after) }
}

export function clearDocument(document: WhiteboardDocument) {
  return { ...createEmptyDocument(), version: document.version }
}
