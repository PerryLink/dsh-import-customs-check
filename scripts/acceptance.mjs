#!/usr/bin/env node
/**
 * Acceptance checks over the public synthetic import document set. Writes
 * ACCEPTANCE.csv and evidence/<run_id>/result.json. No network, no real shipment.
 *
 *   node scripts/acceptance.mjs
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTools } from '../lib/plugin/tools.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const sample = path.join(root, 'samples', 'quickstart', 'input', 'import-set.json')
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const errors = []

async function errorCode(promise) {
  try {
    await promise
    return 'NO_ERROR'
  } catch (error) {
    return error?.code ?? error?.name ?? 'UNKNOWN'
  }
}

async function main() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'dsh-import-customs-check-acceptance-'))
  const baseDir = path.join(tempDir, 'store')
  try {
    const tools = Object.fromEntries(createTools({ baseDir }).map((tool) => [tool.name, tool]))
    const exec = { callId: 'acceptance' }

    const payload = JSON.parse(readFileSync(sample, 'utf8'))
    const complete = structuredClone(payload)
    complete.documents.customs_declaration.port_of_loading = '上海港'
    const completeFile = path.join(tempDir, 'complete.json')
    writeFileSync(completeFile, `${JSON.stringify(complete, null, 2)}\n`)

    const missing = structuredClone(payload)
    delete missing.documents.bill_of_lading
    const missingFile = path.join(tempDir, 'missing.json')
    writeFileSync(missingFile, `${JSON.stringify(missing, null, 2)}\n`)

    const check = await tools['import_check'].execute({ path: sample }, exec)
    const elements = await tools['import_elements'].execute({ path: sample }, exec)
    const completeElements = await tools['import_elements'].execute({ path: completeFile }, exec)
    const exported = await tools['import_export'].execute({ path: sample, filename: 'acceptance.csv' }, exec)
    const csvText = readFileSync(exported.path, 'utf8')

    const hs = check.fields.find((field) => field.field === 'hs_code')
    const gross = check.fields.find((field) => field.field === 'gross_weight_kg')
    const docCounts = check.documents.map((document) => document.field_count).join('/')
    const strictCode = await errorCode(tools['import_check'].execute({ path: sample, strict: true }, exec))
    const missingCode = await errorCode(tools['import_check'].execute({ path: missingFile }, exec))
    const pathCode = await errorCode(tools['import_export'].execute({ path: sample, filename: '../evil.csv' }, exec))

    // ACCEPTANCE.csv uses a simple comma-split schema: keep every field free of commas.
    const metrics = [
      {
        req_id: 'IMP-A01',
        metric: 'field check',
        threshold: 'fields=9 consistent=8 mismatch=1 pass=false',
        actual: `fields=${check.summary.total} consistent=${check.summary.consistent} mismatch=${check.summary.mismatch} pass=${check.pass}`,
        pass:
          check.summary.total === 9 &&
          check.summary.consistent === 8 &&
          check.summary.mismatch === 1 &&
          check.pass === false,
      },
      {
        req_id: 'IMP-A02',
        metric: 'HS normalization',
        threshold: '2 sources normalize to 84713000',
        actual: `sources=${hs.compared} unique=${new Set(hs.values.map((value) => value.normalized)).size}`,
        pass: hs.status === 'consistent' && hs.compared === 2 && new Set(hs.values.map((value) => value.normalized)).size === 1,
      },
      {
        req_id: 'IMP-A03',
        metric: 'gross weight mismatch',
        threshold: '4 sources with declaration 2450.50',
        actual: `sources=${gross.compared} declared=${gross.values.find((value) => value.document === 'customs_declaration')?.raw}`,
        pass:
          gross.status === 'mismatch' &&
          gross.compared === 4 &&
          gross.values.find((value) => value.document === 'customs_declaration')?.raw === '2450.50',
      },
      {
        req_id: 'IMP-A04',
        metric: 'strict mode',
        threshold: 'E_IMPORT_FIELD_MISMATCH',
        actual: strictCode,
        pass: strictCode === 'E_IMPORT_FIELD_MISMATCH',
      },
      {
        req_id: 'IMP-A05',
        metric: '12 elements',
        threshold: 'present=11 missing=1',
        actual: `present=${elements.present} missing=${elements.missing.map((item) => item.key).join('+')}`,
        pass: elements.total === 12 && elements.present === 11 && elements.missing[0]?.key === 'port_of_loading',
      },
      {
        req_id: 'IMP-A06',
        metric: 'complete elements',
        threshold: '12/12',
        actual: `${completeElements.present}/${completeElements.total}`,
        pass: completeElements.complete === true && completeElements.present === 12,
      },
      {
        req_id: 'IMP-A07',
        metric: 'check CSV',
        threshold: 'rows=9 sha ok',
        actual: `rows=${exported.rows} sha=${exported.sha256 === sha256(csvText) ? 'ok' : 'bad'}`,
        pass: exported.rows === 9 && exported.sha256 === sha256(csvText) && csvText.trimEnd().split('\n').length === 10,
      },
      {
        req_id: 'IMP-A08',
        metric: 'missing document',
        threshold: 'E_IMPORT_DOC_MISSING',
        actual: missingCode,
        pass: missingCode === 'E_IMPORT_DOC_MISSING',
      },
      {
        req_id: 'IMP-A09',
        metric: 'export path safety',
        threshold: 'traversal rejected',
        actual: pathCode,
        pass: pathCode === 'E_IMPORT_PATH_INVALID',
      },
      {
        req_id: 'IMP-A10',
        metric: 'document coverage',
        threshold: 'fields=9/5/5/9',
        actual: `fields=${docCounts}`,
        pass: docCounts === '9/5/5/9',
      },
    ]

    let quickstartPass = true
    try {
      execFileSync(process.execPath, ['samples/quickstart/run.mjs', '--check'], { cwd: root, stdio: 'ignore' })
    } catch {
      quickstartPass = false
    }
    const quickstartHash = sha256(readFileSync(path.join(root, 'samples', 'quickstart', 'expected', 'result.json')))
    const quickstart = {
      req_id: 'PS1-QS01',
      metric: 'quickstart golden',
      threshold: '1/1',
      actual: quickstartPass ? '1' : '0',
      pass: quickstartPass,
      evidence_sha256: quickstartHash,
    }

    const failures = metrics.filter((item) => !item.pass)
    for (const failure of failures) errors.push(`${failure.req_id} ${failure.metric}: ${failure.actual}`)
    if (!quickstartPass) errors.push('PS1-QS01 quickstart golden failed')

    const runId = `import-customs-check-${Date.now()}`
    const evidence = {
      run_id: runId,
      scope: 'IMPORT-CUSTOMS-CHECK-S1',
      status: failures.length === 0 && quickstartPass ? 'pass' : 'fail',
      counted: false,
      note: 'synthetic import document set only; no real shipment or customer data',
      metrics,
      pass: failures.length === 0 && quickstartPass,
    }
    const evidenceDir = path.join(root, 'evidence', runId)
    mkdirSync(evidenceDir, { recursive: true })
    const evidenceJson = `${JSON.stringify(evidence, null, 2)}\n`
    writeFileSync(path.join(evidenceDir, 'result.json'), evidenceJson)
    const evidenceHash = sha256(evidenceJson)

    const rows = [
      ...metrics.map(
        (item) =>
          `${item.req_id},${item.metric},${item.threshold},${item.actual},scripts/acceptance.mjs,${evidenceHash},${item.pass},public/synthetic,false`,
      ),
      `${quickstart.req_id},${quickstart.metric},${quickstart.threshold},${quickstart.actual},samples/quickstart/run.mjs,${quickstart.evidence_sha256},${quickstart.pass},synthetic/quickstart,true`,
    ]
    writeFileSync(
      path.join(root, 'ACCEPTANCE.csv'),
      `req_id,metric,threshold,actual,script,evidence_sha256,pass,source,counted\n${rows.join('\n')}\n`,
    )

    if (errors.length > 0) {
      for (const error of errors) console.error(`acceptance: ${error}`)
      process.exit(1)
    }
    console.log(`acceptance ok: ${metrics.length + 1} checks`)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

await main()
