// 数组组件 list: 每个元素一张 Card, 右上角上移, 下移, 复制(渲染器提供 duplicate 时), 删除; 底部新增按钮; 数组自身的错误显示在末尾.
import type { ReactNode } from 'react';
import { Button, Card, Space, Typography } from 'antd';
import { errorId, useL10n } from '@jotl/form';
import type { ArrayProps } from '@jotl/form/core';
import { nameId } from '../shared.js';

export function AntdListWidget(props: ArrayProps<ReactNode>) {
  const t = useL10n();
  const editable = props.mode === 'edit';
  const showActions = props.mode !== 'view';
  const last = props.items.length - 1;
  const invalid = props.errors.length > 0;
  return (
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 改用 fieldset 会改变 DOM 结构与 antd 布局; group 角色经 aria-labelledby 取外壳标签
    <div
      id={props.id}
      role="group"
      aria-labelledby={nameId(props.id)}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={invalid ? errorId(props.id) : undefined}
      className="jotl-array jotl-antd-array"
    >
      <ol className="jotl-array-items" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {props.items.map((item, i) => (
          <li key={item.key} className="jotl-array-item" style={{ marginBottom: 12 }}>
            <Card
              size="small"
              title={`#${i + 1}`}
              extra={
                showActions && (
                  <Space size={0} className="jotl-array-item-actions">
                    <Button
                      type="link"
                      size="small"
                      aria-label={t(`上移第 ${i + 1} 项`, `Move item ${i + 1} up`)}
                      disabled={!editable || i === 0}
                      onClick={() => props.move(i, i - 1)}
                    >
                      {t('上移', 'Up')}
                    </Button>
                    <Button
                      type="link"
                      size="small"
                      aria-label={t(`下移第 ${i + 1} 项`, `Move item ${i + 1} down`)}
                      disabled={!editable || i === last}
                      onClick={() => props.move(i, i + 1)}
                    >
                      {t('下移', 'Down')}
                    </Button>
                    {props.duplicate !== undefined && (
                      <Button
                        type="link"
                        size="small"
                        aria-label={t(`复制第 ${i + 1} 项`, `Duplicate item ${i + 1}`)}
                        disabled={!props.canAdd}
                        onClick={() => props.duplicate?.(i)}
                      >
                        {t('复制', 'Duplicate')}
                      </Button>
                    )}
                    <Button
                      type="link"
                      size="small"
                      danger
                      aria-label={t(`删除第 ${i + 1} 项`, `Remove item ${i + 1}`)}
                      disabled={!props.canRemove}
                      onClick={() => props.remove(i)}
                    >
                      {t('删除', 'Remove')}
                    </Button>
                  </Space>
                )
              }
            >
              {props.renderChild(String(i))}
            </Card>
          </li>
        ))}
      </ol>
      {showActions && (
        <Button type="dashed" block className="jotl-array-add" disabled={!props.canAdd} onClick={() => props.add()}>
          {t('新增', 'Add')}
        </Button>
      )}
      {invalid && (
        <div id={errorId(props.id)} className="jotl-errors" role="alert">
          {props.errors.map((error, i) => (
            <Typography.Text key={i} type="danger" className="jotl-error" style={{ display: 'block' }}>
              {error.message}
            </Typography.Text>
          ))}
        </div>
      )}
    </div>
  );
}
