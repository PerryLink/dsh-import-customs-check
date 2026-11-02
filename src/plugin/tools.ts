import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { checkDocuments, type CheckResult } from '../core/check.js'
import { checkElements, type ElementsResult } from '../core/elements.js'
import { ImportCustomsError } from '../core/errors.js'
import { checkCsv } from '../core/export.js'
import { parseDocumentSet } from '../core/set.js'
import { safeExportPath } from '../core/safe-path.js'
import { readImportSource } from '../core/source.js'

export interface ToolDeps {
  /** Local write root; the plugin uses `$DSH_HOME/dsh-import-customs-check`. */
  baseDir: string
}

const text = (value: string) => [{ type: 'text' as const, text: value }]
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

async function load(sourcePath: string) {
  return parseDocumentSet(await readImportSource(sourcePath))
}

export function createTools(deps: ToolDeps) {
  const check = defineTool({
    name: 'import.check',
    description:
      'Cross-check 9 header fields (invoice_no, contract_no, packages, gross_weight_kg, net_weight_kg, amount, currency, hs_code, origin_country) across a local JSON document set containing invoice, packing_list, bill_of_lading and customs_declaration. Returns a per-field consistent/mismatch table; strict=true raises E_IMPORT_FIELD_MISMATCH. Read-only.',
    parameters: {
      path: { type: 'string', required: true },
      strict: { type: 'boolean' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          shipment_id: { type: 'string', required: true },
          input_sha256: { type: 'string', required: true },
          documents: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                key: { type: 'string', required: true },
                label: { type: 'string', required: true },
                field_count: { type: 'number', required: true },
              },
            },
          },
          fields: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                field: { type: 'string', required: true },
                label: { type: 'string', required: true },
                status: {
                  type: 'string',
                  enum: ['consistent', 'mismatch', 'single_source', 'not_provided'],
                  required: true,
                },
                compared: { type: 'number', required: true },
                values: {
                  type: 'array',
                  required: true,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      document: { type: 'string', required: true },
                      label: { type: 'string', required: true },
                      raw: { type: 'string', required: true },
                      normalized: { type: 'string', required: true },
                      invalid: { type: 'boolean', required: true },
                    },
                  },
                },
                note: { type: 'string', required: true },
              },
            },
          },
          summary: {
            type: 'object',
            additionalProperties: false,
            required: true,
            properties: {
              total: { type: 'number', required: true },
              consistent: { type: 'number', required: true },
              mismatch: { type: 'number', required: true },
              single_source: { type: 'number', required: true },
              not_provided: { type: 'number', required: true },
            },
          },
          mismatch_fields: { type: 'array', required: true, items: { type: 'string' } },
          pass: { type: 'boolean', required: true },
        },
      },
      render: (_args, value: CheckResult) =>
        text(
          `Import check ${value.shipment_id}: ${value.summary.consistent} consistent, ${value.summary.mismatch} mismatch${value.mismatch_fields.length ? ` (${value.mismatch_fields.join(', ')})` : ''}, pass=${value.pass}`,
        ),
    },
    async execute(args) {
      const result = checkDocuments(await load(args.path))
      if (args.strict && !result.pass) {
        throw new ImportCustomsError(
          'E_IMPORT_FIELD_MISMATCH',
          `字段：${result.fields
            .filter((field) => field.status === 'mismatch')
            .map((field) => field.label)
            .join('、')}`,
        )
      }
      return result
    },
  })

  const elements = defineTool({
    name: 'import.elements',
    description:
      'Check the customs declaration in a local JSON document set for the 12 mandatory header elements and return the missing ones. Read-only.',
    parameters: { path: { type: 'string', required: true } },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          complete: { type: 'boolean', required: true },
          total: { type: 'number', required: true },
          present: { type: 'number', required: true },
          missing: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                key: { type: 'string', required: true },
                label: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value: ElementsResult) =>
        text(
          `Import elements: ${value.present}/${value.total} present${value.missing.length ? `, missing ${value.missing.map((item) => item.label).join('、')}` : ''}`,
        ),
    },
    async execute(args) {
      const set = await load(args.path)
      return checkElements(set.documents.customs_declaration)
    },
  })

  const exportTool = defineTool({
    name: 'import.export',
    description:
      'Write the nine-field consistency table as CSV under $DSH_HOME/dsh-import-customs-check/exports, one row per field and one column per document; returns path, sha256, bytes and rows.',
    parameters: {
      path: { type: 'string', required: true },
      filename: { type: 'string' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', required: true },
          sha256: { type: 'string', required: true },
          bytes: { type: 'number', required: true },
          rows: { type: 'number', required: true },
          pass: { type: 'boolean', required: true },
        },
      },
      render: (_args, value: { path: string; rows: number }) =>
        text(`Import check CSV ${value.rows} row(s) -> ${value.path}`),
    },
    async execute(args) {
      const result = checkDocuments(await load(args.path))
      const csv = checkCsv(result)
      const filename = args.filename ?? `import-check-${result.input_sha256.slice(0, 12)}.csv`
      let filePath: string
      try {
        filePath = await safeExportPath(path.join(deps.baseDir, 'exports'), filename)
      } catch (error) {
        if (error instanceof ImportCustomsError) throw error
        throw new ImportCustomsError('E_IMPORT_PATH_INVALID', String(error))
      }
      try {
        await writeFile(filePath, csv, 'utf8')
      } catch (error) {
        throw new ImportCustomsError('E_IMPORT_PATH_INVALID', `写 CSV 失败：${String(error)}`)
      }
      return {
        path: filePath,
        sha256: sha256(csv),
        bytes: Buffer.byteLength(csv, 'utf8'),
        rows: result.fields.length,
        pass: result.pass,
      }
    },
  })

  return [check, elements, exportTool]
}
