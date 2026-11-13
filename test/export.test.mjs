import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { exec, makeTemp, sample, toolMap } from './helpers/fixtures.mjs'

const sha256 = (value) => createHash('sha256').update(value).digest('hex')

test('import_export writes the nine-field table with path, sha256 and bytes', async (t) => {
  const dir = await makeTemp(t)
  const baseDir = path.join(dir, 'store')
  const tools = toolMap(baseDir)
  const result = await tools['import_export'].execute({ path: sample }, exec)
  assert.equal(result.rows, 9)
  assert.equal(result.pass, false)
  assert.ok(result.path.startsWith(`${baseDir}${path.sep}exports${path.sep}`), result.path)
  assert.match(path.basename(result.path), /^import-check-[0-9a-f]{12}\.csv$/)

  const text = await readFile(result.path, 'utf8')
  assert.equal(result.sha256, sha256(text))
  assert.equal(result.bytes, Buffer.byteLength(text, 'utf8'))
  const lines = text.trimEnd().split('\n')
  assert.equal(lines.length, 10)
  assert.equal(
    lines[0],
    'field,label,status,invoice,packing_list,bill_of_lading,customs_declaration,note',
  )
  const gross = lines.find((line) => line.startsWith('gross_weight_kg,'))
  assert.ok(gross.includes(',mismatch,'))
  assert.ok(gross.includes('2450.50'))
  assert.ok(gross.includes('毛重：'))
})

test('import_export honours a custom safe filename', async (t) => {
  const dir = await makeTemp(t)
  const tools = toolMap(path.join(dir, 'store'))
  const result = await tools['import_export'].execute({ path: sample, filename: 'review-2026.csv' }, exec)
  assert.equal(path.basename(result.path), 'review-2026.csv')
  assert.equal(result.rows, 9)
})

test('import_export quotes cells that contain a comma', async (t) => {
  const dir = await makeTemp(t)
  const tools = toolMap(path.join(dir, 'store'))
  const setPath = path.join(dir, 'comma.json')
  const payload = {
    shipment_id: 'SHP-COMMA',
    documents: {
      invoice: { invoice_no: 'INV,1', contract_no: 'CT-1', packages: 1, gross_weight_kg: '1.00', net_weight_kg: '1.00', amount: '1.00', currency: 'USD', hs_code: '84713000', origin_country: 'CN' },
      packing_list: { invoice_no: 'INV,1', contract_no: 'CT-1', packages: 1, gross_weight_kg: '1.00', net_weight_kg: '1.00' },
      bill_of_lading: { invoice_no: 'INV,1', contract_no: 'CT-1', packages: 1, gross_weight_kg: '1.00', origin_country: 'CN' },
      customs_declaration: { invoice_no: 'INV,1', contract_no: 'CT-1', packages: 1, gross_weight_kg: '1.00', net_weight_kg: '1.00', amount: '1.00', currency: 'USD', hs_code: '84713000', origin_country: 'CN' },
    },
  }
  const { writeFile } = await import('node:fs/promises')
  await writeFile(setPath, JSON.stringify(payload))
  const result = await tools['import_export'].execute({ path: setPath, filename: 'comma.csv' }, exec)
  const text = await readFile(result.path, 'utf8')
  assert.ok(text.includes('"INV,1"'), text)
})

test('import_export rejects traversal and absolute filenames', async (t) => {
  const dir = await makeTemp(t)
  const tools = toolMap(path.join(dir, 'store'))
  for (const filename of ['../evil.csv', '/tmp/evil.csv', 'a/b.csv', 'with space.csv', '表格.csv']) {
    await assert.rejects(
      () => tools['import_export'].execute({ path: sample, filename }, exec),
      (error) => error.code === 'E_IMPORT_PATH_INVALID',
      filename,
    )
  }
})
