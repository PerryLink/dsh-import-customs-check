# Evidence — dsh-import-customs-check 0.1.0-alpha.1

All runs are local, over a synthetic import document set. No real shipment, customer data,
network call or model call is involved. No `git commit` and no `npm publish` were performed.

## Environment

- Node `v24.22.1`
- pnpm `11.28.5`
- TypeScript `7.0.2` (NodeNext, strict)
- Date: 2026-11-02 (Asia/Shanghai)

## Commands and results

| Command | Result |
|---|---|
| `pnpm build` | exit 0, `tsc -p tsconfig.json` emits `lib/` |
| `pnpm typecheck` | exit 0 |
| `pnpm test` / `node --test test/*.test.mjs` | 58 tests, 58 pass, 0 fail |
| `node samples/quickstart/run.mjs --check` | golden `expected/result.json` matches |
| `node scripts/lint.mjs` | 10 source files, 10 test files / 58 tests, 16 published entries |
| `node scripts/gate.mjs` | lint ok, acceptance ok, 11/11 acceptance rows pass |
| `npm pack --dry-run --json` | 40 files, 153,118 bytes unpacked, 77,874-byte tarball, no publish |

## Local Package Standard v1 score

The package is intentionally **not** added to `04-build/dsh-plugins/family.json` (not in the
family yet, so the committed roster does not count it). To verify the standard locally, the
official `04-build/dsh-plugins/scripts/score-packages.mjs` was copied to a temporary path,
pointed at a temporary two-item family file, and run against a copy of this checkout:

```
PS1 scores: 2 packages | green 2 / yellow 0 / red 0
domain packages: 2, avg 10.0
10 green  dsh-import-customs-check
```

Per-category score for `dsh-import-customs-check`: `page=1 sample=2 prompt=1 expected=1 permissions=2 errors=1 evidence=2 total=10` (green; every category non-zero).

## Screenshot / golden hashes

| Artifact | SHA-256 |
|---|---|
| `docs/assets/quickstart.png` | `90af93df59acdf93c8f60caadce4c940b36cac50fd7d15129bb5c77ec771bcdf` |
| `docs/assets/quickstart.log` | `8118f942e8408d09892039e00f0a2aa9a38aedeba18866e5c8f4e31f4f268c78` |
| `samples/quickstart/expected/result.json` | `781d13c1176e4be9f292b338c950e4ba2b7e3a7e8408858e672ca041a87ee4e5` |
| `ACCEPTANCE.csv` quickstart row | uses the `expected/result.json` hash above |

The screenshot was rendered by `04-build/dsh-plugins/scripts/render-capture.py` from the real
captured terminal output in `docs/assets/quickstart.log` with
`RENDER_CAPTURE_FONT=/mnt/c/Windows/Fonts/msyh.ttc`; no output text was invented.

## Error-path coverage

- `E_IMPORT_DOC_MISSING` — missing document, malformed JSON, non-object document, duplicate alias, empty/oversized file.
- `E_IMPORT_FIELD_MISMATCH` — `strict: true` plus at least one normalized mismatch; detail names the field in Chinese.
- `E_IMPORT_PATH_INVALID` — missing/directory input path, unsafe export filename, traversal, absolute path, symlink re-anchor.
- Non-error statuses `single_source` and `not_provided` are covered by unit tests and intentionally do not fail the check.

All three codes are exercised by `test/*.test.mjs` and by `scripts/acceptance.mjs`.
