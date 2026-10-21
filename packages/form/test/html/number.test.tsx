// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NumberWidget, RangeWidget } from '../../src/html/index.js';
import { ERROR, fieldProps, MODES } from './helpers.js';

const control = () => document.getElementById('f') as HTMLInputElement;

describe('number', () => {
  it('显示值并写回数字, 空串写回 undefined', () => {
    const props = fieldProps<number>({ value: 3, schema: { type: 'number' } });
    render(<NumberWidget {...props} />);
    expect(control().type).toBe('number');
    expect(control().value).toBe('3');
    fireEvent.change(control(), { target: { value: '-1.5' } });
    expect(props.onChange).toHaveBeenLastCalledWith(-1.5);
    fireEvent.change(control(), { target: { value: '' } });
    expect(props.onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('integer 设 step=1, number 设 step=any; minimum maximum 同步', () => {
    const { rerender } = render(
      <NumberWidget {...fieldProps<number>({ schema: { type: 'integer', minimum: 0, maximum: 10 } })} />
    );
    expect(control().step).toBe('1');
    expect(control().min).toBe('0');
    expect(control().max).toBe('10');
    rerender(<NumberWidget {...fieldProps<number>({ schema: { type: 'number' } })} />);
    expect(control().step).toBe('any');
    expect(control().hasAttribute('min')).toBe(false);
    expect(control().hasAttribute('max')).toBe(false);
  });

  it('浏览器标记 badInput 的半成品只留作草稿, 不写回', () => {
    const props = fieldProps<number>({ value: 5, schema: { type: 'number' } });
    const { rerender } = render(<NumberWidget {...props} />);
    Object.defineProperty(control(), 'validity', { configurable: true, value: { badInput: true } });
    fireEvent.change(control(), { target: { value: '' } });
    expect(props.onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).not.toBe('');
    expect(control().getAttribute('aria-invalid')).toBe('true');
    expect(control().getAttribute('aria-describedby')).toBe('f-draft-error');
    rerender(<NumberWidget {...props} />);
    expect(screen.queryByRole('alert')).not.toBeNull();
    rerender(<NumberWidget {...props} value={7} />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(control().value).toBe('7');
  });

  it.each(MODES)('mode=%s', mode => {
    render(<NumberWidget {...fieldProps<number>({ mode, value: 1 })} />);
    expect(control().readOnly).toBe(mode === 'view');
    expect(control().disabled).toBe(mode === 'disabled');
  });

  it('有错误时 aria-invalid', () => {
    render(<NumberWidget {...fieldProps<number>({ errors: [ERROR] })} />);
    expect(control().getAttribute('aria-invalid')).toBe('true');
    expect(control().getAttribute('aria-describedby')).toBe('f-errors');
  });

  it('x-decimals 设 step, 失焦时按十进制舍入', () => {
    const props = fieldProps<number>({ value: 1.005, schema: { type: 'number', 'x-decimals': 2 } });
    render(<NumberWidget {...props} />);
    expect(control().step).toBe('0.01');
    fireEvent.blur(control());
    expect(props.onChange).toHaveBeenLastCalledWith(1.01);
    expect(props.onBlur).toHaveBeenCalled();
  });

  it('开了千分位时用文本框: 失焦显示千分位, 聚焦显示原值, 输入去掉逗号与空格', () => {
    const props = fieldProps<number>({ value: 1234567.5, schema: { type: 'number' }, thousands: true });
    const { rerender } = render(<NumberWidget {...props} />);
    expect(control().type).toBe('text');
    expect(control().inputMode).toBe('decimal');
    expect(control().value).toBe('1,234,567.5');
    fireEvent.focus(control());
    expect(control().value).toBe('1234567.5');
    fireEvent.change(control(), { target: { value: '2，000 000' } });
    expect(props.onChange).toHaveBeenLastCalledWith(2000000);
    rerender(<NumberWidget {...props} value={2000000} />);
    fireEvent.blur(control());
    expect(control().value).toBe('2,000,000');
    fireEvent.change(control(), { target: { value: '1e3' } });
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).not.toBeNull();
  });

  it.each(['view', 'disabled'] as const)('千分位在 mode=%s 下聚焦后仍显示千分位', mode => {
    render(
      <NumberWidget {...fieldProps<number>({ mode, value: 1234567.5, schema: { type: 'number' }, thousands: true })} />
    );
    fireEvent.focus(control());
    expect(control().value).toBe('1,234,567.5');
  });
});

describe('range', () => {
  it('按 minimum maximum 设范围, 写回数字', () => {
    const props = fieldProps<number>({ value: 3, schema: { type: 'integer', minimum: 0, maximum: 10 } });
    render(<RangeWidget {...props} />);
    expect(control().type).toBe('range');
    expect(control().min).toBe('0');
    expect(control().max).toBe('10');
    expect(control().step).toBe('1');
    fireEvent.change(control(), { target: { value: '7' } });
    expect(props.onChange).toHaveBeenLastCalledWith(7);
  });
});
