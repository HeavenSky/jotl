// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CheckboxWidget, RadioWidget, SelectWidget, SwitchWidget } from '../../src/html/index.js';
import { ERROR, fieldProps, MODES } from './helpers.js';

const LABELED = { oneOf: [{ const: 's', title: '小' }, { const: 'm' }, { const: 3, title: '三' }] };

describe('checkbox', () => {
  it('显示勾选状态并写回布尔值', () => {
    const props = fieldProps<boolean>({ value: true, schema: { type: 'boolean' } });
    const { rerender } = render(<CheckboxWidget {...props} />);
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box.id).toBe('f');
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(props.onChange).toHaveBeenLastCalledWith(false);
    rerender(<CheckboxWidget {...props} value={undefined} />);
    expect(box.checked).toBe(false);
    fireEvent.click(box);
    expect(props.onChange).toHaveBeenLastCalledWith(true);
  });

  it.each(MODES)('mode=%s', mode => {
    render(<CheckboxWidget {...fieldProps<boolean>({ mode })} />);
    expect((screen.getByRole('checkbox') as HTMLInputElement).disabled).toBe(mode !== 'edit');
  });

  it('有错误时 aria-invalid', () => {
    render(<CheckboxWidget {...fieldProps<boolean>({ errors: [ERROR] })} />);
    expect(screen.getByRole('checkbox').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('switch', () => {
  it('是 role=switch 的勾选框, 写回布尔值', () => {
    const props = fieldProps<boolean>({ value: false, schema: { type: 'boolean' } });
    render(<SwitchWidget {...props} />);
    const toggle = screen.getByRole('switch') as HTMLInputElement;
    expect(toggle.type).toBe('checkbox');
    expect(toggle.id).toBe('f');
    expect(toggle.checked).toBe(false);
    fireEvent.click(toggle);
    expect(props.onChange).toHaveBeenLastCalledWith(true);
  });

  it.each(MODES)('mode=%s', mode => {
    render(<SwitchWidget {...fieldProps<boolean>({ mode, schema: { type: 'boolean' } })} />);
    expect((screen.getByRole('switch') as HTMLInputElement).disabled).toBe(mode !== 'edit');
  });
});

describe('select 用于枚举数组', () => {
  const schema = { type: 'array' as const, items: { enum: ['a', 'b', 'c'] }, uniqueItems: true };

  it('多选下拉框, 按选项顺序写回, 不在选项中的值保留在末尾', () => {
    const props = fieldProps<unknown[]>({ value: ['c', 'x'], schema });
    render(<SelectWidget {...props} />);
    const select = screen.getByRole('listbox') as HTMLSelectElement;
    expect(select.multiple).toBe(true);
    expect(Array.from(select.selectedOptions, o => o.textContent)).toEqual(['c']);
    (select.options[0] as HTMLOptionElement).selected = true;
    fireEvent.change(select);
    expect(props.onChange).toHaveBeenLastCalledWith(['a', 'c', 'x']);
  });
});

describe('radio', () => {
  it('选项文字取 title, 无则取值; 选中项与写回值', () => {
    const props = fieldProps<unknown>({ value: 3, schema: LABELED });
    render(<RadioWidget {...props} />);
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map(r => r.labels?.[0]?.textContent)).toEqual(['小', 'm', '三']);
    expect(radios.map(r => r.checked)).toEqual([false, false, true]);
    expect(new Set(radios.map(r => r.name))).toEqual(new Set(['f']));
    fireEvent.click(radios[0] as HTMLInputElement);
    expect(props.onChange).toHaveBeenLastCalledWith('s');
  });

  it('组容器带 id 并由外壳标签命名', () => {
    render(<RadioWidget {...fieldProps<unknown>({ schema: { enum: ['a'] } })} />);
    const group = screen.getByRole('radiogroup');
    expect(group.id).toBe('f');
    expect(group.getAttribute('aria-labelledby')).toBe('f-label');
  });

  it.each(MODES)('mode=%s', mode => {
    render(<RadioWidget {...fieldProps<unknown>({ mode, schema: LABELED })} />);
    for (const radio of screen.getAllByRole('radio') as HTMLInputElement[])
      expect(radio.disabled).toBe(mode !== 'edit');
  });

  it('有错误时 aria-invalid', () => {
    render(<RadioWidget {...fieldProps<unknown>({ errors: [ERROR], schema: LABELED })} />);
    expect(screen.getByRole('radiogroup').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toBe('f-errors');
  });
});

describe('select', () => {
  it('带空选项; 显示选中项; 选择写回原值, 选空写回 undefined', () => {
    const props = fieldProps<unknown>({ value: 'm', schema: LABELED });
    render(<SelectWidget {...props} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.id).toBe('f');
    expect([...select.options].map(o => o.textContent)).toEqual(['请选择', '小', 'm', '三']);
    expect(select.selectedOptions[0]?.textContent).toBe('m');
    fireEvent.change(select, { target: { value: '2' } });
    expect(props.onChange).toHaveBeenLastCalledWith(3);
    fireEvent.change(select, { target: { value: '' } });
    expect(props.onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('无值或值不在选项中时选中空选项', () => {
    render(<SelectWidget {...fieldProps<unknown>({ value: 'zz', schema: LABELED })} />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('');
  });

  it.each(MODES)('mode=%s', mode => {
    render(<SelectWidget {...fieldProps<unknown>({ mode, schema: LABELED })} />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).disabled).toBe(mode !== 'edit');
  });

  it('有错误时 aria-invalid', () => {
    render(<SelectWidget {...fieldProps<unknown>({ errors: [ERROR], schema: LABELED })} />);
    expect(screen.getByRole('combobox').getAttribute('aria-invalid')).toBe('true');
  });

  it('必填且有值时不带空选项, 并标 aria-required', () => {
    render(<SelectWidget {...fieldProps<unknown>({ required: true, value: 'm', schema: LABELED })} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect([...select.options].map(o => o.textContent)).toEqual(['小', 'm', '三']);
    expect(select.getAttribute('aria-required')).toBe('true');
  });

  it('必填但无值时保留空选项', () => {
    render(<SelectWidget {...fieldProps<unknown>({ required: true, schema: LABELED })} />);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('');
  });
});

describe('checkbox 用于枚举数组', () => {
  const schema = { type: 'array' as const, items: { enum: ['a', 'b', 'c'] }, uniqueItems: true };

  it('显示已选项; 勾选按选项顺序写回, 取消勾选移除', () => {
    const props = fieldProps<unknown[]>({ value: ['c'], schema });
    const { rerender } = render(<CheckboxWidget {...props} />);
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes.map(b => b.labels?.[0]?.textContent)).toEqual(['a', 'b', 'c']);
    expect(boxes.map(b => b.checked)).toEqual([false, false, true]);
    fireEvent.click(boxes[0] as HTMLInputElement);
    expect(props.onChange).toHaveBeenLastCalledWith(['a', 'c']);
    rerender(<CheckboxWidget {...props} value={['a', 'c']} />);
    fireEvent.click(boxes[2] as HTMLInputElement);
    expect(props.onChange).toHaveBeenLastCalledWith(['a']);
  });

  it('无值时全部未勾选, 勾选写回单元素数组; 不在选项中的已有值保留', () => {
    const props = fieldProps<unknown[]>({ schema });
    const { rerender } = render(<CheckboxWidget {...props} />);
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes.every(b => !b.checked)).toBe(true);
    fireEvent.click(boxes[1] as HTMLInputElement);
    expect(props.onChange).toHaveBeenLastCalledWith(['b']);
    rerender(<CheckboxWidget {...props} value={['x']} />);
    fireEvent.click(boxes[0] as HTMLInputElement);
    expect(props.onChange).toHaveBeenLastCalledWith(['a', 'x']);
  });

  it.each(MODES)('mode=%s', mode => {
    render(<CheckboxWidget {...fieldProps<unknown[]>({ mode, schema })} />);
    for (const box of screen.getAllByRole('checkbox') as HTMLInputElement[]) expect(box.disabled).toBe(mode !== 'edit');
  });

  it('有错误时 aria-invalid', () => {
    render(<CheckboxWidget {...fieldProps<unknown[]>({ errors: [ERROR], schema })} />);
    expect(screen.getByRole('group').getAttribute('aria-invalid')).toBe('true');
  });
});
