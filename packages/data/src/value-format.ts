// 日期组件的存储格式 x-valueFormat(方案 V2-V4): 校验取值, 按格式生成取值; dayjs 格式串, `x` `X` 时间戳与 4 个 RFC 3339 别名.
import dayjs, { type Dayjs } from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import utc from 'dayjs/plugin/utc.js';
import { isTimestampValueFormat, isValueFormatAlias, matchesValueFormatText } from '@jotl/core';

dayjs.extend(utc);
dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);

const RFC3339 = /^\d{4}-\d{2}-\d{2}[Tt](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;

/** 别名读取时放宽: 任意合法 RFC 3339 date-time(带不带小数秒, Z 或 ±HH:mm); 日期部分另做严格检查, Date 会把 2 月 30 日顺延. */
export function isRfc3339DateTime(text: string): boolean {
  return RFC3339.test(text) && dayjs(text.slice(0, 10), 'YYYY-MM-DD', true).isValid() && dayjs(text).isValid();
}

const OFFSET = /([+-])(\d{2}):?(\d{2})/;

/**
 * 严格解析. dayjs 严格模式会把结果按本地时区重新格式化再与原文比对, 带非本地偏移的值因此判为不合法;
 * 格式串含偏移记号 Z 时, 改按原文中的偏移重新格式化比对, 合法时返回该时刻(之后按本地时区显示).
 */
function strictParse(text: string, format: string): Dayjs | undefined {
  const d = dayjs(text, format, true);
  if (d.isValid()) return d;
  if (!/Z/.test(format.replace(/\[[^\]]*\]/g, ''))) return undefined;
  const loose = dayjs(text, format);
  const m = OFFSET.exec(text);
  if (!loose.isValid() || m === null) return undefined;
  const minutes = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  return loose.utcOffset(minutes).format(format) === text ? loose : undefined;
}

/** 按格式串严格解析; 不合格式时返回 undefined. */
export function parseValueFormat(fmt: string, text: string): Dayjs | undefined {
  return strictParse(text, fmt);
}

/** 取值是否符合存储格式; 类型不对(交给 type 关键字)时返回 true. */
export function isValidValueFormatValue(fmt: string, data: unknown): boolean {
  if (isTimestampValueFormat(fmt)) return typeof data !== 'number' || Number.isInteger(data);
  if (typeof data !== 'string') return true;
  if (isValueFormatAlias(fmt)) return isRfc3339DateTime(data);
  // 优先用与时区无关的文本匹配; dayjs 严格解析在本地 DST 跳过的时刻(如纽约 2024-03-10 02:30)会误判不合法.
  return matchesValueFormatText(fmt, data) ?? parseValueFormat(fmt, data) !== undefined;
}

/** 按存储格式写出取值(方案 V3): 时间戳为整数, 其余为字符串. */
export function formatValueFormat(fmt: string, d: Dayjs): string | number {
  switch (fmt) {
    case 'x':
      return d.valueOf();
    case 'X':
      return Math.floor(d.valueOf() / 1000);
    case 'iso':
      return d.format();
    case 'iso-x': {
      const iso = d.format();
      return `${iso.slice(0, 19)}.${d.format('SSS')}${iso.slice(19)}`;
    }
    case 'utc-x':
      return d.toISOString();
    case 'utc':
      return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
    default:
      return d.format(fmt);
  }
}

/** 默认数据用的固定时刻: 本地 2000-01-01 00:00:00. */
export function fixedMoment(): Dayjs {
  return dayjs('2000-01-01T00:00:00');
}

export { dayjs };
