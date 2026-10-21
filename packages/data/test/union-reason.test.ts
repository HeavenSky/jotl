// 联合 "不符合任何一种可选结构" 的原因: 区分字段, 按类型选分支取第一条错误, 没有相符类型时列出可选类型.
import { describe, expect, it } from 'vitest';
import type { JsonSchema } from '@jotl/core';
import { validate } from '../src/index.js';

const branch = (kind: string, title: string, extra: Record<string, JsonSchema>, required: string[]): JsonSchema => ({
  type: 'object',
  title,
  properties: { kind: { type: 'string', const: kind }, ...extra },
  required: ['kind', ...required],
});

const schema: JsonSchema = {
  type: 'object',
  properties: {
    size: {
      title: '尺寸',
      anyOf: [
        { type: 'number', minimum: 0 },
        { type: 'string', pattern: '^\\d+%$' },
      ],
    },
    shape: {
      title: '形状',
      anyOf: [
        {
          oneOf: [
            branch('circle', '圆', { r: { type: 'number', title: '半径' } }, ['r']),
            branch('rect', '矩形', { w: { type: 'number', title: '宽' } }, ['w']),
          ],
        },
        { type: 'null' },
      ],
    },
  },
};

function messages(data: unknown): [string, string][] {
  return validate(schema, data).diagnostics.map(d => [d.code, d.message]);
}

describe('联合的错误原因', () => {
  it('值属于某个分支的类型时, 直接给出该分支的错误', () => {
    expect(messages({ size: -1 })).toEqual([['JOTL4012', '尺寸 超出范围: 应不小于 0']]);
    expect(messages({ size: '23' })).toEqual([['JOTL4012', '尺寸 不符合格式要求 ^\\d+%$']]);
  });

  it('没有类型相符的分支时列出可选类型', () => {
    expect(messages({ size: true })).toEqual([['JOTL4012', '尺寸 应为 数字, 字符串 之一']]);
  });

  it('区分字段缺失或取值不在分支中; 可空包着的联合取内层原因', () => {
    expect(messages({ shape: { kind: 'tri' } })[0]![1]).toBe(
      '形状 不符合任何一种可选结构: kind 的值 "tri" 不在可选值 圆("circle"), 矩形("rect") 中'
    );
    expect(messages({ shape: { r: 1 } })[0]![1]).toBe(
      '形状 不符合任何一种可选结构: 缺少区分字段 kind, 可选值 圆("circle"), 矩形("rect")'
    );
    expect(messages({ shape: { kind: 'rect', w: 'x' } })[0]![1]).toBe('形状 不符合任何一种可选结构: 宽 的类型应为数字');
  });
});
