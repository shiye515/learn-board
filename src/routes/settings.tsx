import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/settings')({ ssr: false, component: SettingsPage })

function SettingsPage() {
  const [compact, setCompact] = useState(false)
  return <><div className="eyebrow">Preferences</div><h1>Shape the quiet.</h1><p className="lede">Settings are personal and browser-specific, so this screen skips initial SSR and hydrates as a client-only route.</p><section className="card focus-panel" style={{ marginTop: 50, maxWidth: 620 }}><div className="setting-row"><span>Compact board layout</span><button className="stream-button" onClick={() => setCompact(!compact)}>{compact ? 'On' : 'Off'}</button></div><div className="setting-row"><span>Notifications</span><span className="muted">Coming later</span></div></section></>
}
