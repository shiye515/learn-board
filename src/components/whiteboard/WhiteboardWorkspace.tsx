import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  boundsOfDocument,
  elementIntersectsBounds,
  fitViewportToBounds,
  pointToSegmentDistance,
  screenToWorld,
  zoomAt,
} from '../../whiteboard/geometry'
import { commit, createHistory, redo, undo } from '../../whiteboard/history'
import {
  createEmptyDocument,
  DEFAULT_VIEWPORT,
  EMPTY_SELECTION,
  type Bounds,
  type NoteElement,
  type Point,
  type SelectionState,
  type StrokeColor,
  type Tool,
  type ViewportTransform,
  type WhiteboardDocument,
  type WhiteboardElement,
} from '../../whiteboard/model'
import { drawWhiteboard, resizeCanvas } from '../../whiteboard/renderer'
import {
  createPersistedBoard,
  loadBoard,
  saveBoard,
  type SaveStatus,
} from '../../whiteboard/storage'
import { exportBoardPng } from '../../whiteboard/export'
import { whiteboardTokens } from '../../whiteboard/tokens'

type NoteDraft = {
  x: number
  y: number
  screenX: number
  screenY: number
  text: string
  id?: string
}
type Interaction
  = | { kind: 'draw', pointerId: number, points: Point[] }
    | {
      kind: 'pan'
      pointerId: number
      start: Point
      viewport: ViewportTransform
    }
    | {
      kind: 'select'
      pointerId: number
      mode: 'move' | 'marquee'
      start: Point
      initialDocument: WhiteboardDocument
      initialSelection: string[]
    }
    | null

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function sameDocument(a: WhiteboardDocument, b: WhiteboardDocument) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function boundsFromPoints(start: Point, end: Point): Bounds {
  return {
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y),
  }
}

function hitTest(
  document: WhiteboardDocument,
  point: Point,
  tolerance = 8,
): WhiteboardElement | null {
  for (const element of [...document.elements].reverse()) {
    if (element.kind === 'note') {
      if (
        point.x >= element.x - tolerance
        && point.x <= element.x + element.width + tolerance
        && point.y >= element.y - tolerance
        && point.y <= element.y + element.height + tolerance
      )
        return element
    } else {
      for (let index = 1; index < element.points.length; index++) {
        if (
          pointToSegmentDistance(
            point,
            element.points[index - 1],
            element.points[index],
          )
          <= element.width / 2 + tolerance
        )
          return element
      }
    }
  }
  return null
}

function moveElements(
  document: WhiteboardDocument,
  ids: string[],
  dx: number,
  dy: number,
): WhiteboardDocument {
  return {
    ...document,
    elements: document.elements.map((element) => {
      if (!ids.includes(element.id)) return element
      if (element.kind === 'note')
        return { ...element, x: element.x + dx, y: element.y + dy }
      return {
        ...element,
        points: element.points.map(point => ({
          ...point,
          x: point.x + dx,
          y: point.y + dy,
        })),
      }
    }),
  }
}

