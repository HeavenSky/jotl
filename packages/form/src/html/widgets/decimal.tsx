// 精确数组件 money 与 bigint: 值为 { type, value: 精确数字符串, ... } 对象; 文本框输入, 聚焦显示原值, 失焦与只读按千分位显示.
import { useState, type ChangeEvent } from "react";
import { isSchemaObject, type JsonSchemaObject } from "@jotl/core";
import { EXACT_DECIMAL, formatThousands, fromBig, isDecimalValue, stripThousands, toBig, type DecimalValue } from "../../core/index.js";
import { useCopy } from "../copy.js";
import { choiceAttributes, controlAttributes, type HtmlFieldProps } from "../props.js";
import { useDraft } from "../use-draft.js";
import { cn, styles } from "../styles.js";

const INTEGER = /^-?\d+$/;

function property(schema: JsonSchemaObject, name: string): JsonSchemaObject | undefined {
  const value = isSchemaObject(schema.properties) ? schema.properties[name] : undefined;
  return isSchemaObject(value) ? value : undefined;
}

/** 属性的可选值: const 为单个固定值, enum 为可选列表; 都没有时为 undefined(自由输入或不显示). */
export function choicesOf(schema: JsonSchemaObject, name: string): string[] | undefined {
  const p = property(schema, name);
  if (p === undefined) return undefined;
  if (typeof p.const === "string") return [p.const];
  if (Array.isArray(p.enum)) return p.enum.filter((v): v is string => typeof v === "string");
  return undefined;
}

/** money 的定长小数位: 取自 value 的 pattern(`\.\d{d}$` 或整数); 不定长时为 undefined. */
export function moneyDecimals(schema: JsonSchemaObject): number | undefined {
  const pattern = property(schema, "value")?.pattern;
  if (typeof pattern !== "string") return undefined;
  if (pattern === "^-?\\d+$") return 0;
  const fixed = /\\\.\\d\{(\d+)\}\$$/.exec(pattern);
  return fixed === null ? undefined : Number(fixed[1]);
}

function textOf(value: unknown): string {
  return isDecimalValue(value) ? value.value : "";
}

interface DecimalInputProps {
  field: HtmlFieldProps<DecimalValue>;
  thousands: boolean;
  integer: boolean;
  /** 合法的精确数字符串 → 新值. */
  build(text: string): DecimalValue;
  /** 失焦时规范化(如补齐定长小数位), 不需要时原样返回. */
  normalize(value: DecimalValue): DecimalValue;
}

function DecimalInput({ field, thousands, integer, build, normalize }: DecimalInputProps) {
  const COPY = useCopy();
  const [focused, setFocused] = useState(false);
  const format = (value: unknown): string => {
    const text = textOf(value);
    return thousands && (!focused || field.mode !== "edit") ? formatThousands(text) : text;
  };
  const draft = useDraft(field.value, format);
  const draftErrorId = `${field.id}-draft-error`;
  const attributes = controlAttributes(field, ...(draft.invalid ? [draftErrorId] : []));
  return (
    <>
      <input
        {...attributes}
        aria-invalid={draft.invalid ? true : attributes["aria-invalid"]}
        type="text"
        className={cn("jotl-input jotl-decimal", styles.input, styles.grow)}
        inputMode={integer ? "numeric" : "decimal"}
        value={draft.text}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          draft.settle();
          if (isDecimalValue(field.value)) {
            const next = normalize(field.value);
            if (next.value !== field.value.value) field.onChange(next);
          }
          field.onBlur();
        }}
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const raw = e.target.value;
          const text = stripThousands(raw);
          if (text === "") {
            draft.accept(raw, undefined);
            field.onChange(undefined);
            return;
          }
          if (!(integer ? INTEGER : EXACT_DECIMAL).test(text)) {
            draft.reject(raw);
            return;
          }
          const next = build(text);
          draft.accept(raw, next);
          field.onChange(next);
        }}
      />
      {draft.invalid && (
        <span className={`jotl-draft-error ${styles.error}`} id={draftErrorId} role="alert">
          {COPY.numberInvalid}
        </span>
      )}
    </>
  );
}

