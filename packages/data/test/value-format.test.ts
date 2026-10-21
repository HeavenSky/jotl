// x-valueFormat: 校验(严格格式串, 时间戳只验整数, 别名放宽为 RFC 3339), 别名写出, 默认数据与 Mock 生成合法值.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type JsonSchema, matchesValueFormat } from '@jotl/core';
import { getDefaults, mock, validate } from '../src/index.js';
import { dayjs, formatValueFormat, isValidValueFormatValue } from '../src/value-format.js';

const originalTz = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'Asia/Shanghai';
});
afterAll(() => {
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

const codes = (schema: JsonSchema, data: unknown) => validate(schema, data).diagnostics.map(d => d.code);

describe('isValidValueFormatValue', () => {
  it.each([
    ['YYYYMMDD', '20261013', true],
    ['YYYYMMDD', '20261332', false],
    ['YYYY-MM-DD', '2026-02-30', false],
    ['HH:mm', '09:30', true],
    ['HH:mm', '09:30:15', false],
    ['HH:mm:ssZ', '10:00:00+08:00', true],
    ['HH:mm:ssZ', '10:00:00', false],
    ['HH:mm:ssZZ', '10:00:00+0800', true],
    ['YYYY-MM-DD HH:mm:ssZ', '2026-10-13 01:30:15+00:00', true],
    ['YYYY-MM-DD HH:mm:ssZ', '2026-10-13 09:30:15-05:00', true],
    ['YYYY-MM-DD HH:mm:ssZZ', '2026-10-13 01:30:15+0000', true],
    ['YYYY-MM-DD HH:mm:ssZ', '2026-10-13 25:30:15+00:00', false],
    ['x', 1791855015000, true],
    ['x', 1.5, false],
    ['X', '1791855015', true],
    ['iso', '2026-10-13T01:30:15.123Z', true],
    ['utc', '2026-10-13T09:30:15+08:00', true],
    ['utc-x', '2026-10-13T09:30:15', false],
    ['iso-x', '2026-02-30T09:30:15Z', false],
    ['iso', '2026-10-13T24:00:00Z', false],
  ] as const)('%s %j → %s', (fmt, value, valid) => expect(isValidValueFormatValue(fmt, value)).toBe(valid));
});

describe('与 @jotl/core 的 matchesValueFormat(编译期默认值校验)结论一致', () => {
  it.each([
    ['YYYY-MM-DD', '2024-02-29'],
    ['YYYY-MM-DD', '2023-02-29'],
    ['YYYY-MM-DD', '2026-04-31'],
    ['YYYY-MM-DD', '2026-13-01'],
    ['YYYY-MM-DD', '2026-4-03'],
    ['YYYYMMDD', '20261013'],
    ['YYYYMMDD', '2026101'],
    ['HH:mm', '09:30'],
    ['HH:mm', '9:30'],
    ['HH:mm:ss', '24:00:00'],
    ['HH:mm:ss.SSS', '23:59:59.999'],
    ['HH:mm:ss.SSS', '23:59:59.99'],
    ['HH:mm:ssZ', '10:00:00+08:00'],
    ['HH:mm:ssZ', '10:00:00-05:30'],
    ['HH:mm:ssZ', '10:00:00'],
    ['HH:mm:ssZZ', '10:00:00+0800'],
    ['HH:mm:ssZZ', '10:00:00+08:00'],
    ['YYYY-MM-DD HH:mm:ssZ', '2026-10-13 09:30:15-05:00'],
    ['YYYY-MM-DD HH:mm:ssZ', '2026-10-13 25:30:15+00:00'],
    ['HH:mm A', '13:00 PM'],
    ['HH:mm A', '01:00 PM'],
    ['HH:mm a', '09:00 am'],
    ['[Day] YYYY.MM', 'Day 2026.10'],
    ['[Day] YYYY.MM', 'Day 2026-10'],
    ['YYYY-MM-DDTHH:mm', '2026-10-13T09:30'],
    ['x', 1791855015000],
    ['x', 1.5],
    ['X', '1791855015'],
    ['iso', '2026-10-13T01:30:15.123Z'],
    ['utc', '2026-10-13T09:30:15+08:00'],
    ['utc-x', '2026-10-13T09:30:15'],
    ['iso-x', '2026-02-30T09:30:15Z'],
    ['iso', '2026-10-13T24:00:00Z'],
    ['iso', '2026-10-13 09:30:15Z'],
  ] as const)('%s %j', (fmt, value) =>
    expect(matchesValueFormat(fmt, value)).toBe(isValidValueFormatValue(fmt, value))
  );
});

describe('别名写出(方案 V3)', () => {
  it('北京时间 09:30:15', () => {
    const d = dayjs('2026-10-13T09:30:15');
    expect(formatValueFormat('iso', d)).toBe('2026-10-13T09:30:15+08:00');
    expect(formatValueFormat('iso-x', d)).toBe('2026-10-13T09:30:15.000+08:00');
    expect(formatValueFormat('utc', d)).toBe('2026-10-13T01:30:15Z');
    expect(formatValueFormat('utc-x', d)).toBe('2026-10-13T01:30:15.000Z');
    expect(formatValueFormat('x', d)).toBe(1791855015000);
    expect(formatValueFormat('X', d)).toBe(1791855015);
    expect(formatValueFormat('YYYYMMDD', d)).toBe('20261013');
  });
});

describe('validate', () => {
  it('不符合格式串报 JOTL4025, errorMessage 可按关键字覆盖', () => {
    const schema: JsonSchema = { type: 'string', 'x-valueFormat': 'YYYYMMDD' };
    expect(codes(schema, '2026-10-13')).toEqual(['JOTL4025']);
    expect(codes(schema, '20261013')).toEqual([]);
    const custom = validate({ ...schema, errorMessage: { 'x-valueFormat': '日期写成 8 位数字' } }, 'x');
    expect(custom.diagnostics.map(d => d.message)).toEqual(['日期写成 8 位数字']);
  });

  it('别名与 format: date-time 同时出现时只报 format', () => {
    expect(codes({ type: 'string', format: 'date-time', 'x-valueFormat': 'utc' }, '2026-10-13')).toEqual(['JOTL4009']);
    expect(codes({ type: 'string', 'x-valueFormat': 'utc' }, '2026-10-13')).toEqual(['JOTL4025']);
  });

  it('时间戳类型不符只报类型错误', () => {
    expect(codes({ type: 'integer', 'x-valueFormat': 'x' }, '1')).toEqual(['JOTL4001']);
  });
});

describe('默认数据与 Mock', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      day: { type: 'string', 'x-valueFormat': 'YYYYMMDD' },
      alarm: { type: 'string', 'x-valueFormat': 'HH:mm' },
      at: { type: 'string', format: 'date-time', 'x-valueFormat': 'utc-x' },
      stamp: { type: 'integer', 'x-valueFormat': 'x' },
      sec: { type: ['integer', 'null'], 'x-valueFormat': 'X' },
    },
    required: ['day', 'alarm', 'at', 'stamp', 'sec'],
  };

  it('零值按格式取固定时刻', () => {
    expect(getDefaults(schema, { strategy: 'required' }).value).toEqual({
      day: '20000101',
      alarm: '00:00',
      at: '1999-12-31T16:00:00.000Z',
      stamp: 0,
      sec: 0,
    });
  });

  it('无 x-valueFormat 的 date, time, date-time 零值为合法的固定时刻', () => {
    const plain: JsonSchema = {
      type: 'object',
      properties: {
        day: { type: 'string', format: 'date' },
        clock: { type: 'string', format: 'time' },
        at: { type: 'string', format: 'date-time' },
      },
      required: ['day', 'clock', 'at'],
    };
    const defaults = getDefaults(plain, { strategy: 'required' }).value as Record<string, string>;
    expect(defaults['day']).toBe('2000-01-01');
    expect(defaults['clock']).toMatch(/^00:00:00[+-]\d{2}:\d{2}$/);
    expect(defaults['at']).toMatch(/^2000-01-01T00:00:00[+-]\d{2}:\d{2}$/);
    expect(validate(plain, defaults).diagnostics).toEqual([]);
  });

  it('Mock 可复现且通过校验', () => {
    for (const seed of [1, 2, 3, 42]) {
      const result = mock(schema, { seed });
      expect(result.value).toEqual(mock(schema, { seed }).value);
      expect(result.diagnostics).toEqual([]);
      expect(validate(schema, result.value).value).toEqual({ valid: true });
    }
  });
});

