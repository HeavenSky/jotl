// 组件登记: antdWidgets() 给出已用 antd 实现的内置 widget 名, 未覆盖的名字经 createAntdRegistry() 的父注册表回落到 @jotl/form 的原生组件.
import type { ComponentType } from "react";
import { createDefaultRegistry, type ReactRegistry } from "@jotl/form";
import {
	BUILTIN_WIDGETS,
	type BuiltinWidgetName,
	type Registry,
	type WidgetRegistration,
} from "@jotl/form/core";
import { AntdListWidget } from "./widgets/array.js";
import {
	AntdCheckboxWidget,
	AntdRadioWidget,
	AntdSelectWidget,
	AntdSwitchWidget,
} from "./widgets/choice.js";
import { AntdColorWidget } from "./widgets/color.js";
import { AntdNullableWidget, AntdTreeWidget, AntdUnionWidget } from "./widgets/composite.js";
import { AntdFieldDecorator } from "./widgets/field.js";
import { AntdFormWidget } from "./widgets/form.js";
import {
	AntdEmailWidget,
	AntdInputWidget,
	AntdNumberWidget,
	AntdPasswordWidget,
	AntdRangeWidget,
	AntdTextareaWidget,
	AntdUrlWidget,
} from "./widgets/inputs.js";
import { AntdPageWidget } from "./widgets/object.js";
import { AntdOutputWidget } from "./widgets/output.js";
import { temporalWidgets, type DayjsFactory } from "./widgets/temporal.js";

export type AntdWidgetComponent = ComponentType<any>;

export interface AntdWidgetOptions {
	/** antd 所用的 dayjs; 传入后 date time datetime 用 DatePicker / TimePicker, 不传时这三个名字回落到原生日期组件. */
	dayjs?: DayjsFactory;
}

const COMPONENTS: Partial<Record<BuiltinWidgetName, AntdWidgetComponent>> = {
	form: AntdFormWidget,
	field: AntdFieldDecorator,
	page: AntdPageWidget,
	inline: AntdPageWidget,
	input: AntdInputWidget,
	textarea: AntdTextareaWidget,
	password: AntdPasswordWidget,
	url: AntdUrlWidget,
	email: AntdEmailWidget,
	number: AntdNumberWidget,
	range: AntdRangeWidget,
	switch: AntdSwitchWidget,
	checkbox: AntdCheckboxWidget,
	radio: AntdRadioWidget,
	select: AntdSelectWidget,
	color: AntdColorWidget,
	output: AntdOutputWidget,
	list: AntdListWidget,
	union: AntdUnionWidget,
	nullable: AntdNullableWidget,
	tree: AntdTreeWidget,
};

/** 已用 antd 实现的内置 widget 登记; 不带 accepts, 形态检查由 @jotl/form/core 的 plan() 完成. */
export function antdWidgets(
	options: AntdWidgetOptions = {}
): WidgetRegistration<AntdWidgetComponent>[] {
	const components: Partial<Record<BuiltinWidgetName, AntdWidgetComponent>> = {
		...COMPONENTS,
		...(options.dayjs === undefined ? {} : temporalWidgets(options.dayjs)),
	};
	return (Object.keys(components) as BuiltinWidgetName[]).map(name => ({
		name,
		level: BUILTIN_WIDGETS[name].level,
		component: components[name]!,
	}));
}

/** 把 antdWidgets(options) 全部登记到给定注册表, 同名覆盖. */
export function registerAntdWidgets(
	registry: Pick<Registry<AntdWidgetComponent>, "register">,
	options: AntdWidgetOptions = {}
): void {
	for (const registration of antdWidgets(options)) registry.register(registration);
}

/** 以 @jotl/form 默认注册表为父级的新注册表, 登记了 antd 组件; 未覆盖的名字回落到原生组件. 每次调用得到新的注册表. */
export function createAntdRegistry(options: AntdWidgetOptions = {}): ReactRegistry {
	const registry = createDefaultRegistry().extend();
	registerAntdWidgets(registry, options);
	return registry;
}
