// JSON Schema → TS + JSDoc: fixtures 逐字比对, TSDoc 零告警, 产物可编译, 以及各类边界写法.
import { describe, expect, it } from 'vitest';
import type { JsonSchema } from '@jotl/core';
import { isSkipped, listFixtures, readFixture } from '../../../../test-utils/fixtures.js';
import { GENERATED_HEADER, schemaToTs, tsToSchema } from '../../src/ts/index.js';
import { PRESET_PATH, fixtureTsOptions, loadTsdocParser, tsdocMessages, typecheck } from './support.js';

const fixtures = listFixtures()
  .map(readFixture)
  .filter(f => f.hasSchema);
const withTypes = fixtures.filter(f => f.types !== undefined && !isSkipped(f, 'types.d.ts'));
const { parser } = loadTsdocParser(PRESET_PATH);

function generate(schema: unknown, typiaTags = false, defaultExport?: string): string {
  const result = schemaToTs(
    schema as JsonSchema,
    defaultExport === undefined ? { typiaTags } : { typiaTags, defaultExport }
  );
  expect(result.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  expect(result.value).toBeDefined();
  return result.value as string;
}

function wrap(defs: Record<string, unknown>): JsonSchema {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $ref: '#/$defs/T',
    'x-ui': { version: 1 },
    $defs: defs,
  } as JsonSchema;
}

describe('fixtures', () => {
  it('至少有一个参与比对的样例', () => {
    expect(withTypes.length).toBeGreaterThan(10);
  });

  for (const fixture of withTypes) {
    describe(fixture.name, () => {
      it('与 types.d.ts 逐字相等且无告警', () => {
        const result = schemaToTs(fixture.schema as JsonSchema, fixtureTsOptions(fixture));
        expect(result.diagnostics).toEqual([]);
        expect(result.value).toBe(fixture.types);
      });

      it('注释经 TSDoc 解析零告警', () => {
        expect(tsdocMessages(parser, generate(fixture.schema, false, fixtureTsOptions(fixture).defaultExport))).toEqual(
          []
        );
      });
    });
  }

  it('meta.skip 跳过的样例给出丢弃关键字的告警', () => {
    for (const fixture of fixtures.filter(f => isSkipped(f, 'types.d.ts'))) {
      const result = schemaToTs(fixture.schema as JsonSchema);
      expect(result.value).toBeDefined();
      expect(result.diagnostics.map(d => d.code)).toContain('JOTL2002');
    }
  });

  it('全部样例产物零类型错误', () => {
    const files = Object.fromEntries(
      fixtures.map(f => [`${f.name}.d.ts`, generate(f.schema, false, fixtureTsOptions(f).defaultExport)])
    );
    expect(typecheck(files)).toEqual([]);
  });
});

