// Ant Design 组件包: 按 @jotl/form 的 widget 契约用 antd 实现内置 widget, 未覆盖的名字回落到原生组件.
export {
	antdWidgets,
	createAntdRegistry,
	registerAntdWidgets,
	type AntdWidgetComponent,
	type AntdWidgetOptions,
} from "./registrations.js";
export { AntdListWidget } from "./widgets/array.js";
export {
	AntdCheckboxWidget,
	AntdRadioWidget,
	AntdSelectWidget,
	AntdSwitchWidget,
} from "./widgets/choice.js";
export { AntdColorWidget } from "./widgets/color.js";
export { AntdNullableWidget, AntdTreeWidget, AntdUnionWidget } from "./widgets/composite.js";
export { AntdFieldDecorator } from "./widgets/field.js";
export { AntdFormWidget } from "./widgets/form.js";
export {
	AntdEmailWidget,
	AntdInputWidget,
	AntdNumberWidget,
	AntdPasswordWidget,
	AntdRangeWidget,
	AntdTextareaWidget,
	AntdUrlWidget,
} from "./widgets/inputs.js";
export { AntdPageWidget } from "./widgets/object.js";
export { AntdOutputWidget } from "./widgets/output.js";
export {
	temporalWidgets,
	type AntdDayjs,
	type DayjsFactory,
	type TemporalKind,
} from "./widgets/temporal.js";
export type { AntdFieldProps } from "./shared.js";
