// TS + JSDoc → JSON Schema: fixtures 反向转换, 往返稳定, 别名兼容与不支持特性的诊断.
import { describe, expect, it } from 'vitest';
import type { Diagnostic, JsonSchema } from '@jotl/core';
import { isSkipped, listFixtures, readFixture } from '../../../../test-utils/fixtures.js';
import { compile, print } from '@jotl/core';
import { schemaToTs, tsToSchema } from '../../src/ts/index.js';
import { fixtureTsOptions } from './support.js';

const fixtures = listFixtures()
  .map(readFixture)
  .filter(f => f.hasSchema);
const withTypes = fixtures.filter(f => f.types !== undefined && !isSkipped(f, 'types.d.ts'));
const DIALECT = 'https://json-schema.org/draft/2020-12/schema';

function codes(diagnostics: Diagnostic[]): string[] {
  return diagnostics.map(d => d.code);
}

function at(diagnostic: Diagnostic | undefined): [number, number] | undefined {
  return diagnostic?.location?.kind === 'source'
    ? [diagnostic.location.range.start.line, diagnostic.location.range.start.column]
    : undefined;
}

/** 转换只含一个 `T` 定义的源码, 返回 `$defs.T`. */
function defOf(source: string): unknown {
  const result = tsToSchema(source);
  expect(result.diagnostics).toEqual([]);
  return result.value?.$defs?.T;
}

describe('fixtures', () => {
  for (const fixture of withTypes) {
    it(`${fixture.name}: types.d.ts 反向转换与 schema.json 深度相等`, () => {
      const result = tsToSchema(fixture.types as string);
      expect(result.diagnostics).toEqual([]);
      expect(result.value).toEqual(fixture.schema);
    });
  }

  it('全部样例的 TS 产物往返后文本不变', () => {
    for (const fixture of fixtures) {
      const options = fixtureTsOptions(fixture);
      const first = schemaToTs(fixture.schema as JsonSchema, options).value as string;
      const back = tsToSchema(first);
      expect(back.diagnostics).toEqual([]);
      expect(schemaToTs(back.value as JsonSchema, options).value).toBe(first);
    }
  });
});

