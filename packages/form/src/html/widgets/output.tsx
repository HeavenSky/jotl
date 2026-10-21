// 只读显示组件 output: 显示当前值, 没有值时显示 const; 任意形态都可用.
import { formatValue } from "../format-value.js";
import { contentLabelledBy } from "../ids.js";
import type { HtmlFieldProps } from "../props.js";
import { styles } from "../styles.js";

export function OutputWidget(props: HtmlFieldProps<unknown>) {
	const shown = props.value === undefined ? props.schema.const : props.value;
	return (
		<output
			id={props.id}
			aria-labelledby={contentLabelledBy(props.id)}
			className={`jotl-output ${styles.output}`}
			aria-invalid={props.errors.length > 0 ? true : undefined}
		>
			{formatValue(shown)}
		</output>
	);
}
