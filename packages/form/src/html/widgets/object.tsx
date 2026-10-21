// 对象组件 page / inline: fieldset 排版子字段, 按 layout 选择 stack, tabs 或 grid 排版, 未支持的布局按 stack 排版; 有 additional 时其后是 "其他键" 区.
import { useState, type ComponentType, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { escapePointerToken, isSchemaObject } from '@jotl/core';
import type { LayoutField } from '../../core/index.js';
import { useCopy } from '../copy.js';
import { nameId } from '../ids.js';
import type { HtmlLayoutProps } from '../props.js';
import { styles } from '../styles.js';
import { EntryEditor } from './map.js';

export interface FieldSection {
  /** 未分组字段的分区为 undefined. */
  title: string | undefined;
  keys: string[];
}

/** 可见字段按分组切分: 未分组字段在前, 各分组按声明顺序; 一个字段只归入它出现的第一个分组, 空分组省略. */
export function partitionFields(fields: readonly LayoutField[], groups: HtmlLayoutProps['groups']): FieldSection[] {
  const visible = fields.filter(field => !field.hidden).map(field => field.key);
  const visibleSet = new Set(visible);
  const owner = new Map<string, number>();
  groups.forEach((group, i) => {
    for (const key of group.fields) if (visibleSet.has(key) && !owner.has(key)) owner.set(key, i);
  });
  const sections: FieldSection[] = [{ title: undefined, keys: visible.filter(key => !owner.has(key)) }];
  groups.forEach((group, i) => {
    // 组内字段按 fields 的顺序(已按 order 排好)排列, 不按 group.fields 的书写顺序.
    sections.push({ title: group.title, keys: visible.filter(key => owner.get(key) === i) });
  });
  return sections.filter(section => section.keys.length > 0);
}

export interface ObjectLayoutProps {
  props: HtmlLayoutProps;
  sections: FieldSection[];
  renderField(key: string): ReactNode;
}

function StackLayout({ sections, renderField }: ObjectLayoutProps) {
  return (
    <>
      {sections.map((section, i) =>
        section.title === undefined ? (
          <div key={`u${i}`} className={`jotl-object-fields ${styles.objectFields}`}>
            {section.keys.map(renderField)}
          </div>
        ) : (
          <fieldset key={`g${i}`} className={`jotl-group ${styles.group}`}>
            <legend className={`jotl-group-title ${styles.objectTitle}`}>{section.title}</legend>
            {section.keys.map(renderField)}
          </fieldset>
        )
      )}
    </>
  );
}

/** 标签页: 每个分组一页, 未分组字段并入第一页; 没有分组时返回空数组. */
export function tabSections(sections: readonly FieldSection[]): FieldSection[] {
  const grouped = sections.filter(section => section.title !== undefined);
  const [first, ...rest] = grouped;
  if (first === undefined) return [];
  const ungrouped = sections.find(section => section.title === undefined)?.keys ?? [];
  return [{ title: first.title, keys: [...ungrouped, ...first.keys] }, ...rest];
}

interface TabSelection {
  index: number;
  title: string | undefined;
}

/** 选中项同时记下标与标题: 前面的分组因字段全部隐藏而消失时按标题找回, 标题重复时按下标区分. */
function activeTab(tabs: readonly FieldSection[], selection: TabSelection): number {
  if (tabs[selection.index]?.title === selection.title) return selection.index;
  const byTitle = tabs.findIndex(tab => tab.title === selection.title);
  return byTitle === -1 ? 0 : byTitle;
}

const tabId = (id: string, index: number): string => `${id}-tab-${index}`;
const panelId = (id: string, index: number): string => `${id}-tabpanel-${index}`;

/** 选中的标签页只是展示状态, 不写回数据. */
function TabsLayout(layout: ObjectLayoutProps) {
  const COPY = useCopy();
  const { props, sections, renderField } = layout;
  const [selection, setSelection] = useState<TabSelection>({ index: 0, title: undefined });
  const tabs = tabSections(sections);
  if (tabs.length === 0) return <StackLayout {...layout} />;
  const active = activeTab(tabs, selection);
  const errorCounts = new Map(props.fields.map(field => [field.key, field.errorCount ?? 0]));
  const tabErrors = tabs.map(tab => tab.keys.reduce((sum, key) => sum + (errorCounts.get(key) ?? 0), 0));
  const select = (index: number, focus: boolean) => {
    setSelection({ index, title: tabs[index]?.title });
    if (focus) document.getElementById(tabId(props.id, index))?.focus();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const last = tabs.length - 1;
    const target = {
      ArrowRight: active === last ? 0 : active + 1,
      ArrowLeft: active === 0 ? last : active - 1,
      Home: 0,
      End: last,
    }[e.key];
    if (target === undefined) return;
    e.preventDefault();
    select(target, true);
  };
  return (
    <>
      <div className={`jotl-tabs ${styles.tabs}`} role="tablist">
        {tabs.map((tab, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            id={tabId(props.id, i)}
            className={`jotl-tab ${styles.tab}`}
            aria-selected={i === active}
            aria-controls={panelId(props.id, i)}
            tabIndex={i === active ? 0 : -1}
            disabled={props.mode === 'disabled'}
            onClick={() => select(i, false)}
            onKeyDown={onKeyDown}
          >
            {tab.title}
            {tabErrors[i]! > 0 && ' '}
            {tabErrors[i]! > 0 && (
              <span className={`jotl-tab-errors ${styles.tabErrors}`}>{COPY.tabErrors(tabErrors[i]!)}</span>
            )}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div
          key={i}
          role="tabpanel"
          id={panelId(props.id, i)}
          className={`jotl-tabpanel jotl-object-fields ${styles.objectFields} ${styles.tabpanel}`}
          aria-labelledby={tabId(props.id, i)}
          hidden={i !== active}
        >
          {tab.keys.map(renderField)}
        </div>
      ))}
    </>
  );
}

/** 须等于 x-ui 未写 columns 时 core/ 规划给出的默认列数. */
const DEFAULT_GRID_COLUMNS = 2;

function gridStyle(columns: number): CSSProperties {
  const count = Number.isInteger(columns) && columns > 0 ? columns : DEFAULT_GRID_COLUMNS;
  return { '--jotl-columns': String(count) } as CSSProperties;
}

function GridLayout({ props, sections, renderField }: ObjectLayoutProps) {
  const style = gridStyle(props.columns);
  return (
    <>
      {sections.map((section, i) =>
        section.title === undefined ? (
          <div key={`u${i}`} className={`jotl-object-fields jotl-object-grid ${styles.objectGrid}`} style={style}>
            {section.keys.map(renderField)}
          </div>
        ) : (
          <fieldset key={`g${i}`} className={`jotl-group ${styles.group}`}>
            <legend className={`jotl-group-title ${styles.objectTitle}`}>{section.title}</legend>
            <div className={`jotl-object-grid ${styles.objectGrid}`} style={style}>
              {section.keys.map(renderField)}
            </div>
          </fieldset>
        )
      )}
    </>
  );
}

const OBJECT_LAYOUTS: Partial<Record<HtmlLayoutProps['layout'], ComponentType<ObjectLayoutProps>>> = {
  stack: StackLayout,
  tabs: TabsLayout,
  grid: GridLayout,
};

export function PageWidget(props: HtmlLayoutProps) {
  const COPY = useCopy();
  const Layout = OBJECT_LAYOUTS[props.layout] ?? StackLayout;
  const title = props.schema.title;
  const renderField = (key: string) => (
    <div key={key} className="jotl-object-field">
      {props.renderChild(escapePointerToken(key))}
    </div>
  );
  return (
    // 外壳 label 的 for 关联不到 fieldset, 由 aria-labelledby 取外壳标签作为组名; 没有外壳时该 id 不存在, 组名回落到 legend.
    <fieldset
      id={props.id}
      className={`jotl-object jotl-object--${props.layout} ${styles.object}`}
      aria-labelledby={nameId(props.id)}
      disabled={props.mode === 'disabled'}
    >
      {typeof title === 'string' && title !== '' && (
        <legend className={`jotl-object-title ${styles.objectTitle}`}>{title}</legend>
      )}
      <Layout props={props} sections={partitionFields(props.fields, props.groups)} renderField={renderField} />
      {props.additional !== undefined && (
        <fieldset className={`jotl-group jotl-object-additional ${styles.group}`}>
          <legend className={`jotl-group-title ${styles.objectTitle}`}>{COPY.additionalKeys}</legend>
          <div className={`jotl-map ${styles.map}`}>
            <EntryEditor
              {...props.additional}
              id={`${props.id}-additional`}
              mode={props.mode}
              renderChild={props.renderChild}
              reserved={isSchemaObject(props.schema.properties) ? Object.keys(props.schema.properties) : []}
            />
          </div>
        </fieldset>
      )}
    </fieldset>
  );
}
