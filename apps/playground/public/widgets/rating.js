// 演示用扩展组件模块: 星级评分, field 级组件, 值为 1 到 props.max(默认 5)的整数; 纯 ESM, react 与 react/jsx-runtime 由宿主经 import map 提供.
import { useState } from "react";
import { jsx, jsxs } from "react/jsx-runtime";

const STYLE = {
	group: { display: "inline-flex", alignItems: "center", gap: "2px" },
	star: {
		border: 0,
		background: "none",
		padding: "0 2px",
		fontSize: "1.5rem",
		lineHeight: 1,
		cursor: "pointer",
		color: "#c9ced6",
	},
	on: { color: "#f5a623" },
	value: { marginLeft: "0.5rem", fontSize: "0.875rem", color: "#5f6670" },
};

export default function Rating({ id, value, onChange, onBlur, mode, props }) {
	const max = Number.isInteger(props?.max) && props.max > 0 ? props.max : 5;
	const [hover, setHover] = useState(0);
	const current = typeof value === "number" ? value : 0;
	const shown = hover || current;
	const editable = mode === "edit";
	const stars = Array.from({ length: max }, (_, i) => {
		const n = i + 1;
		return jsx(
			"button",
			{
				type: "button",
				role: "radio",
				"aria-checked": n === current,
				"aria-label": `${n} / ${max}`,
				disabled: !editable,
				style: n <= shown ? { ...STYLE.star, ...STYLE.on } : STYLE.star,
				onMouseEnter: () => setHover(n),
				onClick: () => onChange(n === current ? undefined : n),
				children: "★",
			},
			n
		);
	});
	return jsxs("div", {
		id,
		role: "radiogroup",
		"data-widget": "rating",
		style: STYLE.group,
		onMouseLeave: () => setHover(0),
		onBlur: () => onBlur(),
		children: [
			...stars,
			jsx(
				"span",
				{ style: STYLE.value, children: current === 0 ? "–" : `${current}/${max}` },
				"value"
			),
		],
	});
}
