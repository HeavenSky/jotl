// 文本偏移与行列互换.
import { describe, expect, it } from 'vitest';
import { lineCount, offsetAt, positionAt } from '../src/text-position.js';

const text = 'ab\n名字x\n\nlast';

describe('text-position', () => {
  it('lineCount 按换行计数, 空文本与末尾换行各算一行', () => {
    expect(lineCount('')).toBe(1);
    expect(lineCount('a\n')).toBe(2);
    expect(lineCount(text)).toBe(4);
  });

  it('positionAt 与 offsetAt 互逆', () => {
    for (let offset = 0; offset <= text.length; offset += 1)
      expect(offsetAt(text, positionAt(text, offset))).toBe(offset);
    expect(positionAt(text, 5)).toEqual({ line: 2, column: 3 });
    expect(offsetAt(text, { line: 4, column: 1 })).toBe(text.indexOf('last'));
  });

  it('越界的偏移与行列收拢到合法位置', () => {
    expect(positionAt(text, -3)).toEqual({ line: 1, column: 1 });
    expect(positionAt(text, 999)).toEqual({ line: 4, column: 5 });
    expect(offsetAt(text, { line: 1, column: 99 })).toBe(2);
    expect(offsetAt(text, { line: 99, column: 1 })).toBe(text.length);
    expect(offsetAt(text, { line: 2, column: 0 })).toBe(3);
  });
});
