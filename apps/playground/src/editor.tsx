// 源码编辑器: 原生 textarea, 带行号栏, 诊断行标记, 光标行列显示, 以及按行列定位的实例方法.
import { useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import type { Severity } from '@jotl/core';
import type { LineColumn } from './compile.js';
import { useCopy } from './copy.js';
import { lineCount, offsetAt, positionAt } from './text-position.js';

export interface EditorHandle {
  /** 聚焦编辑器, 选中区间并滚动到起点所在行. */
  reveal(start: LineColumn, end?: LineColumn): void;
}

export interface EditorProps {
  value: string;
  onChange(value: string): void;
  /** 行号到该行最严重的诊断级别. */
  markers?: ReadonlyMap<number, Severity>;
  /** 显示在光标行列旁的状态文字. */
  status?: string;
  /** 编辑区的无障碍名称. */
  label: string;
  ref?: Ref<EditorHandle>;
}

const FALLBACK_LINE_HEIGHT = 20;
const NO_MARKERS: ReadonlyMap<number, Severity> = new Map();

export function Editor({ value, onChange, markers = NO_MARKERS, status, label, ref }: EditorProps) {
  const COPY = useCopy();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const gutter = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<LineColumn>({ line: 1, column: 1 });
  const lines = useMemo(() => lineCount(value), [value]);

  const syncCursor = () => {
    const el = textarea.current;
    if (el !== null) setCursor(positionAt(el.value, el.selectionStart));
  };
  const syncGutter = () => {
    if (gutter.current !== null && textarea.current !== null) gutter.current.scrollTop = textarea.current.scrollTop;
  };

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- syncGutter 只读写 ref, 闭包过期不影响结果, 句柄保持稳定
  useImperativeHandle(
    ref,
    () => ({
      reveal(start, end) {
        const el = textarea.current;
        if (el === null) return;
        const from = offsetAt(el.value, start);
        const to = end === undefined ? from : Math.max(from, offsetAt(el.value, end));
        el.focus();
        el.setSelectionRange(from, to);
        const lineHeight = Number.parseFloat(getComputedStyle(el).lineHeight) || FALLBACK_LINE_HEIGHT;
        el.scrollTop = Math.max(0, (start.line - 1) * lineHeight - el.clientHeight / 3);
        syncGutter();
        setCursor(positionAt(el.value, from));
      },
    }),
    []
  );

  return (
    <div className="pg-editor">
      <div className="pg-editor-body">
        <div className="pg-gutter" ref={gutter} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => {
            const severity = markers.get(i + 1);
            return (
              <div key={i} className={severity === undefined ? 'pg-gutter-line' : `pg-gutter-line pg-mark-${severity}`}>
                {i + 1}
              </div>
            );
          })}
        </div>
        <textarea
          ref={textarea}
          className="pg-textarea"
          aria-label={label}
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="off"
          onChange={event => {
            onChange(event.target.value);
            setCursor(positionAt(event.target.value, event.target.selectionStart));
          }}
          onSelect={syncCursor}
          onScroll={syncGutter}
        />
      </div>
      <div className="pg-editor-status">
        <span data-testid="cursor-position">{COPY.editor.cursor(cursor.line, cursor.column)}</span>
        {status !== undefined && <span>{status}</span>}
      </div>
    </div>
  );
}
