// @vitest-environment jsdom
// 预览 webview 界面: 三个页签的切换, Schema 与 TS 文本, JotlForm 渲染的表单, 编译出错时各页签显示诊断而不是空白.
import { getPreview } from "@jotl/language-server";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { describePreview, PREVIEW_TABS, type PreviewTab, type PreviewView } from "../src/preview-view.js";
import { PreviewRoot } from "../src/webview/preview-root.js";
import { ZH_TEXT } from "./zh-text.js";

const VALID = "Site(站点): {\n  title(标题): string[default: 'hi']\n  count?: integer\n  mode: enum{ light dark }\n}";
const BROKEN = "Site: {\n  title: strng\n}";

function view(source: string): PreviewView {
  return describePreview({ type: "update", fileName: "site.jotl", content: getPreview(source, "file:///site.jotl") }, ZH_TEXT);
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let mounted: { root: Root; container: HTMLElement } | undefined;

afterEach(() => {
  if (mounted === undefined) return;
  const { root, container } = mounted;
  act(() => root.unmount());
  container.remove();
  mounted = undefined;
});

function mount(v: PreviewView, tab: PreviewTab, onTabChange: (tab: PreviewTab) => void = () => {}): HTMLElement {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<PreviewRoot view={v} text={ZH_TEXT} tab={tab} onTabChange={onTabChange} />));
  mounted = { root, container };
  return container;
}

function render(v: PreviewView, tab: PreviewTab): string {
  return mount(v, tab).innerHTML;
}

function preText(container: HTMLElement): string | undefined {
  return container.querySelector("pre.code")?.textContent ?? undefined;
}

describe("预览界面", () => {
  it("等待与不可用时只显示标题与状态, 没有页签", () => {
    const html = render(describePreview({ type: "unavailable", fileName: "a.jotl", reason: "文档已关闭." }, ZH_TEXT), "schema");
    expect(html).toContain("<h1>预览 a.jotl</h1>");
    expect(html).toContain("文档已关闭.");
    expect(html).not.toContain('role="tab"');
  });

  it.each(PREVIEW_TABS)("页签 %s: 三个页签都在, 只有当前页签 aria-selected, 面板与之关联", (tab) => {
    const container = mount(view(VALID), tab);
    const tabs = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((t) => t.id)).toEqual(PREVIEW_TABS.map((t) => `tab-${t}`));
    expect(tabs.filter((t) => t.getAttribute("aria-selected") === "true").map((t) => t.id)).toEqual([`tab-${tab}`]);
    const panel = container.querySelector('[role="tabpanel"]');
    expect(panel?.id).toBe(`panel-${tab}`);
    expect(panel?.getAttribute("aria-labelledby")).toBe(`tab-${tab}`);
  });

  it("点击页签回调所选页签", () => {
    const onTabChange = vi.fn();
    const container = mount(view(VALID), "schema", onTabChange);
    act(() => container.querySelector<HTMLButtonElement>("#tab-form")!.click());
    act(() => container.querySelector<HTMLButtonElement>("#tab-typescript")!.click());
    expect(onTabChange.mock.calls).toEqual([["form"], ["typescript"]]);
  });

  it("Schema 页签显示编译出的 JSON", () => {
    const v = view(VALID);
    if (v.kind !== "content") throw new Error("应为内容视图");
    expect(JSON.parse(preText(mount(v, "schema"))!)).toEqual(v.formSchema);
  });

  it("TS 页签显示 schemaToTs 的产物", () => {
    const v = view(VALID);
    if (v.kind !== "content") throw new Error("应为内容视图");
    expect(preText(mount(v, "typescript"))).toBe(v.typescript);
    expect(v.typescript).toContain("export interface Site {");
  });

  it.each(["schema", "typescript"] as const)("页签 %s: 复制按钮与诊断标题同一行, 复制整段生成文本并提示结果", async (tab) => {
    const v = view(VALID);
    if (v.kind !== "content") throw new Error("应为内容视图");
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    try {
      const container = mount(v, tab);
      const button = container.querySelector<HTMLButtonElement>(".section-header > button.copy");
      expect(button?.textContent).toBe("复制");
      await act(async () => button!.click());
      expect(writeText).toHaveBeenCalledWith(tab === "schema" ? v.schema : v.typescript);
      expect(button!.textContent).toBe("已复制");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("剪贴板写入失败时按钮提示复制失败", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
    try {
      const button = mount(view(VALID), "schema").querySelector<HTMLButtonElement>("button.copy")!;
      await act(async () => button.click());
      expect(button.textContent).toBe("复制失败");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("表单页签用 JotlForm 渲染字段与默认值, 并说明修改不写回文件", () => {
    const container = mount(view(VALID), "form");
    expect(container.textContent).toContain("表单只用于预览");
    const form = container.querySelector("#jotl-preview-form");
    expect(form).not.toBeNull();
    expect(form!.textContent).toContain("标题");
    const inputs = [...form!.querySelectorAll("input")];
    expect(inputs.some((i) => i.value === "hi")).toBe(true);
    expect(preText(container)).toBeUndefined();
  });

  it("schema 变化后表单按新 schema 重建", () => {
    const container = mount(view(VALID), "form");
    const next = view("Site: {\n  name(名称): string[default: 'new']\n}");
    act(() => mounted!.root.render(<PreviewRoot view={next} text={ZH_TEXT} tab="form" onTabChange={() => {}} />));
    const form = container.querySelector("#jotl-preview-form")!;
    expect(form.textContent).toContain("名称");
    expect(form.textContent).not.toContain("标题");
    expect([...form.querySelectorAll("input")].some((i) => i.value === "new")).toBe(true);
  });

  it("声明了扩展组件模块但未开启加载: 顶部提示可开启的设置, 表单仍按降级显示", () => {
    const source = "Site: [widgets: {ImagePicker: {base: 'string', module: 'https://esm.sh/image-picker'}}] {\n  img(图片): ImagePicker\n}";
    const container = mount(view(source), "form");
    const notice = container.querySelector("p.modules");
    expect(notice?.textContent).toBe("预览未加载扩展组件模块: ImagePicker; 这些组件按降级方式显示, 开启设置 jotl.preview.loadWidgetModules 后加载.");
    expect(container.querySelector("#jotl-preview-form")?.textContent).toContain("图片");
  });

  it("没有模块声明时不显示模块提示", () => {
    expect(mount(view(VALID), "schema").querySelector("p.modules")).toBeNull();
  });

  it("表单文案随给定语言切换", () => {
    const source = "Site: {\n  tags(标签): string[]\n}";
    const texts = (["zh-CN", "en"] as const).map((locale) => {
      const container = document.createElement("div");
      const root = createRoot(container);
      act(() => root.render(<PreviewRoot view={view(source)} text={ZH_TEXT} tab="form" onTabChange={() => {}} locale={locale} />));
      const text = container.querySelector("#jotl-preview-form")?.textContent ?? "";
      act(() => root.unmount());
      return text;
    });
    expect(texts[0]).not.toBe(texts[1]);
  });

  it.each(PREVIEW_TABS)("编译出错时页签 %s 显示提示与诊断, 不渲染表单", (tab) => {
    const html = render(view(BROKEN), tab);
    expect(html).toContain("存在错误, 修正后显示编译结果.");
    expect(html).toContain("1 个错误, 0 个警告, 0 个提示");
    expect(html).toMatch(/<li class="error">错误 JOTL1004 2:10 /);
    expect(html).not.toContain("jotl-preview-form");
    expect(html).not.toContain("<pre");
  });
});
