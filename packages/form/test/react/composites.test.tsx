// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { createRef, StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { escapePointerToken, type JsonSchema } from '@jotl/core';
import type { MapProps, TupleProps } from '../../src/core/index.js';
import { createDefaultRegistry, JotlForm, type JotlFormHandle } from '../../src/react/index.js';
import { byPath, errorsAt, renderForm } from './helpers.js';

describe('字典(map)', () => {
  let latest: MapProps<ReactNode> | undefined;
  function MapProbe(props: MapProps<ReactNode>) {
    latest = props;
    return (
      <div id={props.id}>
        {props.entries.map(entry => (
          <div key={entry.key}>{props.renderChild(escapePointerToken(entry.name))}</div>
        ))}
      </div>
    );
  }
  const SCHEMA: JsonSchema = {
    type: 'object',
    properties: { labels: { type: 'object', maxProperties: 2, additionalProperties: { type: 'string', default: '' } } },
  };

  it('条目有稳定 key, 增删改名遵守数量限制, 值用 renderChild 渲染', () => {
    const registry = createDefaultRegistry().extend();
    registry.register({ name: 'kv', level: 'composite', component: MapProbe });
    const { handle } = renderForm({ schema: SCHEMA, registry, defaultValue: { labels: { a: '1' } } });
    expect((byPath('/labels/a') as HTMLInputElement).value).toBe('1');
    const keyOfA = latest!.entries[0]!.key;
    act(() => latest!.addEntry('b'));
    expect(handle().getValues()).toEqual({ labels: { a: '1', b: '' } });
    expect(latest!.canAdd).toBe(false);
    act(() => latest!.addEntry('c'));
    expect(Object.keys((handle().getValues() as { labels: object }).labels)).toEqual(['a', 'b']);
    act(() => latest!.renameEntry('a', 'x/y'));
    expect(handle().getValues()).toEqual({ labels: { 'x/y': '1', b: '' } });
    expect(latest!.entries[0]).toMatchObject({ key: keyOfA, name: 'x/y', dataPath: '/labels/x~1y' });
    expect((byPath('/labels/x~1y') as HTMLInputElement).value).toBe('1');
    act(() => latest!.removeEntry('b'));
    expect(handle().getValues()).toEqual({ labels: { 'x/y': '1' } });
  });

  it('字典值的错误显示在对应条目上', () => {
    const registry = createDefaultRegistry().extend();
    registry.register({ name: 'kv', level: 'composite', component: MapProbe });
    const { handle } = renderForm({ schema: SCHEMA, registry });
    act(() => handle().setValues({ labels: { a: 1 } }));
    act(() => void handle().validate());
    expect(errorsAt('/labels/a')?.textContent).toBeTruthy();
  });
});

