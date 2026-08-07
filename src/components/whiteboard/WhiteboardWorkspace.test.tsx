import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { WhiteboardWorkspace } from './WhiteboardWorkspace'

const context = {
  setTransform: vi.fn(),
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  arc: vi.fn(),
  stroke: vi.fn(),
  strokeRect: vi.fn(),
  fillText: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  setLineDash: vi.fn(),
} as unknown as CanvasRenderingContext2D

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', () => undefined)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'releasePointerCapture', {
    configurable: true,
    value: vi.fn(),
  })
})

afterAll(() => vi.restoreAllMocks())

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: { getItem: vi.fn(() => null), setItem: vi.fn(), removeItem: vi.fn(), clear: vi.fn() },
  })
  window.localStorage.clear()
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', {
    configurable: true,
    value: 800,
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientHeight', {
    configurable: true,
    value: 600,
  })
})

describe('WhiteboardWorkspace', () => {
  it('exposes the reference tool states', async () => {
    render(<WhiteboardWorkspace />)
    await waitFor(() => expect(screen.queryByText('Loading local board')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Freehand' }))
    expect(screen.getByRole('generic', { name: 'Pen options' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('complementary', { name: 'Whiteboard menu' })).toBeInTheDocument()
  })

  it('supports note creation and undo', async () => {
    render(<WhiteboardWorkspace />)
    await waitFor(() => expect(screen.queryByText('Loading local board')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Add note' }))
    fireEvent.pointerDown(screen.getByLabelText('Whiteboard canvas'), {
      pointerId: 2,
      pointerType: 'mouse',
      clientX: 120,
      clientY: 120,
    })
    fireEvent.change(screen.getByPlaceholderText('Write a note…'), {
      target: { value: 'test note' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByRole('button', { name: 'Undo' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('button', { name: 'Redo' })).toBeEnabled()
  })
})
