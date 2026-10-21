import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  DEFAULT_DEFAULTS_OPTIONS,
  JSON_SCHEMA_DIALECT,
  defineDiagnostics,
  hasErrors,
  ok,
  orderKeywords,
  xUiMetaSchema,
  type Condition,
  type DataApi,
  type Diagnostic,
  type JsonSchema,
  type Result,
  type SourceMap,
  type XUi,
} from '../../src/schema/index.js';

describe('契约类型', () => {
  it('x-ui 覆盖 CT4 的全部字段', () => {
    const visibleIf: Condition = { all: [{ field: '/mode', eq: 'dark' }, { not: { field: '/tags/*', truthy: true } }] };
    const ui: XUi = {
      widget: 'banner-card',
      summary: 'title',
      thousands: true,
      props: { maxWidth: 750 },
      decorator: false,
      order: ['title'],
      groups: [{ title: '基本', fields: ['title'] }],
      layout: 'grid',
      columns: 3,
      hidden: false,
      visibleIf,
      variants: { view: { widget: 'text' } },
      rules: [{ match: { pointer: '/properties/*', enum: true }, ui: { widget: 'select' } }],
      version: 1,
    };
    const schema: JsonSchema = { type: 'string', 'x-ui': ui, errorMessage: { maxLength: '最多 20 字' } };
    expect(schema).toBeTruthy();
  });

  it('数据能力接口与默认选项', () => {
    expectTypeOf<DataApi['validate']>().returns.toEqualTypeOf<Result<{ valid: boolean }>>();
    expect(DEFAULT_DEFAULTS_OPTIONS).toEqual({
      strategy: 'explicit',
      arrayItems: 'minItems',
      oneOf: 'firstWithDefault',
      maxDepth: 3,
    });
  });

  it('源码映射以指针为键', () => {
    const map: SourceMap = new Map([
      [
        '',
        { range: { file: 'a.jotl', start: { line: 1, column: 1, offset: 0 }, end: { line: 1, column: 2, offset: 1 } } },
      ],
    ]);
    expect(map.size).toBe(1);
  });
});

describe('诊断工厂', () => {
  const make = defineDiagnostics({
    JOTL9998: { severity: 'warning', message: '字段 {name} 已废弃' },
    JOTL9999: { severity: 'error', message: '无参数' },
  } as const);

  it('按代码表填充消息与级别', () => {
    const d: Diagnostic = make('JOTL9998', { name: 'title' }, { location: { kind: 'pointer', pointer: '/title' } });
    expect(d).toEqual({
      code: 'JOTL9998',
      severity: 'warning',
      message: '字段 title 已废弃',
      location: { kind: 'pointer', pointer: '/title' },
    });
  });

  it('hasErrors 只看 error 级别', () => {
    expect(hasErrors([make('JOTL9998', { name: 'a' })])).toBe(false);
    expect(hasErrors([make('JOTL9999')])).toBe(true);
    expect(ok(1)).toEqual({ value: 1, diagnostics: [] });
  });
});

describe('orderKeywords', () => {
  it('保留自有的 __proto__ 键, 不改写原型', () => {
    const input = JSON.parse('{"type": "object", "__proto__": 1}') as JsonSchema;
    const ordered = orderKeywords(input) as Record<string, unknown>;
    expect(Object.hasOwn(ordered, '__proto__')).toBe(true);
    // oxlint-disable-next-line no-proto -- 用例专门断言自有的 __proto__ 键被保留
    expect(ordered['__proto__']).toBe(1);
    expect(Object.getPrototypeOf(ordered)).toBe(Object.prototype);
  });

  it('按规范化规则 7 排序并递归子 schema', () => {
    const ordered = orderKeywords({
      $defs: { B: { properties: { z: { maxLength: 1, type: 'string' } }, type: 'object' } },
      'x-ui': { widget: 'x' },
      default: 'a',
      zeta: 1,
      maxLength: 3,
      type: 'string',
      title: 't',
      $schema: JSON_SCHEMA_DIALECT,
    });
    expect(Object.keys(ordered as object)).toEqual([
      '$schema',
      'title',
      'type',
      'maxLength',
      'default',
      'zeta',
      'x-ui',
      '$defs',
    ]);
    const inner = (ordered as { $defs: { B: { properties: { z: object } } } }).$defs.B;
    expect(Object.keys(inner)).toEqual(['type', 'properties']);
    expect(Object.keys(inner.properties.z)).toEqual(['type', 'maxLength']);
  });
});

describe('x-ui meta-schema', () => {
  it('声明 2020-12 方言并禁止未知字段', () => {
    expect(xUiMetaSchema.$schema).toBe(JSON_SCHEMA_DIALECT);
    expect(xUiMetaSchema.additionalProperties).toBe(false);
    expect(Object.keys(xUiMetaSchema.properties ?? {})).toEqual(
      expect.arrayContaining([
        'widget',
        'layout',
        'columns',
        'visibleIf',
        'summary',
        'thousands',
        'variants',
        'rules',
        'version',
      ])
    );
  });
});
