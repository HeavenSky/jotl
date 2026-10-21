// 本包的自动 JSX 运行时(tsconfig jsxImportSource 指向本包): 转为 React.createElement, 使编译产物不依赖 React 16.14+ 才有的 react/jsx-runtime.
import { createElement, Fragment, type ElementType, type Key, type ReactElement, type ReactNode } from 'react';

export { Fragment };
export type { JSX } from 'react';

function create(
  type: ElementType,
  props: Record<string, unknown>,
  key: Key | undefined,
  isStatic: boolean
): ReactElement {
  const { children, ...rest } = props;
  if (key !== undefined) rest.key = key;
  if (!('children' in props)) return createElement(type, rest);
  // 静态子元素必须逐个作为参数传入: 整个数组留在 props.children 或作为单个参数时, React 会按动态列表要求 key 并告警.
  if (isStatic && Array.isArray(children)) return createElement(type, rest, ...(children as ReactNode[]));
  return createElement(type, rest, children as ReactNode);
}

export function jsx(type: ElementType, props: Record<string, unknown>, key?: Key): ReactElement {
  return create(type, props, key, false);
}

export function jsxs(type: ElementType, props: Record<string, unknown>, key?: Key): ReactElement {
  return create(type, props, key, true);
}