describe('对象的其他键(additionalProperties)', () => {
  const SCHEMA: JsonSchema = {
    type: 'object',
    properties: {
      size: {
        type: 'object',
        title: '尺寸',
        properties: { w: { type: 'number', title: '宽' } },
        additionalProperties: { type: 'string', default: '' },
        maxProperties: 3,
      },
    },
  };

  it('已声明属性照常渲染, 其余键在 其他键 区编辑, 数据合并回同一对象', () => {
    const { handle } = renderForm({ schema: SCHEMA, defaultValue: { size: { w: 1, unit: 'cm' } } });
    expect((byPath('/size/w') as HTMLInputElement).value).toBe('1');
    const group = screen.getByRole('group', { name: '其他键' });
    expect((within(group).getByRole('textbox', { name: '第 1 项的键名' }) as HTMLInputElement).value).toBe('unit');
    expect((byPath('/size/unit') as HTMLInputElement).value).toBe('cm');
    expect(within(group).queryByDisplayValue('w')).toBeNull();

    fireEvent.change(byPath('/size/unit')!, { target: { value: 'mm' } });
    fireEvent.click(within(group).getByRole('button', { name: '新增' }));
    expect(handle().getValues()).toEqual({ size: { w: 1, unit: 'mm', key3: '' } });
    fireEvent.change(within(group).getByRole('textbox', { name: '第 2 项的键名' }), { target: { value: 'w' } });
    fireEvent.change(within(group).getByRole('textbox', { name: '第 2 项的键名' }), { target: { value: 'note' } });
    expect(handle().getValues()).toEqual({ size: { w: 1, unit: 'mm', note: '' } });
    expect((within(group).getByRole('button', { name: '新增' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(group).getByRole('button', { name: '删除 unit' }));
    expect(handle().getValues()).toEqual({ size: { w: 1, note: '' } });
  });

  it('其余键的值按 additionalProperties 校验, 错误显示在对应条目上', () => {
    const { handle } = renderForm({ schema: SCHEMA, defaultValue: { size: { extra: 1 } } });
    act(() => void handle().validate());
    expect(errorsAt('/size/extra')?.textContent).toBeTruthy();
  });
});

describe('元组(tuple)', () => {
  const SCHEMA: JsonSchema = {
    type: 'object',
    properties: {
      point: {
        type: 'array',
        prefixItems: [{ type: 'number', title: '经度' }, { type: 'number' }],
        items: false,
        minItems: 2,
      },
    },
  };

  it('按位置渲染, 标签取 title 或 第 n 项, 不能增删', () => {
    const { handle } = renderForm({ schema: SCHEMA, defaultValue: { point: [1, 2] } });
    expect(byPath('/point')?.classList.contains('jotl-tuple')).toBe(true);
    expect((screen.getByLabelText('经度') as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText('第 2 项') as HTMLInputElement).value).toBe('2');
    expect(within(byPath('/point')!).queryByRole('button')).toBeNull();
    fireEvent.change(screen.getByLabelText('第 2 项'), { target: { value: '5' } });
    expect(handle().getValues()).toEqual({ point: [1, 5] });
  });

  it('items 为 schema 时显示已有剩余元素, 可增删, 受 maxItems 与 minItems 限制', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        row: {
          type: 'array',
          prefixItems: [{ type: 'string', title: '名' }],
          items: { type: 'number', default: 0 },
          minItems: 2,
          maxItems: 3,
        },
      },
    };
    const { handle } = renderForm({ schema, defaultValue: { row: ['a', 7] } });
    const tuple = byPath('/row')!;
    expect((byPath('/row/1') as HTMLInputElement).value).toBe('7');
    const addButton = () => within(tuple).getByRole('button', { name: '新增' }) as HTMLButtonElement;
    const removeButton = (n: number) =>
      within(tuple).getByRole('button', { name: `删除第 ${n} 项` }) as HTMLButtonElement;
    expect(removeButton(2).disabled).toBe(true);
    fireEvent.click(addButton());
    expect(handle().getValues()).toEqual({ row: ['a', 7, 0] });
    expect(byPath('/row/2')).not.toBeNull();
    expect(addButton().disabled).toBe(true);
    fireEvent.click(addButton());
    expect(handle().getValues()).toEqual({ row: ['a', 7, 0] });
    fireEvent.click(removeButton(2));
    expect(handle().getValues()).toEqual({ row: ['a', 0] });
    expect(within(tuple).queryByRole('button', { name: '删除第 1 项' })).toBeNull();
  });

  it('剩余元素可在彼此之间上移下移, 错误与输入框随数据移动; 复制深拷贝后插入其后, 受 maxItems 限制', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        row: {
          type: 'array',
          prefixItems: [{ type: 'string', title: '名' }],
          items: { type: 'array', items: { type: 'number', maximum: 5 } },
          maxItems: 4,
        },
      },
    };
    const { handle } = renderForm({ schema, defaultValue: { row: ['a', [9], [1]] } });
    const tuple = byPath('/row')!;
    const button = (name: string) => within(tuple).getByRole('button', { name }) as HTMLButtonElement;
    act(() => void handle().validate());
    expect(errorsAt('/row/1/0')?.textContent).toBeTruthy();
    const moved = byPath('/row/1/0');
    expect(button('上移第 2 项').disabled).toBe(true);
    expect(button('下移第 3 项').disabled).toBe(true);
    fireEvent.click(button('下移第 2 项'));
    expect(handle().getValues()).toEqual({ row: ['a', [1], [9]] });
    expect(byPath('/row/2/0')).toBe(moved);
    expect(errorsAt('/row/1/0')).toBeNull();
    expect(errorsAt('/row/2/0')?.textContent).toBeTruthy();
    fireEvent.click(button('上移第 3 项'));
    expect(handle().getValues()).toEqual({ row: ['a', [9], [1]] });
    fireEvent.click(button('复制第 2 项'));
    const values = handle().getValues() as { row: unknown[] };
    expect(values).toEqual({ row: ['a', [9], [9], [1]] });
    expect(values.row[2]).not.toBe(values.row[1]);
    expect(errorsAt('/row/2/0')?.textContent).toBeTruthy();
    expect(button('复制第 2 项').disabled).toBe(true);
    fireEvent.click(button('复制第 2 项'));
    expect((handle().getValues() as { row: unknown[] }).row).toHaveLength(4);
  });

  it('rest 的 move / duplicate 不越过 prefixItems 各位置', () => {
    let latest: TupleProps<ReactNode> | undefined;
    function TupleProbe(props: TupleProps<ReactNode>) {
      latest = props;
      return <div id={props.id} />;
    }
    const registry = createDefaultRegistry().extend();
    registry.register({ name: 'tuple', level: 'composite', component: TupleProbe });
    const schema: JsonSchema = {
      type: 'array',
      prefixItems: [{ type: 'string' }, { type: 'string' }],
      items: { type: 'string' },
    };
    const { handle } = renderForm({ schema, registry, defaultValue: ['a', 'b', 'c', 'd'] });
    act(() => latest!.rest!.move!(2, 1));
    act(() => latest!.rest!.move!(0, 3));
    act(() => latest!.rest!.duplicate!(1));
    expect(handle().getValues()).toEqual(['a', 'b', 'c', 'd']);
    act(() => latest!.rest!.move!(3, 2));
    expect(handle().getValues()).toEqual(['a', 'b', 'd', 'c']);
    expect(latest!.rest!.items.map(item => item.index)).toEqual([2, 3]);
    act(() => latest!.rest!.duplicate!(3));
    expect(handle().getValues()).toEqual(['a', 'b', 'd', 'c', 'c']);
  });

  it('items 为 false 时剩余元素不显示, 也没有增删', () => {
    const { handle } = renderForm({ schema: SCHEMA, defaultValue: { point: [1, 2, 3] } });
    expect(byPath('/point/2')).toBeNull();
    expect(within(byPath('/point')!).queryByRole('button')).toBeNull();
    expect(handle().getValues()).toEqual({ point: [1, 2, 3] });
  });
});

