// jotl 命令行面向使用者的文案(中英双语): 帮助文本, 诊断级别标签与结果行; 按 getLocale() 取当前语言.
import { type Locale, type Severity, getLocale } from "@jotl/core";

export const COMMAND_NAMES = [
	"compile",
	"convert",
	"check",
	"validate",
	"defaults",
	"migrate-schema",
	"format",
] as const;

export type CommandName = (typeof COMMAND_NAMES)[number];

/** --lang 归一后的取值, 用于用法错误中列出可选项. */
export const LOCALES: readonly Locale[] = ["zh-CN", "en"];

const SEVERITY_LABELS: Readonly<Record<Locale, Readonly<Record<Severity, string>>>> = {
	"zh-CN": { error: "错误", warning: "警告", info: "提示" },
	en: { error: "error", warning: "warning", info: "info" },
};

export function severityLabel(severity: Severity): string {
	return SEVERITY_LABELS[getLocale()][severity];
}

export interface CliText {
	usageHint: string;
	globalUsageHint: string;
	validatePassed: string;
	validateFailed: string;
	jsonUnexpectedChar: string;
	jsonUnexpectedEnd: string;
	dataLocation: string;
	internalErrorHint: string;
	fsReasons: Readonly<Record<string, string>>;
	fsUnknownReason: string;
	migrateInputKinds: Readonly<Record<"fengdie" | "fengdie-json" | "json-schema", string>>;
}

const TEXT: Readonly<Record<Locale, CliText>> = {
	"zh-CN": {
		usageHint: "运行 `jotl {command} --help` 查看用法",
		globalUsageHint: "运行 `jotl --help` 查看用法",
		validatePassed: "{file}: 通过",
		validateFailed: "{file}: 未通过",
		jsonUnexpectedChar: "意外的字符 `{char}`",
		jsonUnexpectedEnd: "意外的文件结尾",
		dataLocation: "数据所在位置",
		internalErrorHint: "这是 jotl 的缺陷, 请附上以上输出报告问题",
		fsReasons: {
			ENOENT: "文件不存在",
			EISDIR: "这是一个目录",
			ENOTDIR: "路径中的某一级不是目录",
			EACCES: "没有权限",
			EPERM: "没有权限",
			EEXIST: "文件已存在",
			ENOSPC: "磁盘空间不足",
			EROFS: "文件系统只读",
		},
		fsUnknownReason: "系统错误 {code}",
		migrateInputKinds: {
			fengdie: "凤蝶源码",
			"fengdie-json": "凤蝶 toJson JSON(umo JSON)",
			"json-schema": "常规 JSON Schema",
		},
	},
	en: {
		usageHint: "Run `jotl {command} --help` for usage",
		globalUsageHint: "Run `jotl --help` for usage",
		validatePassed: "{file}: passed",
		validateFailed: "{file}: failed",
		jsonUnexpectedChar: "unexpected character `{char}`",
		jsonUnexpectedEnd: "unexpected end of file",
		dataLocation: "location in the data file",
		internalErrorHint: "This is a bug in jotl; please report it with the output above",
		fsReasons: {
			ENOENT: "file not found",
			EISDIR: "is a directory",
			ENOTDIR: "a component of the path is not a directory",
			EACCES: "permission denied",
			EPERM: "permission denied",
			EEXIST: "file already exists",
			ENOSPC: "no space left on device",
			EROFS: "read-only file system",
		},
		fsUnknownReason: "system error {code}",
		migrateInputKinds: {
			fengdie: "Fengdie source",
			"fengdie-json": "Fengdie toJson JSON (umo JSON)",
			"json-schema": "plain JSON Schema",
		},
	},
};

export function cliText(): CliText {
	return TEXT[getLocale()];
}

