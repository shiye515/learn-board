## 1. P0 — Visual Baseline, Tests, and Application Foundation

- [ ] 1.1 Capture and store `desktop-initial`, `desktop-pen-options`, `desktop-menu-open`, and `mobile-initial` reference screenshots under `tests/visual/reference/` at the design-specified viewports, with a README recording URL, date, browser, viewport, and state setup
- [ ] 1.2 Add a unit-test runner, DOM test environment, and browser end-to-end test setup without changing the existing Vite/TanStack Start build model
- [ ] 1.3 Define the versioned `WhiteboardDocument`, stroke, note, point, bounds, tool, selection, and viewport TypeScript types
- [ ] 1.4 Implement and unit-test screen/world coordinate conversion, anchored zoom, bounds calculation, and fit-content transforms
- [ ] 1.5 Implement and unit-test reversible document commands plus a capped 100-step undo/redo history with branch invalidation
- [ ] 1.6 Create shared whiteboard visual tokens for the measured status bar, 48px controls, spacing, borders, shadows, colors, and z-index layers

## 2. P0 — Replace the Demo with the Whiteboard Shell

- [ ] 2.1 Replace the root route layout with a full-document SSR whiteboard shell and remove the Learn Board header/navigation markup
- [ ] 2.2 Replace the index route with an SSR-safe client-only whiteboard workspace and a layout-stable loading skeleton
- [ ] 2.3 Build the desktop top status strip, right-aligned circular tool controls, bottom-right view controls, SVG icon system, tooltips, and focus states
- [ ] 2.4 Build pen options and more-tools flyouts with outside-click/Escape dismissal and explicit disabled states for collaboration-only items
- [ ] 2.5 Add the narrow-screen toolbar layout and verify there is no page-level horizontal or vertical scrolling
- [ ] 2.6 Remove the Focus and Settings Demo routes, old board server functions/schemas, sample data, and obsolete card-based CSS
- [ ] 2.7 Replace all reference branding with a project-owned neutral product name, SVG icon set, and menu copy; verify no Ziteboard asset or API request remains

## 3. P0 — Canvas Rendering and Viewport

- [ ] 3.1 Implement the layered Canvas component with ResizeObserver and device-pixel-ratio-aware backing stores
- [ ] 3.2 Implement document rendering for pressure-aware strokes and text notes in world coordinates
- [ ] 3.3 Implement requestAnimationFrame render invalidation so transient input and static document updates are coalesced
- [ ] 3.4 Implement pointer-anchored wheel zoom, zoom buttons, and 10%–800% clamping
- [ ] 3.5 Implement explicit pan, temporary Space-to-pan, two-pointer pan/pinch gestures, pointer capture, and pointer cancellation cleanup
- [ ] 3.6 Implement reset-view and fit-all-content controls with safe viewport padding
- [ ] 3.7 Add a populated 500-stroke performance fixture and verify active drawing is not blocked by rendering or persistence work

## 4. P0/P1 — Editing Tools

- [ ] 4.1 Implement the freehand pen tool with point filtering, pressure sampling, three widths, black/blue/red colors, and atomic stroke commits
- [ ] 4.2 Implement hit testing and the reversible eraser behavior for strokes
- [ ] 4.3 Implement note creation, inline plain-text editing, empty-note cancellation, and note rendering
- [ ] 4.4 Implement click selection and marquee selection for strokes and notes with visible selection bounds
- [ ] 4.5 Implement grouped selection movement and deletion as reversible atomic commands
- [ ] 4.6 Wire undo/redo controls and platform keyboard shortcuts, including correct disabled states and text-editor shortcut isolation
- [ ] 4.7 Implement guarded clear-all confirmation and reversible clear history
- [ ] 4.8 Add unit and interaction tests for drawing, erasing, notes, selection, movement, undo/redo branching, clear cancellation, and keyboard shortcuts

## 5. P1/P2 — Local Persistence and Export

- [ ] 5.1 Implement a versioned IndexedDB whiteboard repository with localStorage fallback and in-memory fallback
- [ ] 5.2 Implement restore-before-save initialization and 300ms debounced autosave for document, viewport, and tool preferences
- [ ] 5.3 Add non-blocking saved, saving, storage-unavailable, and corrupt-data recovery status indicators
- [ ] 5.4 Add persistence tests for reload restoration, unknown schema versions, corrupt payloads, and unavailable storage backends
- [ ] 5.5 Implement tight-bounds PNG rendering with a white background and 32px padding, excluding all application chrome and selection overlays
- [ ] 5.6 Wire PNG download, filename generation, empty-board handling, and tests that assert no whiteboard content is transmitted over the network

## 6. P2 — Visual and Production Verification

- [ ] 6.1 Add browser tests for mouse drawing, wheel zoom, toolbar/flyout behavior, undo/redo, clear confirmation, reload restoration, and PNG export
- [ ] 6.2 Add touch/pointer tests for stylus pressure fallback, pointer cancellation, two-finger pan/zoom, and temporary pan restoration
- [ ] 6.3 Capture all desktop implementation states at `1312×872` into `tests/visual/actual/` and tune shell geometry to each reference within the specified 2px layout tolerance
- [ ] 6.4 Verify responsive layouts at representative phone and tablet sizes, including tool reachability and absence of page scrollbars
- [ ] 6.5 Capture the `390×844` mobile implementation state into `tests/visual/actual/` and verify the direct-tool subset, overflow access, view controls, and no-scroll requirement
- [ ] 6.6 Regenerate the TanStack route tree and run `pnpm typecheck`, unit tests, browser tests, `pnpm build`, and a `pnpm start` Node/srvx smoke test
- [ ] 6.7 Run the complete mouse acceptance flow in the production server and verify the browser console contains no errors or unhandled promise rejections
- [ ] 6.8 Audit server/client bundles to confirm Canvas, storage, and browser globals stay behind the client boundary and remove unused dependencies/assets
- [ ] 6.9 Search the built UI and source tree to confirm no Learn Board routes, navigation, sample copy, demo server functions, card styles, Ziteboard branding, private assets, or Ziteboard API calls remain

## 7. Delivery Checkpoints

- [ ] 7.1 Record a `whiteboard-model` checkpoint after document types, transforms, command history, and their tests are complete and green
- [ ] 7.2 Record a `whiteboard-shell` checkpoint after the SSR/client boundary, visual tokens, toolbar, flyouts, menu, and responsive shell are complete and green
- [ ] 7.3 Record a `canvas-tools` checkpoint after rendering, viewport controls, pen, eraser, selection, notes, history, and shortcuts are complete and green
- [ ] 7.4 Record a `persistence-export` checkpoint after restore, autosave, storage fallbacks, status feedback, and PNG export are complete and green
- [ ] 7.5 Record a `visual-verification` checkpoint after reference comparison, browser tests, production smoke tests, console audit, and cleanup all pass
