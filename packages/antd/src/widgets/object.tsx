// 对象组件 page / inline: 分组用 Card, tabs 布局用 Tabs, grid 布局按列数排布; 有 additional 时其后是 "其他键" 卡片, 复用 @jotl/form 的 EntryEditor.
import type { CSSProperties, ReactNode } from 'react';
import { Card, Tabs, Typography } from 'antd';
import { escapePointerToken, isSchemaObject } from '@jotl/core';
import { EntryEditor, partitionFields, tabSections, useL10n, type FieldSection } from '@jotl/form';
import type { LayoutProps } from '@jotl/form/core';
import { nameId } from '../shared.js';

type AntdLayoutProps = LayoutProps<ReactNode>;

/** 须等于 x-ui 未写 columns 时 core/ 规划给出的默认列数. */
const DEFAULT_GRID_COLUMNS = 2;

function gridStyle(columns: number): CSSProperties {
  const count = Number.isInteger(columns) && columns > 0 ? columns : DEFAULT_GRID_COLUMNS;
  return { display: 'grid', gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, columnGap: 16 };
}

function Fields({ props, keys }: { props: AntdLayoutProps; keys: readonly string[] }) {
  const style = props.layout === 'grid' ? gridStyle(props.columns) : undefined;
  return (
    <div className="jotl-object-fields" style={style}>
      {keys.map(key => (
        <div key={key} className="jotl-object-field">
          {props.renderChild(escapePointerToken(key))}
        </div>
      ))}
    </div>
  );
}

function StackSections({ props, sections }: { props: AntdLayoutProps; sections: readonly FieldSection[] }) {
  return (
    <>
      {sections.map((section, i) =>
        section.title === undefined ? (
          <Fields key={`u${i}`} props={props} keys={section.keys} />
        ) : (
          <Card key={`g${i}`} size="small" className="jotl-group" title={section.title} style={{ marginBottom: 16 }}>
            <Fields props={props} keys={section.keys} />
          </Card>
        )
      )}
    </>
  );
}

function TabSections({ props, sections }: { props: AntdLayoutProps; sections: readonly FieldSection[] }) {
  const t = useL10n();
  const tabs = tabSections(sections);
  if (tabs.length === 0) return <StackSections props={props} sections={sections} />;
  const errorCounts = new Map(props.fields.map(field => [field.key, field.errorCount ?? 0]));
  return (
    <Tabs
      className="jotl-tabs"
      items={tabs.map((tab, i) => {
        const errors = tab.keys.reduce((sum, key) => sum + (errorCounts.get(key) ?? 0), 0);
        return {
          key: String(i),
          label: (
            <span>
              {tab.title}
              {errors > 0 && (
                <Typography.Text type="danger" className="jotl-tab-errors">
                  {' '}
                  {t(`${errors} 个错误`, errors === 1 ? '1 error' : `${errors} errors`)}
                </Typography.Text>
              )}
            </span>
          ),
          disabled: props.mode === 'disabled',
          // 未选中的标签页也要渲染字段, 校验跳转与错误计数依赖它们存在.
          forceRender: true,
          children: <Fields props={props} keys={tab.keys} />,
        };
      })}
    />
  );
}

export function AntdPageWidget(props: AntdLayoutProps) {
  const t = useL10n();
  const title = props.schema.title;
  const sections = partitionFields(props.fields, props.groups);
  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 改用 fieldset 会改变 DOM 结构与 antd 布局; group 角色经 aria-labelledby 取外壳标签
    <div
      id={props.id}
      role="group"
      aria-labelledby={nameId(props.id)}
      className={`jotl-object jotl-object--${props.layout} jotl-antd-object`}
    >
      {typeof title === 'string' && title !== '' && (
        <Typography.Title level={5} className="jotl-object-title">
          {title}
        </Typography.Title>
      )}
      {props.layout === 'tabs' ? (
        <TabSections props={props} sections={sections} />
      ) : (
        <StackSections props={props} sections={sections} />
      )}
      {props.additional !== undefined && (
        <Card size="small" className="jotl-group jotl-object-additional" title={t('其他键', 'Other keys')}>
          <EntryEditor
            {...props.additional}
            id={`${props.id}-additional`}
            mode={props.mode}
            renderChild={props.renderChild}
            reserved={isSchemaObject(props.schema.properties) ? Object.keys(props.schema.properties) : []}
          />
        </Card>
      )}
    </div>
  );
}
