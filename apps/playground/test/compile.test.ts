// 编译与预览的纯函数: 源码到 schema 文本, TS 文本与源码行列诊断; 以及打包进产物的示例集.
import { schemaToTs } from '@jotl/convert';
import type { JsonSchema, Result } from '@jotl/core';
import { describe, expect, it } from 'vitest';
import { isSkipped, listFixtures, readFixture, sortByKey } from '../../../test-utils/fixtures.js';
import {
  PLAYGROUND_FILE,
  allDiagnostics,
  buildPlayground,
  compileSource,
  countBySeverity,
  formatSchema,
  generateTs,
  type CompiledSchema,
} from '../src/compile.js';
import {
  DEFAULT_EXAMPLE_ID,
  EXAMPLES,
  FIXTURE_EXAMPLES,
  SHOWCASE_EXAMPLE_ID,
  WIDGET_MODULE_EXAMPLE_ID,
  defaultSource,
  findExample,
} from '../src/examples.js';

const fixtures = listFixtures().map(readFixture);

function compiled(source: string): CompiledSchema {
  const output = compileSource(source).output;
  if (output === undefined) throw new Error('期望编译成功');
  return output;
}

describe('compileSource 与 buildPlayground', () => {
  for (const fixture of fixtures.filter(f => f.hasSchema && f.source !== undefined)) {
    it(`${fixture.name}: schema 文本是两空格缩进的 schema.json, TS 与 types.d.ts 逐字相等`, () => {
      const build = buildPlayground(fixture.source!, schemaToTs);
      const output = build.report.output;
      expect(build.report.diagnostics).toEqual([]);
      expect(output?.schema).toEqual(fixture.schema);
      expect(output?.schemaText).toBe(`${JSON.stringify(output?.schema, null, 2)}\n`);
      expect(JSON.parse(output!.schemaText)).toEqual(fixture.schema);
      if (fixture.types !== undefined && !isSkipped(fixture, 'types.d.ts')) expect(build.ts?.text).toBe(fixture.types);
    });
  }

  for (const fixture of fixtures.filter(f => f.diagnostics !== undefined)) {
    it(`${fixture.name}: 无输出, 诊断换算为源码行列且与 diagnostics.json 按集合相等`, () => {
      const build = buildPlayground(fixture.source!, schemaToTs);
      expect(build.report.output).toBeUndefined();
      expect(build.ts).toBeUndefined();
      const actual = build.report.diagnostics.map(d => ({
        code: d.code,
        line: d.start?.line ?? 0,
        column: d.start?.column ?? 0,
      }));
      expect(sortByKey(actual)).toEqual(sortByKey(fixture.diagnostics!));
      expect(build.report.diagnostics.every(d => d.stage === 'compile' && d.end !== undefined)).toBe(true);
    });
  }

  it('报告携带被编译的源码, 供界面判断是否已编译到最新输入', () => {
    const source = 'A: { a: string }';
    expect(compileSource(source).source).toBe(source);
    expect(compileSource('type = ').source).toBe('type = ');
  });

  it('空源码不抛异常, 结果为成功或带诊断的失败之一', () => {
    const report = compileSource('');
    expect(report.output !== undefined || report.diagnostics.length > 0).toBe(true);
  });

  it('诊断的行列从 1 起, 列按 UTF-16 代码单元计', () => {
    const report = compileSource('A: {\n  a(名字): strng\n}');
    const d = report.diagnostics.find(x => x.severity === 'error');
    expect(d?.code).toBe('JOTL1004');
    expect(d?.start).toEqual({ line: 2, column: 10 });
    expect(d?.end).toEqual({ line: 2, column: 15 });
  });
});

