// 基于原生 HTML 标签的默认组件包, 无状态受控组件.
export { htmlWidgets, registerHtmlWidgets, type HtmlWidgetComponent, type HtmlWidgetName } from "./registrations.js";
export { describedBy, descriptionId, errorId, labelId } from "./ids.js";
export { cn, styles } from "./styles.js";
export type {
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
} from "./props.js";
export { ListWidget } from "./widgets/array.js";
export { CheckboxWidget, RadioWidget, SelectWidget, SwitchWidget } from "./widgets/choice.js";
export { ColorWidget } from "./widgets/color.js";
export { BigintWidget, MoneyWidget, choicesOf, moneyDecimals } from "./widgets/decimal.js";
export { FieldDecorator } from "./widgets/field.js";
export { FormWidget } from "./widgets/form.js";
export { JsonWidget } from "./widgets/json.js";
export { EntryEditor, KvWidget, nextEntryName, type EntryEditorProps } from "./widgets/map.js";
export { NullableWidget } from "./widgets/nullable.js";
export { NumberWidget, RangeWidget, decimalsOf } from "./widgets/number.js";
export { PageWidget, partitionFields, tabSections, type FieldSection, type ObjectLayoutProps } from "./widgets/object.js";
export { OutputWidget } from "./widgets/output.js";
export { RichTextEditor, RichTextWidget, richTextEditor } from "./widgets/rich-text.js";
export { isSafeUrl, sanitizeHtml } from "./sanitize-html.js";
export { EmailWidget, InputWidget, PasswordWidget, TextareaWidget, UrlWidget } from "./widgets/string-inputs.js";
export { DateTimeWidget, DateWidget, TimeWidget } from "./widgets/time-inputs.js";
export { TreeWidget } from "./widgets/tree.js";
export { TupleWidget } from "./widgets/tuple.js";
export { MAX_BUTTON_BRANCHES, UnionWidget, branchSelector } from "./widgets/union.js";
export { FileWidget, ImageWidget } from "./widgets/upload.js";
