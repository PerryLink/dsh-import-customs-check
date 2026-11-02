# 故障排查 — dsh-import-customs-check

每条按「症状 / 原因 / 动作」写。报错原文都是 `<一句人话>（E_XXX）｜下一步：<动作>`，
把 `E_XXX` 和这句话一起发到 issue 即可定位。不要把真实报关单、提单或客户数据贴进 issue。

## 1. 缺一份单证（E_IMPORT_DOC_MISSING）

- **症状**：`进口单证集缺单证，或单证内容读不了（E_IMPORT_DOC_MISSING）｜下一步：JSON 里放齐 invoice、packing_list、bill_of_lading、customs_declaration 四份单证再试｜细节：缺：提单`
- **原因**：`documents` 里少了四份之一，或键名用了本包不认识的别名。
- **动作**：补齐 `invoice`、`packing_list`、`bill_of_lading`、`customs_declaration` 四份对象（也接受 `商业发票 / 装箱单 / 提单 / 报关单`）。确实不适用时先确认业务口径，不要直接删 key。

## 2. JSON 解析失败（E_IMPORT_DOC_MISSING）

- **症状**：`进口单证集缺单证，或单证内容读不了（E_IMPORT_DOC_MISSING）｜下一步：JSON 里放齐 ...｜细节：单证集 JSON 解析失败，读不出任何单证`
- **原因**：多了一个逗号、少了引号、文件被截断，或复制时混入了 BOM/注释/尾随文本。
- **动作**：用 `node -e "JSON.parse(require('fs').readFileSync('文件','utf8'))"` 或编辑器 JSON 校验先确认能解析；修好后再跑 `import.check`。本包不猜测损坏的 JSON。

## 3. 单证不是对象或重复（E_IMPORT_DOC_MISSING）

- **症状**：`...E_IMPORT_DOC_MISSING...｜细节：商业发票 不是 JSON 对象`，或 `同一类单证出现了两次：提单`
- **原因**：把某份单证写成了数组/字符串；或同时用了 `bill_of_lading` 和 `提单` 两个键。
- **动作**：每份单证写成一个 JSON 对象；同一类单证只保留一个键。字段可放在对象里，也可放在 `fields` 子对象里。

## 4. 严格模式发现不一致（E_IMPORT_FIELD_MISMATCH）

- **症状**：`单证之间的字段对不上（strict 模式下才会中断）（E_IMPORT_FIELD_MISMATCH）｜下一步：先看 import.check 的逐字段表，改单后再用 strict=true 复跑｜细节：字段：毛重`
- **原因**：`strict: true` 时至少一个字段是 `mismatch`，通常是毛重、净重、金额或件数在不同单证上不一致。
- **动作**：先跑不带 `strict` 的 `import.check`，看 `fields[].values` 和 `note` 定位到具体单证；改单后复跑。不要在代码里把 `strict` 改成 `false` 来“修复”数据。

## 5. 输入路径读不了（E_IMPORT_PATH_INVALID）

- **症状**：`单证集路径或导出文件名不可用（E_IMPORT_PATH_INVALID）｜下一步：传一个存在的 JSON 文件；导出时只传 [A-Za-z0-9._-] 组成的文件名｜细节：找不到 "/data/import-set.json"，或当前用户读不到`
- **原因**：路径拼错、文件已移动、传了目录，或当前进程没有读权限。
- **动作**：用绝对路径确认文件存在且可读；不要把目录当文件传。只读 `.json` 内容，不要求扩展名。

## 6. 导出文件名不安全（E_IMPORT_PATH_INVALID）

- **症状**：`...E_IMPORT_PATH_INVALID...｜细节：导出文件名不安全：\"../核对表.csv\"`
- **原因**：`filename` 里带了 `../`、`/`、反斜杠、空格、中文，或超过 120 个字符。
- **动作**：只传一个由 `[A-Za-z0-9._-]` 组成的文件名，例如 `import-check-2026-06-18.csv`；目录固定为 `$DSH_HOME/dsh-import-customs-check/exports/`，不要传绝对路径。

## 7. 明明是同一个值却报 mismatch

- **症状**：`import.check` 里某字段 `status=mismatch`，但人工看觉得一样。
- **原因**：比较前只做固定规范化：发票号/合同号/原产国会转大写并合并空格，HS 去点/空格/连字符，重量按 0.001 kg、金额按 0.01 half-up；`CN` 与 `China`、`USD` 与 `US$` 仍是不同值。
- **动作**：看该字段 `values[].normalized` 是否不同；把四份单证统一成同一种写法（如都用 `CN`、`USD`、`84713000`）。不要为了过检直接改金额或重量。

## 8. 某个字段是 single_source 或 not_provided

- **症状**：没有报错，但某字段 `status=single_source`（只有一份单证提供）或 `not_provided`（四份都没有）。
- **原因**：这是设计行为：提单通常没有金额和净重，装箱单通常没有金额；无法交叉核对的字段不会被硬判为不一致。
- **动作**：确认业务上是否应该由另一份单证提供；若应该，补进对应单证再跑。`single_source` / `not_provided` 不会让 `pass=false`。

## 9. 报关单要素缺项

- **症状**：`import.elements` 返回 `complete=false`，`missing` 里列出“装货港”等。
- **原因**：报关单对象里没有该 key，或值是空字符串 / `null` / 对象。
- **动作**：按 `missing[].key` 补上非空文本（如 `port_of_loading: "上海港"`）。12 项清单见 README；这是本包约定的表头完整性清单，不等于海关法定校验。

## 10. 数值精度和预期不同

- **症状**：重量或金额只差很小的小数，却被判为一致/不一致。
- **原因**：重量按 0.001 kg、金额按 0.01 比较，使用 half-up 舍入；`2450.0006` → `2450.001`，`184500.005` → `184500.01`。
- **动作**：统一源单证的小数位；如果业务需要更细的精度，先在源系统对齐，不要依赖本包的显示值做结算。

## 还不行

```sh
node samples/quickstart/run.mjs --check   # 自带样例必须通过
node --test test/*.test.mjs               # 58 项测试
node scripts/gate.mjs                     # 元数据 + 验收门
```

仍失败时请在 <https://github.com/PerryLink/dsh-import-customs-check/issues> 附上：包版本、最小合成 JSON（或生成脚本）、
`import.check` / `import.elements` 的完整报错行、Node 与 DSH 版本。**不要附真实报关单、提单或客户数据。**
