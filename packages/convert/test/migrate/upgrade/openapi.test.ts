import { JSON_SCHEMA_DIALECT } from '@jotl/core';
import { describe, expect, it } from 'vitest';
import { upgradeSchema } from '../../../src/migrate/upgrade/index.js';
import { codes, find, pointerOf } from './helpers.js';

const OAS30 = { version: 'openapi-3.0' } as const;
const SWAGGER = { version: 'swagger-2.0' } as const;

describe('OpenAPI 3.0 Schema Object → 2020-12', () => {
  it('nullable: true 改为类型数组', () => {
    const result = upgradeSchema({ type: 'string', nullable: true }, OAS30);
    expect(result.value?.schema).toEqual({ $schema: JSON_SCHEMA_DIALECT, type: ['string', 'null'] });
    expect(pointerOf(find(result.diagnostics, 'JOTL3124'))).toBe('/nullable');
  });

  it('nullable 与 enum 同时存在时在 enum 中加入 null', () => {
    const result = upgradeSchema({ type: 'string', enum: ['a', 'b'], nullable: true }, OAS30);
    expect(result.value?.schema).toEqual({
      $schema: JSON_SCHEMA_DIALECT,
      type: ['string', 'null'],
      enum: ['a', 'b', null],
    });
    expect(codes(result.diagnostics)).toContain('JOTL3125');
  });

  it('没有 type 或为 false 的 nullable 无作用, 移除', () => {
    const result = upgradeSchema(
      { properties: { a: { nullable: true, minLength: 1 }, b: { type: 'string', nullable: false } } },
      OAS30
    );
    expect(result.value?.schema).toEqual({
      $schema: JSON_SCHEMA_DIALECT,
      properties: { a: { minLength: 1 }, b: { type: 'string' } },
    });
    expect(codes(result.diagnostics)).toEqual(expect.arrayContaining(['JOTL3126', 'JOTL3127']));
  });

  it('example 改为 examples', () => {
    const result = upgradeSchema({ type: 'integer', example: 42 }, OAS30);
    expect(result.value?.schema).toEqual({ $schema: JSON_SCHEMA_DIALECT, type: 'integer', examples: [42] });
    expect(pointerOf(find(result.diagnostics, 'JOTL3128'))).toBe('/example');
  });

  it('布尔 exclusive 边界改为数值形式', () => {
    const result = upgradeSchema({ type: 'number', maximum: 10, exclusiveMaximum: true }, OAS30);
    expect(result.value?.schema).toEqual({ $schema: JSON_SCHEMA_DIALECT, type: 'number', exclusiveMaximum: 10 });
  });

  it('format byte / binary 改为 contentEncoding / contentMediaType', () => {
    const result = upgradeSchema(
      { properties: { data: { type: 'string', format: 'byte' }, file: { type: 'string', format: 'binary' } } },
      OAS30
    );
    expect(result.value?.schema).toEqual({
      $schema: JSON_SCHEMA_DIALECT,
      properties: {
        data: { type: 'string', contentEncoding: 'base64' },
        file: { type: 'string', contentMediaType: 'application/octet-stream' },
      },
    });
  });

  it('OpenAPI 专有关键字(discriminator, xml, externalDocs)与 x-* 扩展原样保留', () => {
    const input = {
      oneOf: [{ $ref: '#/components/schemas/Cat' }],
      discriminator: { propertyName: 'kind' },
      xml: { name: 'pet' },
      externalDocs: { url: 'https://example.test' },
      'x-internal': true,
    };
    const result = upgradeSchema(input, OAS30);
    expect(result.value?.schema).toEqual({ $schema: JSON_SCHEMA_DIALECT, ...input });
    expect(codes(result.diagnostics)).not.toContain('JOTL3120');
  });

  it('$ref 旁的 nullable 在 3.0 中被忽略: 默认按冲突报错', () => {
    const result = upgradeSchema(
      { properties: { a: { $ref: '#/components/schemas/A', nullable: true, maxLength: 3 } } },
      OAS30
    );
    expect(result.value).toBeUndefined();
    expect(pointerOf(find(result.diagnostics, 'JOTL3303'))).toBe('/properties/a/$ref');
  });
});

describe('Swagger 2.0 Schema Object → 2020-12', () => {
  it('x-nullable 先改为 nullable, 再改为类型数组', () => {
    const result = upgradeSchema({ type: 'integer', 'x-nullable': true }, SWAGGER);
    expect(result.value?.schema).toEqual({ $schema: JSON_SCHEMA_DIALECT, type: ['integer', 'null'] });
    expect(codes(result.diagnostics)).toEqual(['JOTL3121', 'JOTL3124', 'JOTL3131']);
  });

  it('type: file 改为二进制字符串', () => {
    const result = upgradeSchema({ type: 'file' }, SWAGGER);
    expect(result.value?.schema).toEqual({
      $schema: JSON_SCHEMA_DIALECT,
      type: 'string',
      contentMediaType: 'application/octet-stream',
    });
  });

  it('字符串形式的 discriminator 改为对象, example 改为 examples', () => {
    const result = upgradeSchema(
      { discriminator: 'kind', required: ['kind'], properties: { kind: { type: 'string', example: 'cat' } } },
      SWAGGER
    );
    expect(result.value?.schema).toEqual({
      $schema: JSON_SCHEMA_DIALECT,
      properties: { kind: { type: 'string', examples: ['cat'] } },
      required: ['kind'],
      discriminator: { propertyName: 'kind' },
    });
  });
});

describe('OpenAPI 3.1', () => {
  it('已是 2020-12, 直接读取, 只把 $schema 换成 2020-12', () => {
    const input = {
      $schema: 'https://spec.openapis.org/oas/3.1/dialect/base',
      type: ['string', 'null'],
      examples: ['a'],
      discriminator: { propertyName: 'kind' },
    };
    const result = upgradeSchema(input);
    expect(result.value?.version).toBe('openapi-3.1');
    expect(result.value?.schema).toEqual({ ...input, $schema: JSON_SCHEMA_DIALECT });
    expect(codes(result.diagnostics)).toEqual(['JOTL3119']);
  });
});
