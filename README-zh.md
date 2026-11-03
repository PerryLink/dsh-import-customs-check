<div align="center">

# dsh-import-customs-check

> **官方仓库。** 本包唯一官方仓库，由 PerryLink 维护；其他账号下的同名仓库与本项目无关。Apache-2.0。

[![npm](https://img.shields.io/npm/v/dsh-import-customs-check)](https://www.npmjs.com/package/dsh-import-customs-check)
[![CI](https://github.com/PerryLink/dsh-import-customs-check/actions/workflows/ci.yml/badge.svg)](https://github.com/PerryLink/dsh-import-customs-check/actions)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](LICENSE)

**把发票、装箱单、提单、报关单四份进口单证逐字段对照，并列出报关单 12 项要素的缺项。**

> **状态：alpha / 公开合成 / partial / not counted / 非 GA。** 不含真实报关单、客户数据或客户证据，也不作合规、归类或申报结论声明。

[English](README.md) · [简体中文](README-zh.md)

```sh
dsh plugin --profile <profile> add dsh-import-customs-check
```

</div>

## 一句话

把四份进口单证的 9 个表头字段逐项对照，再检查报关单 12 项要素缺什么。

## 适合 / 不适合

- **适合**：一票进口货物的发票、装箱单、提单、报关单已经整理成 JSON；想在申报前核对发票号、合同号、件数、毛重、净重、金额、币种、HS 编码、原产国是否一致；想确认报关单 12 项表头要素有没有漏填。
- **不适合**：PDF、扫描件、图片或 Excel 直接输入（本包不做 OCR，请先人工整理成 JSON）；商品行级别的 SKU / 数量 / 单价核对；归类裁定、原产地规则、完税价格或监管证件判断；替代报关行、海关或律师的合规意见；多票货物混在一个文件里。

## 输入

- 格式：UTF-8 JSON，单票货物，四份单证必须齐全：

```json
{
  "shipment_id": "SHP-2026-0618",
  "documents": {
    "invoice": { "invoice_no": "INV-2026-0618", "contract_no": "CT-2026-0042", "packages": 120,
                 "gross_weight_kg": "2450.00", "net_weight_kg": "2280.00", "amount": "184500.00",
                 "currency": "USD", "hs_code": "8471.30.00", "origin_country": "CN" },
    "packing_list": { "invoice_no": "INV-2026-0618", "packages": "120", "gross_weight_kg": "2450.00" },
    "bill_of_lading": { "invoice_no": "INV-2026-0618", "packages": "120", "gross_weight_kg": "2450.00" },
    "customs_declaration": { "declaration_no": "3101202606180001", "port_of_loading": "上海港" }
  }
}
```

- 单证键：`invoice`、`packing_list`、`bill_of_lading`、`customs_declaration`；也接受 `商业发票 / 装箱单 / 提单 / 报关单` 等别名。四份缺一不可。
- 字段可直接放在单证对象里，也可放在 `fields` 子对象里；字段名支持英文和中文别名（如 `invoice_no` / `发票号`、`gross_weight_kg` / `毛重`）。
- 美元/人民币金额、公斤重量可写成字符串或 JSON 数字；比较精度分别是 0.01 和 0.001 kg。
- 大小：单个文件 ≤ 5 MB；只读，不改原文件。
- 来源：用户自己整理的本地 JSON；样例是合成单证，不含真实企业或报关数据。

## 输出

- `import.check`：逐字段表。每个字段一行，含 `status`、`compared`（提供该字段的单证数）、`values`（每份单证的原始值、规范化值、是否格式错误）和 `note`。`summary` 统计 `consistent / mismatch / single_source / not_provided`，`pass = mismatch === 0`。
- `import.elements`：报关单 12 项必填要素的完整性，返回 `{ complete, total, present, missing: [{ key, label }] }`。
- `import.export`：把逐字段表写到 `$DSH_HOME/dsh-import-customs-check/exports/`，一行一个字段、一列一份单证，返回路径、`sha256`、字节数和行数。

状态含义：

| status | 含义 | 是否算失败 |
|---|---|---|
| `consistent` | 至少 2 份单证提供该字段，规范化后完全一致 | 否 |
| `mismatch` | 规范化后不一致，或有单证的值格式非法 | 是（`pass=false`） |
| `single_source` | 只有 1 份单证提供该字段，无法交叉核对 | 否 |
| `not_provided` | 四份单证都没有这个字段 | 否 |

`import.check` 默认返回完整表格；传 `strict: true` 时，只要有 `mismatch` 就抛 `E_IMPORT_FIELD_MISMATCH`，适合放进自动门禁。

## 示例

直接复制下面这句：

> 我有一套进口单证（发票、装箱单、提单、报关单），帮我核对 9 个字段是否一致，再看报关单 12 项要素缺什么。

用自带样例复跑并核对金标：

```sh
node samples/quickstart/run.mjs --check
```

![dsh-import-customs-check quickstart 真实运行输出](docs/assets/quickstart.png)

样例是一票合成货物：四份单证齐全，毛重在报关单上故意写成 `2450.50`（其余三份 `2450.00`），用来演示 `mismatch`；HS 编码在发票上是 `8471.30.00`、报关单上是 `84713000`，规范化后一致，用来演示格式差异不算不一致；报关单故意漏填 `port_of_loading`（装货港），用来演示 12 项要素缺项。金标 `samples/quickstart/expected/result.json` 由 `node samples/quickstart/run.mjs --json` 真实产生，不是手写。

## 权限

读：用户指定的进口单证集 JSON（样例 `samples/quickstart/input/import-set.json`）；不读其他目录。
写：`$DSH_HOME/dsh-import-customs-check/exports/`（CSV 输出）；不改原 JSON。
联网：否。
外部系统：无。

`import.check`、`import.elements` 标 **R0**（只读）；`import.export` 标 **R1**（本地写，只写 `$DSH_HOME/dsh-import-customs-check/exports/`）。测试可用 `DSH_IMPORT_CUSTOMS_CHECK_HOME` 覆盖本地写根目录，默认严格等于 `$DSH_HOME/dsh-import-customs-check`。

## FAQ

### 1. 缺一份单证会怎样？

`import.check` 和 `import.elements` 都会报 `E_IMPORT_DOC_MISSING`，并在细节里写出缺哪一份（如“缺：提单”）。本包不会用三份单证“猜”第四份；请补齐后再跑。若某份单证确实不适用，请先在业务上确认，而不是删 key。

### 2. `mismatch` 和 `E_IMPORT_FIELD_MISMATCH` 有什么区别？

`mismatch` 是结果表里的一个状态，默认只报告、不中断；`E_IMPORT_FIELD_MISMATCH` 是 `strict: true` 时的错误码。把 `import.check` 接进自动流程时用 `strict: true`，人工复核时用默认模式看完整表。

### 3. 报关单缺 `port_of_loading` 为什么不算 `mismatch`？

12 项要素完整性由 `import.elements` 单独检查，不与 9 个一致性字段混在一起。缺要素时 `complete=false`、`missing` 列出缺项；它不会让 `import.check` 的 `pass` 变成 false。

### 4. HS 编码格式不同会误报吗？

不会。比较前会去掉点、空格和连字符，只比数字；`8471.30.00` 与 `84713000` 视为一致（8 位）。6 位、8 位、10 位是不同粒度，会如实报 `mismatch`。本包不判断编码本身是否正确。

### 5. 重量和金额的精度是多少？

重量按 0.001 kg、金额按 0.01 比较，四舍五入采用 half-up；例如 `2450.0006` 规范化为 `2450.001`，`184500.005` 规范化为 `184500.01`。这是比较口径，不代表海关或银行的计税/结算口径。

### 6. 会改我的文件或上传数据吗？

不会。只读用户指定的 JSON；只在本地写 `$DSH_HOME/dsh-import-customs-check/exports/`；不联网、不调用模型、不上传。

## 版本

`0.1.0` · 58 项测试通过（`node --test test/*.test.mjs`）。

> ⭐ 如果它帮到了你，点个 star 会让下一个人更容易找到它；没有任何功能被 star 解锁。

## 安装

```sh
dsh plugin --profile <profile> add dsh-import-customs-check
dsh --profile <profile> --dump-config | grep dsh-import-customs-check
```

卸载：

```sh
dsh plugin --profile <profile> remove dsh-import-customs-check
```

### 安装通道

- **npm（推荐）：** `dsh plugin --profile <profile> add dsh-import-customs-check`
- **git 通道：** `dsh plugin --profile <profile> add github:PerryLink/dsh-import-customs-check`
- **tarball：** `pnpm pack`，然后 `dsh plugin --profile <profile> add ./dsh-import-customs-check-<version>.tgz`

## 工具

工具名是稳定 API；说明保留英文以匹配运行时输出。

| 工具 | 用途 | 风险 |
|---|---|---|
| `import.check` | 对 9 个表头字段做四单证一致性核对，返回逐字段表；`strict=true` 时不一致即报错 | R0 |
| `import.elements` | 检查报关单 12 项必填要素，返回缺项列表 | R0 |
| `import.export` | 把逐字段核对表导出成 CSV，返回路径与 sha256 | R1 本地写 |

## 核对规则

| 字段 | key | 规范化 |
|---|---|---|
| 发票号 | `invoice_no` | 去首尾空格、合并空格、转大写 |
| 合同号 | `contract_no` | 同上 |
| 件数 | `packages` | 去逗号/空格，正整数 |
| 毛重 | `gross_weight_kg` | 去逗号/空格，按 0.001 kg half-up |
| 净重 | `net_weight_kg` | 同上 |
| 金额 | `amount` | 去逗号/空格，按 0.01 half-up |
| 币种 | `currency` | 3 位字母，转大写 |
| HS 编码 | `hs_code` | 去点/空格/连字符，6/8/10 位数字 |
| 原产国 | `origin_country` | 去首尾空格、合并空格、转大写 |

## 报关单 12 项要素

| # | key | 要素 |
|---:|---|---|
| 1 | `declaration_no` | 报关单号 |
| 2 | `declaration_date` | 申报日期 |
| 3 | `domestic_consignee` | 境内收发货人 |
| 4 | `overseas_consignor` | 境外收发货人 |
| 5 | `transport_mode` | 运输方式 |
| 6 | `transport_name` | 运输工具名称 |
| 7 | `bill_of_lading_no` | 提运单号 |
| 8 | `supervision_mode` | 监管方式 |
| 9 | `duty_nature` | 征免性质 |
| 10 | `origin_country` | 原产国（地区） |
| 11 | `port_of_loading` | 装货港 |
| 12 | `domestic_destination` | 境内目的地 |

这 12 项是**本包约定的表头完整性清单**，不是海关申报系统或某个关区的法定校验规则；实际申报以海关最新要求为准。

## 快速开始

```sh
# 1) 看逐字段一致性
#    工具面：import.check({ path: "/abs/path/import-set.json" })

# 2) 严格门禁（有不一致就报错）
#    工具面：import.check({ path: "/abs/path/import-set.json", strict: true })

# 3) 看报关单要素
#    工具面：import.elements({ path: "/abs/path/import-set.json" })

# 4) 导出核对表
#    工具面：import.export({ path: "/abs/path/import-set.json" })
```

用样例直接跑：

```sh
node samples/quickstart/run.mjs --check
```

## 错误码

| 错误码 | 何时出现 | 下一步 |
|---|---|---|
| `E_IMPORT_DOC_MISSING` | 四份单证缺一、JSON 解析失败、单证不是对象、同一单证重复、文件为空或超 5 MB | 补齐四份单证，检查 JSON 结构 |
| `E_IMPORT_FIELD_MISMATCH` | `strict: true` 且至少一个字段 `mismatch` | 看 `import.check` 表，改单后复跑 |
| `E_IMPORT_PATH_INVALID` | 输入路径不存在/是目录/读不了、导出目录不可写，或导出文件名含路径、空格、中文、超长 | 传存在的 JSON；导出只传 `[A-Za-z0-9._-]` 文件名 |

报错原文格式：`<一句人话>（E_IMPORT_XXX）｜下一步：<一个动作>`。更多排查见 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

## 验收证据

公开/合成 fixture 在 `samples/quickstart/`；`ACCEPTANCE.csv` 记录检查，除 quickstart 行外均为 `counted=false`。

| req_id | metric | threshold | actual | pass | source | counted |
|---|---|---|---|---|---|---|
| IMP-A01 | field check | fields=9 consistent=8 mismatch=1 | fields=9 consistent=8 mismatch=1 | true | public/synthetic | false |
| IMP-A03 | gross weight mismatch | 4 sources declaration=2450.50 | 4 sources declaration=2450.50 | true | public/synthetic | false |
| IMP-A05 | 12 elements | present=11 missing=1 | present=11 missing=1 | true | public/synthetic | false |
| PS1-QS01 | quickstart golden | 1/1 | 1 | true | synthetic/quickstart | true |

*这是 fixture 支撑的验收行，不是真实报关运行；没有编造输出。*

## 边界与已知限制

- **输入是整理好的 JSON**：不读 PDF、扫描件、图片或 Excel，不做 OCR，也不解析报关单 XML/单一窗口报文。
- 只核对 9 个表头字段和 12 项表头要素：不做商品行、SKU、数量、单价、原产地规则、归类、完税价格或监管证件判断。
- 不做语义映射：`CN` 与 `China`、`USD` 与 `US$` 会被当作不同值；请统一写法。
- HS 编码只做格式与一致性检查，不判断编码是否正确、是否适用于该商品。
- 12 项要素是本包约定的表头清单，不是法定申报规则；不替代报关行、海关或律师意见。
- 金额/重量按固定精度 half-up 比较；不处理汇率、单位换算（如 lbs → kg）或千分位以外的本地化格式。
- 导出 CSV 只做 RFC 4180 引号转义，不做 Excel 公式前缀清洗。
- 只在本机读写；不联网、不调用模型、不上传。
- 仅公开/合成样例；alpha/partial、not counted，不作 GA 或生产可用声明。

## 开发

```sh
pnpm install --frozen-lockfile
pnpm build && pnpm lint && pnpm typecheck
node --test test/*.test.mjs
node scripts/gate.mjs
```

## 兼容性

| 维度 | 状态 |
|---|---|
| Harness | `dsh >=0.2.1-rc.3 <0.4.0` |
| Node | `>=24.9.0 <25` |
| Platforms | All; local files only |
| 数据 | No network, no model call, no upload |

## 相关项目

- [dsh-hs-candidate](https://github.com/PerryLink/dsh-hs-candidate)（HS 候选与 12 项归类要素）
- [dsh-freight-audit](https://github.com/PerryLink/dsh-freight-audit)（运费账单核对）
- [领域索引](https://perrylink.github.io/dsh-plugins/)

## 许可证

Apache-2.0. See `LICENSE`, `NOTICE`, `THIRD-PARTY-NOTICES`.