/** 币种或单位: 固定值显示为文字, 可选值为下拉框, 币种不限时为 3 位大写字母的文本框; 单位不限时不显示. */
function Part(props: { field: HtmlFieldProps<DecimalValue>; name: "currency" | "unit"; current: string | undefined; onPick(value: string): void }) {
  const COPY = useCopy();
  const { field, name, current } = props;
  const choices = choicesOf(field.schema, name);
  const label = name === "currency" ? COPY.currency : COPY.unit;
  const id = `${field.id}-${name}`;
  if (choices !== undefined && choices.length === 1) {
    // 普通 span 上的 aria-label 会被读屏忽略, 名称用视觉隐藏的文字给出.
    return (
      <span className="jotl-decimal-part">
        <span className={styles.visuallyHidden}>{label} </span>
        <span id={id}>{choices[0]}</span>
      </span>
    );
  }
  if (choices !== undefined) {
    const { "aria-describedby": _d, "aria-required": _r, "aria-labelledby": _l, ...attributes } = choiceAttributes(field);
    return (
      <select {...attributes} id={id} className={`jotl-select jotl-decimal-part ${styles.select()}`} aria-label={label} value={current ?? ""} onChange={(e) => props.onPick(e.target.value)}>
        {current === undefined && <option value="">{COPY.emptyOption}</option>}
        {choices.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    );
  }
  if (name === "unit" || property(field.schema, name) === undefined) return null;
  return (
    <input
      id={id}
      type="text"
      className={`jotl-input jotl-decimal-part ${styles.input}`}
      aria-label={label}
      maxLength={3}
      size={4}
      value={current ?? ""}
      readOnly={field.mode === "view"}
      disabled={field.mode === "disabled"}
      onChange={(e) => props.onPick(e.target.value.toUpperCase())}
    />
  );
}

export function MoneyWidget(props: HtmlFieldProps<DecimalValue>) {
  const decimals = moneyDecimals(props.schema);
  const current = isDecimalValue(props.value) ? props.value : undefined;
  const currency = typeof current?.currency === "string" ? current.currency : choicesOf(props.schema, "currency")?.[0];
  const unit = typeof current?.unit === "string" ? current.unit : choicesOf(props.schema, "unit")?.[0];
  const zero = decimals === undefined || decimals === 0 ? "0" : `0.${"0".repeat(decimals)}`;
  const build = (text: string, base: DecimalValue | undefined = current): DecimalValue => {
    const next: DecimalValue = { ...base, type: "money", value: text };
    if (next.currency === undefined && currency !== undefined) next.currency = currency;
    if (next.unit === undefined && unit !== undefined && choicesOf(props.schema, "unit") !== undefined) next.unit = unit;
    return next;
  };
  const pick = (name: "currency" | "unit") => (value: string) => {
    if (props.mode !== "edit") return;
    props.onChange({ ...build(current?.value ?? zero), [name]: value });
  };
  return (
    <span className={`jotl-decimal-group jotl-money ${styles.inline}`}>
      <DecimalInput
        field={props}
        thousands={props.thousands ?? true}
        integer={decimals === 0}
        build={(text) => build(text)}
        normalize={(value) => (decimals === undefined ? value : fromBig(toBig(value), value, decimals))}
      />
      <Part field={props} name="currency" current={typeof current?.currency === "string" ? current.currency : undefined} onPick={pick("currency")} />
      <Part field={props} name="unit" current={typeof current?.unit === "string" ? current.unit : undefined} onPick={pick("unit")} />
    </span>
  );
}

export function BigintWidget(props: HtmlFieldProps<DecimalValue>) {
  const current = isDecimalValue(props.value) ? props.value : undefined;
  return (
    <span className={`jotl-decimal-group jotl-bigint ${styles.inline}`}>
      <DecimalInput
        field={props}
        thousands={props.thousands ?? false}
        integer
        build={(text) => ({ ...current, type: "bigint", value: text })}
        normalize={(value) => value}
      />
    </span>
  );
}