const GLOBAL_HELP: Readonly<Record<Locale, string>> = {
	"zh-CN": `jotl {version}: Jotl 命令行工具

用法: jotl <命令> [选项]

命令:
  compile <file.jotl>          Jotl 编译为 JSON Schema(默认)或 TS
  convert <input>              在 Jotl, JSON Schema 与 TS 之间互转
  check <file...>              只报告诊断, 不输出结果
  validate <schema> <data...>  按 schema 校验 JSON 数据文件
  defaults <schema>            按 schema 输出默认数据
  migrate-schema <file>        凤蝶 schema 或旧版 JSON Schema / OpenAPI Schema 迁移为 Jotl 或 2020-12
  format <file.jotl>           格式化 Jotl 源码

全局选项:
  -h, --help         显示帮助; 写在命令后显示该命令的帮助
  -v, --version      显示版本号
  --lang <zh|en>     输出语言, 可写在任意位置, 也接受 zh-CN, zh_CN, en-US 等地区写法; 不写时依次取环境变量 JOTL_LANG, LC_ALL, LC_MESSAGES, LANG 中第一个非空值,
                     以 zh 开头为中文, 其余(含 C 与 POSIX)为英文, 都为空时为英文

读取文件的参数可写 \`-\` 从 stdin 读入; 同一命令中只能有一个参数写 \`-\`.
check, defaults, validate 的 schema 从 stdin 读入时按内容判断格式: 以左花括号或左方括号开头为 JSON Schema, 否则为 Jotl.
convert 从 stdin 读入且不写 --from 时还识别 TS: 去掉开头注释后以 export, interface, type 等声明关键字开头为 TS, 以 < 或大驼峰类型名开头为 Jotl, 都不是时要求 --from.
诊断输出到 stderr, 格式为 \`文件:行:列 代码 级别: 消息\`, 无源码位置时为 \`文件#/JSON Pointer 代码 级别: 消息\`.
编译 Jotl 输入的命令(compile, convert, check, validate, defaults)从源文件所在目录向上查找最近的 jotl.config.json(stdin 输入从当前目录开始),
到 git 顶层或文件系统根为止, 按其中的 widgets 登记扩展组件; --config <file> 指定配置文件, --no-config 不读取.
退出码: 0 成功(警告不影响), 1 有错误级诊断, 2 用法错误.
`,
	en: `jotl {version}: the Jotl command-line tool

Usage: jotl <command> [options]

Commands:
  compile <file.jotl>          Compile Jotl to JSON Schema (default) or TS
  convert <input>              Convert between Jotl, JSON Schema and TS
  check <file...>              Report diagnostics only, without output
  validate <schema> <data...>  Validate JSON data files against a schema
  defaults <schema>            Output default data for a schema
  migrate-schema <file>        Migrate Fengdie schemas or legacy JSON Schema / OpenAPI Schema to Jotl or 2020-12
  format <file.jotl>           Format Jotl source

Global options:
  -h, --help         Show help; after a command, show the help for that command
  -v, --version      Show the version number
  --lang <zh|en>     Output language, accepted anywhere, also in regional forms such as zh-CN, zh_CN, en-US; when omitted, the first non-empty value of the environment variables
                     JOTL_LANG, LC_ALL, LC_MESSAGES, LANG is used: values starting with zh select Chinese, anything else
                     (including C and POSIX) selects English, and English is used when all are empty

Arguments that read a file accept \`-\` to read from stdin; at most one argument per command may be \`-\`.
When check, defaults or validate read the schema from stdin, the format is detected by content: JSON Schema if it starts with an opening brace or bracket, otherwise Jotl.
When convert reads from stdin without --from, TS is also detected: after leading comments, a declaration keyword such as export, interface or type means TS,
\`<\` or an UpperCamelCase type name means Jotl; otherwise --from is required.
Diagnostics are written to stderr as \`file:line:column code severity: message\`, or \`file#/JSON Pointer code severity: message\` without a source position.
Commands that compile Jotl input (compile, convert, check, validate, defaults) look for the nearest jotl.config.json upward from the source file's directory
(the current directory for stdin input), stopping at the git top level or the file system root, and register extension widgets from its widgets;
--config <file> selects a config file, --no-config disables it.
Exit codes: 0 success (warnings do not count), 1 error diagnostics, 2 usage error.
`,
};

