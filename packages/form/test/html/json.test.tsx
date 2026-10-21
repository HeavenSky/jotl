// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JsonWidget } from '../../src/html/index.js';
import { ERROR, fieldProps } from './helpers.js';

const textarea = () => document.getElementById('f') as HTMLTextAreaElement;

describe('json', () => {
  it('编辑态用 textarea 显示格式化的 JSON, 合法时写回解析结果', () => {
    const props = fieldProps<unknown>({ value: { a: [1, 2] }, schema: {} });
    render(<JsonWidget {...props} />);
    expect(textarea().tagName).toBe('TEXTAREA');
    expect(textarea().value).toBe(JSON.stringify({ a: [1, 2] }, null, 2));
    fireEvent.change(textarea(), { target: { value: '{"b":true}' } });
    expect(props.onChange).toHaveBeenLastCalledWith({ b: true });
  });

  it('不合法时保留草稿并显示错误, 不写回; 修正后写回', () => {
    const props = fieldProps<unknown>({ value: 1, schema: {} });
    const { rerender } = render(<JsonWidget {...props} />);
    fireEvent.change(textarea(), { target: { value: '{"a":' } });
    expect(props.onChange).not.toHaveBeenCalled();
    expect(textarea().value).toBe('{"a":');
    expect(screen.getByRole('alert').textContent).toContain('JSON');
    expect(textarea().getAttribute('aria-invalid')).toBe('true');
    expect(textarea().getAttribute('aria-describedby')).toBe('f-draft-error');
    rerender(<JsonWidget {...props} />);
    expect(textarea().value).toBe('{"a":');
    fireEvent.change(textarea(), { target: { value: '{"a": 1}' } });
    expect(props.onChange).toHaveBeenLastCalledWith({ a: 1 });
    rerender(<JsonWidget {...props} value={{ a: 1 }} />);
    expect(textarea().value).toBe('{"a": 1}');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('外部改值后丢弃草稿', () => {
    const props = fieldProps<unknown>({ value: 1, schema: {} });
    const { rerender } = render(<JsonWidget {...props} />);
    fireEvent.change(textarea(), { target: { value: '[' } });
    rerender(<JsonWidget {...props} value={2} />);
    expect(textarea().value).toBe('2');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('清空写回 undefined', () => {
    const props = fieldProps<unknown>({ value: 1, schema: {} });
    render(<JsonWidget {...props} />);
    fireEvent.change(textarea(), { target: { value: '  ' } });
    expect(props.onChange).toHaveBeenLastCalledWith(undefined);
  });

  it('mode=view 用 pre 显示', () => {
    render(<JsonWidget {...fieldProps<unknown>({ mode: 'view', value: { a: 1 }, schema: {} })} />);
    const pre = document.getElementById('f');
    expect(pre?.tagName).toBe('PRE');
    expect(pre?.textContent).toBe(JSON.stringify({ a: 1 }, null, 2));
    expect(document.querySelector('textarea')).toBeNull();
  });

  it.each(['edit', 'disabled'] as const)('mode=%s', mode => {
    render(<JsonWidget {...fieldProps<unknown>({ mode, value: 1, schema: {} })} />);
    expect(textarea().disabled).toBe(mode === 'disabled');
    expect(textarea().readOnly).toBe(false);
  });

  it('有错误时 aria-invalid', () => {
    render(<JsonWidget {...fieldProps<unknown>({ errors: [ERROR], schema: {} })} />);
    expect(textarea().getAttribute('aria-invalid')).toBe('true');
    expect(textarea().getAttribute('aria-describedby')).toBe('f-errors');
  });

  it('schema 为字符串时编辑原文, 合法时写回字符串, 不合法时保留草稿', () => {
    const props = fieldProps<unknown>({
      value: '{"a": 1}',
      schema: { type: 'string', contentMediaType: 'application/json' },
    });
    render(<JsonWidget {...props} />);
    expect(textarea().value).toBe('{"a": 1}');
    fireEvent.change(textarea(), { target: { value: '[1,  2]' } });
    expect(props.onChange).toHaveBeenLastCalledWith('[1,  2]');
    fireEvent.change(textarea(), { target: { value: '[1,' } });
    expect(props.onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert').textContent).toContain('JSON');
  });

  it('查看态的 pre 经 aria-labelledby 取外壳标签, 内容节点取外围标签', () => {
    render(
      <>
        {/* oxlint-disable-next-line jsx-a11y/label-has-associated-control -- 模拟字段外壳标签, 被测控件经 aria-labelledby 关联 */}
        <label id="f-label">配置</label>
        <JsonWidget {...fieldProps<unknown>({ mode: 'view', value: { a: 1 }, schema: {}, errors: [ERROR] })} />
      </>
    );
    const pre = screen.getByLabelText('配置');
    expect(pre.tagName).toBe('PRE');
    expect(pre.getAttribute('aria-describedby')).toBe('f-errors');
    cleanup();
    render(
      <>
        {/* oxlint-disable-next-line jsx-a11y/label-has-associated-control -- 模拟字段外壳标签, 被测控件经 aria-labelledby 关联 */}
        <label id="f-label">配置</label>
        <JsonWidget {...fieldProps<unknown>({ id: 'f+', mode: 'view', value: 1, schema: {} })} />
      </>
    );
    expect(screen.getByRole('group', { name: '配置' }).id).toBe('f+');
  });
});
