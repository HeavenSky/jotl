// 预览 webview 的 HTML 外壳: 严格 CSP(脚本只放行带 nonce 的那一个, 样式只来自 nonce 与扩展目录), 脚本与表单样式只从扩展目录加载;
// 开启扩展组件模块时另放行本地资源与 https 模块, 并用 import map 把 react 等说明符指到共享同一份 React 的垫片;
// 代码着色与表单的 --jotl-* 变量都接到 VS Code 主题变量上, 随浅色, 深色与高对比度主题切换.
import { randomBytes } from 'node:crypto';
import type { PreviewText } from './preview-text.js';

export interface PreviewHtmlOptions {
  /** `webview.cspSource`. */
  cspSource: string;
  nonce: string;
  /** 经 `webview.asWebviewUri` 转换后的预览脚本地址. */
  scriptUri: string;
  /** 经 `webview.asWebviewUri` 转换后的表单组件样式(`@jotl/form/style.css` 的副本)地址. */
  formStyleUri: string;
  title: string;
  /** 已本地化的界面文字, 序列化后交给 webview 脚本. */
  text: PreviewText;
  /** `vscode.env.language`, 写入 html 的 lang. */
  lang: string;
  /** 开启扩展组件模块时给出: import map 的说明符 → 垫片地址(经 `webview.asWebviewUri` 转换). */
  sharedModules?: Readonly<Record<string, string>>;
}

const NONCE_BYTES = 16;

export function createNonce(): string {
  return randomBytes(NONCE_BYTES).toString('base64');
}

/** 只用于文本内容与双引号属性值; CSP 中的单引号必须原样保留. */
function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
}

const STYLE = `
body { font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); padding: 0 16px 16px; }
h1 { font-size: 1.2em; }
h2 { font-size: 1em; margin-top: 1em; }
.section-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 1em; }
.section-header h2 { margin: 0; }
button.copy { flex: none; font: inherit; color: var(--vscode-button-secondaryForeground); background: var(--vscode-button-secondaryBackground); border: 1px solid var(--vscode-button-border, transparent); border-radius: 2px; padding: 2px 10px; cursor: pointer; }
button.copy:hover { background: var(--vscode-button-secondaryHoverBackground); }
button.copy:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 2px; }
.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--vscode-panel-border); }
.tab { font: inherit; color: var(--vscode-foreground); background: none; border: none; border-bottom: 2px solid transparent; padding: 4px 12px; cursor: pointer; }
.tab.selected { border-bottom-color: var(--vscode-focusBorder); font-weight: 600; }
.panel { padding-top: 8px; }
.status { color: var(--vscode-descriptionForeground); }
.status.error { color: var(--vscode-errorForeground); }
ul.diagnostics { list-style: none; padding: 0; margin: 0; }
ul.diagnostics li { padding: 2px 0; font-family: var(--vscode-editor-font-family); white-space: pre-wrap; }
li.error { color: var(--vscode-errorForeground); }
li.warning { color: var(--vscode-editorWarning-foreground); }
li.info { color: var(--vscode-editorInfo-foreground); }
pre.code { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); background: var(--vscode-textCodeBlock-background); padding: 8px; overflow: auto; }
.tok-comment { color: var(--vscode-descriptionForeground); font-style: italic; }
.tok-doctag { color: var(--vscode-debugTokenExpression-boolean); font-style: italic; }
.tok-string { color: var(--vscode-debugTokenExpression-string); }
.tok-number { color: var(--vscode-debugTokenExpression-number); }
.tok-keyword, .tok-literal { color: var(--vscode-debugTokenExpression-boolean); }
.tok-type { color: var(--vscode-terminal-ansiCyan, var(--vscode-symbolIcon-classForeground)); }
.tok-property { color: var(--vscode-symbolIcon-variableForeground, var(--vscode-debugTokenExpression-name)); }
body.vscode-light, body.vscode-high-contrast-light { color-scheme: light; }
body.vscode-dark, body.vscode-high-contrast:not(.vscode-high-contrast-light) { color-scheme: dark; }
#root {
  --jotl-text: var(--vscode-foreground);
  --jotl-muted: var(--vscode-descriptionForeground);
  --jotl-border: var(--vscode-input-border, var(--vscode-widget-border, var(--vscode-panel-border)));
  --jotl-divider: var(--vscode-panel-border, var(--vscode-widget-border));
  --jotl-surface: var(--vscode-input-background);
  --jotl-focus: var(--vscode-focusBorder);
  --jotl-focus-hover: var(--vscode-focusBorder);
  --jotl-focus-ring: color-mix(in srgb, var(--vscode-focusBorder) 35%, transparent);
  --jotl-error: var(--vscode-inputValidation-errorBorder, var(--vscode-errorForeground));
  --jotl-disabled-bg: var(--vscode-editorWidget-background);
  --jotl-disabled-text: var(--vscode-disabledForeground);
  --jotl-switch-off: color-mix(in srgb, var(--vscode-foreground) 30%, transparent);
  --jotl-option-hover: var(--vscode-list-hoverBackground);
  --jotl-option-selected: var(--vscode-list-inactiveSelectionBackground);
  --jotl-panel-header: var(--vscode-sideBarSectionHeader-background, var(--vscode-editorWidget-background));
}
@supports not (appearance: base-select) {
  body.vscode-dark .jotl-select:not([multiple]), body.vscode-high-contrast:not(.vscode-high-contrast-light) .jotl-select:not([multiple]) {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 4.5 6 8l3.5-3.5' fill='none' stroke='%23fff' stroke-opacity='.45' stroke-width='1.2'/%3E%3C/svg%3E");
  }
}
`;

/** import map 写在 script 元素内, `<` 必须转义, 否则地址中的 `</script>` 会提前结束元素. */
function importMap(imports: Readonly<Record<string, string>>): string {
  return JSON.stringify({ imports }).replace(/</g, '\\u003c');
}

export function renderPreviewHtml(options: PreviewHtmlOptions): string {
  const nonce = escapeHtml(options.nonce);
  const modules = options.sharedModules;
  const csp = [
    "default-src 'none'",
    `style-src ${options.cspSource} 'nonce-${nonce}'`,
    // 表单校验用的 Ajv 按 schema 生成校验函数(new Function), 没有 'unsafe-eval' 时校验抛错; 脚本来源仍只放行带 nonce 的标签.
    // 动态 import() 不受 nonce 约束, 开启模块时按来源放行垫片与本地模块(扩展与工作区资源)及 https 模块.
    `script-src 'nonce-${nonce}' 'unsafe-eval'${modules === undefined ? '' : ` ${options.cspSource} https:`}`,
    // 表单中的图片字段显示使用者填写的 https 地址.
    `img-src ${options.cspSource} https: data:`,
    `font-src ${options.cspSource}`,
  ].join('; ');
  return `<!DOCTYPE html>
<html lang="${escapeHtml(options.lang)}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${escapeHtml(csp)}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(options.title)}</title>
<link rel="stylesheet" href="${escapeHtml(options.formStyleUri)}">
<style nonce="${nonce}">${STYLE}</style>
</head>
<body>
<div id="root" data-text="${escapeHtml(JSON.stringify(options.text))}"></div>
${modules === undefined ? '' : `<script type="importmap" nonce="${nonce}">${importMap(modules)}</script>\n`}<script nonce="${nonce}" src="${escapeHtml(options.scriptUri)}"></script>
</body>
</html>
`;
}
