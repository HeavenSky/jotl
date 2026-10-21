// 组件外观: 各 jotl- 语义类名对应的 jt: 前缀 Tailwind 工具类; 语义类名由组件自己输出, 外部覆盖与测试依赖它们.
import { cn as merge, tv } from 'tailwind-variants';

/** 合并类名, 冲突的工具类以后写的为准; 组合两个语义类(如 jotl-input + jotl-json)时靠它去掉被覆盖的一方. */
export function cn(...names: (string | false | null | undefined)[]): string {
  return merge(...names) ?? '';
}

/** 等同 font: inherit; 拆成单项是为了让 json 的等宽字体能经类名合并覆盖字体族(简写会排在所有工具类之后). */
const inheritFont =
  'jt:font-[family-name:inherit] jt:text-[length:inherit] jt:leading-[inherit] jt:font-[number:inherit] jt:[font-style:inherit]';

const focusRing = 'jt:focus-visible:outline-2 jt:focus-visible:outline-focus jt:focus-visible:outline-offset-1';

const control =
  `jt:box-border jt:w-full jt:min-h-[32px] jt:py-[4px] jt:text-inherit jt:transition-[border-color,box-shadow] jt:duration-200 jt:ease-[ease] jt:border jt:border-border jt:rounded-base jt:bg-surface ${inheritFont} ` +
  'jt:hover:border-focus jt:focus:border-focus jt:focus:outline-none jt:focus:shadow-focus jt:aria-invalid:border-error jt:disabled:bg-disabled-bg';

/** 文本类输入框: 只读与禁用同样灰底. */
const input = `${control} jt:px-[11px] jt:read-only:bg-disabled-bg`;

const select = tv({
  base: control,
  variants: {
    // 单选: 箭头画在右侧 30px 内; 支持 base-select 时箭头改由 ::picker-icon 画在 flex 行尾.
    multiple: {
      false:
        'jt:pl-[11px] jt:pr-[30px] jt:cursor-pointer jt:supports-[appearance:base-select]:flex jt:supports-[appearance:base-select]:items-center jt:supports-[appearance:base-select]:pr-[11px]',
      true: 'jt:px-[7px]',
    },
  },
  defaultVariants: { multiple: false },
});

const button = tv({
  base: `jt:h-[32px] jt:py-[4px] jt:px-[15px] jt:border jt:border-border jt:rounded-base jt:bg-surface ${inheritFont} jt:cursor-pointer jt:disabled:cursor-not-allowed jt:disabled:opacity-50 ${focusRing}`,
  variants: {
    primary: { true: 'jt:border-focus jt:bg-focus jt:text-on-accent' },
  },
});

const message = 'jt:m-0 jt:text-error jt:text-[0.875em]';

const uploadStatus = tv({
  base: 'jt:text-muted jt:text-[0.875em]',
  variants: {
    failed: { true: message },
  },
});

const stackGroup = 'jt:grid jt:gap-2 jt:justify-items-start';
const stretch = 'jt:justify-self-stretch jt:min-w-0';

