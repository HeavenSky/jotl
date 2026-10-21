// getDefaults 按默认数据口径表逐格验收, 以及 fillDefaults 不覆盖已有值并返回补齐的指针.
import { describe, expect, it } from 'vitest';
import type { JsonSchema } from '@jotl/core';
import { fillDefaults, getDefaults } from '../src/index.js';

const page: JsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', default: '首页' },
    subtitle: { type: 'string' },
    count: { type: 'integer', minimum: 2 },
    ratio: { type: 'number' },
    enabled: { type: 'boolean' },
    nothing: { type: 'null' },
    mode: { type: 'string', enum: ['light', 'dark'] },
    level: { type: 'integer', oneOf: [{ const: 1, title: '一级' }, { const: 2 }] },
    kind: { type: 'string', const: 'banner' },
    seo: { type: 'object', properties: { robots: { type: 'string' } }, required: ['robots'] },
    extra: { type: 'object', properties: { note: { type: 'string' } } },
    tags: { type: 'array', minItems: 2, items: { type: 'string' } },
  },
  required: ['title', 'subtitle', 'count', 'enabled', 'mode', 'level', 'kind', 'seo', 'tags'],
};

describe('口径表: 节点有 default', () => {
  for (const strategy of ['explicit', 'required', 'all'] as const) {
    it(`${strategy}: 取 default`, () => {
      const schema: JsonSchema = { type: 'object', properties: { a: { type: 'object', default: { x: 1 } } } };
      expect(getDefaults(schema, { strategy }).value).toEqual({ a: { x: 1 } });
    });
  }

  it('default 是拷贝, 修改结果不影响 schema', () => {
    const schema = { type: 'object', default: { x: [1] } } as const;
    const value = getDefaults(schema as unknown as JsonSchema).value as { x: number[] };
    value.x.push(2);
    expect(schema.default.x).toEqual([1]);
  });
});

describe('口径表: 对象无 default', () => {
  it('explicit: 只含能产出值的属性', () => {
    expect(getDefaults(page).value).toEqual({ title: '首页' });
  });

  it('explicit: 一个都没有时根为 {}', () => {
    expect(getDefaults({ type: 'object', properties: { a: { type: 'string' } } }).value).toEqual({});
  });

  it('explicit: 一个都没有时非根省略', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        inner: { type: 'object', properties: { a: { type: 'string' } } },
        b: { type: 'string', default: 'b' },
      },
    };
    expect(getDefaults(schema).value).toEqual({ b: 'b' });
  });

  it('required: 必填属性递归产出, 可选属性只取显式默认值', () => {
    expect(getDefaults(page, { strategy: 'required' }).value).toEqual({
      title: '首页',
      subtitle: '',
      count: 2,
      enabled: false,
      mode: 'light',
      level: 1,
      kind: 'banner',
      seo: { robots: '' },
      tags: ['', ''],
    });
  });

  it('required: 可选对象因显式默认值出现时, 它的必填字段也补零值', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        opt: {
          type: 'object',
          properties: { a: { type: 'string', default: 'x' }, b: { type: 'integer' } },
          required: ['b'],
        },
      },
    };
    expect(getDefaults(schema, { strategy: 'required' }).value).toEqual({ opt: { a: 'x', b: 0 } });
  });

  it('required: 至少为 {}', () => {
    const schema: JsonSchema = { type: 'object', properties: { box: { type: 'object' } }, required: ['box'] };
    expect(getDefaults(schema, { strategy: 'required' }).value).toEqual({ box: {} });
  });

  it('all: 全部属性递归产出', () => {
    expect(getDefaults(page, { strategy: 'all' }).value).toEqual({
      title: '首页',
      subtitle: '',
      count: 2,
      ratio: 0,
      enabled: false,
      nothing: null,
      mode: 'light',
      level: 1,
      kind: 'banner',
      seo: { robots: '' },
      extra: { note: '' },
      tags: ['', ''],
    });
  });
});

