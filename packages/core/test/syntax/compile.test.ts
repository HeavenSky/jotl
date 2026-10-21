// 编译(契约 C1 C4): 各组件编译出的 JSON Schema, 空串空数组默认允许, widget 写入规则, 可空, 元数据与根.
import { JSON_SCHEMA_DIALECT } from '../../src/schema/index.js';
import { describe, expect, it } from 'vitest';
import { compile } from '../../src/syntax/index.js';
import { compileDef, compileDoc, compileField, fieldCodes } from './helpers.js';

const MAX = Number.MAX_SAFE_INTEGER;

describe('字符串类组件', () => {
  it('string text richtext 默认允许空串, 不写 minLength; 写了照写', () => {
    expect(compileField(': string')).toEqual({ type: 'string' });
    expect(compileField(': string[minLength: 1]')).toEqual({ type: 'string', minLength: 1 });
    expect(compileField(": string[minLength: 3, maxLength: 5, pattern: '^a', format: 'hostname']")).toEqual({
      type: 'string',
      minLength: 3,
      maxLength: 5,
      pattern: '^a',
      format: 'hostname',
    });
    expect(compileField(': text')).toEqual({ type: 'string', 'x-ui': { widget: 'textarea' } });
    expect(compileField(': richtext')).toEqual({ type: 'string', contentMediaType: 'text/html' });
  });

  it('带 format 的组件不加 minLength; image file 写入 widget', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['date', { format: 'date' }],
      ['time', { 'x-valueFormat': 'HH:mm:ss', 'x-ui': { widget: 'time' } }],
      ['datetime', { format: 'date-time' }],
      ['url', { format: 'uri' }],
      ['email', { format: 'email' }],
      ['color', { format: 'color' }],
      ['image', { format: 'uri', 'x-ui': { widget: 'image' } }],
      ['file', { format: 'uri', 'x-ui': { widget: 'file' } }],
    ];
    for (const [comp, extra] of cases) expect(compileField(`: ${comp}`), comp).toEqual({ type: 'string', ...extra });
  });

  it('光秃的键与只写元数据为 string, 光秃的键选填', () => {
    const def = compileDef('A: {\n  a(甲)\n  b: [maxLength: 2]\n}');
    expect(def).toEqual({
      type: 'object',
      properties: { a: { title: '甲', type: 'string' }, b: { type: 'string', maxLength: 2 } },
      required: ['b'],
    });
  });

  it('jsontext: 省略体时为任意 JSON, 有体或 json_item 时加 contentSchema', () => {
    expect(compileField(': jsontext')).toEqual({ type: 'string', contentMediaType: 'application/json' });
    expect(compileField(': jsontext { a: number }')).toEqual({
      type: 'string',
      contentMediaType: 'application/json',
      contentSchema: { type: 'object', properties: { a: { type: 'number' } }, required: ['a'] },
    });
    expect(compileField(": jsontext[json_item: 'number']")).toMatchObject({ contentSchema: { type: 'number' } });
  });
});

