# Contributing

Thanks for contributing to Canvas Room.

## Before you start

For larger changes, open an issue first so the scope and design can be discussed. Small bug fixes and documentation improvements can go directly to a pull request.

## Local setup

```bash
pnpm install
pnpm dev
```

Before submitting a pull request, run:

```bash
pnpm test
pnpm typecheck
pnpm build
```

## Pull requests

- Keep changes focused and explain the user impact.
- Add or update tests for behavior changes.
- Preserve the client/server boundary in TanStack Start routes and modules.
- Avoid adding third-party assets or copying private service branding.
- Include screenshots for meaningful visual changes.
- Use a clear commit message and describe any deployment or migration notes.

## Reporting bugs

Include the browser, operating system, viewport size, reproduction steps, expected behavior, actual behavior, and relevant console output. Do not include private board data or secrets.