describe('联合的分段按钮(x-ui.props.selector)', () => {
  it('props 透传给 union, 点击按钮切换分支', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        v: {
          oneOf: [
            { type: 'string', title: '文本' },
            { type: 'number', title: '数字' },
          ],
          'x-ui': { props: { selector: 'buttons' } },
        },
      },
    };
    const { handle } = renderForm({ schema, defaultValue: { v: 'a' } });
    const group = screen.getByRole('radiogroup', { name: '类型' });
    fireEvent.click(within(group).getByLabelText('数字'));
    expect(typeof (handle().getValues() as { v: unknown }).v).toBe('number');
    expect((within(group).getByLabelText('数字') as HTMLInputElement).checked).toBe(true);
  });
});

describe('StrictMode', () => {
  it('双重执行副作用后仍能编辑, 校验与显示错误', () => {
    const ref = createRef<JotlFormHandle>();
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        a: { type: 'string', maxLength: 1, title: 'A' },
        list: { type: 'array', items: { type: 'string' } },
      },
    };
    render(
      <StrictMode>
        <JotlForm id="f" ref={ref} schema={schema} defaultValue={{ list: ['x'] }} drill={false} />
      </StrictMode>
    );
    fireEvent.change(byPath('/a')!, { target: { value: 'ab' } });
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
    expect(ref.current!.getValues()).toEqual({ a: 'ab', list: ['x', ''] });
    act(() => void ref.current!.validate());
    expect(errorsAt('/a')?.textContent).toContain('A');
  });
});
