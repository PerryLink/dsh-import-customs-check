import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { parseDocumentSet } from '../lib/core/set.js'
import { sample, documentSet, setJson, assertErrorCode } from './helpers/fixtures.mjs'

test('parseDocumentSet reads the bundled four-document shipment', async () => {
  const text = await readFile(sample, 'utf8')
  const set = parseDocumentSet(text)
  assert.equal(set.shipmentId, 'SHP-2026-0618')
  assert.deepEqual(set.present, ['invoice', 'packing_list', 'bill_of_lading', 'customs_declaration'])
  assert.equal(set.documents.invoice.invoice_no, 'INV-2026-0618')
  assert.equal(set.documents.customs_declaration.gross_weight_kg, '2450.50')
  assert.equal(set.sourceSha256.length, 64)
})

test('parseDocumentSet accepts a top-level document map without a documents wrapper', () => {
  const payload = documentSet()
  const set = parseDocumentSet(JSON.stringify(payload.documents))
  assert.equal(set.shipmentId, 'UNSPECIFIED')
  assert.deepEqual(set.present, ['invoice', 'packing_list', 'bill_of_lading', 'customs_declaration'])
})

test('parseDocumentSet accepts Chinese document keys and nested fields', () => {
  const payload = {
    shipment_id: 'SHP-CN',
    documents: {
      发票: { fields: { 发票号: 'INV-CN', 合同号: 'CT-CN' } },
      装箱单: { 发票号: 'INV-CN' },
      提单: { 发票号: 'INV-CN' },
      报关单: { 发票号: 'INV-CN' },
    },
  }
  const set = parseDocumentSet(JSON.stringify(payload))
  assert.equal(set.documents.invoice.发票号, 'INV-CN')
  assert.equal(set.documents.packing_list.发票号, 'INV-CN')
})

test('a missing document is E_IMPORT_DOC_MISSING and names the gap', () => {
  const payload = documentSet({ bill_of_lading: null })
  assert.throws(
    () => parseDocumentSet(JSON.stringify(payload)),
    (error) => {
      assertErrorCode(error, 'E_IMPORT_DOC_MISSING')
      assert.match(error.message, /提单/)
      return true
    },
  )
})

test('malformed JSON, a non-object root and a non-object document are E_IMPORT_DOC_MISSING', () => {
  assert.throws(() => parseDocumentSet('{not json'), (error) => assertErrorCode(error, 'E_IMPORT_DOC_MISSING'))
  assert.throws(() => parseDocumentSet('[]'), (error) => assertErrorCode(error, 'E_IMPORT_DOC_MISSING'))
  const payload = documentSet()
  payload.documents.invoice = 'INV-1'
  assert.throws(() => parseDocumentSet(JSON.stringify(payload)), (error) => assertErrorCode(error, 'E_IMPORT_DOC_MISSING'))
})

test('the same document provided under two aliases is rejected', () => {
  const payload = documentSet()
  payload.documents.commercial_invoice = payload.documents.invoice
  assert.throws(() => parseDocumentSet(JSON.stringify(payload)), /E_IMPORT_DOC_MISSING.*两次/)
})

test('extra documents are ignored', () => {
  const payload = documentSet()
  payload.documents.certificate_of_origin = { origin_country: 'CN' }
  const set = parseDocumentSet(JSON.stringify(payload))
  assert.equal(set.present.length, 4)
  assert.equal(set.documents.certificate_of_origin, undefined)
})

test('setJson round-trips and keeps the expected four keys', () => {
  const set = parseDocumentSet(setJson({ invoice: { amount: '2000.00' } }))
  assert.equal(set.documents.invoice.amount, '2000.00')
  assert.equal(Object.keys(set.documents).length, 4)
})
