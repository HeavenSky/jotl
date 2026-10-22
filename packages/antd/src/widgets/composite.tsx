// 复合组件 nullable / tree / union: 行为与 @jotl/form 的原生组件一致, 置空开关用 Checkbox, 展开开关用 Button, 分支选择用 Select 或 Segmented.
// 本节点的错误由组件自己显示在末尾(外壳不显示), 根元素经 aria-describedby 引用.
import type { ReactNode } from "react";
import { Button, Checkbox, Segmented, Select, Typography } from "antd";
import type { Diagnostic } from "@jotl/core";
import { branchSelector, errorId, useL10n } from "@jotl/form";
import type { NullableProps, TreeProps, UnionProps } from "@jotl/form/core";
import { groupAttributes } from "../shared.js";

function ErrorList({ id, errors }: { id: string; errors: readonly Diagnostic[] }) {
	if (errors.length === 0) return null;
	return (
		<div id={errorId(id)} className="jotl-errors" role="alert">
			{errors.map((error, i) => (
				<Typography.Text
					key={i}
					type="danger"
					className="jotl-error"
					style={{ display: "block" }}
				>
					{error.message}
				</Typography.Text>
			))}
		</div>
	);
}

/** 置空开关 + 非空时由 renderContent() 渲染的原组件; 为空时不调用 renderContent(). */
export function AntdNullableWidget(props: NullableProps<ReactNode>) {
	const t = useL10n();
	return (
		<div
			{...groupAttributes(props.id, props.errors)}
			className="jotl-nullable jotl-antd-nullable"
		>
			<Checkbox
				id={`${props.id}-null`}
				className="jotl-nullable-toggle"
				checked={props.isNull}
				disabled={props.mode !== "edit"}
				onChange={e => props.setNull(e.target.checked)}
			>
				{t("置为空", "Set to null")}
			</Checkbox>
			<div style={{ marginTop: 8 }}>
				{props.isNull ? (
					<Typography.Text type="secondary" italic className="jotl-null">
						{t("空值", "null")}
					</Typography.Text>
				) : (
					<div className="jotl-nullable-content">{props.renderContent()}</div>
				)}
			</div>
			<ErrorList id={props.id} errors={props.errors} />
		</div>
	);
}

/** 展开开关 + 展开时由 renderContent() 渲染的内容; 折叠时不调用 renderContent(), 递归结构不会被提前展开. 展开是展示操作, 只有 disabled 时禁用. */
export function AntdTreeWidget(props: TreeProps<ReactNode>) {
	const t = useL10n();
	const contentId = `${props.id}-content`;
	return (
		<div {...groupAttributes(props.id, props.errors)} className="jotl-tree jotl-antd-tree">
			<Button
				size="small"
				className="jotl-tree-toggle"
				aria-expanded={props.expanded}
				aria-controls={props.expanded ? contentId : undefined}
				disabled={props.mode === "disabled"}
				onClick={() => props.setExpanded(!props.expanded)}
			>
				{props.expanded ? t("收起", "Collapse") : t("展开", "Expand")}
			</Button>
			{props.expanded && (
				<div
					id={contentId}
					className="jotl-tree-content"
					style={{
						marginTop: 8,
						paddingLeft: 16,
						borderLeft: "2px solid var(--ant-color-border-secondary, #f0f0f0)",
					}}
				>
					{props.renderContent()}
				</div>
			)}
			<ErrorList id={props.id} errors={props.errors} />
		</div>
	);
}

/** 分支选择 + 由 renderContent() 渲染的当前分支内容; 只有一个分支时不显示选择; props.selector 为 "buttons" 且分支不多时用 Segmented, 否则用 Select. */
export function AntdUnionWidget(props: UnionProps<ReactNode>) {
	const t = useL10n();
	const label = t("类型", "Type");
	const options = props.branches.map((branch, i) => ({ label: branch.title, value: i }));
	const disabled = props.mode !== "edit";
	return (
		<div {...groupAttributes(props.id, props.errors)} className="jotl-union jotl-antd-union">
			<div
				className="jotl-union-row"
				style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 8 }}
			>
				{props.branches.length > 1 && (
					<div className="jotl-union-branch" style={{ flex: "none" }}>
						{branchSelector(props) === "buttons" ? (
							<Segmented<number>
								className="jotl-union-buttons"
								aria-label={label}
								name={`${props.id}-branch`}
								options={options}
								value={props.activeBranch}
								disabled={disabled}
								onChange={index => props.selectBranch(index)}
							/>
						) : (
							<Select<number>
								id={`${props.id}-branch`}
								className="jotl-select"
								aria-label={label}
								style={{ minWidth: 120 }}
								options={options}
								value={props.activeBranch}
								disabled={disabled}
								onChange={index => props.selectBranch(index)}
							/>
						)}
					</div>
				)}
				<div className="jotl-union-content" style={{ flex: "1 1 16rem", minWidth: 0 }}>
					{props.renderContent()}
				</div>
			</div>
			<ErrorList id={props.id} errors={props.errors} />
		</div>
	);
}
