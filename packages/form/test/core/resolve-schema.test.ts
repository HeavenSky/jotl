// 公开的有效 schema 解析: resolveSchema resolveSchemaAt 与渲染计划节点的 resolvePlanNode.
import { describe, expect, it } from 'vitest';
import type { JsonSchema } from '@jotl/core';
import { resolvePlanNode, resolveSchema, resolveSchemaAt } from '../../src/core/index.js';
import { findNode, planOk } from './helpers.js';

const schema: JsonSchema = {
  $defs: {
    Base: { type: 'object', title: '基础', properties: { id: { type: 'string' } } },
    Tagged: { allOf: [{ $ref: '#/$defs/Base' }], properties: { kind: { const: 't' } }, required: ['kind'] },
    Point: { type: ['object', 'null'], properties: { x: { type: 'number' } } },
  },
  type: 'object',
  properties: {
    base: { $ref: '#/$defs/Base', title: '覆盖' },
    tagged: { $ref: '#/$defs/Tagged' },
    point: { $ref: '#/$defs/Point' },
    either: { type: ['string', 'number'], minimum: 1 },
    loose: { type: 'array' },
  },
};

describe('resolveSchemaAt / resolveSchema', () => {
  it('引用目标与引用处浅合并, 记录每个关键字的来源; 按文档与指针缓存', () => {
    const base = resolveSchemaAt(schema, '/properties/base');
    expect(base.effective).toEqual({ type: 'object', title: '覆盖', properties: { id: { type: 'string' } } });
    expect(base.origin.get('properties')).toBe('/$defs/Base');
    expect(base.origin.get('title')).toBe('/properties/base');
    expect(resolveSchemaAt(schema, '/properties/base')).toBe(base);
  });

  it('合并 allOf 成员, properties 按键合并, required 取并集', () => {
    const { effective } = resolveSchemaAt(schema, '/properties/tagged');
    expect(effective.properties).toEqual({ id: { type: 'string' }, kind: { const: 't' } });
    expect(effective.required).toEqual(['kind']);
  });

  it('指针不存在时为空 schema; 无法解析的引用只保留引用处自身', () => {
    expect(resolveSchemaAt(schema, '/properties/missing').effective).toEqual({});
    const node = resolveSchema(schema, { $ref: '#/$defs/Nope', title: 't' });
    expect(node.effective).toEqual({ title: 't' });
    expect(node.unresolvedRef).toBe('#/$defs/Nope');
  });
});

describe('resolvePlanNode', () => {
  const root = planOk(schema);

  it('普通节点与按指针解析的结果相同', () => {
    expect(resolvePlanNode(root.children[0]!, schema)).toBe(resolveSchemaAt(schema, ''));
    expect(resolvePlanNode(findNode(root, '/base'), schema)).toBe(resolveSchemaAt(schema, '/properties/base'));
  });

  it('按 type 数组拆出的分支是该类型的虚拟节点', () => {
    const either = findNode(root, '/either');
    expect(either.children.map(c => resolvePlanNode(c, schema).effective)).toEqual([
      { type: 'string', minimum: 1 },
      { type: 'number', minimum: 1 },
    ]);
  });

  it('可空拆分的对象分支沿用引用目标的关键字来源, 子节点位置落在引用目标上', () => {
    const content = findNode(root, '/point').children[0]!;
    const info = resolvePlanNode(content, schema);
    expect(info.effective.type).toBe('object');
    expect(info.origin.get('properties')).toBe('/$defs/Point');
    expect(findNode(content, '/point/x').schemaPointer).toBe('/$defs/Point/properties/x');
  });

  it('数组无 items 时元素模板为空 schema; 复制后的节点按 schemaPointer 解析', () => {
    const loose = findNode(root, '/loose');
    expect(resolvePlanNode(loose.children[0]!, schema).effective).toEqual({});
    const copy = { ...findNode(root, '/base') };
    expect(resolvePlanNode(copy, schema).effective.title).toBe('覆盖');
  });
});
