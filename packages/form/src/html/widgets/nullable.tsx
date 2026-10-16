// 可空组件: 置空开关 + 非空时由 renderContent() 渲染的原组件.
import type { ChangeEvent } from "react";
import { useCopy } from "../copy.js";
import { errorId } from "../ids.js";
import { groupAttributes, type HtmlNullableProps } from "../props.js";
import { ErrorList } from "./error-list.js";
import { styles } from "../styles.js";

export function NullableWidget(props: HtmlNullableProps) {
  const COPY = useCopy();
  const toggleId = `${props.id}-null`;
  return (
    <div {...groupAttributes(props.id, props.errors)} className={`jotl-nullable ${styles.nullable}`}>
      <label className={`jotl-option jotl-nullable-toggle ${styles.option}`} htmlFor={toggleId}>
        <input
          id={toggleId}
          type="checkbox"
          className={`jotl-checkbox ${styles.checkbox}`}
          checked={props.isNull}
          disabled={props.mode !== "edit"}
          onChange={(e: ChangeEvent<HTMLInputElement>) => props.setNull(e.target.checked)}
        />
        <span className="jotl-option-label">{COPY.setNull}</span>
      </label>
      {props.isNull ? (
        <span className={`jotl-null ${styles.null}`}>{COPY.nullValue}</span>
      ) : (
        <div className={`jotl-nullable-content ${styles.stretch}`}>{props.renderContent()}</div>
      )}
      {props.errors.length > 0 && <ErrorList id={errorId(props.id)} errors={props.errors} />}
    </div>
  );
}
