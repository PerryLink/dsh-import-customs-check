# Changelog

## 0.1.0-alpha.1 — 2026-11-02

- First public alpha of `dsh-import-customs-check`.
- `import.check`: nine-field cross-check across invoice, packing list, bill of lading and customs declaration, with consistent/mismatch/single-source/absent statuses and a `strict` gate.
- `import.elements`: 12 declaration header elements with a missing list.
- `import.export`: safe-path CSV export of the field table.
- Synthetic four-document sample with a deliberate weight mismatch, HS formatting difference and one missing element; real-output golden file and terminal screenshot.
- Local only: no network, no model call, no upload.
