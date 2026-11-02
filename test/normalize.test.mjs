import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeValue } from '../lib/core/check.js'

const normal = (kind, raw) => normalizeValue(kind, raw)
const valid = (kind, raw, expected) => {
  const result = normal(kind, raw)
  assert.equal(result.invalid, false, `${kind} ${raw}: ${result.reason}`)
  assert.equal(result.normalized, expected)
}
const invalid = (kind, raw) => {
  const result = normal(kind, raw)
  assert.equal(result.invalid, true, `${kind} ${raw} should be invalid`)
  assert.equal(result.normalized, '')
  assert.ok(result.reason)
}

test('code fields trim, collapse spaces and uppercase', () => {
  valid('code', '  inv-2026-0618 ', 'INV-2026-0618')
  valid('code', 'CT  2026 0042', 'CT 2026 0042')
  invalid('code', '')
  invalid('code', 'x'.repeat(65))
})

test('package counts accept separators but not fractions or zero', () => {
  valid('integer', '120', '120')
  valid('integer', '1,200', '1200')
  valid('integer', ' 10 ', '10')
  invalid('integer', '0')
  invalid('integer', '12.5')
  invalid('integer', '-1')
  invalid('integer', 'abc')
})

test('weights compare at 0.001 kg with half-up rounding', () => {
  valid('weight', '2450', '2450.000')
  valid('weight', '2450.5', '2450.500')
  valid('weight', '2,450.000', '2450.000')
  valid('weight', '2450.0006', '2450.001')
  valid('weight', '0.0006', '0.001')
  invalid('weight', '0')
  invalid('weight', '-2')
  invalid('weight', 'abc')
  invalid('weight', '1.1234567')
})

test('amounts compare at 0.01 with half-up rounding', () => {
  valid('amount', '184500', '184500.00')
  valid('amount', '184,500.5', '184500.50')
  valid('amount', '184500.005', '184500.01')
  valid('amount', '0.005', '0.01')
  invalid('amount', '0')
  invalid('amount', 'USD 100')
  invalid('amount', '1e3')
})

test('currency is a 3-letter code', () => {
  valid('currency', 'usd', 'USD')
  valid('currency', ' cny ', 'CNY')
  invalid('currency', 'US')
  invalid('currency', 'USDD')
  invalid('currency', '')
})

test('HS codes normalize dots and accept 6/8/10 digits only', () => {
  valid('hs', '8471.30.00', '84713000')
  valid('hs', '847130', '847130')
  valid('hs', '8471 30 00 90', '8471300090')
  invalid('hs', '8471300')
  invalid('hs', '8471.30.AA')
  invalid('hs', '')
})

test('origin country normalizes case and spaces but keeps names', () => {
  valid('country', ' cn ', 'CN')
  valid('country', '中国', '中国')
  valid('country', 'United   States', 'UNITED STATES')
  invalid('country', 'C')
  invalid('country', '')
})
