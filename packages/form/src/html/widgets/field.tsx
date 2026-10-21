// 字段外壳: 标签, 必填标记, 帮助文本与错误; 错误元素的 id 供输入控件的 aria-describedby 引用.
import { useLayoutEffect, useRef } from 'react';
import { useCopy } from '../copy.js';
import { descriptionId, errorId, labelId } from '../ids.js';
import { className, type HtmlDecoratorProps } from '../props.js';
import { styles } from '../styles.js';
import { ErrorList } from './error-list.js';

/** HTML 中可经 label 的 for 关联的元素(input 另需排除 type=hidden). */
const LABELABLE = new Set(['BUTTON', 'INPUT', 'METER', 'OUTPUT', 'PROGRESS', 'SELECT', 'TEXTAREA']);

function isLabelable(element: Element | null): boolean {
  if (element === null || !LABELABLE.has(element.tagName)) return false;
  return element.tagName !== 'INPUT' || (element as HTMLInputElement).type !== 'hidden';
}

export function FieldDecorator(props: HtmlDecoratorProps) {
  const COPY = useCopy();
  const label = useRef<HTMLLabelElement>(null);
  // 外壳不知道内层组件的根元素是什么, 渲染后按实际元素决定: 单一输入控件用 for, 数组, 对象等复合组件只靠它们自己的 aria-labelledby.
  // for 不能交给 React 的 htmlFor: React 只在属性值变化时才写, 这里移除后内层换成输入控件也不会被补回.
  useLayoutEffect(() => {
    const element = label.current;
    if (element === null) return;
    if (isLabelable(element.ownerDocument.getElementById(props.id))) element.htmlFor = props.id;
    else element.removeAttribute('for');
  });
  const invalid = props.errors.length > 0;
  return (
    <div
      className={className(
        'jotl-field',
        props.required && 'jotl-field--required',
        invalid && 'jotl-field--invalid',
        styles.field
      )}
      hidden={props.hidden}
    >
      {props.label !== undefined && props.label !== '' && (
        // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- 控件经 aria-labelledby 引用本 label 的 id, 复合控件无法用 htmlFor 关联
        <label ref={label} id={labelId(props.id)} className={`jotl-label ${styles.label}`}>
          {props.label}
          {props.required && (
            <abbr className={`jotl-required ${styles.required}`} title={COPY.requiredHint}>
              {COPY.requiredMark}
            </abbr>
          )}
        </label>
      )}
      <div className="jotl-field-control">{props.children}</div>
      {props.description !== undefined && props.description !== '' && (
        <p id={descriptionId(props.id)} className={`jotl-description ${styles.description}`}>
          {props.description}
        </p>
      )}
      {invalid && <ErrorList id={errorId(props.id)} errors={props.errors} />}
    </div>
  );
}
