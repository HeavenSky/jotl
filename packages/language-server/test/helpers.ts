// 测试辅助: 用光标标记写源码, 换算出去掉标记的文本与 LSP 位置.
import type { Position } from 'vscode-languageserver';

export const URI = 'file:///workspace/sample.jotl';

const CURSOR = '‸';

export function withCursor(source: string): { text: string; position: Position } {
  const index = source.indexOf(CURSOR);
  if (index < 0 || source.indexOf(CURSOR, index + 1) >= 0) throw new Error('源码中必须恰好有一个光标标记');
  const text = source.slice(0, index) + source.slice(index + CURSOR.length);
  const before = text.slice(0, index).split(/\r\n|\r|\n/);
  return { text, position: { line: before.length - 1, character: before[before.length - 1]!.length } };
}
