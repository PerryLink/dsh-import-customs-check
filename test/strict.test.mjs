import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { documentSet, exec, makeTemp, sample, setJson, toolMap, writeSet } from './helpers/fixtures.mjs'

test('import.check strict=false returns the mismatch table without throwing', async (t) => {
  const dir = await makeTemp(t)
  const tools = toolMap(path.join(dir, 'store'))
  const result = await tools['import.check'].execute({ path: sample }, exec)
  assert.equal(result.pass, false)
  assert.deepEqual(result.mismatch_fields, ['gross_weight_kg'])
})

test('import.check strict=true raises E_IMPORT_FIELD_MISMATCH with the field list', async (t) => {
  const dir = await makeTemp(t)
  const tools = toolMap(path.join(dir, 'store'))
  await assert.rejects(
    () => tools['import.check'].execute({ path: sample, strict: true }, exec),
    (error) => {
      assert.equal(error.code, 'E_IMPORT_FIELD_MISMATCH')
      assert.match(error.message, /毛重/)
      assert.match(error.message, /下一步：/)
      return true
    },
  )
})

test('strict=true passes a clean document set and returns pass=true', async (t) => {
  const dir = await makeTemp(t)
  const file = await writeSet(dir, 'clean.json', documentSet({ customs_declaration: { gross_weight_kg: '100.00' } }))
  const tools = toolMap(path.join(dir, 'store'))
  const result = await tools['import.check'].execute({ path: file, strict: true }, exec)
  assert.equal(result.pass, true)
  assert.deepEqual(result.mismatch_fields, [])
})

test('strict validation still reports a missing document first', async (t) => {
  const dir = await makeTemp(t)
  const file = await writeSet(dir, 'missing.json', documentSet({ packing_list: null }))
  const tools = toolMap(path.join(dir, 'store'))
  await assert.rejects(
    () => tools['import.check'].execute({ path: file, strict: true }, exec),
    (error) => error.code === 'E_IMPORT_DOC_MISSING',
  )
})

test('a missing path is E_IMPORT_PATH_INVALID even before parsing', async (t) => {
  const dir = await makeTemp(t)
  const tools = toolMap(path.join(dir, 'store'))
  await assert.rejects(
    () => tools['import.check'].execute({ path: path.join(dir, 'absent.json'), strict: true }, exec),
    (error) => error.code === 'E_IMPORT_PATH_INVALID',
  )
})

test('strict=true does not write an export as a side effect', async (t) => {
  const dir = await makeTemp(t)
  const file = await writeSet(dir, 'set.json', setJson({ customs_declaration: { gross_weight_kg: '100.50' } }))
  const baseDir = path.join(dir, 'store')
  const tools = toolMap(baseDir)
  await assert.rejects(() => tools['import.check'].execute({ path: file, strict: true }, exec))
  const { readdir } = await import('node:fs/promises')
  await assert.rejects(() => readdir(baseDir), /ENOENT/)
})
