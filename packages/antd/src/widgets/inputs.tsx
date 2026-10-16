// 字符串与数字输入: input, textarea, password, url, email 用 Input 系列, number 用 InputNumber, range 用 Slider.
import { useCallback, useState } from "react";
import { Input, InputNumber, Slider } from "antd";
import { decimalsOf } from "@jotl/form";
import { formatThousands, stripThousands } from "@jotl/form/core";
import { ariaAttributes, textAttributes, type AntdFieldProps } from "../shared.js";

function displayText(value: unknown): string {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function lengthLimit(limit: unknown): number | undefined {
  return typeof limit === "number" && Number.isInteger(limit) && limit >= 0 ? limit : undefined;
}

export function AntdInputWidget(props: AntdFieldProps<string>) {
  return (
    <Input
      {...textAttributes(props)}
      className="jotl-input jotl-text"
      value={displayText(props.value)}
      maxLength={lengthLimit(props.schema.maxLength)}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function AntdPasswordWidget(props: AntdFieldProps<string>) {
  return (
    <Input.Password
      {...textAttributes(props)}
      className="jotl-input jotl-password"
      value={displayText(props.value)}
      maxLength={lengthLimit(props.schema.maxLength)}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

export function AntdTextareaWidget(props: AntdFieldProps<string>) {
  return (
    <Input.TextArea
      {...textAttributes(props)}
      className="jotl-input jotl-textarea"
      autoSize={{ minRows: 3 }}
      value={displayText(props.value)}
      maxLength={lengthLimit(props.schema.maxLength)}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

/** 有格式的字符串: 清空即写回 undefined, 空串不是合法的格式值. */
function FormattedInput(props: AntdFieldProps<string> & { type: "url" | "email" }) {
  const { type, ...field } = props;
  return (
    <Input
      {...textAttributes(field)}
      type={type}
      className={`jotl-input jotl-${type}`}
      value={displayText(field.value)}
      onChange={(e) => field.onChange(e.target.value === "" ? undefined : e.target.value)}
    />
  );
}

export function AntdUrlWidget(props: AntdFieldProps<string>) {
  return <FormattedInput {...props} type="url" />;
}

export function AntdEmailWidget(props: AntdFieldProps<string>) {
  return <FormattedInput {...props} type="email" />;
}

function bound(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** 去掉值为 undefined 的键; antd 的可选属性不接受显式 undefined. */
function defined<T extends Record<string, unknown>>(record: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as { [K in keyof T]?: Exclude<T[K], undefined> };
}

function stepOf(decimals: number | undefined): number | undefined {
  return decimals === undefined ? undefined : decimals === 0 ? 1 : Number(`1e-${decimals}`);
}

/** 空值写回 undefined; integer 与 x-decimals 经 precision 在失焦时舍入; 开了千分位时失焦显示带分隔符, 聚焦编辑时不带. */
export function AntdNumberWidget(props: AntdFieldProps<number>) {
  const decimals = decimalsOf(props.schema);
  const thousands = props.thousands === true;
  const [focused, setFocused] = useState(false);
  // InputNumber 在 formatter 引用变化时按当前值重排输入框文本, 所以只随聚焦状态换引用; 输入过程中原样保留用户键入的文本.
  const formatter = useCallback(
    (value: number | string | undefined, info: { userTyping: boolean; input: string }) => {
      if (info.userTyping) return info.input;
      const text = value === undefined ? "" : String(value);
      return focused ? text : formatThousands(text);
    },
    [focused],
  );
  return (
    <InputNumber<number>
      {...textAttributes(props)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        props.onBlur();
      }}
      className="jotl-input jotl-number"
      style={{ width: "100%" }}
      value={typeof props.value === "number" ? props.value : null}
      {...defined({ min: bound(props.schema.minimum), max: bound(props.schema.maximum), step: stepOf(decimals), precision: decimals })}
      {...(thousands
        ? {
            formatter,
            parser: (text: string | undefined) => Number(stripThousands(text ?? "")),
          }
        : {})}
      onChange={(value) => props.onChange(typeof value === "number" && Number.isFinite(value) ? value : undefined)}
    />
  );
}

/** 滑块: 需要 minimum 与 maximum(core/ 的 accepts 保证). */
export function AntdRangeWidget(props: AntdFieldProps<number>) {
  const min = bound(props.schema.minimum) ?? 0;
  const max = bound(props.schema.maximum) ?? 100;
  return (
    <Slider
      {...ariaAttributes(props)}
      id={props.id}
      className="jotl-range"
      disabled={props.mode !== "edit"}
      min={min}
      max={max}
      step={stepOf(decimalsOf(props.schema)) ?? 1}
      value={typeof props.value === "number" ? props.value : min}
      onChange={(value: number) => props.onChange(value)}
    />
  );
}
