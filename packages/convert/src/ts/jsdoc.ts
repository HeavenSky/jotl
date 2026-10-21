// 把 `/** *\/` 注释原文切分为描述与标签; 代码块内的 `@` 不视为标签.

export interface JsDocTag {
  /** 原文中的标签名, 不含 `@`. */
  name: string;
  /** 标签之后的内容, 多行以 `\n` 连接, 去掉首尾空白. */
  text: string;
  /** `@` 在源码中的偏移. */
  pos: number;
  /** 标签内容最后一行行尾在源码中的偏移. */
  end: number;
}

export interface JsDocComment {
  description: string | undefined;
  tags: JsDocTag[];
}

interface Line {
  text: string;
  offset: number;
}

const TAG_START = /^@([A-Za-z][A-Za-z0-9]*)(?=\s|$)/;

/** `comment` 为含 `/**` 与 `*\/` 的注释原文, `offset` 为它在源码中的起点. */
export function parseJsDoc(comment: string, offset: number): JsDocComment {
  const bodyStart = comment.startsWith('/**') ? 3 : 0;
  const bodyEnd = comment.endsWith('*/') ? comment.length - 2 : comment.length;
  const lines: Line[] = [];
  let start = bodyStart;
  while (start <= bodyEnd) {
    const newline = comment.indexOf('\n', start);
    const end = newline === -1 || newline > bodyEnd ? bodyEnd : newline;
    lines.push(stripLinePrefix(comment.slice(start, end).replace(/\r$/, ''), offset + start, lines.length === 0));
    start = end + 1;
  }

  const description: string[] = [];
  const tags: { name: string; lines: string[]; pos: number; end: number }[] = [];
  let inFence = false;
  for (const line of lines) {
    const match = inFence ? null : TAG_START.exec(line.text);
    if (match) {
      const name = match[1] as string;
      tags.push({
        name,
        lines: [line.text.slice(match[0].length).trimStart()],
        pos: line.offset,
        end: line.offset + line.text.length,
      });
    } else {
      const current = tags.at(-1);
      if (current) {
        current.lines.push(line.text);
        if (line.text.trim() !== '') current.end = line.offset + line.text.length;
      } else {
        description.push(line.text);
      }
    }
    if (/^\s*```/.test(line.text)) inFence = !inFence;
  }
  const descriptionText = joinLines(description);
  return {
    description: descriptionText === '' ? undefined : descriptionText,
    tags: tags.map(t => ({ name: t.name, text: joinLines(t.lines), pos: t.pos, end: t.end })),
  };
}

/** 去掉行首空白与 `*` 及其后的一个空格; 首行紧跟 `/**`, 没有 `*` 前缀. */
function stripLinePrefix(raw: string, offset: number, first: boolean): Line {
  const match = first ? /^\s*/.exec(raw) : /^\s*(?:\* ?)?/.exec(raw);
  const prefix = match?.[0].length ?? 0;
  return { text: raw.slice(prefix).trimEnd(), offset: offset + prefix };
}

function joinLines(lines: string[]): string {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start]?.trim() === '') start++;
  while (end > start && lines[end - 1]?.trim() === '') end--;
  return lines.slice(start, end).join('\n').trim();
}
