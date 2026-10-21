// 递归下降解析器: 源码 → AST(定稿 §3 §4 §7), 以 `}` 与下一个键为同步点恢复, 一次报出多个语法错误.
import type { Diagnostic, SourceRange, SourceSpan } from '../schema/index.js';
import type {
  ArrayValue,
  Body,
  Comment,
  Entry,
  Identifier,
  JotlFile,
  Key,
  Label,
  LiteralValue,
  Marker,
  Meta,
  ObjectValue,
  ObjectValueMember,
  StringLiteral,
  ValueNode,
} from './ast.js';
import { isComponentName, isTypeName } from './builtins.js';
import { type SYNTAX_EXPECTED, syntaxDiagnostic, syntaxExpected, syntaxFixTitle, syntaxReason } from './diagnostics.js';
import { type ScanResult, type Token, type TokenKind, scanToken } from './lexer.js';
import { LineMap } from './line-map.js';

export interface ParseOutput {
  ast: JotlFile;
  diagnostics: Diagnostic[];
}

type Expected = keyof typeof SYNTAX_EXPECTED;

const MAX_ACTUAL_LENGTH = 30;
export const MAX_NESTING = 256;
const KEY_TOKENS: ReadonlySet<TokenKind> = new Set(['ident', 'string', 'number', '*']);

class Parser {
  private pos = 0;
  private prevEnd = 0;
  private cache: ScanResult | undefined;
  readonly diagnostics: Diagnostic[] = [];
  readonly comments: Comment[] = [];
  private readonly lines: LineMap;
  private depth = 0;

  constructor(
    private readonly text: string,
    file: string
  ) {
    this.lines = new LineMap(text, file);
  }

  private peek(): Token {
    this.cache ??= scanToken(this.text, this.pos);
    return this.cache.token;
  }

  private commit(result: ScanResult): void {
    for (const c of result.comments) {
      this.comments.push({ kind: c.kind, text: c.text, range: this.range(c.start, c.end) });
    }
    for (const p of result.problems) {
      const params = p.reason ? { reason: syntaxReason(p.reason, p.params) } : p.params;
      const location = this.location(p.start, p.end);
      const fixes =
        p.reason === 'invalidEscape'
          ? [
              {
                title: syntaxFixTitle('escapeBackslash'),
                edits: [{ range: this.range(p.start, p.start + 1), newText: '\\\\' }],
              },
            ]
          : undefined;
      this.diagnostics.push(syntaxDiagnostic(p.code, params, fixes ? { location, fixes } : { location }));
    }
  }

  private next(): Token {
    const token = this.peek();
    this.commit(this.cache!);
    this.cache = undefined;
    this.pos = token.end;
    if (token.kind !== 'eof') this.prevEnd = token.end;
    return token;
  }

  private at(kind: TokenKind): boolean {
    return this.peek().kind === kind;
  }

  private range(start: number, end: number): SourceRange {
    return this.lines.range(start, end);
  }

  private span(start: number, end: number, key?: { start: number; end: number }): SourceSpan {
    const span: SourceSpan = { range: this.range(start, end) };
    if (key) span.keyRange = this.range(key.start, key.end);
    return span;
  }

  private location(start: number, end: number) {
    return { kind: 'source' as const, range: this.range(start, end) };
  }

  private unexpected(expected: Expected, params?: Record<string, string>, token: Token = this.peek()): void {
    const actual =
      token.kind === 'eof'
        ? syntaxExpected('endOfFile')
        : token.text.length > MAX_ACTUAL_LENGTH
          ? `${token.text.slice(0, MAX_ACTUAL_LENGTH)}…`
          : token.text;
    this.diagnostics.push(
      syntaxDiagnostic(
        'JOTL1002',
        { expected: syntaxExpected(expected, params), actual },
        { location: this.location(token.start, Math.max(token.end, token.start)) }
      )
    );
  }

  private enter(token: Token): boolean {
    if (this.depth >= MAX_NESTING) {
      this.diagnostics.push(
        syntaxDiagnostic('JOTL1029', { max: MAX_NESTING }, { location: this.location(token.start, token.end) })
      );
      return false;
    }
    this.depth++;
    return true;
  }

  /** 跳过到与当前开括号配对的闭括号之后(含), 用于超出嵌套上限时. */
  private skipBalanced(): void {
    let level = 0;
    for (;;) {
      const t = this.next();
      if (t.kind === '{' || t.kind === '[') level++;
      else if (t.kind === '}' || t.kind === ']') level--;
      if (level <= 0 || t.kind === 'eof') return;
    }
  }