export function globalHelp(): string {
	return GLOBAL_HELP[getLocale()];
}

const SCHEMA_INPUT_NOTE_ZH = `schema 输入按扩展名判断格式: .jotl 为 Jotl, .json 为 JSON Schema, .ts / .d.ts 为 TS 声明;
写 \`-\` 时从 stdin 读入, 按内容判断: 去掉空白后以左花括号或左方括号开头为 JSON Schema, 否则为 Jotl.
JSON Schema 输入先升级到 2020-12; 未声明 $schema 且无法推断版本时按 2020-12 处理.`;

const SCHEMA_INPUT_NOTE_EN = `The schema input format is detected by extension: .jotl is Jotl, .json is JSON Schema, .ts / .d.ts is TS declarations;
\`-\` reads from stdin and detects by content: JSON Schema if the first non-blank character is an opening brace or bracket, otherwise Jotl.
JSON Schema input is upgraded to 2020-12 first; without $schema and when the version cannot be inferred, it is treated as 2020-12.`;

const COMMAND_HELP_ZH: Readonly<Record<CommandName, string>> = {
	compile: `用法: jotl compile <file.jotl> [--to schema|ts] [--out <file>] [--typia-tags] [--config <file> | --no-config]

把 Jotl 源码编译为 JSON Schema 2020-12(默认)或 TS 声明.

选项:
  --to <schema|ts>  输出格式, 默认 schema
  --out <file>      写入文件而不是 stdout; 不能与输入文件相同
  --typia-tags      TS 输出使用 typia 类型标签; 只能与 --to ts 一起使用
  --config <file>   使用指定的配置文件, 不查找 jotl.config.json
  --no-config       不读取 jotl.config.json
  -h, --help        显示本帮助

示例:
  jotl compile home.jotl --out home.schema.json
  jotl compile home.jotl --to ts --typia-tags
`,
	convert: `用法: jotl convert <input> --to jotl|schema|ts [--from jotl|schema|ts] [--on-conflict <策略>] [--out <file>] [--typia-tags]
                         [--config <file> | --no-config]

在 Jotl, JSON Schema 与 TS 声明之间互转.
${SCHEMA_INPUT_NOTE_ZH}

选项:
  --to <jotl|schema|ts>    输出格式, 必填
  --from <jotl|schema|ts>  输入格式; 不写时按扩展名判断, 输入为 - 时按内容判断(JSON Schema, TS 或 Jotl), 判断不出时报错
  --schema-version <版本>  JSON Schema 输入未声明 $schema 时采用的版本
  --on-conflict <策略>     升级时新旧语义冲突的处理: preferDeclared 按声明版本(默认), preferLatest 按 2020-12, error 报错
  --out <file>             写入文件而不是 stdout; 不能与输入文件相同
  --typia-tags             TS 输出使用 typia 类型标签; 只能与 --to ts 一起使用
  --config <file>          使用指定的配置文件, 不查找 jotl.config.json
  --no-config              不读取 jotl.config.json
  -h, --help               显示本帮助

示例:
  jotl convert legacy.json --to jotl --out legacy.jotl
  jotl convert types.d.ts --to schema
  cat types.d.ts | jotl convert - --to jotl
`,
	check: `用法: jotl check <file...> [--schema-version <版本>] [--config <file> | --no-config]

只报告诊断, 不输出结果: .jotl 报告编译诊断; .json 报告升级到 2020-12 时的警告与错误, 以及 schema 能否用于校验; .ts / .d.ts 报告转换诊断.
文件写 \`-\` 时从 stdin 读入, 按内容判断格式: 去掉空白后以左花括号或左方括号开头为 JSON Schema, 否则为 Jotl; \`-\` 只能出现一次.

选项:
  --schema-version <版本>  JSON Schema 输入未声明 $schema 时采用的版本
  --config <file>          使用指定的配置文件, 不查找 jotl.config.json
  --no-config              不读取 jotl.config.json
  -h, --help               显示本帮助

示例:
  jotl check src/*.jotl schemas/legacy.json
`,
	validate: `用法: jotl validate <schema> <data...> [--schema-version <版本>] [--config <file> | --no-config]

按 schema 校验一个或多个 JSON 数据文件; 每个文件的结论输出到 stdout, 校验错误输出到 stderr,
位置为 \`数据文件#/数据指针\`, 下一行缩进给出数据文件中的 \`文件:行:列\`.
schema 与数据文件中只能有一个写 \`-\`(stdin).
${SCHEMA_INPUT_NOTE_ZH}

选项:
  --schema-version <版本>  JSON Schema 输入未声明 $schema 时采用的版本
  --config <file>          使用指定的配置文件, 不查找 jotl.config.json
  --no-config              不读取 jotl.config.json
  -h, --help               显示本帮助

示例:
  jotl validate home.jotl data/home.json data/home-empty.json
`,
	defaults: `用法: jotl defaults <schema> [--strategy explicit|required|all] [--out <file>] [--config <file> | --no-config]

按 schema 生成默认数据, 以 JSON 输出.
${SCHEMA_INPUT_NOTE_ZH}

选项:
  --strategy <explicit|required|all>  explicit 只取显式默认值(默认); required 另为必填字段补零值; all 为全部字段补零值
  --schema-version <版本>             JSON Schema 输入未声明 $schema 时采用的版本
  --out <file>                        写入文件而不是 stdout; 不能与输入文件相同
  --config <file>                     使用指定的配置文件, 不查找 jotl.config.json
  --no-config                         不读取 jotl.config.json
  -h, --help                          显示本帮助

示例:
  jotl defaults home.jotl --strategy required
`,
	"migrate-schema": `用法: jotl migrate-schema <file> [--to jotl|schema] [--out <file>] [--schema-version <版本>]
                           [--accept-newer-keywords=true|false] [--on-conflict error|preferDeclared|preferLatest]

把凤蝶 schema 或旧版 JSON Schema 迁移为 Jotl(默认)或 JSON Schema 2020-12.
输入类型自动判定, 判定结果以提示输出到 stderr:
  1. 不以左花括号或左方括号开头(不是 JSON 文本): 凤蝶源码(umo-edit-sdk 文法)
  2. 是 JSON 且带 umo JSON 特征: 凤蝶 toJson 产出的 umo JSON; 特征为任一字段带与属性名相同的 \`key\`,
     类型为凤蝶类型(如 image text richtext url color date enum box), 或枚举成员为带 label 与 value 的对象
  3. 其余 JSON: 常规 JSON Schema(draft-04 / 06 / 07 / 2019-09, OpenAPI 3.0 / 3.1, Swagger 2.0), 先升级到 2020-12
凤蝶迁移中不可转换的信息保留在 x-fengdie 中并报警告.

选项:
  --to <jotl|schema>                     输出格式, 默认 jotl; schema 输出 2020-12 JSON
  --schema-version <版本>                未声明 $schema 时采用的版本: {versions}
  --accept-newer-keywords=<true|false>   声明版本中不存在的高版本关键字是否按 2020-12 语义接受, 默认 true
  --on-conflict <策略>                   新旧语义冲突时: error 报错, preferDeclared 按声明版本, preferLatest 按 2020-12;
                                         默认 --to jotl 时为 preferDeclared, --to schema 时为 error
  --out <file>                           写入文件而不是 stdout; 不能与输入文件相同
  -h, --help                             显示本帮助

--schema-version, --accept-newer-keywords, --on-conflict 只适用于常规 JSON Schema 输入, 用于凤蝶输入时报用法错误.
--to schema 且输入为常规 JSON Schema 时, 变更清单(每处改写一条提示)也输出到 stderr.

示例:
  jotl migrate-schema home.fengdie --out home.jotl
  jotl migrate-schema home.umo.json --to schema
  jotl migrate-schema legacy.json --to schema --out legacy.2020-12.json
  jotl migrate-schema petstore-pet.json --schema-version openapi-3.0 --on-conflict preferLatest
`,
	format: `用法: jotl format <file.jotl> [--write]

格式化 Jotl 源码, 保留注释; 源码有语法错误时不输出.

选项:
  --write     写回原文件而不是输出到 stdout; 内容不变时不写, 保留原有的 BOM; 不能与 \`-\`(stdin)一起使用
  -h, --help  显示本帮助

示例:
  jotl format home.jotl --write
`,
};

