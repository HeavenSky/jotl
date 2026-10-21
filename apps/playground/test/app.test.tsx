// @vitest-environment jsdom
// 主界面: 编辑后防抖编译, 表单预览, 诊断定位, 编译出错时保留预览并标注已过期, 示例切换, 页签与刷新恢复, 语言切换与 jotl.config.json.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, COMPILE_DEBOUNCE_MS } from '../src/app.js';
import { COPY, copyOf } from '../src/copy.js';
import { DEFAULT_EXAMPLE_ID, WIDGET_MODULE_EXAMPLE_ID, findExample } from '../src/examples.js';
import type { OutputTab } from '../src/output-tabs.js';
import { CONFIG_STORAGE_KEY, LOCALE_STORAGE_KEY, SOURCE_STORAGE_KEY } from '../src/storage.js';
import { offsetAt } from '../src/text-position.js';

afterEach(cleanup);
// jsdom 的 navigator.language 是 en-US; 除语言用例外都按中文界面断言.
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(LOCALE_STORAGE_KEY, 'zh-CN');
});

const VALID = 'A: {\n  nickname(昵称): string\n}';
const BROKEN = 'A: {\n  nickname(昵称): string\n  age: strng\n}';

function editor(): HTMLTextAreaElement {
  return screen.getByLabelText(COPY.editor.label) as HTMLTextAreaElement;
}

// 页签面板随 schema 变化重新挂载, 异步等待时要在回调里重新查询.
function panel(tab: OutputTab): HTMLElement {
  const element = document.getElementById(`pg-panel-${tab}`);
  if (element === null) throw new Error(`缺少页签面板 ${tab}`);
  expect(element.getAttribute('role')).toBe('tabpanel');
  expect(document.getElementById(element.getAttribute('aria-labelledby')!)?.textContent).toBe(COPY.tabs[tab]);
  return element;
}

function findInPanel(tab: OutputTab, label: RegExp): Promise<HTMLElement> {
  return waitFor(() => within(panel(tab)).getByLabelText(label));
}

function renderWith(source: string) {
  localStorage.setItem(SOURCE_STORAGE_KEY, source);
  return render(<App />);
}

function type(source: string) {
  fireEvent.change(editor(), { target: { value: source } });
}

