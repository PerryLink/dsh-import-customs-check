import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTools } from '../../lib/plugin/tools.js'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const sample = path.join(root, 'samples', 'quickstart', 'input', 'import-set.json')

export const INVOICE = {
  invoice_no: 'INV-1',
  contract_no: 'CT-1',
  packages: 10,
  gross_weight_kg: '100.00',
  net_weight_kg: '90.00',
  amount: '1000.00',
  currency: 'USD',
  hs_code: '8471.30.00',
  origin_country: 'CN',
}

export const PACKING_LIST = {
  invoice_no: 'INV-1',
  contract_no: 'CT-1',
  packages: '10',
  gross_weight_kg: '100.00',
  net_weight_kg: '90.00',
}

export const BILL_OF_LADING = {
  invoice_no: 'INV-1',
  contract_no: 'CT-1',
  packages: '10',
  gross_weight_kg: '100.00',
  origin_country: 'CN',
}

export const CUSTOMS_DECLARATION = {
  declaration_no: '3101202606180001',
  declaration_date: '2026-06-20',
  domestic_consignee: '上海远洋国际贸易有限公司',
  overseas_consignor: 'PACIFIC TECH PTE LTD',
  transport_mode: '水路运输',
  transport_name: 'COSCO SHIPPING ROSE / 0618E',
  bill_of_lading_no: 'COSU6389210450',
  supervision_mode: '一般贸易',
  duty_nature: '一般征税',
  origin_country: 'CN',
  domestic_destination: '上海',
  ...INVOICE,
  hs_code: '84713000',
}

export const DOCS = {
  invoice: INVOICE,
  packing_list: PACKING_LIST,
  bill_of_lading: BILL_OF_LADING,
  customs_declaration: CUSTOMS_DECLARATION,
}

/** Build a document set, deep-merging per-document overrides; `null` removes a doc. */
export function documentSet(overrides = {}, shipmentId = 'SHP-TEST') {
  const documents = {}
  for (const [key, base] of Object.entries(DOCS)) {
    if (Object.hasOwn(overrides, key) && overrides[key] === null) continue
    documents[key] = { ...base, ...(overrides[key] ?? {}) }
  }
  return { shipment_id: shipmentId, documents }
}

export function setJson(overrides = {}, shipmentId = 'SHP-TEST') {
  return JSON.stringify(documentSet(overrides, shipmentId), null, 2)
}

export async function makeTemp(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-import-check-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

export async function writeSet(dir, name, payload) {
  const file = path.join(dir, name)
  await writeFile(file, typeof payload === 'string' ? payload : `${JSON.stringify(payload, null, 2)}\n`)
  return file
}

export function toolMap(baseDir) {
  return Object.fromEntries(createTools({ baseDir }).map((tool) => [tool.name, tool]))
}

export const exec = { callId: 'test' }

export function assertErrorCode(error, code) {
  assert.equal(error?.code, code, `expected ${code}, got ${error?.code}: ${error?.message}`)
  assert.match(error.message, new RegExp(`${code}`))
  assert.match(error.message, /下一步：/)
  return true
}
