// 表单根组件: 提交与重置交给渲染器, 阻止浏览器默认行为; 显示不属于可见字段的错误, 渲染器提供 goToError 时条目可点击定位.
import type { FormEvent } from "react";
import { useCopy } from "../copy.js";
import { errorId } from "../ids.js";
import type { HtmlViewProps } from "../props.js";
import { styles } from "../styles.js";
import { ErrorList } from "./error-list.js";

export function FormWidget(props: HtmlViewProps) {
  const COPY = useCopy();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (props.mode === "edit") props.submit();
  };
  const onReset = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (props.mode === "edit") props.reset();
  };
  return (
    // noValidate: 校验由 Jotl 完成, 去掉后原生 pattern / maxLength 校验会拦下提交而不调用 submit().
    <form id={props.id} className={`jotl-form jotl-form--${props.mode} ${styles.form}`} noValidate onSubmit={onSubmit} onReset={onReset}>
      {props.errors.length > 0 && <ErrorList id={errorId(props.id)} errors={props.errors} onSelect={props.goToError} />}
      {props.children}
      {props.mode === "edit" && (
        <div className={`jotl-form-actions ${styles.formActions}`}>
          <button type="submit" className={`jotl-button jotl-button--primary ${styles.button({ primary: true })}`}>
            {COPY.submit}
          </button>
          <button type="reset" className={`jotl-button ${styles.button()}`}>
            {COPY.reset}
          </button>
        </div>
      )}
    </form>
  );
}