describe('本地 DST 跳过的时刻仍按格式串判定(America/New_York)', () => {
  beforeAll(() => {
    process.env.TZ = 'America/New_York';
  });
  afterAll(() => {
    process.env.TZ = 'Asia/Shanghai';
  });

  it('前提: dayjs 严格解析在该时区判 2024-03-10 02:30 不合法', () => {
    expect(dayjs('2024-03-10 02:30', 'YYYY-MM-DD HH:mm', true).isValid()).toBe(false);
  });

  it.each([
    ['YYYY-MM-DD HH:mm', '2024-03-10 02:30', true],
    ['YYYY-MM-DD HH:mm:ss', '2024-03-10 02:59:59', true],
    ['YYYY-MM-DD HH:mm', '2024-03-10 25:30', false],
    ['YYYY-MM-DD HH:mm:ssZ', '2024-03-10 02:30:00+08:00', true],
  ] as const)('%s %j → %s', (fmt, value, valid) => expect(isValidValueFormatValue(fmt, value)).toBe(valid));

  it('validate 不报 JOTL4025', () => {
    expect(
      codes({ type: 'string', 'x-component': 'datetime', 'x-valueFormat': 'YYYY-MM-DD HH:mm' }, '2024-03-10 02:30')
    ).toEqual([]);
  });
});
