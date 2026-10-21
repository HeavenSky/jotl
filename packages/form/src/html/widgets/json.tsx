// 兜底组件 json: 编辑态为 JSON 文本框, 查看态为 pre; 不合法的文本只留作草稿并提示.
// schema 为 string(jsontext)时编辑的是 JSON 原文, 值仍是用户写下的字符串, 只要求能解析.
import type { ChangeEvent } from "react";
import { schemaTypes } from "../../core/index.js";
import { useCopy } from "../copy.js";
import { describedBy, nameId } from "../ids.js";
import { controlAttributes, type HtmlFieldProps } from "../props.js";
import { useDraft } from "../use-draft.js";
import { cn, styles } from "../styles.js";

function formatJson(value: unknown): string {
	return value === undefined ? "" : JSON.stringify(value, null, 2);
}

function formatText(value: unknown): string {
	return typeof value === "string" ? value : formatJson(value);
}

export function JsonWidget(props: HtmlFieldProps<unknown>) {
	const COPY = useCopy();
	// 值不是字符串(如数据与 schema 不符)时按普通 JSON 值编辑, 不把它改写成字符串.
	const textual =
		schemaTypes(props.schema).includes("string") &&
		(props.value === undefined || typeof props.value === "string");
	const format = textual ? formatText : formatJson;
	const draft = useDraft(props.value, format);
	if (props.mode === "view") {
		return (
			// pre 不能经 label 的 for 关联, 改用 group 角色经 aria-labelledby 取外壳标签.
			<pre
				id={props.id}
				role="group"
				aria-labelledby={nameId(props.id)}
				aria-describedby={describedBy(props.id, props.schema.description, props.errors)}
				className={cn("jotl-json jotl-json--view", styles.json, styles.jsonView)}
			>
				{format(props.value)}
			</pre>
		);
	}
	const draftErrorId = `${props.id}-draft-error`;
	const attributes = controlAttributes(props, ...(draft.invalid ? [draftErrorId] : []));
	return (
		<>
			<textarea
				{...attributes}
				aria-invalid={draft.invalid ? true : attributes["aria-invalid"]}
				className={cn("jotl-input jotl-json", styles.input, styles.json)}
				spellCheck={false}
				value={draft.text}
				onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
					const text = e.target.value;
					if (text.trim() === "") {
						draft.accept(text, undefined);
						props.onChange(undefined);
						return;
					}
					let parsed: unknown;
					try {
						parsed = JSON.parse(text);
					} catch {
						draft.reject(text);
						return;
					}
					const next = textual ? text : parsed;
					draft.accept(text, next);
					props.onChange(next);
				}}
			/>
			{draft.invalid && (
				<span className={`jotl-draft-error ${styles.error}`} id={draftErrorId} role="alert">
					{COPY.jsonInvalid}
				</span>
			)}
		</>
	);
}
