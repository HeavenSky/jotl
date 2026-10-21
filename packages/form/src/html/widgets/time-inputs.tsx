// 日期组件 date time datetime: 原生控件按本地时区显示, 写回时按节点的存储格式(x-valueFormat)换算; 不合格式的存量值不改写.
import type { ChangeEvent } from "react";
import { useCopy } from "../copy.js";
import { className, controlAttributes, type HtmlFieldProps } from "../props.js";
import { styles } from "../styles.js";
import {
	controlPrecision,
	controlStep,
	formatStored,
	fromControl,
	parseStored,
	storageFormat,
	textToStored,
	toControl,
	type TemporalKind,
} from "../temporal.js";
import { useDraft } from "../use-draft.js";

type TemporalValue = string | number;

const CONTROL_TYPES: Readonly<Record<TemporalKind, string>> = {
	date: "date",
	time: "time",
	datetime: "datetime-local",
};

function rawText(value: unknown): string {
	if (value === undefined || value === null) return "";
	return typeof value === "string" ? value : JSON.stringify(value);
}

function TemporalInput({ kind, ...props }: HtmlFieldProps<TemporalValue> & { kind: TemporalKind }) {
	const COPY = useCopy();
	const format = storageFormat(props.schema, kind);
	const raw = props.value;
	const empty = raw === undefined || raw === null || raw === "";
	const parsed = empty ? undefined : parseStored(raw, format);
	const draft = useDraft(raw, rawText);
	const hintId = `${props.id}-draft-error`;
	const cssKind = `jotl-${kind}`;

	// 存量值不符合存储格式: 原生控件会把它清空, 改用文本框原样显示; 键入的文本能按存储格式解析时才写回.
	if (!empty && parsed === undefined) {
		const attributes = controlAttributes(props, hintId);
		return (
			<>
				<input
					{...attributes}
					aria-invalid
					type="text"
					className={className("jotl-input", cssKind, styles.input)}
					value={draft.text}
					onChange={(e: ChangeEvent<HTMLInputElement>) => {
						const text = e.target.value;
						if (text === "") {
							draft.accept(text, undefined);
							props.onChange(undefined);
							return;
						}
						const next = textToStored(text, format);
						if (next === undefined) draft.reject(text);
						else {
							draft.accept(text, next);
							props.onChange(next);
						}
					}}
				/>
				<span className={`jotl-draft-error ${styles.error}`} id={hintId} role="alert">
					{COPY.temporalInvalid(format)}
				</span>
			</>
		);
	}

	const precision = kind === "date" ? undefined : controlPrecision(format);
	const control = parsed === undefined ? "" : toControl(parsed, kind, precision);
	return (
		<input
			{...controlAttributes(props)}
			type={CONTROL_TYPES[kind]}
			className={className("jotl-input", cssKind, styles.input)}
			value={control}
			step={
				controlStep(precision) ??
				(kind !== "date" && /:\d{2}:\d{2}/.test(control) ? 1 : undefined)
			}
			onChange={(e: ChangeEvent<HTMLInputElement>) => {
				const next = e.target.value;
				if (next === "") props.onChange(undefined);
				else {
					const d = fromControl(next, kind);
					if (d !== undefined) props.onChange(formatStored(d, format));
				}
			}}
		/>
	);
}

export function DateWidget(props: HtmlFieldProps<TemporalValue>) {
	return <TemporalInput {...props} kind="date" />;
}

export function TimeWidget(props: HtmlFieldProps<TemporalValue>) {
	return <TemporalInput {...props} kind="time" />;
}

export function DateTimeWidget(props: HtmlFieldProps<TemporalValue>) {
	return <TemporalInput {...props} kind="datetime" />;
}
