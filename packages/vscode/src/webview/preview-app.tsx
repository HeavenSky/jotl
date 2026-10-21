// 预览 webview 的浏览器入口: 接收插件消息, 记住所选页签, 挂载 PreviewRoot, 并把 React 挂到全局供扩展组件模块的垫片共用; 由打包脚本打成 dist/preview.js.
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import * as JsxRuntime from 'react/jsx-runtime';
import { setLocale } from '@jotl/form';
import { SHARED_MODULES_GLOBAL } from '../preview-modules.js';
import { type FromWebview, isToWebview, type ToWebview } from '../preview-protocol.js';
import type { PreviewText } from '../preview-text.js';
import { describePreview, isPreviewTab, type PreviewTab, previewLocale } from '../preview-view.js';
import { PreviewRoot } from './preview-root.js';

interface WebviewState {
  tab: PreviewTab;
}

declare function acquireVsCodeApi(): {
  postMessage(message: FromWebview): void;
  getState(): unknown;
  setState(state: WebviewState): void;
};

const vscode = acquireVsCodeApi();
const container = document.getElementById('root') ?? document.body;
/** 扩展侧本地化好的文字, 由 HTML 外壳写在 #root 的 data-text 上. */
const text = JSON.parse(container.dataset.text ?? 'null') as PreviewText;
/** html 的 lang 是 VS Code 的显示语言. */
const locale = previewLocale(document.documentElement.lang);
// 模块加载失败等不经 JotlForm locale 的文案读全局语言.
setLocale(locale);

// 键必须等于 SHARED_MODULE_SHIMS 的说明符: 扩展组件模块经 import map 取到的垫片从这里读出预览自己的 React.
(globalThis as Record<string, unknown>)[SHARED_MODULES_GLOBAL] = {
  react: React,
  'react/jsx-runtime': JsxRuntime,
  'react-dom': ReactDOM,
  'react-dom/client': ReactDOMClient,
};

function restoredTab(): PreviewTab {
  const state = vscode.getState();
  const tab = typeof state === 'object' && state !== null ? (state as { tab?: unknown }).tab : undefined;
  return isPreviewTab(tab) ? tab : 'schema';
}

function App() {
  const [message, setMessage] = useState<ToWebview | undefined>(undefined);
  const [tab, setTab] = useState<PreviewTab>(restoredTab);

  useEffect(() => {
    const listener = (event: MessageEvent<unknown>) => {
      if (isToWebview(event.data)) setMessage(event.data);
    };
    window.addEventListener('message', listener);
    // 监听就位后才通知插件投递, 否则首条消息会丢失.
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', listener);
  }, []);

  const view = useMemo(() => describePreview(message, text), [message]);
  const changeTab = (next: PreviewTab) => {
    setTab(next);
    vscode.setState({ tab: next });
  };
  return <PreviewRoot view={view} text={text} tab={tab} onTabChange={changeTab} locale={locale} />;
}

createRoot(container).render(<App />);
