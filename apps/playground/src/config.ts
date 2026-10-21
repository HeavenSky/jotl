// jotl.config.json 编辑内容的解析: JSON 文本经 readJotlConfig 校验为编译选项与组件模块, 问题转为带行列的配置诊断.
import {
	configCompileOptions,
	getLocale,
	jsonPointerOffsets,
	locateJsonError,
	parentPointer,
	readJotlConfig,
	type CompileOptions,
	type JotlConfig,
} from "@jotl/core";
import type { PlaygroundDiagnostic } from "./compile.js";
import { copyOf } from "./copy.js";
import { positionAt } from "./text-position.js";

/** 本地存储中没有配置时的内容: 登记一个演示用的扩展组件模块, 源码里写 `score: Stars` 即可使用. */
export const DEFAULT_CONFIG = `{
  "widgets": {
    "Stars": { "base": "integer", "module": "./widgets/rating.js" }
  }
}
`;

export interface ConfigReport {
	text: string;
	config: JotlConfig;
	compileOptions: CompileOptions;
	diagnostics: PlaygroundDiagnostic[];
}

const EMPTY: JotlConfig = { widgets: {}, modules: {} };

/** 空白内容视为没有配置; JSON 不合法时整份忽略并报一条错误, 不合法的项跳过并逐条报警告. */
export function readConfig(text: string): ConfigReport {
	const copy = copyOf(getLocale());
	if (text.trim() === "") return { text, config: EMPTY, compileOptions: {}, diagnostics: [] };
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch (error) {
		const detail = error instanceof Error ? error.message : String(error);
		const diagnostic: PlaygroundDiagnostic = {
			stage: "config",
			severity: "error",
			message: copy.config.parseError(detail),
		};
		const located = locateJsonError(text);
		return {
			text,
			config: EMPTY,
			compileOptions: {},
			diagnostics: [
				located === undefined ? diagnostic : { ...diagnostic, ...at(text, located.offset) },
			],
		};
	}
	const { config, issues } = readJotlConfig(value);
	const offsets = issues.length === 0 ? undefined : jsonPointerOffsets(text);
	const diagnostics = issues.map((issue): PlaygroundDiagnostic => {
		const diagnostic: PlaygroundDiagnostic = {
			stage: "config",
			severity: "warning",
			message: copy.config.issue(issue.pointer, issue.message),
		};
		const offset = pointerOffset(issue.pointer, offsets);
		return offset === undefined ? diagnostic : { ...diagnostic, ...at(text, offset) };
	});
	return { text, config, compileOptions: configCompileOptions(config.widgets), diagnostics };
}

function at(text: string, offset: number): Pick<PlaygroundDiagnostic, "start" | "end"> {
	const position = positionAt(text, offset);
	return { start: position, end: position };
}

/** 指针在文本中查不到时逐级取父指针, 定位到最近的已出现祖先. */
function pointerOffset(
	pointer: string,
	offsets: ReadonlyMap<string, number> | undefined
): number | undefined {
	if (offsets === undefined) return undefined;
	for (
		let current: string | undefined = pointer;
		current !== undefined;
		current = parentPointer(current)
	) {
		const offset = offsets.get(current);
		if (offset !== undefined) return offset;
	}
	return undefined;
}
