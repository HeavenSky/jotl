// 右侧输出区: JSON Schema, TS 输出, 表单预览, 降级调试四个页签; 编译失败时保留上一次成功的结果并标注已过期.
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { Locale } from '@jotl/core';
import { JotlDebug, schemaWidgetModules, useDegradeLog } from '@jotl/form';
import type { CompiledSchema, PlaygroundBuild } from './compile.js';
import { useCopy } from './copy.js';
import { moduleBaseUrl, moduleRegistry } from './widget-modules.js';
import { PanelErrorBoundary } from './error-boundary.js';
import { FormPreview } from './form-preview.js';
import { CodeBlock } from './highlight.js';

export const OUTPUT_TABS = ['schema', 'ts', 'form', 'debug'] as const;
export type OutputTab = (typeof OUTPUT_TABS)[number];

export interface OutputTabsProps {
  /** 最近一次编译成功的结果; 从未成功时缺省. */
  build?: PlaygroundBuild;
  /** 当前源码编译失败, build 来自更早的源码. */
  stale: boolean;
  locale: Locale;
}

const tabId = (tab: OutputTab) => `pg-tab-${tab}`;
const panelId = (tab: OutputTab) => `pg-panel-${tab}`;

function TabPanel({ tab, active, children }: { tab: OutputTab; active: OutputTab; children: ReactNode }) {
  return (
    <div className="pg-panel" role="tabpanel" id={panelId(tab)} aria-labelledby={tabId(tab)} hidden={tab !== active}>
      {children}
    </div>
  );
}

function TsOutput({ build }: { build: PlaygroundBuild }) {
  const COPY = useCopy();
  const text = build.ts?.text;
  if (text === undefined) return <p className="pg-alert">{COPY.output.tsFailed}</p>;
  return <CodeBlock text={text} lang="ts" testId="ts-output" />;
}

/** 按 schema 换 key 挂载, 降级记录随新 schema 清空; 调试视图的注册表另含 schema 声明的模块, 与表单实际使用的一致. */
function BuildPanels({
  build,
  output,
  active,
  locale,
}: {
  build: PlaygroundBuild;
  output: CompiledSchema;
  active: OutputTab;
  locale: Locale;
}) {
  const log = useDegradeLog();
  const baseUrl = moduleBaseUrl();
  const modulesKey = JSON.stringify(build.config?.config.modules ?? {});
  const registry = useMemo(() => moduleRegistry(JSON.parse(modulesKey), baseUrl), [modulesKey, baseUrl]);
  const debugRegistry = useMemo(
    () => moduleRegistry(schemaWidgetModules(output.schema), baseUrl, registry),
    [output.schema, baseUrl, registry]
  );
  return (
    <>
      <TabPanel tab="schema" active={active}>
        <CodeBlock text={output.schemaText} lang="json" testId="schema-output" />
      </TabPanel>
      <TabPanel tab="ts" active={active}>
        <TsOutput build={build} />
      </TabPanel>
      <TabPanel tab="form" active={active}>
        <PanelErrorBoundary resetKey={output.schemaText}>
          <FormPreview
            schema={output.schema}
            locale={locale}
            {...(registry === undefined ? {} : { registry })}
            onDegrade={log.onDegrade}
          />
        </PanelErrorBoundary>
      </TabPanel>
      <TabPanel tab="debug" active={active}>
        <PanelErrorBoundary resetKey={output.schemaText}>
          <JotlDebug
            schema={output.schema}
            locale={locale}
            {...(debugRegistry === undefined ? {} : { registry: debugRegistry })}
            events={log.events}
          />
        </PanelErrorBoundary>
      </TabPanel>
    </>
  );
}

export function OutputTabs({ build, stale, locale }: OutputTabsProps) {
  const COPY = useCopy();
  const [active, setActive] = useState<OutputTab>('form');
  const tabs = useRef(new Map<OutputTab, HTMLButtonElement>());

  const select = (tab: OutputTab) => {
    setActive(tab);
    tabs.current.get(tab)?.focus();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const index = OUTPUT_TABS.indexOf(active);
    const last = OUTPUT_TABS.length - 1;
    const target =
      event.key === 'ArrowRight'
        ? (index + 1) % OUTPUT_TABS.length
        : event.key === 'ArrowLeft'
          ? (index + last) % OUTPUT_TABS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : undefined;
    if (target === undefined) return;
    event.preventDefault();
    select(OUTPUT_TABS[target]!);
  };

  const output = build?.report.output;
  return (
    <section className="pg-output" aria-label={COPY.tabs.label}>
      <div className="pg-tablist" role="tablist" aria-label={COPY.tabs.label} onKeyDown={onKeyDown}>
        {OUTPUT_TABS.map(tab => (
          <button
            key={tab}
            ref={el => {
              if (el === null) tabs.current.delete(tab);
              else tabs.current.set(tab, el);
            }}
            type="button"
            role="tab"
            id={tabId(tab)}
            className="pg-tab"
            aria-selected={tab === active}
            aria-controls={panelId(tab)}
            tabIndex={tab === active ? 0 : -1}
            onClick={() => setActive(tab)}
          >
            {COPY.tabs[tab]}
          </button>
        ))}
      </div>
      {stale && (
        <p className="pg-stale" role="status" data-testid="stale-banner">
          {COPY.output.stale}
        </p>
      )}
      <div className={stale ? 'pg-panels pg-panels-stale' : 'pg-panels'}>
        {build === undefined || output === undefined ? (
          OUTPUT_TABS.map(tab => (
            <TabPanel key={tab} tab={tab} active={active}>
              <p className="pg-empty">{COPY.output.empty}</p>
            </TabPanel>
          ))
        ) : (
          <BuildPanels key={output.schemaText} build={build} output={output} active={active} locale={locale} />
        )}
      </div>
    </section>
  );
}
