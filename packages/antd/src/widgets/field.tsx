// 字段外壳: antd Form.Item 显示标签, 必填标记, 帮助文本与错误; 错误与说明元素的 id 供输入控件的 aria-describedby 引用.
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Form } from "antd";
import { descriptionId, errorId, labelId } from "@jotl/form";
import type { DecoratorProps } from "@jotl/form/core";

/** HTML 中可经 label 的 for 关联的元素(input 另需排除 type=hidden). */
const LABELABLE = new Set(["BUTTON", "INPUT", "METER", "OUTPUT", "PROGRESS", "SELECT", "TEXTAREA"]);

function isLabelable(element: Element | null): boolean {
  if (element === null || !LABELABLE.has(element.tagName)) return false;
  return element.tagName !== "INPUT" || (element as HTMLInputElement).type !== "hidden";
}

export function AntdFieldDecorator(props: DecoratorProps<ReactNode>) {
  const labelText = useRef<HTMLSpanElement>(null);
  // 与 @jotl/form 的 html 外壳一致: 渲染后按 id 所指的实际元素决定, 单一输入控件用 for, 复合组件只靠自己的 aria-labelledby.
  // for 不交给 Form.Item 的 htmlFor: React 只在属性值变化时才写, 这里移除后内层换成输入控件也不会被补回.
  useLayoutEffect(() => {
    const label = labelText.current?.closest("label");
    if (label === null || label === undefined) return;
    if (isLabelable(label.ownerDocument.getElementById(props.id))) label.htmlFor = props.id;
    else label.removeAttribute("for");
  });
  const invalid = props.errors.length > 0;
  const hasLabel = props.label !== undefined && props.label !== "";
  const hasDescription = props.description !== undefined && props.description !== "";
  return (
    <Form.Item
      className="jotl-field jotl-antd-field"
      hidden={props.hidden}
      required={props.required}
      label={
        hasLabel ? (
          <span ref={labelText} id={labelId(props.id)}>
            {props.label}
          </span>
        ) : undefined
      }
      validateStatus={invalid ? "error" : ""}
      help={
        invalid ? (
          <div id={errorId(props.id)} className="jotl-errors" role="alert">
            {props.errors.map((error, i) => (
              <div key={i} className="jotl-error">
                {error.message}
              </div>
            ))}
          </div>
        ) : undefined
      }
      extra={hasDescription ? <span id={descriptionId(props.id)}>{props.description}</span> : undefined}
    >
      {props.children}
    </Form.Item>
  );
}
