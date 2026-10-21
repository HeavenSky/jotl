// 内置最小兜底(F6): 查看态为只读 pre, 其余为 JSON 文本框; 没有任何组件包时也能显示和编辑数据.
import { useState, type ChangeEvent } from 'react';
import type { FieldProps } from '../core/index.js';
import type { ReactNode } from 'react';
import { copyOf } from './diagnostics.js';
import { useLocale } from '../locale-context.js';
import { cn, styles as htmlStyles } from '../html/index.js';

function formatJson(value: unknown): string {
  return value === undefined ? '' : JSON.stringify(value, null, 2);
}

export function MinimalJson(props: FieldProps<unknown, ReactNode>) {
  // 草稿只在文本不是合法 JSON 时保留; 对应的值变了(外部改动)就作废.
  const COPY = copyOf(useLocale());
  const [draft, setDraft] = useState<{ text: string; base: unknown } | null>(null);
  const active = draft !== null && draft.base === props.value ? draft : null;
  if (props.mode === 'view') {
    return (
      <pre id={props.id} className={cn('jotl-json jotl-json--view', htmlStyles.json, htmlStyles.jsonView)}>
        {formatJson(props.value)}
      </pre>
    );
  }
  const invalid = active !== null || props.errors.length > 0;
  return (
    <>
      <textarea
        id={props.id}
        className={cn('jotl-input jotl-json', htmlStyles.input, htmlStyles.json)}
        spellCheck={false}
        disabled={props.mode === 'disabled'}
        aria-invalid={invalid ? true : undefined}
        value={active?.text ?? formatJson(props.value)}
        onBlur={() => props.onBlur()}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
          const text = e.target.value;
          if (text.trim() === '') {
            setDraft(null);
            props.onChange(undefined);
            return;
          }
          try {
            const parsed: unknown = JSON.parse(text);
            setDraft(null);
            props.onChange(parsed);
          } catch {
            setDraft({ text, base: props.value });
          }
        }}
      />
      {active !== null && (
        <span className={`jotl-draft-error ${htmlStyles.error}`} role="alert">
          {COPY.jsonInvalid}
        </span>
      )}
      {props.errors.length > 0 && (
        <div className={`jotl-errors ${htmlStyles.errors}`} role="alert">
          {props.errors.map((error, i) => (
            <p key={i} className={`jotl-error ${htmlStyles.error}`}>
              {error.message}
            </p>
          ))}
        </div>
      )}
    </>
  );
}
