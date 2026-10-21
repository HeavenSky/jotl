// 诊断(E2): 编译器诊断到 LSP 诊断的位置与级别换算, 组件未注册警告(K3), 扩展组件登记, 快速修复.
import { describe, expect, it } from 'vitest';
import { type Diagnostic, DiagnosticSeverity } from 'vscode-languageserver';
import { readFixture } from '../../../test-utils/fixtures.js';
import { getCodeActions, getDiagnostics, readInitializationOptions } from '../src/index.js';
import { URI } from './helpers.js';

function codes(diagnostics: Diagnostic[]): string[] {
  return diagnostics.map(d => String(d.code));
}

describe('编译器诊断', () => {
  it('样例 016-errors: 代码与位置一致, 行列换算为从 0 起', () => {
    const fixture = readFixture('016-errors');
    const diagnostics = getDiagnostics(fixture.source!, URI);
    const actual = diagnostics.map(d => ({
      code: d.code,
      line: d.range.start.line + 1,
      column: d.range.start.character + 1,
    }));
    expect(actual).toEqual(expect.arrayContaining(fixture.diagnostics!));
    expect(actual).toHaveLength(fixture.diagnostics!.length);
    for (const d of diagnostics) {
      expect(d.source).toBe('jotl');
      expect(d.message).not.toBe('');
    }
  });

  it('范围覆盖出错的记号', () => {
    const [diagnostic] = getDiagnostics('A: {\n  name: strng\n}', URI);
    expect(diagnostic!.range).toEqual({ start: { line: 1, character: 8 }, end: { line: 1, character: 13 } });
    expect(diagnostic!.code).toBe('JOTL1004');
  });

  it('列按 UTF-16 代码单元计', () => {
    const text = "A: {\n  '名字😀': strng\n}";
    const [diagnostic] = getDiagnostics(text, URI);
    const line = text.split('\n')[1]!;
    expect(diagnostic!.range.start).toEqual({ line: 1, character: line.indexOf('strng') });
  });

  it('CRLF 换行', () => {
    const [diagnostic] = getDiagnostics('A: {\r\n  a: strng\r\n}', URI);
    expect(diagnostic!.range.start).toEqual({ line: 1, character: 5 });
  });

  it('warning 级诊断映射为 Warning', () => {
    const diagnostics = getDiagnostics("A: { a: string[widget: 'switch'] }", URI);
    expect(diagnostics.map(d => [d.code, d.severity])).toEqual([['JOTL1045', DiagnosticSeverity.Warning]]);
  });

  it('没有问题的源码不报诊断', () => {
    expect(getDiagnostics("A: { a: string[widget: 'textarea'] }", URI)).toEqual([]);
  });

  it('不完整源码(正在输入)仍给出诊断而不抛异常', () => {
    for (const text of ['A:', 'A: {', 'A: { a: string[', "A: { a: string[widget: '", '<ro']) {
      expect(getDiagnostics(text, URI).length, text).toBeGreaterThan(0);
    }
  });
});

describe('组件未注册警告(JOTL7001)', () => {
  it('未注册的组件名报 warning, 范围为组件名字符串', () => {
    const diagnostics = getDiagnostics("A: {\n  a: string[widget: 'fancy']\n}", URI);
    expect(diagnostics).toEqual([
      {
        range: { start: { line: 1, character: 20 }, end: { line: 1, character: 27 } },
        severity: DiagnosticSeverity.Warning,
        code: 'JOTL7001',
        source: 'jotl',
        message: 'widget `fancy` 未注册, 渲染时将降级',
      },
    ]);
  });

  it('内置组件不报警告', () => {
    expect(getDiagnostics("A: { a: string[widget: 'textarea', decorator: 'field'] }", URI)).toEqual([]);
  });

  it('根元数据 `widgets` 声明的名字不报警告', () => {
    const text = "A: object[widgets: {rating: {module: 'https://y'}}] {\n  a: string[widget: 'rating']\n}";
    expect(getDiagnostics(text, URI)).toEqual([]);
  });

  it('额外注册的组件名不报警告', () => {
    const text = "A: { a: string[widget: 'fancy', decorator: 'card'] }";
    expect(codes(getDiagnostics(text, URI))).toEqual(['JOTL7001', 'JOTL7001']);
    expect(getDiagnostics(text, URI, { registeredWidgets: ['fancy', 'card'] })).toEqual([]);
  });

  it('覆盖顶层类型, 嵌套字段与 union 分支上的元数据', () => {
    const text = [
      "A: [widget: 'w1'] {",
      "  a: { b: string[widget: 'w2'] }",
      "  c: union[discriminator: 'k'] { x: { d: number[widget: 'w3'] } }",
      '}',
    ].join('\n');
    const messages = getDiagnostics(text, URI).map(d => d.message);
    expect(messages).toEqual(['w1', 'w2', 'w3'].map(w => `widget \`${w}\` 未注册, 渲染时将降级`));
  });

  it('覆盖 variants 各场景中的组件名', () => {
    const text = "A: string[variants: { mobile: { widget: 'w1', decorator: 'card' }, print: { widget: 'textarea' } }]";
    const messages = getDiagnostics(text, URI).map(d => d.message);
    expect(messages).toEqual(['w1', 'card'].map(w => `widget \`${w}\` 未注册, 渲染时将降级`));
    expect(getDiagnostics(text, URI, { registeredWidgets: ['w1', 'card'] })).toEqual([]);
  });

  it('覆盖 item_meta: 直接写的元数据与按名字分键, 逐层递归', () => {
    const fixture = readFixture('013-x-ui-basic');
    const widgets = getDiagnostics(fixture.source!, URI).map(d => String(d.message).match(/`(.+)`/)?.[1]);
    expect(widgets).toEqual(expect.arrayContaining(['tag', 'slider', 'row']));
    const text = [
      'A: {',
      "  a: array[array_item: 'array', item_meta: {array_item: 'string', item_meta: {widget: 'w1'}, decorator: 'w2'}]",
      "  b: union[union_item: 'number|string', item_meta: {string: {widget: 'w3'}, number: {variants: {m: {widget: 'w4'}}}}]",
      "  c: array[item_meta: {widget: 'w5'}] { x: string }",
      "  d: array[array_item: 'string', item_meta: {props: {widget: 'nope'}}]",
      '}',
    ].join('\n');
    const messages = getDiagnostics(text, URI)
      .filter(d => d.code === 'JOTL7001')
      .map(d => String(d.message).match(/`(.+)`/)?.[1]);
    expect(messages).toEqual(['w1', 'w2', 'w3', 'w4', 'w5']);
  });

  it('与编译器诊断一起按位置排序', () => {
    const text = "A: {\n  a: strng\n  b: string[widget: 'fancy']\n  c: Missing\n}";
    expect(codes(getDiagnostics(text, URI))).toEqual(['JOTL1004', 'JOTL7001', 'JOTL1006']);
  });

  it('取值不合法时只由编译器报错', () => {
    expect(codes(getDiagnostics('A: string[widget: 1]', URI))).not.toContain('JOTL7001');
    expect(codes(getDiagnostics('A: string[decorator: false]', URI))).toEqual([]);
    expect(codes(getDiagnostics("A: string[widget: '']", URI))).not.toContain('JOTL7001');
  });

  it('语法错误下仍检查已解析出的元数据', () => {
    expect(codes(getDiagnostics("A: {\n  a: string[widget: 'fancy']\n  b: string[", URI))).toContain('JOTL7001');
  });
});

