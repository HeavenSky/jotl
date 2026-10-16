// 勾选与选项组件: switch, checkbox(布尔单个或枚举数组一组), radio, select(单选或枚举数组多选).
import type { ChangeEvent } from "react";
import { enumOptions, schemaTypes, type EnumOption } from "../../core/index.js";
import { isSchemaObject } from "@jotl/core";
import { useCopy } from "../copy.js";
import { deepEqual } from "../deep-equal.js";
import { nameId } from "../ids.js";
import { choiceAttributes, type HtmlFieldProps } from "../props.js";
import { cn, styles } from "../styles.js";

export function SwitchWidget(props: HtmlFieldProps<boolean>) {
  return (
    <input
      {...choiceAttributes(props)}
      id={props.id}
      type="checkbox"
      // biome-ignore lint/a11y/useAriaPropsForRole: 原生 checkbox 的 checked 已表达开关状态, ARIA in HTML 要求此处不再写 aria-checked
      role="switch"
      className={cn("jotl-checkbox jotl-switch", styles.checkbox, styles.switch)}
      checked={props.value === true}
      onChange={(e: ChangeEvent<HTMLInputElement>) => props.onChange(e.target.checked)}
    />
  );
}

/** 枚举数组(core/ 已按形态把 checkbox select 限定在布尔, 枚举与枚举数组上). */
function isEnumArray(schema: HtmlFieldProps["schema"]): boolean {
  return schemaTypes(schema).includes("array") || schema.items !== undefined;
}

/** 布尔为单个勾选框, 枚举数组为一组勾选框. */
export function CheckboxWidget(props: HtmlFieldProps<unknown>) {
  if (isEnumArray(props.schema)) return <CheckboxGroup {...(props as HtmlFieldProps<unknown[]>)} />;
  return (
    <input
      {...choiceAttributes(props)}
      id={props.id}
      type="checkbox"
      className={`jotl-checkbox ${styles.checkbox}`}
      checked={props.value === true}
      onChange={(e: ChangeEvent<HTMLInputElement>) => props.onChange(e.target.checked)}
    />
  );
}

const optionId = (id: string, index: number): string => `${id}--${index}`;

function indexOfValue(options: readonly EnumOption[], value: unknown): number {
  return value === undefined ? -1 : options.findIndex((option) => deepEqual(option.value, value));
}

export function RadioWidget(props: HtmlFieldProps<unknown>) {
  const options = enumOptions(props.schema) ?? [];
  const selected = indexOfValue(options, props.value);
  const { "aria-invalid": invalid, "aria-describedby": described, "aria-labelledby": _labelledBy, ...attributes } = choiceAttributes(props);
  return (
    <div
      id={props.id}
      role="radiogroup"
      className={`jotl-radio-group ${styles.choiceGroup}`}
      aria-labelledby={nameId(props.id)}
      aria-invalid={invalid}
      aria-describedby={described}
    >
      {options.map((option, i) => (
        <label key={i} className={`jotl-option ${styles.option}`} htmlFor={optionId(props.id, i)}>
          <input
            {...attributes}
            id={optionId(props.id, i)}
            type="radio"
            className={`jotl-radio ${styles.checkbox}`}
            name={props.id}
            value={String(i)}
            checked={i === selected}
            onChange={() => props.onChange(option.value)}
          />
          <span className="jotl-option-label">{option.label}</span>
        </label>
      ))}
    </div>
  );
}

const EMPTY_OPTION = "";

/** 枚举数组为多选下拉框, 写回按选项顺序排列, 不在选项中的已有值保留在末尾. */
function MultiSelect(props: HtmlFieldProps<unknown[]>) {
  const options = itemOptions(props.schema) ?? [];
  const current = Array.isArray(props.value) ? props.value : [];
  const selected = options.flatMap((option, i) => (current.some((item) => deepEqual(item, option.value)) ? [String(i)] : []));
  return (
    <select
      {...choiceAttributes(props)}
      id={props.id}
      multiple
      className={`jotl-select jotl-select--multiple ${styles.select({ multiple: true })}`}
      value={selected}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
        const picked = new Set(Array.from(e.target.selectedOptions, (o) => Number(o.value)));
        const extras = current.filter((item) => !options.some((o) => deepEqual(o.value, item)));
        props.onChange([...options.filter((_, i) => picked.has(i)).map((o) => o.value), ...extras]);
      }}
    >
      {options.map((option, i) => (
        <option key={i} value={String(i)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function SelectWidget(props: HtmlFieldProps<unknown>) {
  const COPY = useCopy();
  if (isEnumArray(props.schema)) return <MultiSelect {...(props as HtmlFieldProps<unknown[]>)} />;
  const options = enumOptions(props.schema) ?? [];
  const selected = indexOfValue(options, props.value);
  return (
    <select
      {...choiceAttributes(props)}
      id={props.id}
      className={`jotl-select ${styles.select()}`}
      value={selected === -1 ? EMPTY_OPTION : String(selected)}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => {
        const option = e.target.value === EMPTY_OPTION ? undefined : options[Number(e.target.value)];
        props.onChange(option?.value);
      }}
    >
      {/* 必填字段有值时不给空选项; 无值时仍要一个空选项, 否则原生 select 会默认显示第一项. */}
      {(!props.required || selected === -1) && <option value={EMPTY_OPTION}>{COPY.emptyOption}</option>}
      {options.map((option, i) => (
        <option key={i} value={String(i)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** 枚举数组的选项, 取自 items; items 为引用时组件拿到的是引用处, 不再解析. */
export function itemOptions(schema: HtmlFieldProps["schema"]): EnumOption[] | undefined {
  return isSchemaObject(schema.items) ? enumOptions(schema.items) : undefined;
}

function CheckboxGroup(props: HtmlFieldProps<unknown[]>) {
  const options = itemOptions(props.schema) ?? [];
  const current = Array.isArray(props.value) ? props.value : [];
  const isChecked = (option: EnumOption) => current.some((item) => deepEqual(item, option.value));
  const { "aria-invalid": invalid, "aria-describedby": described, "aria-labelledby": _labelledBy, ...attributes } = choiceAttributes(props);
  return (
    // biome-ignore lint/a11y/useSemanticElements: 改用 fieldset 会改变 DOM 结构与默认样式; group 角色经 aria-labelledby 取外壳标签
    <div
      id={props.id}
      role="group"
      className={`jotl-checkbox-group ${styles.choiceGroup}`}
      aria-labelledby={nameId(props.id)}
      aria-invalid={invalid}
      aria-describedby={described}
    >
      {options.map((option, i) => (
        <label key={i} className={`jotl-option ${styles.option}`} htmlFor={optionId(props.id, i)}>
          <input
            {...attributes}
            id={optionId(props.id, i)}
            type="checkbox"
            className={`jotl-checkbox ${styles.checkbox}`}
            checked={isChecked(option)}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              // 按选项顺序重建, 保持写回顺序稳定; 不在选项中的已有值原样保留在末尾.
              const extras = current.filter((item) => !options.some((o) => deepEqual(o.value, item)));
              const next = options
                .filter((o) => (o === option ? e.target.checked : isChecked(o)))
                .map((o) => o.value);
              props.onChange([...next, ...extras]);
            }}
          />
          <span className="jotl-option-label">{option.label}</span>
        </label>
      ))}
    </div>
  );
}
