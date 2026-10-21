// 颜色组件: 原生取色器 + 文本框; 取色器只接受 #rrggbb, 值不符合时只显示文本框.
import type { ChangeEvent } from 'react';
import { choiceAttributes, controlAttributes, type HtmlFieldProps } from '../props.js';
import { styles } from '../styles.js';

const PICKER_VALUE = /^#[0-9a-fA-F]{6}$/;

export function ColorWidget(props: HtmlFieldProps<string>) {
  const text = typeof props.value === 'string' ? props.value : '';
  const write = (next: string) => props.onChange(next === '' ? undefined : next);
  return (
    <span className={`jotl-color ${styles.color}`}>
      {PICKER_VALUE.test(text) && (
        <input
          {...choiceAttributes(props)}
          type="color"
          className={`jotl-color-picker ${styles.colorPicker}`}
          tabIndex={-1}
          aria-hidden={true}
          value={text.toLowerCase()}
          onChange={(e: ChangeEvent<HTMLInputElement>) => write(e.target.value)}
        />
      )}
      <input
        {...controlAttributes(props)}
        type="text"
        className={`jotl-input jotl-color-text ${styles.input}`}
        value={text}
        onChange={(e: ChangeEvent<HTMLInputElement>) => write(e.target.value)}
      />
    </span>
  );
}
