// 预览 webview 的界面: 标题, 扩展组件模块提示, Schema / TS / 表单三个页签; 表单用 JotlForm(默认 @jotl/form 组件)渲染, 编译失败时各页签显示诊断.
import { createDefaultRegistry, JotlForm, type JotlFormProps, moduleWidgetRegistrations } from '@jotl/form';
import { Component, type ReactNode, useEffect, useMemo, useState } from 'react';
import { formatText, type PreviewText } from '../preview-text.js';
import {
  type DiagnosticsView,
  type ModulesView,
  PREVIEW_TABS,
  type PreviewTab,
  type PreviewView,
} from '../preview-view.js';
import { type CodeLanguage, highlight } from './highlight.js';

type ContentView = Extract<PreviewView, { kind: 'content' }>;

/** action 放在标题同一行的右端(如复制按钮). */
function Diagnostics({ heading, view, action }: { heading: string; view: DiagnosticsView; action?: ReactNode }) {
  return (
    <section>
      <div className="section-header">
        <h2>{`${heading}: ${view.summary}`}</h2>
        {action}
      </div>
      {view.items.length > 0 && (
        <ul className="diagnostics">
          {view.items.map((item, i) => (
            <li key={i} className={item.severity}>
              {item.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const COPY_FEEDBACK_MS = 1500;

/** 复制整段生成文本; 结果在按钮上短暂显示后恢复. */
function CopyButton({ code, text }: { code: string; text: PreviewText }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => {
    if (state === 'idle') return;
    const timer = setTimeout(() => setState('idle'), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [state]);
  const copy = () => {
    navigator.clipboard.writeText(code).then(
      () => setState('copied'),
      () => setState('failed')
    );
  };
  return (
    <button type="button" className="copy" onClick={copy}>
      {state === 'copied' ? text.copied : state === 'failed' ? text.copyFailed : text.copy}
    </button>
  );
}

/** 片段按纯文本渲染, 颜色由外壳样式里的 tok-* 类接到主题变量. */
function Code({ code, language }: { code: string; language: CodeLanguage }) {
  return (
    <pre className="code">
      {highlight(code, language).map((token, i) =>
        token.kind === 'plain' ? (
          token.text
        ) : (
          <span key={i} className={`tok-${token.kind}`}>
            {token.text}
          </span>
        )
      )}
    </pre>
  );
}

function CompileFailed({ view, text }: { view: ContentView; text: PreviewText }) {
  return (
    <>
      <p className="status">{text.compileFailed}</p>
      <Diagnostics heading={text.diagnostics} view={view.diagnostics} />
    </>
  );
}

/** 渲染期异常只影响表单页签, 不让整个 webview 白屏. */
class FormBoundary extends Component<{ children: ReactNode; crashedText: string }, { error: Error | undefined }> {
  override state: { error: Error | undefined } = { error: undefined };

  static getDerivedStateFromError(error: unknown): { error: Error } {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  override render() {
    if (this.state.error !== undefined)
      return <p className="status error">{formatText(this.props.crashedText, this.state.error.message)}</p>;
    return this.props.children;
  }
}

type Locale = NonNullable<JotlFormProps['locale']>;

/** 开启加载时: 配置中的模块登记到默认注册表的扩展上, schema 根 x-ui.widgets 的模块由 JotlForm 按文档目录解析(同名覆盖配置). */
function PreviewForm({
  schema,
  modules,
  locale,
}: {
  schema: unknown;
  modules: ModulesView;
  locale: Locale | undefined;
}) {
  const configKey = modules.load ? JSON.stringify(modules.config) : '{}';
  const registry = useMemo(() => {
    if (configKey === '{}') return undefined;
    const extended = createDefaultRegistry().extend();
    for (const registration of moduleWidgetRegistrations(JSON.parse(configKey) as ModulesView['config'])) {
      extended.register(registration);
    }
    return extended;
  }, [configKey]);
  const schemaModules: JotlFormProps['schemaModules'] = modules.load
    ? modules.baseUrl === undefined
      ? true
      : { baseUrl: modules.baseUrl }
    : false;
  return (
    <JotlForm
      schema={schema as JotlFormProps['schema']}
      id="jotl-preview-form"
      schemaModules={schemaModules}
      {...(registry === undefined ? {} : { registry })}
      {...(locale === undefined ? {} : { locale })}
    />
  );
}

function ModulesNotice({ modules, text }: { modules: ModulesView; text: PreviewText }) {
  if (modules.declared.length === 0) return null;
  const names = modules.declared.join(', ');
  return (
    <p className="status modules">{formatText(modules.load ? text.modulesLoaded : text.modulesNotLoaded, names)}</p>
  );
}

function TabPanel({
  tab,
  view,
  text,
  locale,
}: {
  tab: PreviewTab;
  view: ContentView;
  text: PreviewText;
  locale: Locale | undefined;
}) {
  if (view.schema === undefined) return <CompileFailed view={view} text={text} />;
  switch (tab) {
    case 'schema':
      return (
        <>
          <Diagnostics
            heading={text.diagnostics}
            view={view.diagnostics}
            action={<CopyButton code={view.schema} text={text} />}
          />
          <Code code={view.schema} language="json" />
        </>
      );
    case 'typescript':
      return (
        <>
          <Diagnostics
            heading={text.typescriptDiagnostics}
            view={view.typescriptDiagnostics}
            action={view.typescript === undefined ? undefined : <CopyButton code={view.typescript} text={text} />}
          />
          {view.typescript === undefined ? (
            <p className="status">{text.typescriptFailed}</p>
          ) : (
            <Code code={view.typescript} language="typescript" />
          )}
        </>
      );
    case 'form':
      return (
        <>
          <p className="status">{text.formNote}</p>
          {/* schema 变化时重建表单与边界, 丢弃旧 schema 下的输入与错误状态. */}
          <FormBoundary key={view.schema} crashedText={text.formCrashed}>
            <PreviewForm schema={view.formSchema} modules={view.modules} locale={locale} />
          </FormBoundary>
        </>
      );
  }
}

export interface PreviewRootProps {
  view: PreviewView;
  text: PreviewText;
  tab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
  /** 表单语言; 缺省时取 @jotl/core 的全局语言. */
  locale?: Locale;
}

export function PreviewRoot({ view, text, tab, onTabChange, locale }: PreviewRootProps) {
  if (view.kind === 'message') {
    return (
      <>
        <h1>{view.title}</h1>
        <p className="status">{view.status}</p>
      </>
    );
  }
  return (
    <>
      <h1>{view.title}</h1>
      <ModulesNotice modules={view.modules} text={text} />
      <div className="tabs" role="tablist" aria-label={text.tabList}>
        {PREVIEW_TABS.map(name => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`tab-${name}`}
            aria-selected={name === tab}
            aria-controls={`panel-${name}`}
            className={name === tab ? 'tab selected' : 'tab'}
            onClick={() => onTabChange(name)}
          >
            {text.tabs[name]}
          </button>
        ))}
      </div>
      <div className="panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        <TabPanel tab={tab} view={view} text={text} locale={locale} />
      </div>
    </>
  );
}