function Icon({ name }: { name: string }) {
  const common = { 'viewBox': '0 0 24 24', 'aria-hidden': true } as const
  switch (name) {
    case 'pen':
      return (
        <svg {...common}>
          <path d="m4 20 4.3-1 9.8-9.8a2.1 2.1 0 0 0-3-3L5.3 16 4 20Z" />
          <path d="m13.8 7.2 3 3" />
        </svg>
      )
    case 'eraser':
      return (
        <svg {...common}>
          <path d="m5 15 8.8-8.8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L10 20H5a2 2 0 0 1-1.4-3.4L5 15Z" />
          <path d="m10 20 5-5" />
        </svg>
      )
    case 'note':
      return (
        <svg {...common}>
          <path d="M5 4h11l3 3v13H5z" />
          <path d="M16 4v4h4M8 12h8M8 16h5" />
        </svg>
      )
    case 'select':
      return (
        <svg {...common}>
          <path d="m5 4 12 8-5 1 3 6-2 1-3-6-3 4z" />
        </svg>
      )
    case 'pan':
      return (
        <svg {...common}>
          <path d="M8 11V6a1 1 0 0 1 2 0v4-6a1 1 0 0 1 2 0v6-5a1 1 0 0 1 2 0v6-3a1 1 0 0 1 2 0v7c0 3-2 5-5 5h-1c-2 0-3-1-4-3l-2-4a1.2 1.2 0 0 1 2-1l2 2V11Z" />
        </svg>
      )
    case 'undo':
      return (
        <svg {...common}>
          <path d="M9 7 4 12l5 5" />
          <path d="M4 12h9a6 6 0 0 1 6 6" />
        </svg>
      )
    case 'redo':
      return (
        <svg {...common}>
          <path d="m15 7 5 5-5 5" />
          <path d="M20 12h-9a6 6 0 0 0-6 6" />
        </svg>
      )
    case 'menu':
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      )
    case 'zoom-in':
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 4 4M10.5 7.5v6M7.5 10.5h6" />
        </svg>
      )
    case 'zoom-out':
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 4 4M7.5 10.5h6" />
        </svg>
      )
    case 'home':
      return (
        <svg {...common}>
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10M9 20v-6h6v6" />
        </svg>
      )
    case 'fit':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
        </svg>
      )
    case 'download':
      return (
        <svg {...common}>
          <path d="M12 3v12M7 10l5 5 5-5M5 20h14" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...common}>
          <path d="M4 7h16M10 11v5M14 11v5M6 7l1 13h10l1-13M9 7V4h6v3" />
        </svg>
      )
    case 'invite':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M17 8h4M19 6v4" />
        </svg>
      )
    case 'view':
      return (
        <svg {...common}>
          <path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Z" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}

function ToolButton({
  name,
  tooltip,
  active,
  disabled,
  className = '',
  onClick,
}: {
  name: string
  tooltip: string
  active?: boolean
  disabled?: boolean
  className?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`tool-button ${active ? 'active' : ''} ${className}`}
      data-tooltip={tooltip}
      aria-label={tooltip}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={name} />
    </button>
  )
}

