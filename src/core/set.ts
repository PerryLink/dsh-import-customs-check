import { createHash } from 'node:crypto'
import { ImportCustomsError } from './errors.js'

export type DocKey = 'invoice' | 'packing_list' | 'bill_of_lading' | 'customs_declaration'

export interface DocumentDefinition {
  key: DocKey
  label: string
  aliases: readonly string[]
}

/** The four documents this package cross-checks. Extra documents are ignored. */
export const DOCUMENTS: readonly DocumentDefinition[] = [
  { key: 'invoice', label: '商业发票', aliases: ['invoice', 'commercial_invoice', 'commercialinvoice', '发票', '商业发票'] },
  { key: 'packing_list', label: '装箱单', aliases: ['packing_list', 'packinglist', '装箱单'] },
  { key: 'bill_of_lading', label: '提单', aliases: ['bill_of_lading', 'billoflading', 'bl', '提单'] },
  { key: 'customs_declaration', label: '报关单', aliases: ['customs_declaration', 'customsdeclaration', 'declaration', '报关单'] },
]

export const DOC_ORDER: readonly DocKey[] = DOCUMENTS.map((document) => document.key)

export const DOC_BY_KEY: Record<DocKey, DocumentDefinition> = Object.fromEntries(
  DOCUMENTS.map((document) => [document.key, document]),
) as Record<DocKey, DocumentDefinition>

/** Case/space/underscore/hyphen/paren-insensitive key used for aliases. */
export function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_\-（）()]/g, '')
}

const ALIAS_TO_DOC = new Map<string, DocKey>()
for (const document of DOCUMENTS) {
  for (const alias of document.aliases) ALIAS_TO_DOC.set(normalizeKey(alias), document.key)
}

export interface DocumentSet {
  shipmentId: string
  documents: Record<DocKey, Record<string, unknown>>
  present: DocKey[]
  sourceSha256: string
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Parse a document-set JSON. Accepted shape:
 *
 *   { "shipment_id": "...", "documents": { "invoice": {...}, ... } }
 *
 * A top-level map of document keys works too. Each document may nest its
 * business fields under `fields`. All four documents are required.
 */
export function parseDocumentSet(text: string): DocumentSet {
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    throw new ImportCustomsError('E_IMPORT_DOC_MISSING', '单证集 JSON 解析失败，读不出任何单证')
  }
  if (!isPlainObject(payload)) {
    throw new ImportCustomsError('E_IMPORT_DOC_MISSING', '单证集顶层必须是 JSON 对象')
  }
  const container = isPlainObject(payload.documents) ? payload.documents : payload
  const seen = new Set<DocKey>()
  const documents = {} as Record<DocKey, Record<string, unknown>>

  for (const [rawKey, rawValue] of Object.entries(container)) {
    const key = ALIAS_TO_DOC.get(normalizeKey(rawKey))
    if (!key) continue
    const definition = DOC_BY_KEY[key]
    if (seen.has(key)) {
      throw new ImportCustomsError('E_IMPORT_DOC_MISSING', `同一类单证出现了两次：${definition.label}`)
    }
    if (!isPlainObject(rawValue)) {
      throw new ImportCustomsError('E_IMPORT_DOC_MISSING', `${definition.label} 不是 JSON 对象`)
    }
    seen.add(key)
    documents[key] = isPlainObject(rawValue.fields) ? { ...rawValue, ...rawValue.fields } : rawValue
  }

  const missing = DOC_ORDER.filter((key) => !seen.has(key))
  if (missing.length > 0) {
    throw new ImportCustomsError(
      'E_IMPORT_DOC_MISSING',
      `缺：${missing.map((key) => DOC_BY_KEY[key].label).join('、')}`,
    )
  }

  const shipmentId =
    typeof payload.shipment_id === 'string' && payload.shipment_id.trim() !== ''
      ? payload.shipment_id.trim()
      : 'UNSPECIFIED'

  return {
    shipmentId,
    documents,
    present: [...DOC_ORDER],
    sourceSha256: createHash('sha256').update(text).digest('hex'),
  }
}

/** First value whose key matches one of `aliases`, in alias priority order. */
export function lookupValue(document: Record<string, unknown>, aliases: readonly string[]): unknown {
  const entries = new Map<string, unknown>()
  for (const [key, value] of Object.entries(document)) {
    const normalized = normalizeKey(key)
    if (!entries.has(normalized)) entries.set(normalized, value)
  }
  for (const alias of aliases) {
    const normalized = normalizeKey(alias)
    if (entries.has(normalized)) return entries.get(normalized)
  }
  return undefined
}
