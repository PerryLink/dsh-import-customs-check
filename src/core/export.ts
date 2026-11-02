import type { CheckResult } from './check.js'
import { toCsv } from './csv.js'
import { DOC_ORDER } from './set.js'

/** The per-field check table: one row per field, one column per document. */
export function checkCsv(result: CheckResult): string {
  const header = ['field', 'label', 'status', 'invoice', 'packing_list', 'bill_of_lading', 'customs_declaration', 'note']
  const rows: string[][] = [header]
  for (const field of result.fields) {
    const byDocument = new Map(field.values.map((value) => [value.document, value.raw]))
    rows.push([
      field.field,
      field.label,
      field.status,
      ...DOC_ORDER.map((document) => byDocument.get(document) ?? ''),
      field.note,
    ])
  }
  return toCsv(rows)
}