describe('口径表: 数组无 default', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      list: {
        type: 'array',
        minItems: 2,
        items: {
          type: 'object',
          properties: { name: { type: 'string', default: 'n' }, id: { type: 'integer' } },
          required: ['id'],
        },
      },
      any: { type: 'array', minItems: 1, items: {} },
    },
    required: ['list', 'any'],
  };

  it('explicit: 省略(即使元素有默认值)', () => {
    expect(getDefaults(schema).value).toEqual({});
  });

  it('required: 生成 minItems 个元素, 元素按同一策略; 元素无值时用零值', () => {
    expect(getDefaults(schema, { strategy: 'required' }).value).toEqual({
      list: [
        { name: 'n', id: 0 },
        { name: 'n', id: 0 },
      ],
      any: [null],
    });
  });

  it('all: 同 required, 可选数组也生成', () => {
    const optional: JsonSchema = {
      type: 'object',
      properties: { xs: { type: 'array', minItems: 1, items: { type: 'boolean' } } },
    };
    expect(getDefaults(optional, { strategy: 'all' }).value).toEqual({ xs: [false] });
    expect(getDefaults(optional, { strategy: 'required' }).value).toEqual({});
  });

  it('arrayItems none: 生成空数组', () => {
    expect(getDefaults(schema, { strategy: 'required', arrayItems: 'none' }).value).toEqual({ list: [], any: [] });
  });
});

describe('口径表: 标量无 default', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: { a: { type: 'string' }, b: { type: 'string' } },
    required: ['a'],
  };

  it('explicit: 省略', () => {
    expect(getDefaults(schema).value).toEqual({});
  });

  it('required: 必填时用零值', () => {
    expect(getDefaults(schema, { strategy: 'required' }).value).toEqual({ a: '' });
  });

  it('all: 用零值', () => {
    expect(getDefaults(schema, { strategy: 'all' }).value).toEqual({ a: '', b: '' });
  });
});

describe('口径表: 零值', () => {
  const cases: [string, JsonSchema, unknown][] = [
    ['string', { type: 'string' }, ''],
    ['number 有 minimum', { type: 'number', minimum: 1.5 }, 1.5],
    ['number 无 minimum', { type: 'number' }, 0],
    ['integer', { type: 'integer' }, 0],
    ['boolean', { type: 'boolean' }, false],
    ['null', { type: 'null' }, null],
    ['枚举取第一个值', { type: 'string', enum: ['b', 'a'] }, 'b'],
    ['带标签枚举取第一个值', { type: 'string', oneOf: [{ const: 'x' }, { const: 'y' }] }, 'x'],
    ['const 取其值', { type: 'integer', const: 7 }, 7],
    ['可空类型取第一个类型', { type: ['string', 'null'] }, ''],
  ];
  for (const strategy of ['required', 'all'] as const) {
    for (const [name, field, expected] of cases) {
      it(`${strategy}: ${name}`, () => {
        const schema: JsonSchema = { type: 'object', properties: { f: field }, required: ['f'] };
        expect(getDefaults(schema, { strategy }).value).toEqual({ f: expected });
      });
    }
  }
});

describe('选项 oneOf', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      shape: { oneOf: [{ type: 'string' }, { type: 'number', default: 5 }] },
    },
    required: ['shape'],
  };

  it('firstWithDefault(默认): 取第一个有默认值的分支', () => {
    expect(getDefaults(schema).value).toEqual({ shape: 5 });
    expect(getDefaults(schema, { strategy: 'required' }).value).toEqual({ shape: 5 });
  });

  it('first: 取第一个分支', () => {
    expect(getDefaults(schema, { oneOf: 'first' }).value).toEqual({});
    expect(getDefaults(schema, { oneOf: 'first', strategy: 'required' }).value).toEqual({ shape: '' });
  });

  it('没有分支有默认值时取第一个分支', () => {
    const plain: JsonSchema = {
      type: 'object',
      properties: { v: { anyOf: [{ type: 'boolean' }, { type: 'string' }] } },
      required: ['v'],
    };
    expect(getDefaults(plain, { strategy: 'required' }).value).toEqual({ v: false });
  });
});