describe('读取兼容', () => {
  it('别名标签: @default @readOnly @examples @comment @description', () => {
    const schema = defOf(`export type T = {
  /**
   * @description 说明
   * @default "x"
   * @readOnly
   * @examples ["a", "b"]
   * @comment 备注
   */
  a: string;
};`);
    expect(schema).toEqual({
      type: 'object',
      properties: {
        a: {
          $comment: '备注',
          description: '说明',
          type: 'string',
          default: 'x',
          examples: ['a', 'b'],
          readOnly: true,
        },
      },
      required: ['a'],
    });
  });

  it('反引号可有可无; 不是 JSON 的值按字符串处理并告警', () => {
    const result = tsToSchema(`export interface T {
  /**
   * @defaultValue \`[1, 2]\`
   * @maximum \`5\`
   * @pattern ^\\d+$
   * @format \`uri\`
   */
  a: number[];
  /**
   * @defaultValue 未加引号
   * @errorMessage 最多 20 字
   */
  b: string;
}`);
    expect(codes(result.diagnostics)).toEqual(['JOTL2113', 'JOTL2113']);
    expect(at(result.diagnostics[0])).toEqual([10, 6]);
    expect(result.value?.$defs?.T).toEqual({
      type: 'object',
      properties: {
        a: { type: 'array', items: { type: 'number' }, maximum: 5, pattern: '^\\d+$', format: 'uri', default: [1, 2] },
        b: { type: 'string', default: '未加引号', errorMessage: '最多 20 字' },
      },
      required: ['a', 'b'],
    });
  });

  it('单行注释, 标签与描述同一行', () => {
    expect(defOf('/** 描述 */\nexport type T = string;')).toEqual({ type: 'string', description: '描述' });
    expect(defOf('/** @title 标题 */\nexport type T = string;')).toEqual({ type: 'string', title: '标题' });
  });

  it('TSDoc 标准标签静默忽略, 未知标签告警', () => {
    const result = tsToSchema('/**\n * @remarks 备注\n * @foo 1\n */\nexport type T = string;');
    expect(codes(result.diagnostics)).toEqual(['JOTL2114']);
    expect(at(result.diagnostics[0])).toEqual([3, 4]);
  });

  it('@asType integer 作用于可空数字; 用于非数字时告警', () => {
    expect(defOf('/**\n * @asType integer\n */\nexport type T = number | null;')).toEqual({
      type: ['integer', 'null'],
    });
    const result = tsToSchema(
      '/**\n * @asType integer\n */\nexport type T = string;\n/**\n * @asType int\n */\nexport type U = number;'
    );
    expect(codes(result.diagnostics)).toEqual(['JOTL2115', 'JOTL2118']);
  });

  it('@enumTitles 作用于嵌套数组中的枚举; 无枚举时告警', () => {
    expect(defOf('/**\n * @enumTitles `{"1":"一","true":"真"}`\n */\nexport type T = (1 | true)[][];')).toEqual({
      type: 'array',
      items: {
        type: 'array',
        items: {
          type: ['integer', 'boolean'],
          oneOf: [
            { const: 1, title: '一' },
            { const: true, title: '真' },
          ],
        },
      },
    });
    expect(codes(tsToSchema('/**\n * @enumTitles `{"a":"甲"}`\n */\nexport type T = string;').diagnostics)).toEqual([
      'JOTL2115',
    ]);
  });

  it('可区分联合编译为 oneOf, 其余为 anyOf', () => {
    const result = tsToSchema(`export type T = A | B;
export type U = A | C;
export interface A { kind: "a"; x: number }
export interface B { kind: "b"; y?: string }
export interface C { kind?: "c" }`);
    expect(result.diagnostics).toEqual([]);
    expect(result.value?.$defs?.T).toEqual({ oneOf: [{ $ref: '#/$defs/A' }, { $ref: '#/$defs/B' }] });
    expect(result.value?.$defs?.U).toEqual({ anyOf: [{ $ref: '#/$defs/A' }, { $ref: '#/$defs/C' }] });
  });

  it('(A | B) | null 还原为 anyOf [内层联合, null], 不加括号时仍拍平; @branchTitles 作用于内层 oneOf', () => {
    const decls = `export interface A { kind: "a" }
export interface B { kind: "b" }`;
    const nested = tsToSchema(
      `/**\n * @branchTitles ["甲",null]\n */\nexport type T = (A | B) | null;\nexport type U = (string | A) | null;\n${decls}`
    );
    expect(nested.diagnostics).toEqual([]);
    expect(nested.value?.$defs?.T).toEqual({
      anyOf: [{ oneOf: [{ $ref: '#/$defs/A', title: '甲' }, { $ref: '#/$defs/B' }] }, { type: 'null' }],
    });
    expect(nested.value?.$defs?.U).toEqual({
      anyOf: [{ anyOf: [{ type: 'string' }, { $ref: '#/$defs/A' }] }, { type: 'null' }],
    });
    const flat = tsToSchema(`export type T = A | B | null;\n${decls}`);
    expect(flat.value?.$defs?.T).toEqual({ anyOf: [{ $ref: '#/$defs/A' }, { $ref: '#/$defs/B' }, { type: 'null' }] });
  });

  it('@closed 与 @decimalRange 作用于对象; 用于其他类型或取值不合法时告警', () => {
    expect(
      defOf(
        '/**\n * @closed\n * @decimalRange `{"minimum":"0"}`\n */\nexport type T = { type: "money"; value: string };'
      )
    ).toEqual({
      type: 'object',
      properties: { type: { type: 'string', const: 'money' }, value: { type: 'string' } },
      required: ['type', 'value'],
      additionalProperties: false,
      'x-decimalRange': { minimum: '0' },
    });
    const misplaced = tsToSchema('/**\n * @closed\n * @decimalRange `{"minimum":"0"}`\n */\nexport type T = string;');
    expect(codes(misplaced.diagnostics)).toEqual(['JOTL2115', 'JOTL2115']);
    const invalid = tsToSchema('/**\n * @decimalRange `{"minimum":0}`\n */\nexport type T = { value: string };');
    expect(codes(invalid.diagnostics)).toEqual(['JOTL2116']);
  });

  it('@closed 与 @decimalRange 经数组元素与可空包装下放到内层对象; 找不到对象时告警', () => {
    const point = { type: 'object', properties: { x: { type: 'number' } }, required: ['x'] };
    const closed = { ...point, additionalProperties: false, 'x-decimalRange': { minimum: '0' } };
    const doc = '/**\n * @closed\n * @decimalRange `{"minimum":"0"}`\n */\n';
    expect(defOf(`${doc}export type T = { x: number }[][];`)).toEqual({
      type: 'array',
      items: { type: 'array', items: closed },
    });
    expect(defOf(`${doc}export type T = { x: number } | null;`)).toEqual({ anyOf: [closed, { type: 'null' }] });
    expect(defOf(`${doc}export type T = ({ x: number } | null)[];`)).toEqual({
      type: 'array',
      items: { anyOf: [closed, { type: 'null' }] },
    });
    const misplaced = tsToSchema(
      `${doc}export type T = { x: number }[] | null;\n${doc}export type U = string[];\n${doc}export type V = ({ x: number } | string)[];`
    );
    expect(codes(misplaced.diagnostics)).toEqual([
      'JOTL2115',
      'JOTL2115',
      'JOTL2115',
      'JOTL2115',
      'JOTL2115',
      'JOTL2115',
    ]);
    expect(misplaced.value?.$defs?.T).toEqual({ anyOf: [{ type: 'array', items: point }, { type: 'null' }] });
  });

  it('Array, Record, 元组, readonly 修饰与带引号的属性名', () => {
    expect(
      defOf(`export interface T {
  readonly "a-b": Array<string>;
  m: Record<string, number>;
  t: [string, -1];
  r: readonly [x: number, ...rest: boolean[]];
  u: unknown;
}`)
    ).toEqual({
      type: 'object',
      properties: {
        'a-b': { type: 'array', items: { type: 'string' }, readOnly: true },
        m: { type: 'object', additionalProperties: { type: 'number' } },
        t: { type: 'array', prefixItems: [{ type: 'string' }, { type: 'integer', const: -1 }], items: false },
        r: { type: 'array', prefixItems: [{ title: 'x', type: 'number' }], items: { type: 'boolean' } },
        u: {},
      },
      required: ['a-b', 'm', 't', 'r', 'u'],
    });
  });

  it('具名元组成员名读回为该位置的 title, 剩余元素的名字不读回', () => {
    expect(defOf('export type T = readonly [开始: string, 名称: { a: number }, ...extra: number[]];')).toEqual({
      type: 'array',
      prefixItems: [
        { title: '开始', type: 'string' },
        { title: '名称', type: 'object', properties: { a: { type: 'number' } }, required: ['a'] },
      ],
      items: { type: 'number' },
    });
  });

  it('export default interface 与 export { X as default } 对应根 $ref', () => {
    expect(tsToSchema('export default interface T { a: string }').value).toEqual({
      $schema: DIALECT,
      $ref: '#/$defs/T',
      'x-ui': { version: 1 },
      $defs: { T: { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] } },
    });
    expect(tsToSchema('type T = string;\nexport { T as default };').value?.$ref).toBe('#/$defs/T');
  });

  it('@root 标记的声明为根, 优先于默认导出; @id @rules 只在根声明上读取', () => {
    const source = [
      'export type A = string;',
      '/**\n * @root\n * @id https://x.dev/a.json\n */',
      'export interface B { a: A }',
      'export default A;',
    ].join('\n');
    const result = tsToSchema(source);
    expect(result.diagnostics).toEqual([]);
    expect(result.value?.$ref).toBe('#/$defs/B');
    expect(result.value?.$id).toBe('https://x.dev/a.json');
    expect(tsToSchema('/** @root */\nexport type A = string;').value?.$ref).toBe('#/$defs/A');
  });

  it('结果带出 defaultExport; 经 print 写出 <default/>, 编译回来 defaultExport 一致', () => {
    expect(tsToSchema('export default interface T { a: string }').defaultExport).toBe('T');
    expect(tsToSchema('type T = string;\nexport { T as default };').defaultExport).toBe('T');
    expect(tsToSchema('export type T = string;').defaultExport).toBeUndefined();
    const source = 'export type A = string;\n/** @root */\nexport interface B { a: A }\nexport default A;\n';
    const result = tsToSchema(source);
    expect(result.defaultExport).toBe('A');
    const printed = print(result.value!, { defaultExport: result.defaultExport! });
    expect(printed.diagnostics).toEqual([]);
    expect(printed.value).toContain('<default/>\nA: string');
    const compiled = compile(printed.value!, 'a.jotl');
    expect(compiled.diagnostics).toEqual([]);
    expect(compiled.value?.defaultExport).toBe('A');
    expect(compiled.value?.schema).toEqual(result.value);
    expect(schemaToTs(compiled.value!.schema, { defaultExport: compiled.value!.defaultExport! }).value).toContain(
      'export default A;'
    );
  });

  it('第二个 @root 与写在属性上的 @root 报 JOTL2115', () => {
    const result = tsToSchema(
      '/** @root */\nexport type A = string;\n/** @root */\nexport interface B {\n  /** @root */\n  a: A;\n}'
    );
    expect(result.value?.$ref).toBe('#/$defs/A');
    expect(codes(result.diagnostics)).toEqual(['JOTL2115', 'JOTL2115']);
  });

  it('空文件只含 $schema', () => {
    expect(tsToSchema('').value).toEqual({ $schema: DIALECT });
  });
});

