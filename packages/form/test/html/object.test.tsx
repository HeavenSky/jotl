// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JsonSchemaObject } from '@jotl/core';
import { PageWidget, partitionFields, tabSections } from '../../src/html/index.js';
import { layoutProps, MODES } from './helpers.js';

const FIELDS = [
  { key: 'a', required: true, hidden: false },
  { key: 'b', required: false, hidden: false },
  { key: 'x/y', required: false, hidden: false },
  { key: 'h', required: false, hidden: true },
  { key: 'c', required: false, hidden: false },
];

describe('partitionFields', () => {
  it('未分组字段在前, 各分组依次; 隐藏字段与空分组省略; 组内按 fields 顺序; 重复归属取第一个分组', () => {
    const groups = [
      { title: '第一组', fields: ['c', 'b'] },
      { title: '空组', fields: ['h', 'missing'] },
      { title: '第二组', fields: ['b', 'x/y'] },
    ];
    expect(partitionFields(FIELDS, groups)).toEqual([
      { title: undefined, keys: ['a'] },
      { title: '第一组', keys: ['b', 'c'] },
      { title: '第二组', keys: ['x/y'] },
    ]);
  });

  it('无分组时只有一个分区; 全部隐藏时没有分区', () => {
    expect(partitionFields(FIELDS, [])).toEqual([{ title: undefined, keys: ['a', 'b', 'x/y', 'c'] }]);
    expect(partitionFields([{ key: 'h', required: false, hidden: true }], [])).toEqual([]);
  });
});

describe('object', () => {
  it('fieldset + legend; 可见字段用转义后的键调用 renderChild', () => {
    const props = layoutProps({ schema: { type: 'object', title: '横幅' }, fields: FIELDS });
    render(<PageWidget {...props} />);
    const fieldset = document.getElementById('f');
    expect(fieldset?.tagName).toBe('FIELDSET');
    expect(fieldset?.querySelector('legend')?.textContent).toBe('横幅');
    expect(props.renderChild.mock.calls.map(([path]) => path)).toEqual(['a', 'b', 'x~1y', 'c']);
  });

  it('没有 title 时不渲染 legend', () => {
    render(<PageWidget {...layoutProps({ fields: FIELDS })} />);
    expect(document.querySelector('legend')).toBeNull();
  });

  it('分组用嵌套 fieldset, 未分组字段在前', () => {
    const props = layoutProps({ fields: FIELDS, groups: [{ title: '高级', fields: ['b', 'c'] }] });
    render(<PageWidget {...props} />);
    const group = screen.getByRole('group', { name: '高级' });
    expect(group.tagName).toBe('FIELDSET');
    expect(group.textContent).toBe('高级child:bchild:c');
    expect(props.renderChild.mock.calls.map(([path]) => path)).toEqual(['a', 'x~1y', 'b', 'c']);
  });

  it('不认识的布局按 stack 排版且不报错', () => {
    const props = layoutProps({ fields: FIELDS, layout: 'masonry' as never });
    render(<PageWidget {...props} />);
    expect(document.getElementById('f')?.className).toContain('jotl-object--masonry');
    expect(props.renderChild.mock.calls.map(([path]) => path)).toEqual(['a', 'b', 'x~1y', 'c']);
  });

  it.each(MODES)('mode=%s: 只有 disabled 时禁用整个 fieldset', mode => {
    render(<PageWidget {...layoutProps({ fields: FIELDS, mode })} />);
    expect((document.getElementById('f') as HTMLFieldSetElement).disabled).toBe(mode === 'disabled');
  });
});

describe('tabSections', () => {
  it('每个分组一页, 未分组字段并入第一页且排在前面', () => {
    const sections = partitionFields(FIELDS, [
      { title: '基本', fields: ['b'] },
      { title: '高级', fields: ['c'] },
    ]);
    expect(tabSections(sections)).toEqual([
      { title: '基本', keys: ['a', 'x/y', 'b'] },
      { title: '高级', keys: ['c'] },
    ]);
  });

  it('没有分组时没有标签页', () => {
    expect(tabSections(partitionFields(FIELDS, []))).toEqual([]);
  });
});

