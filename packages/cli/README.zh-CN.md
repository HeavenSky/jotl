# jotl

[English](./README.md) · **简体中文**

在命令行或脚本(CI, 构建步骤)中编译, 转换, 检查 Jotl 与 JSON Schema, 或解析 `jotl` 的输出与退出码时读本页; 对应 `packages/cli`.

## 安装

```sh
pnpm add -D jotl
pnpm exec jotl --help
```

要求 Node `>=22`. 在本仓库内不经安装直接运行:

```sh
pnpm exec tsc -p packages/cli
node packages/cli/dist/bin.js --help
```

## 输出约定

- 结果写到 stdout; 带 `--out <file>` 时写到该文件, stdout 为空. `--out` 指向任一输入文件时按用法错误拒绝, 不会覆盖输入.
- 诊断写到 stderr, 一条一行: 有源码位置时为 `文件:行:列 代码 级别: 消息`, 只有 JSON Pointer 时为 `文件#/指针 代码 级别: 消息`; 级别中文输出为 `错误` `警告` `提示`, 英文输出为 `error` `warning` `info`(见「输出语言」). 行列从 1 起, 列按 UTF-16 代码单元计.
- 多行消息与 `related` 信息写在后续行, 以两个空格缩进; 按行解析时只取不以空格开头的行.
- 用法错误的位置写作 `jotl`, 下一行提示对应命令的 `--help`.
- 有错误级诊断时不输出结果, 也不写 `--out` 文件.
- 退出码: `0` 成功(警告与提示不影响), `1` 有错误级诊断(含文件读写失败), `2` 用法错误.
- 读取文件的参数写 `-` 时从 stdin 读入(诊断位置写作 `-`); `convert` 不写 `--from` 时按内容判断格式(见「schema 输入」). `check` `defaults` 与 `validate` 的 schema 参数从 stdin 读入时按内容判断格式(见「schema 输入」). 同一命令中只能有一个参数写 `-`, 否则报用法错误 `JOTL9015`.
- 命令行自身的诊断代码为 `JOTL9xxx`, 见 `src/diagnostics.ts` 的 `CLI_DIAGNOSTICS`; 其余代码来自各上游包.

## 输出语言

帮助文本, 诊断消息, 级别标签, 结果行与生成文字(如 TS 文件头)按中文或英文输出:

- 全局选项 `--lang <zh|en>`(也可写 `--lang=en`; 接受 `zh-CN`, `zh_CN`, `en-US` 等地区写法, 不区分大小写)可写在 `--` 之前的任意位置; 多次出现时以最后一次为准; 其他取值为用法错误.
- 未写 `--lang` 时依次取环境变量 `JOTL_LANG`, `LC_ALL`, `LC_MESSAGES`, `LANG` 中第一个非空值: 以 `zh` 开头(如 `zh_CN.UTF-8`)为中文, 其余(含 `C` 与 `POSIX`)为英文; 都为空时为英文.

```sh
jotl check home.jotl --lang en
JOTL_LANG=en jotl validate form.schema.json data.json
# home.jotl:2:9 JOTL1004 error: Unknown component `strng`
```

## 项目配置

编译 Jotl 输入的命令(`compile` `convert` `check` `validate` `defaults`)按 `jotl.config.json` 登记扩展组件, 格式见 `docs/spec/jotl.md` 的「扩展组件」; `format` 只排版, 不读配置.

- 从源文件所在目录向上查找最近的 `jotl.config.json`, 到含 `.git` 的目录或文件系统根为止; stdin 输入从当前目录开始. JSON Schema 与 TS 输入不读配置.
- `--config <file>` 直接使用该文件, 不查找; `--no-config` 不读取; 两者同用报用法错误 `JOTL9017`.
- 配置文件读不到报 `JOTL9050`, 不是合法 JSON 报 `JOTL9052`, 内容不合法报 `JOTL9056`(位置为配置文件中出错的键); 出错时不编译用到它的源文件, 同一配置文件在一次调用中只读一次, 只报一次.

## schema 输入

`convert` `check` `validate` `defaults` 的 schema 参数按扩展名判断格式: `.jotl` 为 Jotl 源码, `.json` 为 JSON Schema, `.ts` / `.d.ts` 为 TS 声明; `convert` 可用 `--from jotl|schema|ts` 指定. `check` `validate` `defaults` 的 schema 参数写 `-` 时从 stdin 读入, 按内容判断: 去掉 BOM 与空白后以 `{` 或 `[` 开头为 JSON Schema, 否则为 Jotl 源码. `convert` 的输入写 `-` 且不写 `--from` 时还识别 TS: 去掉开头的空白与注释后, 以 `export` `interface` `type` `declare` 等声明关键字后接名字开头为 TS 声明, 以 `<` 或大驼峰类型名开头(或为空)为 Jotl 源码, 都不是时报用法错误 `JOTL9016`, 需用 `--from` 指定.

JSON Schema 输入先升级到 2020-12(与 `migrate-schema --to schema` 相同, 但不输出变更清单). 没有 `$schema` 也无法按特征推断版本时按 2020-12 处理并报 `JOTL9053` 警告; OpenAPI 3.0 / Swagger 2.0 的 Schema Object 需要用 `--schema-version` 指定版本.

## 命令

完整选项以 `jotl <命令> --help` 为准.

### compile

```sh
jotl compile <file.jotl> [--to schema|ts] [--out <file>] [--typia-tags]
```

