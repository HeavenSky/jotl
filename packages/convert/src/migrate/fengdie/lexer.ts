// 凤蝶 schema 词法器: 按 umo-edit-sdk 0.0.8 `parse/schema.l` 的规则顺序逐个产出记号, 先匹配的规则优先(jison 默认, 不取最长).
import type { Diagnostic, SourceRange } from '@jotl/core';
import { migrateDiagnostic } from './diagnostics.js';
import type { LineMap } from './line-map.js';

export type TokenKind =
  | 'LOTTERY'
  | 'ARRAY'
  | 'OBJECT'
  | 'OPEN_ACTION'
  | 'ACTION'
  | 'ENUM'
  | 'PUBLIC'
  | 'EXPORT'
  | 'SPM'
  | 'COLON'
  | 'START'
  | 'END'
  | 'TYPESTRING'
  | 'METASTART'
  | 'METAEND'
  | 'METAVALUE_BOOL'
  | 'METAVALUE_NUMBER'
  | 'METAVALUE_STRING'
  | 'VAR'
  | 'DOT'
  | 'STRING'
  | 'EOF';

export interface Token {
  kind: TokenKind;
  /** 源码原文. */
  text: string;
  /** METAVALUE_STRING STRING TYPESTRING 去掉定界符后的内容, 其余同 text. */
  value: string;
  start: number;
  end: number;
  range: SourceRange;
}

/** schema.l 的规则表, 顺序即优先级; value 为 undefined 时 value 同原文. */
const RULES: readonly [RegExp, TokenKind | 'SKIP' | 'NUMBER_OR_VAR', ((raw: string) => string)?][] = [
  [/Lottery\b/y, 'LOTTERY'],
  [/Array\b/y, 'ARRAY'],
  [/Object\b/y, 'OBJECT'],
  [/OpenAction\b/y, 'OPEN_ACTION'],
  [/Action\b/y, 'ACTION'],
  [/Enum\b/y, 'ENUM'],
  [/public\b/y, 'PUBLIC'],
  [/export\b/y, 'EXPORT'],
  [/Spm\b/y, 'SPM'],
  // `命名空间.组件` 系列不带单词边界: `a.b.c` 切成 `a.b` 与 `.c`, 与 jison 一致.
  [/[a-zA-Z_]\w*\.\w+\[Array\]/y, 'ARRAY'],
  [/[a-zA-Z_]\w*\.\w+\[Object\]/y, 'OBJECT'],
  [/[a-zA-Z_]\w*\.\w+/y, 'OBJECT'],
  [/ModuleArray\b/y, 'ARRAY'],
  [/Module\b/y, 'OBJECT'],
  [/:/y, 'COLON'],
  [/\{/y, 'START'],
  [/\}/y, 'END'],
  [/<(\w+?)>/y, 'TYPESTRING', raw => raw.slice(1, -1)],
  [/\[/y, 'METASTART'],
  [/\]/y, 'METAEND'],
  // 布尔值没有单词边界: `trueName` 被切成 `true` 与 `Name`.
  [/true|false/y, 'METAVALUE_BOOL'],
  [/-?\d[\d.]*/y, 'NUMBER_OR_VAR'],
  [/[$\w][$\w-]*/y, 'VAR'],
  [/\.(?=[$\w])/y, 'DOT'],
  [/"(?:\\"|[^"])*"/y, 'METAVALUE_STRING', raw => raw.slice(1, -1).replace(/\\"/g, '"')],
  // 说明中的 `\)` 不还原, 与 umo-edit-sdk 一致.
  [/\((?:\\\)|[^)])*\)/y, 'STRING', raw => raw.slice(1, -1)],
  [/\s+/y, 'SKIP'],
  [/\/\*[\s\S]+?\*\//y, 'SKIP'],
  [/,/y, 'SKIP'],
];

export class Lexer {
  private offset = 0;
  /** 读到 `[` 后进入元数据模式, 读到 `]` 后退出; 只影响数字串归为数字还是名字. */
  private meta = false;

  constructor(
    private readonly text: string,
    private readonly lines: LineMap
  ) {}

  /** 返回下一个记号; 遇到无法识别的文本时返回诊断, 之后不应再调用. */
  next(): Token | Diagnostic {
    for (;;) {
      const start = this.offset;
      if (start >= this.text.length) return this.token('EOF', '', '', start);
      const matched = this.match(start);
      if (matched === undefined) return this.problem(start);
      const [raw, kind, value] = matched;
      if (kind === 'SKIP') {
        this.offset += raw.length;
        continue;
      }
      return this.token(kind, raw, value, start);
    }
  }

  private match(start: number): [string, TokenKind | 'SKIP', string] | undefined {
    for (const [re, rule, unwrap] of RULES) {
      re.lastIndex = start;
      const m = re.exec(this.text);
      if (m === null) continue;
      const raw = m[0];
      if (rule === 'METASTART') this.meta = true;
      if (rule === 'METAEND') this.meta = false;
      const kind = rule === 'NUMBER_OR_VAR' ? (this.meta ? 'METAVALUE_NUMBER' : 'VAR') : rule;
      return [raw, kind, unwrap === undefined ? raw : unwrap(raw)];
    }
    return undefined;
  }

  private token(kind: TokenKind, raw: string, value: string, start: number): Token {
    const end = start + raw.length;
    this.offset = end;
    return { kind, text: raw, value, start, end, range: this.lines.range(start, end) };
  }

  private problem(start: number): Diagnostic {
    const text = this.text;
    const location = (end: number) => ({ location: { kind: 'source' as const, range: this.lines.range(start, end) } });
    if (text.startsWith('/*', start)) return migrateDiagnostic('JOTL8003', {}, location(text.length));
    if (text[start] === '"') return migrateDiagnostic('JOTL8004', {}, location(text.length));
    if (text[start] === '(') return migrateDiagnostic('JOTL8005', {}, location(text.length));
    const char = String.fromCodePoint(text.codePointAt(start)!);
    return migrateDiagnostic('JOTL8001', { text: char }, location(start + char.length));
  }
}