describe('generateTs', () => {
  const source = 'A: {\n  name: string\n  age?: number\n}';

  it('指针定位的诊断换算到该指针在源码映射中的键名位置', () => {
    const fake = (): Result<string> => ({
      value: 'export {};\n',
      diagnostics: [
        {
          code: 'JOTL2002',
          severity: 'warning',
          message: 'm',
          location: { kind: 'pointer', pointer: '/$defs/A/properties/age' },
        },
      ],
    });
    const report = generateTs(compiled(source), fake);
    expect(report.text).toBe('export {};\n');
    expect(report.diagnostics).toEqual([
      {
        stage: 'ts',
        code: 'JOTL2002',
        severity: 'warning',
        message: 'm',
        start: { line: 3, column: 3 },
        end: { line: 3, column: 6 },
      },
    ]);
  });

  it('源码映射中没有的指针退到最近的已映射祖先', () => {
    const fake = (): Result<string> => ({
      value: '',
      diagnostics: [
        {
          code: 'JOTL2002',
          severity: 'warning',
          message: 'm',
          location: { kind: 'pointer', pointer: '/$defs/A/properties/name/maxLength' },
        },
      ],
    });
    expect(generateTs(compiled(source), fake).diagnostics[0]?.start).toEqual({ line: 2, column: 3 });
  });

  it('其他文档的指针与无位置的诊断不带行列', () => {
    const fake = (): Result<string> => ({
      value: undefined,
      diagnostics: [
        {
          code: 'JOTL2001',
          severity: 'error',
          message: 'a',
          location: { kind: 'pointer', pointer: '', document: 'other.json' },
        },
        { code: 'JOTL2001', severity: 'error', message: 'b' },
      ],
    });
    const report = generateTs(compiled(source), fake);
    expect(report.text).toBeUndefined();
    expect(report.diagnostics.map(d => d.start)).toEqual([undefined, undefined]);
  });

  it('生成器抛出异常时转为一条无代码的错误诊断', () => {
    const report = generateTs(compiled(source), (_schema: JsonSchema) => {
      throw new Error('boom');
    });
    expect(report.text).toBeUndefined();
    expect(report.diagnostics).toHaveLength(1);
    expect(report.diagnostics[0]).toMatchObject({ stage: 'ts', severity: 'error' });
    expect(report.diagnostics[0]?.code).toBeUndefined();
    expect(report.diagnostics[0]?.message).toContain('boom');
  });

  it('真实生成器的输出以生成头开始, 并包含字段', () => {
    const report = generateTs(compiled(source), schemaToTs);
    expect(report.text).toContain('name: string;');
    expect(report.text).toContain('age?: number;');
  });
});

describe('诊断汇总', () => {
  it('allDiagnostics 编译诊断在前, TS 诊断在后; countBySeverity 分别计数错误与警告', () => {
    const build = buildPlayground('A: { a: string }', () => ({
      value: '',
      diagnostics: [
        { code: 'JOTL2002', severity: 'warning', message: 'w' },
        { code: 'JOTL2002', severity: 'info', message: 'i' },
      ],
    }));
    const all = allDiagnostics(build);
    expect(all.map(d => d.stage)).toEqual(['ts', 'ts']);
    expect(countBySeverity(all)).toEqual({ errors: 0, warnings: 1 });
    expect(countBySeverity(compileSource('type = ').diagnostics).errors).toBeGreaterThan(0);
  });

  it('formatSchema 两空格缩进并以换行结尾', () => {
    expect(formatSchema({ type: 'string' })).toBe('{\n  "type": "string"\n}\n');
  });

  it('源码定位的诊断只接受 Playground 自己的文件名', () => {
    const report = compileSource('type = ');
    expect(PLAYGROUND_FILE).toBe('playground.jotl');
    expect(report.diagnostics.some(d => d.start !== undefined)).toBe(true);
  });
});

describe('示例集', () => {
  it('构建时打包了每个 fixtures 目录的 source.jotl, 内容与文件一致', () => {
    const expected = fixtures.filter(f => f.source !== undefined).map(f => ({ id: f.name, source: f.source }));
    expect(FIXTURE_EXAMPLES).toEqual(expected);
    expect(EXAMPLES.map(e => e.id)).toEqual([
      SHOWCASE_EXAMPLE_ID,
      WIDGET_MODULE_EXAMPLE_ID,
      ...expected.map(e => e.id),
    ]);
  });

  it('综合示例编译无诊断, 覆盖钻取, inline, 金额与大整数, 两种联合, 多选, 数组与字典, 条件显示', () => {
    const build = buildPlayground(findExample(SHOWCASE_EXAMPLE_ID)!.source, schemaToTs);
    expect(build.report.diagnostics).toEqual([]);
    // TS 生成会对无法表达的关键字报 JOTL2002 warning, 这是预期的信息丢失提示.
    expect(countBySeverity(allDiagnostics(build)).errors).toBe(0);
    expect(build.ts?.text).toContain('export default');
    const text = build.report.output!.schemaText;
    for (const fragment of [
      '"widget": "inline"',
      '"const": "money"',
      '"const": "bigint"',
      '"anyOf"',
      '"uniqueItems": true',
      '"additionalProperties": {',
      '"visibleIf"',
      '"base": "node"',
    ]) {
      expect(text).toContain(fragment);
    }
    expect(build.report.output!.schema.$defs?.['Block']).toHaveProperty('oneOf');
  });

  it('默认示例存在且可编译', () => {
    expect(findExample(DEFAULT_EXAMPLE_ID)).toBeDefined();
    expect(defaultSource()).toBe(findExample(DEFAULT_EXAMPLE_ID)?.source);
    expect(compileSource(defaultSource()).output).toBeDefined();
    expect(findExample('不存在')).toBeUndefined();
  });
});