describe('编辑与预览', () => {
  it('输入源码后防抖编译, 表单页签出现新字段, 当前数据显示在表单旁', async () => {
    renderWith('A: {\n  x: string\n}');
    type(VALID);
    expect(screen.getByText(COPY.editor.pending)).toBeTruthy();
    expect(within(panel('form')).queryByLabelText(/昵称/)).toBeNull();
    const field = await findInPanel('form', /昵称/);
    expect(screen.queryByText(COPY.editor.pending)).toBeNull();
    fireEvent.change(field, { target: { value: '小明' } });
    expect(JSON.parse(screen.getByTestId('form-data').textContent!)).toEqual({ nickname: '小明' });
  });

  it('连续输入只在停止输入后编译一次最终源码', async () => {
    vi.useFakeTimers();
    try {
      renderWith('A: {\n  x: string\n}');
      type('A: {\n  y(乙): string\n}');
      act(() => vi.advanceTimersByTime(COMPILE_DEBOUNCE_MS - 1));
      type(VALID);
      act(() => vi.advanceTimersByTime(COMPILE_DEBOUNCE_MS - 1));
      expect(within(panel('form')).queryByLabelText(/乙/)).toBeNull();
      expect(screen.getByTestId('schema-output').textContent).not.toContain('nickname');
      act(() => vi.advanceTimersByTime(1));
      expect(within(panel('form')).getByLabelText(/昵称/)).toBeTruthy();
      expect(screen.getByTestId('schema-output').textContent).toContain('"nickname"');
    } finally {
      vi.useRealTimers();
    }
  });

  it('JSON Schema 与 TS 页签显示编译结果', () => {
    renderWith(VALID);
    fireEvent.click(screen.getByRole('tab', { name: COPY.tabs.schema }));
    expect(JSON.parse(within(panel('schema')).getByTestId('schema-output').textContent!)).toMatchObject({
      $defs: { A: { properties: { nickname: { type: 'string', title: '昵称' } }, required: ['nickname'] } },
    });
    fireEvent.click(screen.getByRole('tab', { name: COPY.tabs.ts }));
    expect(panel('ts').hidden).toBe(false);
    expect(panel('schema').hidden).toBe(true);
    expect(within(panel('ts')).getByTestId('ts-output').textContent).toContain('nickname: string;');
  });

  it('降级调试页签列出每个节点选中的组件', () => {
    renderWith(VALID);
    fireEvent.click(screen.getByRole('tab', { name: COPY.tabs.debug }));
    const debug = panel('debug');
    expect(debug.querySelector('tr[data-data-path="/nickname"]')?.getAttribute('data-widget')).toBe('input');
  });

  it('降级调试按 v1 组件名列出综合示例的各节点', () => {
    render(<App />);
    const widgets = new Map(
      [...panel('debug').querySelectorAll('tr[data-data-path]')].map(row => [
        row.getAttribute('data-data-path'),
        row.getAttribute('data-widget'),
      ])
    );
    expect(
      Object.fromEntries(
        [
          '/name',
          '/intro',
          '/homepage',
          '/logo',
          '/channels',
          '/price',
          '/stock',
          '/contact',
          '/seo',
          '/banners',
          '/blocks/*/content',
          '/blocks/*/kind',
          '/i18n',
        ].map(p => [p, widgets.get(p)])
      )
    ).toEqual({
      '/name': 'input',
      '/intro': 'textarea',
      '/homepage': 'url',
      '/logo': 'image',
      '/channels': 'checkbox',
      '/price': 'money',
      '/stock': 'bigint',
      '/contact': 'inline',
      '/seo': 'page',
      '/banners': 'list',
      '/blocks/*/content': 'richtext',
      '/blocks/*/kind': 'output',
      '/i18n': 'kv',
    });
  });

  it('嵌套对象显示为入口行, 点击进入子页并显示面包屑, 点面包屑退回; inline 对象在父页展开', () => {
    render(<App />);
    const form = () => within(panel('form'));
    expect(form().getByLabelText(/电话/)).toBeTruthy();
    expect(form().queryByLabelText(/关键词/)).toBeNull();
    fireEvent.click(form().getByLabelText(/搜索优化/));
    const crumbs = form().getByRole('navigation');
    expect(within(crumbs).getByText('搜索优化').getAttribute('aria-current')).toBe('page');
    expect(form().getByLabelText(/关键词/)).toBeTruthy();
    expect(form().queryByLabelText(/电话/)).toBeNull();
    fireEvent.click(within(crumbs).getByRole('button', { name: '店铺' }));
    expect(within(form().getByRole('navigation')).getByText('店铺').getAttribute('aria-current')).toBe('page');
    expect(form().getByLabelText(/电话/)).toBeTruthy();
  });

  it('未注册组件的降级记录出现在调试视图中', () => {
    renderWith(findExample('013-x-ui-basic')!.source);
    const row = panel('debug').querySelector('tr[data-data-path="/title"]');
    expect(row?.textContent).toContain('headline');
  });

  it('页签支持方向键, Home 与 End 切换', () => {
    renderWith(VALID);
    const form = screen.getByRole('tab', { name: COPY.tabs.form });
    expect(form.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(form, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: COPY.tabs.debug }).getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: COPY.tabs.debug }));
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: COPY.tabs.schema }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(screen.getByRole('tab', { name: COPY.tabs.debug }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(screen.getByRole('tab', { name: COPY.tabs.schema }).getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: COPY.tabs.debug }).getAttribute('aria-selected')).toBe('true');
  });
});

describe('诊断', () => {
  it('点击诊断聚焦编辑器, 选中出错区间并显示光标行列', () => {
    renderWith(BROKEN);
    const item = screen.getByRole('button', { name: /JOTL1004/ });
    expect(item.textContent).toContain('3:8');
    fireEvent.click(item);
    const textarea = editor();
    expect(document.activeElement).toBe(textarea);
    expect(textarea.selectionStart).toBe(offsetAt(BROKEN, { line: 3, column: 8 }));
    expect(textarea.selectionEnd).toBe(offsetAt(BROKEN, { line: 3, column: 13 }));
    expect(BROKEN.slice(textarea.selectionStart, textarea.selectionEnd)).toBe('strng');
    expect(screen.getByTestId('cursor-position').textContent).toBe(COPY.editor.cursor(3, 8));
  });

  it('出错行在行号栏中标记, 没有诊断时显示无诊断', async () => {
    const { container } = renderWith(BROKEN);
    const lines = container.querySelectorAll('.pg-gutter-line');
    expect(lines).toHaveLength(4);
    expect(lines[2]?.classList.contains('pg-mark-error')).toBe(true);
    expect(lines[1]?.classList.contains('pg-mark-error')).toBe(false);
    expect(screen.getByText(COPY.diagnostics.count(1, 0))).toBeTruthy();
    type(VALID);
    await screen.findByText(COPY.diagnostics.none);
    expect(container.querySelectorAll('.pg-mark-error')).toHaveLength(0);
  });

  it('移动光标时更新行列', () => {
    renderWith(VALID);
    const textarea = editor();
    textarea.setSelectionRange(VALID.indexOf('nickname'), VALID.indexOf('nickname'));
    fireEvent.select(textarea);
    expect(screen.getByTestId('cursor-position').textContent).toBe(COPY.editor.cursor(2, 3));
  });
});

