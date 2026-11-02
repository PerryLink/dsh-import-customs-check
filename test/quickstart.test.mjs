import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const expectedPath = path.join(packageRoot, 'samples', 'quickstart', 'expected', 'result.json')

test('the bundled quickstart input is a synthetic four-document JSON set', async () => {
  const payload = JSON.parse(
    await readFile(path.join(packageRoot, 'samples', 'quickstart', 'input', 'import-set.json'), 'utf8'),
  )
  assert.equal(payload.shipment_id, 'SHP-2026-0618')
  assert.deepEqual(Object.keys(payload.documents), [
    'invoice',
    'packing_list',
    'bill_of_lading',
    'customs_declaration',
  ])
  assert.equal(Object.keys(payload).includes('customer_data'), false)
})

test('quickstart --check reproduces the committed golden result', () => {
  const result = spawnSync(process.execPath, ['samples/quickstart/run.mjs', '--check'], {
    cwd: packageRoot,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /fields: 8 consistent \/ 1 mismatch/)
  assert.match(result.stdout, /customs declaration elements: 11\/12 present; missing 装货港/)
  assert.match(result.stdout, /golden samples\/quickstart\/expected\/result\.json matches/)
  assert.match(result.stdout, /quickstart ok/)
})

test('quickstart --json equals the committed golden file', async () => {
  const result = spawnSync(process.execPath, ['samples/quickstart/run.mjs', '--json'], {
    cwd: packageRoot,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr)
  const expected = JSON.parse(await readFile(expectedPath, 'utf8'))
  assert.deepEqual(JSON.parse(result.stdout), expected)
  assert.equal(expected.check.shipment_id, 'SHP-2026-0618')
  assert.equal(expected.check.pass, false)
  assert.deepEqual(expected.check.mismatch_fields, ['gross_weight_kg'])
  assert.deepEqual(expected.elements.missing, [{ key: 'port_of_loading', label: '装货港' }])
  assert.equal(expected.export.rows, 9)
})
