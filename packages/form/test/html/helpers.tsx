// 测试工具: 各层组件 props 的工厂与示例诊断.
import { cleanup } from '@testing-library/react';
import type { Diagnostic } from '@jotl/core';
import type { RenderMode } from '../../src/core/index.js';
import type { ReactNode } from 'react';
import { afterEach, vi, type Mock } from 'vitest';
import type {
  HtmlArrayProps,
  HtmlDecoratorProps,
  HtmlFieldProps,
  HtmlLayoutProps,
  HtmlMapProps,
  HtmlNullableProps,
  HtmlTreeProps,
  HtmlTupleProps,
  HtmlUnionProps,
  HtmlViewProps,
} from '../../src/html/index.js';

// 未启用 vitest globals, testing-library 不会自动清理, 不注册会让上一个用例的 DOM 残留.
afterEach(cleanup);

export const MODES: RenderMode[] = ['edit', 'view', 'disabled'];

export const ERROR: Diagnostic = { code: 'JOTL4001', severity: 'error', message: '类型不符' };

type RenderChildMock = Mock<(relativePath: string) => ReactNode>;

function base() {
  return {
    id: 'f',
    dataPath: '/f',
    mode: 'edit' as RenderMode,
    props: {},
    adapters: {},
    renderChild: vi.fn((path: string): ReactNode => (
      <span data-child={path}>{`child:${path}`}</span>
    )) as RenderChildMock,
  };
}

export function fieldProps<V>(overrides: Partial<HtmlFieldProps<V>> = {}) {
  const props = {
    ...base(),
    schema: { type: 'string' },
    required: false,
    value: undefined,
    onChange: vi.fn<(value: V | undefined) => void>(),
    onBlur: vi.fn<() => void>(),
    errors: [] as Diagnostic[],
    ...overrides,
  };
  return props as HtmlFieldProps<V> & { onChange: typeof props.onChange; onBlur: typeof props.onBlur };
}

export function layoutProps(overrides: Partial<HtmlLayoutProps> = {}) {
  const props = {
    ...base(),
    schema: { type: 'object' },
    fields: [],
    groups: [],
    layout: 'stack' as const,
    columns: 2,
    ...overrides,
  };
  return props as HtmlLayoutProps & { renderChild: RenderChildMock };
}

export function arrayProps(overrides: Partial<HtmlArrayProps> = {}) {
  const props = {
    ...base(),
    schema: { type: 'array' },
    items: [],
    canAdd: true,
    canRemove: true,
    add: vi.fn<(index?: number) => void>(),
    remove: vi.fn<(index: number) => void>(),
    move: vi.fn<(from: number, to: number) => void>(),
    errors: [] as Diagnostic[],
    ...overrides,
  };
  return props as HtmlArrayProps & Pick<typeof props, 'add' | 'remove' | 'move'> & { renderChild: RenderChildMock };
}

type RenderContentMock = Mock<() => ReactNode>;

const content = () => vi.fn((): ReactNode => <span data-content="">content</span>) as RenderContentMock;

export function unionProps(overrides: Partial<HtmlUnionProps> = {}) {
  const props = {
    ...base(),
    schema: { oneOf: [{ type: 'string' }, { type: 'number' }] },
    branches: [{ title: '文本' }, { title: '数字' }],
    activeBranch: 0,
    selectBranch: vi.fn<(index: number) => void>(),
    renderContent: content(),
    errors: [] as Diagnostic[],
    ...overrides,
  };
  return props as HtmlUnionProps & Pick<typeof props, 'selectBranch' | 'renderContent'>;
}

export function nullableProps(overrides: Partial<HtmlNullableProps> = {}) {
  const props = {
    ...base(),
    schema: { type: ['string', 'null'] },
    isNull: false,
    setNull: vi.fn<(isNull: boolean) => void>(),
    renderContent: content(),
    errors: [] as Diagnostic[],
    ...overrides,
  };
  return props as HtmlNullableProps & Pick<typeof props, 'setNull' | 'renderContent'>;
}

export function treeProps(overrides: Partial<HtmlTreeProps> = {}) {
  const props = {
    ...base(),
    schema: { $ref: '#' },
    expanded: false,
    setExpanded: vi.fn<(expanded: boolean) => void>(),
    renderContent: content(),
    errors: [] as Diagnostic[],
    ...overrides,
  };
  return props as HtmlTreeProps & Pick<typeof props, 'setExpanded' | 'renderContent'>;
}

export function mapProps(overrides: Partial<HtmlMapProps> = {}) {
  const props = {
    ...base(),
    schema: { type: 'object', additionalProperties: { type: 'string' } },
    entries: [],
    canAdd: true,
    canRemove: true,
    addEntry: vi.fn<(name: string) => void>(),
    removeEntry: vi.fn<(name: string) => void>(),
    renameEntry: vi.fn<(from: string, to: string) => void>(),
    errors: [] as Diagnostic[],
    ...overrides,
  };
  return props as HtmlMapProps &
    Pick<typeof props, 'addEntry' | 'removeEntry' | 'renameEntry'> & { renderChild: RenderChildMock };
}

export function tupleProps(overrides: Partial<HtmlTupleProps> = {}) {
  const props = {
    ...base(),
    schema: { type: 'array', prefixItems: [{ type: 'string' }, { type: 'number' }] },
    items: [] as HtmlTupleProps['items'],
    errors: [] as Diagnostic[],
    ...overrides,
  };
  return props as HtmlTupleProps & { renderChild: RenderChildMock };
}

export function decoratorProps(overrides: Partial<HtmlDecoratorProps> = {}): HtmlDecoratorProps {
  return { id: 'f', required: false, errors: [], hidden: false, children: null, ...overrides };
}

export function viewProps(overrides: Partial<HtmlViewProps> = {}) {
  const props = {
    ...base(),
    id: 'form',
    schema: { type: 'object' },
    submit: vi.fn<() => void>(),
    reset: vi.fn<() => void>(),
    children: null,
    errors: [] as Diagnostic[],
    ...overrides,
  };
  return props as HtmlViewProps & Pick<typeof props, 'submit' | 'reset'>;
}