describe('编译失败', () => {
  it('保留上一次成功的预览并标注已过期, 修正后恢复', async () => {
    renderWith(VALID);
    expect(screen.queryByTestId('stale-banner')).toBeNull();
    type(BROKEN);
    const banner = await screen.findByTestId('stale-banner');
    expect(banner.textContent).toBe(COPY.output.stale);
    expect(within(panel('form')).getByLabelText(/昵称/)).toBeTruthy();
    expect(screen.getByTestId('schema-output').textContent).toContain('"nickname"');
    type(VALID.replace('nickname(昵称)', 'alias(别名)'));
    await findInPanel('form', /别名/);
    expect(screen.queryByTestId('stale-banner')).toBeNull();
  });

  it('从未成功编译时各页签显示提示, 不显示已过期', () => {
    renderWith(BROKEN);
    expect(screen.queryByTestId('stale-banner')).toBeNull();
    expect(within(panel('form')).getByText(COPY.output.empty)).toBeTruthy();
    expect(within(panel('ts')).getByText(COPY.output.empty)).toBeTruthy();
  });
});

describe('示例与本地存储', () => {
  it('选择示例后立即加载源码并编译', () => {
    renderWith(VALID);
    const example = findExample('001-primitives')!;
    fireEvent.change(screen.getByLabelText(COPY.examples.label), { target: { value: example.id } });
    expect(editor().value).toBe(example.source);
    expect(within(panel('form')).getByLabelText(/名称/)).toBeTruthy();
    expect(localStorage.getItem(SOURCE_STORAGE_KEY)).toBe(example.source);
  });

  it('没有保存的源码时加载默认示例', () => {
    render(<App />);
    expect(editor().value).toBe(findExample(DEFAULT_EXAMPLE_ID)!.source);
  });

  it('编辑内容写入本地存储, 重新挂载后恢复', () => {
    const first = renderWith(VALID);
    type(BROKEN);
    expect(localStorage.getItem(SOURCE_STORAGE_KEY)).toBe(BROKEN);
    first.unmount();
    render(<App />);
    expect(editor().value).toBe(BROKEN);
  });

  it('本地存储写入失败时提示且编辑照常', async () => {
    renderWith(VALID);
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    try {
      type(VALID.replace('nickname(昵称)', 'alias(别名)'));
      expect(screen.getByRole('alert').textContent).toBe(COPY.storage.unavailable);
      await findInPanel('form', /别名/);
    } finally {
      setItem.mockRestore();
    }
  });
});

describe('预览选项', () => {
  it('切换为折叠面板时组合字段渲染为面板; 切换为 Mock 时按 mock 生成初始数据', async () => {
    renderWith('A: {\n  nickname(昵称): string\n  seo(搜索优化): { keywords(关键词): string }\n}');
    const form = () => within(panel('form'));
    expect(panel('form').querySelector('.jotl-panel')).toBeNull();
    fireEvent.change(form().getByLabelText(COPY.preview.layout), { target: { value: 'panels' } });
    expect(panel('form').querySelector('.jotl-panel')?.textContent).toContain('搜索优化');
    expect(form().getByLabelText(/关键词/)).toBeTruthy();
    expect(JSON.parse(screen.getByTestId('form-data').textContent!)).toEqual({});
    fireEvent.change(form().getByLabelText(COPY.preview.initialData), { target: { value: 'mock' } });
    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('form-data').textContent!)).toMatchObject({
        nickname: expect.any(String),
        seo: { keywords: expect.any(String) },
      })
    );
  });

  it('综合示例: 图片字段有上传按钮', () => {
    render(<App />);
    const form = () => within(panel('form'));
    expect(form().getAllByRole('button', { name: '上传图片' }).length).toBeGreaterThan(0);
  });
});

