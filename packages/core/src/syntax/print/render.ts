// Jotl AST → 规范排版的源码文本; 打印器传入合成的 AST, 格式化器传入解析结果与源码注释.
import type { Body, Entry, JotlFile, Meta, ObjectValueMember, ValueNode } from '../ast.js';
import { scanToken } from '../lexer.js';
import { Writer, type WriterSource, newlinesBefore } from './writer.js';

interface Spanned {
  span: { range: { start: { offset: number }; end: { offset: number } } };
}

function startOf(node: Spanned): number {
  return node.span.range.start.offset;
}

function endOf(node: Spanned): number {
  return node.span.range.end.offset;
}

/** 标签的转义只有 `\(` `\)` `\\`; 先转反斜杠再转括号. */
export function escapeLabel(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/[()]/g, c => `\\${c}`);
}

class Renderer {
  constructor(
    private readonly w: Writer,
    private readonly source: WriterSource | undefined
  ) {}

  /** 源码中 offset 处; 打印模式下没有源码位置. */
  private at(offset: number): number | undefined {
    return this.source ? offset : undefined;
  }

  /** 源码中 offset 之后下一个记号的起点. */
  private after(offset: number): number | undefined {
    return this.source ? scanToken(this.source.text, offset).token.start : undefined;
  }

  private blankBefore(offset: number): boolean {
    return this.source ? newlinesBefore(this.source.text, offset).count >= 2 : false;
  }

  file(ast: JotlFile): string {
    for (const entry of ast.entries) {
      this.w.breakLine(true);
      for (const marker of entry.markers) {
        this.w.token(`<${marker.name}/>`, this.at(startOf(marker)));
        this.w.breakLine();
      }
      this.entry(entry, false, entry.markers.length === 0 && this.blankBefore(startOf(entry)));
    }
    return this.w.finish();
  }

  private entry(node: Entry, enumMember: boolean, blank: boolean): void {
    this.w.token(node.key.raw, this.at(startOf(node.key)), blank);
    if (node.label) this.w.token(`(${escapeLabel(node.label.text)})`, this.at(startOf(node.label)));
    if (node.question) this.w.token('?', this.at(node.question.start.offset));
    if (node.colon) {
      this.w.token(':', this.at(node.colon.start.offset));
      this.w.space();
    } else if (!enumMember && (node.component || node.body)) {
      this.w.space();
    }
    if (node.component) this.w.token(node.component.name, this.at(startOf(node.component)));
    if (node.meta) this.meta(node.meta);
    if (node.body) {
      const isEnum = node.component?.name === 'enum';
      if (!isEnum && (node.component || node.meta)) this.w.space();
      this.body(node.body, isEnum);
    }
  }

  private meta(node: Meta): void {
    this.w.token('[', this.at(startOf(node)));
    this.members(node.members);
    this.w.token(']', this.at(endOf(node) - 1));
  }

  private members(members: readonly ObjectValueMember[]): void {
    members.forEach((member, i) => {
      if (i > 0) {
        this.w.token(',', this.after(endOf(members[i - 1]!.value)));
        this.w.space();
      }
      this.w.token(member.key.raw, this.at(startOf(member.key)));
      this.w.token(':', this.after(endOf(member.key)));
      this.w.space();
      this.value(member.value);
    });
  }

  private body(node: Body, isEnum: boolean): void {
    const open = startOf(node);
    const close = endOf(node) - 1;
    this.w.token('{', this.at(open));
    const comments = this.source !== undefined && this.w.hasCommentsWithin(open, close);
    if (node.entries.length === 0 && !comments) {
      this.w.token('}', this.at(close));
      return;
    }
    if (isEnum && !comments) {
      for (const member of node.entries) {
        this.w.space();
        this.entry(member, true, false);
      }
      this.w.space();
      this.w.token('}', this.at(close));
      return;
    }
    this.w.indent();
    this.w.openBlock();
    for (const entry of node.entries) {
      this.w.breakLine();
      this.entry(entry, isEnum, this.blankBefore(startOf(entry)));
    }
    this.w.breakLine();
    if (this.source) this.w.flush(close);
    this.w.dedent();
    this.w.breakLine();
    this.w.token('}', this.at(close));
  }

  private value(node: ValueNode): void {
    switch (node.kind) {
      case 'LiteralValue':
        this.w.token(node.raw, this.at(startOf(node)));
        return;
      case 'ArrayValue':
        this.w.token('[', this.at(startOf(node)));
        node.items.forEach((item, i) => {
          if (i > 0) {
            this.w.token(',', this.after(endOf(node.items[i - 1]!)));
            this.w.space();
          }
          this.value(item);
        });
        this.w.token(']', this.at(endOf(node) - 1));
        return;
      case 'ObjectValue':
        this.w.token('{', this.at(startOf(node)));
        this.members(node.members);
        this.w.token('}', this.at(endOf(node) - 1));
        return;
    }
  }
}

/** 把 AST 排版为源码; 传入 source 时保留其中的注释与空行. */
export function renderFile(ast: JotlFile, source?: WriterSource): string {
  return new Renderer(new Writer(source), source).file(ast);
}