describe('日期组件的 value_format', () => {
  it('编译规则(方案 V5)', () => {
    const cases: [string, Record<string, unknown>][] = [
      ["date[value_format: 'YYYY-MM-DD']", { type: 'string', format: 'date' }],
      ["date[value_format: 'YYYYMMDD']", { type: 'string', 'x-valueFormat': 'YYYYMMDD', 'x-ui': { widget: 'date' } }],
      [
        "date[value_format: 'x']",
        {
          type: 'integer',
          minimum: -Number.MAX_SAFE_INTEGER,
          maximum: Number.MAX_SAFE_INTEGER,
          'x-valueFormat': 'x',
          'x-ui': { widget: 'date' },
        },
      ],
      ["time[value_format: 'HH:mm']", { type: 'string', 'x-valueFormat': 'HH:mm', 'x-ui': { widget: 'time' } }],
      ["datetime[value_format: 'iso']", { type: 'string', format: 'date-time' }],
      ["datetime[value_format: 'utc-x']", { type: 'string', format: 'date-time', 'x-valueFormat': 'utc-x' }],
      [
        "datetime[value_format: 'X']",
        {
          type: 'integer',
          minimum: -Number.MAX_SAFE_INTEGER,
          maximum: Number.MAX_SAFE_INTEGER,
          'x-valueFormat': 'X',
          'x-ui': { widget: 'datetime' },
        },
      ],
      [
        "datetime[value_format: 'YYYY-MM-DD HH:mm', widget: 'input']",
        { type: 'string', 'x-valueFormat': 'YYYY-MM-DD HH:mm', 'x-ui': { widget: 'input' } },
      ],
    ];
    for (const [text, expected] of cases) expect(compileField(`: ${text}`), text).toEqual(expected);
  });

  it('time 不能用时间戳; 只适用于三个日期组件; 不能用 x_value_format 写入', () => {
    const codes = (text: string) => fieldCodes(`: ${text}`);
    expect(codes("time[value_format: 'x']")).toEqual(['JOTL1020']);
    expect(codes("string[value_format: 'x']")).toEqual(['JOTL1007']);
    expect(codes("date[value_format: '']")).toEqual(['JOTL1020']);
    expect(codes("date[x_value_format: 'x']")).toEqual(['JOTL1012']);
  });

  it('default 按 value_format 检查(JOTL1008)', () => {
    const codes = (text: string) => fieldCodes(`: ${text}`);
    expect(codes("date[value_format: 'YYYYMMDD', default: '20261013']")).toEqual([]);
    expect(codes("date[value_format: 'YYYYMMDD', default: '2026-10-13']")).toEqual(['JOTL1008']);
    expect(codes("date[value_format: 'YYYYMMDD', default: '20260230']")).toEqual(['JOTL1008']);
    expect(codes("time[default: '09:30:00']")).toEqual([]);
    expect(codes("time[default: '09:30']")).toEqual(['JOTL1008']);
    expect(codes("datetime[value_format: 'utc-x', default: '2026-10-13T09:30:15+08:00']")).toEqual([]);
    expect(codes("datetime[value_format: 'x', default: 1791855015000]")).toEqual([]);
    expect(codes("datetime[value_format: 'x', default: 1.5]")).toEqual(['JOTL1008']);
    expect(codes("datetime[value_format: 'X', default: 9007199254740992]")).toEqual(['JOTL1008']);
    // 含不支持的记号时不检查.
    expect(codes("date[value_format: 'MMM D, YYYY', default: 'whatever']")).toEqual([]);
    expect(codes("date[value_format: 'M/D/YYYY', default: '2/30/2026']")).toEqual(['JOTL1008']);
    const { diagnostics } = compile("A: {\n  x: date[value_format: 'YYYYMMDD', default: '2026-10-13']\n}\n", 'a.jotl');
    expect(diagnostics[0]!.message).toContain('x-valueFormat');
  });

  it('default 按 schema 写入的 not 检查(JOTL1008); not 中含不支持的关键字时不检查', () => {
    const codes = (text: string) => fieldCodes(`: ${text}`);
    expect(codes("string[schema: {not: {const: 'a'}}, default: 'a']")).toEqual(['JOTL1008']);
    expect(codes("string[schema: {not: {const: 'a'}}, default: 'b']")).toEqual([]);
    expect(codes('integer[schema: {not: {minimum: 0, maximum: 9}}, default: 5]')).toEqual(['JOTL1008']);
    expect(codes('integer[schema: {not: {minimum: 0, maximum: 9}}, default: 10]')).toEqual([]);
    expect(codes("string[schema: {not: {format: 'unknown-format'}}, default: 'a']")).toEqual([]);
    expect(codes("string[schema: {not: {if: {const: 'a'}}}, default: 'a']")).toEqual([]);
    expect(codes("array[array_item: 'integer', schema: {not: {contains: {const: 1}}}, default: [2]]")).toEqual([]);
    const { diagnostics } = compile(
      "A: {\n  x: string[schema: {not: {enum: ['a', 'b']}}, default: 'a']\n}\n",
      'a.jotl'
    );
    expect(diagnostics[0]!.message).toBe('默认值违反约束: 满足了 `not` 排除的 schema');
  });
});

