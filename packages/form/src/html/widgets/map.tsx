// 字典组件 kv: 键值对列表, 可增删条目与改键名; 键名为空或重复时只留作草稿并提示, 不写回. 对象的 "其他键" 区复用同一编辑列表.
import type { ChangeEvent, ReactNode } from 'react';
import { escapePointerToken } from '@jotl/core';
import type { EntryEditing, RenderMode } from '../../core/index.js';
import { COPY, useCopy } from '../copy.js';
import { errorId } from '../ids.js';
import { groupAttributes, type HtmlMapProps } from '../props.js';
import { useDraft } from '../use-draft.js';
import { ErrorList } from './error-list.js';
import { cn, styles } from '../styles.js';

/** 新条目的默认键名: 取第一个未被占用的 COPY.newEntryName(n). */
export function nextEntryName(names: readonly string[]): string {
  const taken = new Set(names);
  for (let n = names.length + 1; ; n++) {
    const name = COPY.newEntryName(n);
    if (!taken.has(name)) return name;
  }
}

const asName = (value: unknown): string => (typeof value === 'string' ? value : '');

/** 键值编辑列表所需的属性: 条目编辑加上所在组件的 id, mode 与 renderChild. */
export interface EntryEditorProps extends EntryEditing {
  id: string;
  mode: RenderMode;
  renderChild(relativePath: string): ReactNode;
  /** 键名可取但不能新增的名字(对象已声明的属性). */
  reserved?: readonly string[];
}

interface EntryRowProps {
  props: EntryEditorProps;
  entry: EntryEditing['entries'][number];
  index: number;
}

function MapEntryRow({ props, entry, index }: EntryRowProps) {
  const COPY = useCopy();
  const draft = useDraft(entry.name, asName);
  const keyId = `${props.id}-key-${index}`;
  const hintId = `${keyId}-hint`;
  const isTaken = (name: string) =>
    props.entries.some(other => other.key !== entry.key && other.name === name) ||
    (props.reserved?.includes(name) ?? false);
  return (
    <li className={`jotl-map-entry ${styles.mapEntry}`}>
      <div className={`jotl-map-key-cell ${styles.mapKeyCell}`}>
        <input
          id={keyId}
          type="text"
          className={`jotl-input jotl-map-key ${styles.input}`}
          aria-label={COPY.entryName(index)}
          value={draft.text}
          readOnly={props.mode === 'view'}
          disabled={props.mode === 'disabled'}
          aria-invalid={draft.invalid ? true : undefined}
          aria-describedby={draft.invalid ? hintId : undefined}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            const name = e.target.value;
            if (name === '' || isTaken(name)) {
              draft.reject(name);
              return;
            }
            draft.accept(name, name);
            if (name !== entry.name) props.renameEntry(entry.name, name);
          }}
        />
        {draft.invalid && (
          <span id={hintId} className={`jotl-draft-error ${styles.error}`} role="alert">
            {draft.text === '' ? COPY.entryNameEmpty : COPY.entryNameDuplicate(draft.text)}
          </span>
        )}
      </div>
      <div className={`jotl-map-value ${styles.mapValue}`}>{props.renderChild(escapePointerToken(entry.name))}</div>
      {props.mode !== 'view' && (
        <button
          type="button"
          className={cn('jotl-button jotl-map-remove', styles.button(), styles.flexNone)}
          aria-label={COPY.removeEntry(entry.name)}
          disabled={!props.canRemove}
          onClick={() => props.removeEntry(entry.name)}
        >
          {COPY.remove}
        </button>
      )}
    </li>
  );
}

/** 条目列表与新增按钮. */
export function EntryEditor(props: EntryEditorProps) {
  const COPY = useCopy();
  return (
    <>
      <ul className={`jotl-map-entries ${styles.mapEntries}`}>
        {props.entries.map((entry, i) => (
          <MapEntryRow key={entry.key} props={props} entry={entry} index={i} />
        ))}
      </ul>
      {props.mode !== 'view' && (
        <button
          type="button"
          className={`jotl-link jotl-map-add ${styles.link}`}
          disabled={!props.canAdd}
          onClick={() =>
            props.addEntry(nextEntryName([...props.entries.map(entry => entry.name), ...(props.reserved ?? [])]))
          }
        >
          {COPY.add}
        </button>
      )}
    </>
  );
}

export function KvWidget(props: HtmlMapProps) {
  return (
    <div {...groupAttributes(props.id, props.errors)} className={`jotl-map ${styles.map}`}>
      <EntryEditor {...props} />
      {props.errors.length > 0 && <ErrorList id={errorId(props.id)} errors={props.errors} />}
    </div>
  );
}
