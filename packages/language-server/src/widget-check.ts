// "widget 未注册" 检查(K3): 元数据 `widget` `decorator` 引用的 widget 名不在内置 widget 与已登记名中时报警告.
import type { Diagnostic } from '@jotl/core';
import type { Entry, JotlFile, ObjectValueMember } from '@jotl/core';
import { isBuiltinWidget } from '@jotl/form/core';
import { lspDiagnostic } from './diagnostics.js';

const WIDGET_META_KEYS: ReadonlySet<string> = new Set(['widget', 'decorator']);

function* entries(list: readonly Entry[]): Generator<Entry> {
  for (const entry of list) {
    yield entry;
    yield* entries(entry.body?.entries ?? []);
  }
}

const ITEM_TYPE_KEYS = ['array_item', 'map_item', 'union_item', 'json_item'];

function itemTypeNames(members: readonly ObjectValueMember[]): string[] {
  const item = members.find(m => ITEM_TYPE_KEYS.includes(m.key.value));
  if (item?.value.kind !== 'LiteralValue' || typeof item.value.value !== 'string') return [];
  return item.value.value.split('|').map(name => name.trim());
}

/** `item_meta` 在类型串含多个名字时按名字分键, 否则直接是内部类型的元数据; 两种都递归检查. */
function* widgetMembers(members: readonly ObjectValueMember[]): Generator<ObjectValueMember> {
  for (const member of members) {
    if (WIDGET_META_KEYS.has(member.key.value)) yield member;
    else if (member.value.kind !== 'ObjectValue') continue;
    else if (member.key.value === 'variants') {
      for (const scene of member.value.members) {
        if (scene.value.kind === 'ObjectValue')
          yield* scene.value.members.filter(m => WIDGET_META_KEYS.has(m.key.value));
      }
    } else if (member.key.value === 'item_meta') {
      const names = itemTypeNames(members);
      if (names.length < 2) yield* widgetMembers(member.value.members);
      else {
        for (const branch of member.value.members) {
          if (names.includes(branch.key.value) && branch.value.kind === 'ObjectValue')
            yield* widgetMembers(branch.value.members);
        }
      }
    }
  }
}

/** 取值写错(非字符串, 空串)由编译器报错, 这里只看非空字符串; 也检查 `variants` 各场景覆盖与 `item_meta` 中的组件名. */
export function checkWidgets(file: JotlFile, registeredWidgets: ReadonlySet<string>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const entry of entries(file.entries)) {
    for (const member of widgetMembers(entry.meta?.members ?? [])) {
      if (member.value.kind !== 'LiteralValue') continue;
      const widget = member.value.value;
      if (typeof widget !== 'string' || widget === '') continue;
      if (isBuiltinWidget(widget) || registeredWidgets.has(widget)) continue;
      diagnostics.push(
        lspDiagnostic('JOTL7001', { widget }, { location: { kind: 'source', range: member.value.span.range } })
      );
    }
  }
  return diagnostics;
}