describe('数值', () => {
  it('number 与 decimals; integer 默认安全整数范围, 作者写了上下界时用作者的', () => {
    expect(compileField(': number[decimals: 2, exclusiveMinimum: 0]')).toEqual({
      type: 'number',
      exclusiveMinimum: 0,
      'x-decimals': 2,
    });
    expect(compileField(': integer')).toEqual({ type: 'integer', minimum: -MAX, maximum: MAX });
    expect(compileField(': integer[minimum: 1]')).toEqual({ type: 'integer', minimum: 1, maximum: MAX });
  });

  it('money: 固定币种取 ISO 4217 位数, 可选币种, 单位, decimals 覆盖, 范围为 x-decimalRange', () => {
    expect(compileField(": money[currency: 'CNY', minimum: '0']")).toEqual({
      type: 'object',
      properties: {
        type: { type: 'string', const: 'money' },
        value: { type: 'string', pattern: '^-?\\d+\\.\\d{2}$' },
        currency: { type: 'string', const: 'CNY' },
        unit: { type: 'string' },
      },
      required: ['type', 'value', 'currency'],
      additionalProperties: false,
      'x-decimalRange': { minimum: '0' },
    });
    const value = (field: string) =>
      (compileField(field).properties as Record<string, { pattern?: string }>).value!.pattern;
    expect(value(": money[currency: 'JPY']")).toBe('^-?\\d+$');
    expect(value(": money[currency: ['USD', 'JPY']]")).toBe('^-?\\d+(\\.\\d+)?$');
    expect(value(": money[currency: ['USD', 'EUR']]")).toBe('^-?\\d+\\.\\d{2}$');
    expect(value(': money')).toBe('^-?\\d+(\\.\\d+)?$');
    expect(value(": money[currency: 'CNY', unit: 'fen']")).toBe('^-?\\d+(\\.\\d+)?$');
    expect(value(": money[currency: 'CNY', decimals: 4]")).toBe('^-?\\d+\\.\\d{4}$');
    const fixed = compileField(": money[unit: 'fen']");
    expect(fixed.required).toEqual(['type', 'value', 'currency', 'unit']);
    expect((fixed.properties as Record<string, unknown>).currency).toEqual({ type: 'string', pattern: '^[A-Z]{3}$' });
    expect((compileField(": money[unit: ['yuan', 'fen']]").properties as Record<string, unknown>).unit).toEqual({
      type: 'string',
      enum: ['yuan', 'fen'],
    });
  });

  it('bigint 与范围', () => {
    expect(compileField(": bigint[maximum: '99999999999999999999']")).toEqual({
      type: 'object',
      properties: { type: { type: 'string', const: 'bigint' }, value: { type: 'string', pattern: '^-?\\d+$' } },
      required: ['type', 'value'],
      additionalProperties: false,
      'x-decimalRange': { maximum: '99999999999999999999' },
    });
  });

  it('thousands 只在与默认值不同时写入', () => {
    expect(compileField(': money[thousands: true]')['x-ui']).toBeUndefined();
    expect(compileField(': money[thousands: false]')['x-ui']).toEqual({ thousands: false });
    expect(compileField(': number[thousands: true]')['x-ui']).toEqual({ thousands: true });
    expect(compileField(': bigint[thousands: false]')['x-ui']).toBeUndefined();
  });
});

describe('枚举', () => {
  it('有标签或说明时为 oneOf, 否则 enum, 单成员为 const; 外层 type 按规范化规则 4', () => {
    expect(compileField(': enum{ a b }')).toEqual({ type: 'string', enum: ['a', 'b'] });
    expect(compileField(': enum{ a }')).toEqual({ type: 'string', const: 'a' });
    expect(compileField(": enum{ 1 2.5 true 'x' }")).toEqual({
      type: ['integer', 'number', 'boolean', 'string'],
      enum: [1, 2.5, true, 'x'],
    });
    expect(compileField(": enum{ a(甲) b[description: '乙'] }")).toEqual({
      type: 'string',
      oneOf: [
        { const: 'a', title: '甲' },
        { const: 'b', description: '乙' },
      ],
    });
  });

  it('多选: array + uniqueItems, 默认允许空数组; 全局枚举的多选', () => {
    expect(compileField(': enum[multiple: true, maxItems: 2]{ a b }')).toEqual({
      type: 'array',
      maxItems: 2,
      items: { type: 'string', enum: ['a', 'b'] },
      uniqueItems: true,
    });
    expect(compileField(': enum[multiple: true, minItems: 1]{ a b }')).toEqual({
      type: 'array',
      minItems: 1,
      items: { type: 'string', enum: ['a', 'b'] },
      uniqueItems: true,
    });
    expect(compileField(': E[multiple: true]', 'E: enum{ a b }')).toEqual({
      type: 'array',
      items: { $ref: '#/$defs/E' },
      uniqueItems: true,
    });
  });

  it('单成员默认 output, 多选默认 select; 其余候选写入 widget, 不接受的降级', () => {
    expect(compileField(": enum[widget: 'radio']{ a b }")['x-ui']).toEqual({ widget: 'radio' });
    expect(compileField(": enum[widget: 'select']{ a b }")['x-ui']).toBeUndefined();
    expect(compileField(": enum[multiple: true, widget: 'checkbox']{ a b }")['x-ui']).toEqual({ widget: 'checkbox' });
  });
});

