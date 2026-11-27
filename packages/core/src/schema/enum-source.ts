import { formatPointer, lookupPointer, tryParsePointer } from "./json-pointer.js";
import { parseLodashPath } from "./x-ui.js";

export const ENUM_SOURCE_TYPES = ["string", "number", "boolean"] as const;

export function enumSourcePath(source: string): string[] | undefined {
	return parseLodashPath(source.startsWith("$.") ? source.slice(2) : source);
}

/** 多选项的校验路径比控件多一层数组下标, 两者都从最近的外层对象取候选项. */
export function readEnumSource(source: string, root: unknown, fieldPath: string): unknown {
	const tokens = enumSourcePath(source);
	const field = tryParsePointer(fieldPath);
	if (!tokens || !field) return undefined;
	const owner = field.slice(0, -1);
	while (owner.length && Array.isArray(lookupPointer(root, formatPointer(owner)).value)) {
		owner.pop();
		field.pop();
	}
	const path = source.startsWith("$.") ? [] : owner;
	for (const token of tokens) {
		const part = token === "*" ? field[path.length] : token;
		if (part === undefined) return undefined;
		path.push(part);
	}
	return lookupPointer(root, formatPointer(path)).value;
}

export function isEnumSourceValue(item: unknown): item is string | number | boolean {
	return typeof item === "string" || typeof item === "boolean" || Number.isFinite(item);
}

type SourceValue = string | number | boolean;
interface SourceOption {
	value: SourceValue;
	label?: string;
}

function sourceOption(item: unknown): SourceOption | undefined {
	if (isEnumSourceValue(item)) return { value: item };
	if (typeof item !== "object" || item === null || Array.isArray(item)) return undefined;
	const option = item as Record<string, unknown>;
	if (
		!Object.hasOwn(option, "value") ||
		!Object.hasOwn(option, "label") ||
		!isEnumSourceValue(option.value) ||
		typeof option.label !== "string"
	)
		return undefined;
	return { value: option.value, label: option.label };
}

export function enumSourceOptions(list: unknown): SourceOption[] {
	const options = new Map<SourceValue, SourceOption>();
	if (Array.isArray(list)) {
		for (const item of list) {
			const option = sourceOption(item);
			if (option && !options.has(option.value)) options.set(option.value, option);
		}
	}
	return [...options.values()];
}

export function enumSourceValues(list: unknown): SourceValue[] {
	return enumSourceOptions(list).map(option => option.value);
}

export function hasEnumSourceValue(list: unknown, value: unknown): boolean {
	return (
		isEnumSourceValue(value) &&
		Array.isArray(list) &&
		list.some(item => item === value || sourceOption(item)?.value === value)
	);
}
