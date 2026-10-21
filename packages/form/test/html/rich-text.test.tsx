// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach } from 'vitest';
import { describe, expect, it, vi } from 'vitest';
import {
  RichTextEditor,
  RichTextWidget,
  isSafeUrl,
  richTextEditor,
  sanitizeHtml,
  type HtmlFieldProps,
} from '../../src/html/index.js';
import { ERROR, fieldProps, MODES } from './helpers.js';

const textarea = () => screen.getByRole('textbox') as HTMLTextAreaElement;

describe('richtext', () => {
  it('没有 adapters.richText 时为 textarea: 显示值并写回', () => {
    const props = fieldProps<string>({
      value: '<p>你好</p>',
      schema: { type: 'string', contentMediaType: 'text/html' },
    });
    render(<RichTextWidget {...props} />);
    expect(textarea().tagName).toBe('TEXTAREA');
    expect(textarea().id).toBe('f');
    expect(textarea().value).toBe('<p>你好</p>');
    fireEvent.change(textarea(), { target: { value: '<p>世界</p>' } });
    expect(props.onChange).toHaveBeenLastCalledWith('<p>世界</p>');
    fireEvent.blur(textarea());
    expect(props.onBlur).toHaveBeenCalledTimes(1);
  });

  it('有 adapters.richText 时改用它, 并把全部字段 props 原样交给它', () => {
    const received: HtmlFieldProps<string>[] = [];
    const richText = vi.fn((p: HtmlFieldProps<string>) => {
      received.push(p);
      return <div data-testid="editor">{p.value}</div>;
    });
    const props = fieldProps<string>({ value: '<b>x</b>', adapters: { richText } });
    render(<RichTextWidget {...props} />);
    expect(screen.getByTestId('editor').textContent).toBe('<b>x</b>');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(received[0]?.value).toBe('<b>x</b>');
    received[0]?.onChange('<i>y</i>');
    expect(props.onChange).toHaveBeenLastCalledWith('<i>y</i>');
  });

  it.each(MODES)('mode=%s', mode => {
    render(<RichTextWidget {...fieldProps<string>({ mode, value: 'x' })} />);
    expect(textarea().readOnly).toBe(mode === 'view');
    expect(textarea().disabled).toBe(mode === 'disabled');
  });

  it('有错误时 aria-invalid 并指向错误元素', () => {
    render(<RichTextWidget {...fieldProps<string>({ errors: [ERROR] })} />);
    expect(textarea().getAttribute('aria-invalid')).toBe('true');
    expect(textarea().getAttribute('aria-describedby')).toBe('f-errors');
  });
});

describe('sanitizeHtml', () => {
  it('保留基本排版标签与安全链接', () => {
    const html =
      '<p><b>粗</b><i>斜</i><a href="https://a.com" title="t">链</a></p><ul><li>一</li></ul><ol><li>二</li></ol>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  it('去掉脚本, 样式, 事件属性与危险链接, 未知标签只保留文字', () => {
    const out = sanitizeHtml(
      '<p onclick="x()" style="color:red">a<script>alert(1)</script><img src=x onerror="alert(1)"><font>b</font><a href="javascript:alert(1)">c</a><a href=" java\tscript:1">d</a></p><!-- c --><style>p{}</style>'
    );
    expect(out).toBe('<p>ab<a>c</a><a>d</a></p>');
  });

  it('isSafeUrl: 相对地址与 http https mailto tel 安全', () => {
    for (const url of ['https://a', 'http://a', 'mailto:a@b', 'tel:1', '/p', '#x', 'a.html'])
      expect(isSafeUrl(url)).toBe(true);
    for (const url of ['javascript:alert(1)', 'JAVASCRIPT:x', 'data:text/html,x', 'vbscript:x'])
      expect(isSafeUrl(url)).toBe(false);
  });
});