describe('不支持的 TS 特性', () => {
  const cases: [string, string, string, [number, number]][] = [
    ['泛型', 'export interface Box<T> {\n  value: T;\n}', 'JOTL2102', [1, 18]],
    ['泛型引用', 'export interface A { b: B }\nexport interface B { c: Partial<A> }', 'JOTL2102', [2, 25]],
    ['条件类型', 'export type T = {\n  a: string extends number ? 1 : 2;\n};', 'JOTL2103', [2, 6]],
    ['映射类型', 'export type T = {\n  a: { [K in "x" | "y"]: string };\n};', 'JOTL2104', [2, 6]],
    ['函数类型', 'export interface T {\n  onClick: (event: string) => void;\n}', 'JOTL2105', [2, 12]],
    ['方法签名', 'export interface T {\n  run(): void;\n}', 'JOTL2105', [2, 3]],
    ['交叉类型属性冲突', 'export type T = { a: 1 } & { a: 2 };', 'JOTL2106', [1, 17]],
    ['未定义的类型', 'export type T = Missing;', 'JOTL2109', [1, 17]],
    ['接口继承', 'interface A { a: string }\nexport interface B extends A { b: string }', 'JOTL2110', [2, 18]],
    ['重复声明', 'interface A { a: string }\ninterface A { b: string }', 'JOTL2111', [2, 11]],
    ['默认导出非类型', 'export default 1;', 'JOTL2112', [1, 1]],
    ['默认导出未声明的类型', 'export default Nope;', 'JOTL2112', [1, 1]],
    ['其他声明', 'export enum E { A }', 'JOTL2107', [1, 1]],
    ['计算属性名', 'const k = "a";\nexport interface T { [k]: string }', 'JOTL2117', [2, 22]],
    ['语法错误', 'export interface T {\n  a: \n', 'JOTL2101', [2, 5]],
    ['数字值标签取值不合法', '/**\n * @minimum abc\n */\nexport type T = number;', 'JOTL2116', [2, 4]],
  ];
  for (const [name, source, code, position] of cases) {
    it(`${name}: ${code}`, () => {
      const result = tsToSchema(source);
      expect(result.value).toBeUndefined();
      expect(codes(result.diagnostics)).toContain(code);
      expect(at(result.diagnostics.find(d => d.code === code))).toEqual(position);
      expect(result.diagnostics.every(d => d.message.length > 0)).toBe(true);
    });
  }

  it('导入声明只告警, 不影响转换', () => {
    const result = tsToSchema('import { tags } from "typia";\nexport type T = string;');
    expect(codes(result.diagnostics)).toEqual(['JOTL2108']);
    expect(result.value?.$defs?.T).toEqual({ type: 'string' });
  });
});

