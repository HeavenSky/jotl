// JSON 语法错误定位与指针到文本偏移的映射.
import { describe, expect, it } from 'vitest';
import { jsonPointerOffsets, locateJsonError } from '../../src/index.js';

describe('locateJsonError', () => {
  it.each([['{"a": 1, "b": [true, null, -1.5e3, "\\u00e9\\n"]}'], ['  []  '], ['"x"']])(
    '合法 JSON 返回 undefined: %s',
    text => {
      expect(locateJsonError(text)).toBeUndefined();
    }
  );

  it.each([
    ['{"a": }', 6, '}'],
    ['{"a": 1,}', 8, '}'],
    ['[1 2]', 3, '2'],
    ['{"a": 01}', 7, '1'],
    ['"\\x"', 2, 'x'],
    ['[tru]', 1, 't'],
    ['{"a": 1', 7, undefined],
    ['', 0, undefined],
    ['{} {}', 3, '{'],
  ])('%s 的错误位于 %i', (text, offset, found) => {
    expect(locateJsonError(text)).toEqual({ offset, found });
  });
});

describe('jsonPointerOffsets', () => {
  it('对象成员取键名起点, 数组元素与根取值起点, 键名按指针转义', () => {
    const text = ' {"a": [1, {"b/c": true}], "~": null}';
    const offsets = jsonPointerOffsets(text);
    expect(offsets?.get('')).toBe(1);
    expect(offsets?.get('/a')).toBe(text.indexOf('"a"'));
    expect(offsets?.get('/a/0')).toBe(text.indexOf('1'));
    expect(offsets?.get('/a/1')).toBe(text.indexOf('{', 2));
    expect(offsets?.get('/a/1/b~1c')).toBe(text.indexOf('"b/c"'));
    expect(offsets?.get('/~0')).toBe(text.indexOf('"~"'));
  });

  it('不合法的 JSON 返回 undefined', () => {
    expect(jsonPointerOffsets('{')).toBeUndefined();
  });
});
