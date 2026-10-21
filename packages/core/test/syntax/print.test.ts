// 打印: JSON Schema → Jotl v1 规范形, 再编译回与输入深度相等的 schema; 无法表达的关键字经 schema 写出.
import { JSON_SCHEMA_DIALECT, type JsonSchema, type JsonSchemaObject, orderKeywords } from '../../src/schema/index.js';
import { describe, expect, it } from 'vitest';
import { listFixtures, readFixture } from '../../../../test-utils/fixtures.js';
import { compile, format, print } from '../../src/syntax/index.js';
import { FILE, codes } from './helpers.js';

/** 打印无诊断, 再编译无诊断且与输入深度相等; 返回打印结果. */
function roundTrip(schema: JsonSchemaObject): string {
  const printed = print(schema);
  expect(printed.diagnostics).toEqual([]);
  const compiled = compile(printed.value!, FILE);
  expect(compiled.diagnostics, printed.value).toEqual([]);
  expect(compiled.value!.schema, printed.value).toEqual(orderKeywords(schema));
  return printed.value!;
}

/** 根为类型 A 的文档. */
function docOf(a: JsonSchema, defs: Record<string, JsonSchema> = {}): JsonSchemaObject {
  return { $schema: JSON_SCHEMA_DIALECT, $ref: '#/$defs/A', 'x-ui': { version: 1 }, $defs: { A: a, ...defs } };
}

/** 类型 A 为只有字段 x 的对象. */
function fieldDoc(x: JsonSchemaObject, defs: Record<string, JsonSchema> = {}, required = true): JsonSchemaObject {
  const a: JsonSchemaObject = { type: 'object', properties: { x } };
  if (required) a.required = ['x'];
  return docOf(a, defs);
}

