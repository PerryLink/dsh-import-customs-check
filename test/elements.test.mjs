import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ELEMENTS, checkElements } from '../lib/core/elements.js'
import { parseDocumentSet } from '../lib/core/set.js'
import { CUSTOMS_DECLARATION, documentSet, exec, makeTemp, sample, toolMap, writeSet } from './helpers/fixtures.mjs'
import path from 'node:path'

test('the bundled declaration is missing exactly one of the 12 elements', async () => {
  const set = parseDocumentSet(await readFile(sample, 'utf8'))
  const result = checkElements(set.documents.customs_declaration)
  assert.equal(result.complete, false)
  assert.equal(result.total, 12)
  assert.equal(result.present, 11)
  assert.deepEqual(result.missing, [{ key: 'port_of_loading', label: '装货港' }])
})

test('adding the missing port of loading completes the declaration', async () => {
  const set = parseDocumentSet(await readFile(sample, 'utf8'))
  const declaration = { ...set.documents.customs_declaration, port_of_loading: '上海港' }
  const result = checkElements(declaration)
  assert.equal(result.complete, true)
  assert.deepEqual(result.missing, [])
})

test('the element list is exactly 12 unique keys with labels', () => {
  assert.equal(ELEMENTS.length, 12)
  assert.equal(new Set(ELEMENTS.map((element) => element.key)).size, 12)
  for (const element of ELEMENTS) {
    assert.ok(element.label.length > 0)
    assert.ok(element.aliases.length > 0)
  }
})

test('Chinese declaration keys and numeric values count as present', () => {
  const declaration = {
    报关单号: '3101202606180001',
    申报日期: '2026-06-20',
    境内收发货人: '上海远洋国际贸易有限公司',
    境外收发货人: 'PACIFIC TECH PTE LTD',
    运输方式: '水路运输',
    运输工具名称: 'COSCO SHIPPING ROSE / 0618E',
    提运单号: 'COSU6389210450',
    监管方式: '一般贸易',
    征免性质: '一般征税',
    原产国: 'CN',
    装货港: '上海港',
    境内目的地: '上海',
  }
  assert.deepEqual(checkElements(declaration), { complete: true, total: 12, present: 12, missing: [] })
})

test('empty and non-string element values are missing', () => {
  const declaration = { ...CUSTOMS_DECLARATION, transport_mode: '   ', duty_nature: null, domestic_destination: {} }
  const result = checkElements(declaration)
  assert.equal(result.complete, false)
  assert.deepEqual(
    result.missing.map((item) => item.key),
    ['transport_mode', 'duty_nature', 'port_of_loading', 'domestic_destination'],
  )
})

test('import.elements reads a document set and returns the missing list', async (t) => {
  const dir = await makeTemp(t)
  const file = await writeSet(dir, 'complete.json', documentSet({ customs_declaration: { port_of_loading: '上海港' } }))
  const tools = toolMap(path.join(dir, 'store'))
  const result = await tools['import.elements'].execute({ path: file }, exec)
  assert.equal(result.complete, true)
  assert.equal(result.present, 12)
  const sampleResult = await tools['import.elements'].execute({ path: sample }, exec)
  assert.equal(sampleResult.present, 11)
  assert.deepEqual(sampleResult.missing, [{ key: 'port_of_loading', label: '装货港' }])
})
