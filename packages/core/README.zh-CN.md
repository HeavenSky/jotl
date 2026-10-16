# @jotl/core

[English](./README.md) · **简体中文**

在调用任一 Jotl 包时需要理解其 `Result` 与诊断结构, 处理 JSON Pointer 或源码映射, 为新包定义诊断代码表, 或在代码中解析, 编译, 格式化 Jotl 源码, 把 JSON Schema 打印为 Jotl 时读本页; 对应 `packages/core`.

`@jotl/core` 由两部分组成, 经唯一入口 `@jotl/core` 合并导出:

- `src/schema/`: 各包共用的契约层: JSON Schema 2020-12 与 `x-ui` 的类型, 诊断与 `Result`, 源码位置, JSON Pointer 工具, 以及 `@jotl/data` 实现的数据能力接口类型. 这部分没有运行时依赖.
- `src/syntax/`: 把 Jotl 源码编译为规范化的 JSON Schema 2020-12 并附带源码映射, 也能把 2020-12 schema 反向打印为 Jotl. 语法与编译规则以 `docs/spec/jotl.md` 为准, `x-ui` 的取值语义见 `docs/spec/x-ui.md`.

## 安装

```sh
pnpm add @jotl/core
```

## 最小示例

契约层: JSON Pointer 与诊断.

```ts
import { appendPointer, defineDiagnostics, evaluatePointer, fillWildcards, hasErrors, matchPointer } from "@jotl/core";

const doc = { list: [{ "a/b": 1 }] };
evaluatePointer(doc, "/list/0/a~1b"); // { value: 1, diagnostics: [] }
evaluatePointer(doc, "/list/1"); // value 为 undefined, diagnostics 含 JOTL0002 error

appendPointer("/list", 0, "a/b"); // "/list/0/a~1b"
matchPointer("/list/*/x", "/list/3/x"); // true
fillWildcards("/list/*/x", [2]); // "/list/2/x"

const diagnostic = defineDiagnostics({ JOTL9999: { severity: "warning", message: "字段 {name} 已弃用" } });
const d = diagnostic("JOTL9999", { name: "title" }); // { code, severity: "warning", message: "字段 title 已弃用" }
hasErrors([d]); // false
```

语法: 编译与打印.

```ts
import { compile, print } from "@jotl/core";

const result = compile(
  `Home(首页): {
  title(标题): string[maxLength: 20, default: '欢迎']
  mode(模式)?: enum[default: 'light']{ light(浅色) dark(深色) }
}`,
  "home.jotl",
);
// result.value.schema:
// { $schema: "https://json-schema.org/draft/2020-12/schema", $ref: "#/$defs/Home", "x-ui": { version: 1 },
//   $defs: { Home: { title: "首页", type: "object", properties: { title: { ..., maxLength: 20 }, mode: { oneOf: [...] } }, required: ["title"] } } }
// result.value.sourceMap.get("/$defs/Home/properties/title"): 第 2 行条目的 range, keyRange 指向键 `title`

const back = print(result.value!.schema);
// back.value 为规范形 Jotl 源码; 再经 compile 得到与输入深度相等的 schema
```

`compile("A: strng", "a.jotl")` 返回 `value: undefined` 与一条 `JOTL1004` error, 位置为第 1 行第 4 列.

语言与扩展组件模块: 根条目的元数据 `widgets` 为本文件登记扩展组件, 其中的模块声明编译进根 `x-ui.widgets`.

```ts
import { compile, setLocale } from "@jotl/core";

setLocale("en"); // 此后创建的诊断为英文(也是默认); 中文用 setLocale("zh-CN")

const result = compile(
  `Form: [widgets: {ImagePicker: {base: 'url', module: 'https://esm.sh/image-picker'}}] {
  cover(封面): ImagePicker
}`,
  "form.jotl",
);
// result.value.schema["x-ui"]: { version: 1, widgets: { ImagePicker: { module: "https://esm.sh/image-picker" } } }
// result.value.schema.$defs.Form.properties.cover: { title: "封面", type: "string", format: "uri", "x-ui": { widget: "ImagePicker" } }
```

## Result 与诊断

各包的公开函数统一返回 `Result<T>`: `{ value, diagnostics }`, 不抛异常:

- `value` 为结果; 存在 `error` 级诊断时可以为 `undefined`, 调用方先看 `value` 再看 `hasErrors(diagnostics)`.
- `Diagnostic` 含 `code`(`JOTL` 加四位数字), `severity`(`"error"` `"warning"` `"info"`), `message`(语言取创建诊断时的 `getLocale()`, 默认 `en`), 可选的 `location` `related` `fixes`.
- `location` 有两种: `{ kind: "source", range }` 指向源码, `{ kind: "pointer", pointer, document? }` 指向 schema 或数据中的 JSON Pointer.
- 源码位置的 `line` `column` 从 1 起, `offset` 从 0 起, 列与偏移按 UTF-16 代码单元计(与 LSP 一致).
- `SourceMap` 以 schema 文档内的指针为键, 值为 `SourceSpan`(`range` 为整个字段或声明, `keyRange` 为键名).

