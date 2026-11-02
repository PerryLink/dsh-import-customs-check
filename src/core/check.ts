import { DOC_BY_KEY, DOC_ORDER, lookupValue, type DocKey, type DocumentSet } from './set.js'

export type FieldKind = 'code' | 'integer' | 'weight' | 'amount' | 'currency' | 'hs' | 'country'

export interface FieldDefinition {
  key: string
  label: string
  kind: FieldKind
  aliases: readonly string[]
}

/** The nine header fields compared across invoice, packing list, B/L and declaration. */
export const FIELDS: readonly FieldDefinition[] = [
  {
    key: 'invoice_no',
    label: '发票号',
    kind: 'code',
    aliases: ['invoice_no', 'invoice_number', 'invoiceNo', 'invoice', '发票号', '发票号码'],
  },
  {
    key: 'contract_no',
    label: '合同号',
    kind: 'code',
    aliases: ['contract_no', 'contract_number', 'contractNo', '合同号', '合同编号'],
  },
  {
    key: 'packages',
    label: '件数',
    kind: 'integer',
    aliases: ['packages', 'package_count', 'packageCount', 'cartons', '件数', '箱数'],
  },
  {
    key: 'gross_weight_kg',
    label: '毛重',
    kind: 'weight',
    aliases: ['gross_weight_kg', 'gross_weight', 'grossWeightKg', '毛重'],
  },
  {
    key: 'net_weight_kg',
    label: '净重',
    kind: 'weight',
    aliases: ['net_weight_kg', 'net_weight', 'netWeightKg', '净重'],
  },
  {
    key: 'amount',
    label: '金额',
    kind: 'amount',
    aliases: ['amount', 'total_amount', 'invoice_amount', 'totalAmount', '金额', '总金额'],
  },
  {
    key: 'currency',
    label: '币种',
    kind: 'currency',
    aliases: ['currency', '币种', '货币'],
  },
  {
    key: 'hs_code',
    label: 'HS 编码',
    kind: 'hs',
    aliases: ['hs_code', 'hsCode', 'tariff_code', 'tariffCode', '商品编号', 'HS编码', 'HS 编码'],
  },
  {
    key: 'origin_country',
    label: '原产国',
    kind: 'country',
    aliases: ['origin_country', 'originCountry', 'country_of_origin', '原产国', '原产地'],
  },
]

export interface NormalizedValue {
  normalized: string
  invalid: boolean
  reason?: string
}

const ok = (normalized: string): NormalizedValue => ({ normalized, invalid: false })
const bad = (reason: string): NormalizedValue => ({ normalized: '', invalid: true, reason })

function decimalParts(text: string): { whole: bigint; fraction: string } | null {
  const cleaned = text.trim().replace(/[,\s_]/g, '')
  const match = /^(\d{1,15})(?:\.(\d{1,6}))?$/.exec(cleaned)
  if (!match) return null
  return { whole: BigInt(match[1]!), fraction: match[2] ?? '' }
}

/** Round a positive decimal string to `digits` places using half-up rounding. */
function toFixedUnits(text: string, digits: number): string | null {
  const parts = decimalParts(text)
  if (!parts) return null
  const padded = `${parts.fraction}${'0'.repeat(digits + 1)}`
  const scale = 10n ** BigInt(digits)
  let units = parts.whole * scale + BigInt(padded.slice(0, digits) || '0')
  if (Number(padded[digits] ?? '0') >= 5) units += 1n
  if (units <= 0n) return null
  return `${units / scale}.${String(units % scale).padStart(digits, '0')}`
}

/** Normalize one raw field value; invalid values are reported as mismatches, not thrown. */
export function normalizeValue(kind: FieldKind, raw: string): NormalizedValue {
  switch (kind) {
    case 'code': {
      const text = raw.trim().replace(/\s+/g, ' ').toUpperCase()
      if (text === '' || text.length > 64) return bad('不是 1–64 位文本')
      return ok(text)
    }
    case 'integer': {
      const text = raw.trim().replace(/[,\s_]/g, '')
      if (!/^\d{1,12}$/.test(text)) return bad('不是整数')
      const value = BigInt(text)
      if (value <= 0n) return bad('必须大于 0')
      return ok(value.toString())
    }
    case 'weight': {
      const value = toFixedUnits(raw, 3)
      return value === null ? bad('不是正数重量（按 0.001 kg 比较）') : ok(value)
    }
    case 'amount': {
      const value = toFixedUnits(raw, 2)
      return value === null ? bad('不是正数金额（按 0.01 比较）') : ok(value)
    }
    case 'currency': {
      const text = raw.trim().toUpperCase()
      if (!/^[A-Z]{3}$/.test(text)) return bad('不是 3 位字母币种')
      return ok(text)
    }
    case 'hs': {
      const text = raw.trim().replace(/[.\s-]/g, '')
      if (!/^\d{6}$/.test(text) && !/^\d{8}$/.test(text) && !/^\d{10}$/.test(text)) {
        return bad('HS 编码需为 6/8/10 位数字')
      }
      return ok(text)
    }
    case 'country': {
      const text = raw.trim().replace(/\s+/g, ' ').toUpperCase()
      if (text.length < 2 || text.length > 64) return bad('原产国不是 2–64 位文本')
      return ok(text)
    }
  }
}

