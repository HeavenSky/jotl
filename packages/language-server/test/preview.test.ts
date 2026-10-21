// 预览内容(E6): schema 与 TS 文本与编译, 转换结果一致, 诊断带 1 起的位置, 有错误时没有 schema 与 TS, 组件注册选项生效.
import { compile } from '@jotl/core';
import { schemaToTs } from '@jotl/convert';
import { describe, expect, it } from 'vitest';
import { listFixtures, readFixture } from '../../../test-utils/fixtures.js';
import { getPreview } from '../src/index.js';
import { URI } from './helpers.js';

describe('预览内容', () => {
  it('合法源码: schema 为两空格缩进的编译结果, 无诊断', () => {
    const text = "A: {\n  title: string[maxLength: 5, default: 'hi']\n}";
    const preview = getPreview(text, URI);
    expect(preview.uri).toBe(URI);
    expect(preview.diagnostics).toEqual([]);
    expect(preview.schema).toBe(JSON.stringify(compile(text, URI).value!.schema, null, 2));
    expect(preview.schema).toContain('\n  "$ref": "#/$defs/A"');
  });

  it('合法源码: TS 为 schemaToTs 的产物', () => {
    const text = 'A: {\n  title: string\n}';
    const preview = getPreview(text, URI);
    expect(preview.typescript).toBe(schemaToTs(compile(text, URI).value!.schema).value);
    expect(preview.typescript).toContain('export interface A {');
    expect(preview.typescriptDiagnostics).toEqual([]);
  });

  it('TS 转换的诊断带指针, 并经 SourceMap 换算到源码位置', () => {
    const text =
      "A: [id: 'https://example.com/a.json', schema: {not: {type: 'null'}}] {\n  a: string[schema: {not: {type: 'number'}}]\n}";
    const preview = getPreview(text, URI);
    expect(preview.typescript).toContain('@id https://example.com/a.json');
    const byPointer = new Map(preview.typescriptDiagnostics.map(d => [d.pointer, d]));
    // 根 $id 写成 @id, 不再告警; 根条目上的关键字映射到根条目.
    expect(byPointer.has('')).toBe(false);
    expect(byPointer.get('/$defs/A')).toMatchObject({ severity: 'warning', code: 'JOTL2002', line: 1, column: 1 });
    const field = preview.typescriptDiagnostics.find(d => d.pointer?.startsWith('/$defs/A/properties/a'));
    expect(field).toMatchObject({ severity: 'warning', code: 'JOTL2002', line: 2, column: 3 });
  });

  it('有错误时 schema 为 undefined, 诊断按位置排列且行列从 1 起', () => {
    const preview = getPreview('A: {\n  a: strng\n  b: string[minimum: 1]\n}', URI);
    expect(preview.schema).toBeUndefined();
    expect(preview.typescript).toBeUndefined();
    expect(preview.typescriptDiagnostics).toEqual([]);
    expect(preview.diagnostics.every(d => d.pointer === undefined)).toBe(true);
    expect(preview.diagnostics.map(d => [d.severity, d.code, d.line, d.column])).toEqual([
      ['error', 'JOTL1004', 2, 6],
      ['error', 'JOTL1007', 3, 13],
    ]);
    expect(preview.diagnostics.every(d => d.message !== '')).toBe(true);
  });

  it('只有警告时仍给出 schema; 已注册组件不报警告', () => {
    const text = "A: { a: string[widget: 'fancy'] }";
    const warned = getPreview(text, URI);
    expect(warned.schema).toBeDefined();
    expect(warned.diagnostics.map(d => [d.severity, d.code])).toEqual([['warning', 'JOTL7001']]);
    expect(getPreview(text, URI, { registeredWidgets: ['fancy'] }).diagnostics).toEqual([]);
  });

  it('带上所属配置文件的路径与模块声明; 没有配置时为空', () => {
    expect(getPreview('A: string', URI)).toMatchObject({ configFile: undefined, modules: {} });
    const modules = { Rating: { module: './w/rating.js', export: 'Rating' } };
    expect(getPreview('A: string[', URI, {}, { file: '/w/jotl.config.json', modules })).toMatchObject({
      schema: undefined,
      configFile: '/w/jotl.config.json',
      modules,
    });
  });

  it('空文档给出只含 $schema 的根', () => {
    expect(JSON.parse(getPreview('', URI).schema!)).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
    });
  });

  it('共享样例: 有期望 schema 与 TS 的样例, 预览的 schema 与之深度相等, TS 逐字相等', () => {
    for (const name of listFixtures()) {
      const fixture = readFixture(name);
      if (fixture.source === undefined || !fixture.hasSchema || fixture.diagnostics) continue;
      const preview = getPreview(fixture.source, `file:///fixtures/${name}/source.jotl`);
      expect(JSON.parse(preview.schema ?? 'null'), name).toEqual(fixture.schema);
      if (fixture.types !== undefined) expect(preview.typescript, name).toBe(fixture.types);
    }
  });
});