describe('数组元素 x-ui, 交叉类型与可区分联合分支标题', () => {
  it('@itemWidget @itemUi 依次作用于各层元素, 层级不存在时报 JOTL2115', () => {
    expect(
      defOf(`export interface T {
  /**
   * @itemUi \`{}\`
   * @itemWidget slider
   */
  grid: number[][];
}`)
    ).toEqual({
      type: 'object',
      properties: {
        grid: { type: 'array', items: { type: 'array', items: { type: 'number', 'x-ui': { widget: 'slider' } } } },
      },
      required: ['grid'],
    });
    const result = tsToSchema('export interface T {\n  /**\n   * @itemWidget tag\n   */\n  a: string;\n}');
    expect(codes(result.diagnostics)).toEqual(['JOTL2115']);
    expect(result.value?.$defs?.T).toEqual({ type: 'object', properties: { a: { type: 'string' } }, required: ['a'] });
  });

  it('交叉类型还原为 allOf 引用加同级关键字; 非引用成员多于一个且无法合并时报 JOTL2106', () => {
    expect(defOf('interface A { a: string }\nexport type T = A & { b: number };')).toEqual({
      type: 'object',
      properties: { b: { type: 'number' } },
      required: ['b'],
      allOf: [{ $ref: '#/$defs/A' }],
    });
    expect(
      tsToSchema('interface A { a: string }\ninterface B { b: string }\nexport type T = A & B;').value?.$defs?.T
    ).toEqual({
      allOf: [{ $ref: '#/$defs/A' }, { $ref: '#/$defs/B' }],
    });
    expect(defOf('interface A { a: string }\nexport type T = A & { b: 1 } & { c?: 2 };')).toEqual({
      type: 'object',
      properties: { b: { type: 'integer', const: 1 }, c: { type: 'integer', const: 2 } },
      required: ['b'],
      allOf: [{ $ref: '#/$defs/A' }],
    });
    expect(
      codes(tsToSchema('interface A { a: string }\nexport type T = A & { b: 1 } & { b: 2 };').diagnostics)
    ).toEqual(['JOTL2106']);
  });

  it('多个属性名互不相交的对象字面量交叉合并为一个对象; 属性冲突, 索引签名或非对象成员报 JOTL2106', () => {
    expect(defOf('export type T = { a: 1 } & ({ b?: string } & { c: number[] });')).toEqual({
      type: 'object',
      properties: {
        a: { type: 'integer', const: 1 },
        b: { type: 'string' },
        c: { type: 'array', items: { type: 'number' } },
      },
      required: ['a', 'c'],
    });
    for (const source of [
      'export type T = { a: 1 } & { a?: 1 };',
      'export type T = { a: 1 } & { [k: string]: number };',
      'export type T = { a: 1 } & { run(): void };',
      'export type T = { a: 1 } & string;',
    ]) {
      const result = tsToSchema(source);
      expect(result.value, source).toBeUndefined();
      expect(codes(result.diagnostics), source).toEqual(['JOTL2106']);
    }
  });

  it('@branchTitles 按下标写入联合分支, 个数不符时报 JOTL2115', () => {
    expect(defOf('/**\n * @branchTitles ["甲", null]\n */\nexport type T = { k: "a" } | { k: "b" };')).toEqual({
      oneOf: [
        { title: '甲', type: 'object', properties: { k: { type: 'string', const: 'a' } }, required: ['k'] },
        { type: 'object', properties: { k: { type: 'string', const: 'b' } }, required: ['k'] },
      ],
    });
    const result = tsToSchema('/**\n * @branchTitles ["甲"]\n */\nexport type T = { k: "a" } | { k: "b" };');
    expect(codes(result.diagnostics)).toEqual(['JOTL2115']);
  });

  it('含 null 的字面量联合读回可空枚举 anyOf', () => {
    expect(defOf('export type T = "s" | "m" | null;')).toEqual({
      anyOf: [{ type: 'string', enum: ['s', 'm'] }, { type: 'null' }],
    });
    expect(defOf('export type T = 1 | null;')).toEqual({ anyOf: [{ type: 'integer', const: 1 }, { type: 'null' }] });
  });
});