interface RawField {
  raw: string
  invalid: boolean
  reason?: string
}

function rawField(value: unknown): RawField | null {
  if (typeof value === 'string') {
    const text = value.trim()
    return text === '' ? null : { raw: text, invalid: false }
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { raw: String(value), invalid: true, reason: '不是有限数字' }
    return { raw: String(value), invalid: false }
  }
  if (value === null || value === undefined) return null
  return { raw: JSON.stringify(value), invalid: true, reason: '不是文本或数字' }
}

export interface FieldValue {
  document: DocKey
  label: string
  raw: string
  normalized: string
  invalid: boolean
}

export type FieldStatus = 'consistent' | 'mismatch' | 'single_source' | 'not_provided'

export interface FieldCheck {
  field: string
  label: string
  status: FieldStatus
  compared: number
  values: FieldValue[]
  note: string
}

export interface DocumentCheck {
  key: string
  label: string
  field_count: number
}

export interface CheckSummary {
  total: number
  consistent: number
  mismatch: number
  single_source: number
  not_provided: number
}

export interface CheckResult {
  shipment_id: string
  input_sha256: string
  documents: DocumentCheck[]
  fields: FieldCheck[]
  summary: CheckSummary
  mismatch_fields: string[]
  pass: boolean
}

function valuesFor(set: DocumentSet, definition: FieldDefinition): Array<FieldValue & { reason?: string }> {
  const values: Array<FieldValue & { reason?: string }> = []
  for (const document of DOC_ORDER) {
    const rawValue = lookupValue(set.documents[document], definition.aliases)
    const extracted = rawField(rawValue)
    if (extracted === null) continue
    const label = DOC_BY_KEY[document].label
    if (extracted.invalid) {
      values.push({
        document,
        label,
        raw: extracted.raw,
        normalized: '',
        invalid: true,
        reason: extracted.reason,
      })
      continue
    }
    const normalized = normalizeValue(definition.kind, extracted.raw)
    values.push({
      document,
      label,
      raw: extracted.raw,
      normalized: normalized.normalized,
      invalid: normalized.invalid,
      reason: normalized.reason,
    })
  }
  return values
}

/** Cross-check the nine fields across all four documents. */
export function checkDocuments(set: DocumentSet): CheckResult {
  const fields: FieldCheck[] = FIELDS.map((definition) => {
    const values = valuesFor(set, definition)
    const publicValues: FieldValue[] = values.map(({ document, label, raw, normalized, invalid }) => ({
      document,
      label,
      raw,
      normalized,
      invalid,
    }))

    if (values.length === 0) {
      return {
        field: definition.key,
        label: definition.label,
        status: 'not_provided',
        compared: 0,
        values: [],
        note: '四份单证都没有这个字段',
      }
    }
    if (values.some((value) => value.invalid)) {
      return {
        field: definition.key,
        label: definition.label,
        status: 'mismatch',
        compared: values.length,
        values: publicValues,
        note: `${values
          .filter((value) => value.invalid)
          .map((value) => value.label)
          .join('、')}的${definition.label}格式不对（${values
          .filter((value) => value.invalid)
          .map((value) => value.reason)
          .join('；')}）`,
      }
    }
    const normalized = new Set(values.map((value) => value.normalized))
    if (normalized.size === 1 && values.length === 1) {
      return {
        field: definition.key,
        label: definition.label,
        status: 'single_source',
        compared: 1,
        values: publicValues,
        note: `只有${values[0]!.label}提供该字段，无法交叉核对`,
      }
    }
    if (normalized.size === 1) {
      return {
        field: definition.key,
        label: definition.label,
        status: 'consistent',
        compared: values.length,
        values: publicValues,
        note: '',
      }
    }
    return {
      field: definition.key,
      label: definition.label,
      status: 'mismatch',
      compared: values.length,
      values: publicValues,
      note: `${definition.label}：${values.map((value) => `${value.label} ${value.raw}`).join(' / ')}`,
    }
  })

  const summary: CheckSummary = {
    total: fields.length,
    consistent: fields.filter((field) => field.status === 'consistent').length,
    mismatch: fields.filter((field) => field.status === 'mismatch').length,
    single_source: fields.filter((field) => field.status === 'single_source').length,
    not_provided: fields.filter((field) => field.status === 'not_provided').length,
  }

  return {
    shipment_id: set.shipmentId,
    input_sha256: set.sourceSha256,
    documents: DOC_ORDER.map((key) => ({
      key,
      label: DOC_BY_KEY[key].label,
      field_count: FIELDS.filter((definition) => {
        const value = lookupValue(set.documents[key], definition.aliases)
        return rawField(value) !== null
      }).length,
    })),
    fields,
    summary,
    mismatch_fields: fields.filter((field) => field.status === 'mismatch').map((field) => field.field),
    pass: summary.mismatch === 0,
  }
}
