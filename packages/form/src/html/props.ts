// React 下各层组件 props 的别名, 以及输入控件共用的属性.
import type { FocusEventHandler, ReactNode } from 'react';
import type { Diagnostic } from '@jotl/core';
import type {
  ArrayProps,
  DecoratorProps,
  FieldProps,
  LayoutProps,
  MapProps,
  NullableProps,
  TreeProps,
  TupleProps,
  UnionProps,
  ViewProps,
} from '../core/index.js';
import { contentLabelledBy, describedBy, errorId, nameId } from './ids.js';
import { cn } from './styles.js';

export type HtmlFieldProps<V = unknown> = FieldProps<V, ReactNode>;
export type HtmlDecoratorProps = DecoratorProps<ReactNode>;
export type HtmlLayoutProps = LayoutProps<ReactNode>;
export type HtmlArrayProps = ArrayProps<ReactNode>;
export type HtmlUnionProps = UnionProps<ReactNode>;
export type HtmlNullableProps = NullableProps<ReactNode>;
export type HtmlMapProps = MapProps<ReactNode>;
export type HtmlTreeProps = TreeProps<ReactNode>;
export type HtmlTupleProps = TupleProps<ReactNode>;
export type HtmlViewProps = ViewProps<ReactNode>;

export interface GroupAttributes {
  id: string;
  role: 'group';
  'aria-labelledby': string;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
}

/** 复合组件的根元素: 外壳 label 的 for 关联不到 div, 改经 aria-labelledby 取外壳标签作为组名; 有错误时指向本组件显示的错误. */
export function groupAttributes(id: string, errors: readonly Diagnostic[]): GroupAttributes {
  const invalid = errors.length > 0;
  return {
    id,
    role: 'group',
    'aria-labelledby': nameId(id),
    'aria-invalid': invalid ? true : undefined,
    'aria-describedby': invalid ? errorId(id) : undefined,
  };
}

export interface ControlAttributes {
  id: string;
  disabled: boolean;
  readOnly: boolean;
  onBlur: FocusEventHandler;
  'aria-invalid': true | undefined;
  'aria-required': true | undefined;
  'aria-describedby': string | undefined;
  'aria-labelledby': string | undefined;
}

/** 文本类控件: view 只读, disabled 禁用. */
export function controlAttributes(props: HtmlFieldProps<unknown>, ...extraDescribedBy: string[]): ControlAttributes {
  const invalid = props.errors.length > 0;
  return {
    id: props.id,
    disabled: props.mode === 'disabled',
    readOnly: props.mode === 'view',
    onBlur: () => props.onBlur(),
    'aria-invalid': invalid ? true : undefined,
    'aria-required': props.required ? true : undefined,
    'aria-describedby': describedBy(props.id, props.schema.description, props.errors, ...extraDescribedBy),
    'aria-labelledby': contentLabelledBy(props.id),
  };
}

/** 勾选与选择类控件没有原生只读, view 与 disabled 都用 disabled. */
export function choiceAttributes(props: HtmlFieldProps<unknown>): Omit<ControlAttributes, 'readOnly' | 'id'> {
  const { readOnly, id, ...rest } = controlAttributes(props);
  return { ...rest, disabled: props.mode !== 'edit' };
}

/** 拼接类名并合并冲突的工具类, 后写的为准. */
export function className(...names: (string | false | undefined)[]): string {
  return cn(...names);
}
