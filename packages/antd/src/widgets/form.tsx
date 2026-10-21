// 表单根组件: 原生 form 承接提交与重置, antd Form(不渲染元素)提供纵向布局与禁用上下文; 不属于可见字段的错误用 Alert 显示.
import type { FormEvent, ReactNode } from 'react';
import { Alert, Button, Form, Space } from 'antd';
import { errorId, useL10n } from '@jotl/form';
import type { ViewProps } from '@jotl/form/core';

export function AntdFormWidget(props: ViewProps<ReactNode>) {
  const t = useL10n();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (props.mode === 'edit') props.submit();
  };
  const onReset = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (props.mode === 'edit') props.reset();
  };
  return (
    // noValidate: 校验由 Jotl 完成, 去掉后原生约束会拦下提交而不调用 submit().
    <form
      id={props.id}
      className={`jotl-form jotl-form--${props.mode} jotl-antd-form`}
      noValidate
      onSubmit={onSubmit}
      onReset={onReset}
    >
      <Form component={false} layout="vertical" disabled={props.mode === 'disabled'}>
        {props.errors.length > 0 && (
          <div id={errorId(props.id)} className="jotl-errors" style={{ marginBottom: 16 }}>
            <Alert
              type="error"
              showIcon
              description={
                <ul style={{ margin: 0, paddingInlineStart: 16 }}>
                  {props.errors.map((error, i) => (
                    <li key={i} className="jotl-error">
                      {error.message}
                    </li>
                  ))}
                </ul>
              }
            />
          </div>
        )}
        {props.children}
        {props.mode === 'edit' && (
          <Space className="jotl-form-actions">
            <Button type="primary" htmlType="submit">
              {t('提交', 'Submit')}
            </Button>
            <Button htmlType="reset">{t('重置', 'Reset')}</Button>
          </Space>
        )}
      </Form>
    </form>
  );
}