export const styles = {
  form: 'jt:grid jt:gap-gap jt:text-text jt:text-[14px] jt:leading-[1.5715]',
  formActions: 'jt:flex jt:flex-none jt:gap-2',
  /** 对象与分组; 页面最外层的对象不加边框与内边距, 嵌套在其中的才是带边框的分组. */
  object:
    'jt:m-0 jt:grid jt:min-w-0 jt:gap-gap jt:p-gap jt:border jt:border-divider jt:rounded-base jt:page-root:p-0 jt:page-root:border-0',
  group: 'jt:m-0 jt:grid jt:min-w-0 jt:gap-gap jt:p-gap jt:border jt:border-divider jt:rounded-base',
  objectTitle: 'jt:px-2 jt:font-medium',
  objectFields: 'jt:grid jt:gap-gap',
  objectGrid: 'jt:grid jt:grid-cols-[repeat(var(--jotl-columns,2),minmax(0,1fr))] jt:gap-gap',
  tabs: 'jt:flex jt:flex-wrap jt:gap-1 jt:border-b jt:border-border',
  tab:
    `jt:-mb-px jt:px-3 jt:py-1.5 jt:border jt:border-transparent jt:rounded-t-base jt:rounded-b-none jt:bg-transparent ${inheritFont} jt:cursor-pointer jt:disabled:cursor-not-allowed ` +
    'jt:aria-selected:border-border jt:aria-selected:border-b-surface jt:aria-selected:bg-surface jt:aria-selected:text-focus jt:aria-selected:font-semibold ' +
    focusRing,
  tabErrors:
    'jt:ml-1 jt:px-1.5 jt:rounded-[999px] jt:bg-error jt:text-on-accent jt:text-[0.75rem] jt:font-normal jt:leading-[1.5]',
  tabpanel: 'jt:hidden-attr:hidden',
  field: 'jt:relative jt:grid jt:gap-2 jt:hidden-attr:hidden',
  label: 'jt:font-normal',
  required: 'jt:ml-[0.25em] jt:text-error jt:no-underline',
  description: 'jt:m-0 jt:text-muted jt:text-[0.875em]',
  errors: 'jt:grid jt:gap-0.5',
  error: message,
  /** 表单级错误列表中可点击定位的条目. */
  errorLink:
    `jt:p-0 jt:border-0 jt:bg-transparent jt:text-inherit ${inheritFont} jt:text-left jt:underline jt:cursor-pointer jt:hover:text-focus ` +
    focusRing,
  input,
  select,
  textarea: 'jt:min-h-20 jt:resize-y',
  json: 'jt:min-h-20 jt:resize-y jt:font-code',
  /** 查看态的 pre, 与 json 一起使用. */
  jsonView: 'jt:m-0 jt:p-2 jt:overflow-auto jt:rounded-base jt:bg-disabled-bg jt:whitespace-pre-wrap',
  number: 'jt:max-w-48',
  checkbox: `jt:m-0 jt:accent-focus ${focusRing}`,
  /** 开关: 原生 checkbox 画成胶囊, 选中为主色; 与 checkbox 一起使用. */
  switch:
    'jt:relative jt:w-[28px] jt:h-[16px] jt:m-0 jt:rounded-[8px] jt:bg-switch-off jt:appearance-none jt:cursor-pointer jt:transition-[background] jt:duration-200 jt:ease-[ease] ' +
    'jt:before:absolute jt:before:top-[2px] jt:before:left-[2px] jt:before:w-[12px] jt:before:h-[12px] jt:before:rounded-[50%] jt:before:bg-on-accent jt:before:transition-[left] jt:before:duration-200 jt:before:ease-[ease] ' +
    'jt:checked:bg-focus jt:checked:before:left-[14px] jt:disabled:cursor-not-allowed jt:disabled:opacity-40',
  choiceGroup:
    'jt:flex jt:flex-wrap jt:gap-x-6 jt:gap-y-1 jt:border jt:border-transparent jt:rounded-base jt:aria-invalid:border-error',
  option: 'jt:inline-flex jt:items-center jt:gap-2 jt:cursor-pointer',
  color: 'jt:flex jt:flex-row-reverse jt:items-center jt:gap-2',
  colorPicker: 'jt:flex-none jt:w-[32px] jt:h-[32px] jt:p-0 jt:border jt:border-border jt:rounded-base',
  /** 精确数与滑块: 文本框占满剩余宽度. */
  inline: 'jt:flex jt:items-center jt:gap-2',
  grow: 'jt:flex-1',
  resource: 'jt:grid jt:gap-1.5 jt:justify-items-start',
  resourceInput: 'jt:justify-self-stretch',
  uploadStatus,
  imagePreview: 'jt:max-w-full jt:max-h-48 jt:rounded-base jt:object-contain',
  richText: 'jt:grid jt:gap-1',
  richTextToolbar: 'jt:flex jt:flex-wrap jt:gap-1',
  richTextButton: 'jt:h-[24px] jt:px-[7px]',
  /** contenteditable 编辑区: 外观同文本框, div 没有原生的只读与禁用, 改按 aria 属性灰底. */
  richTextEditor: `${input} jt:min-h-20 jt:overflow-auto jt:aria-readonly:bg-disabled-bg jt:aria-disabled:bg-disabled-bg jt:aria-disabled:cursor-not-allowed`,
  output: 'jt:block jt:py-1.5',
  array: 'jt:grid jt:gap-2',
  arrayHeader: 'jt:flex jt:justify-end',
  arrayItems: 'jt:m-0 jt:p-0 jt:border jt:border-divider jt:list-none jt:empty:hidden',
  arrayItem:
    'jt:flex jt:items-center jt:gap-2 jt:min-h-[48px] jt:py-[8px] jt:pr-[16px] jt:pl-[12px] jt:border-divider jt:not-first:border-t',
  arrayItemContent: 'jt:flex-1 jt:min-w-0',
  arrayItemActions: 'jt:flex jt:flex-none jt:gap-3',
  link: `jt:p-0 jt:border-0 jt:bg-transparent jt:text-focus ${inheritFont} jt:cursor-pointer jt:enabled:hover:text-focus-hover jt:disabled:text-disabled-text jt:disabled:cursor-not-allowed ${focusRing}`,
  /** 数组行内的操作链接为次要色, 悬停仍为主色. */
  mutedLink: 'jt:text-muted',
  button,
  nullable: stackGroup,
  union: `${stackGroup} jt:justify-items-stretch`,
  tree: stackGroup,
  map: stackGroup,
  stretch,
  null: 'jt:text-muted jt:italic',
  unionRow: 'jt:flex jt:flex-wrap jt:items-start jt:gap-2 jt:min-w-0',
  unionBranch: 'jt:flex-none',
  unionContent: `${stretch} jt:flex-[1_1_16rem]`,
  treeContent: `${stretch} jt:pl-4 jt:border-l-2 jt:border-border`,
  mapEntries: `${stretch} jt:grid jt:gap-2 jt:m-0 jt:p-0 jt:list-none`,
  mapEntry: 'jt:flex jt:items-start jt:gap-2',
  mapKeyCell: 'jt:grid jt:flex-[0_0_12rem] jt:gap-1',
  mapValue: 'jt:flex-1 jt:min-w-0',
  tuple: stackGroup + ' jt:justify-items-stretch',
  tupleItems: 'jt:grid jt:gap-gap jt:m-0 jt:p-0 jt:list-none',
  /** 分段按钮: 一组单选, 选中项为主色; 与 visuallyHidden 的 radio 一起使用. */
  segmented: 'jt:inline-flex jt:flex-wrap',
  segment:
    `jt:inline-flex jt:items-center jt:h-[32px] jt:px-[15px] jt:border jt:border-border jt:-ml-px jt:first:ml-0 jt:first:rounded-l-base jt:last:rounded-r-base jt:bg-surface jt:cursor-pointer jt:select-none ` +
    'jt:hover:text-focus jt:has-checked:relative jt:has-checked:border-focus jt:has-checked:bg-focus jt:has-checked:text-on-accent ' +
    'jt:has-disabled:cursor-not-allowed jt:has-disabled:opacity-60 jt:has-focus-visible:outline-2 jt:has-focus-visible:outline-focus jt:has-focus-visible:outline-offset-1',
  visuallyHidden: 'jt:sr-only',
  flexNone: 'jt:flex-none',
  inheritFont,
} as const;
