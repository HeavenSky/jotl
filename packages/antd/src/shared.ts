// antd 组件共用: props 别名, 关联元素 id, 校验状态与控件的 aria 属性.
import type { ReactNode } from "react";
import type { Diagnostic } from "@jotl/core";
import { describedBy, labelId } from "@jotl/form";
import type { FieldProps } from "@jotl/form/core";

export type AntdFieldProps<V = unknown> = FieldProps<V, ReactNode>;

/** 可访问名称所指的外壳标签: 内容节点(id 以 "+" 结尾)没有自己的外壳, 取外围节点的标签; 必须与 @jotl/form 的 nameId 一致. */
export function nameId(id: string): string {
	return labelId(id.replace(/\++$/, ""));
}

/** antd 输入控件的 status; 空串表示无状态. */
export function statusOf(errors: readonly Diagnostic[]): "error" | "" {
	return errors.length > 0 ? "error" : "";
}

export interface AriaAttributes {
	"aria-invalid": true | undefined;
	"aria-required": true | undefined;
	"aria-describedby": string | undefined;
	"aria-labelledby": string | undefined;
}

export function ariaAttributes(props: AntdFieldProps): AriaAttributes {
	return {
		"aria-invalid": props.errors.length > 0 ? true : undefined,
		"aria-required": props.required ? true : undefined,
		"aria-describedby": describedBy(props.id, props.schema.description, props.errors),
		"aria-labelledby": props.id.endsWith("+") ? nameId(props.id) : undefined,
	};
}

/** 文本类控件: view 只读, disabled 禁用. */
export function textAttributes(props: AntdFieldProps) {
	return {
		...ariaAttributes(props),
		id: props.id,
		status: statusOf(props.errors),
		disabled: props.mode === "disabled",
		readOnly: props.mode === "view",
		onBlur: () => props.onBlur(),
	};
}

/** 选择类控件没有只读, view 与 disabled 都禁用. */
export function choiceDisabled(props: AntdFieldProps): boolean {
	return props.mode !== "edit";
}