describe('对象, 数组, map', () => {
  it('对象: 省略组件, closed, 属性数, 布局元数据', () => {
    expect(
      compileField(
        ": [closed: true, minProperties: 1, layout: 'grid', columns: 3, order: ['b'], summary: 'b'] { b: string }"
      )
    ).toEqual({
      type: 'object',
      properties: { b: { type: 'string' } },
      required: ['b'],
      additionalProperties: false,
      minProperties: 1,
      'x-ui': { layout: 'grid', columns: 3, order: ['b'], summary: 'b' },
    });
    expect(compileField(': object')).toEqual({ type: 'object' });
    expect(compileField(": [widget: 'inline'] {}")).toEqual({ type: 'object', 'x-ui': { widget: 'inline' } });
    expect(compileField(": [widget: 'page'] {}")).toEqual({ type: 'object' });
  });

  it('数组: 体为元素对象的字段, item_meta 为元素对象的元数据; 默认允许空数组', () => {
    expect(compileField(": array[item_meta: {closed: true}, summary: 'a'] { a: string, '*'?: number }")).toEqual({
      type: 'array',
      items: {
        type: 'object',
        properties: { a: { type: 'string' }, '*': { type: 'number' } },
        required: ['a'],
        additionalProperties: false,
      },
      'x-ui': { summary: 'a' },
    });
  });

  it('数组: 类型串, 嵌套数组, 引用', () => {
    expect(
      compileField(": array[array_item: 'array', item_meta: {array_item: 'number', minItems: 2}, uniqueItems: true]")
    ).toEqual({
      type: 'array',
      items: { type: 'array', minItems: 2, items: { type: 'number' } },
      uniqueItems: true,
    });
    expect(compileField(": array[array_item: 'B', item_meta: {widget: 'card'}]", 'B: {}')).toEqual({
      type: 'array',
      items: { $ref: '#/$defs/B', 'x-ui': { widget: 'card' } },
    });
  });

  it('元组: prefixItems + items, minItems 取必填位置数, 没有 `*` 时 items: false', () => {
    expect(compileField(": array[array_item: 'tuple'] { 0(甲): number  1?: string  *: boolean }")).toEqual({
      type: 'array',
      minItems: 1,
      prefixItems: [{ title: '甲', type: 'number' }, { type: 'string' }],
      items: { type: 'boolean' },
    });
    expect(compileField(": array[array_item: 'tuple'] { 0?: number }")).toEqual({
      type: 'array',
      prefixItems: [{ type: 'number' }],
      items: false,
    });
  });

  it('map: 值对象的字段或类型串, key_meta 为 propertyNames', () => {
    expect(
      compileField(": map[key_meta: {pattern: '^[a-z]+$', minLength: 2}, maxProperties: 3] { v: number }")
    ).toEqual({
      type: 'object',
      maxProperties: 3,
      additionalProperties: { type: 'object', properties: { v: { type: 'number' } }, required: ['v'] },
      propertyNames: { type: 'string', minLength: 2, pattern: '^[a-z]+$' },
    });
    expect(compileField(": map[map_item: 'boolean']")).toEqual({
      type: 'object',
      additionalProperties: { type: 'boolean' },
    });
    expect(compileField(': map')).toEqual({ type: 'object', additionalProperties: { type: 'object' } });
  });
});

