/** Stable, user-facing failure codes for dsh-import-customs-check. */
export type ImportCustomsErrorCode = 'E_IMPORT_DOC_MISSING' | 'E_IMPORT_FIELD_MISMATCH' | 'E_IMPORT_PATH_INVALID'

interface HumanMessage {
  text: string
  next: string
}

const IMPORT_HUMAN: Record<ImportCustomsErrorCode, HumanMessage> = {
  E_IMPORT_DOC_MISSING: {
    text: '进口单证集缺单证，或单证内容读不了',
    next: 'JSON 里放齐 invoice、packing_list、bill_of_lading、customs_declaration 四份单证再试',
  },
  E_IMPORT_FIELD_MISMATCH: {
    text: '单证之间的字段对不上（strict 模式下才会中断）',
    next: '先看 import.check 的逐字段表，改单后再用 strict=true 复跑',
  },
  E_IMPORT_PATH_INVALID: {
    text: '单证集路径或导出文件名不可用',
    next: '传一个存在的 JSON 文件；导出时只传 [A-Za-z0-9._-] 组成的文件名',
  },
}

/** `one plain sentence（E_CODE）｜下一步：one action｜细节：detail` — what the end user sees. */
export function importErrorMessage(code: ImportCustomsErrorCode, detail?: string): string {
  const human = IMPORT_HUMAN[code]
  return `${human.text}（${code}）｜下一步：${human.next}${detail ? `｜细节：${detail}` : ''}`
}

export class ImportCustomsError extends Error {
  readonly code: ImportCustomsErrorCode

  constructor(code: ImportCustomsErrorCode, detail?: string) {
    super(importErrorMessage(code, detail))
    this.name = 'ImportCustomsError'
    this.code = code
  }
}
