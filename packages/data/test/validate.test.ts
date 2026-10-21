// validate 的错误转换: 中文文案与标签, "一处违反只报一条", errorMessage 两种形态, format, 编译缓存与编译失败.
import { describe, expect, it } from 'vitest';
import type { Diagnostic, JsonSchema } from '@jotl/core';
import { compileSchema } from '../src/ajv-instance.js';
import { validate } from '../src/index.js';

function errors(schema: JsonSchema, data: unknown): { code: string; pointer: string | undefined; message: string }[] {
  return validate(schema, data).diagnostics.map((d: Diagnostic) => ({
    code: d.code,
    pointer: d.location?.kind === 'pointer' ? d.location.pointer : undefined,
    message: d.message,
  }));
}

describe('中文文案与字段标签', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      name: { title: '名称', type: 'string' },
      code: { type: 'string' },
      tags: { title: '标签', type: 'array', items: { type: 'string' } },
    },
    required: ['name', 'code'],
  };

  it('有 title 用 title, 无 title 用键名', () => {
    expect(errors(schema, { name: 1, code: 2 })).toEqual([
      { code: 'JOTL4001', pointer: '/name', message: '名称 的类型应为字符串' },
      { code: 'JOTL4001', pointer: '/code', message: 'code 的类型应为字符串' },
    ]);
  });

  it('缺少必填字段指向字段本身, 文案用该字段的标签', () => {
    expect(errors(schema, { code: 'c' })).toEqual([
      { code: 'JOTL4002', pointer: '/name', message: '缺少必填字段 名称' },
    ]);
  });

  it('根节点标签为 数据', () => {
    expect(errors(schema, [])).toEqual([{ code: 'JOTL4001', pointer: '', message: '数据 的类型应为对象' }]);
  });

  it('无 title 的数组元素标签为 父标签的第 N 项', () => {
    expect(errors(schema, { name: 'n', code: 'c', tags: ['a', 1] })).toEqual([
      { code: 'JOTL4001', pointer: '/tags/1', message: '标签 的第 2 项 的类型应为字符串' },
    ]);
  });

  it('不允许的字段指向该字段', () => {
    const closed: JsonSchema = { type: 'object', properties: { a: { type: 'string' } }, additionalProperties: false };
    expect(errors(closed, { a: 'x', b: 1 })).toEqual([{ code: 'JOTL4008', pointer: '/b', message: '不允许的字段 b' }]);
  });

  it('字段名为 constructor 等原型属性时, 缺失仍报缺少必填', () => {
    const proto = JSON.parse(
      '{"type":"object","properties":{"constructor":{"type":"string"}},"required":["constructor"]}'
    ) as JsonSchema;
    expect(errors(proto, {}).map(e => [e.code, e.pointer])).toEqual([['JOTL4002', '/constructor']]);
  });
});

