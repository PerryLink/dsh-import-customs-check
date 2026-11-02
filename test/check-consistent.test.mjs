import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { checkDocuments } from '../lib/core/check.js'
import { parseDocumentSet } from '../lib/core/set.js'
import { documentSet, sample } from './helpers/fixtures.mjs'

async function sampleResult() {
  return checkDocuments(parseDocumentSet(await readFile(sample, 'utf8')))
}

test('the bundled set has one weight mismatch and eight consistent fields', async () => {
  const result = await sampleResult()
  assert.equal(result.shipment_id, 'SHP-2026-0618')
  assert.equal(result.pass, false)
  assert.deepEqual(result.summary, {
    total: 9,
    consistent: 8,
    mismatch: 1,
    single_source: 0,
    not_provided: 0,
  })
  assert.deepEqual(result.mismatch_fields, ['gross_weight_kg'])
  assert.equal(result.documents.length, 4)
  assert.equal(result.input_sha256.length, 64)
})

test('field rows stay in the documented order and carry per-document values', async () => {
  const result = await sampleResult()
  assert.deepEqual(
    result.fields.map((field) => field.field),
    [
      'invoice_no',
      'contract_no',
      'packages',
      'gross_weight_kg',
      'net_weight_kg',
      'amount',
      'currency',
      'hs_code',
      'origin_country',
    ],
  )
  const gross = result.fields.find((field) => field.field === 'gross_weight_kg')
  assert.equal(gross.status, 'mismatch')
  assert.equal(gross.compared, 4)
  assert.deepEqual(
    gross.values.map((value) => [value.document, value.raw]),
    [
      ['invoice', '2450.00'],
      ['packing_list', '2450.00'],
      ['bill_of_lading', '2450.00'],
      ['customs_declaration', '2450.50'],
    ],
  )
  assert.match(gross.note, /报关单 2450\.50/)
})

test('HS code formatting differences normalize to one code and stay consistent', async () => {
  const result = await sampleResult()
  const hs = result.fields.find((field) => field.field === 'hs_code')
  assert.equal(hs.status, 'consistent')
  assert.equal(hs.compared, 2)
  assert.deepEqual(
    hs.values.map((value) => [value.raw, value.normalized]),
    [
      ['8471.30.00', '84713000'],
      ['84713000', '84713000'],
    ],
  )
})

test('amount and currency compare only the documents that carry them', async () => {
  const result = await sampleResult()
  for (const key of ['amount', 'currency']) {
    const field = result.fields.find((item) => item.field === key)
    assert.equal(field.status, 'consistent')
    assert.equal(field.compared, 2)
    assert.deepEqual(
      field.values.map((value) => value.document),
      ['invoice', 'customs_declaration'],
    )
  }
})

test('document field counts expose what each document contributed', async () => {
  const result = await sampleResult()
  assert.deepEqual(
    result.documents.map((document) => [document.key, document.field_count]),
    [
      ['invoice', 9],
      ['packing_list', 5],
      ['bill_of_lading', 5],
      ['customs_declaration', 9],
    ],
  )
})

test('fixing the declared gross weight turns the check green', async () => {
  const result = checkDocuments(
    parseDocumentSet(JSON.stringify(documentSet({ customs_declaration: { gross_weight_kg: '100.00' } }))),
  )
  assert.equal(result.pass, true)
  assert.deepEqual(result.mismatch_fields, [])
  assert.equal(result.summary.consistent, 9)
  assert.equal(result.summary.mismatch, 0)
})

test('consistent fields carry an empty note', async () => {
  const result = checkDocuments(parseDocumentSet(JSON.stringify(documentSet({}))))
  assert.equal(result.pass, true)
  for (const field of result.fields) {
    assert.equal(field.status, 'consistent')
    assert.equal(field.note, '')
  }
})
