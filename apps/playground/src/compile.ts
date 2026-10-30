// 纯函数: Jotl 源码编译为 JSON Schema 文本, schema 生成 TS 文本, 两者的诊断统一换算成源码行列;
// fengdie DSL schema 先经 `migrateFengdie` 迁移为 Jotl 再编译, 迁移诊断直接定位在其源码上.
import { migrateFengdie, fengdieJsonFeature } from "@jotl/convert";
import { compile, getLocale, type CompileOptions } from "@jotl/core";
import {
	parentPointer,
	type Diagnostic,
	type JsonSchema,
	type JsonSchemaObject,
	type Result,
	type Severity,
	type SourceMap,
	type SourceRange,
} from "@jotl/core";
import type { ConfigReport } from "./config.js";
import { copyOf, type DiagnosticStage } from "./copy.js";

/** 编译时使用的文件名, 也是源码定位诊断中 range.file 的取值. */
export const PLAYGROUND_FILE = "playground.jotl";

export type { DiagnosticStage };

/** line 与 column 从 1 起, column 按 UTF-16 代码单元计. */
export interface LineColumn {
	line: number;
	column: number;
}

export interface PlaygroundDiagnostic {
	stage: DiagnosticStage;
	/** 内部错误没有代码. */
	code?: string;
	severity: Severity;
	message: string;
	/** 无法换算到源码时缺省. */
	start?: LineColumn;
	end?: LineColumn;
}

export interface CompiledSchema {
	schema: JsonSchemaObject;
	schemaText: string;
	sourceMap: SourceMap;
	/** 默认导出的类型名, 生成 TS 时传入. */
	defaultExport?: string;
	/** schema 来自凤蝶迁移产物, sourceMap 对应迁移生成的 Jotl 而非编辑器内容. */
	fengdie?: boolean;
}

export interface CompileReport {
	source: string;
	/** 输入被识别为 fengdie DSL schema, source 仍是凤蝶原文, 编译用的是迁移产物. */
	fengdie?: boolean;
	/** 有 error 级诊断时缺省. */
	output?: CompiledSchema;
	diagnostics: PlaygroundDiagnostic[];
}

export type SchemaToTs = (
	schema: JsonSchema,
	options?: { defaultExport?: string }
) => Result<string>;

export interface TsReport {
	/** 生成失败时缺省. */
	text?: string;
	diagnostics: PlaygroundDiagnostic[];
}

