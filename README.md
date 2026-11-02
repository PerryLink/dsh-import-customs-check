<div align="center">

# dsh-import-customs-check

> **Official repository.** The only official repository of this package, maintained by PerryLink. Same-name repositories under other accounts are not affiliated. Apache-2.0.

[![npm](https://img.shields.io/npm/v/dsh-import-customs-check)](https://www.npmjs.com/package/dsh-import-customs-check)
[![CI](https://github.com/PerryLink/dsh-import-customs-check/actions/workflows/ci.yml/badge.svg)](https://github.com/PerryLink/dsh-import-customs-check/actions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

**Cross-check the four import documents field by field, then list the customs declaration's missing 12 elements.**

> **Status: alpha / public-synthetic / partial / not counted / not GA.** No real customs declaration, customer data or customer evidence; no compliance, classification or filing conclusion.

[English](README.md) · [简体中文](README-zh.md)

```sh
dsh plugin --profile <profile> add dsh-import-customs-check
```

</div>

## One-liner

Compare nine header fields across four import documents, then list which of the customs declaration's 12 elements are missing.

## Fit / not a fit

- **Fits:** one import shipment whose invoice, packing list, bill of lading and customs declaration are already available as JSON; a pre-filing check of invoice no, contract no, packages, gross/net weight, amount, currency, HS code and origin country; confirming that all 12 declaration header elements were filled.
- **Does not fit:** PDFs, scans, images or Excel as direct input (no OCR here; prepare JSON first); line-item SKU/quantity/unit-price matching; classification rulings, origin rules, customs value or licence decisions; replacing a broker, customs authority or lawyer; multiple shipments in one file.

## Input

- UTF-8 JSON for one shipment; all four documents are required:

```json
{
  "shipment_id": "SHP-2026-0618",
  "documents": {
    "invoice": { "invoice_no": "INV-2026-0618", "contract_no": "CT-2026-0042", "packages": 120,
                 "gross_weight_kg": "2450.00", "net_weight_kg": "2280.00", "amount": "184500.00",
                 "currency": "USD", "hs_code": "8471.30.00", "origin_country": "CN" },
    "packing_list": { "invoice_no": "INV-2026-0618", "packages": "120", "gross_weight_kg": "2450.00" },
    "bill_of_lading": { "invoice_no": "INV-2026-0618", "packages": "120", "gross_weight_kg": "2450.00" },
    "customs_declaration": { "declaration_no": "3101202606180001", "port_of_loading": "上海港" }
  }
}
```

- Document keys: `invoice`, `packing_list`, `bill_of_lading`, `customs_declaration`; Chinese aliases such as `商业发票 / 装箱单 / 提单 / 报关单` also work. All four are required.
- Fields may sit directly on the document object or under a `fields` object. English and Chinese field aliases work (`invoice_no` / `发票号`, `gross_weight_kg` / `毛重`).
- Amounts and kilogram weights may be strings or JSON numbers. Comparison precision is 0.01 for amounts and 0.001 kg for weights.
- Size: up to 5 MB; read-only, the source JSON is never modified.
- Source: the local JSON the user prepared; the bundled sample is synthetic and contains no real company or declaration data.

## Output

- `import.check`: a per-field table. Each field has `status`, `compared` (number of documents that provided it), `values` (raw value, normalized value and invalid flag per document) and `note`. `summary` counts `consistent / mismatch / single_source / not_provided`, and `pass = mismatch === 0`.
- `import.elements`: completeness of the declaration's 12 header elements as `{ complete, total, present, missing: [{ key, label }] }`.
- `import.export`: writes the field table under `$DSH_HOME/dsh-import-customs-check/exports/` with one row per field and one column per document; returns path, `sha256`, bytes and rows.

| status | Meaning | Counts as failure |
|---|---|---|
| `consistent` | At least 2 documents provide the field and all normalize to the same value | No |
| `mismatch` | Normalized values differ, or a provided value is invalid | Yes (`pass=false`) |
| `single_source` | Only 1 document provides the field, so it cannot be cross-checked | No |
| `not_provided` | None of the four documents carries the field | No |

`import.check` returns the full table by default. With `strict: true`, any `mismatch` raises `E_IMPORT_FIELD_MISMATCH`, which is suitable for automated gates.

## Example

Paste this one line into the agent:

> 我有一套进口单证（发票、装箱单、提单、报关单），帮我核对 9 个字段是否一致，再看报关单 12 项要素缺什么。

Reproduce the bundled sample and compare with the golden file:

```sh
node samples/quickstart/run.mjs --check
```

![dsh-import-customs-check quickstart terminal output](docs/assets/quickstart.png)

The sample is one synthetic shipment. Gross weight is deliberately `2450.50` on the declaration and `2450.00` on the other three documents (a `mismatch`); the HS code is `8471.30.00` on the invoice and `84713000` on the declaration, which normalizes to the same value (formatting is not a mismatch); the declaration deliberately omits `port_of_loading` to demonstrate a missing element. `samples/quickstart/expected/result.json` is the real stdout of `node samples/quickstart/run.mjs --json`, not hand-written.

## Permissions

Read: the import document-set JSON the user names (sample: `samples/quickstart/input/import-set.json`); nothing else.
Write: `$DSH_HOME/dsh-import-customs-check/exports/` only; the source JSON is not modified.
Network: no.
External systems: none.

`import.check` and `import.elements` are **R0** (read-only). `import.export` is **R1** (local write under `$DSH_HOME/dsh-import-customs-check/exports/`). `DSH_IMPORT_CUSTOMS_CHECK_HOME` can override the local write root for tests; the default is exactly `$DSH_HOME/dsh-import-customs-check`.

## FAQ

### 1. What happens when a document is missing?

Both `import.check` and `import.elements` raise `E_IMPORT_DOC_MISSING`, and the detail names the gap (for example “缺：提单”). The package will not guess the fourth document from three; add it and rerun. If a document truly does not apply, confirm that in the business process rather than deleting a key.

### 2. What is the difference between `mismatch` and `E_IMPORT_FIELD_MISMATCH`?

`mismatch` is a status in the result table; by default it is reported without interrupting. `E_IMPORT_FIELD_MISMATCH` is the error raised by `strict: true`. Use strict mode in automated gates and the default table for human review.

### 3. Why is a missing `port_of_loading` not a `mismatch`?

The 12-element completeness check is a separate tool (`import.elements`) and is not mixed into the nine consistency fields. A missing element sets `complete=false` and lists the missing item; it does not flip `import.check`'s `pass`.

### 4. Will different HS code formatting cause false mismatches?

No. Dots, spaces and hyphens are removed before comparison, so `8471.30.00` and `84713000` are consistent (8 digits). Six, eight and ten digits are different granularities and are reported as `mismatch`. The package does not judge whether the code itself is correct.

### 5. What precision do weights and amounts use?

Weights compare at 0.001 kg and amounts at 0.01, with half-up rounding; `2450.0006` normalizes to `2450.001` and `184500.005` to `184500.01`. This is a comparison policy, not a customs or bank valuation/settlement policy.

### 6. Does it modify or upload my file?

No. It reads the named JSON, writes only under `$DSH_HOME/dsh-import-customs-check/exports/`, and never uses the network, a model call or an upload.

## Version

`0.1.0-alpha.1` · 58 tests pass (`node --test test/*.test.mjs`).

> ⭐ If this helps, a star makes it easier for the next person to find it. Nothing is gated behind it.

## Install

```sh
dsh plugin --profile <profile> add dsh-import-customs-check
dsh --profile <profile> --dump-config | grep dsh-import-customs-check
```

Uninstall:

```sh
dsh plugin --profile <profile> remove dsh-import-customs-check
```

### Install channels

- **npm (recommended):** `dsh plugin --profile <profile> add dsh-import-customs-check`
- **git channel:** `dsh plugin --profile <profile> add github:PerryLink/dsh-import-customs-check`
- **tarball:** `pnpm pack`, then `dsh plugin --profile <profile> add ./dsh-import-customs-check-<version>.tgz`

## Tools

Tool names are stable API; descriptions stay in English to match runtime output.

| Tool | Purpose | Risk |
|---|---|---|
| `import.check` | Cross-check nine header fields across the four documents; `strict=true` fails on mismatch | R0 |
| `import.elements` | Check the declaration's 12 mandatory header elements and list the missing ones | R0 |
| `import.export` | Write the field-check table as CSV, returning path + sha256 | R1 local write |

## Comparison rules

| Field | Key | Normalization |
|---|---|---|
| Invoice no | `invoice_no` | Trim, collapse spaces, uppercase |
| Contract no | `contract_no` | Same |
| Packages | `packages` | Strip commas/spaces, positive integer |
| Gross weight | `gross_weight_kg` | Strip commas/spaces, 0.001 kg half-up |
| Net weight | `net_weight_kg` | Same |
| Amount | `amount` | Strip commas/spaces, 0.01 half-up |
| Currency | `currency` | 3 letters, uppercase |
| HS code | `hs_code` | Strip dots/spaces/hyphens, 6/8/10 digits |
| Origin country | `origin_country` | Trim, collapse spaces, uppercase |

## The 12 declaration elements

| # | Key | Element |
|---:|---|---|
| 1 | `declaration_no` | Declaration number |
| 2 | `declaration_date` | Declaration date |
| 3 | `domestic_consignee` | Domestic consignor/consignee |
| 4 | `overseas_consignor` | Overseas consignor/consignee |
| 5 | `transport_mode` | Transport mode |
| 6 | `transport_name` | Transport name |
| 7 | `bill_of_lading_no` | Bill of lading number |
| 8 | `supervision_mode` | Supervision mode |
| 9 | `duty_nature` | Duty nature |
| 10 | `origin_country` | Country/region of origin |
| 11 | `port_of_loading` | Port of loading |
| 12 | `domestic_destination` | Domestic destination |

These 12 are **this package's agreed header checklist**, not a statutory validation rule of a customs system or a particular port. Actual filing requirements follow the latest customs instructions.

## Quick start

```sh
# 1) field consistency
#    tool surface: import.check({ path: "/abs/path/import-set.json" })

# 2) strict gate (fail on mismatch)
#    tool surface: import.check({ path: "/abs/path/import-set.json", strict: true })

# 3) declaration elements
#    tool surface: import.elements({ path: "/abs/path/import-set.json" })

# 4) export the check table
#    tool surface: import.export({ path: "/abs/path/import-set.json" })
```

Or run the sample:

```sh
node samples/quickstart/run.mjs --check
```

## Errors

| Code | When | Next action |
|---|---|---|
| `E_IMPORT_DOC_MISSING` | One of the four documents is missing, JSON is malformed, a document is not an object, duplicates appear, or the file is empty/over 5 MB | Provide all four documents and check the JSON shape |
| `E_IMPORT_FIELD_MISMATCH` | `strict: true` and at least one field is `mismatch` | Read the `import.check` table, correct the document, rerun |
| `E_IMPORT_PATH_INVALID` | Input path missing / a directory / unreadable, an unwritable exports directory, or an unsafe export filename | Pass an existing JSON; export with `[A-Za-z0-9._-]` only |

The message format is `<one sentence>（E_IMPORT_XXX）｜下一步：<one action>`. See [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

## Acceptance evidence

Public/synthetic fixtures live in `samples/quickstart/`; `ACCEPTANCE.csv` records the checks. Every row is `counted=false` except the quickstart row.

| req_id | metric | threshold | actual | pass | source | counted |
|---|---|---|---|---|---|---|
| IMP-A01 | field check | fields=9 consistent=8 mismatch=1 | fields=9 consistent=8 mismatch=1 | true | public/synthetic | false |
| IMP-A03 | gross weight mismatch | 4 sources declaration=2450.50 | 4 sources declaration=2450.50 | true | public/synthetic | false |
| IMP-A05 | 12 elements | present=11 missing=1 | present=11 missing=1 | true | public/synthetic | false |
| PS1-QS01 | quickstart golden | 1/1 | 1 | true | synthetic/quickstart | true |

*Fixture-backed rows, not a real customs run; no output is invented.*

## Limits and known limitations

- **Input is prepared JSON:** no PDF, scans, images or Excel, no OCR, and no customs-declaration XML/single-window message parsing.
- Only nine header fields and 12 header elements: no line items, SKU, quantity, unit price, origin rules, classification, customs value or licence decisions.
- No semantic mapping: `CN` vs `China` and `USD` vs `US$` are different values; normalize the source.
- HS codes are checked for format and consistency only, not for correctness or applicability.
- The 12 elements are this package's header checklist, not a statutory rule; they do not replace a broker, customs authority or lawyer.
- Amount/weight comparison uses fixed half-up precision; no FX or unit conversion (for example lbs → kg).
- Exported CSV uses RFC 4180 quoting only; Excel formula prefixes are not sanitised.
- Local only: no network, no model call, no upload.
- Public/synthetic samples only; alpha/partial, not counted, no GA or production-readiness claim.

## Development

```sh
pnpm install --frozen-lockfile
pnpm build && pnpm lint && pnpm typecheck
node --test test/*.test.mjs
node scripts/gate.mjs
```

## Compatibility

| Surface | Status |
|---|---|
| Harness | `dsh >=0.2.1-rc.3 <0.4.0` |
| Node | `>=24.9.0 <25` |
| Platforms | All; local files only |
| Data | No network, no model call, no upload |

## Related work

- [dsh-hs-candidate](https://github.com/PerryLink/dsh-hs-candidate) (HS candidates and 12 classification elements)
- [dsh-freight-audit](https://github.com/PerryLink/dsh-freight-audit) (freight bill audit)
- [Domain index](https://perrylink.github.io/dsh-plugins/)

## License

Apache-2.0. See `LICENSE`, `NOTICE`, `THIRD-PARTY-NOTICES`.
