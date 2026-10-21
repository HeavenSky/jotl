// 词法器(定稿 §1): 从给定偏移扫描下一个记号与其前面的注释; 不保存状态. `(` 总是开始一个标签.

export type Punctuator = '{' | '}' | '[' | ']' | ')' | ',' | ';' | ':' | '?' | '*';

export type TokenKind = 'ident' | 'string' | 'number' | 'label' | 'marker' | 'eof' | Punctuator;

export interface Token {
  kind: TokenKind;
  start: number;
  end: number;
  /** 源码原文. */
  text: string;
  /** string 与 label 为解码后的文本, number 为数值, marker 为 `root` / `default`. */
  value: string | number | undefined;
  /** 与上一个记号之间有换行(文件开头视为有换行). */
  newlineBefore: boolean;
}

export interface RawComment {
  kind: 'LineComment' | 'BlockComment';
  text: string;
  start: number;
  end: number;
}

export interface LexProblem {
  code: 'JOTL1001' | 'JOTL1003' | 'JOTL1018' | 'JOTL1019' | 'JOTL1022' | 'JOTL1023' | 'JOTL1026';
  start: number;
  end: number;
  params: Record<string, string>;
  reason?: 'invalidEscape' | 'controlCharacter';
}

export interface ScanResult {
  token: Token;
  comments: RawComment[];
  problems: LexProblem[];
}

const PUNCTUATORS = new Set<string>(['{', '}', '[', ']', ')', ',', ';', ':', '?', '*']);
/** JS IdentifierName(不含 `\u` 转义), 另允许中间带 `-`(字段键 `a-b`). */
const IDENT_RE = /[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*(?:-[\p{ID_Continue}$\u200C\u200D]+)*/uy;
const NUMBER_RE = /[+-]?(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?|Infinity|NaN)/y;
const NUMBER_TAIL_RE = /[\p{ID_Continue}$.]+/uy;
const MARKER_RE = /<(root|default)\/>/y;
/** JS WhiteSpace; U+2028 U+2029 按空白处理, 不计行. */
const WHITESPACE_RE = /[\t\v\f \u00A0\uFEFF\u2028\u2029\p{Zs}]/u;
const SIMPLE_ESCAPES: Record<string, string> = {
  "'": "'",
  '"': '"',
  '\\': '\\',
  '/': '/',
  b: '\b',
  f: '\f',
  n: '\n',
  r: '\r',
  t: '\t',
  v: '\v',
};

function isLineBreak(c: number): boolean {
  return c === 0x0a || c === 0x0d;
}

export function isWhitespace(ch: string): boolean {
  return WHITESPACE_RE.test(ch);
}

function isTokenStart(text: string, i: number): boolean {
  const ch = text[i]!;
  if (
    PUNCTUATORS.has(ch) ||
    ch === '(' ||
    ch === '"' ||
    ch === "'" ||
    isLineBreak(ch.charCodeAt(0)) ||
    isWhitespace(ch)
  )
    return true;
  if (/[\p{ID_Start}$_0-9]/u.test(String.fromCodePoint(text.codePointAt(i)!))) return true;
  if (ch === '/' && (text[i + 1] === '/' || text[i + 1] === '*')) return true;
  return false;
}

interface Trivia {
  offset: number;
  newline: boolean;
  comments: RawComment[];
  problems: LexProblem[];
}

function skipTrivia(text: string, start: number): Trivia {
  const comments: RawComment[] = [];
  const problems: LexProblem[] = [];
  let i = start;
  let newline = start === 0;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (isLineBreak(c)) {
      newline = true;
      i++;
      continue;
    }
    const ch = String.fromCodePoint(text.codePointAt(i)!);
    if (isWhitespace(ch)) {
      i += ch.length;
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      let end = i;
      while (end < text.length && !isLineBreak(text.charCodeAt(end))) end++;
      comments.push({ kind: 'LineComment', text: text.slice(i, end), start: i, end });
      i = end;
      continue;
    }
    if (ch === '/' && text[i + 1] === '*') {
      const close = text.indexOf('*/', i + 2);
      const end = close < 0 ? text.length : close + 2;
      if (close < 0) problems.push({ code: 'JOTL1019', start: i, end, params: {} });
      const raw = text.slice(i, end);
      if (/[\n\r]/.test(raw)) newline = true;
      comments.push({ kind: 'BlockComment', text: raw, start: i, end });
      i = end;
      continue;
    }
    break;
  }
  return { offset: i, newline, comments, problems };
}

function makeToken(
  kind: TokenKind,
  text: string,
  start: number,
  end: number,
  newline: boolean,
  value?: string | number
): Token {
  return { kind, start, end, text: text.slice(start, end), value, newlineBefore: newline };
}