  parseFile(): JotlFile {
    const entries: Entry[] = [];
    let markers: Marker[] = [];
    while (!this.at('eof')) {
      const token = this.peek();
      if (token.kind === 'marker') {
        markers.push(this.marker());
        continue;
      }
      if (KEY_TOKENS.has(token.kind)) {
        entries.push(this.entry(false, markers));
        markers = [];
        continue;
      }
      this.unexpected('entry');
      this.next();
    }
    // 提交文件末尾的注释与词法错误.
    this.next();
    for (const m of markers) {
      this.diagnostics.push(
        syntaxDiagnostic('JOTL1038', { marker: `<${m.name}/>` }, { location: { kind: 'source', range: m.span.range } })
      );
    }
    return {
      kind: 'File',
      file: this.lines.file,
      entries,
      comments: this.comments,
      span: this.span(0, this.text.length),
    };
  }

  private marker(): Marker {
    const t = this.next();
    return { kind: 'Marker', name: t.value as 'root' | 'default', span: this.span(t.start, t.end) };
  }

  private key(): Key {
    const t = this.next();
    const base = { kind: 'Key' as const, raw: t.text, span: this.span(t.start, t.end) };
    switch (t.kind) {
      case 'string':
        return { ...base, form: 'string', name: t.value as string, value: t.value as string };
      case 'number':
        return { ...base, form: 'number', name: t.text, value: t.value as number };
      case '*':
        return { ...base, form: 'star', name: '*', value: '*' };
      default: {
        const name = t.text;
        const value = name === 'true' ? true : name === 'false' ? false : name;
        return { ...base, form: 'identifier', name, value };
      }
    }
  }

  /** 内容是否从当前记号开始; 没有冒号时只在同一行且是组件名, 或紧跟 `[` `{` 时视为漏写冒号的内容. */
  private missingColonContent(enumBody: boolean): boolean {
    const t = this.peek();
    if (enumBody) return false;
    if (t.kind === '{' || t.kind === '[') return true;
    if (t.kind !== 'ident' || t.newlineBefore) return false;
    return isComponentName(t.text) || isTypeName(t.text);
  }

  private entry(enumBody: boolean, markers: Marker[]): Entry {
    const key = this.key();
    const start = key.span.range.start.offset;
    let label: Label | undefined;
    if (this.at('label')) {
      const t = this.next();
      label = { kind: 'Label', text: t.value as string, span: this.span(t.start, t.end) };
    }
    let question: SourceRange | undefined;
    if (this.at('?')) {
      const t = this.next();
      question = this.range(t.start, t.end);
    }
    let colon: SourceRange | undefined;
    let component: Identifier | undefined;
    let meta: Meta | undefined;
    let body: Body | undefined;
    if (this.at(':')) {
      const t = this.next();
      colon = this.range(t.start, t.end);
      const next = this.peek();
      if (next.kind !== 'ident' && next.kind !== '[' && next.kind !== '{') {
        this.unexpected('content');
      }
      ({ component, meta, body } = this.content());
    } else if (enumBody && this.at('[')) {
      meta = this.meta();
    } else if (this.missingColonContent(enumBody)) {
      const t = this.peek();
      this.diagnostics.push(syntaxDiagnostic('JOTL1040', {}, { location: this.location(t.start, t.end) }));
      ({ component, meta, body } = this.content());
    }
    const end = Math.max(this.prevEnd, key.span.range.end.offset);
    if (this.at(',') || this.at(';')) this.next();
    const keyRange = { start: key.span.range.start.offset, end: key.span.range.end.offset };
    return {
      kind: 'Entry',
      markers,
      key,
      label,
      question,
      colon,
      component,
      meta,
      body,
      span: this.span(start, end, keyRange),
    };
  }

  private content(): { component: Identifier | undefined; meta: Meta | undefined; body: Body | undefined } {
    let component: Identifier | undefined;
    if (this.at('ident')) {
      const t = this.next();
      component = { kind: 'Identifier', name: t.text, span: this.span(t.start, t.end) };
    }
    const meta = this.at('[') ? this.meta() : undefined;
    const body = this.at('{') ? this.body(component?.name === 'enum') : undefined;
    return { component, meta, body };
  }

  private body(enumBody: boolean): Body | undefined {
    const open = this.peek();
    if (!this.enter(open)) {
      this.skipBalanced();
      return undefined;
    }
    this.next();
    const entries: Entry[] = [];
    for (;;) {
      const t = this.peek();
      if (t.kind === '}' || t.kind === 'eof') break;
      if (t.kind === 'marker') {
        const m = this.marker();
        this.diagnostics.push(
          syntaxDiagnostic(
            'JOTL1038',
            { marker: `<${m.name}/>` },
            { location: { kind: 'source', range: m.span.range } }
          )
        );
        continue;
      }
      if (KEY_TOKENS.has(t.kind)) {
        entries.push(this.entry(enumBody, []));
        continue;
      }
      this.unexpected('entry');
      this.next();
    }
    this.depth--;
    const close = this.peek();
    if (close.kind === '}') this.next();
    else
      this.diagnostics.push(
        syntaxDiagnostic('JOTL1003', { bracket: '}' }, { location: this.location(open.start, open.end) })
      );
    return { kind: 'Body', entries, span: this.span(open.start, this.prevEnd) };
  }

