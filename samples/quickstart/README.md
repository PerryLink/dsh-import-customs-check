# dsh-import-customs-check quickstart

- `input/import-set.json` — one synthetic import shipment (invoice, packing list, bill of lading, customs declaration); no real company or declaration data.
- `expected/result.json` — the real stdout of `node samples/quickstart/run.mjs --json`; it is regenerated, never hand-written.
- `run.mjs` — checks the nine fields, checks the 12 declaration elements and exports the field table into a temporary directory.

```sh
node samples/quickstart/run.mjs            # human-readable summary
node samples/quickstart/run.mjs --json     # golden output
node samples/quickstart/run.mjs --check    # recompute and diff against expected/result.json
```

The sample deliberately contains one gross-weight mismatch, one HS-format difference that normalizes cleanly, and one missing declaration element (`port_of_loading`).
