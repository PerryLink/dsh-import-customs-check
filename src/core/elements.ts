import { lookupValue } from './set.js'

export interface ElementDefinition {
  key: string
  label: string
  aliases: readonly string[]
}

/** The 12 declaration header elements checked for completeness. */
export const ELEMENTS: readonly ElementDefinition[] = [
  { key: 'declaration_no', label: '报关单号', aliases: ['declaration_no', 'declarationNo', 'customs_declaration_no', '报关单号'] },
  { key: 'declaration_date', label: '申报日期', aliases: ['declaration_date', 'declarationDate', '申报日期'] },
  {
    key: 'domestic_consignee',
    label: '境内收发货人',
    aliases: ['domestic_consignee', 'domesticConsignee', '境内收发货人', '境内收货人'],
  },
  {
    key: 'overseas_consignor',
    label: '境外收发货人',
    aliases: ['overseas_consignor', 'overseasConsignor', '境外收发货人', '境外发货人'],
  },
  { key: 'transport_mode', label: '运输方式', aliases: ['transport_mode', 'transportMode', '运输方式'] },
  {
    key: 'transport_name',
    label: '运输工具名称',
    aliases: ['transport_name', 'transportName', '运输工具名称', '运输工具'],
  },
  { key: 'bill_of_lading_no', label: '提运单号', aliases: ['bill_of_lading_no', 'bl_no', 'billOfLadingNo', '提运单号'] },
  { key: 'supervision_mode', label: '监管方式', aliases: ['supervision_mode', 'supervisionMode', '监管方式'] },
  { key: 'duty_nature', label: '征免性质', aliases: ['duty_nature', 'dutyNature', '征免性质'] },
  {
    key: 'origin_country',
    label: '原产国（地区）',
    aliases: ['origin_country', 'originCountry', 'country_of_origin', '原产国', '原产国（地区）', '原产国(地区)'],
  },
  { key: 'port_of_loading', label: '装货港', aliases: ['port_of_loading', 'portOfLoading', '装货港'] },
  {
    key: 'domestic_destination',
    label: '境内目的地',
    aliases: ['domestic_destination', 'domesticDestination', '境内目的地'],
  },
]

export interface MissingElement {
  key: string
  label: string
}

export interface ElementsResult {
  complete: boolean
  total: number
  present: number
  missing: MissingElement[]
}

function present(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() !== ''
  if (typeof value === 'number') return Number.isFinite(value)
  return false
}

/** Return the declaration elements that are absent or empty. */
export function checkElements(declaration: Record<string, unknown>): ElementsResult {
  const missing = ELEMENTS.filter((element) => !present(lookupValue(declaration, element.aliases))).map((element) => ({
    key: element.key,
    label: element.label,
  }))
  return {
    complete: missing.length === 0,
    total: ELEMENTS.length,
    present: ELEMENTS.length - missing.length,
    missing,
  }
}
