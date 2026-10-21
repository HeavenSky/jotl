// 数字组件 number 与 range: 空串写回 undefined, 按 x-decimals 设 step 并在失焦时舍入, 开了千分位时改用文本框.
import { useState, type ChangeEvent } from "react";
import {
	EXACT_DECIMAL,
	formatThousands,
	fromBig,
	schemaTypes,
	stripThousands,
	toBig,
} from "../../core/index.js";
import { useCopy } from "../copy.js";
import { controlAttributes, type HtmlFieldProps } from "../props.js";
import { useDraft } from "../use-draft.js";
import { cn, styles } from "../styles.js";

function formatNumber(value: unknown): string {
	if (value === undefined || value === null) return "";
	return typeof value === "number" ? String(value) : JSON.stringify(value);
}

function bound(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isInteger(schema: HtmlFieldProps["schema"]): boolean {
	const types = schemaTypes(schema);
	return types.includes("integer") && !types.includes("number");
}

/** 小数位上限: integer 为 0, 否则取 x-decimals; 不限时为 undefined. */
export function decimalsOf(schema: HtmlFieldProps["schema"]): number | undefined {
	if (isInteger(schema)) return 0;
	const n = schema["x-decimals"];
	return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : undefined;
}

function stepOf(decimals: number | undefined): number | "any" {
	return decimals === undefined ? "any" : decimals === 0 ? 1 : Number(`1e-${decimals}`);
}

/** 按十进制舍入到 decimals 位(四舍五入), 不经过二进制浮点的 toFixed. */
function roundTo(value: number, decimals: number): number {
	return fromBig(toBig(value).round(decimals), 0);
}

export function NumberWidget(props: HtmlFieldProps<number>) {
	const COPY = useCopy();
	const thousands = props.thousands === true;
	const [focused, setFocused] = useState(false);
	const decimals = decimalsOf(props.schema);
	const format = (value: unknown): string => {
		const text = formatNumber(value);
		return thousands && (!focused || props.mode !== "edit") ? formatThousands(text) : text;
	};
	const draft = useDraft(props.value, format);
	const draftErrorId = `${props.id}-draft-error`;
	const attributes = controlAttributes(props, ...(draft.invalid ? [draftErrorId] : []));
	const onBlur = () => {
		setFocused(false);
		draft.settle();
		if (
			decimals !== undefined &&
			typeof props.value === "number" &&
			Number.isFinite(props.value)
		) {
			const rounded = roundTo(props.value, decimals);
			if (rounded !== props.value) props.onChange(rounded);
		}
		props.onBlur();
	};
	const accept = (raw: string, invalid: boolean) => {
		const text = thousands ? stripThousands(raw) : raw;
		// 浏览器对 "-" "1e" 这类半成品给出空串并标记 badInput, 不能当作清空.
		if (invalid) {
			draft.reject(raw);
			return;
		}
		if (text.trim() === "") {
			draft.accept(raw, undefined);
			props.onChange(undefined);
			return;
		}
		const parsed = Number(text);
		if (Number.isFinite(parsed) && (!thousands || EXACT_DECIMAL.test(text))) {
			draft.accept(raw, parsed);
			props.onChange(parsed);
		} else {
			draft.reject(raw);
		}
	};
	return (
		<>
			<input
				{...attributes}
				aria-invalid={draft.invalid ? true : attributes["aria-invalid"]}
				type={thousands ? "text" : "number"}
				className={cn("jotl-input jotl-number", styles.input, styles.number)}
				inputMode={decimals === 0 ? "numeric" : "decimal"}
				step={thousands ? undefined : stepOf(decimals)}
				min={thousands ? undefined : bound(props.schema.minimum)}
				max={thousands ? undefined : bound(props.schema.maximum)}
				value={draft.text}
				onFocus={() => setFocused(true)}
				onBlur={onBlur}
				onChange={(e: ChangeEvent<HTMLInputElement>) =>
					accept(e.target.value, e.target.value === "" && e.target.validity.badInput)
				}
			/>
			{draft.invalid && (
				<span className={`jotl-draft-error ${styles.error}`} id={draftErrorId} role="alert">
					{COPY.numberInvalid}
				</span>
			)}
		</>
	);
}

/** 滑块: 需要 minimum 与 maximum(core/ 的 accepts 保证); 旁边显示当前值. */
export function RangeWidget(props: HtmlFieldProps<number>) {
	const min = bound(props.schema.minimum) ?? 0;
	const max = bound(props.schema.maximum) ?? 100;
	const value = typeof props.value === "number" ? props.value : undefined;
	return (
		<span className={`jotl-range ${styles.inline}`}>
			<input
				{...controlAttributes(props)}
				disabled={props.mode !== "edit"}
				type="range"
				className="jotl-range-input"
				min={min}
				max={max}
				step={stepOf(decimalsOf(props.schema))}
				value={value ?? min}
				onChange={(e: ChangeEvent<HTMLInputElement>) =>
					props.onChange(Number(e.target.value))
				}
			/>
			<output className="jotl-range-value" htmlFor={props.id}>
				{value === undefined ? "" : String(value)}
			</output>
		</span>
	);
}
