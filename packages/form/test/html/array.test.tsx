// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ListWidget } from '../../src/html/index.js';
import { arrayProps, ERROR } from './helpers.js';

const ITEMS = [
  { key: 'k1', dataPath: '/f/0' },
  { key: 'k2', dataPath: '/f/1' },
  { key: 'k3', dataPath: '/f/2' },
];

const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('array', () => {
  it('用 ol 列出元素, 元素用 renderChild(String(i)) 渲染', () => {
    const props = arrayProps({ items: ITEMS });
    render(<ListWidget {...props} />);
    const list = document.querySelector('ol.jotl-array-items');
    expect(list?.children).toHaveLength(3);
    expect(props.renderChild.mock.calls.map(([path]) => path)).toEqual(['0', '1', '2']);
    expect(list?.textContent).toContain('child:2');
  });

  it('按钮调用 add remove move', () => {
    const props = arrayProps({ items: ITEMS });
    render(<ListWidget {...props} />);
    fireEvent.click(button('新增'));
    expect(props.add).toHaveBeenCalledWith();
    fireEvent.click(button('删除第 2 项'));
    expect(props.remove).toHaveBeenCalledWith(1);
    fireEvent.click(button('上移第 2 项'));
    expect(props.move).toHaveBeenLastCalledWith(1, 0);
    fireEvent.click(button('下移第 2 项'));
    expect(props.move).toHaveBeenLastCalledWith(1, 2);
  });

  it('首项不能上移, 末项不能下移', () => {
    render(<ListWidget {...arrayProps({ items: ITEMS })} />);
    expect(button('上移第 1 项').disabled).toBe(true);
    expect(button('下移第 1 项').disabled).toBe(false);
    expect(button('上移第 3 项').disabled).toBe(false);
    expect(button('下移第 3 项').disabled).toBe(true);
  });

  it('按 canAdd canRemove 禁用按钮', () => {
    const props = arrayProps({ items: ITEMS, canAdd: false, canRemove: false });
    render(<ListWidget {...props} />);
    expect(button('新增').disabled).toBe(true);
    for (const i of [1, 2, 3]) expect(button(`删除第 ${i} 项`).disabled).toBe(true);
    fireEvent.click(button('新增'));
    expect(props.add).not.toHaveBeenCalled();
  });

  it('元素 key 稳定: 重排后同一 key 的 DOM 节点被复用', () => {
    const props = arrayProps({ items: ITEMS });
    const { rerender } = render(<ListWidget {...props} />);
    const first = document.querySelectorAll('li')[0];
    rerender(<ListWidget {...props} items={[ITEMS[1], ITEMS[0], ITEMS[2]].filter(x => x !== undefined)} />);
    expect(document.querySelectorAll('li')[1]).toBe(first);
  });

  it('mode=edit 按钮可用', () => {
    render(<ListWidget {...arrayProps({ items: ITEMS })} />);
    expect(button('新增').disabled).toBe(false);
    expect(button('删除第 1 项').disabled).toBe(false);
  });

  it('mode=view 只显示元素, 不显示按钮', () => {
    render(<ListWidget {...arrayProps({ items: ITEMS, mode: 'view', canAdd: false, canRemove: false })} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(document.querySelectorAll('li')).toHaveLength(3);
  });

  it('mode=disabled 全部按钮禁用', () => {
    render(<ListWidget {...arrayProps({ items: ITEMS, mode: 'disabled', canAdd: false, canRemove: false })} />);
    const buttons = screen.getAllByRole('button') as HTMLButtonElement[];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every(b => b.disabled)).toBe(true);
  });

  it('空数组只有增加按钮', () => {
    render(<ListWidget {...arrayProps()} />);
    expect(document.querySelectorAll('li')).toHaveLength(0);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('数组层错误: aria-invalid 并显示错误', () => {
    const { rerender } = render(<ListWidget {...arrayProps({ items: ITEMS })} />);
    expect(document.getElementById('f')?.hasAttribute('aria-invalid')).toBe(false);
    rerender(<ListWidget {...arrayProps({ items: ITEMS, errors: [ERROR] })} />);
    const root = document.getElementById('f');
    expect(root?.getAttribute('aria-invalid')).toBe('true');
    expect(root?.getAttribute('aria-describedby')).toBe('f-errors');
    expect(document.getElementById('f-errors')?.textContent).toBe('类型不符');
  });

  it('有 duplicate 时每项带复制按钮, 调用 duplicate(i); canAdd 为假时禁用', () => {
    const duplicate = vi.fn<(index: number) => void>();
    const { rerender } = render(<ListWidget {...arrayProps({ items: ITEMS, duplicate })} />);
    fireEvent.click(button('复制第 2 项'));
    expect(duplicate).toHaveBeenCalledWith(1);
    rerender(<ListWidget {...arrayProps({ items: ITEMS, duplicate, canAdd: false })} />);
    expect(button('复制第 1 项').disabled).toBe(true);
  });

  it('没有 duplicate 时不显示复制按钮', () => {
    render(<ListWidget {...arrayProps({ items: ITEMS })} />);
    expect(screen.queryByRole('button', { name: '复制第 1 项' })).toBeNull();
  });
});
