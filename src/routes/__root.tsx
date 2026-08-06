import { HeadContent, Link, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({ meta: [{ title: 'Learn Board — a quieter way to keep learning' }, { name: 'description', content: 'A focused learning workspace built with TanStack Start.' }] }),
  component: RootComponent,
})

function RootComponent() {
  return <div className="shell"><header className="topbar"><Link to="/" search={{ view: 'today' }} className="brand"><span className="brand-mark">lb</span><span>learn board</span></Link><nav className="nav"><Link to="/" search={{ view: 'today' }} activeProps={{ className: 'active' }}>Board</Link><Link to="/focus" search={{ session: 45 }} activeProps={{ className: 'active' }}>Focus</Link><Link to="/settings" activeProps={{ className: 'active' }}>Settings</Link></nav></header><main className="main"><Outlet /></main><Scripts /></div>
}
