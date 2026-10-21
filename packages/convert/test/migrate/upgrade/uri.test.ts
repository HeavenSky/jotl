import { describe, expect, it } from 'vitest';
import { decodeFragment, encodeFragment, resolveUri, splitFragment } from '../../../src/migrate/upgrade/uri.js';

describe('RFC 3986 5.4 引用解析', () => {
  const base = 'http://a/b/c/d;p?q';
  it.each([
    ['g:h', 'g:h'],
    ['g', 'http://a/b/c/g'],
    ['./g', 'http://a/b/c/g'],
    ['g/', 'http://a/b/c/g/'],
    ['/g', 'http://a/g'],
    ['//g', 'http://g'],
    ['?y', 'http://a/b/c/d;p?y'],
    ['g?y', 'http://a/b/c/g?y'],
    ['#s', 'http://a/b/c/d;p?q#s'],
    ['g#s', 'http://a/b/c/g#s'],
    ['', 'http://a/b/c/d;p?q'],
    ['.', 'http://a/b/c/'],
    ['./', 'http://a/b/c/'],
    ['..', 'http://a/b/'],
    ['../g', 'http://a/b/g'],
    ['../..', 'http://a/'],
    ['../../g', 'http://a/g'],
    ['../../../g', 'http://a/g'],
    ['/./g', 'http://a/g'],
    ['g.', 'http://a/b/c/g.'],
    ['g/../h', 'http://a/b/c/h'],
    ['urn:example:x', 'urn:example:x'],
  ])('%s → %s', (reference, expected) => {
    expect(resolveUri(base, reference)).toBe(expected);
  });
});

describe('片段', () => {
  it('拆分, 解码与编码', () => {
    expect(splitFragment('a.json#/x')).toEqual({ base: 'a.json', fragment: '/x' });
    expect(splitFragment('a.json')).toEqual({ base: 'a.json', fragment: undefined });
    expect(decodeFragment('/q%22uote')).toBe('/q"uote');
    expect(decodeFragment('%E0%A4%A')).toBeUndefined();
    expect(encodeFragment('/$defs/q"uote/a b/%')).toBe('/$defs/q%22uote/a%20b/%25');
  });
});