export function WhiteboardWorkspace() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const interactionRef = useRef<Interaction>(null)
  const pointerMapRef = useRef(new Map<number, Point>())
  const pinchRef = useRef<{
    distance: number
    center: Point
    viewport: ViewportTransform
  } | null>(null)
  const [document, setDocument]
    = useState<WhiteboardDocument>(createEmptyDocument)
  const [history, setHistory] = useState(createHistory())
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT)
  const [activeTool, setActiveTool] = useState<Tool>('pen')
  const [color, setColor] = useState<StrokeColor>('#222222')
  const [width, setWidth] = useState(3)
  const [selection, setSelection] = useState<SelectionState>(EMPTY_SELECTION)
  const [transientStroke, setTransientStroke] = useState<{
    points: Point[]
    color: string
    width: number
  }>()
  const [noteDraft, setNoteDraft] = useState<NoteDraft | null>(null)
  const [penOpen, setPenOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading')
  const [recovered, setRecovered] = useState(false)
  const spacePressedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadBoard().then((result) => {
      if (cancelled) return
      setDocument(result.board.document)
      setViewport(result.board.viewport)
      setColor((result.board.preferences.color as StrokeColor) || '#222222')
      setWidth(result.board.preferences.width || 3)
      setSaveStatus(result.status)
      setRecovered(result.recovered)
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let frame = 0
    const render = () => {
      const ratio = resizeCanvas(
        canvas,
        canvas.clientWidth,
        canvas.clientHeight,
      )
      drawWhiteboard(
        canvas,
        document,
        viewport,
        selection,
        transientStroke,
        ratio,
      )
    }
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(render)
    }
    schedule()
    const observer = new ResizeObserver(schedule)
    observer.observe(canvas)
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
    }
  }, [document, viewport, selection, transientStroke])

  useEffect(() => {
    if (!hydrated) return
    setSaveStatus('saving')
    const timer = window.setTimeout(() => {
      saveBoard(createPersistedBoard(document, viewport, color, width)).then(
        setSaveStatus,
      )
    }, 300)
    return () => window.clearTimeout(timer)
  }, [document, viewport, color, width, hydrated])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editing
        = target?.tagName === 'INPUT'
          || target?.tagName === 'TEXTAREA'
          || target?.isContentEditable
      if (event.code === 'Space' && !editing) {
        spacePressedRef.current = true
        event.preventDefault()
        return
      }
      if (editing && !event.metaKey && !event.ctrlKey) return
      const modifier = event.metaKey || event.ctrlKey
      if (modifier && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) performRedo()
        else performUndo()
        return
      }
      if (editing) return
      if (event.key === 'b') setActiveTool('pen')
      if (event.key === 'e') setActiveTool('eraser')
      if (event.key === 'v') setActiveTool('select')
      if (event.key === 'h') setActiveTool('pan')
      if (event.key === 'n') setActiveTool('note')
      if (event.key === 'Delete' || event.key === 'Backspace') deleteSelected()
      if (event.key === 'Escape') {
        setPenOpen(false)
        setMenuOpen(false)
        setNoteDraft(null)
        setClearOpen(false)
        setSelection(EMPTY_SELECTION)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePressedRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  })

  function screenPoint(event: ReactPointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure: event.pressure,
    }
  }

  function commitDocument(next: WhiteboardDocument, label: string) {
    if (sameDocument(document, next)) return
    setHistory(current => commit(current, document, next, label))
    setDocument(next)
  }

  function performUndo() {
    setHistory((current) => {
      const result = undo(current, document)
      setDocument(result.document)
      setSelection(EMPTY_SELECTION)
      return result.history
    })
  }

  function performRedo() {
    setHistory((current) => {
      const result = redo(current, document)
      setDocument(result.document)
      setSelection(EMPTY_SELECTION)
      return result.history
    })
  }

  function deleteSelected() {
    if (!selection.ids.length) return
    commitDocument(
      {
        ...document,
        elements: document.elements.filter(
          element => !selection.ids.includes(element.id),
        ),
      },
      'Delete selection',
    )
    setSelection(EMPTY_SELECTION)
  }

  function startPointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = screenPoint(event)
    pointerMapRef.current.set(event.pointerId, point)
    const canvas = event.currentTarget
    if (pointerMapRef.current.size === 2) {
      const points = [...pointerMapRef.current.values()]
      const center = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      }
      pinchRef.current = {
        center,
        distance: Math.max(
          1,
          Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
        ),
        viewport,
      }
      interactionRef.current = null
      setTransientStroke(undefined)
      return
    }
    if (activeTool === 'note') {
      const world = screenToWorld(point, viewport)
      setNoteDraft({
        x: world.x,
        y: world.y,
        screenX: point.x + 10,
        screenY: point.y + 10,
        text: '',
      })
      return
    }
    canvas.setPointerCapture(event.pointerId)
    if (spacePressedRef.current || activeTool === 'pan') {
      interactionRef.current = {
        kind: 'pan',
        pointerId: event.pointerId,
        start: point,
        viewport,
      }
      return
    }
    const world = screenToWorld(point, viewport)
    if (activeTool === 'pen') {
      const points = [world]
      interactionRef.current = {
        kind: 'draw',
        pointerId: event.pointerId,
        points,
      }
      setTransientStroke({ points, color, width })
      return
    }
    if (activeTool === 'eraser') {
      const hit = hitTest(document, world, 10 / viewport.scale)
      if (hit)
        commitDocument(
          {
            ...document,
            elements: document.elements.filter(
              element => element.id !== hit.id,
            ),
          },
          'Erase element',
        )
      return
    }
    const hit = hitTest(document, world, 10 / viewport.scale)
    if (hit) {
      const ids = selection.ids.includes(hit.id) ? selection.ids : [hit.id]
      setSelection({ ids, marquee: null })
      interactionRef.current = {
        kind: 'select',
        pointerId: event.pointerId,
        mode: 'move',
        start: world,
        initialDocument: document,
        initialSelection: ids,
      }
    } else {
      setSelection({ ids: [], marquee: null })
      interactionRef.current = {
        kind: 'select',
        pointerId: event.pointerId,
        mode: 'marquee',
        start: world,
        initialDocument: document,
        initialSelection: [],
      }
    }
  }

  function movePointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = screenPoint(event)
    pointerMapRef.current.set(event.pointerId, point)
    if (pinchRef.current && pointerMapRef.current.size >= 2) {
      const points = [...pointerMapRef.current.values()]
      const center = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      }
      const distance = Math.max(
        1,
        Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
      )
      const scale
        = (pinchRef.current.viewport.scale * distance)
          / pinchRef.current.distance
      setViewport(
        zoomAt(
          {
            ...pinchRef.current.viewport,
            x:
              pinchRef.current.viewport.x
              + center.x
              - pinchRef.current.center.x,
            y:
              pinchRef.current.viewport.y
              + center.y
              - pinchRef.current.center.y,
          },
          center,
          scale,
        ),
      )
      return
    }
    const interaction = interactionRef.current
    if (!interaction) return
    if (interaction.kind === 'draw') {
      const world = screenToWorld(point, viewport)
      const previous = interaction.points.at(-1)
      if (
        !previous
        || Math.hypot(world.x - previous.x, world.y - previous.y)
        >= 1.5 / viewport.scale
      ) {
        interaction.points.push(world)
        setTransientStroke({ points: [...interaction.points], color, width })
      }
      return
    }
    if (interaction.kind === 'pan') {
      setViewport({
        ...interaction.viewport,
        x: interaction.viewport.x + point.x - interaction.start.x,
        y: interaction.viewport.y + point.y - interaction.start.y,
      })
      return
    }
    const world = screenToWorld(point, viewport)
    if (interaction.mode === 'marquee') {
      const bounds = boundsFromPoints(interaction.start, world)
      setSelection({
        ids: document.elements
          .filter(element => elementIntersectsBounds(element, bounds))
          .map(element => element.id),
        marquee: bounds,
      })
    } else {
      const dx = world.x - interaction.start.x
      const dy = world.y - interaction.start.y
      setDocument(
        moveElements(
          interaction.initialDocument,
          interaction.initialSelection,
          dx,
          dy,
        ),
      )
    }
  }

  function endPointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    pointerMapRef.current.delete(event.pointerId)
    if (pointerMapRef.current.size < 2) pinchRef.current = null
    const interaction = interactionRef.current
    interactionRef.current = null
    setTransientStroke(undefined)
    if (!interaction) return
    if (interaction.kind === 'draw') {
      if (interaction.points.length > 1) {
        const stroke = {
          kind: 'stroke' as const,
          id: createId(),
          points: interaction.points,
          color,
          width,
          createdAt: Date.now(),
        }
        commitDocument(
          { ...document, elements: [...document.elements, stroke] },
          'Draw stroke',
        )
      }
      return
    }
    if (
      interaction.kind === 'select'
      && interaction.mode === 'move'
      && !sameDocument(interaction.initialDocument, document)
    ) {
      setHistory(current =>
        commit(
          current,
          interaction.initialDocument,
          document,
          'Move selection',
        ),
      )
    }
    if (interaction.kind === 'select')
      setSelection(current => ({ ...current, marquee: null }))
  }

  function editNote(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = screenPoint(event)
    const hit = hitTest(
      document,
      screenToWorld(point, viewport),
      10 / viewport.scale,
    )
    if (hit?.kind === 'note')
      setNoteDraft({
        id: hit.id,
        x: hit.x,
        y: hit.y,
        screenX: point.x + 10,
        screenY: point.y + 10,
        text: hit.text,
      })
  }

  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    const rect = event.currentTarget.getBoundingClientRect()
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    setViewport(current =>
      zoomAt(current, point, current.scale * (event.deltaY > 0 ? 0.9 : 1.1)),
    )
  }

  function zoomBy(factor: number) {
    const canvas = canvasRef.current
    if (!canvas) return
    setViewport(current =>
      zoomAt(
        current,
        { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 },
        current.scale * factor,
      ),
    )
  }

  function fitContent() {
    const canvas = canvasRef.current
    if (canvas)
      setViewport(
        fitViewportToBounds(
          boundsOfDocument(document),
          canvas.clientWidth,
          canvas.clientHeight,
        ),
      )
  }

  function saveNote() {
    if (!noteDraft || !noteDraft.text.trim()) {
      setNoteDraft(null)
      return
    }
    const note: NoteElement = {
      kind: 'note',
      id: noteDraft.id ?? createId(),
      x: noteDraft.x,
      y: noteDraft.y,
      width: 220,
      height: Math.max(76, 40 + noteDraft.text.split('\n').length * 19),
      text: noteDraft.text.trim(),
      createdAt: Date.now(),
    }
    const next = noteDraft.id
      ? {
          ...document,
          elements: document.elements.map(element =>
            element.id === noteDraft.id ? note : element,
          ),
        }
      : { ...document, elements: [...document.elements, note] }
    commitDocument(next, noteDraft.id ? 'Edit note' : 'Add note')
    setNoteDraft(null)
  }

  function confirmClear() {
    if (!document.elements.length) {
      setClearOpen(false)
      return
    }
    commitDocument(createEmptyDocument(), 'Clear board')
    setSelection(EMPTY_SELECTION)
    setClearOpen(false)
  }

  const toolbar = [
    {
      name: 'pen',
      tooltip: 'Freehand',
      className: 'tool-pen',
      active: activeTool === 'pen',
      onClick: () => {
        setActiveTool('pen')
        setPenOpen(open => !open)
        setMenuOpen(false)
      },
    },
    {
      name: 'eraser',
      tooltip: 'Eraser',
      className: 'tool-eraser',
      active: activeTool === 'eraser',
      onClick: () => {
        setActiveTool('eraser')
        setPenOpen(false)
      },
    },
    {
      name: 'note',
      tooltip: 'Add note',
      className: 'tool-note',
      active: activeTool === 'note',
      onClick: () => {
        setActiveTool('note')
        setPenOpen(false)
      },
    },
    {
      name: 'select',
      tooltip: 'Select',
      className: 'tool-select',
      active: activeTool === 'select',
      onClick: () => {
        setActiveTool('select')
        setPenOpen(false)
      },
    },
    {
      name: 'pan',
      tooltip: 'Pan',
      className: 'tool-pan',
      active: activeTool === 'pan',
      onClick: () => {
        setActiveTool('pan')
        setPenOpen(false)
      },
    },
    {
      name: 'undo',
      tooltip: 'Undo',
      className: 'tool-undo',
      disabled: !history.past.length,
      onClick: performUndo,
    },
    {
      name: 'redo',
      tooltip: 'Redo',
      className: 'tool-redo',
      disabled: !history.future.length,
      onClick: performRedo,
    },
    {
      name: 'menu',
      tooltip: 'Menu',
      className: 'tool-menu',
      onClick: () => {
        setMenuOpen(true)
        setPenOpen(false)
      },
    },
  ]

  const statusVisible = saveStatus !== 'saved' || recovered

  return (
    <main className="whiteboard-app">
      {!hydrated && (
        <div className="workspace-skeleton" aria-label="Loading whiteboard" />
      )}
      {statusVisible && (
        <div
          className={`whiteboard-status ${saveStatus === 'saving' ? 'is-saving' : ''} ${saveStatus === 'error' ? 'is-error' : ''}`}
        >
          <span>
            {recovered
              ? 'Recovered local board'
              : saveStatus === 'saving'
                ? 'Saving locally…'
                : saveStatus === 'memory-only'
                  ? 'Memory only'
                  : saveStatus === 'error'
                    ? 'Save unavailable'
                    : 'Canvas Room · ready locally'}
          </span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`whiteboard-canvas tool-${activeTool} ${interactionRef.current?.kind === 'pan' ? 'is-dragging' : ''}`}
        onPointerDown={startPointer}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onDoubleClick={editNote}
        onWheel={handleWheel}
        aria-label="Whiteboard canvas"
      />
      <div className="tool-dock" aria-label="Whiteboard tools">
        {toolbar.map(button => (
          <ToolButton key={button.name} {...button} />
        ))}
      </div>
      {penOpen && (
        <div className="pen-panel" aria-label="Pen options">
          <div className="pen-row">
            {[1, 3, 7].map(size => (
              <button
                key={size}
                type="button"
                className={`pen-option ${width === size ? 'active' : ''}`}
                aria-label={`Line width ${size}`}
                onClick={() => setWidth(size)}
              >
                <span
                  className={`pen-line ${size === 1 ? 'thin' : size === 3 ? 'medium' : 'thick'}`}
                />
              </button>
            ))}
          </div>
          <div className="pen-row">
            {['pen', 'eraser', 'select'].map(name => (
              <button
                key={name}
                type="button"
                className="pen-option"
                aria-label={name}
                onClick={() => {
                  setActiveTool(name as Tool)
                  setPenOpen(false)
                }}
              >
                <Icon name={name} />
              </button>
            ))}
          </div>
          <div className="pen-row">
            {whiteboardTokens.colors.map(item => (
              <button
                key={item}
                type="button"
                className="pen-option"
                aria-label={`Color ${item}`}
                onClick={() => setColor(item)}
              >
                <span
                  className={`color-dot ${color === item ? 'active' : ''}`}
                  style={{ background: item }}
                />
              </button>
            ))}
          </div>
          <div className="pen-pro-note">More tools in Pro · unavailable</div>
        </div>
      )}
      <div className="view-dock" aria-label="View controls">
        <button
          type="button"
          className="view-button"
          aria-label="Zoom in"
          onClick={() => zoomBy(1.2)}
        >
          <Icon name="zoom-in" />
        </button>
        <button
          type="button"
          className="view-button"
          aria-label="Reset view"
          onClick={() => setViewport(DEFAULT_VIEWPORT)}
        >
          <Icon name="home" />
        </button>
        <button
          type="button"
          className="view-button"
          aria-label="Fit content"
          onClick={fitContent}
        >
          <Icon name="fit" />
        </button>
        <button
          type="button"
          className="view-button"
          aria-label="Zoom out"
          onClick={() => zoomBy(0.8)}
        >
          <Icon name="zoom-out" />
        </button>
      </div>
      {noteDraft && (
        <div
          className="note-editor"
          style={{
            left: Math.min(
              Number.isFinite(noteDraft.screenX) ? noteDraft.screenX : 12,
              Math.max(12, (canvasRef.current?.clientWidth ?? 260) - 232),
            ),
            top: Math.min(
              Number.isFinite(noteDraft.screenY) ? noteDraft.screenY : 28,
              Math.max(28, (canvasRef.current?.clientHeight ?? 120) - 130),
            ),
          }}
        >
          <textarea
            autoFocus
            value={noteDraft.text}
            onChange={event =>
              setNoteDraft({ ...noteDraft, text: event.target.value })}
            placeholder="Write a note…"
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter')
                saveNote()
            }}
          />
          <div className="note-editor-actions">
            <button type="button" onClick={() => setNoteDraft(null)}>
              Cancel
            </button>
            <button type="button" className="primary" onClick={saveNote}>
              Save
            </button>
          </div>
        </div>
      )}
      {menuOpen && (
        <>
          <button
            type="button"
            className="menu-scrim"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="menu-drawer" aria-label="Whiteboard menu">
            <div className="menu-header">
              <div className="menu-title">
                <span className="menu-mark">C</span>
                <span>Canvas Room</span>
              </div>
              <button
                type="button"
                className="menu-close"
                aria-label="Close menu"
                onClick={() => setMenuOpen(false)}
              >
                ‹
              </button>
            </div>
            <div className="menu-list">
              <MenuItem icon="invite" label="Invite" disabled hint="Soon" />
              <MenuItem
                icon="view"
                label="View-only mode"
                disabled
                hint="Soon"
              />
              <MenuItem icon="view" label="Sync view" disabled hint="Soon" />
              <MenuItem
                icon="download"
                label="Export PNG"
                onClick={() => {
                  exportBoardPng(document)
                  setMenuOpen(false)
                }}
                disabled={!document.elements.length}
              />
              <MenuItem
                icon="trash"
                label="Clear board"
                onClick={() => {
                  setClearOpen(true)
                  setMenuOpen(false)
                }}
                disabled={!document.elements.length}
              />
              <MenuItem icon="note" label="More tools" disabled hint="Soon" />
            </div>
          </aside>
        </>
      )}
      {clearOpen && (
        <div className="confirm-overlay">
          <div
            className="confirm-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-title"
          >
            <h2 id="clear-title">Clear this board?</h2>
            <p>
              This removes the current elements. You can undo it immediately
              after confirming.
            </p>
            <div className="confirm-actions">
              <button type="button" onClick={() => setClearOpen(false)}>
                Cancel
              </button>
              <button type="button" className="danger" onClick={confirmClear}>
                Clear board
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function MenuItem({
  icon,
  label,
  disabled,
  hint,
  onClick,
}: {
  icon: string
  label: string
  disabled?: boolean
  hint?: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className="menu-item"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} />
      <span>{label}</span>
      {hint && <small>{hint}</small>}
    </button>
  )
}