function errorDetail(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

/**
 * fengdie DSL schema 的顶层特征: 注释与空白之后是凤蝶类型关键字, `export` 文档或 `public`, 或 namespace 类型.
 * Jotl 顶层是 `名字:` 起头的源码不会命中, 普通源码不为此多跑一次迁移解析.
 */
const FENGDIE_HEAD_RE =
	/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*(?:(?:export\s+\w+|public)\s+)?(?:Object|Array|String|Text|RichText|URL|Color|File|Image|Number|Boolean|Date|Enum|Component|Box|Resource|Plugin|Animation|Video|Action|OpenAction|Spm|Module|ModuleArray|Lottery|[A-Z][A-Za-z0-9]*\.[A-Z][A-Za-z0-9]*)\b/;

/** 输入是否按 fengdie DSL schema 迁移: 顶层像凤蝶的源码, 或带 fengdie JSON 特征的 JSON(凤蝶 toJson 产物). */
function isFengdieInput(source: string): boolean {
	if (/^\s*\{/.test(source)) {
		try {
			return fengdieJsonFeature(JSON.parse(source) as unknown) !== undefined;
		} catch {
			return false;
		}
	}
	return FENGDIE_HEAD_RE.test(source);
}

function rangeOf(range: SourceRange): Pick<PlaygroundDiagnostic, "start" | "end"> {
	return {
		start: { line: range.start.line, column: range.start.column },
		end: { line: range.end.line, column: range.end.column },
	};
}

/** 指针在源码映射中查不到时逐级取父指针, 定位到最近的已映射祖先. */
function pointerRange(pointer: string, sourceMap: SourceMap | undefined): SourceRange | undefined {
	if (sourceMap === undefined) return undefined;
	for (
		let current: string | undefined = pointer;
		current !== undefined;
		current = parentPointer(current)
	) {
		const span = sourceMap.get(current);
		if (span !== undefined) return span.keyRange ?? span.range;
	}
	return undefined;
}

function toPlayground(
	diagnostic: Diagnostic,
	stage: DiagnosticStage,
	sourceMap: SourceMap | undefined
): PlaygroundDiagnostic {
	const base: PlaygroundDiagnostic = {
		stage,
		code: diagnostic.code,
		severity: diagnostic.severity,
		message: diagnostic.message,
	};
	const location = diagnostic.location;
	if (location === undefined) return base;
	if (location.kind === "source")
		return location.range.file === PLAYGROUND_FILE
			? { ...base, ...rangeOf(location.range) }
			: base;
	if (location.document !== undefined) return base;
	const range = pointerRange(location.pointer, sourceMap);
	return range === undefined ? base : { ...base, ...rangeOf(range) };
}

export function formatSchema(schema: JsonSchema): string {
	return `${JSON.stringify(schema, null, 2)}\n`;
}

/** 编译器自身抛出的异常也转为一条诊断, 不向外抛. */
export function compileSource(source: string, options: CompileOptions = {}): CompileReport {
	// 凤蝶输入: 迁移诊断直接定位在 fengdie DSL schema; 迁移产物再编译的诊断对应迁移生成的 Jotl,
	// 行列与编辑器内容对不上, 不带位置只保留消息.
	let migrated: ReturnType<typeof migrateFengdie> | undefined;
	if (isFengdieInput(source)) {
		migrated = migrateFengdie(source, PLAYGROUND_FILE);
		const migrateDiagnostics = migrated.diagnostics.map(d => toPlayground(d, "migrate", undefined));
		if (migrated.jotl === undefined) return { source, fengdie: true, diagnostics: migrateDiagnostics };
		let result: ReturnType<typeof compile>;
		try {
			result = compile(migrated.jotl, PLAYGROUND_FILE, options);
		} catch (error) {
			return {
				source,
				fengdie: true,
				diagnostics: [
					...migrateDiagnostics,
					{
						stage: "compile",
						severity: "error",
						message: copyOf(getLocale()).diagnostics.internalError(errorDetail(error)),
					},
				],
			};
		}
		const diagnostics = [
			...migrateDiagnostics,
			...result.diagnostics.map(d => toPlayground(d, "compile", undefined)),
		];
		if (result.value === undefined) return { source, fengdie: true, diagnostics };
		const { schema, defaultExport } = result.value;
		const output: CompiledSchema = {
			schema,
			schemaText: formatSchema(schema),
			sourceMap: result.value.sourceMap,
			fengdie: true,
		};
		if (defaultExport !== undefined) output.defaultExport = defaultExport;
		return { source, fengdie: true, output, diagnostics };
	}
	let result: ReturnType<typeof compile>;
	try {
		result = compile(source, PLAYGROUND_FILE, options);
	} catch (error) {
		return {
			source,
			diagnostics: [
				{
					stage: "compile",
					severity: "error",
					message: copyOf(getLocale()).diagnostics.internalError(errorDetail(error)),
				},
			],
		};
	}
	const sourceMap = result.value?.sourceMap;
	const diagnostics = result.diagnostics.map(d => toPlayground(d, "compile", sourceMap));
	if (result.value === undefined) return { source, diagnostics };
	const { schema, defaultExport } = result.value;
	const output: CompiledSchema = {
		schema,
		schemaText: formatSchema(schema),
		sourceMap: result.value.sourceMap,
	};
	if (defaultExport !== undefined) output.defaultExport = defaultExport;
	return { source, output, diagnostics };
}

/** 生成器的指针诊断经编译结果的源码映射换算到源码行列; 凤蝶迁移产物的映射对不上编辑器内容, 不换算. */
export function generateTs(compiled: CompiledSchema, schemaToTs: SchemaToTs): TsReport {
	let result: Result<string>;
	try {
		result = schemaToTs(
			compiled.schema,
			compiled.defaultExport === undefined ? {} : { defaultExport: compiled.defaultExport }
		);
	} catch (error) {
		return {
			diagnostics: [
				{
					stage: "ts",
					severity: "error",
					message: copyOf(getLocale()).diagnostics.tsInternalError(errorDetail(error)),
				},
			],
		};
	}
	const sourceMap = compiled.fengdie === true ? undefined : compiled.sourceMap;
	const diagnostics = result.diagnostics.map(d => toPlayground(d, "ts", sourceMap));
	return result.value === undefined ? { diagnostics } : { text: result.value, diagnostics };
}

export interface PlaygroundBuild {
	report: CompileReport;
	/** 编译失败时缺省. */
	ts?: TsReport;
	/** 编译时使用的 jotl.config.json; 没有配置时缺省. */
	config?: ConfigReport;
}

export function buildPlayground(
	source: string,
	schemaToTs: SchemaToTs,
	config?: ConfigReport
): PlaygroundBuild {
	const report = compileSource(source, config?.compileOptions);
	const build: PlaygroundBuild =
		report.output === undefined
			? { report }
			: { report, ts: generateTs(report.output, schemaToTs) };
	if (config !== undefined) build.config = config;
	return build;
}

/** 配置诊断在前, 其后是编译诊断与 TS 诊断. */
export function allDiagnostics(build: PlaygroundBuild): PlaygroundDiagnostic[] {
	return [
		...(build.config?.diagnostics ?? []),
		...build.report.diagnostics,
		...(build.ts?.diagnostics ?? []),
	];
}

export function countBySeverity(diagnostics: readonly PlaygroundDiagnostic[]): {
	errors: number;
	warnings: number;
} {
	let errors = 0;
	let warnings = 0;
	for (const d of diagnostics) {
		if (d.severity === "error") errors += 1;
		else if (d.severity === "warning") warnings += 1;
	}
	return { errors, warnings };
}