  private meta(): Meta | undefined {
    const open = this.peek();
    if (!this.enter(open)) {
      this.skipBalanced();
      return undefined;
    }
    this.next();
    const members = this.members(']');
    this.depth--;
    return { kind: 'Meta', members, span: this.span(open.start, this.prevEnd) };
  }

  /** JSON5 对象成员列表, 读到 closer(含)为止; 成员之间必须有 `,`, 允许末尾 `,`. */
  private members(closer: ']' | '}'): ObjectValueMember[] {
    const members: ObjectValueMember[] = [];
    for (;;) {
      const t = this.peek();
      if (t.kind === closer) {
        this.next();
        return members;
      }
      if (t.kind === 'eof') {
        this.diagnostics.push(
          syntaxDiagnostic('JOTL1003', { bracket: closer }, { location: this.location(t.start, t.end) })
        );
        return members;
      }
      if (t.kind !== 'ident' && t.kind !== 'string') {
        this.unexpected('objectKey');
        if (!this.recover(closer)) return members;
        continue;
      }
      this.next();
      const key: StringLiteral = {
        kind: 'StringLiteral',
        value: t.kind === 'string' ? (t.value as string) : t.text,
        raw: t.text,
        span: this.span(t.start, t.end),
      };
      if (!this.at(':')) {
        this.unexpected('colon');
        if (!this.recover(closer)) return members;
        continue;
      }
      this.next();
      const value = this.value();
      if (value) members.push({ key, value });
      const after = this.peek();
      if (after.kind === ',') {
        this.next();
        continue;
      }
      if (after.kind === 'eof') continue;
      if (after.kind !== closer) {
        this.unexpected('separator', { closer });
        if (!this.recover(closer)) return members;
      }
    }
  }

  /** 跳到下一个 `,` 之后或 closer 之前; 遇到外层的 `}` 或文件结尾时放弃. */
  private recover(closer: ']' | '}'): boolean {
    let level = 0;
    for (;;) {
      const t = this.peek();
      if (t.kind === 'eof') return false;
      if (level === 0 && t.kind === closer) return true;
      if (level === 0 && closer === ']' && t.kind === '}') return false;
      this.next();
      if (t.kind === '[' || t.kind === '{') level++;
      else if (t.kind === ']' || t.kind === '}') level--;
      else if (level === 0 && t.kind === ',') return true;
      if (level < 0) return false;
    }
  }

  private value(): ValueNode | undefined {
    const t = this.peek();
    switch (t.kind) {
      case 'string':
        this.next();
        return this.literal(t, t.value as string);
      case 'number':
        this.next();
        return this.literal(t, t.value as number);
      case 'ident':
        this.next();
        if (t.text === 'true' || t.text === 'false') return this.literal(t, t.text === 'true');
        if (t.text === 'null') return this.literal(t, null);
        if (t.text === 'Infinity' || t.text === 'NaN') {
          this.diagnostics.push(
            syntaxDiagnostic('JOTL1023', { text: t.text }, { location: this.location(t.start, t.end) })
          );
          return this.literal(t, 0);
        }
        this.unexpected('value', undefined, t);
        return undefined;
      case '[': {
        if (!this.enter(t)) {
          this.skipBalanced();
          return undefined;
        }
        this.next();
        const items: ValueNode[] = [];
        for (;;) {
          const c = this.peek();
          if (c.kind === ']') {
            this.next();
            break;
          }
          if (c.kind === 'eof') {
            this.diagnostics.push(
              syntaxDiagnostic('JOTL1003', { bracket: ']' }, { location: this.location(t.start, t.end) })
            );
            break;
          }
          const item = this.value();
          if (item) items.push(item);
          else if (!this.recover(']')) break;
          else continue;
          const after = this.peek();
          if (after.kind === ',') this.next();
          else if (after.kind === 'eof') {
            this.diagnostics.push(
              syntaxDiagnostic('JOTL1003', { bracket: ']' }, { location: this.location(t.start, t.end) })
            );
            break;
          } else if (after.kind !== ']') {
            this.unexpected('separator', { closer: ']' });
            if (!this.recover(']')) break;
          }
        }
        this.depth--;
        return { kind: 'ArrayValue', items, span: this.span(t.start, this.prevEnd) } satisfies ArrayValue;
      }
      case '{': {
        if (!this.enter(t)) {
          this.skipBalanced();
          return undefined;
        }
        this.next();
        const members = this.members('}');
        this.depth--;
        return { kind: 'ObjectValue', members, span: this.span(t.start, this.prevEnd) } satisfies ObjectValue;
      }
      default:
        this.unexpected('value');
        return undefined;
    }
  }

  private literal(t: Token, value: LiteralValue['value']): LiteralValue {
    return { kind: 'LiteralValue', value, raw: t.text, span: this.span(t.start, t.end) };
  }
}

/** 解析源码; 有语法错误时仍返回尽力恢复出的 AST. */
export function parseSource(text: string, file: string): ParseOutput {
  const parser = new Parser(text, file);
  const ast = parser.parseFile();
  return { ast, diagnostics: parser.diagnostics };
}
