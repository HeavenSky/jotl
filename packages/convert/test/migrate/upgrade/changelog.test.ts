import type { Diagnostic } from '@jotl/core';
import { describe, expect, it } from 'vitest';
import { upgradeSchema } from '../../../src/migrate/upgrade/index.js';

function changelog(diagnostics: readonly Diagnostic[]): string[] {
  return diagnostics.map(d => {
    const at = d.location?.kind === 'pointer' ? d.location.pointer || '(根)' : '(无位置)';
    const related = d.related?.map(r => ` [${r.message}]`).join('') ?? '';
    return `${d.severity} ${d.code} ${at}: ${d.message}${related}`;
  });
}

describe('变更清单', () => {
  it('draft-04 全量改写: 每处一条带指针的 info', () => {
    const result = upgradeSchema({
      $schema: 'http://json-schema.org/draft-04/schema#',
      id: 'http://x.test/order.json',
      type: 'object',
      properties: {
        total: { type: 'number', minimum: 0, exclusiveMinimum: true },
        lines: {
          type: 'array',
          items: [{ $ref: '#/definitions/line' }],
          additionalItems: { $ref: '#/definitions/line' },
        },
        note: { type: 'string', maximum: 1, exclusiveMaximum: false },
      },
      definitions: { line: { id: '#line', type: 'object', required: ['sku'] } },
      dependencies: { coupon: ['total'], gift: { required: ['note'] } },
    });
    expect(result.value).toBeDefined();
    expect(result.diagnostics.every(d => d.severity === 'info' && d.location?.kind === 'pointer')).toBe(true);
    expect(changelog(result.diagnostics)).toMatchSnapshot();
  });

  it('2019-09 递归引用与元组', () => {
    const result = upgradeSchema({
      $schema: 'https://json-schema.org/draft/2019-09/schema',
      $recursiveAnchor: true,
      items: [{ $recursiveRef: '#' }],
      additionalItems: false,
      properties: { tail: { items: { type: 'string' }, additionalItems: false } },
    });
    expect(changelog(result.diagnostics)).toMatchSnapshot();
  });

  it('OpenAPI 3.0 改写', () => {
    const result = upgradeSchema(
      {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'byte', example: 'AAE=' },
          tag: { type: 'string', enum: ['a'], nullable: true },
          size: { type: 'integer', minimum: 0, exclusiveMinimum: true },
        },
      },
      { version: 'openapi-3.0' }
    );
    expect(changelog(result.diagnostics)).toMatchSnapshot();
  });

  it('宽松接受与冲突处理记为 warning', () => {
    const result = upgradeSchema(
      {
        $schema: 'http://json-schema.org/draft-07/schema#',
        $defs: { a: { type: 'string' } },
        definitions: { a: { type: 'number' } },
        properties: { x: { $ref: '#/definitions/a', minimum: 1 } },
        maximum: 3,
        exclusiveMaximum: true,
      },
      { onConflict: 'preferLatest' }
    );
    expect(changelog(result.diagnostics)).toMatchSnapshot();
  });
});