/** JSON5 字符串; 未知转义报错并保留反斜杠. */
function scanString(text: string, start: number, problems: LexProblem[]): { end: number; value: string } {
  const quote = text.charCodeAt(start);
  let i = start + 1;
  let value = '';
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (c === quote) return { end: i + 1, value };
    if (isLineBreak(c)) break;
    if (c === 0x5c) {
      const next = text[i + 1];
      if (next === undefined) {
        i++;
        break;
      }
      if (next in SIMPLE_ESCAPES) {
        value += SIMPLE_ESCAPES[next];
        i += 2;
        continue;
      }
      // 续行: 反斜杠加换行(CRLF 算一个)不进入取值.
      if (next === '\n' || next === '\u2028' || next === '\u2029') {
        i += 2;
        continue;
      }
      if (next === '\r') {
        i += text[i + 2] === '\n' ? 3 : 2;
        continue;
      }
      if (next === '0' && !/[0-9]/.test(text[i + 2] ?? '')) {
        value += '\0';
        i += 2;
        continue;
      }
      if (next === 'x' && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 2, i + 4))) {
        value += String.fromCharCode(Number.parseInt(text.slice(i + 2, i + 4), 16));
        i += 4;
        continue;
      }
      if (next === 'u' && /^[0-9A-Fa-f]{4}$/.test(text.slice(i + 2, i + 6))) {
        value += String.fromCharCode(Number.parseInt(text.slice(i + 2, i + 6), 16));
        i += 6;
        continue;
      }
      const escapeLength = String.fromCodePoint(text.codePointAt(i + 1)!).length + 1;
      problems.push({
        code: 'JOTL1022',
        start: i,
        end: i + escapeLength,
        params: { escape: text.slice(i, i + escapeLength) },
        reason: 'invalidEscape',
      });
      value += text.slice(i, i + escapeLength);
      i += escapeLength;
      continue;
    }
    if (c < 0x20) problems.push({ code: 'JOTL1022', start: i, end: i + 1, params: {}, reason: 'controlCharacter' });
    value += text[i];
    i++;
  }
  problems.push({ code: 'JOTL1018', start, end: i, params: {} });
  return { end: i, value };
}

/** 标签: `(` 到配对的 `)`, 允许成对嵌套; 转义 `\(` `\)` `\\`, 其他反斜杠原样保留; 不跨行. */
function scanLabel(text: string, start: number, problems: LexProblem[]): { end: number; value: string } {
  let i = start + 1;
  let depth = 0;
  let value = '';
  let closed = false;
  while (i < text.length) {
    const c = text.charCodeAt(i);
    if (isLineBreak(c)) break;
    if (c === 0x5c && (text[i + 1] === ')' || text[i + 1] === '(' || text[i + 1] === '\\')) {
      value += text[i + 1];
      i += 2;
      continue;
    }
    if (c === 0x28) depth++;
    if (c === 0x29) {
      if (depth === 0) {
        closed = true;
        i++;
        break;
      }
      depth--;
    }
    value += text[i];
    i++;
  }
  if (!closed) problems.push({ code: 'JOTL1003', start, end: i, params: { bracket: ')' } });
  const trimmed = value.replace(/^[\s\uFEFF\u00A0]+|[\s\uFEFF\u00A0]+$/gu, '');
  if (closed && trimmed === '') problems.push({ code: 'JOTL1026', start, end: i, params: {} });
  return { end: i, value: trimmed };
}

function parseNumber(raw: string): number {
  const sign = raw.startsWith('-') ? -1 : 1;
  const body = raw.replace(/^[+-]/, '');
  if (/^0[xX]/.test(body)) return sign * Number.parseInt(body.slice(2), 16);
  return sign * Number(body);
}

/** 从 offset 开始扫描下一个记号; 非法字符报 JOTL1001 后跳过. */
export function scanToken(text: string, offset: number): ScanResult {
  const comments: RawComment[] = [];
  const problems: LexProblem[] = [];
  let at = offset;
  let newline = offset === 0;
  for (;;) {
    const trivia = skipTrivia(text, at);
    comments.push(...trivia.comments);
    problems.push(...trivia.problems);
    if (trivia.newline) newline = true;
    const i = trivia.offset;
    const done = (token: Token): ScanResult => ({ token, comments, problems });
    if (i >= text.length) return done(makeToken('eof', text, i, i, newline));
    const ch = text[i]!;
    if (PUNCTUATORS.has(ch)) return done(makeToken(ch as Punctuator, text, i, i + 1, newline));
    if (ch === '(') {
      const { end, value } = scanLabel(text, i, problems);
      return done(makeToken('label', text, i, end, newline, value));
    }
    if (ch === '"' || ch === "'") {
      const { end, value } = scanString(text, i, problems);
      return done(makeToken('string', text, i, end, newline, value));
    }
    if (ch === '<') {
      MARKER_RE.lastIndex = i;
      const marker = MARKER_RE.exec(text);
      if (marker) return done(makeToken('marker', text, i, i + marker[0].length, newline, marker[1]));
    }
    NUMBER_RE.lastIndex = i;
    const num = /[0-9+.-]/.test(ch) ? NUMBER_RE.exec(text) : null;
    if (num) {
      let end = i + num[0].length;
      NUMBER_TAIL_RE.lastIndex = end;
      const tail = NUMBER_TAIL_RE.exec(text);
      const raw = num[0];
      if (tail || /Infinity|NaN/.test(raw)) {
        if (tail) end += tail[0].length;
        problems.push({ code: 'JOTL1023', start: i, end, params: { text: text.slice(i, end) } });
        const fallback = parseNumber(raw);
        return done(makeToken('number', text, i, end, newline, Number.isFinite(fallback) ? fallback : 0));
      }
      return done(makeToken('number', text, i, end, newline, parseNumber(raw)));
    }
    IDENT_RE.lastIndex = i;
    const ident = IDENT_RE.exec(text);
    if (ident) return done(makeToken('ident', text, i, i + ident[0].length, newline, ident[0]));
    let end = i;
    do end += String.fromCodePoint(text.codePointAt(end)!).length;
    while (end < text.length && !isTokenStart(text, end));
    problems.push({ code: 'JOTL1001', start: i, end, params: { char: text.slice(i, end) } });
    at = end;
  }
}
