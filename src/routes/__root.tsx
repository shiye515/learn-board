import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { title: 'Canvas Room' },
      { name: 'description', content: 'A quiet, local-first whiteboard.' },
    ],
  }),
  component: RootDocument,
})

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="workspace-skeleton ssr-skeleton" aria-hidden="true" />
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
