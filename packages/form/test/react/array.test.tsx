// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { JsonSchema } from '@jotl/core';
import { byPath, renderForm } from './helpers.js';

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('数组增删排序(R5)', () => {
  it('增加的元素取元素 schema 的默认值, 删除与上下移动按下标作用', () => {
    const schema: JsonSchema = { type: 'array', items: { type: 'string', default: '新' } };
    const { handle } = renderForm({ schema, defaultValue: ['a', 'b'] });
    fireEvent.click(button('新增'));
    expect(handle().getValues()).toEqual(['a', 'b', '新']);
    fireEvent.click(button('上移第 3 项'));
    expect(handle().getValues()).toEqual(['a', '新', 'b']);
    fireEvent.click(button('删除第 1 项'));
    expect(handle().getValues()).toEqual(['新', 'b']);
    fireEvent.click(button('下移第 1 项'));
    expect(handle().getValues()).toEqual(['b', '新']);
    expect((byPath('/1') as HTMLInputElement).value).toBe('新');
  });

  it('元素没有默认值时: 字符串为空串, 对象为空对象, 数字取 minimum', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        s: { type: 'array', items: { type: 'string' } },
        o: { type: 'array', items: { type: 'object', properties: { x: { type: 'string' } } } },
        n: { type: 'array', items: { type: 'number', minimum: 3 } },
      },
    };
    const { handle } = renderForm({ schema });
    for (const add of screen.getAllByRole('button', { name: '新增' })) fireEvent.click(add);
    expect(handle().getValues()).toEqual({ s: [''], o: [{}], n: [3] });
  });

  it('数量边界: 到 maxItems 时不能增加, 到 minItems 时不能删除', () => {
    const schema: JsonSchema = { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string' } };
    const { handle } = renderForm({ schema, defaultValue: ['a'] });
    expect(button('新增').disabled).toBe(false);
    expect(button('删除第 1 项').disabled).toBe(true);
    fireEvent.click(button('新增'));
    expect(handle().getValues()).toEqual(['a', '']);
    expect(button('新增').disabled).toBe(true);
    expect(button('删除第 1 项').disabled).toBe(false);
    // 按钮被禁用之外, 渲染器本身也拒绝越界操作.
    fireEvent.click(button('新增'));
    expect(handle().getValues()).toEqual(['a', '']);
    fireEvent.click(button('删除第 2 项'));
    expect(handle().getValues()).toEqual(['a']);
    expect(button('删除第 1 项').disabled).toBe(true);
  });

  it('maxItems 为 0 时不能增加', () => {
    renderForm({ schema: { type: 'array', maxItems: 0, items: { type: 'string' } } });
    expect(button('新增').disabled).toBe(true);
  });

  it('数据已超出 maxItems 时不能增加, 仍可删除', () => {
    const { handle } = renderForm({
      schema: { type: 'array', maxItems: 2, items: { type: 'string' } },
      defaultValue: ['a', 'b', 'c'],
    });
    expect(button('新增').disabled).toBe(true);
    fireEvent.click(button('删除第 3 项'));
    expect(handle().getValues()).toEqual(['a', 'b']);
  });

  it('可选数组字段缺省时为空列表, 增加后写入数组', () => {
    const schema: JsonSchema = { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } };
    const { handle } = renderForm({ schema });
    expect(handle().getValues()).toEqual({});
    fireEvent.click(button('新增'));
    expect(handle().getValues()).toEqual({ tags: [''] });
  });

  it('嵌套数组排序后内层元素随外层元素移动', () => {
    const schema: JsonSchema = { type: 'array', items: { type: 'array', items: { type: 'string' } } };
    const { handle } = renderForm({ schema, defaultValue: [['a1', 'a2'], ['b1']] });
    const inner = byPath('/0/1') as HTMLInputElement;
    const outer = screen
      .getAllByRole('button', { name: '下移第 1 项' })
      .find(b => b.closest('.jotl-array') === byPath(''));
    fireEvent.click(outer!);
    expect(handle().getValues()).toEqual([['b1'], ['a1', 'a2']]);
    expect(byPath('/1/1')).toBe(inner);
    expect(inner.value).toBe('a2');
  });

  it('复制把该项深拷贝后插入其后, 到 maxItems 时禁用', () => {
    const schema: JsonSchema = {
      type: 'array',
      maxItems: 3,
      items: { type: 'object', properties: { tags: { type: 'array', items: { type: 'string' } } } },
    };
    const original = { tags: ['a'] };
    const { handle } = renderForm({ schema, defaultValue: [original, { tags: ['b'] }] });
    const copyFirst = () =>
      screen
        .getAllByRole('button', { name: '复制第 1 项' })
        .find(b => b.closest('.jotl-array') === byPath('')) as HTMLButtonElement;
    fireEvent.click(copyFirst());
    const values = handle().getValues() as { tags: string[] }[];
    expect(values).toEqual([{ tags: ['a'] }, { tags: ['a'] }, { tags: ['b'] }]);
    expect(values[1]).not.toBe(values[0]);
    expect(values[1]!.tags).not.toBe(values[0]!.tags);
    fireEvent.change(byPath('/1/tags/0') as HTMLInputElement, { target: { value: 'c' } });
    expect(handle().getValues()).toEqual([{ tags: ['a'] }, { tags: ['c'] }, { tags: ['b'] }]);
    expect(copyFirst().disabled).toBe(true);
    fireEvent.click(copyFirst());
    expect((handle().getValues() as unknown[]).length).toBe(3);
  });
});