describe('RichTextEditor', () => {
  const editor = () => screen.getByRole('textbox') as HTMLDivElement;
  const execCommand = vi.fn(() => true);
  afterEach(() => {
    execCommand.mockClear();
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('经 adapters.richText 接入: contenteditable 显示清洗后的值, 输入时写回清洗后的 HTML', () => {
    const props = fieldProps<string>({
      value: '<p onclick="x()">你好<script>bad()</script></p>',
      adapters: { richText: richTextEditor },
    });
    render(<RichTextWidget {...props} />);
    expect(editor().id).toBe('f');
    expect(editor().getAttribute('contenteditable')).toBe('true');
    expect(editor().innerHTML).toBe('<p>你好</p>');
    editor().innerHTML = '<p>世界<img src="x" onerror="bad()"></p>';
    fireEvent.input(editor());
    expect(props.onChange).toHaveBeenLastCalledWith('<p>世界</p>');
    editor().innerHTML = '<p></p>';
    fireEvent.input(editor());
    expect(props.onChange).toHaveBeenLastCalledWith(undefined);
    fireEvent.blur(editor());
    expect(props.onBlur).toHaveBeenCalledTimes(1);
  });

  it('可访问名称取外壳标签, 有错误时 aria-invalid 并指向错误', () => {
    render(
      <>
        {/* oxlint-disable-next-line jsx-a11y/label-has-associated-control -- 模拟字段外壳标签, 被测控件经 aria-labelledby 关联 */}
        <label id="f-label">正文</label>
        <RichTextEditor {...fieldProps<string>({ errors: [ERROR], required: true })} />
      </>
    );
    expect(screen.getByRole('textbox', { name: '正文' })).toBe(editor());
    expect(editor().getAttribute('aria-invalid')).toBe('true');
    expect(editor().getAttribute('aria-describedby')).toBe('f-errors');
    expect(editor().getAttribute('aria-required')).toBe('true');
  });

  it('工具栏: 粗体, 斜体, 列表调用 execCommand 后写回; 链接只接受安全地址', () => {
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    const props = fieldProps<string>({ value: '<p>x</p>' });
    render(<RichTextEditor {...props} />);
    for (const name of ['粗体', '斜体', '无序列表', '有序列表']) fireEvent.click(screen.getByRole('button', { name }));
    expect(execCommand.mock.calls.map((call: unknown[]) => call[0])).toEqual([
      'bold',
      'italic',
      'insertUnorderedList',
      'insertOrderedList',
    ]);
    expect(props.onChange).toHaveBeenCalledTimes(4);
    const prompt = vi
      .spyOn(window, 'prompt')
      .mockReturnValueOnce('javascript:alert(1)')
      .mockReturnValueOnce(' https://a.com ');
    fireEvent.click(screen.getByRole('button', { name: '链接' }));
    expect(execCommand).toHaveBeenCalledTimes(4);
    fireEvent.click(screen.getByRole('button', { name: '链接' }));
    expect(execCommand).toHaveBeenLastCalledWith('createLink', false, 'https://a.com');
    prompt.mockRestore();
  });

  it('外部改值时更新内容, 自己写回的值不重设内容', () => {
    const props = fieldProps<string>({ value: '<p>a</p>' });
    const { rerender } = render(<RichTextEditor {...props} />);
    editor().innerHTML = '<p>ab</p>';
    fireEvent.input(editor());
    const node = editor().firstChild;
    rerender(<RichTextEditor {...props} value="<p>ab</p>" />);
    expect(editor().firstChild).toBe(node);
    rerender(<RichTextEditor {...props} value="<p>c</p>" />);
    expect(editor().innerHTML).toBe('<p>c</p>');
  });

  it.each(MODES)('mode=%s', mode => {
    render(<RichTextEditor {...fieldProps<string>({ mode, value: '<p>x</p>' })} />);
    expect(editor().getAttribute('contenteditable')).toBe(mode === 'edit' ? 'true' : 'false');
    expect(editor().getAttribute('aria-readonly')).toBe(mode === 'view' ? 'true' : null);
    expect(editor().getAttribute('aria-disabled')).toBe(mode === 'disabled' ? 'true' : null);
    const buttons = screen.queryAllByRole('button') as HTMLButtonElement[];
    if (mode === 'view') expect(buttons).toHaveLength(0);
    else expect(buttons.every(b => b.disabled === (mode === 'disabled'))).toBe(true);
  });
});