const COMMAND_HELP_EN: Readonly<Record<CommandName, string>> = {
	compile: `Usage: jotl compile <file.jotl> [--to schema|ts] [--out <file>] [--typia-tags] [--config <file> | --no-config]

Compile Jotl source to JSON Schema 2020-12 (default) or TS declarations.

Options:
  --to <schema|ts>  Output format, default schema
  --out <file>      Write to a file instead of stdout; must differ from the input file
  --typia-tags      Use typia type tags in TS output; only with --to ts
  --config <file>   Use the given config file instead of looking for jotl.config.json
  --no-config       Do not read jotl.config.json
  -h, --help        Show this help

Examples:
  jotl compile home.jotl --out home.schema.json
  jotl compile home.jotl --to ts --typia-tags
`,
	convert: `Usage: jotl convert <input> --to jotl|schema|ts [--from jotl|schema|ts] [--on-conflict <policy>] [--out <file>] [--typia-tags]
                          [--config <file> | --no-config]

Convert between Jotl, JSON Schema and TS declarations.
${SCHEMA_INPUT_NOTE_EN}

Options:
  --to <jotl|schema|ts>       Output format, required
  --from <jotl|schema|ts>     Input format; detected by extension when omitted, or by content (JSON Schema, TS or Jotl)
                              when the input is -, with an error when it cannot be detected
  --schema-version <version>  Version for JSON Schema input that does not declare $schema
  --on-conflict <policy>      How to resolve old/new semantic conflicts when upgrading: preferDeclared follows the declared
                              version (default), preferLatest follows 2020-12, error reports an error
  --out <file>                Write to a file instead of stdout; must differ from the input file
  --typia-tags                Use typia type tags in TS output; only with --to ts
  --config <file>             Use the given config file instead of looking for jotl.config.json
  --no-config                 Do not read jotl.config.json
  -h, --help                  Show this help

Examples:
  jotl convert legacy.json --to jotl --out legacy.jotl
  jotl convert types.d.ts --to schema
  cat types.d.ts | jotl convert - --to jotl
`,
	check: `Usage: jotl check <file...> [--schema-version <version>] [--config <file> | --no-config]

Report diagnostics only, without output: .jotl reports compile diagnostics; .json reports warnings and errors from upgrading
to 2020-12 and whether the schema can be used for validation; .ts / .d.ts reports conversion diagnostics.
A file written as \`-\` is read from stdin and detected by content: JSON Schema if the first non-blank character is an opening brace or bracket,
otherwise Jotl; \`-\` may appear only once.

Options:
  --schema-version <version>  Version for JSON Schema input that does not declare $schema
  --config <file>             Use the given config file instead of looking for jotl.config.json
  --no-config                 Do not read jotl.config.json
  -h, --help                  Show this help

Examples:
  jotl check src/*.jotl schemas/legacy.json
`,
	validate: `Usage: jotl validate <schema> <data...> [--schema-version <version>] [--config <file> | --no-config]

Validate one or more JSON data files against a schema; the verdict for each file goes to stdout and validation errors to stderr,
located as \`data-file#/data-pointer\`, with the \`file:line:column\` in the data file on the next indented line.
At most one of the schema and data files may be \`-\` (stdin).
${SCHEMA_INPUT_NOTE_EN}

Options:
  --schema-version <version>  Version for JSON Schema input that does not declare $schema
  --config <file>             Use the given config file instead of looking for jotl.config.json
  --no-config                 Do not read jotl.config.json
  -h, --help                  Show this help

Examples:
  jotl validate home.jotl data/home.json data/home-empty.json
`,
	defaults: `Usage: jotl defaults <schema> [--strategy explicit|required|all] [--out <file>] [--config <file> | --no-config]

Generate default data for a schema and output it as JSON.
${SCHEMA_INPUT_NOTE_EN}

Options:
  --strategy <explicit|required|all>  explicit takes explicit defaults only (default); required also fills zero values
                                      for required fields; all fills zero values for every field
  --schema-version <version>          Version for JSON Schema input that does not declare $schema
  --out <file>                        Write to a file instead of stdout; must differ from the input file
  --config <file>                     Use the given config file instead of looking for jotl.config.json
  --no-config                         Do not read jotl.config.json
  -h, --help                          Show this help

Examples:
  jotl defaults home.jotl --strategy required
`,
	"migrate-schema": `Usage: jotl migrate-schema <file> [--to jotl|schema] [--out <file>] [--schema-version <version>]
                                 [--accept-newer-keywords=true|false] [--on-conflict error|preferDeclared|preferLatest]

Migrate a Fengdie schema or a legacy JSON Schema to Jotl (default) or JSON Schema 2020-12.
The input kind is detected automatically and reported to stderr as info:
  1. Not starting with an opening brace or bracket (not JSON text): Fengdie source (umo-edit-sdk grammar)
  2. JSON with umo JSON traits: umo JSON produced by Fengdie toJson; traits are any field with a \`key\` equal to its property name,
     a Fengdie type (such as image text richtext url color date enum box), or enum members that are objects with label and value
  3. Any other JSON: plain JSON Schema (draft-04 / 06 / 07 / 2019-09, OpenAPI 3.0 / 3.1, Swagger 2.0), upgraded to 2020-12 first
Information that cannot be converted in a Fengdie migration is kept in x-fengdie with a warning.

Options:
  --to <jotl|schema>                     Output format, default jotl; schema outputs 2020-12 JSON
  --schema-version <version>             Version used when $schema is not declared: {versions}
  --accept-newer-keywords=<true|false>   Whether keywords newer than the declared version are accepted with 2020-12 semantics,
                                         default true
  --on-conflict <policy>                 On old/new semantic conflicts: error reports an error, preferDeclared follows the declared
                                         version, preferLatest follows 2020-12; default preferDeclared with --to jotl,
                                         error with --to schema
  --out <file>                           Write to a file instead of stdout; must differ from the input file
  -h, --help                             Show this help

--schema-version, --accept-newer-keywords and --on-conflict apply only to plain JSON Schema input; using them with Fengdie input is a usage error.
With --to schema and plain JSON Schema input, the change list (one info per rewrite) is also written to stderr.

Examples:
  jotl migrate-schema home.fengdie --out home.jotl
  jotl migrate-schema home.umo.json --to schema
  jotl migrate-schema legacy.json --to schema --out legacy.2020-12.json
  jotl migrate-schema petstore-pet.json --schema-version openapi-3.0 --on-conflict preferLatest
`,
	format: `Usage: jotl format <file.jotl> [--write]

Format Jotl source, keeping comments; nothing is output when the source has syntax errors.

Options:
  --write     Write back to the file instead of stdout; skipped when unchanged, keeps an existing BOM; cannot be used with \`-\` (stdin)
  -h, --help  Show this help

Examples:
  jotl format home.jotl --write
`,
};

/** 命令帮助模板, `{versions}` 由调用方替换. */
export function commandHelpTemplate(name: CommandName): string {
	return (getLocale() === "en" ? COMMAND_HELP_EN : COMMAND_HELP_ZH)[name];
}
