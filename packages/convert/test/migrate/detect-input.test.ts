// 迁移输入类型判定: 凤蝶源码, umo JSON 与常规 JSON Schema.
import { describe, expect, it } from 'vitest';
import { detectMigrateInput } from '../../src/migrate/index.js';

describe('detectMigrateInput', () => {
  it.each([
    ['凤蝶源码', 'Object(首页) { a(A) }', 'fengdie'],
    ['注释开头的凤蝶源码', '/* 首页 */\nexport A Object(甲) { a(A) }', 'fengdie'],
    [
      '字段带 key',
      JSON.stringify({
        type: 'object',
        description: '',
        properties: { a: { key: 'a', type: 'string', description: 'A' } },
      }),
      'fengdie-json',
    ],
    ['凤蝶类型', JSON.stringify({ type: 'object', properties: { a: { type: 'image' } } }), 'fengdie-json'],
    [
      '枚举成员为 label / value',
      JSON.stringify({ type: 'object', properties: { a: { type: 'enum', items: [{ label: '甲', value: 'a' }] } } }),
      'fengdie-json',
    ],
    [
      'export 多文档',
      JSON.stringify({
        a: { type: 'object', description: '', properties: { x: { key: 'x', type: 'string', description: '' } } },
      }),
      'fengdie-json',
    ],
    [
      '常规 JSON Schema',
      JSON.stringify({
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'object',
        properties: { a: { type: 'string' } },
      }),
      'json-schema',
    ],
    ['以 { 开头但语法错误', '{ bad', 'json-schema'],
  ])('%s', (_name, text, kind) => {
    const detection = detectMigrateInput(text);
    expect(detection.kind).toBe(kind);
    expect(detection.reason).not.toBe('');
  });

  it('JSON 语法错误时不带 json', () => {
    expect(detectMigrateInput('{ bad').json).toBeUndefined();
  });
});
