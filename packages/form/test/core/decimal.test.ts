import { describe, expect, it } from 'vitest';
import { formatThousands, fromBig, stripThousands, toBig } from '../../src/core/index.js';

describe('toBig / fromBig', () => {
  it('值对象, 字符串与数值互转, 运算精确', () => {
    const price = { type: 'money' as const, value: '0.10', currency: 'CNY' };
    const sum = toBig(price).plus(toBig('0.20'));
    expect(fromBig(sum, price)).toEqual({ type: 'money', value: '0.30', currency: 'CNY' });
    expect(fromBig(toBig(price).times(3), price)).toEqual({ type: 'money', value: '0.30', currency: 'CNY' });
    expect(fromBig(toBig('1.005'), '0.00')).toBe('1.01');
    expect(fromBig(toBig('1.5'), 0)).toBe(1.5);
    expect(fromBig(toBig('12345678901234567890.5'), { type: 'money', value: '0', currency: 'JPY' }, 2).value).toBe(
      '12345678901234567890.50'
    );
  });

  it('bigint 向零取整, 负零写成 0', () => {
    const big = { type: 'bigint' as const, value: '0' };
    expect(fromBig(toBig('-7.9'), big)).toEqual({ type: 'bigint', value: '-7' });
    expect(fromBig(toBig('99999999999999999999').plus(1), big).value).toBe('100000000000000000000');
    expect(fromBig(toBig('-0.001'), '0.00')).toBe('0.00');
  });

  it('不合法的输入抛错', () => {
    expect(() => toBig('1,000')).toThrow();
    expect(() => toBig({} as never)).toThrow();
  });
});

describe('千分位', () => {
  it('只对整数部分每 3 位插入逗号', () => {
    expect(formatThousands('1234567.891')).toBe('1,234,567.891');
    expect(formatThousands('-1000')).toBe('-1,000');
    expect(formatThousands('999')).toBe('999');
    expect(formatThousands('12345678901234567890')).toBe('12,345,678,901,234,567,890');
    expect(formatThousands('0.12345')).toBe('0.12345');
  });

  it('不是精确数字符串时原样返回', () => {
    expect(formatThousands('1e5')).toBe('1e5');
    expect(formatThousands('abc')).toBe('abc');
    expect(formatThousands('')).toBe('');
  });

  it('去掉半角与全角逗号, 空白与下划线', () => {
    expect(stripThousands('1,234，567 890_1.5')).toBe('12345678901.5');
    expect(stripThousands(formatThousands('-1234567.5'))).toBe('-1234567.5');
  });
});
