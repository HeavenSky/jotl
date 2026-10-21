# 命令参考

[English](../../docs/commands.md) · **简体中文**

本页列出 `jotl` 每个命令的选项、默认值与示例，并说明输入格式怎么判定。前提是已按[快速开始](../README.md)装好 `jotl`；`jotl <command> --help` 离线给出同样的选项。

| 命令                                | 作用                                                    |
| ----------------------------------- | ------------------------------------------------------- |
| [`compile`](#compile)               | Jotl 编译为 JSON Schema 2020-12（默认）或 TS 声明       |
| [`convert`](#convert)               | 在 Jotl、JSON Schema 与 TS 声明之间任意互转             |
| [`check`](#check)                   | 只报告诊断，不输出结果                                  |
| [`validate`](#validate)             | 按 schema 校验 JSON 数据文件                            |
| [`defaults`](#defaults)             | 以 JSON 输出 schema 的默认数据                          |
| [`migrate-schema`](#migrate-schema) | 把凤蝶 schema 或旧版 JSON Schema 迁移为 Jotl 或 2020-12 |
| [`format`](#format)                 | 格式化 Jotl 源码，保留注释                              |

全局选项对所有命令有效：`-h, --help` 显示帮助（写在命令后显示该命令的帮助，`jotl help <command>` 效果相同），`-v, --version` 显示版本号，`--lang <zh|en>` 选择输出语言（见[在脚本与 CI 中使用 jotl](scripting.md#选择输出语言)）。

## 输入怎么读

schema 参数按扩展名判断格式：`.jotl` 是 Jotl 源码，`.json` 是 JSON Schema，`.ts`（含 `.d.ts`）是 TS 声明。这条规则适用于 `convert`、`check`、`validate` 与 `defaults`；`convert` 还可以用 `--from jotl|schema|ts` 直接指定。其他扩展名报用法错误（`JOTL9009`，`convert` 为 `JOTL9010`）。

读取文件的参数写 `-` 时从 stdin 读入，诊断中的位置写作 `-`。同一命令只能有一个参数写 `-`，否则报用法错误 `JOTL9015`。stdin 没有扩展名，格式按内容判断：

- `check`、`validate` 与 `defaults`：去掉 BOM 与空白后，以 `{` 或 `[` 开头为 JSON Schema，否则为 Jotl。
- `convert` 不写 `--from` 时还识别 TS。去掉开头的空白与注释后，以声明关键字（`export`、`declare`、`interface`、`type`、`import`、`enum`、`namespace`、`const`、`let`、`var`、`function`、`class`、`abstract`）后接名字开头为 TS；以 `<` 开头、以大驼峰类型名后接 `(`、`:` 或 `[` 开头，或内容为空，为 Jotl。都不是时报用法错误 `JOTL9016`，需要写 `--from`。

JSON Schema 输入先升级到 2020-12，做法与 `migrate-schema --to schema` 相同，只是不输出变更清单：

- `--schema-version <version>` 指定未声明 `$schema` 时的版本，可选 `draft-04`、`draft-06`、`draft-07`、`2019-09`、`2020-12`、`swagger-2.0`、`openapi-3.0`、`openapi-3.1`。
- 没有 `$schema`、也无法按特征推断版本时，按 2020-12 处理并报 `JOTL9053` 警告。
- OpenAPI 3.0 与 Swagger 2.0 的 Schema Object 要用 `--schema-version` 指明版本才能识别。

编译 Jotl 的命令会读取 `jotl.config.json`，并接受 `--config <file>` 与 `--no-config`，见[登记项目组件](project-config.md)。

## 结果写到哪里

结果写到 stdout；写了 `--out <file>` 时写到该文件，stdout 为空。有错误级诊断时不输出结果，也不创建 `--out` 文件。`--out` 指向任一输入文件（含经符号链接指向）时报用法错误 `JOTL9008`，输入文件不会被覆盖。

## compile

```sh
jotl compile <file.jotl> [--to schema|ts] [--out <file>] [--typia-tags] [--config <file> | --no-config]
```

把 Jotl 编译为 JSON Schema 2020-12（`--to schema`，默认）或 TS 声明（`--to ts`）。`--typia-tags` 输出 typia 类型标签，只能与 `--to ts` 同用，否则报用法错误 `JOTL9011`。TS 转换阶段的诊断会换算回 Jotl 源码中的位置。

```sh
jotl compile home.jotl --out home.schema.json
jotl compile home.jotl --to ts --typia-tags --out home.d.ts
```

## convert

```sh
jotl convert <input> --to jotl|schema|ts [--from jotl|schema|ts] [--schema-version <version>]
             [--on-conflict error|preferDeclared|preferLatest] [--out <file>] [--typia-tags]
             [--config <file> | --no-config]
```

在 Jotl、JSON Schema 2020-12 与 TS 声明之间互转。`--to` 必填。

| 选项                         | 含义                                                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `--from <jotl\|schema\|ts>`  | 输入格式；不写时按[输入怎么读](#输入怎么读)判断                                                                           |
| `--schema-version <version>` | 未声明 `$schema` 的 JSON Schema 输入按哪个版本处理                                                                        |
| `--on-conflict <policy>`     | 升级 JSON Schema 时新旧关键字语义冲突的处理：`preferDeclared` 按声明版本（默认），`preferLatest` 按 2020-12，`error` 报错 |
| `--typia-tags`               | TS 输出使用 typia 类型标签；只能与 `--to ts` 同用                                                                         |

```sh
jotl convert legacy.json --to jotl --out legacy.jotl
jotl convert types.d.ts --to schema
jotl convert schema.txt --from jotl --to ts
cat types.d.ts | jotl convert - --to jotl
```

## check

```sh
jotl check <file...> [--schema-version <version>] [--config <file> | --no-config]
```

只报告诊断，不输出结果。检查内容随格式而定：

- `.jotl`：编译诊断。
- `.json`：升级到 2020-12 时的警告与错误，以及升级后的 schema 能否编译用于校验。
- `.ts` / `.d.ts`：转换诊断。

任一文件无法判断格式时，所有文件都不检查，按用法错误退出。

```sh
jotl check schemas/*.jotl schemas/legacy.json
```

## validate

```sh
jotl validate <schema> <data...> [--schema-version <version>] [--config <file> | --no-config]
```

按 schema 校验一个或多个 JSON 数据文件，每个文件一行结论写到 stdout：`<file>: 通过` 或 `<file>: 未通过`（英文输出为 `passed` / `failed`）。校验错误写到 stderr，位置写作 `<数据文件>#<JSON Pointer>`；下一行缩进给出该值在数据文件中的 `文件:行:列`，对象成员取键名位置，指针不存在时取最近的上级。任一文件未通过时退出码为 `1`。

```sh
jotl validate home.jotl data/home.json data/home-empty.json
```

数据文件读不到或不是合法 JSON 时报 `JOTL9050` 或 `JOTL9052`，该文件没有结论行。

## defaults

```sh
jotl defaults <schema> [--strategy explicit|required|all] [--schema-version <version>] [--out <file>]
              [--config <file> | --no-config]
```

按 schema 生成默认数据，以 JSON 输出。

| `--strategy`       | 产出                           |
| ------------------ | ------------------------------ |
| `explicit`（默认） | 只取显式的 `default`           |
| `required`         | 显式默认值，加上必填字段的零值 |
| `all`              | 显式默认值，加上所有字段的零值 |

schema 中没有可生成的默认数据时不输出，报 `JOTL9054` 提示。具体规则见 [`@jotl/data` 的 README](../../../data/zh/README.md) 中 getDefaults 一节。

```sh
jotl defaults home.jotl --strategy required --out home.defaults.json
```

## migrate-schema

```sh
jotl migrate-schema <file> [--to jotl|schema] [--out <file>] [--schema-version <version>]
                    [--accept-newer-keywords=true|false] [--on-conflict error|preferDeclared|preferLatest]
```

把凤蝶 schema 或旧版 JSON Schema 迁移为 Jotl（`--to jotl`，默认）或 JSON Schema 2020-12（`--to schema`）。输入类型自动判定，判定结果与依据以 `JOTL9055` 提示写到 stderr：

| 判定为                       | 条件                                                                                                                                                              | 处理                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 凤蝶源码                     | 不以 `{` 或 `[` 开头（不是 JSON 文本）                                                                                                                            | 按 umo-edit-sdk 文法解析，规则见 [`@jotl/convert` 的 README](../../../convert/zh/README.md) |
| 凤蝶 toJson JSON（umo JSON） | 是 JSON，且任一字段带与属性名相同的 `key`、类型为凤蝶类型（如 `image`、`text`、`richtext`、`url`、`color`、`date`、`enum`、`box`），或枚举成员为 `{label, value}` | 同上，跳过解析                                                                              |
| 常规 JSON Schema             | 其余 JSON；以 `{` 开头但不是合法 JSON 时报 `JOTL9052`                                                                                                             | draft-04 至 2019-09、OpenAPI 3.0 / 3.1 / Swagger 2.0 的 Schema Object 先升级到 2020-12      |

常规 JSON Schema 输入可用的选项：

| 选项                                  | 含义                                                                                                                                |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `--schema-version <version>`          | 未声明 `$schema` 时的版本，取值同[输入怎么读](#输入怎么读)                                                                          |
| `--accept-newer-keywords=true\|false` | 是否按 2020-12 语义接受比声明版本更新的关键字；默认 `true`                                                                          |
| `--on-conflict <policy>`              | `error`、`preferDeclared` 或 `preferLatest`；`--to jotl` 时默认 `preferDeclared`（与 `convert` 一致），`--to schema` 时默认 `error` |

- 这三个选项只适用于常规 JSON Schema，用于凤蝶输入时报用法错误 `JOTL9013`。
- 常规 JSON Schema 且 `--to schema` 时，变更清单（每处改写一条 info 级诊断）也写到 stderr。
- 凤蝶迁移中无法转换的信息保留在 `x-fengdie` 并报警告，不影响退出码。
- `migrate-schema` 不读 `jotl.config.json`。

```sh
jotl migrate-schema home.fengdie --out home.jotl
jotl migrate-schema home.umo.json --to schema
jotl migrate-schema legacy.json --to schema --out legacy.2020-12.json
jotl migrate-schema pet.json --to schema --schema-version openapi-3.0 --on-conflict preferLatest
```

## format

```sh
jotl format <file.jotl> [--write]
```

格式化 Jotl 源码并保留注释，结果写到 stdout。写 `--write` 时改写原文件：内容不变时不写，原文开头的 BOM 保留。`--write` 不能与 `-` 同用（用法错误 `JOTL9014`）。源码有语法错误时既不输出也不写回。`format` 只排版，不读 `jotl.config.json`。

```sh
jotl format home.jotl --write
```