describe('一处违反只报一条', () => {
  it('类型不符时不再报同一节点的其他约束', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { s: { type: 'string', minLength: 5, enum: ['abcdef'] } },
    };
    expect(errors(schema, { s: 1 }).map(e => [e.code, e.pointer])).toEqual([['JOTL4001', '/s']]);
  });

  it('带标签枚举不匹配只报 JOTL4006, 不展开分支', () => {
    const schema: JsonSchema = { type: 'string', oneOf: [{ const: 'a', title: '甲' }, { const: 'b' }] };
    expect(errors(schema, 'c').map(e => [e.code, e.pointer])).toEqual([['JOTL4006', '']]);
  });

  it('anyOf 全部失败只报 JOTL4012, 分支内更深的错误也不报', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { shape: { anyOf: [{ $ref: '#/$defs/Circle' }, { $ref: '#/$defs/Square' }] } },
      $defs: {
        Circle: { type: 'object', properties: { r: { type: 'number' } }, required: ['r'] },
        Square: { type: 'object', properties: { side: { type: 'number' } }, required: ['side'] },
      },
    };
    expect(errors(schema, { shape: { r: 'x' } }).map(e => [e.code, e.pointer])).toEqual([['JOTL4012', '/shape']]);
  });

  it('同一个 $defs 在组合关键字外被引用时, 外面的错误照常报告', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        a: { anyOf: [{ $ref: '#/$defs/S' }, { type: 'null' }] },
        b: { $ref: '#/$defs/S' },
      },
      $defs: { S: { type: 'string', maxLength: 1 } },
    };
    expect(errors(schema, { a: 'xx', b: 'yy' }).map(e => [e.code, e.pointer])).toEqual([
      ['JOTL4012', '/a'],
      ['JOTL4004', '/b'],
    ]);
  });

  it('oneOf 同时符合多个分支报 JOTL4015', () => {
    const schema: JsonSchema = { oneOf: [{ type: 'number' }, { type: 'integer' }] };
    expect(errors(schema, 1).map(e => [e.code, e.pointer])).toEqual([['JOTL4015', '']]);
  });

  it('if/then 只报 then 中的具体错误', () => {
    const schema: JsonSchema = {
      type: 'object',
      if: { properties: { kind: { const: 'a' } } },
      then: { required: ['extra'] },
    };
    expect(errors(schema, { kind: 'a' }).map(e => [e.code, e.pointer])).toEqual([['JOTL4002', '/extra']]);
  });
});

describe('errorMessage(D41)', () => {
  it('字符串形态替换该节点全部错误的消息', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        code: { type: 'string', maxLength: 3, pattern: '^a', errorMessage: '请输入以 a 开头且不超过 3 字的编码' },
      },
    };
    expect(errors(schema, { code: 'bbbbb' })).toEqual([
      { code: 'JOTL4004', pointer: '/code', message: '请输入以 a 开头且不超过 3 字的编码' },
      { code: 'JOTL4005', pointer: '/code', message: '请输入以 a 开头且不超过 3 字的编码' },
    ]);
  });

  it('对象形态按关键字名替换, 其余错误保留默认文案', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        title: { title: '标题', type: 'string', maxLength: 3, pattern: '^a', errorMessage: { maxLength: '最多 3 字' } },
      },
    };
    expect(errors(schema, { title: 'bbbbb' })).toEqual([
      { code: 'JOTL4004', pointer: '/title', message: '最多 3 字' },
      { code: 'JOTL4005', pointer: '/title', message: '标题 不符合格式要求 ^a' },
    ]);
  });

  it('缺少必填字段时使用该字段自身的 errorMessage, 文案可引用 {label}', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { name: { title: '名称', type: 'string', errorMessage: { required: '请填写{label}' } } },
      required: ['name'],
    };
    expect(errors(schema, {})).toEqual([{ code: 'JOTL4002', pointer: '/name', message: '请填写名称' }]);
  });

  it('errorMessage 不改变错误代码与指针', () => {
    const schema: JsonSchema = { type: 'string', oneOf: [{ const: 'a' }], errorMessage: '只能选 a' };
    expect(errors(schema, 'b')).toEqual([{ code: 'JOTL4006', pointer: '', message: '只能选 a' }]);
  });
});

describe('format', () => {
  const schema: JsonSchema = {
    type: 'object',
    properties: {
      theme: { title: '主题色', type: 'string', format: 'color' },
      birthday: { type: 'string', format: 'date' },
    },
  };

  it('color 正例: #rgb #rgba #rrggbb #rrggbbaa', () => {
    for (const theme of ['#fff', '#ffff', '#1677ff', '#1677ff80'])
      expect(validate(schema, { theme }).value).toEqual({ valid: true });
  });

  it('color 反例', () => {
    expect(errors(schema, { theme: 'red' })).toEqual([
      { code: 'JOTL4009', pointer: '/theme', message: '主题色 不是有效的 颜色' },
    ]);
    expect(errors(schema, { theme: '#12345' }).map(e => e.code)).toEqual(['JOTL4009']);
  });

  it('date 正例', () => {
    expect(validate(schema, { birthday: '2024-02-29' }).value).toEqual({ valid: true });
  });

  it('date 反例', () => {
    expect(errors(schema, { birthday: '2023-02-29' })).toEqual([
      { code: 'JOTL4009', pointer: '/birthday', message: 'birthday 不是有效的 日期' },
    ]);
  });
});