Jotl 编译为 JSON Schema 2020-12(默认)或 TS 声明; `--typia-tags` 只能与 `--to ts` 同用.

```sh
jotl compile home.jotl --out home.schema.json
jotl compile home.jotl --to ts --typia-tags --out home.d.ts
```

### convert

```sh
jotl convert <input> --to jotl|schema|ts [--from jotl|schema|ts] [--schema-version <版本>] [--out <file>] [--typia-tags]
```

在 Jotl, JSON Schema 与 TS 声明之间任意互转.

```sh
jotl convert legacy.json --to jotl --out legacy.jotl
jotl convert types.d.ts --to schema
jotl convert schema.txt --from jotl --to ts
```

### check

```sh
jotl check <file...> [--schema-version <版本>]
```

只报告诊断, 不输出结果: `.jotl` 报编译诊断; `.json` 报升级时的警告与错误, 以及升级后的 schema 能否用于校验; `.ts` / `.d.ts` 报转换诊断. 任一文件无法判断格式时不检查任何文件, 按用法错误退出.

```sh
jotl check schemas/*.jotl schemas/legacy.json
```

### validate

```sh
jotl validate <schema> <data...> [--schema-version <版本>]
```

按 schema 校验 JSON 数据文件. 每个文件一行结论写到 stdout(`文件: 通过` 或 `文件: 未通过`), 校验错误以 `数据文件#/数据指针` 的位置写到 stderr, 下一行缩进给出该值在数据文件中的 `文件:行:列 数据所在位置`(对象成员取键名位置, 指针不存在时取最近的上级); 任一文件未通过时退出码为 1.

```sh
jotl validate home.jotl data/home.json data/home-empty.json
```

### defaults

```sh
jotl defaults <schema> [--strategy explicit|required|all] [--schema-version <版本>] [--out <file>]
```

按 schema 生成默认数据并以 JSON 输出; 各策略产出什么见 `packages/data/README.zh-CN.md` 的「默认数据: getDefaults 与 fillDefaults」一节. schema 中没有可生成的默认数据时不输出, 报 `JOTL9054` 提示.

```sh
jotl defaults home.jotl --strategy required --out home.defaults.json
```

### migrate-schema

```sh
jotl migrate-schema <file> [--to jotl|schema] [--out <file>] [--schema-version <版本>]
                    [--accept-newer-keywords=true|false] [--on-conflict error|preferDeclared|preferLatest]
```

把凤蝶 schema 或旧版 JSON Schema 迁移为 Jotl(默认)或 JSON Schema 2020-12(`--to schema`). 输入类型自动判定, 判定结果与依据以 `JOTL9055` 提示写到 stderr:

| 判定 | 依据 | 处理 |
|---|---|---|
| 凤蝶源码 | 不以 `{` 或 `[` 开头(不是 JSON 文本) | 按 umo-edit-sdk 文法解析, 规则见 `@jotl/convert` 的 README |
| 凤蝶 toJson JSON(umo JSON) | 是 JSON 且任一字段带与属性名相同的 `key`, 类型为凤蝶类型(如 `image` `text` `richtext` `url` `color` `date` `enum` `box`), 或枚举成员为 `{label, value}` | 同上, 跳过解析 |
| 常规 JSON Schema | 其余 JSON(以 `{` 开头但语法错误时报 `JOTL9052`) | draft-04 至 2019-09, OpenAPI / Swagger 的 Schema Object 先升级到 2020-12 |

- `--schema-version` `--accept-newer-keywords` `--on-conflict` 只适用于常规 JSON Schema, 用于凤蝶输入时报用法错误 `JOTL9013`.
- `--on-conflict` 默认: 输出 Jotl 时为 `preferDeclared`(与 `convert` 一致), `--to schema` 时为 `error`. `--accept-newer-keywords` 默认 `true`.
- 常规 JSON Schema 且 `--to schema` 时, 变更清单(每处改写一条 info 级诊断)也写到 stderr.
- 凤蝶迁移中的不可转换项报警告, 不影响退出码.

```sh
jotl migrate-schema home.fengdie --out home.jotl
jotl migrate-schema legacy.json --to schema --out legacy.2020-12.json
jotl migrate-schema pet.json --to schema --schema-version openapi-3.0 --on-conflict preferLatest
```

### format

```sh
jotl format <file.jotl> [--write]
```

格式化 Jotl 源码并保留注释; `--write` 写回原文件(内容不变时不写, 原文开头的 BOM 保留; 输入为 `-` 时不能使用). 源码有语法错误时不输出也不写回.

```sh
jotl format home.jotl --write
```

## 在代码中调用

`run(argv, io, options?)` 执行一次调用并返回退出码, 不调用 `process.exit`; 输出语言取 `--lang`, 其次 `options.env`(环境变量, 按「输出语言」解析, 另导出 `localeFromEnv(env)`), 不给 `env` 时沿用 `@jotl/core` 当前的全局语言; 调用期间写入全局语言, 结束后恢复为调用前的值; `io` 为 `CliIo`, 用 `createNodeIo()` 取 Node 进程的实现, 测试时可注入内存实现; 查找 `jotl.config.json` 经 `CliIo.exists` 判断文件与 `.git` 是否存在.

```ts
import { createNodeIo, run } from "jotl";

process.exitCode = run(["check", "home.jotl"], createNodeIo(), { env: process.env });
```
