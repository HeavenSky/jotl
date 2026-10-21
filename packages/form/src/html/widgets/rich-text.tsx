// 富文本组件: 有 adapters.richText 时交给它渲染, 否则退化为多行文本框; RichTextEditor 是可经 adapters.richText 接入的 contenteditable 最小编辑器.
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useCopy } from '../copy.js';
import { describedBy, nameId } from '../ids.js';
import type { HtmlFieldProps } from '../props.js';
import { isSafeUrl, sanitizeHtml } from '../sanitize-html.js';
import { cn, styles } from '../styles.js';
import { TextareaWidget } from './string-inputs.js';

export function RichTextWidget(props: HtmlFieldProps<string>) {
  const richText = props.adapters.richText;
  if (richText !== undefined) return <>{richText(props)}</>;
  return <TextareaWidget {...props} />;
}

/** label 与 text 为文案键; text 为 undefined 时按钮显示固定的 glyph. */
const COMMANDS = [
  { command: 'bold', label: 'bold', text: undefined, glyph: 'B', className: 'jt:font-bold' },
  { command: 'italic', label: 'italic', text: undefined, glyph: 'I', className: 'jt:italic' },
  { command: 'createLink', label: 'link', text: 'link', glyph: '', className: '' },
  { command: 'insertUnorderedList', label: 'bulletList', text: 'bulletList', glyph: '', className: '' },
  { command: 'insertOrderedList', label: 'orderedList', text: 'orderedList', glyph: '', className: '' },
] as const;

/** 值为 HTML 字符串; 写入与显示都经白名单清洗, 内容为空时写回 undefined. */
export function RichTextEditor(props: HtmlFieldProps<string>) {
  const COPY = useCopy();
  const editor = useRef<HTMLDivElement>(null);
  // 最后一次写回的值: value 等于它时编辑区就是数据来源, 不重设内容, 以免光标跳动.
  const emitted = useRef<string | undefined>(undefined);
  const html = typeof props.value === 'string' ? props.value : '';
  const editable = props.mode === 'edit';

  useLayoutEffect(() => {
    const element = editor.current;
    if (element === null || emitted.current === html) return;
    element.innerHTML = sanitizeHtml(html);
    emitted.current = html;
  }, [html]);

  const emit = () => {
    const element = editor.current;
    if (element === null) return;
    const next = element.textContent === '' ? undefined : sanitizeHtml(element.innerHTML);
    emitted.current = next ?? '';
    props.onChange(next);
  };

  const run = (command: (typeof COMMANDS)[number]['command']) => {
    let arg: string | undefined;
    if (command === 'createLink') {
      const url = window.prompt(COPY.linkPrompt, 'https://')?.trim();
      if (url === undefined || url === '' || !isSafeUrl(url)) return;
      arg = url;
    }
    editor.current?.focus();
    // execCommand 已不推荐但各浏览器仍支持, 是不引入编辑器依赖时最省事的格式化方式.
    if (typeof document.execCommand === 'function') document.execCommand(command, false, arg);
    emit();
  };

  const invalid = props.errors.length > 0;
  let toolbar: ReactNode = null;
  if (props.mode !== 'view') {
    toolbar = (
      <div
        className={`jotl-richtext-toolbar ${styles.richTextToolbar}`}
        role="toolbar"
        aria-label={COPY.richTextToolbar}
        aria-controls={props.id}
      >
        {COMMANDS.map(item => (
          <button
            key={item.command}
            type="button"
            className={cn('jotl-button jotl-richtext-command', styles.button(), styles.richTextButton, item.className)}
            aria-label={COPY[item.label]}
            disabled={!editable}
            // 按下时不夺走编辑区的焦点与选区.
            onMouseDown={e => e.preventDefault()}
            onClick={() => run(item.command)}
          >
            {item.text === undefined ? item.glyph : COPY[item.text]}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className={`jotl-richtext ${styles.richText}`}>
      {toolbar}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 富文本靠 contenteditable 承载格式, textarea 与 input 无法替代 */}
      <div
        ref={editor}
        id={props.id}
        role="textbox"
        aria-multiline={true}
        aria-labelledby={nameId(props.id)}
        aria-describedby={describedBy(props.id, props.schema.description, props.errors)}
        aria-invalid={invalid ? true : undefined}
        aria-required={props.required ? true : undefined}
        aria-readonly={props.mode === 'view' ? true : undefined}
        aria-disabled={props.mode === 'disabled' ? true : undefined}
        contentEditable={editable}
        suppressContentEditableWarning
        tabIndex={props.mode === 'disabled' ? -1 : 0}
        className={cn('jotl-richtext-editor', styles.richTextEditor)}
        onInput={emit}
        onBlur={() => props.onBlur()}
      />
    </div>
  );
}

/** 作为 adapters.richText 传入即启用 RichTextEditor. */
export function richTextEditor(props: HtmlFieldProps<string>): ReactNode {
  return <RichTextEditor {...props} />;
}