## 公开 API

完整导出见 `packages/core/src/index.ts`(合并 `src/schema/index.ts` 与 `src/syntax/index.ts`); 下表只列需要说明行为的导出.

### 契约(`src/schema/`)

| 导出 | 作用 |
|---|---|
| `ok(value, diagnostics?)` `fail(diagnostics)` `hasErrors(diagnostics)` | 构造 `Result`; `hasErrors` 只看 `error` 级 |
| `defineDiagnostics(table)` | 由代码表生成诊断工厂 `(code, params?, extras?) => Diagnostic`; 消息模板中的 `{name}` 由 `params` 替换, `extras.severity` 覆盖表中级别; 代码不在表中时抛错. 表项的 `message` 为中文模板, 可选的 `en` 为英文模板; 语言为 `en` 时取 `en`, 缺省时回落到 `message` |
| `formatMessage(template, params)` | 只做模板替换; 缺失的参数保留原样 |
| `Locale` `DEFAULT_LOCALE` `getLocale()` `setLocale(locale)` `resolveLocale(tag)` `l10n(zh, en, locale?)` | 面向使用者文案的全局语言, `"zh-CN" \| "en"`, 默认 `en`; 各包创建诊断与生成文字时读取它. `resolveLocale` 把 BCP 47 标签或 POSIX 语言环境(如 `zh_CN.UTF-8`)归到支持的语言: 以 `zh` 开头为中文, 其余为英文, 空值取默认; `l10n` 二选一取文案, 不传 `locale` 时取全局语言 |
| `parsePointer` `evaluatePointer` | 解析与求值, 返回 `Result`; 非法指针报 `JOTL0001`, 位置不存在报 `JOTL0002` |
| `tryParsePointer` `isPointer` `lookupPointer` | 不产生诊断的版本; `lookupPointer` 返回 `{ found, value }`, 数组片段只接受规范的十进制下标, 对象只查自有属性 |
| `formatPointer(tokens)` `appendPointer(base, ...tokens)` | 由未转义的片段拼接指针 |
| `joinPointer(base, relative)` | 拼接已转义的相对路径(如 `"0/img"`), 空串返回 `base` |
| `parentPointer` `lastPointerToken` `escapePointerToken` `unescapePointerToken` | 取父指针, 末片段与转义 |
| `matchPointer(pattern, pointer)` `fillWildcards(template, indexes)` `POINTER_WILDCARD` | `"*"` 片段匹配任意单个片段, 片段数必须相同; `fillWildcards` 依次把 `"*"` 替换为下标, 下标不足时保留剩余的 `"*"` |
| `JsonSchema` `JsonSchemaObject` `JsonValue` `isSchemaObject` | 2020-12 文档类型; `JsonSchema` 含布尔 schema |
| `JSON_SCHEMA_DIALECT` | `https://json-schema.org/draft/2020-12/schema` |
| `orderKeywords(schema)` | 按 `docs/spec/jotl.md` 规范化规则 7 重排关键字并递归子 schema, 返回新对象 |
| `SUBSCHEMA_KEYWORDS` | 子 schema 所在关键字, 分 `single` `array` `map` 三类, 供遍历 |
| `packages/core/src/schema/x-ui.ts` 的导出(`XUi` 及其子类型, `XUiWidgetModule`, `DEFAULT_SCENE` `DEFAULT_GRID_COLUMNS`) | `x-ui` 关键字的类型与默认值, 语义见 `docs/spec/x-ui.md` |
| `xUiMetaSchema` | `x-ui` 的 meta-schema(2020-12), 禁止未知字段; 供校验与编辑器补全 |
| `DEFAULT_VALUE_FORMATS` `VALUE_FORMAT_ALIASES` `TIMESTAMP_VALUE_FORMATS` `isValueFormatAlias` `isTimestampValueFormat` `valueFormatComponent` `TemporalComponent` | 日期组件存储格式 `x-valueFormat` 的公共规则: 各组件默认格式(`date` `YYYY-MM-DD`, `time` `HH:mm:ss`, `datetime` `iso`), 别名 `iso` `iso-x` `utc` `utc-x`, 时间戳 `x` `X`; 无 `x-ui.widget` 时按格式内容推断组件(时间戳与别名, 或同时含日期与时间记号为 `datetime`, 只含时间为 `time`, 其余为 `date`) |
| `matchesValueFormat(format, value)` `matchesValueFormatText(format, text)` `isRfc3339DateTime(text)` | 不依赖 dayjs 的取值校验, 结论与 `@jotl/data` 一致: 时间戳只验整数, 别名按 RFC 3339, 格式串严格逐位匹配并校验日历日期; 只支持 `YYYY MM DD HH mm ss SSS Z ZZ A a` 与 `[..]` 转义, 含其他记号时 `matchesValueFormatText` 返回 `undefined`, `matchesValueFormat` 返回 `true`(不判定) |
| `DataApi` `GetDefaults` `FillDefaults` `Validate` `Migrate` `Mock` `DefaultsOptions` `MockOptions` `DEFAULT_DEFAULTS_OPTIONS` | 数据能力接口的类型, 实现与行为口径见 `@jotl/data` 的 README |