describe('扩展组件登记', () => {
  it('大驼峰的已登记名作为扩展组件传给编译器, 底层按 string 编译', () => {
    const text = 'A: { a: ImagePicker }';
    expect(codes(getDiagnostics(text, URI))).toEqual(['JOTL1006']);
    expect(getDiagnostics(text, URI, { registeredWidgets: ['ImagePicker'] })).toEqual([]);
  });

  it('与扩展组件重名的类型名报错', () => {
    expect(codes(getDiagnostics('ImagePicker: string', URI, { registeredWidgets: ['ImagePicker'] }))).toEqual([
      'JOTL1028',
    ]);
  });
});

describe('快速修复', () => {
  it('顶层的小写条目: 包进 Root 并标 <root/>', () => {
    const text = 'title: string\ncount: integer';
    const actions = getCodeActions(text, URI, { start: { line: 0, character: 1 }, end: { line: 0, character: 1 } });
    expect(actions).toHaveLength(1);
    const [action] = actions;
    expect(action!.kind).toBe('quickfix');
    expect(action!.title).toBe('包进 `Root(根): {...}` 并标 `<root/>`');
    expect(action!.isPreferred).toBe(true);
    expect(action!.diagnostics?.map(d => d.code)).toEqual(['JOTL1036']);
    const edits = action!.edit!.changes![URI]!;
    expect(edits.map(e => e.newText).join('')).toContain('Root(根): {');
  });

  it('包进 Root 时每行缩进两格, 保留相对缩进, 空行不加空白', () => {
    const text = 'title: string\n\nmeta: {\n  a: string\n}\nB: string';
    const [action] = getCodeActions(text, URI, { start: { line: 0, character: 1 }, end: { line: 0, character: 1 } });
    expect(action!.edit!.changes![URI]).toEqual([
      {
        range: { start: { line: 0, character: 0 }, end: { line: 4, character: 1 } },
        newText: '<root/>\nRoot(根): {\n  title: string\n\n  meta: {\n    a: string\n  }\n}',
      },
    ]);
  });

  it('未知转义: 改为 `\\\\`', () => {
    const text = "A: string[pattern: '\\d']";
    const actions = getCodeActions(text, URI, { start: { line: 0, character: 20 }, end: { line: 0, character: 20 } });
    expect(actions.map(a => a.title)).toEqual(['改为 `\\\\`']);
    expect(actions[0]!.edit!.changes![URI]).toEqual([
      { range: { start: { line: 0, character: 20 }, end: { line: 0, character: 21 } }, newText: '\\\\' },
    ]);
  });

  it('请求范围不与诊断相交时没有 code action', () => {
    expect(
      getCodeActions('A: string\nb: string', URI, { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } })
    ).toEqual([]);
  });

  it('没有 fixes 的诊断不产生 code action', () => {
    expect(
      getCodeActions('A: strng', URI, { start: { line: 0, character: 0 }, end: { line: 0, character: 8 } })
    ).toEqual([]);
  });
});

describe('初始化选项', () => {
  it('读取 registeredWidgets, 忽略非字符串与空串并去重', () => {
    expect(readInitializationOptions({ registeredWidgets: ['a', 1, '', 'a', 'b'] })).toEqual({
      registeredWidgets: ['a', 'b'],
    });
  });

  it.each([undefined, null, 'x', [], { registeredWidgets: 'a' }])('不合法的取值 %j 视为没有选项', raw => {
    expect(readInitializationOptions(raw)).toEqual({});
  });
});
