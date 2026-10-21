// 文本草稿: 输入中尚不合法的文本只留在组件内, 合法后立即写回.
import { useState } from 'react';
import { deepEqual } from './deep-equal.js';

interface DraftState {
  text: string;
  /** 草稿对应的值; 外部值与它不再相等时草稿作废. */
  base: unknown;
  invalid: boolean;
}

export interface Draft {
  text: string;
  invalid: boolean;
  /** 文本合法, 调用方同时把 value 经 onChange 写回. */
  accept(text: string, value: unknown): void;
  /** 文本尚不合法, 不写回. */
  reject(text: string): void;
  /** 丢弃合法的草稿, 回到按值格式化的文本(如失焦后改为千分位显示); 不合法的草稿保留. */
  settle(): void;
}

export function useDraft(value: unknown, format: (value: unknown) => string): Draft {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const active = draft !== null && deepEqual(draft.base, value) ? draft : null;
  return {
    text: active === null ? format(value) : active.text,
    invalid: active?.invalid ?? false,
    accept(text, next) {
      setDraft({ text, base: next, invalid: false });
    },
    reject(text) {
      setDraft({ text, base: value, invalid: true });
    },
    settle() {
      if (active !== null && !active.invalid) setDraft(null);
    },
  };
}
