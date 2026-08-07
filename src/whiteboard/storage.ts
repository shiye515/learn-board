import {
  createEmptyDocument,
  DEFAULT_VIEWPORT,
  isWhiteboardDocument,
  type ViewportTransform,
  type WhiteboardDocument,
} from './model'

const STORAGE_KEY = 'canvas-room:whiteboard:v1'
const DB_NAME = 'canvas-room'
const DB_STORE = 'boards'

export type SaveStatus = 'loading' | 'saved' | 'saving' | 'memory-only' | 'error'
export type PersistedBoard = {
  version: 1
  document: WhiteboardDocument
  viewport: ViewportTransform
  preferences: { color: string; width: number }
}

const fallbackState: PersistedBoard = {
  version: 1,
  document: createEmptyDocument(),
  viewport: DEFAULT_VIEWPORT,
  preferences: { color: '#222222', width: 3 },
}

function parsePayload(value: unknown): PersistedBoard | null {
  if (!value || typeof value !== 'object') return null
  const payload = value as Partial<PersistedBoard>
  if (payload.version !== 1 || !isWhiteboardDocument(payload.document) || !payload.viewport)
    return null
  return {
    version: 1,
    document: payload.document,
    viewport: payload.viewport,
    preferences: payload.preferences ?? fallbackState.preferences,
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) return reject(new Error('IndexedDB unavailable'))
    const request = window.indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

async function readIndexedDb() {
  const database = await openDatabase()
  return new Promise<unknown>((resolve, reject) => {
    const request = database
      .transaction(DB_STORE, 'readonly')
      .objectStore(DB_STORE)
      .get(STORAGE_KEY)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function writeIndexedDb(value: PersistedBoard) {
  const database = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const request = database
      .transaction(DB_STORE, 'readwrite')
      .objectStore(DB_STORE)
      .put(value, STORAGE_KEY)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function loadBoard(): Promise<{
  board: PersistedBoard
  status: SaveStatus
  recovered: boolean
}> {
  let recovered = false
  try {
    const raw = await readIndexedDb()
    const payload = parsePayload(raw)
    if (payload) return { board: payload, status: 'saved', recovered: false }
    if (raw !== undefined) recovered = true
  } catch {
    /* fall through to localStorage */
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const payload = parsePayload(JSON.parse(raw))
      if (payload) return { board: payload, status: 'saved', recovered: false }
      recovered = true
    }
  } catch {
    recovered = true
  }
  return { board: fallbackState, status: 'saved', recovered }
}

export async function saveBoard(board: PersistedBoard): Promise<SaveStatus> {
  try {
    await writeIndexedDb(board)
    return 'saved'
  } catch {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(board))
      return 'saved'
    } catch {
      return 'memory-only'
    }
  }
}

export function createPersistedBoard(
  document: WhiteboardDocument,
  viewport: ViewportTransform,
  color: string,
  width: number,
): PersistedBoard {
  return { version: 1, document, viewport, preferences: { color, width } }
}

export { STORAGE_KEY }
