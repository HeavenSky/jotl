// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OutputWidget } from '../../src/html/index.js';
import { ERROR, fieldProps, MODES } from './helpers.js';

describe('const', () => {
  it('用 output 只读显示值, 无值时显示 schema.const; 不写回', () => {
    const props = fieldProps<unknown>({ schema: { const: 'banner' } });
    const { rerender } = render(<OutputWidget {...props} />);
    const output = screen.getByRole('status');
    expect(output.tagName).toBe('OUTPUT');
    expect(output.textContent).toBe('banner');
    rerender(<OutputWidget {...props} value={{ a: 1 }} schema={{ const: { a: 1 } }} />);
    expect(output.textContent).toBe('{"a":1}');
    expect(props.onChange).not.toHaveBeenCalled();
  });

  it.each(MODES)('mode=%s 时都只读显示', mode => {
    render(<OutputWidget {...fieldProps<unknown>({ mode, schema: { const: 1 } })} />);
    expect(screen.getByRole('status').textContent).toBe('1');
    expect(document.querySelector('input')).toBeNull();
  });

  it('有错误时 aria-invalid', () => {
    render(<OutputWidget {...fieldProps<unknown>({ errors: [ERROR], schema: { const: 1 } })} />);
    expect(screen.getByRole('status').getAttribute('aria-invalid')).toBe('true');
  });
});
