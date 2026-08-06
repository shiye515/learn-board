import { Await, createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useState } from 'react'
import { getBoard, streamActivity } from '../lib/board.functions'
import { boardSearchSchema } from '../lib/schemas'

export const Route = createFileRoute('/')({
  validateSearch: zodValidator(boardSearchSchema),
  loaderDeps: ({ search }) => ({ view: search.view }),
  loader: async ({ deps }) => ({ board: await getBoard({ data: { view: deps.view } }), activity: collectActivity() }),
  component: BoardPage,
})

function BoardPage() {
  const { board, activity } = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const [streamed, setStreamed] = useState<{ time: string; text: string }[]>([])

  async function startStream() {
    setStreamed([])
    for await (const chunk of await streamActivity()) setStreamed((current) => [...current, chunk])
  }

  return <>
    <section className="hero-row"><div><div className="eyebrow">Your learning, in view</div><h1>Make a little room for what matters.</h1><p className="lede">A calm board for keeping momentum across the things you’re learning right now.</p></div><div className="date-chip">{board.dateLabel}</div></section>
    <div className="board-grid">
      <section className="card"><div className="card-body"><div className="card-head"><div><h2>{Route.useSearch().view === 'week' ? 'This week' : 'Today’s board'}</h2><span className="muted">Small steps, kept visible.</span></div><button className="stream-button" onClick={() => navigate({ search: { view: Route.useSearch().view === 'today' ? 'week' : 'today' } })}>{Route.useSearch().view === 'today' ? 'Show week' : 'Show today'}</button></div><div className="progress"><span style={{ width: `${Math.round((board.completed / board.tasks.length) * 100)}%` }} /></div><div className="metric-row"><div className="metric"><strong>{board.completed}/{board.tasks.length}</strong><span>complete</span></div><div className="metric"><strong>{board.totalMinutes}</strong><span>minutes</span></div><div className="metric"><strong>{board.streak}</strong><span>day streak</span></div></div></div></section>
      <section className="card"><div className="card-body"><div className="card-head"><div><h2>Next up</h2><span className="muted">Your closest open loop.</span></div></div><div className="task-list">{board.tasks.filter((task) => !task.done).slice(0, 3).map((task) => <div className="task" key={task.id}><span className="task-dot" /><div><div className="task-title">{task.title}</div><span className="muted">{task.course}</span></div><span className="task-meta">{task.minutes}m</span></div>)}</div></div></section>
      <section className="card stream-card"><div className="card-body"><div className="card-head"><div><h2>Recent movement</h2><span className="muted">Typed chunks arrive as the server works.</span></div><button className="stream-button" onClick={startStream}>Replay stream</button></div><Await promise={activity} fallback={<div className="empty">Loading your latest movement…</div>}>{(initial) => <div>{[...initial, ...streamed].map((item, index) => <div className="stream-line" key={`${item.time}-${index}`}><span className="stream-time">{item.time}</span><span>{item.text}</span></div>)}</div>}</Await></div></section>
    </div>
  </>
}

async function collectActivity() {
  const chunks: { time: string; text: string }[] = []
  for await (const chunk of await streamActivity()) chunks.push(chunk)
  return chunks
}
