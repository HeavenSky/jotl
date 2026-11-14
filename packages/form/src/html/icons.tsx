// 各操作按钮的内联图标(新增, 上移, 下移, 复制, 删除, 展开, 收起, 富文本链接与列表); 与 style.css 既有 chevron 图标同为 12x12, 1.2 描边, 颜色取 currentColor, 禁用态随按钮文字色变灰.
const iconProps = {
	width: 12,
	height: 12,
	viewBox: "0 0 12 12",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.2,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": true,
	focusable: false,
} as const;

export function AddIcon() {
	return (
		<svg {...iconProps}>
			<path d="M6 2v8M2 6h8" />
		</svg>
	);
}

export function MoveUpIcon() {
	return (
		<svg {...iconProps}>
			<path d="M6 9.5v-7M2.5 6 6 2.5 9.5 6" />
		</svg>
	);
}

export function MoveDownIcon() {
	return (
		<svg {...iconProps}>
			<path d="M6 2.5v7M2.5 6 6 9.5 9.5 6" />
		</svg>
	);
}

export function DuplicateIcon() {
	return (
		<svg {...iconProps}>
			<rect x="1.5" y="4.5" width="6" height="6" rx="1" />
			<path d="M4.5 1.5H9a1 1 0 0 1 1 1v4.5" />
		</svg>
	);
}

export function RemoveIcon() {
	return (
		<svg {...iconProps}>
			<path d="M1.5 3.5h9M4.5 3.5V2a.5.5 0 0 1 .5-.5h2a.5.5 0 0 1 .5.5v1.5M2.5 3.5l.5 7h6l.5-7M5 5.5v3M7 5.5v3" />
		</svg>
	);
}

/** 展开开关: 折叠时朝右, 展开时朝下, 朝向与 style.css 下拉框的 chevron 一致. */
export function ExpandIcon() {
	return (
		<svg {...iconProps}>
			<path d="M4.5 2.5 8 6l-3.5 3.5" />
		</svg>
	);
}

export function CollapseIcon() {
	return (
		<svg {...iconProps}>
			<path d="M2.5 4.5 6 8l3.5-3.5" />
		</svg>
	);
}

/** 富文本工具栏: 链接(链条), 无序列表(圆点), 有序列表(数字). */
export function LinkIcon() {
	return (
		<svg {...iconProps}>
			<path d="M6.5 3.5H8a2.5 2.5 0 0 1 0 5H6.5m-3 0H3a2.5 2.5 0 0 1 0-5h1.5M4 6h4" />
		</svg>
	);
}

export function BulletListIcon() {
	return (
		<svg {...iconProps}>
			<path d="M4 3h6.5M4 6h6.5M4 9h6.5M1.5 3h.01M1.5 6h.01M1.5 9h.01" />
		</svg>
	);
}

export function OrderedListIcon() {
	return (
		<svg {...iconProps}>
			<path d="M5 3h5.5M5 6h5.5M5 9h5.5M2 3h.5v2M3 5H1M3 9H1c0-1.25 2-1.25 2-2.5" />
		</svg>
	);
}
