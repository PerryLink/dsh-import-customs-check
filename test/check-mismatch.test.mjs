import test from 'node:test'
import assert from 'node:assert/strict'
import { checkDocuments } from '../lib/core/check.js'
import { parseDocumentSet } from '../lib/core/set.js'
import { documentSet } from './helpers/fixtures.mjs'

const run = (overrides) => checkDocuments(parseDocumentSet(JSON.stringify(documentSet(overrides))))
const field = (result, key) => result.fields.find((item) => item.field === key)

test('an amount mismatch is reported with both raw values', () => {
  const result = run({ customs_declaration: { amount: '1001.00' } })
  const amount = field(result, 'amount')
  assert.equal(amount.status, 'mismatch')
  assert.deepEqual(result.mismatch_fields, ['amount'])
  assert.match(amount.note, /商业发票 1000\.00/)
  assert.match(amount.note, /报关单 1001\.00/)
  assert.equal(result.pass, false)
})

test('a field provided by one document is single_source, not a failure', () => {
  const result = run({
    bill_of_lading: { origin_country: null },
    customs_declaration: { origin_country: null },
  })
  const origin = field(result, 'origin_country')
  assert.equal(origin.status, 'single_source')
  assert.equal(origin.compared, 1)
  assert.match(origin.note, /只有商业发票/)
  assert.equal(result.pass, true)
  assert.equal(result.summary.single_source, 1)
})

test('a field absent from every document is not_provided, not a failure', () => {
  const result = run({
    invoice: { contract_no: null },
    packing_list: { contract_no: null },
    bill_of_lading: { contract_no: null },
    customs_declaration: { contract_no: null },
  })
  const contract = field(result, 'contract_no')
  assert.equal(contract.status, 'not_provided')
  assert.equal(contract.compared, 0)
  assert.deepEqual(contract.values, [])
  assert.match(contract.note, /都没有这个字段/)
  assert.equal(result.pass, true)
  assert.equal(result.summary.not_provided, 1)
})

test('an invalid package count is a mismatch with a format note', () => {
  const result = run({ packing_list: { packages: '12 CTNS' } })
  const packages = field(result, 'packages')
  assert.equal(packages.status, 'mismatch')
  assert.equal(packages.values.find((value) => value.document === 'packing_list').invalid, true)
  assert.match(packages.note, /装箱单的件数格式不对/)
  assert.equal(result.pass, false)
})

test('two mismatches are listed in field order', () => {
  const result = run({
    invoice: { gross_weight_kg: '100.50' },
    customs_declaration: { amount: '1001.00' },
  })
  assert.deepEqual(result.mismatch_fields, ['gross_weight_kg', 'amount'])
  assert.equal(result.summary.mismatch, 2)
})

test('a leading/trailing space in a code does not create a mismatch', () => {
  const result = run({ bill_of_lading: { invoice_no: '  inv-1  ' } })
  assert.equal(field(result, 'invoice_no').status, 'consistent')
  assert.equal(result.pass, true)
})

test('normalized values are exposed for audit', () => {
  const result = run({ invoice: { amount: '1,000.005' }, customs_declaration: { amount: '1000.01' } })
  const amount = field(result, 'amount')
  assert.equal(amount.status, 'consistent')
  assert.deepEqual(
    amount.values.map((value) => value.normalized),
    ['1000.01', '1000.01'],
  )
})

test('a mismatch field exposes per-document labels for rendering', () => {
  const result = run({ customs_declaration: { gross_weight_kg: '100.50' } })
  const gross = field(result, 'gross_weight_kg')
  assert.deepEqual(
    gross.values.map((value) => value.label),
    ['商业发票', '装箱单', '提单', '报关单'],
  )
})