### 语法(`src/syntax/`)

`parse`, `compile` 与 `format` 的诊断按源码位置排序. 参数 `file` 只写入诊断与源码映射的位置, 不读文件.

| 函数 | 作用 | 出错时 |
|---|---|---|
| `compile(text, file, options?)` | 解析, 语义检查并编译, 返回 `CompileOutput`: `schema`(规范化的 2020-12 文档), `sourceMap`(schema 指针 → 源码位置; 字段与 `$defs` 条目另有指向键的 `keyRange`), `ast`, `defaultExport`(默认导出的类型名, 不进 schema; 生成 TS 时传给 `@jotl/convert` 的 `schemaToTs(schema, { defaultExport })`) | 有 error 级诊断时 `value` 为 `undefined`; warning 不影响 |
| `parse(text, file)` | 只做词法与语法分析, 返回 AST(`JotlFile`) | 有语法错误时仍返回尽力恢复出的 AST |
| `print(schema, options?)` | 把 JSON Schema 2020-12 打印为 Jotl 规范形源码 | 输入含非 JSON 值(`JOTL1031`), 不是对象或布尔值(`JOTL1030`), `rootName` 不合法(`JOTL1035`)时 `value` 为 `undefined`; 无法表达的内容报 warning 后照常输出 |
| `format(text, file)` | 按规范排版重写源码, 保留全部注释, 不改变编译结果 | 有语法错误时 `value` 为原样源码, 并附带语法诊断 |

