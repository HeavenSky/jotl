// 错误列表: 外壳, 数组与表单共用的错误显示元素; 传 onSelect 时条目为可点击定位的按钮(表单级列表).
import type { Diagnostic } from "@jotl/core";
import { useCopy } from "../copy.js";
import { styles } from "../styles.js";

export function ErrorList({ id, errors, onSelect }: { id?: string; errors: readonly Diagnostic[]; onSelect?: ((error: Diagnostic) => void) | undefined }) {
  const COPY = useCopy();
  return (
    <div id={id} className={`jotl-errors ${styles.errors}`} role="alert">
      {errors.map((error, i) => (
        <p key={i} className={`jotl-error ${styles.error}`}>
          {onSelect === undefined ? (
            error.message
          ) : (
            <button type="button" className={`jotl-error-link ${styles.errorLink}`} aria-label={COPY.goToError(error.message)} onClick={() => onSelect(error)}>
              {error.message}
            </button>
          )}
        </p>
      ))}
    </div>
  );
}
