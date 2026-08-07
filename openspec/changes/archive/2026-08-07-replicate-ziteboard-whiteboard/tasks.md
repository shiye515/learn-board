## 1. P0 — Visual Baseline, Tests, and Application Foundation

- [x] 1.1 Capture and store `desktop-initial`, `desktop-pen-options`, `desktop-menu-open`, and `mobile-initial` reference screenshots under `tests/visual/reference/` at the design-specified viewports, with a README recording URL, date, browser, viewport, and state setup
- [x] 1.2 Add a unit-test runner, DOM test environment, and browser end-to-end test setup without changing the existing Vite/TanStack Start build model
- [x] 1.3 Define the versioned `WhiteboardDocument`, stroke, note, point, bounds, tool, selection, and viewport TypeScript types
- [x] 1.4 Implement and unit-test screen/world coordinate conversion, anchored zoom, bounds calculation, and fit-content transforms
- [x] 1.5 Implement and unit-test reversible document commands plus a capped 100-step undo/redo history with branch invalidation
- [x] 1.6 Create shared whiteboard visual tokens for the measured status bar, 48px controls, spacing, borders, shadows, colors, and z-index layers

## 2. P0 — Replace the Demo with the Whiteboard Shell

- [x] 2.1 Replace the root route layout with a full-document SSR whiteboard shell and remove the Learn Board header/navigation markup
- [x] 2.2 Replace the index route with an SSR-safe client-only whiteboard workspace and a layout-stable loading skeleton
- [x] 2.3 Build the desktop top status strip, right-aligned circular tool controls, bottom-right view controls, SVG icon system, tooltips, and focus states
- [x] 2.4 Build pen options and more-tools flyouts with outside-click/Escape dismissal and explicit disabled states for collaboration-only items
- [x] 2.5 Add the narrow-screen toolbar layout and verify there is no page-level horizontal or vertical scrolling
- [x] 2.6 Remove the Focus and Settings Demo routes, old board server functions/schemas, sample data, and obsolete card-based CSS
- [x] 2.7 Replace all reference branding with a project-owned neutral product name, SVG icon set, and menu copy; verify no Ziteboard asset or API request remains

## 3. P0 — Canvas Rendering and Viewport

- [x] 3.1 Implement the layered Canvas component with ResizeObserver and device-pixel-ratio-aware backing stores
- [x] 3.2 Implement document rendering for pressure-aware strokes and text notes in world coordinates
- [x] 3.3 Implement requestAnimationFrame render invalidation so transient input and static document updates are coalesced
- [x] 3.4 Implement pointer-anchored wheel zoom, zoom buttons, and 10%–800% clamping
- [x] 3.5 Implement explicit pan, temporary Space-to-pan, two-pointer pan/pinch gestures, pointer capture, and pointer cancellation cleanup
- [x] 3.6 Implement reset-view and fit-all-content controls with safe viewport padding
- [x] 3.7 Add a populated 500-stroke performance fixture and verify active drawing is not blocked by rendering or persistence work

## 4. P0/P1 — Editing Tools

- [x] 4.1 Implement the freehand pen tool with point filtering, pressure sampling, three widths, black/blue/red colors, and atomic stroke commits
- [x] 4.2 Implement hit testing and the reversible eraser behavior for strokes
- [x] 4.3 Implement note creation, inline plain-text editing, empty-note cancellation, and note rendering
- [x] 4.4 Implement click selection and marquee selection for strokes and notes with visible selection bounds
- [x] 4.5 Implement grouped selection movement and deletion as reversible atomic commands
- [x] 4.6 Wire undo/redo controls and platform keyboard shortcuts, including correct disabled states and text-editor shortcut isolation
- [x] 4.7 Implement guarded clear-all confirmation and reversible clear history
- [x] 4.8 Add unit and interaction tests for drawing, erasing, notes, selection, movement, undo/redo branching, clear cancellation, and keyboard shortcuts

## 5. P1/P2 — Local Persistence and Export

- [x] 5.1 Implement a versioned IndexedDB whiteboard repository with localStorage fallback and in-memory fallback
- [x] 5.2 Implement restore-before-save initialization and 300ms debounced autosave for document, viewport, and tool preferences
- [x] 5.3 Add non-blocking saved, saving, storage-unavailable, and corrupt-data recovery status indicators
- [x] 5.4 Add persistence tests for reload restoration, unknown schema versions, corrupt payloads, and unavailable storage backends
- [x] 5.5 Implement tight-bounds PNG rendering with a white background and 32px padding, excluding all application chrome and selection overlays
- [x] 5.6 Wire PNG download, filename generation, empty-board handling, and tests that assert no whiteboard content is transmitted over the network

## 6. P2 — Visual and Production Verification

- [x] 6.1 Add browser tests for mouse drawing, wheel zoom, toolbar/flyout behavior, undo/redo, clear confirmation, reload restoration, and PNG export
- [x] 6.2 Add touch/pointer tests for stylus pressure fallback, pointer cancellation, two-finger pan/zoom, and temporary pan restoration
- [x] 6.3 Capture all desktop implementation states at `1312×872` into `tests/visual/actual/` and tune shell geometry to each reference within the specified 2px layout tolerance
- [x] 6.4 Verify responsive layouts at representative phone and tablet sizes, including tool reachability and absence of page scrollbars
- [x] 6.5 Capture the `390×844` mobile implementation state into `tests/visual/actual/` and verify the direct-tool subset, overflow access, view controls, and no-scroll requirement
- [x] 6.6 Regenerate the TanStack route tree and run `pnpm typecheck`, unit tests, browser tests, `pnpm build`, and a `pnpm start` Node/srvx smoke test
- [x] 6.7 Run the complete mouse acceptance flow in the production server and verify the browser console contains no errors or unhandled promise rejections
- [x] 6.8 Audit server/client bundles to confirm Canvas, storage, and browser globals stay behind the client boundary and remove unused dependencies/assets
- [x] 6.9 Search the built UI and source tree to confirm no Learn Board routes, navigation, sample copy, demo server functions, card styles, Ziteboard branding, private assets, or Ziteboard API calls remain

## 7. Delivery Checkpoints

- [x] 7.1 Record a `whiteboard-model` checkpoint after document types, transforms, command history, and their tests are complete and green
- [x] 7.2 Record a `whiteboard-shell` checkpoint after the SSR/client boundary, visual tokens, toolbar, flyouts, menu, and responsive shell are complete and green
- [x] 7.3 Record a `canvas-tools` checkpoint after rendering, viewport controls, pen, eraser, selection, notes, history, and shortcuts are complete and green
- [x] 7.4 Record a `persistence-export` checkpoint after restore, autosave, storage fallbacks, status feedback, and PNG export are complete and green
- [x] 7.5 Record a `visual-verification` checkpoint after reference comparison, browser tests, production smoke tests, console audit, and cleanup all pass
