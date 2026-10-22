// 字符串输入组件: input, textarea, password, url, email.
import type { ChangeEvent } from "react";
import { className, controlAttributes, type HtmlFieldProps } from "../props.js";
import { cn, styles } from "../styles.js";

function displayText(value: unknown): string {
	if (value === undefined || value === null) return "";
	return typeof value === "string" ? value : JSON.stringify(value);
}

/** JSON Schema 的 pattern 不锚定, 原生 pattern 隐式整串锚定; 两侧补任意串后语义一致. */
export function nativePattern(pattern: unknown): string | undefined {
	return typeof pattern === "string" ? `[\\s\\S]*(?:${pattern})[\\s\\S]*` : undefined;
}

function lengthLimit(limit: unknown): number | undefined {
	return typeof limit === "number" && Number.isInteger(limit) && limit >= 0 ? limit : undefined;
}

/**
 * 原生 maxLength: schema 的 maxLength 按码点计数, 原生按 UTF-16 码元计数, 上限补上当前值中代理对的个数, 已输入的补充平面字符(emoji 等)按一个字符计.
 * 只剩 1 个码点时输入补充平面字符, 或粘贴含补充平面字符的文本时, 仍会比 schema 早拦截.
 */
export function nativeMaxLength(limit: unknown, value: string): number | undefined {
	const max = lengthLimit(limit);
	return max === undefined ? undefined : max + value.length - [...value].length;
}

function LineInput(props: HtmlFieldProps<string> & { type: "text" | "password"; kind: string }) {
	const value = displayText(props.value);
	return (
		<input
			{...controlAttributes(props)}
			type={props.type}
			className={className("jotl-input", props.kind, styles.input)}
			value={value}
			maxLength={nativeMaxLength(props.schema.maxLength, value)}
			pattern={nativePattern(props.schema.pattern)}
			onChange={(e: ChangeEvent<HTMLInputElement>) => props.onChange(e.target.value)}
		/>
	);
}

export function InputWidget(props: HtmlFieldProps<string>) {
	return <LineInput {...props} type="text" kind="jotl-text" />;
}

export function PasswordWidget(props: HtmlFieldProps<string>) {
	return <LineInput {...props} type="password" kind="jotl-password" />;
}

export function TextareaWidget(props: HtmlFieldProps<string>) {
	const value = displayText(props.value);
	return (
		<textarea
			{...controlAttributes(props)}
			className={cn("jotl-input jotl-textarea", styles.input, styles.textarea)}
			value={value}
			maxLength={nativeMaxLength(props.schema.maxLength, value)}
			onChange={(e: ChangeEvent<HTMLTextAreaElement>) => props.onChange(e.target.value)}
		/>
	);
}

/** 有格式的字符串: 清空即写回 undefined, 空串不是合法的格式值. */
function FormattedInput(props: HtmlFieldProps<string> & { type: "url" | "email"; kind: string }) {
	const value = displayText(props.value);
	return (
		<input
			{...controlAttributes(props)}
			type={props.type}
			className={className("jotl-input", props.kind, styles.input)}
			value={value}
			onChange={(e: ChangeEvent<HTMLInputElement>) =>
				props.onChange(e.target.value === "" ? undefined : e.target.value)
			}
		/>
	);
}

export function UrlWidget(props: HtmlFieldProps<string>) {
	return <FormattedInput {...props} type="url" kind="jotl-url" />;
}

export function EmailWidget(props: HtmlFieldProps<string>) {
	return <FormattedInput {...props} type="email" kind="jotl-email" />;
}
