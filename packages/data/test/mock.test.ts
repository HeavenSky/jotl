// mock: 按 seed 可复现, 结果通过 validate, 无法满足的约束给出 warning.
import { describe, expect, it } from 'vitest';
import type { JsonSchema } from '@jotl/core';
import { listFixtures, readFixture } from '../../../test-utils/fixtures.js';
import { mock, validate } from '../src/index.js';

const SEEDS = [1, 2, 3, 42, 2026];

const rich: JsonSchema = {
  $ref: '#/$defs/Root',
  $defs: {
    Root: {
      type: 'object',
      properties: {
        code: { type: 'string', pattern: '^[A-Z]{2}-\\d{3}(?:-[a-z]+)?$' },
        phone: { type: 'string', pattern: '^1[3-9]\\d{9}$' },
        name: { type: 'string', minLength: 2, maxLength: 4 },
        price: { type: 'number', exclusiveMinimum: 0, maximum: 10, multipleOf: 0.5 },
        count: { type: 'integer', minimum: 1, maximum: 3 },
        ratio: { type: 'number', exclusiveMinimum: 0, exclusiveMaximum: 1 },
        when: { type: 'string', format: 'date-time' },
        day: { type: 'string', format: 'date' },
        alarm: { type: 'string', format: 'time' },
        theme: { type: 'string', format: 'color' },
        id: { type: 'string', format: 'uuid' },
        site: { type: 'string', format: 'uri' },
        mail: { type: 'string', format: 'email' },
        colors: {
          type: 'array',
          items: { type: 'string', enum: ['r', 'g', 'b'] },
          uniqueItems: true,
          minItems: 2,
          maxItems: 3,
        },
        tree: { $ref: '#/$defs/Node' },
        dict: { type: 'object', additionalProperties: { type: 'integer' }, minProperties: 1 },
        pair: { type: 'array', prefixItems: [{ type: 'string' }, { type: 'boolean' }], items: false, minItems: 2 },
        union: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        nullable: { type: ['string', 'null'] },
        level: { type: 'integer', oneOf: [{ const: 1 }, { const: 2 }] },
      },
      required: ['code', 'phone', 'name', 'price', 'count', 'tree', 'dict', 'pair', 'colors', 'level'],
    },
    Node: {
      type: 'object',
      properties: { label: { type: 'string' }, children: { type: 'array', items: { $ref: '#/$defs/Node' } } },
      required: ['label', 'children'],
    },
  },
};

describe('mock', () => {
  it('同一 seed 结果相同', () => {
    for (const seed of SEEDS) expect(mock(rich, { seed }).value).toEqual(mock(rich, { seed }).value);
  });

  it('不同 seed 结果不同', () => {
    expect(mock(rich, { seed: 1 }).value).not.toEqual(mock(rich, { seed: 2 }).value);
  });

  it('复杂 schema 的结果通过校验', () => {
    for (const seed of SEEDS) {
      const result = mock(rich, { seed });
      expect(result.diagnostics).toEqual([]);
      expect(validate(rich, result.value).value).toEqual({ valid: true });
    }
  });

  it('无限必填的递归引用在深度上限处停止, 给出 JOTL4019 与校验失败的 warning', () => {
    const chain: JsonSchema = {
      $ref: '#/$defs/Node',
      $defs: { Node: { type: 'object', properties: { next: { $ref: '#/$defs/Node' } }, required: ['next'] } },
    };
    const result = mock(chain, { seed: 7 });
    expect(result.value).toBeDefined();
    expect(result.diagnostics.every(d => d.severity === 'warning')).toBe(true);
    expect(result.diagnostics.map(d => d.code)).toEqual(['JOTL4019', 'JOTL4002']);
  });

  it('可选的递归引用不展开到上限, 无 warning', () => {
    const tree: JsonSchema = {
      $ref: '#/$defs/Node',
      $defs: { Node: { type: 'object', properties: { child: { $ref: '#/$defs/Node' } } } },
    };
    for (const seed of SEEDS) {
      const result = mock(tree, { seed });
      expect(result.diagnostics).toEqual([]);
      expect(validate(tree, result.value).value).toEqual({ valid: true });
    }
  });

  for (const name of listFixtures()) {
    const fixture = readFixture(name);
    if (!fixture.hasSchema) continue;
    it(`${name} 的结果通过校验`, () => {
      for (const seed of SEEDS) {
        const result = mock(fixture.schema as JsonSchema, { seed });
        expect(result.diagnostics).toEqual([]);
        expect(validate(fixture.schema as JsonSchema, result.value).value).toEqual({ valid: true });
      }
    });
  }

  it('无法生成的 pattern 给出 JOTL4019 warning, 并附带校验失败的 warning', () => {
    const schema: JsonSchema = { type: 'string', pattern: '^(?=x)y$' };
    const result = mock(schema, { seed: 1 });
    expect(result.diagnostics.map(d => [d.code, d.severity])).toEqual([
      ['JOTL4019', 'warning'],
      ['JOTL4005', 'warning'],
    ]);
  });

  it('非法 seed 报 JOTL4018', () => {
    const result = mock({ type: 'string' }, { seed: Number.NaN });
    expect(result.value).toBeUndefined();
    expect(result.diagnostics.map(d => d.code)).toEqual(['JOTL4018']);
  });
});