/** 往返后字段 x 所在的行(去掉缩进). */
function fieldLine(x: JsonSchemaObject, defs: Record<string, JsonSchema> = {}, required = true): string {
  const text = roundTrip(fieldDoc(x, defs, required));
  return text
    .split('\n')
    .find(line => /^\s+x[(?:]?/.test(line) && line.trim().startsWith('x'))!
    .trim();
}

/** 打印无错误, 编译无诊断; 用于语义等价而非深度相等的转换. */
function convert(schema: JsonSchemaObject): { text: string; schema: JsonSchemaObject } {
  const printed = print(schema);
  expect(printed.diagnostics.filter(d => d.severity === 'error')).toEqual([]);
  const compiled = compile(printed.value!, FILE);
  expect(compiled.diagnostics, printed.value).toEqual([]);
  return { text: printed.value!, schema: compiled.value!.schema };
}

/** 选填字段 x 转换后的行与编译出的 schema. */
function convertField(x: JsonSchemaObject): { line: string; schema: JsonSchemaObject } {
  const { text, schema } = convert(fieldDoc(x, {}, false));
  const line = text
    .split('\n')
    .find(l => l.trim().startsWith('x?'))!
    .trim()
    .replace(/^x\?/, 'x');
  return { line, schema: (schema.$defs!.A as JsonSchemaObject).properties!.x as JsonSchemaObject };
}

describe('fixtures 往返', () => {
  for (const name of listFixtures()) {
    const fixture = readFixture(name);
    if (!fixture.hasSchema) continue;
    it(`${name}: schema → Jotl → schema 深度相等, 且排版已是格式化结果`, () => {
      const text = roundTrip(fixture.schema as JsonSchemaObject);
      expect(format(text, FILE).value).toBe(text);
      expect(print(compile(text, FILE).value!.schema).value).toBe(text);
    });
  }
});

describe('组件还原', () => {
  it('字符串类: minLength 有则照写, 没有不补; widget 还原为 text image file', () => {
    expect(fieldLine({ type: 'string' })).toBe('x: string');
    expect(fieldLine({ type: 'string', minLength: 1 })).toBe('x: string[minLength: 1]');
    expect(fieldLine({ type: 'string', minLength: 0 })).toBe('x: string[minLength: 0]');
    expect(fieldLine({ type: 'string', 'x-ui': { widget: 'textarea' } })).toBe('x: text');
    expect(fieldLine({ type: 'string', format: 'uri', 'x-ui': { widget: 'image' } })).toBe('x: image');
    expect(fieldLine({ type: 'string', format: 'uri', 'x-ui': { widget: 'input' } })).toBe("x: url[widget: 'input']");
    expect(fieldLine({ type: 'string', format: 'date-time' })).toBe('x: datetime');
    expect(fieldLine({ type: 'string', contentMediaType: 'text/html' })).toBe('x: richtext');
  });

  it('日期组件按 value_format 还原(方案 V5)', () => {
    expect(fieldLine({ type: 'string', format: 'date' })).toBe('x: date');
    expect(fieldLine({ type: 'string', 'x-valueFormat': 'HH:mm:ss', 'x-ui': { widget: 'time' } })).toBe('x: time');
    expect(fieldLine({ type: 'string', 'x-valueFormat': 'YYYYMMDD', 'x-ui': { widget: 'date' } })).toBe(
      "x: date[value_format: 'YYYYMMDD']"
    );
    expect(fieldLine({ type: 'string', format: 'date-time', 'x-valueFormat': 'utc' })).toBe(
      "x: datetime[value_format: 'utc']"
    );
    expect(
      fieldLine({
        type: 'integer',
        minimum: -Number.MAX_SAFE_INTEGER,
        maximum: Number.MAX_SAFE_INTEGER,
        'x-valueFormat': 'x',
        'x-ui': { widget: 'datetime' },
      })
    ).toBe("x: datetime[value_format: 'x']");
    expect(
      fieldLine({
        type: 'integer',
        minimum: -Number.MAX_SAFE_INTEGER,
        maximum: Number.MAX_SAFE_INTEGER,
        'x-valueFormat': 'X',
        'x-ui': { widget: 'date' },
      })
    ).toBe("x: date[value_format: 'X']");
    // 时间戳缺少上下界时仍还原为日期组件, 编译补安全整数范围.
    const stamp = convertField({ type: 'integer', 'x-valueFormat': 'x', 'x-ui': { widget: 'date' } });
    expect(stamp.line).toBe("x: date[value_format: 'x']");
    expect(stamp.schema).toEqual({
      type: 'integer',
      minimum: -Number.MAX_SAFE_INTEGER,
      maximum: Number.MAX_SAFE_INTEGER,
      'x-valueFormat': 'x',
      'x-ui': { widget: 'date' },
    });
    expect(fieldLine({ type: 'string', 'x-valueFormat': 'HH:mm', 'x-ui': { widget: 'input' } })).toBe(
      "x: time[value_format: 'HH:mm', widget: 'input']"
    );
    // time 组件不再编译为 format: time, 标准 time 格式按普通字符串格式还原.
    expect(fieldLine({ type: 'string', format: 'time' })).toBe("x: string[format: 'time']");
    // 没有 x-ui.widget 时按格式内容推断组件.
    expect(convertField({ type: 'string', 'x-valueFormat': 'YYYY/MM/DD HH:mm' }).line).toBe(
      "x: datetime[value_format: 'YYYY/MM/DD HH:mm']"
    );
  });

  it('选填的无元数据 string 写成光秃的键', () => {
    expect(fieldLine({ title: '甲', type: 'string' }, {}, false)).toBe('x(甲)');
  });

  it('integer 缺少上下界时仍为 integer, 编译补安全整数范围', () => {
    expect(fieldLine({ type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER })).toBe('x: integer[minimum: 0]');
    const { line, schema } = convertField({ type: 'integer', minimum: 0 });
    expect(line).toBe('x: integer[minimum: 0]');
    expect(schema).toEqual({ type: 'integer', minimum: 0, maximum: Number.MAX_SAFE_INTEGER });
  });

  it('数组 minItems 有则照写, 没有不补; 元素对象写成体; 元组按 minItems 还原必填位置', () => {
    expect(fieldLine({ type: 'array', items: { type: 'number' } })).toBe("x: array[array_item: 'number']");
    expect(fieldLine({ type: 'array', minItems: 1, items: { type: 'number' } })).toBe(
      "x: array[array_item: 'number', minItems: 1]"
    );
    expect(
      fieldLine({ type: 'array', minItems: 2, items: { type: 'object', properties: { a: { type: 'number' } } } })
    ).toBe('x: array[minItems: 2] {');
    const tuple = roundTrip(
      fieldDoc({ type: 'array', minItems: 1, prefixItems: [{ type: 'number' }, { type: 'boolean' }], items: false })
    );
    expect(tuple).toContain("x: array[array_item: 'tuple'] {\n    0: number\n    1?: boolean\n  }");
  });

  it('可空: type 数组与 anyOf 两种形态', () => {
    expect(fieldLine({ type: ['number', 'null'] })).toBe('x: number[nullable: true]');
    expect(
      fieldLine({ title: '甲', anyOf: [{ $ref: '#/$defs/B' }, { type: 'null' }] }, { B: { type: 'object' } })
    ).toBe('x(甲): B[nullable: true]');
  });

  it('可区分联合与按 JSON 类型区分的联合', () => {
    const text = roundTrip(
      fieldDoc(
        {
          oneOf: [
            {
              type: 'object',
              properties: { k: { type: 'string', const: 'a' }, v: { type: 'number' } },
              required: ['k', 'v'],
            },
            {
              type: 'object',
              allOf: [{ $ref: '#/$defs/B' }],
              properties: { k: { type: 'string', const: 'b' } },
              required: ['k'],
              title: '乙',
            },
          ],
        },
        { B: { type: 'object' } }
      )
    );
    expect(text).toContain("x: union[discriminator: 'k'] {\n    a: {\n      v: number\n    }\n    b(乙): B\n  }");
    expect(fieldLine({ anyOf: [{ type: 'boolean' }, { type: 'string', pattern: 'a' }] })).toBe(
      "x: union[union_item: 'boolean|string', item_meta: {string: {pattern: 'a'}}]"
    );
  });

  it('枚举成员值需要引号时加引号', () => {
    expect(fieldLine({ type: 'string', enum: ['a b', 'true', '12', 'c'] })).toBe("x: enum{ 'a b' 'true' '12' c }");
  });
});

describe('常规 JSON Schema 选用语义相符的组件', () => {
  it('oneOf / anyOf 全为 const 分支(可缺 type)时打印为 enum, 成员说明写为成员元数据', () => {
    const { line, schema } = convertField({
      description: '甲',
      oneOf: [
        { description: '一', const: 'a' },
        { title: '乙', const: 'b' },
      ],
      default: 'a',
    });
    expect(line).toBe("x: enum[description: '甲', default: 'a']{ a[description: '一'] b(乙) }");
    expect(schema).toEqual({
      description: '甲',
      type: 'string',
      oneOf: [
        { description: '一', const: 'a' },
        { title: '乙', const: 'b' },
      ],
      default: 'a',
    });
    expect(convertField({ anyOf: [{ const: 1 }, { const: 2 }] }).line).toBe('x: enum{ 1 2 }');
  });

  it('anyOf 为常量加同类型的开放分支时等价于该类型, 常量记入 examples; oneOf 不改写', () => {
    const { line } = convertField({
      anyOf: [{ const: 'a' }, { description: '其它', const: 'b' }, { description: '自定义', type: 'string' }],
    });
    expect(line).toBe("x: string[examples: ['a', 'b']]");
    expect(convertField({ oneOf: [{ const: 'a' }, { type: 'string' }] }).line).toMatch(/^x: any\[schema:/);
  });

  it('oneOf 各分支 JSON 类型互斥时打印为按 JSON 类型区分的联合', () => {
    const { line, schema } = convertField({
      oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    });
    expect(line).toBe("x: union[union_item: 'string|array', item_meta: {array: {array_item: 'string'}}]");
    expect(schema).toEqual({ anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] });
    // integer 与 number 重叠, 不能改为 anyOf.
    expect(convertField({ oneOf: [{ type: 'integer' }, { type: 'number' }] }).line).toMatch(/^x: any\[schema:/);
  });

  it('allOf 全为指向普通对象的引用时合并字段; 被引用对象带 additionalProperties 或字段冲突时放弃', () => {
    const defs = {
      B: { type: 'object', properties: { b: { type: 'boolean' } }, required: ['b'] },
      C: { type: 'object', properties: { c: { type: 'number' } } },
      D: { type: 'object', properties: { c: { type: 'number' } }, additionalProperties: false },
    } as const;
    const { text, schema } = convert(
      fieldDoc({ type: 'object', allOf: [{ $ref: '#/$defs/B' }, { $ref: '#/$defs/C' }] }, defs as never)
    );
    expect(text).toContain('x: {\n    b: boolean\n    c?: number\n  }');
    expect((schema.$defs!.A as JsonSchemaObject).properties!.x).toEqual({
      type: 'object',
      properties: { b: { type: 'boolean' }, c: { type: 'number' } },
      required: ['b'],
    });
    expect(convert(fieldDoc({ allOf: [{ $ref: '#/$defs/B' }, { $ref: '#/$defs/D' }] }, defs as never)).text).toContain(
      'x: any[schema:'
    );
    expect(convert(fieldDoc({ allOf: [{ $ref: '#/$defs/C' }, { $ref: '#/$defs/C' }] }, defs as never)).text).toContain(
      'x: any[schema:'
    );
  });

  it('联合中的对象分支提升为顶层类型 <所在类型名>Object, 避免重名', () => {
    const { text, schema } = convert(
      docOf(
        { oneOf: [{ type: 'object', properties: { a: { type: 'number' } } }, { type: 'string' }] },
        { AObject: { type: 'boolean' } }
      )
    );
    expect(text).toBe("A: union[union_item: 'AObject2|string']\n\nAObject: boolean\n\nAObject2: {\n  a?: number\n}\n");
    expect(schema.$defs!.A).toEqual({ anyOf: [{ $ref: '#/$defs/AObject2' }, { type: 'string' }] });
  });

  it('提升出的对象分支无标题时沿用联合节点的 title', () => {
    const branch: JsonSchemaObject = { type: 'object', properties: { a: { type: 'number' } } };
    const { text, schema } = convert(docOf({ title: '选项', oneOf: [branch, { type: 'string' }] }));
    expect(text).toContain('\nAObject(选项): {\n');
    expect(schema.$defs!.AObject).toMatchObject({ title: '选项' });
    expect(convert(docOf({ title: '选项', oneOf: [{ title: '对象', ...branch }, { type: 'string' }] })).text).toContain(
      '\nAObject(对象): {\n'
    );
  });

  it('类型名被改名后, 原样写出片段中的 $ref 同步改为新名', () => {
    const printed = print({
      type: 'object',
      properties: { a: { not: { $ref: '#/$defs/my-type' } } },
      $defs: { 'my-type': { type: 'boolean' } },
    });
    expect(printed.value).toContain("a?: any[schema: {not: {$ref: '#/$defs/MyType'}}]");
    expect(compile(printed.value!, FILE).diagnostics).toEqual([]);
    const nested = print({
      $ref: '#/$defs/my-type',
      $defs: {
        'my-type': {
          type: 'object',
          properties: { a: { type: 'string' }, b: { not: { $ref: '#/$defs/my-type/properties/a' } } },
        },
      },
    });
    expect(nested.value).toContain("b?: any[schema: {not: {$ref: '#/$defs/MyType/properties/a'}}]");
  });

  it('根为内联 schema 时, 指向根内部的 $ref 改指 #/$defs/<根名>/...', () => {
    const { text, schema } = convert({
      type: 'object',
      properties: { a: { type: 'string' }, b: { not: { $ref: '#/properties/a' } } },
    });
    expect(text).toContain("b?: any[schema: {not: {$ref: '#/$defs/Root/properties/a'}}]");
    expect((schema.$defs!.Root as JsonSchemaObject).properties!.b).toEqual({
      not: { $ref: '#/$defs/Root/properties/a' },
    });
  });

  it('默认值检查跟随指向内联根的 # 引用', () => {
    const { text } = convert({
      type: 'object',
      properties: {
        x: { type: 'integer' },
        n: { type: 'object', properties: { s: { $ref: '#' } }, default: { s: { x: 'bad' } } },
      },
    });
    expect(text).toContain("n?: [schema: {default: {s: {x: 'bad'}}}] {");
  });

  it('嵌套超过上限时不输出源码, 报 JOTL1029', () => {
    let deep: JsonSchemaObject = { type: 'string' };
    for (let i = 0; i < 300; i++) deep = { type: 'object', properties: { a: deep } };
    const printed = print(deep);
    expect(printed.value).toBeUndefined();
    expect(printed.diagnostics.map(d => [d.code, d.severity])).toEqual([['JOTL1029', 'error']]);
  });

  it('输入极深(几千层)时不耗尽调用栈, 报 JOTL1029', () => {
    let deep: JsonSchemaObject = { type: 'string' };
    for (let i = 0; i < 5000; i++) deep = { type: 'object', properties: { a: deep } };
    expect(codes(print(deep).diagnostics)).toEqual(['JOTL1029']);
    let raw: unknown = 1;
    for (let i = 0; i < 20000; i++) raw = [raw];
    expect(codes(print({ default: raw } as never).diagnostics)).toEqual(['JOTL1029']);
  });

  it('嵌套在上限附近的输入照常打印', () => {
    let deep: JsonSchemaObject = { type: 'string' };
    for (let i = 0; i < 250; i++) deep = { type: 'object', properties: { a: deep } };
    expect(print(deep).value).toBeDefined();
    let notChain: JsonSchemaObject = {};
    for (let i = 0; i < 4 * 256 - 2; i++) notChain = { not: notChain };
    expect(codes(print(notChain).diagnostics)).not.toContain('JOTL1031');
  });

  it('JSON 很深而源码不深时照常打印: 可空数组套可空对象每层 7 层 JSON 只占 1 层括号; 被忽略的深数据不影响', () => {
    let a: JsonSchemaObject = { type: 'object' };
    for (let i = 0; i < 200; i++) {
      a = {
        type: 'object',
        properties: { x: { anyOf: [{ type: 'array', items: { anyOf: [a, { type: 'null' }] } }, { type: 'null' }] } },
      };
    }
    expect(roundTrip(docOf(a))).toContain('  x?: array[item_meta: {nullable: true}, nullable: true] {\n');
    let data: unknown = 1;
    for (let i = 0; i < 2000; i++) data = { a: data };
    const ignored = print({
      ...docOf({ type: 'object', properties: { s: { type: 'string', $defs: { X: data as JsonSchemaObject } } } }),
      'x-ui': { version: 1, foo: data },
    } as never);
    expect(ignored.value).toBe('A: {\n  s\n}\n');
    expect(codes(ignored.diagnostics)).toEqual(['JOTL1032', 'JOTL1032']);
  });

  it('写进源码的深数据(default examples x-ui 与经 schema 写出的关键字)仍超过语法上限, 报 JOTL1029 并指向该值', () => {
    let data: unknown = 1;
    for (let i = 0; i < 2000; i++) data = { a: data };
    const pointerOf = (x: JsonSchemaObject) => {
      const printed = print(fieldDoc(x));
      expect(printed.value).toBeUndefined();
      expect(codes(printed.diagnostics)).toEqual(['JOTL1029']);
      const location = printed.diagnostics[0]!.location;
      return location?.kind === 'pointer' ? location.pointer : undefined;
    };
    expect(pointerOf({ type: 'object', default: data } as never)).toBe('/$defs/A/properties/x/default');
    expect(pointerOf({ type: 'string', examples: [data] } as never)).toBe('/$defs/A/properties/x/examples');
    expect(pointerOf({ type: 'string', 'x-ui': { props: data } } as never)).toBe('/$defs/A/properties/x/x-ui');
    expect(pointerOf({ type: 'string', items: data } as never)).toBe('/$defs/A/properties/x/items');
  });

  it('很长的 $ref 链与很深的联合分支链不耗尽调用栈', () => {
    const defs: Record<string, JsonSchema> = { A20000: { type: 'string' } };
    for (let i = 0; i < 20000; i++) defs[`A${i}`] = { $ref: `#/$defs/A${i + 1}` };
    const printed = print({ anyOf: [{ $ref: '#/$defs/A0' }, { type: 'number' }], default: 'x', $defs: defs });
    expect(printed.value).toMatch(/^Root: union\[union_item: 'A0\|number', default: 'x'\]\n/);
    let chain: JsonSchemaObject = { type: 'string' };
    for (let i = 0; i < 5000; i++)
      chain = { anyOf: [{ type: 'object', properties: { a: chain } }, { type: 'number' }] };
    expect(codes(print(chain).diagnostics)).toEqual(['JOTL1029']);
  });

  it('default 不满足约束时组件不变, default 经 schema 写出', () => {
    const { line, schema } = convertField({ type: 'integer', default: null });
    expect(line).toBe('x: integer[schema: {default: null}]');
    expect(schema).toMatchObject({ type: 'integer', default: null });
  });
});

describe('元数据还原', () => {
  it('x-ui: 条件还原为 root_if / node_if, 默认 widget 不写出', () => {
    expect(fieldLine({ type: 'boolean', 'x-ui': { visibleIf: { field: '/a/0', base: 'node', truthy: false } } })).toBe(
      "x: boolean[node_if: {left: 'a[0]', op: 'falsy'}]"
    );
  });

  it('不能用元数据表达的 x-ui 整体经 schema 写出, 组件不再自带 widget; 不合法的 x-ui 再编译时报 warning JOTL1050', () => {
    const doc = fieldDoc({ type: 'string', 'x-ui': { widget: 'textarea', foo: 1 } as never });
    const printed = print(doc);
    expect(printed.diagnostics).toEqual([]);
    expect(printed.value).toContain("x: string[schema: {'x-ui': {widget: 'textarea', foo: 1}}]");
    const compiled = compile(printed.value!, FILE);
    expect(codes(compiled.diagnostics)).toEqual(['JOTL1050']);
    expect(compiled.value!.schema).toEqual(orderKeywords(doc));
    expect(fieldLine({ type: 'string', 'x-ui': { widget: 'input' } })).toBe(
      "x: string[schema: {'x-ui': {widget: 'input'}}]"
    );
  });

  it('x- 自定义关键字还原为 x_*, 其余未知关键字经 schema', () => {
    expect(fieldLine({ type: 'boolean', 'x-bizCode': 1, if: {} })).toBe('x: boolean[x_biz_code: 1, schema: {if: {}}]');
  });

  it('不满足约束的默认值经 schema 写出', () => {
    expect(fieldLine({ type: 'number', maximum: 1, default: 2 })).toBe('x: number[maximum: 1, schema: {default: 2}]');
  });
});

describe('根与类型名', () => {
  it('根不是第一条时标 <root/>; 根 $id 与 rules 写在根条目上', () => {
    const text = roundTrip({
      $schema: JSON_SCHEMA_DIALECT,
      $id: 'https://x.dev/a.json',
      $ref: '#/$defs/B',
      'x-ui': { version: 1, rules: [{ match: { type: 'string' }, ui: { widget: 'textarea' } }] },
      $defs: { A: { type: 'boolean' }, B: { type: 'object' } },
    });
    expect(text).toBe(
      "A: boolean\n\n<root/>\nB: [rules: [{match: {type: 'string'}, ui: {widget: 'textarea'}}], id: 'https://x.dev/a.json'] {}\n"
    );
  });

  it('defaultExport 与根不同时写 <default/> 并给根补 <root/>; 与根相同时不写; 不是 $defs 的键时不写并报 JOTL1051', () => {
    const doc: JsonSchemaObject = {
      $schema: JSON_SCHEMA_DIALECT,
      $ref: '#/$defs/A',
      'x-ui': { version: 1 },
      $defs: { A: { type: 'object' }, b: { type: 'boolean' } },
    };
    const printed = print(doc, { defaultExport: 'b' });
    expect(codes(printed.diagnostics)).toEqual(['JOTL1034']);
    expect(printed.value).toBe('<root/>\nA: {}\n\n<default/>\nB: boolean\n');
    const compiled = compile(printed.value!, FILE);
    expect(compiled.value?.defaultExport).toBe('B');
    expect(compiled.value?.schema.$ref).toBe('#/$defs/A');
    expect(print(doc, { defaultExport: 'A' }).value).toBe(print(doc).value);
    expect(codes(print(doc, { defaultExport: 'A' }).diagnostics)).toEqual(['JOTL1034']);
    const missing = print(doc, { defaultExport: 'Missing' });
    expect(missing.value).toBe(print(doc).value);
    expect(missing.diagnostics.map(d => [d.code, d.severity])).toEqual([
      ['JOTL1034', 'warning'],
      ['JOTL1051', 'warning'],
    ]);
    expect(missing.diagnostics[1]!.message).toContain('`Missing`');
    const inline = print({ type: 'string', $defs: { A: { type: 'boolean' } } }, { defaultExport: 'A' });
    expect(inline.value).toBe('<root/>\nRoot: string\n\n<default/>\nA: boolean\n');
    expect(compile(inline.value!, FILE).value?.defaultExport).toBe('A');
  });

  it('规则 ui 中的 visibleIf 写回 root_if / node_if', () => {
    const text = roundTrip({
      $schema: JSON_SCHEMA_DIALECT,
      $ref: '#/$defs/A',
      'x-ui': {
        version: 1,
        rules: [{ match: { type: 'string' }, ui: { visibleIf: { field: '/on', base: 'node', truthy: true } } }],
      },
      $defs: { A: { type: 'object' } },
    });
    expect(text).toBe("A: [rules: [{match: {type: 'string'}, ui: {node_if: 'on'}}]] {}\n");
  });

  it('内联根生成 Root 类型; 不合法的类型名改为大驼峰并报 JOTL1034', () => {
    const printed = print({
      type: 'object',
      properties: { a: { $ref: '#/$defs/my-type' } },
      $defs: { 'my-type': { type: 'boolean' } },
    });
    expect(codes(printed.diagnostics)).toEqual(['JOTL1034']);
    expect(printed.value).toBe('Root: {\n  a?: MyType\n}\n\nMyType: boolean\n');
    expect(codes(print({}, { rootName: 'root' }).diagnostics)).toEqual(['JOTL1035']);
  });

  it('布尔 schema, 非 JSON 值, 不是 schema 的输入', () => {
    expect(print(false).value).toBe('Root: any[schema: {not: {}}]\n');
    expect(codes(print(false).diagnostics)).toEqual(['JOTL1033']);
    expect(codes(print({ a: Number.NaN } as never).diagnostics)).toEqual(['JOTL1031']);
    expect(codes(print([] as never).diagnostics)).toEqual(['JOTL1030']);
  });

  it('子节点中的 $schema $defs 被忽略并报 JOTL1032', () => {
    const printed = print(fieldDoc({ type: 'boolean', $defs: {} }));
    expect(codes(printed.diagnostics)).toEqual(['JOTL1032']);
  });
});