describe('object layout=tabs', () => {
  const GROUPS = [
    { title: '基本', fields: ['b'] },
    { title: '高级', fields: ['c'] },
  ];
  const tab = (name: string) => screen.getByRole('tab', { name }) as HTMLButtonElement;
  const panelOf = (name: string) =>
    document.getElementById(tab(name).getAttribute('aria-controls') ?? '') as HTMLElement;

  it('tablist / tab / tabpanel 结构: 每个分组一页, 未分组字段在第一页, 默认选中第一页', () => {
    const props = layoutProps({ fields: FIELDS, groups: GROUPS, layout: 'tabs' });
    render(<PageWidget {...props} />);
    const tablist = screen.getByRole('tablist');
    expect(
      within(tablist)
        .getAllByRole('tab')
        .map(t => t.textContent)
    ).toEqual(['基本', '高级']);
    expect(tab('基本').getAttribute('aria-selected')).toBe('true');
    expect(tab('高级').getAttribute('aria-selected')).toBe('false');
    expect(tab('基本').tabIndex).toBe(0);
    expect(tab('高级').tabIndex).toBe(-1);
    const first = panelOf('基本');
    expect(first.getAttribute('role')).toBe('tabpanel');
    expect(first.getAttribute('aria-labelledby')).toBe(tab('基本').id);
    expect(first.hidden).toBe(false);
    expect(first.textContent).toBe('child:achild:x~1ychild:b');
    expect(panelOf('高级').hidden).toBe(true);
    expect(panelOf('高级').textContent).toBe('child:c');
    expect(screen.getByRole('tabpanel', { name: '基本' })).toBe(first);
    expect(props.renderChild.mock.calls.map(([path]) => path)).toEqual(['a', 'x~1y', 'b', 'c']);
  });

  it('标签页上显示其中字段的错误数, 没有错误时不显示', () => {
    const fields = FIELDS.map(f =>
      f.key === 'c' ? { ...f, errorCount: 2 } : f.key === 'a' ? { ...f, errorCount: 0 } : f
    );
    render(<PageWidget {...layoutProps({ fields, groups: GROUPS, layout: 'tabs' })} />);
    const badge = tab('高级 2 个错误').querySelector('.jotl-tab-errors');
    expect(badge?.textContent).toBe('2 个错误');
    expect(tab('基本').querySelector('.jotl-tab-errors')).toBeNull();
  });

  it('点击标签切换显示的页, 不写回数据', () => {
    const props = layoutProps({ fields: FIELDS, groups: GROUPS, layout: 'tabs' });
    render(<PageWidget {...props} />);
    fireEvent.click(tab('高级'));
    expect(tab('高级').getAttribute('aria-selected')).toBe('true');
    expect(tab('基本').getAttribute('aria-selected')).toBe('false');
    expect(panelOf('高级').hidden).toBe(false);
    expect(panelOf('基本').hidden).toBe(true);
    // 组件没有写回数据的回调; renderChild 只按相对路径渲染子节点.
    expect(props.renderChild.mock.calls.every(([path]) => ['a', 'x~1y', 'b', 'c'].includes(path))).toBe(true);
  });

  it('方向键, Home, End 在标签间移动选中与焦点', () => {
    render(
      <PageWidget
        {...layoutProps({ fields: FIELDS, groups: [...GROUPS, { title: '其他', fields: ['x/y'] }], layout: 'tabs' })}
      />
    );
    tab('基本').focus();
    fireEvent.keyDown(tab('基本'), { key: 'ArrowRight' });
    expect(tab('高级').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(tab('高级'));
    fireEvent.keyDown(tab('高级'), { key: 'End' });
    expect(document.activeElement).toBe(tab('其他'));
    fireEvent.keyDown(tab('其他'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tab('基本'));
    fireEvent.keyDown(tab('基本'), { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tab('其他'));
    fireEvent.keyDown(tab('其他'), { key: 'Home' });
    expect(tab('基本').getAttribute('aria-selected')).toBe('true');
  });

  it('选中页之前的分组因字段隐藏而消失或重现时, 仍停留在同名标签页', () => {
    const props = layoutProps({ fields: FIELDS, groups: GROUPS, layout: 'tabs' });
    const { rerender } = render(<PageWidget {...props} />);
    fireEvent.click(tab('高级'));
    const hiddenB = FIELDS.map(f => (f.key === 'b' ? { ...f, hidden: true } : f));
    rerender(<PageWidget {...props} fields={hiddenB} />);
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['高级']);
    expect(tab('高级').getAttribute('aria-selected')).toBe('true');
    expect(panelOf('高级').textContent).toBe('child:achild:x~1ychild:c');
    rerender(<PageWidget {...props} />);
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['基本', '高级']);
    expect(tab('高级').getAttribute('aria-selected')).toBe('true');
    expect(panelOf('高级').hidden).toBe(false);
  });

  it('没有分组时退回 stack 排版, 不显示标签', () => {
    const props = layoutProps({ fields: FIELDS, layout: 'tabs' });
    render(<PageWidget {...props} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(props.renderChild).toHaveBeenCalledTimes(4);
  });

  it.each(MODES)('mode=%s: 只有 disabled 时禁用标签切换', mode => {
    render(<PageWidget {...layoutProps({ fields: FIELDS, groups: GROUPS, layout: 'tabs', mode })} />);
    expect(tab('高级').disabled).toBe(mode === 'disabled');
  });
});

describe('object layout=grid', () => {
  it('字段放进 CSS grid 容器, 列数取 columns', () => {
    const props = layoutProps({ fields: FIELDS, layout: 'grid', columns: 3 });
    render(<PageWidget {...props} />);
    const grid = document.querySelector('.jotl-object-grid') as HTMLElement;
    expect(grid.style.getPropertyValue('--jotl-columns')).toBe('3');
    expect(grid.children).toHaveLength(4);
    expect(grid.textContent).toBe('child:achild:bchild:x~1ychild:c');
  });

  it('分组各自是嵌套 fieldset 内的 grid, 未分组字段在前', () => {
    const props = layoutProps({
      fields: FIELDS,
      layout: 'grid',
      columns: 2,
      groups: [{ title: '高级', fields: ['b', 'c'] }],
    });
    render(<PageWidget {...props} />);
    const grids = [...document.querySelectorAll<HTMLElement>('.jotl-object-grid')];
    expect(grids.map(g => g.textContent)).toEqual(['child:achild:x~1y', 'child:bchild:c']);
    expect(grids.every(g => g.style.getPropertyValue('--jotl-columns') === '2')).toBe(true);
    expect(within(screen.getByRole('group', { name: '高级' })).getByText('child:b')).toBeTruthy();
  });

  it.each([0, -1, 1.5])('columns=%s 不合法时用默认 2 列', columns => {
    render(<PageWidget {...layoutProps({ fields: FIELDS, layout: 'grid', columns })} />);
    expect((document.querySelector('.jotl-object-grid') as HTMLElement).style.getPropertyValue('--jotl-columns')).toBe(
      '2'
    );
  });
});

describe('object 的其他键(additional)', () => {
  const additional = () => ({
    entries: [{ key: 'k0', name: 'extra', dataPath: '/f/extra' }],
    canAdd: true,
    canRemove: true,
    addEntry: vi.fn<(name: string) => void>(),
    removeEntry: vi.fn<(name: string) => void>(),
    renameEntry: vi.fn<(from: string, to: string) => void>(),
  });
  const schema: JsonSchemaObject = {
    type: 'object',
    properties: { a: { type: 'string' }, key4: { type: 'string' } },
    additionalProperties: { type: 'number' },
  };

  it('已声明字段之后是 其他键 分组: 键名可改, 值用转义后的键名调用 renderChild', () => {
    const editing = additional();
    const props = layoutProps({ schema, fields: [{ key: 'a', required: false, hidden: false }], additional: editing });
    render(<PageWidget {...props} />);
    const group = screen.getByRole('group', { name: '其他键' });
    expect(within(group).getByText('child:extra')).toBeTruthy();
    expect(props.renderChild.mock.calls.map(([path]) => path)).toEqual(['a', 'extra']);
    fireEvent.change(within(group).getByRole('textbox', { name: '第 1 项的键名' }), { target: { value: 'renamed' } });
    expect(editing.renameEntry).toHaveBeenLastCalledWith('extra', 'renamed');
  });

  it('键名不能取已声明的属性名, 新增的默认键名跳过它们', () => {
    const editing = additional();
    render(
      <PageWidget
        {...layoutProps({
          schema,
          fields: [],
          additional: { ...editing, entries: [{ key: 'k0', name: 'key1', dataPath: '/f/key1' }] },
        })}
      />
    );
    const group = screen.getByRole('group', { name: '其他键' });
    fireEvent.change(within(group).getByRole('textbox'), { target: { value: 'a' } });
    expect(editing.renameEntry).not.toHaveBeenCalled();
    expect(within(group).getByRole('alert').textContent).toContain('"a" 已存在');
    fireEvent.click(within(group).getByRole('button', { name: '新增' }));
    expect(editing.addEntry).toHaveBeenLastCalledWith('key5');
  });

  it('没有 additional 时不显示该分组', () => {
    render(<PageWidget {...layoutProps({ schema, fields: [] })} />);
    expect(screen.queryByRole('group', { name: '其他键' })).toBeNull();
  });
});
