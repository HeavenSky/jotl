// 元组组件 tuple: 按位置排列 prefixItems 各项, 第 i 项用 renderChild(String(i)) 渲染, 位置标签由外壳给出; 位置不增删, items 允许的剩余元素在其后列出并可增删.
import { useCopy } from "../copy.js";
import { errorId } from "../ids.js";
import { groupAttributes, type HtmlTupleProps } from "../props.js";
import { cn, styles } from "../styles.js";
import { ErrorList } from "./error-list.js";

const actionLink = cn(styles.link, styles.mutedLink);

export function TupleWidget(props: HtmlTupleProps) {
  const COPY = useCopy();
  const { rest } = props;
  const showActions = props.mode !== "view";
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
            {rest.items.map((item) => (
              <li key={item.key} className={`jotl-tuple-rest-item ${styles.arrayItem}`}>
                <div className={`jotl-array-item-content ${styles.arrayItemContent}`}>{props.renderChild(String(item.index))}</div>
                {showActions && (
                  <div className={`jotl-array-item-actions ${styles.arrayItemActions}`}>
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
