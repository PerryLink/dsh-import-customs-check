import { readFile, stat } from 'node:fs/promises'
import { ImportCustomsError } from './errors.js'

/** Local JSON limit: one shipment's four documents should be far below this. */
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024

/**
 * Read the user-named document-set JSON. A missing path, a directory, or an
 * unreadable file is `E_IMPORT_PATH_INVALID`; an empty or oversized file is
 * `E_IMPORT_DOC_MISSING` because no document can be read from it.
 */
export async function readImportSource(filePath: string): Promise<string> {
  if (typeof filePath !== 'string' || filePath.trim() === '') {
    throw new ImportCustomsError('E_IMPORT_PATH_INVALID', 'path 为空')
  }
  const target = filePath.trim()
  let info
  try {
    info = await stat(target)
  } catch {
    throw new ImportCustomsError('E_IMPORT_PATH_INVALID', `找不到 ${JSON.stringify(target)}，或当前用户读不到`)
  }
  if (!info.isFile()) throw new ImportCustomsError('E_IMPORT_PATH_INVALID', `${JSON.stringify(target)} 不是文件`)
  if (info.size === 0) throw new ImportCustomsError('E_IMPORT_DOC_MISSING', '单证集文件是空的')
  if (info.size > MAX_SOURCE_BYTES) {
    throw new ImportCustomsError('E_IMPORT_DOC_MISSING', `单证集有 ${info.size} 字节，超过 5 MB 上限`)
  }
  try {
    return await readFile(target, 'utf8')
  } catch {
    throw new ImportCustomsError('E_IMPORT_PATH_INVALID', `读不了 ${JSON.stringify(target)}；确认权限后重试`)
  }
}