describe('界面语言', () => {
  const EN = copyOf('en');

  it('没有保存的选择时按浏览器语言(jsdom 为 en-US)取英文, 诊断也是英文', () => {
    localStorage.removeItem(LOCALE_STORAGE_KEY);
    renderWith(BROKEN);
    expect(screen.getByRole('tab', { name: EN.tabs.form })).toBeTruthy();
    expect(screen.getByRole('button', { name: /JOTL1004/ }).textContent).toContain('Unknown component `strng`');
  });

  it('切换语言后界面, 已有诊断与表单控件文案随之切换并记住选择', () => {
    renderWith(BROKEN.replace('age: strng', 'logo: image'));
    type(BROKEN);
    return waitFor(() => screen.getByRole('button', { name: /JOTL1004/ })).then(item => {
      expect(item.textContent).toContain('未知组件 `strng`');
      fireEvent.change(screen.getByLabelText(COPY.language.label), { target: { value: 'en' } });
      expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
      expect(document.documentElement.lang).toBe('en');
      expect(screen.getByRole('tab', { name: EN.tabs.form })).toBeTruthy();
      expect(screen.getByRole('button', { name: /JOTL1004/ }).textContent).toContain('Unknown component `strng`');
      expect(screen.getByTestId('stale-banner').textContent).toBe(EN.output.stale);
      expect(
        within(document.getElementById('pg-panel-form')!).getAllByRole('button', { name: 'Upload image' }).length
      ).toBeGreaterThan(0);
      fireEvent.change(screen.getByLabelText(EN.language.label), { target: { value: 'zh-CN' } });
      expect(screen.getByRole('button', { name: /JOTL1004/ }).textContent).toContain('未知组件 `strng`');
      expect(within(panel('form')).getAllByRole('button', { name: '上传图片' }).length).toBeGreaterThan(0);
    });
  });
});

describe('扩展组件模块', () => {
  it('jotl.config.json 登记的组件可在源码中使用, 配置问题列入诊断', async () => {
    renderWith('A: {\n  score(评分): Stars\n}');
    expect(screen.getByText(COPY.diagnostics.none)).toBeTruthy();
    expect(JSON.parse(screen.getByTestId('schema-output').textContent!)).toMatchObject({
      $defs: { A: { properties: { score: { type: 'integer', 'x-ui': { widget: 'Stars' } } } } },
    });
    fireEvent.click(screen.getByRole('tab', { name: COPY.sources.config }));
    const config = screen.getByLabelText(COPY.config.label) as HTMLTextAreaElement;
    fireEvent.change(config, { target: { value: '{ "widgets": { "Stars": "integer", "bad": 3 }, "extra": 1 }' } });
    expect(localStorage.getItem(CONFIG_STORAGE_KEY)).toContain('"bad"');
    await waitFor(() => expect(screen.getAllByText(COPY.diagnostics.stage.config)).toHaveLength(2));
    fireEvent.change(config, { target: { value: '{' } });
    await waitFor(() => expect(screen.getByText(/jotl\.config\.json 不是合法的 JSON/)).toBeTruthy());
    expect(screen.getByRole('button', { name: /JOTL1006/ })).toBeTruthy();
  });

  it('点击配置诊断切到 jotl.config.json 页签并选中出错位置, 行号栏标记对应行', async () => {
    const text = '{\n  "widgets": { "bad": 3 }\n}';
    localStorage.setItem(CONFIG_STORAGE_KEY, text);
    renderWith(VALID);
    const item = screen.getByRole('button', { name: /\/widgets\/bad/ });
    expect(item.textContent).toContain('2:16');
    fireEvent.click(item);
    const config = await waitFor(() => screen.getByLabelText(COPY.config.label) as HTMLTextAreaElement);
    await waitFor(() => expect(document.activeElement).toBe(config));
    expect(config.selectionStart).toBe(text.indexOf('"bad"'));
    expect(document.querySelectorAll('.pg-gutter-line')[1]?.classList.contains('pg-mark-warning')).toBe(true);
  });

  it('schema 根声明了模块时预览上方提示将加载的地址', () => {
    renderWith(findExample(WIDGET_MODULE_EXAMPLE_ID)!.source);
    const notice = within(panel('form')).getByTestId('schema-modules');
    expect(notice.textContent).toContain(COPY.preview.schemaModules);
    expect(notice.textContent).toContain(new URL('./widgets/rating.js', document.baseURI).href);
    cleanup();
    renderWith(VALID);
    expect(document.querySelector('[data-testid="schema-modules"]')).toBeNull();
  });
});
