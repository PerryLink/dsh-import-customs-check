#!/usr/bin/env node
/**
 * dsh-import-customs-check quickstart — cross-checks the bundled synthetic
 * import document set, checks the 12 declaration elements and exports the
 * field table as CSV.
 *
 *   node samples/quickstart/run.mjs            # human-readable summary
 *   node samples/quickstart/run.mjs --json     # the golden result on stdout
 *   node samples/quickstart/run.mjs --check    # recompute and diff against the golden file
 *
 * The golden file `expected/result.json` is the stdout of `--json`; it is a real
 * run over the committed JSON, not hand-written output.
 */
import assert from 'node:assert/strict'
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTools } from '../../lib/plugin/tools.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const samplePath = path.join(here, 'input', 'import-set.json')
const expectedPath = path.join(here, 'expected', 'result.json')
const mode = process.argv.includes('--check') ? 'check' : process.argv.includes('--json') ? 'json' : 'summary'

async function run() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'dsh-import-customs-check-quickstart-'))
  const realTemp = await realpath(tempDir)
  try {
    const tools = Object.fromEntries(createTools({ baseDir: tempDir }).map((tool) => [tool.name, tool]))
    const exec = { callId: 'quickstart' }

    const check = await tools['import_check'].execute({ path: samplePath }, exec)
    const elements = await tools['import_elements'].execute({ path: samplePath }, exec)
    const exported = await tools['import_export'].execute({ path: samplePath }, exec)
    const csvText = await readFile(exported.path, 'utf8')

    return {
      sample: 'samples/quickstart/input/import-set.json',
      check,
      elements,
      export: {
        path: path.relative(realTemp, exported.path).split(path.sep).join('/'),
        sha256: exported.sha256,
        bytes: exported.bytes,
        rows: exported.rows,
        text: csvText,
      },
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

function printSummary(result) {
  const { check, elements } = result
  console.log('dsh-import-customs-check quickstart - synthetic import document set (not a real shipment)')
  console.log(
    `documents: ${check.documents.map((document) => `${document.label} ${document.field_count} field(s)`).join('; ')}`,
  )
  console.log(
    `fields: ${check.summary.consistent} consistent / ${check.summary.mismatch} mismatch / ${check.summary.single_source} single-source / ${check.summary.not_provided} absent`,
  )
  for (const field of check.fields.filter((item) => item.status === 'mismatch')) {
    console.log(`mismatch ${field.field} (${field.label}): ${field.values.map((value) => `${value.label} ${value.raw}`).join(' / ')}`)
  }
  console.log(
    `customs declaration elements: ${elements.present}/${elements.total} present; missing ${elements.missing.map((item) => item.label).join('、') || 'none'}`,
  )
  console.log(
    `check CSV ${result.export.path}: ${result.export.rows} rows, ${result.export.bytes} bytes, sha256 ${result.export.sha256.slice(0, 12)}...`,
  )
}

const result = await run()

if (mode === 'json') {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else if (mode === 'check') {
  const expected = JSON.parse(await readFile(expectedPath, 'utf8'))
  assert.deepEqual(result, expected)
  printSummary(result)
  console.log('golden samples/quickstart/expected/result.json matches')
  console.log('quickstart ok')
} else {
  printSummary(result)
  console.log('run with --check to compare against expected/result.json')
}