describe('union', () => {
  it('可区分联合: 分支补区分字段 const, 进入 required 首位; 引用分支用 allOf', () => {
    expect(
      compileField(": union[discriminator: 'kind'] { a(甲): { x: number }  b: B  1: {} }", 'B: { y?: string }')
    ).toEqual({
      oneOf: [
        {
          title: '甲',
          type: 'object',
          properties: { kind: { type: 'string', const: 'a' }, x: { type: 'number' } },
          required: ['kind', 'x'],
        },
        {
          type: 'object',
          allOf: [{ $ref: '#/$defs/B' }],
          properties: { kind: { type: 'string', const: 'b' } },
          required: ['kind'],
        },
        { type: 'object', properties: { kind: { type: 'integer', const: 1 } }, required: ['kind'] },
      ],
    });
  });

  it('按 JSON 类型区分: anyOf, item_meta 按名字分键; money bigint 不占 object', () => {
    expect(compileField(": union[union_item: 'number | string', item_meta: {string: {pattern: '%$'}}]")).toEqual({
      anyOf: [{ type: 'number' }, { type: 'string', pattern: '%$' }],
    });
    expect(compileField(": union[union_item: 'money|bigint|object']").anyOf).toHaveLength(3);
  });
});

describe('可空', () => {
  it('字符串, 数值, 布尔合并为 type 数组', () => {
    expect(compileField(': string[nullable: true]')).toEqual({ type: ['string', 'null'] });
    expect(compileField(': image[nullable: true]')).toEqual({
      type: ['string', 'null'],
      format: 'uri',
      'x-ui': { widget: 'image' },
    });
    expect(compileField(': boolean[nullable: true, default: null]')).toEqual({
      type: ['boolean', 'null'],
      default: null,
    });
  });

  it('其余为 anyOf, 标题说明默认值与外壳类 x-ui 在外层, 结构与组件在内层', () => {
    expect(compileField("(甲): B[nullable: true, description: '说明', hidden: true, widget: 'card']", 'B: {}')).toEqual(
      {
        title: '甲',
        description: '说明',
        anyOf: [{ $ref: '#/$defs/B', 'x-ui': { widget: 'card' } }, { type: 'null' }],
        'x-ui': { hidden: true },
      }
    );
    expect(compileField(': enum[nullable: true]{ a b }')).toEqual({
      anyOf: [{ type: 'string', enum: ['a', 'b'] }, { type: 'null' }],
    });
  });
});

describe('通用元数据', () => {
  it('说明, 默认值, 示例, 弃用, 只读只写, 错误文案, 注释, 外壳, 隐藏, props', () => {
    expect(
      compileField(
        ": string[description: '说明', default: 'a', examples: ['b'], deprecated: '改用 y', readOnly: true, writeOnly: false, errorMessage: '不对', comment: '内部', decorator: false, hidden: true, props: {rows: 3}]"
      )
    ).toEqual({
      type: 'string',
      description: '说明',
      default: 'a',
      examples: ['b'],
      deprecated: true,
      'x-deprecatedReason': '改用 y',
      readOnly: true,
      writeOnly: false,
      errorMessage: '不对',
      $comment: '内部',
      'x-ui': { decorator: false, hidden: true, props: { rows: 3 } },
    });
  });

  it('x_* 自定义键转为 x- 加驼峰; schema 原样合并', () => {
    expect(compileField(": string[x_biz_code: 1, schema: {not: {const: 'x'}}]")).toEqual({
      type: 'string',
      'x-bizCode': 1,
      not: { const: 'x' },
    });
  });

  it('条件: lodash 路径转为指针, op 映射, node_if 加 base, 字符串为 truthy', () => {
    const visible = (meta: string) => compileField(`: string[${meta}]`)['x-ui'];
    expect(visible("root_if: {left: \"$.a.b[0]['x-y']\", op: 'not_in', right: [1]}")).toEqual({
      visibleIf: { field: '/a/b/0/x-y', notIn: [1] },
    });
    expect(visible("node_if: 'list[*].on'")).toEqual({
      visibleIf: { field: '/list/*/on', base: 'node', truthy: true },
    });
    expect(visible("root_if: {not: {left: 'a', op: 'falsy'}}")).toEqual({
      visibleIf: { not: { field: '/a', truthy: false } },
    });
    expect(visible("root_if: 'a', node_if: {left: 'b', op: 'gte', right: 2}")).toEqual({
      visibleIf: {
        all: [
          { field: '/a', truthy: true },
          { field: '/b', base: 'node', gte: 2 },
        ],
      },
    });
  });

  it('场景覆盖: x-ui 字段名, 条件写 root_if / node_if', () => {
    expect(
      compileField(": [variants: {view: {widget: 'json', order: ['a'], node_if: 'a'}}] { a: string }")['x-ui']
    ).toEqual({
      variants: { view: { widget: 'json', order: ['a'], visibleIf: { field: '/a', base: 'node', truthy: true } } },
    });
  });

  it('规则表: ui 中的 root_if / node_if 同场景覆盖编译为 visibleIf, 也接受 visibleIf 原名', () => {
    const doc = compileDoc(
      "A: [rules: [{match: {type: 'string'}, ui: {node_if: 'on', widget: 'textarea'}}, {match: {enum: true}, ui: {visibleIf: {field: '/a', truthy: true}}}]] {}"
    );
    expect(doc['x-ui']).toEqual({
      version: 1,
      rules: [
        {
          match: { type: 'string' },
          ui: { widget: 'textarea', visibleIf: { field: '/on', base: 'node', truthy: true } },
        },
        { match: { enum: true }, ui: { visibleIf: { field: '/a', truthy: true } } },
      ],
    });
    expect(
      compile("A: [rules: [{match: {}, ui: {root_if: {left: 'a', op: 'like'}}}]] {}", 't.jotl').diagnostics.map(
        d => d.code
      )
    ).toEqual(['JOTL1017']);
  });
});

