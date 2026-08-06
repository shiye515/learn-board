import { createFileRoute } from '@tanstack/react-router'
import { zodValidator } from '@tanstack/zod-adapter'
import { useState } from 'react'
import { saveFocusNote } from '../lib/board.functions'
import { focusSearchSchema } from '../lib/schemas'

export const Route = createFileRoute('/focus')({
  validateSearch: zodValidator(focusSearchSchema),
  ssr: 'data-only',
  loaderDeps: ({ search }) => ({ session: search.session }),
  loader: ({ deps }) => ({ session: deps.session }),
  component: FocusPage,
})

function FocusPage() {
  const { session } = Route.useLoaderData()
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)
  const [minutes, setMinutes] = useState(session)
  async function save() { if (!note.trim()) return; await saveFocusNote({ data: { note } }); setSaved(true) }
  return <><div className="eyebrow">Focus room</div><h1>One thing, for long enough.</h1><p className="lede">This route receives its session data from the server, then lets the browser own the timer and draft note.</p><div className="focus-grid"><section className="card focus-panel"><h2>{minutes} minutes</h2><p>A single, quiet block is enough to make progress. The timer is intentionally client-side.</p><input className="focus-input" type="range" min="15" max="120" step="5" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))} /><div className="muted">Adjust the session length</div></section><section className="card focus-panel"><h2>Capture a thought</h2><p>Save a short reflection through a validated, typed POST server function.</p><textarea className="focus-input" rows={4} value={note} onChange={(event) => { setNote(event.target.value); setSaved(false) }} placeholder="What are you noticing?" /><button className="primary-button" onClick={save}>{saved ? 'Saved' : 'Save note'}</button></section></div></>
}
