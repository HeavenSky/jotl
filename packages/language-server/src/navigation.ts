// 跳转定义, 查找引用与大纲(E5): 顶层类型名与其引用(组件位置与类型串)互跳, 文档符号按类型 → 字段与枚举成员逐层嵌套.
import { type Entry, parse } from '@jotl/core';
import { type DocumentSymbol, type Location, type Position, type Range, SymbolKind } from 'vscode-languageserver';
import { collectOccurrences, findDeclaration, type Occurrence, occurrenceAt } from './symbol-index.js';
import { offsetAt, positionAt, toLspRange } from './text-position.js';

function occurrencesAt(
  text: string,
  uri: string,
  position: Position
): { all: Occurrence[]; target: Occurrence | undefined } {
  const file = parse(text, uri).value;
  const all = file === undefined ? [] : collectOccurrences(file);
  return { all, target: occurrenceAt(all, offsetAt(text, position)) };
}

function location(text: string, uri: string, occurrence: Occurrence): Location {
  return { uri, range: { start: positionAt(text, occurrence.start), end: positionAt(text, occurrence.end) } };
}

/** 光标在类型引用上时返回其声明; 在声明名上时返回声明自身, 编辑器据此改为列出引用. */
export function getDefinition(text: string, uri: string, position: Position): Location[] {
  const { all, target } = occurrencesAt(text, uri, position);
  if (target?.kind !== 'typeReference' && target?.kind !== 'declaration') return [];
  const declaration = findDeclaration(all, target.name);
  return declaration === undefined ? [] : [location(text, uri, declaration)];
}

/** 光标在顶层类型的声明或引用上时, 返回同名的全部引用; includeDeclaration 为 true 时连同声明. */
export function getReferences(text: string, uri: string, position: Position, includeDeclaration: boolean): Location[] {
  const { all, target } = occurrencesAt(text, uri, position);
  if (target?.kind !== 'typeReference' && target?.kind !== 'declaration') return [];
  return all
    .filter(
      o => o.name === target.name && (o.kind === 'typeReference' || (includeDeclaration && o.kind === 'declaration'))
    )
    .map(o => location(text, uri, o));
}

function detail(label: string | undefined): { detail?: string } {
  return label === undefined || label === '' ? {} : { detail: label };
}

function entryKind(entry: Entry, top: boolean, enumBody: boolean): SymbolKind {
  if (enumBody) return SymbolKind.EnumMember;
  if (!top) return SymbolKind.Field;
  const component = entry.component?.name;
  if (component === 'enum') return SymbolKind.Enum;
  if (component === 'object' || (component === undefined && entry.body !== undefined)) return SymbolKind.Struct;
  return SymbolKind.TypeParameter;
}

function contains(outer: Range, inner: Range): boolean {
  const before = (a: Position, b: Position) => a.line < b.line || (a.line === b.line && a.character <= b.character);
  return before(outer.start, inner.start) && before(inner.end, outer.end);
}

function entrySymbol(entry: Entry, top: boolean, enumBody: boolean): DocumentSymbol {
  const childEnum = entry.component?.name === 'enum';
  const children = (entry.body?.entries ?? []).map(child => entrySymbol(child, false, childEnum));
  const selectionRange = toLspRange(entry.key.span.range);
  const range = toLspRange(entry.span.range);
  return {
    name: entry.key.name === '' ? '""' : entry.key.name,
    ...detail(entry.label?.text),
    kind: entryKind(entry, top, enumBody),
    // LSP 要求 selectionRange 落在 range 内; 恢复出的残缺条目不保证这一点.
    range: contains(range, selectionRange) ? range : selectionRange,
    selectionRange,
    ...(children.length > 0 ? { children } : {}),
  };
}

/** 大纲: 每个顶层类型一项, 其下为体内的字段, 分支, 元组位置与枚举成员(逐层嵌套). */
export function getDocumentSymbols(text: string, uri: string): DocumentSymbol[] {
  return (parse(text, uri).value?.entries ?? []).map(entry => entrySymbol(entry, true, false));
}