describe('取值编码', () => {
  it('文本中的 TSDoc 语法字符被转义, 并能读回', () => {
    const description = '邮箱 a@b.com, {x} <y> `z` */ 反斜杠 \\ 结束';
    const schema = wrap({ T: { type: 'object', description, title: '标题 @ {}', properties: {} } });
    const text = generate(schema);
    expect(text).not.toContain('*/ 反斜杠');
    expect(tsdocMessages(parser, text)).toEqual([]);
    const back = tsToSchema(text);
    expect(back.value?.$defs?.T).toEqual({ type: 'object', description, title: '标题 @ {}' });
  });

  it('JSON 取值: 对象与含特殊字符的值用反引号包裹', () => {
    const schema = wrap({
      T: {
        type: 'object',
        properties: {
          a: { type: 'string', default: 'line\nbreak' },
          b: { type: 'object', default: { k: 'v' } },
          c: { type: 'array', items: { type: 'string' }, default: ['`tick` */'] },
          d: { type: 'string', errorMessage: '必须是邮箱' },
          e: { type: 'string', errorMessage: { maxLength: '最多 20 字' } },
        },
      },
    });
    const text = generate(schema);
    expect(text).toContain('@defaultValue `"line\\nbreak"`');
    expect(text).toContain('@defaultValue `{"k":"v"}`');
    expect(text).toContain('@errorMessage "必须是邮箱"');
    expect(text).toContain('@errorMessage `{"maxLength":"最多 20 字"}`');
    expect(tsdocMessages(parser, text)).toEqual([]);
    expect(tsToSchema(text).value).toEqual(schema);
  });

  it('正则: 一般写在反引号中, 含反引号或 */ 时改写为 JSON 字符串', () => {
    const patterns = ['^[a-z]+$', 'a`b', 'x*/y', '"quoted"', 'a\\.b*\\/c'];
    const schema = wrap({
      T: {
        type: 'object',
        properties: Object.fromEntries(patterns.map((p, i) => [`p${i}`, { type: 'string', pattern: p }])),
      },
    });
    const text = generate(schema);
    expect(text).toContain('@pattern `^[a-z]+$`');
    expect(tsdocMessages(parser, text)).toEqual([]);
    expect(tsToSchema(text).value).toEqual(schema);
  });

  it('示例: 对象写成 json 代码块', () => {
    const schema = wrap({
      T: { type: 'object', examples: [{ a: 1 }, [{ b: '*/' }], 's', 1, null] },
    });
    const text = generate(schema);
    expect(text).toContain(' * @example\n * ```json\n * {\n *   "a": 1\n * }\n * ```');
    expect(tsdocMessages(parser, text)).toEqual([]);
    expect(tsToSchema(text).value).toEqual(schema);
  });
});

describe('结构', () => {
  it('元组, 内联联合数组, 非法类型名与非标识符属性名', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $defs: {
        'my-type': {
          type: 'object',
          properties: {
            'x-y': { type: 'string' },
            pair: { type: 'array', prefixItems: [{ type: 'string' }, { type: 'number' }], items: false },
            list: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }] } },
            any: {},
          },
          required: ['x-y'],
        },
      },
    };
    const result = schemaToTs(schema as JsonSchema);
    expect(result.diagnostics.map(d => d.code)).toEqual(['JOTL2004']);
    expect(result.value).toBe(`${GENERATED_HEADER}

export interface my_type {
  "x-y": string;
  pair?: [string, number];
  list?: (string | number)[];
  any?: unknown;
}
`);
  });

  it('无法表达的关键字给出 JOTL2002 并指向节点', () => {
    const schema = wrap({
      T: {
        type: 'object',
        properties: { a: { type: 'string', not: { const: 'x' } } },
        propertyNames: { pattern: '^a' },
      },
    });
    const result = schemaToTs(schema);
    expect(result.diagnostics.map(d => [d.code, d.location])).toEqual([
      ['JOTL2002', { kind: 'pointer', pointer: '/$defs/T/properties/a' }],
      ['JOTL2002', { kind: 'pointer', pointer: '/$defs/T' }],
    ]);
  });

  it('引用不存在的定义时告警并输出 unknown', () => {
    const result = schemaToTs(wrap({ T: { type: 'object', properties: { a: { $ref: '#/$defs/Missing' } } } }));
    expect(result.diagnostics.map(d => d.code)).toEqual(['JOTL2003']);
    expect(result.value).toContain('a?: unknown;');
  });

  it('非对象输入返回 JOTL2001, 不抛异常', () => {
    expect(schemaToTs(true).diagnostics.map(d => d.code)).toEqual(['JOTL2001']);
    expect(schemaToTs(true).value).toBeUndefined();
  });

  it('根不是 $ref 时输出为 Root 并默认导出', () => {
    const result = schemaToTs({ type: 'string' });
    expect(result.diagnostics.map(d => d.code)).toEqual(['JOTL2006']);
    expect(result.value).toBe(`${GENERATED_HEADER}\n\nexport type Root = string;\n\nexport default Root;\n`);
  });

  it('空文档输出 export {}', () => {
    expect(schemaToTs({ $schema: 'https://json-schema.org/draft/2020-12/schema' }).value).toBe(
      `${GENERATED_HEADER}\n\nexport {};\n`
    );
  });
});

