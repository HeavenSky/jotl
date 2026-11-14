// 数组组件 list: 右上角图标新增 + 有序列表, 每项带图标操作按钮 上移, 下移, 复制(渲染器提供 duplicate 时), 删除; 图标按钮的可访问名取文案表完整条目文案.
import { useCopy } from "../copy.js";
import { AddIcon, DuplicateIcon, MoveDownIcon, MoveUpIcon, RemoveIcon } from "../icons.js";
import { errorId } from "../ids.js";
import { groupAttributes, type HtmlArrayProps } from "../props.js";
import { cn, styles } from "../styles.js";
import { ErrorList } from "./error-list.js";

const actionLink = cn(styles.link, styles.mutedLink);

export function ListWidget(props: HtmlArrayProps) {
	const COPY = useCopy();
	const editable = props.mode === "edit";
	const showActions = props.mode !== "view";
	const last = props.items.length - 1;
	return (
		<div {...groupAttributes(props.id, props.errors)} className={`jotl-array ${styles.array}`}>
			{showActions && (
				<div className={`jotl-array-header ${styles.arrayHeader}`}>
					<button
						type="button"
						className={cn("jotl-link jotl-array-add", styles.link, styles.iconButton)}
						title={COPY.add}
						aria-label={COPY.add}
						disabled={!props.canAdd}
						onClick={() => props.add()}
					>
						<AddIcon />
					</button>
				</div>
			)}
			<ol className={`jotl-array-items ${styles.arrayItems}`}>
				{props.items.map((item, i) => (
					<li key={item.key} className={`jotl-array-item ${styles.arrayItem}`}>
						<div className={`jotl-array-item-content ${styles.arrayItemContent}`}>
							{props.renderChild(String(i))}
						</div>
						{showActions && (
							<div className={`jotl-array-item-actions ${styles.arrayItemActions}`}>
								<button
									type="button"
									className={cn("jotl-link jotl-array-move-up", actionLink)}
									title={COPY.moveItemUp(i)}
									aria-label={COPY.moveItemUp(i)}
									disabled={!editable || i === 0}
									onClick={() => props.move(i, i - 1)}
								>
									<MoveUpIcon />
								</button>
								<button
									type="button"
									className={cn("jotl-link jotl-array-move-down", actionLink)}
									title={COPY.moveItemDown(i)}
									aria-label={COPY.moveItemDown(i)}
									disabled={!editable || i === last}
									onClick={() => props.move(i, i + 1)}
								>
									<MoveDownIcon />
								</button>
								{props.duplicate !== undefined && (
									<button
										type="button"
										className={cn("jotl-link jotl-array-duplicate", actionLink)}
										title={COPY.duplicateItem(i)}
										aria-label={COPY.duplicateItem(i)}
										disabled={!props.canAdd}
										onClick={() => props.duplicate?.(i)}
									>
										<DuplicateIcon />
									</button>
								)}
								<button
									type="button"
									className={cn("jotl-link jotl-array-remove", actionLink)}
									title={COPY.removeItem(i)}
									aria-label={COPY.removeItem(i)}
									disabled={!props.canRemove}
									onClick={() => props.remove(i)}
								>
									<RemoveIcon />
								</button>
							</div>
						)}
					</li>
				))}
			</ol>
			{props.errors.length > 0 && <ErrorList id={errorId(props.id)} errors={props.errors} />}
		</div>
	);
}
