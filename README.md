# Canvas Room

Canvas Room is a local-first whiteboard built with React, TanStack Start, TanStack Router, and the Cloudflare Workers Vite plugin.

It provides a focused canvas workspace for freehand drawing, notes, selection, pan and zoom, undo/redo, local persistence, and PNG export.

## Features

- Freehand pen with pressure-aware points, three widths, and black/blue/red colors
- Eraser, notes, click/marquee selection, grouped movement, and deletion
- Undo/redo with a capped 100-step history
- Pointer, touch, pinch zoom, wheel zoom, and temporary Space-to-pan
- IndexedDB persistence with localStorage and in-memory fallbacks
- PNG export with tight content bounds and a white background
- Full-document SSR with a stable loading shell and streaming-compatible TanStack Start output
- Cloudflare Workers deployment configuration

## Requirements

- Node.js 22+
- pnpm 10+

## Development

```bash
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

Run validation and a production build with:

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Deployment

The application targets Cloudflare Workers without changing the TanStack Start application model:

```bash
pnpm deploy
```

Cloudflare dashboard Git integration is configured to deploy pushes to `main`. The Worker configuration is in [`wrangler.jsonc`](./wrangler.jsonc).

## Project structure

- `src/routes/` — file-based TanStack Router routes and document shell
- `src/components/whiteboard/` — interactive whiteboard workspace
- `src/whiteboard/` — document model, geometry, rendering, history, persistence, and export
- `tests/visual/` — visual reference and implementation screenshots

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request. Please follow the [Code of Conduct](./CODE_OF_CONDUCT.md).

## Security

Please report security vulnerabilities privately as described in [SECURITY.md](./SECURITY.md), rather than opening a public issue.

## License

Canvas Room is released under the [MIT License](./LICENSE).