describe('根 $id 与 x-ui.rules', () => {
  const rules = [{ match: { type: 'boolean' }, ui: { widget: 'checkbox' } }];

  it('写成根类型上的 @id @rules 并往返还原', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://example.com/a',
      $ref: '#/$defs/A',
      'x-ui': { version: 1, rules },
      $defs: { A: { type: 'string' }, B: { type: 'string' } },
    } as JsonSchema;
    const result = schemaToTs(schema);
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toContain(
      '/**\n * @id https://example.com/a\n * @rules `[{"match":{"type":"boolean"},"ui":{"widget":"checkbox"}}]`\n */\nexport type A = string;'
    );
    expect(result.value).toContain('\nexport type B = string;');
    expect(tsToSchema(result.value as string).value).toEqual(schema);
  });

  it('没有默认导出时丢弃并给出 JOTL2002 警告', () => {
    const result = schemaToTs({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://example.com/a',
      'x-ui': { version: 1, rules },
      $defs: { A: { type: 'string' } },
    });
    expect(result.value).not.toContain('@id');
    expect(result.diagnostics.map(d => [d.code, d.message])).toEqual([
      ['JOTL2002', '关键字 $id 无法用 TS 表达, 转换时丢弃'],
      ['JOTL2002', '关键字 x-ui.rules 无法用 TS 表达, 转换时丢弃'],
    ]);
  });

  it('读取时 @id @rules 只认根类型(无 @root 时为默认导出)', () => {
    const result = tsToSchema(
      '/** @id https://example.com/a\n * @rules `[]` */\nexport type A = string;\nexport type B = string;\nexport default B;\n'
    );
    expect(result.value).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $ref: '#/$defs/B',
      'x-ui': { version: 1 },
      $defs: { A: { type: 'string' }, B: { type: 'string' } },
    });
    expect(result.diagnostics.map(d => d.code)).toEqual(['JOTL2115', 'JOTL2115']);
  });

  it('defaultExport 与根不同时默认导出它, 根类型写 @root, 往返还原根', () => {
    const schema = {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://example.com/a',
      $ref: '#/$defs/A',
      'x-ui': { version: 1, rules },
      $defs: { A: { type: 'string' }, B: { type: 'string' } },
    } as JsonSchema;
    const result = schemaToTs(schema, { defaultExport: 'B' });
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toContain(
      '/**\n * @root\n * @id https://example.com/a\n * @rules `[{"match":{"type":"boolean"},"ui":{"widget":"checkbox"}}]`\n */\nexport type A = string;'
    );
    expect(result.value).toMatch(/\nexport default B;\n$/);
    expect(tsToSchema(result.value as string).value).toEqual(schema);
  });

  it('defaultExport 等于根或不在 $defs 中时按根导出, 不写 @root', () => {
    const schema = { $ref: '#/$defs/A', $defs: { A: { type: 'string' } } } as JsonSchema;
    for (const defaultExport of ['A', 'Missing']) {
      const text = schemaToTs(schema, { defaultExport }).value as string;
      expect(text).not.toContain('@root');
      expect(text).toMatch(/\nexport default A;\n$/);
    }
  });

  it('@rules 不是 JSON 数组时报 JOTL2116', () => {
    const result = tsToSchema('/** @rules `{}` */\nexport type A = string;\nexport default A;\n');
    expect(result.diagnostics.map(d => d.code)).toEqual(['JOTL2116']);
  });
});

