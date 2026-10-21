// 勾选与选项: switch 用 Switch, checkbox 用 Checkbox / Checkbox.Group, radio 用 Radio.Group, select 用 Select(枚举数组为多选); 选项值按下标映射, 写回原值.
import { Checkbox, Radio, Select, Switch } from "antd";
import { isSchemaObject } from "@jotl/core";
import { useL10n } from "@jotl/form";
import { enumOptions, jsonEqual, schemaTypes, type EnumOption } from "@jotl/form/core";
import {
	ariaAttributes,
	choiceDisabled,
	nameId,
	statusOf,
	type AntdFieldProps,
} from "../shared.js";

/** 枚举数组(core/ 已按形态把 checkbox select 限定在布尔, 枚举与枚举数组上). */
function isEnumArray(schema: AntdFieldProps["schema"]): boolean {
	return schemaTypes(schema).includes("array") || schema.items !== undefined;
}

function itemOptions(schema: AntdFieldProps["schema"]): EnumOption[] {
	return (isSchemaObject(schema.items) ? enumOptions(schema.items) : undefined) ?? [];
}

function indexOfValue(options: readonly EnumOption[], value: unknown): number {
	return value === undefined ? -1 : options.findIndex(option => jsonEqual(option.value, value));
}

/** 多选的当前下标与不在选项中的已有值; 写回按选项顺序排列, 已有的额外值原样保留在末尾. */
function multiState(options: readonly EnumOption[], value: unknown) {
	const current = Array.isArray(value) ? value : [];
	const selected = options.flatMap((option, i) =>
		current.some(item => jsonEqual(item, option.value)) ? [i] : []
	);
	const extras = current.filter(item => !options.some(option => jsonEqual(option.value, item)));
	const write = (picked: readonly number[]) => {
		const set = new Set(picked);
		return [...options.filter((_, i) => set.has(i)).map(option => option.value), ...extras];
	};
	return { selected, write };
}

const indexed = (options: readonly EnumOption[]) =>
	options.map((option, i) => ({ label: option.label, value: i }));

export function AntdSwitchWidget(props: AntdFieldProps<boolean>) {
	return (
		<Switch
			{...ariaAttributes(props)}
			id={props.id}
			className="jotl-switch"
			disabled={choiceDisabled(props)}
			checked={props.value === true}
			onChange={checked => props.onChange(checked)}
		/>
	);
}

export function AntdCheckboxWidget(props: AntdFieldProps<unknown>) {
	if (isEnumArray(props.schema)) {
		const options = itemOptions(props.schema);
		const { selected, write } = multiState(options, props.value);
		return (
			<div
				id={props.id}
				role="group"
				aria-labelledby={nameId(props.id)}
				aria-invalid={props.errors.length > 0 ? true : undefined}
			>
				<Checkbox.Group
					className="jotl-checkbox-group"
					disabled={choiceDisabled(props)}
					options={indexed(options)}
					value={selected}
					onChange={picked => props.onChange(write(picked as number[]))}
				/>
			</div>
		);
	}
	return (
		<Checkbox
			{...ariaAttributes(props)}
			id={props.id}
			className="jotl-checkbox"
			disabled={choiceDisabled(props)}
			checked={props.value === true}
			onChange={e => props.onChange(e.target.checked)}
		/>
	);
}

export function AntdRadioWidget(props: AntdFieldProps<unknown>) {
	const options = enumOptions(props.schema) ?? [];
	const selected = indexOfValue(options, props.value);
	return (
		<Radio.Group
			id={props.id}
			className="jotl-radio-group"
			role="radiogroup"
			aria-labelledby={nameId(props.id)}
			aria-invalid={props.errors.length > 0 ? true : undefined}
			disabled={choiceDisabled(props)}
			options={indexed(options)}
			value={selected === -1 ? undefined : selected}
			onChange={e => props.onChange(options[e.target.value as number]?.value)}
		/>
	);
}

export function AntdSelectWidget(props: AntdFieldProps<unknown>) {
	const t = useL10n();
	const common = {
		...ariaAttributes(props),
		id: props.id,
		status: statusOf(props.errors),
		disabled: choiceDisabled(props),
		placeholder: t("请选择", "Select…"),
		style: { width: "100%" },
		onBlur: () => props.onBlur(),
	};
	if (isEnumArray(props.schema)) {
		const options = itemOptions(props.schema);
		const { selected, write } = multiState(options, props.value);
		return (
			<Select<number[]>
				{...common}
				className="jotl-select jotl-select--multiple"
				mode="multiple"
				options={indexed(options)}
				value={selected}
				onChange={picked => props.onChange(write(picked))}
			/>
		);
	}
	const options = enumOptions(props.schema) ?? [];
	const selected = indexOfValue(options, props.value);
	return (
		<Select<number | undefined>
			{...common}
			className="jotl-select"
			allowClear={!props.required}
			options={indexed(options)}
			value={selected === -1 ? undefined : selected}
			onChange={index =>
				props.onChange(
					index === undefined || index === null ? undefined : options[index]?.value
				)
			}
		/>
	);
}
