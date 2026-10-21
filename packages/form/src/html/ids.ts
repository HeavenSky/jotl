// 由组件稳定 id 派生的关联元素 id, 外壳与输入控件经它们互相引用.
import type { Diagnostic } from '@jotl/core';

export function labelId(id: string): string {
  return `${id}-label`;
}

/** 可访问名称所指的外壳标签: 与外围节点同路径的内容节点(id 以 "+" 结尾)没有自己的外壳, 取外围节点的标签. */
export function nameId(id: string): string {
  return labelId(id.replace(/\++$/, ''));
}

/** 内容节点的输入控件经 aria-labelledby 取外围标签; 其余控件由外壳 label 的 for 关联, 返回 undefined. */
export function contentLabelledBy(id: string): string | undefined {
  return id.endsWith('+') ? nameId(id) : undefined;
}

export function descriptionId(id: string): string {
  return `${id}-description`;
}

export function errorId(id: string): string {
  return `${id}-errors`;
}

/** 输入控件的 aria-describedby: 有说明时指向说明, 有错误时指向错误; 都没有时返回 undefined. */
export function describedBy(
  id: string,
  description: unknown,
  errors: readonly Diagnostic[],
  ...extra: string[]
): string | undefined {
  const ids: string[] = [];
  if (typeof description === 'string' && description !== '') ids.push(descriptionId(id));
  if (errors.length > 0) ids.push(errorId(id));
  ids.push(...extra);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
