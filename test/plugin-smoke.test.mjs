import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as plugin from '../lib/plugin/index.js'
import { createTools } from '../lib/plugin/tools.js'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const samplePath = path.join(packageRoot, 'samples', 'quickstart', 'input', 'import-set.json')

test('createTools exposes the three import.* tools with unique names', () => {
  const tools = createTools({ baseDir: path.join(os.tmpdir(), 'dsh-import-check-smoke') })
  assert.deepEqual(
    tools.map((tool) => tool.name),
    ['import.check', 'import.elements', 'import.export'],
  )
  assert.equal(new Set(tools.map((tool) => tool.name)).size, 3)
  for (const tool of tools) {
    assert.ok(tool.name.startsWith('import.'))
    assert.ok(tool.description.length > 0)
    assert.equal(typeof tool.execute, 'function')
    assert.equal(typeof tool.output.render, 'function')
  }
})

test('resolveBaseDir defaults to $DSH_HOME/dsh-import-customs-check and honours the override', () => {
  assert.equal(
    plugin.resolveBaseDir({ DSH_HOME: '/tmp/dsh-home' }),
    path.join('/tmp/dsh-home', 'dsh-import-customs-check'),
  )
  assert.equal(
    plugin.resolveBaseDir({ DSH_HOME: '/tmp/dsh-home', DSH_IMPORT_CUSTOMS_CHECK_HOME: '/tmp/import-home' }),
    '/tmp/import-home',
  )
})

test('apply() registers the tools and wires the documented write root', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dsh-import-check-apply-'))
  const previous = process.env.DSH_IMPORT_CUSTOMS_CHECK_HOME
  process.env.DSH_IMPORT_CUSTOMS_CHECK_HOME = dir
  t.after(async () => {
    if (previous === undefined) delete process.env.DSH_IMPORT_CUSTOMS_CHECK_HOME
    else process.env.DSH_IMPORT_CUSTOMS_CHECK_HOME = previous
    await rm(dir, { recursive: true, force: true })
  })

  const registered = []
  await plugin.apply({ tools: { register(tool) { registered.push(tool) } } })
  assert.equal(plugin.name, 'dsh-import-customs-check')
  assert.deepEqual(plugin.inject, ['tools'])
  assert.equal(registered.length, 3)

  const exporter = registered.find((tool) => tool.name === 'import.export')
  const result = await exporter.execute({ path: samplePath, filename: 'apply.csv' }, { callId: 'apply' })
  assert.ok(result.path.startsWith(`${dir}${path.sep}exports${path.sep}`), result.path)
  assert.equal(result.rows, 9)
})

test('every tool render returns one text block', async () => {
  const tools = Object.fromEntries(
    createTools({ baseDir: path.join(os.tmpdir(), 'dsh-import-check-render') }).map((tool) => [tool.name, tool]),
  )
  const check = await tools['import.check'].execute({ path: samplePath }, { callId: 'render' })
  const rendered = tools['import.check'].output.render({ path: samplePath }, check)
  assert.equal(rendered.length, 1)
  assert.equal(rendered[0].type, 'text')
  assert.match(rendered[0].text, /Import check SHP-2026-0618/)
  assert.match(rendered[0].text, /pass=false/)

  const elements = await tools['import.elements'].execute({ path: samplePath }, { callId: 'render' })
  const elementsText = tools['import.elements'].output.render({ path: samplePath }, elements)[0].text
  assert.match(elementsText, /11\/12 present/)
  assert.match(elementsText, /装货港/)
})
