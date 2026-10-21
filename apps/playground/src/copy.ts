// Playground 的全部用户可见文案, 中英两套, 按界面语言取用.
import { createContext, useContext } from 'react';
import type { Locale, Severity } from '@jotl/core';

const ZH = {
  appTitle: 'Jotl Playground',
  language: {
    label: '语言',
    names: { 'zh-CN': '中文', en: 'English' } satisfies Record<Locale, string>,
  },
  editor: {
    label: 'Jotl 源码',
    cursor: (line: number, column: number) => `行 ${line}, 列 ${column}`,
    pending: '等待编译…',
  },
  sources: {
    label: '编辑内容',
    source: 'Jotl 源码',
    config: 'jotl.config.json',
  },
  config: {
    label: 'jotl.config.json',
    parseError: (detail: string) => `jotl.config.json 不是合法的 JSON: ${detail}`,
    issue: (pointer: string, message: string) => (pointer === '' ? message : `${pointer}: ${message}`),
  },
  examples: {
    label: '示例',
    placeholder: '加载示例…',
  },
  diagnostics: {
    heading: '诊断',
    none: '没有诊断',
    count: (errors: number, warnings: number) => `${errors} 个错误, ${warnings} 个警告`,
    noLocation: '无源码位置',
    location: (line: number, column: number) => `${line}:${column}`,
    stage: { compile: '编译', ts: 'TS', config: '配置' },
    severity: { error: '错误', warning: '警告', info: '提示' } satisfies Record<Severity, string>,
    internalError: (detail: string) => `编译器内部错误: ${detail}`,
    tsInternalError: (detail: string) => `TS 生成器内部错误: ${detail}`,
  },
  tabs: {
    label: '输出',
    schema: 'JSON Schema',
    ts: 'TS 输出',
    form: '表单预览',
    debug: '降级调试',
  },
  output: {
    stale: '已过期: 源码有错误, 显示的是上一次成功编译的结果',
    empty: '还没有成功编译的结果, 修正诊断中的错误后这里会显示输出.',
    tsFailed: '无法生成 TS, 原因见诊断列表.',
    formData: '当前表单数据',
    submitted: '已提交且校验通过',
    panelCrashed: '该面板渲染出错, 修改源码或切换示例后会自动重试.',
  },
  preview: {
    layout: '呈现',
    drill: '钻取',
    panels: '折叠面板',
    initialData: '初始数据',
    defaults: '默认值',
    mock: 'Mock',
    schemaModules: '本 schema 的根 x-ui.widgets 声明了扩展组件模块, 预览时会从以下地址加载并执行远程代码:',
  },
  storage: {
    unavailable: '浏览器禁止本地存储, 刷新后不会恢复源码.',
  },
};

export type Copy = typeof ZH;
export type DiagnosticStage = keyof Copy['diagnostics']['stage'];

const EN: Copy = {
  appTitle: 'Jotl Playground',
  language: {
    label: 'Language',
    names: { 'zh-CN': '中文', en: 'English' },
  },
  editor: {
    label: 'Jotl source',
    cursor: (line, column) => `Ln ${line}, Col ${column}`,
    pending: 'Waiting to compile…',
  },
  sources: {
    label: 'Editing',
    source: 'Jotl source',
    config: 'jotl.config.json',
  },
  config: {
    label: 'jotl.config.json',
    parseError: detail => `jotl.config.json is not valid JSON: ${detail}`,
    issue: (pointer, message) => (pointer === '' ? message : `${pointer}: ${message}`),
  },
  examples: {
    label: 'Examples',
    placeholder: 'Load example…',
  },
  diagnostics: {
    heading: 'Diagnostics',
    none: 'No diagnostics',
    count: (errors, warnings) => `${errors} error(s), ${warnings} warning(s)`,
    noLocation: 'No source location',
    location: (line, column) => `${line}:${column}`,
    stage: { compile: 'Compile', ts: 'TS', config: 'Config' },
    severity: { error: 'Error', warning: 'Warning', info: 'Info' },
    internalError: detail => `Internal compiler error: ${detail}`,
    tsInternalError: detail => `Internal TS generator error: ${detail}`,
  },
  tabs: {
    label: 'Output',
    schema: 'JSON Schema',
    ts: 'TS output',
    form: 'Form preview',
    debug: 'Degrade debug',
  },
  output: {
    stale: 'Stale: the source has errors; showing the last successful build',
    empty: 'No successful build yet. Fix the errors in Diagnostics and the output will appear here.',
    tsFailed: 'Could not generate TS; see Diagnostics.',
    formData: 'Current form data',
    submitted: 'Submitted and valid',
    panelCrashed: 'This panel failed to render. It retries after you edit the source or switch examples.',
  },
  preview: {
    layout: 'Layout',
    drill: 'Drill-down',
    panels: 'Collapsible panels',
    initialData: 'Initial data',
    defaults: 'Defaults',
    mock: 'Mock',
    schemaModules:
      'The root x-ui.widgets of this schema declares widget modules. The preview loads and runs remote code from:',
  },
  storage: {
    unavailable: 'Local storage is blocked; the source will not be restored after reload.',
  },
};

const COPIES: Record<Locale, Copy> = { 'zh-CN': ZH, en: EN };

/** 中文文案; 测试与缺省语言使用. */
export const COPY: Copy = ZH;

export function copyOf(locale: Locale): Copy {
  return COPIES[locale];
}

export const CopyContext = createContext<Copy>(ZH);

export function useCopy(): Copy {
  return useContext(CopyContext);
}
