// 树组件: 展开开关 + 展开时由 renderContent() 渲染的内容; 折叠时不调用 renderContent(), 递归结构不会被提前展开.
import { useCopy } from "../copy.js";
import { errorId } from "../ids.js";
import { groupAttributes, type HtmlTreeProps } from "../props.js";
import { ErrorList } from "./error-list.js";
import { styles } from "../styles.js";

export function TreeWidget(props: HtmlTreeProps) {
	const COPY = useCopy();
	const contentId = `${props.id}-content`;
	return (
		<div {...groupAttributes(props.id, props.errors)} className={`jotl-tree ${styles.tree}`}>
			<button
				type="button"
				className={`jotl-button jotl-tree-toggle ${styles.button()}`}
				aria-expanded={props.expanded}
				aria-controls={props.expanded ? contentId : undefined}
				disabled={props.mode === "disabled"}
				onClick={() => props.setExpanded(!props.expanded)}
			>
				{props.expanded ? COPY.collapse : COPY.expand}
			</button>
			{props.expanded && (
				<div id={contentId} className={`jotl-tree-content ${styles.treeContent}`}>
					{props.renderContent()}
				</div>
			)}
			{props.errors.length > 0 && <ErrorList id={errorId(props.id)} errors={props.errors} />}
		</div>
	);
}