- `compile` 的选项只有 `widgets`: 已登记的扩展组件(组件名 → 底层 schema), 由调用方传入, 本包不读任何配置文件; 不传时组件位置的大驼峰名只能是本文件声明的类型或根条目元数据 `widgets` 声明的扩展组件.
- 根条目元数据 `widgets`(如 `Form: [widgets: {ImagePicker: {base: 'url', module: 'https://esm.sh/image-picker'}}] {...}`)为本文件登记扩展组件, 与 `options.widgets` 合并, 同名时以文件内为准; 取值与 `jotl.config.json` 写法相同: 底层类型, 或模块声明 `{ base?, module, export? }`(`base` 缺省 `object`, `export` 缺省 `default`); 模块声明编译进根 `x-ui.widgets`(名字 → `{ base?, module, export? }`, 类型 `XUiWidgetModule`; 只在声明了 `object` 以外的 `base` 时带上). 类型名与其重名报 `JOTL1028`, 取值不合法报 `JOTL1020`. `print` 把根 `x-ui.widgets` 写回根条目的 `widgets`.
- 经元数据 `schema` 写入的 `x-ui` 不符合 `x-ui` meta-schema 或含根专属字段 `version` `rules` `widgets` 时报 `JOTL1050` warning, 原样写入.
- 项目配置 `jotl.config.json`(格式见 `docs/spec/jotl.md` 的「扩展组件」)的内容处理也在本包, 文件查找由调用方做: `readJotlConfig(value)` 校验已解析的 JSON 并把底层类型换算为 schema, 返回 `{ config: { widgets, modules }, issues }`(`widgets` 为名字 → 底层 schema; `modules` 为写成模块声明的项的名字 → `{ module, export? }`, 如 `{ "ImagePicker": { "base": "url", "module": "./widgets/image-picker.js" } }`, `module` 原样保留, 相对路径由调用方按配置文件所在目录解析; 配置中的模块声明不写进编译产物, 由使用方按 `config.modules` 加载)(`issues` 为 `{ pointer, message }`, 出错的项跳过, 其余照常返回); `configCompileOptions(widgets)` 只取大驼峰名作为 `compile` 的 `options.widgets`; `createJotlConfigJsonSchema()` 返回配置文件自身的 JSON Schema(`$id` 为 `JOTL_CONFIG_SCHEMA_ID`), 供编辑器校验; 文件名常量为 `JOTL_CONFIG_FILE`.
- `locateJsonError(text)` 返回第一个 JSON 语法错误的 `{ offset, found }`(文本提前结束时 `found` 为 `undefined`), 合法 JSON 返回 `undefined`; `jsonPointerOffsets(text)` 返回合法 JSON 中每个值的指针 → 文本偏移(对象成员取键名起点), 不合法时返回 `undefined`. 供 `jotl.config.json` 等 JSON 输入的诊断换算行列; 不依赖 Node API, 可在浏览器运行.
- `print` 的选项 `rootName`: 根不是指向 `$defs` 条目的 `$ref` 时, 为根生成的类型名, 默认 `Root`, 须为大驼峰.
- `print` 的选项 `defaultExport`: 默认导出的类型名(`$defs` 的键, 取 `compile` 结果或 `@jotl/convert/from-ts` 的 `tsToSchema` 结果的 `defaultExport`); 与根不同时该条目标 `<default/>`, 根条目同时标 `<root/>`, 编译回来的 `defaultExport` 与之一致; 与根相同时不写标识; 不是 `$defs` 的键时不写标识并报 `JOTL1051` warning.
- `date` `time` `datetime` 的元数据 `value_format`(存储格式)编译为 `x-valueFormat`: `date` 默认 `YYYY-MM-DD` 为 `format: date`; `datetime` 取别名 `iso`(默认) `iso-x` `utc` `utc-x` 时为 `format: date-time`, 非 `iso` 另写 `x-valueFormat`; `x` `X` 为 `{type: integer, x-valueFormat}`; 其余(含 `time` 默认 `HH:mm:ss`)为 `{type: string, x-valueFormat}`; 后两种总写 `x-ui.widget` 为组件名. `time` 用 `x` `X` 报 `JOTL1020`. `print` 反向还原; `format: time` 不对应任何组件, 打印为 `string[format: 'time']`.
- `print` 中根为指向 `$defs` 条目的 `$ref` 时, 该条目为根(不是第一条时标 `<root/>`), 根 `$id` 与 `x-ui.rules` 写为它的 `id` `rules`; 不能用作类型名的 `$defs` 键改为大驼峰并报 `JOTL1034`; 结构无法用组件还原的节点整体写成 `any[schema: {...}]`, 其余无法表达的关键字归入 `schema: {...}`.
- 另导出 AST 类型(`src/syntax/ast.ts`), 内置组件名, 元数据键白名单与适用组件, `value_format` 编译规则 `valueFormatSchema`(`src/syntax/builtins.ts`), 以及按数据形态判定 widget 的 `defaultWidget` `acceptsWidget` 与内置 widget 名集合 `BUILTIN_WIDGETS`(`src/syntax/shapes.ts`), 供语言服务等工具做补全与悬停; 表的内容以源码为准.
- `BUILTIN_WIDGETS` 与 `@jotl/form/core` 的同名导出不同: 本包的是名字集合(`ReadonlySet<string>`), 只用于编译期检查; `@jotl/form/core` 的是名字 → 层级与优先级的表, 供渲染器使用. 两者在同一文件中导入时需改名.

## 诊断代码段

每个包(或包内模块)在自己的 `diagnostics.ts` 中用 `defineDiagnostics` 定义代码表, 消息(中文 `message`, 英文 `en`)只在代码表中书写; 代码一旦发布不复用.

| 代码段 | 所属包 | 代码表 |
|---|---|---|
| `JOTL0xxx` | `@jotl/core`(契约) | `packages/core/src/schema/diagnostics.ts` 的 `SCHEMA_DIAGNOSTICS` |
| `JOTL1xxx` | `@jotl/core`(语法) | `packages/core/src/syntax/diagnostics.ts` 的 `SYNTAX_DIAGNOSTICS` |
| `JOTL2xxx` | `@jotl/convert`(TS 互转) | `packages/convert/src/ts/diagnostics.ts` |
| `JOTL3xxx` | `@jotl/convert`(版本升级) | `packages/convert/src/migrate/upgrade/diagnostics.ts` |
| `JOTL4xxx` | `@jotl/data` | `packages/data/src/diagnostics.ts` |
| `JOTL5xxx` | `@jotl/form/core` | `packages/form/src/core/diagnostics.ts` |
| `JOTL6xxx` | `@jotl/form`(React 渲染器) | `packages/form/src/react/diagnostics.ts` |
| `JOTL7xxx` | `@jotl/language-server` | `packages/language-server/src/diagnostics.ts` |
| `JOTL8xxx` | `@jotl/convert`(凤蝶迁移) | `packages/convert/src/migrate/fengdie/diagnostics.ts` |
| `JOTL9xxx` | `jotl` 命令行 | `packages/cli/src/diagnostics.ts` |

语法部分的诊断位置为源码位置(`location.kind === "source"`), 行列从 1 起, 列按 UTF-16 代码单元计; `print` 的诊断位置为输入 schema 的 JSON Pointer.

## 已知限制

见根目录 `TODO.md` 的 "确定不修".
