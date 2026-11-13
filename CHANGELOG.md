# Changelog

## [0.2.0] — 2026-11-13

### Breaking

- **Tool names no longer contain a dot.** The three tools are now `import_check`, `import_elements` and `import_export`. Providers validate `tools[].name` against `^[a-zA-Z0-9_-]+$`; the old dotted names invalidated the whole `tools` array, so the plugin registered but every request carrying its tools was rejected with `Invalid 'tools[N].name'`. Minor bump because tool names are covered by the 0.1.0 compatibility promise — update prompts, saved calls and permission rules that still use the old dotted names.
- `test/tool-name-wire.test.mjs` pins the wire pattern so a new tool cannot reintroduce a dot or drop the `import_` namespace.
- Earlier changelog entries use the new spelling, so a repository-wide search no longer finds dotted tool names.

## [0.1.0] — 2026-11-03

### Stable

- First non-alpha release: tool names and the CLI surface are covered by a
  compatibility promise (breaking changes require a minor bump).
- Ships a quickstart sample, a one-line prompt, a permission block and real captures.

## 0.1.0-alpha.1 — 2026-11-02

- First public alpha of `dsh-import-customs-check`.
- `import_check`: nine-field cross-check across invoice, packing list, bill of lading and customs declaration, with consistent/mismatch/single-source/absent statuses and a `strict` gate.
- `import_elements`: 12 declaration header elements with a missing list.
- `import_export`: safe-path CSV export of the field table.
- Synthetic four-document sample with a deliberate weight mismatch, HS formatting difference and one missing element; real-output golden file and terminal screenshot.
- Local only: no network, no model call, no upload.
