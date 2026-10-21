// 组件登记表 htmlWidgets 与批量登记函数; 名字与层级取自 BUILTIN_WIDGETS, 各名字接受的数据形态由 core/ 按契约 C2 判定.
import type { ComponentType } from 'react';
import { BUILTIN_WIDGETS, type BuiltinWidgetName, type Registry, type WidgetRegistration } from '../core/index.js';
import { ListWidget } from './widgets/array.js';
import { CheckboxWidget, RadioWidget, SelectWidget, SwitchWidget } from './widgets/choice.js';
import { ColorWidget } from './widgets/color.js';
import { BigintWidget, MoneyWidget } from './widgets/decimal.js';
import { FieldDecorator } from './widgets/field.js';
import { FormWidget } from './widgets/form.js';
import { JsonWidget } from './widgets/json.js';
import { KvWidget } from './widgets/map.js';
import { NullableWidget } from './widgets/nullable.js';
import { NumberWidget, RangeWidget } from './widgets/number.js';
import { PageWidget } from './widgets/object.js';
import { OutputWidget } from './widgets/output.js';
import { RichTextWidget } from './widgets/rich-text.js';
import { EmailWidget, InputWidget, PasswordWidget, TextareaWidget, UrlWidget } from './widgets/string-inputs.js';
import { DateTimeWidget, DateWidget, TimeWidget } from './widgets/time-inputs.js';
import { TreeWidget } from './widgets/tree.js';
import { TupleWidget } from './widgets/tuple.js';
import { UnionWidget } from './widgets/union.js';
import { FileWidget, ImageWidget } from './widgets/upload.js';

/** 全部内置组件名. */
export type HtmlWidgetName = BuiltinWidgetName;

// oxlint-disable-next-line typescript/no-explicit-any -- 各组件 props 不同, 换成 unknown 会因参数逆变使具体组件无法赋值
export type HtmlWidgetComponent = ComponentType<any>;

const COMPONENTS: Record<HtmlWidgetName, HtmlWidgetComponent> = {
  form: FormWidget,
  field: FieldDecorator,
  page: PageWidget,
  inline: PageWidget,
  input: InputWidget,
  textarea: TextareaWidget,
  password: PasswordWidget,
  richtext: RichTextWidget,
  number: NumberWidget,
  range: RangeWidget,
  money: MoneyWidget,
  bigint: BigintWidget,
  switch: SwitchWidget,
  checkbox: CheckboxWidget,
  select: SelectWidget,
  radio: RadioWidget,
  output: OutputWidget,
  date: DateWidget,
  time: TimeWidget,
  datetime: DateTimeWidget,
  url: UrlWidget,
  email: EmailWidget,
  color: ColorWidget,
  image: ImageWidget,
  file: FileWidget,
  json: JsonWidget,
  list: ListWidget,
  tuple: TupleWidget,
  kv: KvWidget,
  union: UnionWidget,
  nullable: NullableWidget,
  tree: TreeWidget,
};

/** 不带 accepts: 内置名的形态检查(F2)由 core/ 的 plan() 按 schema 文档完成, 能解析引用. */
export const htmlWidgets: WidgetRegistration<HtmlWidgetComponent>[] = (Object.keys(COMPONENTS) as HtmlWidgetName[]).map(
  name => ({
    name,
    level: BUILTIN_WIDGETS[name].level,
    component: COMPONENTS[name],
  })
);

/** 把 htmlWidgets 全部登记到给定注册表; 注册表的组件类型可以是 unknown. */
export function registerHtmlWidgets(registry: Pick<Registry<HtmlWidgetComponent>, 'register'>): void {
  for (const registration of htmlWidgets) registry.register(registration);
}