describe('文件与根', () => {
  it('没有条目时只有 $schema', () => {
    expect(compileDoc('// 空')).toEqual({ $schema: JSON_SCHEMA_DIALECT });
  });

  it('第一条为根; 根写入 x-ui.version, rules 与 id 写在根文档上', () => {
    expect(
      compileDoc(
        "A(甲): [id: 'https://x.dev/a.json', rules: [{match: {type: 'string'}, ui: {widget: 'textarea'}}]] {}\nB: string"
      )
    ).toEqual({
      $schema: JSON_SCHEMA_DIALECT,
      $id: 'https://x.dev/a.json',
      $ref: '#/$defs/A',
      'x-ui': { version: 1, rules: [{ match: { type: 'string' }, ui: { widget: 'textarea' } }] },
      $defs: { A: { title: '甲', type: 'object' }, B: { type: 'string' } },
    });
  });

  it('标识: <root/> 优先, 只写 <default/> 时根跟随它', () => {
    expect(compileDoc('A: string\n<default/>\nB: string').$ref).toBe('#/$defs/B');
    expect(compileDoc('A: string\n<default/> B: string\n<root/>\nC: string').$ref).toBe('#/$defs/C');
  });

  it('默认导出名不进 schema: 都不写取第一条, 只写一个时跟随它, 都写时各自生效', () => {
    const defaultExport = (text: string) => compile(text, 't.jotl').value?.defaultExport;
    expect(defaultExport('A: string\nB: string')).toBe('A');
    expect(defaultExport('A: string\n<root/>\nB: string')).toBe('B');
    expect(defaultExport('A: string\n<default/>\nB: string')).toBe('B');
    expect(defaultExport('A: string\n<default/> B: string\n<root/>\nC: string')).toBe('B');
    expect(defaultExport('// 空')).toBeUndefined();
    expect(compileDoc('A: string\n<default/> B: string\n<root/>\nC: string')).not.toHaveProperty('defaultExport');
  });

  it('扩展组件: 底层类型取自登记项, widget 为组件名', () => {
    const widgets = { ImagePicker: { type: 'string' as const, format: 'uri' } };
    expect(compileField(": ImagePicker[description: '图']", '', { widgets })).toEqual({
      type: 'string',
      format: 'uri',
      description: '图',
      'x-ui': { widget: 'ImagePicker' },
    });
  });

  it('引用类型可带不改变结构的元数据', () => {
    expect(
      compileField(
        ": B[default: {}, deprecated: true, readOnly: true, summary: 'y', root_if: 'z']",
        'B: { y?: string }'
      )
    ).toEqual({
      $ref: '#/$defs/B',
      default: {},
      deprecated: true,
      readOnly: true,
      'x-ui': { summary: 'y', visibleIf: { field: '/z', truthy: true } },
    });
  });
});
