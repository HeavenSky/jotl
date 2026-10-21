// 元组组件 tuple: 按位置排列 prefixItems 各项, 第 i 项用 renderChild(String(i)) 渲染, 位置标签由外壳给出; 位置不增删, items 允许的剩余元素在其后列出, 可增删, 在剩余元素之间上移下移, 复制(渲染器提供时).
import { useCopy } from "../copy.js";
import { errorId } from "../ids.js";
import { groupAttributes, type HtmlTupleProps } from "../props.js";
import { cn, styles } from "../styles.js";
import { ErrorList } from "./error-list.js";

const actionLink = cn(styles.link, styles.mutedLink);

export function TupleWidget(props: HtmlTupleProps) {
  const COPY = useCopy();
  const { rest } = props;
  const editable = props.mode === "edit";
  const showActions = props.mode !== "view";
  const last = rest === undefined ? -1 : rest.items.length - 1;
  return (
    <div {...groupAttributes(props.id, props.errors)} className={`jotl-tuple ${styles.tuple}`}>
      <ol className={`jotl-tuple-items ${styles.tupleItems}`}>
        {props.items.map((_, i) => (
          <li key={i} className="jotl-tuple-item">
            {props.renderChild(String(i))}
          </li>
        ))}
      </ol>
      {rest !== undefined && (
        <div className={`jotl-tuple-rest ${styles.array}`}>
          {showActions && (
            <div className={`jotl-array-header ${styles.arrayHeader}`}>
              <button type="button" className={`jotl-link jotl-tuple-add ${styles.link}`} disabled={!rest.canAdd} onClick={() => rest.add()}>
                {COPY.add}
              </button>
            </div>
          )}
          <ol className={`jotl-tuple-rest-items ${styles.arrayItems}`}>
            {rest.items.map((item, j) => (
              <li key={item.key} className={`jotl-tuple-rest-item ${styles.arrayItem}`}>
                <div className={`jotl-array-item-content ${styles.arrayItemContent}`}>{props.renderChild(String(item.index))}</div>
                {showActions && (
                  <div className={`jotl-array-item-actions ${styles.arrayItemActions}`}>
                    {rest.move !== undefined && (
                      <>
                        <button
                          type="button"
                          className={cn("jotl-link jotl-tuple-move-up", actionLink)}
                          aria-label={COPY.moveItemUp(item.index)}
                          disabled={!editable || j === 0}
                          onClick={() => rest.move?.(item.index, item.index - 1)}
                        >
                          {COPY.moveUp}
                        </button>
                        <button
                          type="button"
                          className={cn("jotl-link jotl-tuple-move-down", actionLink)}
                          aria-label={COPY.moveItemDown(item.index)}
                          disabled={!editable || j === last}
                          onClick={() => rest.move?.(item.index, item.index + 1)}
                        >
                          {COPY.moveDown}
                        </button>
                      </>
                    )}
                    {rest.duplicate !== undefined && (
                      <button
                        type="button"
                        className={cn("jotl-link jotl-tuple-duplicate", actionLink)}
                        aria-label={COPY.duplicateItem(item.index)}
                        disabled={!rest.canAdd}
                        onClick={() => rest.duplicate?.(item.index)}
                      >
                        {COPY.duplicate}
                      </button>
                    )}
                    <button
                      type="button"
                      className={cn("jotl-link jotl-tuple-remove", actionLink)}
                      aria-label={COPY.removeItem(item.index)}
                      disabled={!rest.canRemove}
                      onClick={() => rest.remove(item.index)}
                    >
                      {COPY.remove}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {props.errors.length > 0 && <ErrorList id={errorId(props.id)} errors={props.errors} />}
    </div>
  );
}