describe('选项 maxDepth 与 $ref 递归', () => {
  const tree: JsonSchema = {
    $ref: '#/$defs/Node',
    $defs: {
      Node: {
        type: 'object',
        properties: { name: { type: 'string', default: 'n' }, child: { $ref: '#/$defs/Node' } },
        required: ['name', 'child'],
      },
    },
  };

  it('默认 maxDepth 3: 同一引用在路径上展开 3 次后停止', () => {
    expect(getDefaults(tree).value).toEqual({ name: 'n', child: { name: 'n', child: { name: 'n' } } });
  });

  it('maxDepth 1: 只展开一次', () => {
    expect(getDefaults(tree, { maxDepth: 1, strategy: 'all' }).value).toEqual({ name: 'n' });
  });

  it('引用的目标有 default 时取该 default', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { theme: { $ref: '#/$defs/Theme' } },
      $defs: { Theme: { type: 'string', default: '#000' } },
    };
    expect(getDefaults(schema).value).toEqual({ theme: '#000' });
  });

  it('$anchor 引用', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { a: { $ref: '#color' } },
      $defs: { C: { $anchor: 'color', type: 'string', default: '#fff' } },
    };
    expect(getDefaults(schema).value).toEqual({ a: '#fff' });
  });

  it('allOf 合并各分支的属性', () => {
    const schema: JsonSchema = {
      allOf: [
        { type: 'object', properties: { a: { type: 'string', default: 'a' } } },
        { properties: { b: { type: 'number', default: 1 } } },
      ],
    };
    expect(getDefaults(schema).value).toEqual({ a: 'a', b: 1 });
  });
});

describe('输入错误', () => {
  it('无法解析的引用报 JOTL4016 warning, 节点按无值处理', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { a: { $ref: '#/$defs/Missing' }, b: { type: 'string', default: 'b' } },
    };
    const result = getDefaults(schema);
    expect(result.value).toEqual({ b: 'b' });
    expect(result.diagnostics.map(d => [d.code, d.severity])).toEqual([['JOTL4016', 'warning']]);
  });

  it('非法选项报 JOTL4018, 不抛异常', () => {
    const result = getDefaults({ type: 'string' }, { maxDepth: -1, strategy: 'bogus' as never });
    expect(result.value).toBeUndefined();
    expect(result.diagnostics.map(d => d.code)).toEqual(['JOTL4018', 'JOTL4018']);
  });
});

describe('fillDefaults', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      title: { type: 'string', default: '首页' },
      meta: {
        type: 'object',
        properties: { robots: { type: 'string', default: 'index' }, author: { type: 'string' } },
      },
      items: {
        type: 'array',
        items: { type: 'object', properties: { alt: { type: 'string', default: '' }, src: { type: 'string' } } },
      },
      count: { type: 'integer' },
    },
    required: ['count'],
  };

  it('不覆盖已有值, 返回补齐的指针', () => {
    const data = { title: '自定义', meta: { author: 'me' }, items: [{ src: 'a' }, { alt: 'b' }] };
    const result = fillDefaults(schema, data);
    expect(result.diagnostics).toEqual([]);
    expect(result.value).toEqual({
      data: { title: '自定义', meta: { author: 'me', robots: 'index' }, items: [{ src: 'a', alt: '' }, { alt: 'b' }] },
      filled: ['/meta/robots', '/items/0/alt'],
    });
  });

  it('不修改传入的数据', () => {
    const data = { meta: {} };
    fillDefaults(schema, data);
    expect(data).toEqual({ meta: {} });
  });

  it('缺失的整棵子树按策略产出, 只记子树根的指针', () => {
    const result = fillDefaults(schema, {});
    expect(result.value).toEqual({ data: { title: '首页', meta: { robots: 'index' } }, filled: ['/title', '/meta'] });
  });

  it('按 required 策略补必填字段的零值', () => {
    const result = fillDefaults(schema, { title: 't' }, { strategy: 'required' });
    expect(result.value).toEqual({
      data: { title: 't', meta: { robots: 'index' }, count: 0 },
      filled: ['/meta', '/count'],
    });
  });

  it('数据为 undefined 时等同 getDefaults, 指针为根', () => {
    expect(fillDefaults(schema, undefined).value).toEqual({ data: getDefaults(schema).value, filled: [''] });
  });

  it('联合类型按数据匹配分支补齐', () => {
    const union: JsonSchema = {
      anyOf: [
        {
          type: 'object',
          properties: { r: { type: 'number' }, unit: { type: 'string', default: 'px' } },
          required: ['r'],
        },
        { type: 'object', properties: { side: { type: 'number' }, color: { type: 'string', default: 'red' } } },
      ],
    };
    expect(fillDefaults(union, { side: 1 }).value).toEqual({ data: { side: 1, color: 'red' }, filled: ['/color'] });
  });

  it('字段名为 __proto__ 时写成自有属性', () => {
    const proto: JsonSchema = { type: 'object', properties: { ['__proto__']: { type: 'string', default: 'x' } } };
    const result = fillDefaults(proto, JSON.parse('{}'));
    const value = (result.value as { data: Record<string, unknown> }).data;
    expect(Object.hasOwn(value, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
  });
});
