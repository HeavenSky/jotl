// 预览面板的纯函数: HTML 外壳的 CSP, 样式引入与转义, 消息校验, 视图模型, 以及与语言服务预览内容的衔接.
import {
  getPreview,
  PREVIEW_CONFIG_CHANGED_METHOD as LSP_PREVIEW_CONFIG_CHANGED_METHOD,
  PREVIEW_REQUEST_METHOD as LSP_PREVIEW_REQUEST_METHOD,
} from '@jotl/language-server';
import { describe, expect, it } from 'vitest';
import { createNonce, renderPreviewHtml } from '../src/preview-html.js';
import { schemaModuleRefs, widgetModuleRefs } from '../src/preview-modules.js';
import {
  isFromWebview,
  isToWebview,
  PREVIEW_CONFIG_CHANGED_METHOD,
  PREVIEW_REQUEST_METHOD,
  type ToWebview,
} from '../src/preview-protocol.js';
import { describePreview, isPreviewTab, PREVIEW_TABS, previewLocale } from '../src/preview-view.js';
import { ZH_TEXT } from './zh-text.js';

const CSP_SOURCE = 'https://*.vscode-cdn.net';

function csp(html: string): Map<string, string> {
  const content = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1];
  if (content === undefined) throw new Error('缺少 CSP');
  return new Map(
    content.split(';').map(part => {
      const [name, ...values] = part.trim().split(/\s+/);
      return [name!, values.join(' ')];
    })
  );
}