describe('编译缓存与编译失败', () => {
  it('同一个 schema 对象只编译一次, 新对象重新编译', () => {
    const schema: JsonSchema = { type: 'string' };
    const first = compileSchema(schema);
    expect(compileSchema(schema)).toBe(first);
    expect(compileSchema({ type: 'string' })).not.toBe(first);
  });

  it('$id 相同的不同 schema 对象都能编译', () => {
    const a: JsonSchema = { $id: 'https://example.com/a', type: 'string' };
    const b: JsonSchema = { $id: 'https://example.com/a', type: 'number' };
    expect(validate(a, 'x').value).toEqual({ valid: true });
    expect(validate(b, 1).value).toEqual({ valid: true });
    expect(validate(a, 1).value).toEqual({ valid: false });
  });

  it('递归引用的 schema 编译后可重复使用', () => {
    const tree: JsonSchema = {
      $ref: '#/$defs/Node',
      $defs: { Node: { type: 'object', properties: { children: { type: 'array', items: { $ref: '#/$defs/Node' } } } } },
    };
    expect(validate(tree, { children: [{ children: [] }] }).value).toEqual({ valid: true });
    expect(errors(tree, { children: [{ children: 1 }] }).map(e => [e.code, e.pointer])).toEqual([
      ['JOTL4001', '/children/0/children'],
    ]);
  });

  it('x- 扩展关键字(自定义元数据, x-fengdie)按注解处理, 不影响校验', () => {
    const schema = { type: 'string', 'x-bizCode': 1, 'x-fengdie': { type: 'date' }, minLength: 2 } as JsonSchema;
    expect(validate(schema, 'ab').diagnostics).toEqual([]);
    expect(validate(schema, 'a').diagnostics.map(d => d.code)).not.toContain('JOTL4017');
  });

  it('未知关键字与无法解析的引用报 JOTL4017, 不抛异常', () => {
    for (const schema of [{ type: 'string', unknownKeyword: 1 }, { $ref: '#/$defs/Missing' }] as JsonSchema[]) {
      const result = validate(schema, 'x');
      expect(result.value).toBeUndefined();
      expect(result.diagnostics.map(d => d.code)).toEqual(['JOTL4017']);
    }
  });

  it('JOTL4017 主句为中文, Ajv 原文放在 related', () => {
    const [diagnostic] = validate({ type: 'strng' } as unknown as JsonSchema, 'x').diagnostics;
    expect(diagnostic?.message).toBe('schema 无法用于校验, 校验器编译失败');
    expect(diagnostic?.related).toEqual([
      { message: expect.stringContaining('schema is invalid'), location: { kind: 'pointer', pointer: '' } },
    ]);
  });

  it('x-ui, x-deprecatedReason 与 errorMessage 是已知关键字', () => {
    const schema: JsonSchema = {
      type: 'string',
      'x-ui': { widget: 'textarea' },
      'x-deprecatedReason': '旧',
      errorMessage: '错',
    };
    expect(validate(schema, 'x').value).toEqual({ valid: true });
  });

  it('$anchor 是已知关键字, #name 引用按锚点解析', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: { color: { $ref: '#color' } },
      $defs: { Color: { $anchor: 'color', type: 'string', minLength: 2 } },
    };
    expect(validate(schema, { color: 'red' }).value).toEqual({ valid: true });
    expect(errors(schema, { color: 'r' }).map(e => [e.code, e.pointer])).toEqual([['JOTL4004', '/color']]);
  });

  it('布尔 schema', () => {
    expect(validate(true, 1).value).toEqual({ valid: true });
    expect(errors(false, 1).map(e => [e.code, e.pointer])).toEqual([['JOTL4099', '']]);
  });
});