describe('编译器固定形态与往返', () => {
  function roundTrip(schema: JsonSchema): string {
    const text = generate(schema);
    expect(tsdocMessages(parser, text)).toEqual([]);
    const back = tsToSchema(text);
    expect(back.diagnostics).toEqual([]);
    expect(back.value).toEqual(schema);
    return text;
  }

  it('枚举成员的 description 写成 @enumDescriptions 并往返还原', () => {
    const schema = wrap({
      T: {
        type: 'object',
        properties: {
          level: {
            type: 'string',
            oneOf: [
              { const: 'low', title: '低', description: '低档位' },
              { const: 'high', title: '高' },
            ],
          },
          eol: {
            type: 'array',
            items: { type: 'string', oneOf: [{ const: 'lf', description: 'Unix' }, { const: 'crlf' }] },
          },
        },
      },
    });
    const result = schemaToTs(schema);
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toContain('@enumDescriptions `{"low":"低档位"}`');
    roundTrip(schema);
  });

  it('不能写注释的位置上, 整个枚举的成员说明只报一条', () => {
    const branch = {
      type: 'string',
      oneOf: [
        { const: 'a', description: '甲' },
        { const: 'b', description: '乙' },
      ],
    };
    const result = schemaToTs(wrap({ T: { anyOf: [branch, { type: 'number' }] } }));
    expect(result.diagnostics.map(d => [d.code, d.location])).toEqual([
      ['JOTL2002', { kind: 'pointer', pointer: '/$defs/T/anyOf/0' }],
    ]);
  });

  it('money bigint 的封闭值对象与可区分联合分支的 title 不告警', () => {
    const money = {
      type: 'object',
      properties: { type: { type: 'string', const: 'money' }, value: { type: 'string' }, currency: { type: 'string' } },
      required: ['type', 'value', 'currency'],
      additionalProperties: false,
      'x-decimalRange': { minimum: '0' },
    };
    const branch = (kind: string, title: string) => ({
      title,
      type: 'object',
      properties: { kind: { type: 'string', const: kind } },
      required: ['kind'],
    });
    const result = schemaToTs(
      wrap({
        T: { type: 'object', properties: { price: money, block: { oneOf: [branch('a', '甲'), branch('b', '乙')] } } },
      })
    );
    expect(result.diagnostics).toEqual([]);
    const plain = schemaToTs(wrap({ T: { oneOf: [{ ...branch('a', '甲'), required: [] }, branch('b', '乙')] } }));
    expect(plain.diagnostics.map(d => d.code)).toEqual(['JOTL2002', 'JOTL2002']);
  });

  it('无原因的 deprecated 写默认说明, 读回不产生 x-deprecatedReason', () => {
    const schema = wrap({
      T: {
        type: 'object',
        properties: {
          a: { type: 'string', deprecated: true },
          b: { type: 'string', deprecated: true, 'x-deprecatedReason': '改用 c' },
        },
      },
    });
    const text = roundTrip(schema);
    expect(text).toContain(' * @deprecated 已弃用.\n');
    expect(text).toContain(' * @deprecated 改用 c\n');
  });

  it('同时有属性与额外属性时, 索引签名并入属性类型, 可编译且往返还原', () => {
    const schema = wrap({
      T: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'integer' },
          tags: { type: 'array', items: { type: 'string' } },
          extra: { type: 'number' },
        },
        required: ['name'],
        additionalProperties: { type: 'number' },
      },
      U: { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: { type: ['string', 'null'] } },
    });
    const text = roundTrip(schema);
    expect(text).toContain('[key: string]: (number) | string | string[] | undefined;');
    expect(text).toContain('[key: string]: (string | null) | undefined;');
    expect(typecheck({ 't.d.ts': text })).toEqual([]);
  });

  it('数组元素的 x-ui 写成数组属性上的 @itemWidget @itemUi, 跳过的层级用空对象占位', () => {
    const schema = wrap({
      T: {
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string', 'x-ui': { widget: 'tag' } }, 'x-ui': { widget: 'tag-list' } },
          grid: {
            type: 'array',
            items: { type: 'array', items: { type: 'number', 'x-ui': { widget: 'slider', props: { step: 1 } } } },
          },
        },
      },
    });
    const text = roundTrip(schema);
    expect(text).toContain('   * @widget tag-list\n   * @itemWidget tag\n   */\n  tags?: string[];');
    expect(text).toContain(
      '   * @itemUi `{}`\n   * @itemUi `{"widget":"slider","props":{"step":1}}`\n   */\n  grid?: number[][];'
    );
    const nested = schemaToTs(
      wrap({
        T: { anyOf: [{ type: 'array', items: { type: 'string', 'x-ui': { widget: 'tag' } } }, { type: 'null' }] },
      })
    );
    expect(nested.diagnostics.map(d => d.code)).toEqual(['JOTL2002']);
  });

  it('只含 $ref 的 allOf 写成交叉类型, 可区分联合分支的 title 写成 @branchTitles', () => {
    const branch = (kind: string, ref: string, title?: string) => ({
      ...(title === undefined ? {} : { title }),
      type: 'object',
      properties: { kind: { type: 'string', const: kind } },
      required: ['kind'],
      allOf: [{ $ref: `#/$defs/${ref}` }],
    });
    const schema = wrap({
      T: {
        type: 'object',
        properties: { shape: { title: '形状', oneOf: [branch('a', 'A', '甲'), branch('b', 'B')] } },
      },
      A: { type: 'object', properties: { x: { type: 'number' } } },
      B: { allOf: [{ $ref: '#/$defs/A' }, { $ref: '#/$defs/D' }] },
      C: { allOf: [{ $ref: '#/$defs/A' }], title: '只有注解' },
      D: { type: 'object', properties: { y: { type: 'number' } } },
    });
    const text = roundTrip(schema);
    expect(text).toContain('   * @branchTitles ["甲",null]\n   */\n  shape?: (A & {\n    kind: "a";\n  }) | (B & {');
    expect(text).toContain('export type B = A & D;');
    expect(text).toContain('export type C = A & unknown;');
    expect(typecheck({ 't.d.ts': text })).toEqual([]);
  });

  it('可空的联合写成 (A | B) | null, 往返还原外层 anyOf 与内层 oneOf/anyOf 及分支 title', () => {
    const branch = (kind: string, title?: string) => ({
      ...(title === undefined ? {} : { title }),
      type: 'object',
      properties: { kind: { type: 'string', const: kind }, [kind]: { type: 'number' } },
      required: ['kind'],
    });
    const nullable = (inner: unknown) => ({ anyOf: [inner, { type: 'null' }] });
    const shape = { oneOf: [branch('a', '甲'), branch('b', '乙')] };
    const schema = wrap({
      T: {
        type: 'object',
        properties: {
          shape: { title: '形状', ...nullable(shape) },
          size: nullable({ anyOf: [{ type: 'number' }, { $ref: '#/$defs/R' }] }),
          list: { type: 'array', items: nullable({ oneOf: [branch('a'), branch('b')] }) },
        },
      },
      R: { type: 'object', properties: { from: { type: 'number' } } },
      U: { type: 'object', properties: { s: nullable(shape) }, additionalProperties: { type: 'number' } },
      V: {
        type: 'object',
        properties: { n: { type: 'null' } },
        additionalProperties: nullable({ anyOf: [{ type: 'string' }, { $ref: '#/$defs/R' }] }),
      },
    });
    const result = schemaToTs(schema);
    expect(result.diagnostics).toEqual([]);
    const text = roundTrip(schema);
    expect(text).toContain('   * @branchTitles ["甲","乙"]\n   */\n  shape?: ({\n');
    expect(text).toContain('  size?: (number | R) | null;');
    expect(text).toContain('  [key: string]: ((string | R) | null) | undefined;');
    expect(typecheck({ 't.d.ts': text })).toEqual([]);
  });

  it('money bigint 值对象的 x-decimalRange 与 additionalProperties: false 写成 @decimalRange @closed 并往返还原', () => {
    const money = {
      title: '价格',
      type: 'object',
      properties: {
        type: { type: 'string', const: 'money' },
        value: { type: 'string' },
        currency: { type: 'string', const: 'CNY' },
      },
      required: ['type', 'value', 'currency'],
      additionalProperties: false,
      'x-decimalRange': { minimum: '0', exclusiveMaximum: '100' },
    };
    const bigint = {
      type: 'object',
      properties: { type: { type: 'string', const: 'bigint' }, value: { type: 'string', pattern: '^-?\\d+$' } },
      required: ['type', 'value'],
      additionalProperties: false,
    };
    const schema = wrap({ T: { type: 'object', properties: { price: money, total: bigint } }, M: money });
    const text = roundTrip(schema);
    expect(text).toContain(
      '   * @title 价格\n   * @closed\n   * @decimalRange `{"minimum":"0","exclusiveMaximum":"100"}`\n   */\n  price?: {'
    );
    expect(text).toContain('   * @closed\n   */\n  total?: {');
    expect(text).toContain('/**\n * @title 价格\n * @closed\n * @decimalRange');
  });

  it('不能写注释也不能上提的位置上, 值对象的 x-decimalRange 与 additionalProperties: false 告警', () => {
    const money = {
      type: 'object',
      properties: { type: { type: 'string', const: 'money' }, value: { type: 'string' } },
      required: ['type', 'value'],
      additionalProperties: false,
      'x-decimalRange': { minimum: '0' },
    };
    const result = schemaToTs(wrap({ T: { anyOf: [money, { type: 'string' }] } }));
    expect(result.diagnostics.map(d => [d.code, d.location])).toEqual([
      ['JOTL2002', { kind: 'pointer', pointer: '/$defs/T/anyOf/0' }],
      ['JOTL2002', { kind: 'pointer', pointer: '/$defs/T/anyOf/0' }],
    ]);
    expect(result.diagnostics.map(d => d.message).join('\n')).toMatch(/additionalProperties[\s\S]*x-decimalRange/);
    const closed = { type: 'object', properties: { x: { type: 'number' } }, additionalProperties: false };
    const others = schemaToTs(
      wrap({
        T: {
          type: 'object',
          properties: {
            map: { type: 'object', additionalProperties: closed },
            pair: { type: 'array', prefixItems: [closed], items: false },
            wrapped: { anyOf: [{ type: 'array', items: closed }, { type: 'null' }] },
            bare: { properties: { x: { type: 'number' } }, additionalProperties: false },
          },
        },
      })
    );
    expect(others.diagnostics.map(d => [d.code, d.location])).toEqual([
      ['JOTL2002', { kind: 'pointer', pointer: '/$defs/T/properties/map/additionalProperties' }],
      ['JOTL2002', { kind: 'pointer', pointer: '/$defs/T/properties/pair/prefixItems/0' }],
      ['JOTL2002', { kind: 'pointer', pointer: '/$defs/T/properties/wrapped/anyOf/0/items' }],
      ['JOTL2002', { kind: 'pointer', pointer: '/$defs/T/properties/bare' }],
    ]);
  });

  it('普通对象的 additionalProperties: false 写成 @closed 并往返还原', () => {
    const point = {
      type: 'object',
      properties: { x: { type: 'number' } },
      required: ['x'],
      additionalProperties: false,
    };
    const schema = wrap({
      T: {
        type: 'object',
        properties: {
          geo: { title: '坐标', ...point },
          extra: { type: 'object', additionalProperties: { type: 'string' } },
        },
        additionalProperties: false,
      },
      P: point,
      U: { anyOf: [{ type: 'string' }, { $ref: '#/$defs/P' }] },
    });
    const text = roundTrip(schema);
    expect(text).toContain('/**\n * @closed\n */\nexport interface T {');
    expect(text).toContain('   * @title 坐标\n   * @closed\n   */\n  geo?: {');
    expect(text).toContain('/**\n * @closed\n */\nexport interface P {');
    expect(typecheck({ 't.d.ts': text })).toEqual([]);
  });

  it('数组元素与可空包装内层对象的 @closed @decimalRange 上提到属性, 读回时下放并往返还原', () => {
    const money = {
      type: 'object',
      properties: { type: { type: 'string', const: 'money' }, value: { type: 'string' } },
      required: ['type', 'value'],
      additionalProperties: false,
      'x-decimalRange': { minimum: '0' },
    };
    const point = {
      type: 'object',
      properties: { x: { type: 'number' } },
      required: ['x'],
      additionalProperties: false,
    };
    const nullable = (inner: unknown) => ({ anyOf: [inner, { type: 'null' }] });
    const schema = wrap({
      T: {
        type: 'object',
        properties: {
          price: { title: '价格', ...nullable(money) },
          prices: { type: 'array', items: money },
          grid: { type: 'array', items: { type: 'array', items: point } },
          points: { type: 'array', items: nullable(point) },
        },
      },
      L: { type: 'array', items: money },
    });
    const result = schemaToTs(schema);
    expect(result.diagnostics).toEqual([]);
    const text = roundTrip(schema);
    expect(text).toContain('   * @title 价格\n   * @closed\n   * @decimalRange `{"minimum":"0"}`\n   */\n  price?: {');
    expect(text).toContain('   * @closed\n   * @decimalRange `{"minimum":"0"}`\n   */\n  prices?: {');
    expect(text).toContain('   * @closed\n   */\n  grid?: {');
    expect(text).toContain('   * @closed\n   */\n  points?: ({');
    expect(text).toContain('/**\n * @closed\n * @decimalRange `{"minimum":"0"}`\n */\nexport type L = {');
    expect(typecheck({ 't.d.ts': text })).toEqual([]);
  });
  it('元组各位置的 title 都可作成员名时写成具名元组, 剩余元素名为 rest, 可编译且往返还原', () => {
    const schema = wrap({
      T: {
        type: 'object',
        properties: {
          range: {
            title: '区间',
            type: 'array',
            minItems: 2,
            prefixItems: [
              { title: '开始', type: 'string' },
              { title: '结束', type: 'string' },
            ],
            items: false,
          },
          record: {
            type: 'array',
            prefixItems: [
              { title: '名称', type: 'string' },
              { title: '$code_2', type: 'integer', const: 1 },
            ],
            items: { type: 'number' },
          },
          open: { type: 'array', prefixItems: [{ title: 'type', $ref: '#/$defs/U' }], items: {} },
        },
        required: ['range'],
      },
      U: { type: 'string' },
    });
    const result = schemaToTs(schema);
    expect(result.diagnostics).toEqual([]);
    const text = roundTrip(schema);
    expect(text).toContain('  range: [开始: string, 结束: string];');
    expect(text).toContain('  record?: [名称: string, $code_2: 1, ...rest: number[]];');
    expect(text).toContain('  open?: [type: U, ...rest: unknown[]];');
    expect(typecheck({ 't.d.ts': text })).toEqual([]);
  });

  it('只有部分位置有 title, 或有 title 不是合法标识符或是保留字时, 不写成员名, 这些 title 告警丢弃', () => {
    const pair = (a: unknown, b: unknown) => ({ type: 'array', prefixItems: [a, b], items: false });
    const schema = wrap({
      T: {
        type: 'object',
        properties: {
          partial: pair({ title: '开始', type: 'string' }, { type: 'string' }),
          spaced: pair({ title: '开始', type: 'string' }, { title: '结束 时间', type: 'string' }),
          reserved: pair({ title: 'default', type: 'string' }, { title: 'end', type: 'string' }),
          digit: pair({ title: '1st', type: 'string' }, { title: 'end', type: 'string' }),
        },
      },
    });
    const result = schemaToTs(schema);
    const at = (key: string, i: number) => [
      'JOTL2002',
      { kind: 'pointer', pointer: `/$defs/T/properties/${key}/prefixItems/${i}` },
    ];
    expect(result.diagnostics.map(d => [d.code, d.location])).toEqual([
      at('partial', 0),
      at('spaced', 0),
      at('spaced', 1),
      at('reserved', 0),
      at('reserved', 1),
      at('digit', 0),
      at('digit', 1),
    ]);
    expect(result.diagnostics.every(d => d.message.includes('title'))).toBe(true);
    for (const key of ['partial', 'spaced', 'reserved', 'digit'])
      expect(result.value).toContain(`  ${key}?: [string, string];`);
  });
});