describe('预览 HTML 外壳', () => {
  const html = renderPreviewHtml({
    cspSource: CSP_SOURCE,
    nonce: 'abc123',
    scriptUri: 'https://file+.vscode-resource/dist/preview.js',
    formStyleUri: 'https://file+.vscode-resource/dist/preview-form.css',
    title: '预览 a.jotl',
    text: ZH_TEXT,
    lang: 'zh-cn',
  });

  it('CSP 默认全部禁止; 脚本只放行 nonce(另允许 Ajv 需要的 eval), 样式只来自 nonce 与扩展目录, 不允许内联', () => {
    const policy = csp(html);
    expect([...policy.keys()].sort()).toEqual(['default-src', 'font-src', 'img-src', 'script-src', 'style-src']);
    expect(policy.get('default-src')).toBe("'none'");
    expect(policy.get('script-src')).toBe("'nonce-abc123' 'unsafe-eval'");
    expect(policy.get('style-src')).toBe(`${CSP_SOURCE} 'nonce-abc123'`);
    expect(policy.get('img-src')).toBe(`${CSP_SOURCE} https: data:`);
    expect(policy.get('font-src')).toBe(CSP_SOURCE);
    expect(html).not.toContain('unsafe-inline');
  });

  it('表单样式经给定地址以 link 引入', () => {
    expect([...html.matchAll(/<link\b[^>]*>/g)].map(m => m[0])).toEqual([
      '<link rel="stylesheet" href="https://file+.vscode-resource/dist/preview-form.css">',
    ]);
  });

  it('唯一的脚本与样式标签都带 nonce, 脚本从给定地址加载', () => {
    expect([...html.matchAll(/<script\b[^>]*>/g)].map(m => m[0])).toEqual([
      '<script nonce="abc123" src="https://file+.vscode-resource/dist/preview.js">',
    ]);
    expect([...html.matchAll(/<style\b[^>]*>/g)].map(m => m[0])).toEqual(['<style nonce="abc123">']);
    expect(html).not.toMatch(/\son\w+=/);
  });

  it('标题与地址中的 HTML 特殊字符被转义', () => {
    const escaped = renderPreviewHtml({
      cspSource: CSP_SOURCE,
      nonce: 'n',
      scriptUri: 'x"><script>',
      formStyleUri: '"><x',
      title: '<b>&</b>',
      text: { ...ZH_TEXT, waiting: '"><script>' },
      lang: '"en',
    });
    expect(escaped).toContain('href="&#34;&#62;&#60;x"');
    expect(escaped).toContain('<title>&#60;b&#62;&#38;&#60;/b&#62;</title>');
    expect(escaped).toContain('src="x&#34;&#62;&#60;script&#62;"');
    expect([...escaped.matchAll(/<script\b/g)]).toHaveLength(1);
  });

  it('本地化文字写在 #root 的 data-text 上并能原样解析, lang 取给定语言', () => {
    expect(html).toContain('<html lang="zh-cn">');
    const encoded = /<div id="root" data-text="([^"]*)"><\/div>/.exec(html)?.[1];
    if (encoded === undefined) throw new Error('缺少 data-text');
    const decoded = encoded.replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
    expect(JSON.parse(decoded)).toEqual(ZH_TEXT);
  });

  it('开启扩展组件模块时: script-src 另放行扩展资源与 https, 带 nonce 的 import map 在预览脚本之前', () => {
    const shared = { react: 'https://file+.vscode-resource/dist/preview-shim-react.js', x: 'https://e/</script>' };
    const enabled = renderPreviewHtml({
      cspSource: CSP_SOURCE,
      nonce: 'abc123',
      scriptUri: 'https://file+.vscode-resource/dist/preview.js',
      formStyleUri: 'https://file+.vscode-resource/dist/preview-form.css',
      title: 't',
      text: ZH_TEXT,
      lang: 'en',
      sharedModules: shared,
    });
    expect(csp(enabled).get('script-src')).toBe(`'nonce-abc123' 'unsafe-eval' ${CSP_SOURCE} https:`);
    expect([...enabled.matchAll(/<script\b[^>]*>/g)].map(m => m[0])).toEqual([
      '<script type="importmap" nonce="abc123">',
      '<script nonce="abc123" src="https://file+.vscode-resource/dist/preview.js">',
    ]);
    const map = /<script type="importmap" nonce="abc123">([^<]*)<\/script>/.exec(enabled)?.[1];
    expect(JSON.parse(map!)).toEqual({ imports: shared });
  });

  it('nonce 每次不同且有足够长度', () => {
    const nonces = new Set(Array.from({ length: 20 }, createNonce));
    expect(nonces.size).toBe(20);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe('消息约定', () => {
  it('请求方法名与语言服务一致', () => {
    expect(PREVIEW_REQUEST_METHOD).toBe(LSP_PREVIEW_REQUEST_METHOD);
    expect(PREVIEW_CONFIG_CHANGED_METHOD).toBe(LSP_PREVIEW_CONFIG_CHANGED_METHOD);
  });

  it('只接受结构完整的消息', () => {
    expect(isToWebview({ type: 'unavailable', fileName: 'a.jotl', reason: 'x' })).toBe(true);
    const content = {
      uri: 'u',
      schema: '{}',
      diagnostics: [],
      typescript: 'type A = string;',
      typescriptDiagnostics: [],
    };
    expect(isToWebview({ type: 'update', fileName: 'a.jotl', content })).toBe(true);
    expect(
      isToWebview({
        type: 'update',
        fileName: 'a.jotl',
        content: { uri: 'u', diagnostics: [], typescriptDiagnostics: [] },
      })
    ).toBe(true);
    for (const bad of [
      null,
      'update',
      { type: 'update', fileName: 'a.jotl' },
      { type: 'update', fileName: 'a.jotl', content: { schema: 1, diagnostics: [], typescriptDiagnostics: [] } },
      { type: 'update', fileName: 'a.jotl', content: { schema: '{}', typescriptDiagnostics: [] } },
      { type: 'update', fileName: 'a.jotl', content: { schema: '{}', diagnostics: [] } },
      {
        type: 'update',
        fileName: 'a.jotl',
        content: { schema: '{}', diagnostics: [], typescript: 1, typescriptDiagnostics: [] },
      },
      { type: 'unavailable', fileName: 'a.jotl' },
      { type: 'other', fileName: 'a.jotl', reason: 'x' },
      { type: 'unavailable', reason: 'x' },
    ]) {
      expect(isToWebview(bad), JSON.stringify(bad)).toBe(false);
    }
    const modules = { load: true, config: { A: { module: 'https://m/a.js', export: 'A' } }, baseUrl: 'https://r/dir/' };
    expect(isToWebview({ type: 'update', fileName: 'a.jotl', content, modules })).toBe(true);
    expect(
      isToWebview({ type: 'update', fileName: 'a.jotl', content, modules: { ...modules, baseUrl: undefined } })
    ).toBe(true);
    for (const bad of [
      { ...modules, load: 'yes' },
      { ...modules, config: { A: { module: 1 } } },
      { ...modules, baseUrl: 1 },
      null,
    ]) {
      expect(isToWebview({ type: 'update', fileName: 'a.jotl', content, modules: bad }), JSON.stringify(bad)).toBe(
        false
      );
    }
    expect(isFromWebview({ type: 'ready' })).toBe(true);
    expect(isFromWebview({ type: 'other' })).toBe(false);
    expect(isFromWebview(undefined)).toBe(false);
  });
});

describe('预览视图模型', () => {
  it('收到消息前显示等待', () => {
    expect(describePreview(undefined, ZH_TEXT)).toEqual({ kind: 'message', title: '', status: '正在生成预览…' });
  });

  it('不可用时只显示原因', () => {
    expect(describePreview({ type: 'unavailable', fileName: 'a.jotl', reason: '文档已关闭.' }, ZH_TEXT)).toEqual({
      kind: 'message',
      title: '预览 a.jotl',
      status: '文档已关闭.',
    });
  });

  it('合法源码: schema, 表单 schema 对象与 TS 都有, 没有诊断', () => {
    const content = getPreview('A: { a: string }', 'file:///a.jotl');
    const view = describePreview({ type: 'update', fileName: 'a.jotl', content }, ZH_TEXT);
    if (view.kind !== 'content') throw new Error('应为内容视图');
    expect(view.diagnostics).toEqual({ summary: '没有诊断', items: [] });
    expect(view.formSchema).toEqual(JSON.parse(content.schema!));
    expect((view.formSchema as { $defs: { A: { properties: unknown } } }).$defs.A.properties).toEqual({
      a: { type: 'string' },
    });
    expect(view.typescript).toBe(content.typescript);
    expect(view.typescript).toContain('export interface A {');
    expect(view.typescriptDiagnostics).toEqual({ summary: '没有诊断', items: [] });
  });

  it('有错误: 没有 schema, 表单 schema 与 TS, 列出带位置的诊断与计数', () => {
    const content = getPreview("A: {\n  a: strng\n  b: boolean[widget: 'radio']\n}", 'file:///a.jotl');
    const message: ToWebview = { type: 'update', fileName: 'a.jotl', content };
    const view = describePreview(message, ZH_TEXT);
    if (view.kind !== 'content') throw new Error('应为内容视图');
    expect(view.schema).toBeUndefined();
    expect(view.formSchema).toBeUndefined();
    expect(view.typescript).toBeUndefined();
    expect(view.diagnostics.summary).toBe('1 个错误, 1 个警告, 0 个提示');
    expect(view.diagnostics.items.map(d => d.severity)).toEqual(['error', 'warning']);
    expect(view.diagnostics.items[0]!.text).toMatch(/^错误 JOTL1004 2:6 /);
    expect(view.diagnostics.items[1]!.text).toMatch(/^警告 JOTL1045 3:22 /);
  });

  it('没有位置的诊断带指针或不带位置', () => {
    const diagnostic = {
      severity: 'info' as const,
      code: 'JOTL7999',
      message: 'm',
      line: undefined,
      column: undefined,
    };
    const view = describePreview(
      {
        type: 'update',
        fileName: 'a.jotl',
        content: {
          uri: 'u',
          schema: '{}',
          diagnostics: [{ ...diagnostic, pointer: undefined }],
          typescript: '',
          typescriptDiagnostics: [
            { ...diagnostic, pointer: '/$defs/A' },
            { ...diagnostic, pointer: '' },
          ],
          configFile: undefined,
          modules: {},
        },
      },
      ZH_TEXT
    );
    if (view.kind !== 'content') throw new Error('应为内容视图');
    expect(view.diagnostics.items).toEqual([{ severity: 'info', text: '提示 JOTL7999 m' }]);
    expect(view.typescriptDiagnostics.items.map(d => d.text)).toEqual([
      '提示 JOTL7999 /$defs/A m',
      '提示 JOTL7999 # m',
    ]);
  });

  it('扩展组件模块: 合并配置与 schema 根 x-ui.widgets 中声明了模块的组件名; 没有模块信息时视为未开启', () => {
    const content = getPreview(
      "A: [widgets: {ImagePicker: {base: 'string', module: 'https://esm.sh/image-picker'}}] { img: ImagePicker }",
      'file:///a.jotl'
    );
    expect(content.schema).toBeDefined();
    const plain = describePreview({ type: 'update', fileName: 'a.jotl', content }, ZH_TEXT);
    if (plain.kind !== 'content') throw new Error('应为内容视图');
    expect(plain.modules).toEqual({ load: false, config: {}, baseUrl: undefined, declared: ['ImagePicker'] });
    const modules = { load: true, config: { Color: { module: 'https://m/color.js' } }, baseUrl: 'https://r/' };
    const view = describePreview({ type: 'update', fileName: 'a.jotl', content, modules }, ZH_TEXT);
    if (view.kind !== 'content') throw new Error('应为内容视图');
    expect(view.modules).toEqual({ ...modules, declared: ['Color', 'ImagePicker'] });
  });

  it('模块声明只收带非空 module 的对象', () => {
    expect(
      widgetModuleRefs({
        A: 'string',
        B: { type: 'string' },
        C: { module: '' },
        D: { module: './d.js', export: 'D' },
        E: { base: 'url', module: 'https://e', export: '' },
      })
    ).toEqual({ D: { module: './d.js', export: 'D' }, E: { module: 'https://e' } });
    expect(widgetModuleRefs([{ module: 'x' }])).toEqual({});
    expect(schemaModuleRefs({ 'x-ui': { widgets: { P: { module: 'https://p' } } } })).toEqual({
      P: { module: 'https://p' },
    });
    expect(schemaModuleRefs(true)).toEqual({});
  });

  it('表单语言随 VS Code 显示语言: zh 开头为简体中文, 其余为英文', () => {
    expect(previewLocale('zh-cn')).toBe('zh-CN');
    expect(previewLocale('zh-tw')).toBe('zh-CN');
    expect(previewLocale('en')).toBe('en');
    expect(previewLocale('ja')).toBe('en');
    expect(previewLocale('')).toBe('en');
  });

  it('页签名校验', () => {
    for (const tab of PREVIEW_TABS) expect(isPreviewTab(tab)).toBe(true);
    for (const bad of ['Schema', '', undefined, 1]) expect(isPreviewTab(bad)).toBe(false);
  });
});
