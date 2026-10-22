// 只读显示组件 output: 原生 <output> 保留可关联标签与 status 语义, 内容用 Typography.Text 显示当前值, 没有值时显示 const.
import { Typography } from "antd";
import { nameId, type AntdFieldProps } from "../shared.js";

/** 任意 JSON 值的单行显示文本: 字符串取原文, 其余取 JSON 文本; 与 @jotl/form 的 output 一致. */
function formatValue(value: unknown): string {
	if (value === undefined) return "";
	return typeof value === "string" ? value : JSON.stringify(value);
}

export function AntdOutputWidget(props: AntdFieldProps<unknown>) {
	const shown = props.value === undefined ? props.schema.const : props.value;
	const invalid = props.errors.length > 0;
	return (
		<output
			id={props.id}
			aria-labelledby={props.id.endsWith("+") ? nameId(props.id) : undefined}
			className="jotl-output"
			aria-invalid={invalid ? true : undefined}
		>
			<Typography.Text {...(invalid ? { type: "danger" as const } : {})}>
				{formatValue(shown)}
			</Typography.Text>
		</output>
	);
}
