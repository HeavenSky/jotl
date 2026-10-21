// TS + JSDoc → JSON Schema: 用 typescript@6.0.3 经典 API 解析语法树, 按 docs/tag-protocol.md 还原关键字.
import {
  JSON_SCHEMA_DIALECT,
  escapePointerToken,
  l10n,
  fail,
  hasErrors,
  isSchemaObject,
  isTimestampValueFormat,
  ok,
  orderKeywords,
  type Diagnostic,
  type JsonSchemaObject,
  type JsonSchemaType,
  type Result,
  type SourceRange,
  type UiRule,
  type XUiWidgetModule,
} from '@jotl/core';
import ts from 'typescript';
import { tsDiagnostic, type TsDiagnosticCode } from './diagnostics.js';
import { parseJsDoc, type JsDocComment, type JsDocTag } from './jsdoc.js';
import {
  DEPRECATED_DEFAULT_TEXTS,
  EXTENSION_TEXT_TAGS,
  IGNORED_TSDOC_TAGS,
  NUMERIC_KEYWORDS,
  TAG_ALIASES,
  TEXT_KEYWORDS,
  enumTitleKey,
  isDecimalRange,
} from './tags.js';
import {
  decodeExample,
  decodeJson,
  decodePattern,
  decodeText,
  decodeTextTag,
  type DecodedJson,
} from './value-codec.js';

export interface TsToSchemaOptions {
  /** 诊断位置中的文件名. */
  fileName?: string;
}

/** `tsToSchema` 的结果; 默认导出不写进 schema, 另由 defaultExport 给出, 打印 Jotl 时传给 `print` 的同名选项. */
export interface TsToSchemaResult extends Result<JsonSchemaObject> {
  /** 默认导出的类型名(`export default X;` 等), 即 `$defs` 的键; 没有默认导出或转换失败时省略. */
  defaultExport?: string;
}

type Declaration = ts.InterfaceDeclaration | ts.TypeAliasDeclaration;
type LiteralValue = string | number | boolean | null;

const BASIC_TYPES = new Set(['string', 'number', 'integer', 'boolean']);
/** typia 标签还原出的关键字; 可空的 `(T & tags.X) | null` 只含这些时读回 `type: [T, "null"]`. */
const TYPIA_KEYWORDS = new Set<string>([
  ...NUMERIC_KEYWORDS,
  'pattern',
  'format',
  'contentMediaType',
  'uniqueItems',
  'default',
  'x-ui',
]);
const TYPIA_TEXT_TAGS: Readonly<Record<string, string>> = {
  Pattern: 'pattern',
  Format: 'format',
  ContentMediaType: 'contentMediaType',
};
const TYPIA_INTEGER_TYPES = new Set(['int32', 'int64', 'uint32', 'uint64']);

function jsonType(value: LiteralValue): JsonSchemaType {
  if (value === null) return 'null';
  if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
  return typeof value === 'string' ? 'string' : 'boolean';
}

/** 规范化规则 4: 成员 JSON 类型唯一时为字符串, 否则为类型数组(按出现顺序). */
function typeOfValues(values: readonly unknown[]): JsonSchemaType | JsonSchemaType[] {
  const types: JsonSchemaType[] = [];
  for (const v of values) {
    const t = jsonType(v as LiteralValue);
    if (!types.includes(t)) types.push(t);
  }
  return types.length === 1 ? (types[0] as JsonSchemaType) : types;
}

class Converter {
  readonly diagnostics: Diagnostic[] = [];
  readonly declarations = new Map<string, Declaration>();
  /** 根声明: 第一个注释带 `@root` 的声明, 否则为默认导出; 只有它的注释可写文档层面的 `@root` `@id` `@rules`. */
  rootDeclaration: Declaration | undefined;
  /** 从根声明上读到的根 `$id` 与 `x-ui.rules`. */
  readonly document: { id?: string; rules?: UiRule[]; widgets?: Record<string, XUiWidgetModule> } = {};
  private documentLevel = false;
  /** `import { tags } from "typia"` 导入的标识符. */
  readonly typiaNames = new Set<string>();

  constructor(
    private readonly file: ts.SourceFile,
    private readonly fileName: string
  ) {}

  range(start: number, end: number): SourceRange {
    const position = (offset: number) => {
      const { line, character } = this.file.getLineAndCharacterOfPosition(offset);
      return { line: line + 1, column: character + 1, offset };
    };
    return { file: this.fileName, start: position(start), end: position(end) };
  }

  report(code: TsDiagnosticCode, node: ts.Node | { pos: number; end: number }, params?: Record<string, string>): void {
    const start = 'getStart' in node ? node.getStart(this.file) : node.pos;
    this.diagnostics.push(
      tsDiagnostic(code, params, { location: { kind: 'source', range: this.range(start, node.end) } })
    );
  }

  private snippet(node: ts.Node): string {
    const text = node.getText(this.file).replace(/\s+/g, ' ');
    return text.length > 40 ? `${text.slice(0, 40)}...` : text;
  }

  /** 声明的注释是否带 `@root`. */
  hasRootTag(node: Declaration): boolean {
    return this.docOf(node)?.tags.some(tag => TAG_ALIASES[tag.name.toLowerCase()] === 'root') ?? false;
  }

  /** 声明节点上最后一个 JSDoc 注释. */
  private docOf(node: ts.Node): JsDocComment | undefined {
    const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
    const doc = docs.at(-1);
    if (doc === undefined) return undefined;
    const start = doc.getStart(this.file);
    return parseJsDoc(this.file.text.slice(start, doc.end), start);
  }

  convertDeclaration(node: Declaration): JsonSchemaObject {
    const schema = ts.isInterfaceDeclaration(node) ? this.convertMembers(node.members) : this.convertType(node.type);
    this.documentLevel = node === this.rootDeclaration;
    try {
      return this.applyDoc(schema, this.docOf(node));
    } finally {
      this.documentLevel = false;
    }
  }

  convertMembers(members: ts.NodeArray<ts.TypeElement>): JsonSchemaObject {
    const properties: Record<string, JsonSchemaObject> = {};
    const required: string[] = [];
    let additional: JsonSchemaObject | undefined;
    const propertyTypes = new Set([
      'undefined',
      ...members.flatMap(m =>
        ts.isPropertySignature(m) && m.type !== undefined
          ? [...flattenUnion(m.type), ...(ts.isUnionTypeNode(m.type) ? m.type.types : [])].map(t => this.bareText(t))
          : []
      ),
    ]);
    for (const member of members) {
      if (ts.isPropertySignature(member)) {
        const name = this.propertyName(member.name);
        if (name === undefined) continue;
        let schema = member.type === undefined ? {} : this.convertType(member.type);
        if (member.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword))
          schema = { ...schema, readOnly: true };
        properties[name] = this.applyDoc(schema, this.docOf(member));
        if (member.questionToken === undefined && !required.includes(name)) required.push(name);
      } else if (ts.isIndexSignatureDeclaration(member)) {
        const key = member.parameters[0]?.type;
        if (member.parameters.length !== 1 || key?.kind !== ts.SyntaxKind.StringKeyword) {
          this.report('JOTL2106', member, { kind: this.snippet(member) });
          continue;
        }
        additional = this.applyDoc(
          this.convertType(this.indexValueType(member.type, propertyTypes)),
          this.docOf(member)
        );
      } else if (
        ts.isMethodSignature(member) ||
        ts.isCallSignatureDeclaration(member) ||
        ts.isConstructSignatureDeclaration(member)
      ) {
        this.report('JOTL2105', member);
      } else {
        this.report('JOTL2106', member, { kind: this.snippet(member) });
      }
    }
    const schema: JsonSchemaObject = { type: 'object' };
    if (Object.keys(properties).length > 0) schema.properties = properties;
    if (required.length > 0) schema.required = required;
    if (additional !== undefined) schema.additionalProperties = additional;
    return schema;
  }

  private bareText(node: ts.TypeNode): string {
    return (ts.isParenthesizedTypeNode(node) ? node.type : node).getText(this.file);
  }

  /** schemaToTs 写的 `(额外类型) | 属性类型...` 只取括号中的额外类型. */
  private indexValueType(node: ts.TypeNode, propertyTypes: ReadonlySet<string>): ts.TypeNode {
    if (!ts.isUnionTypeNode(node) || node.types.length < 2) return node;
    const [head, ...rest] = node.types as unknown as [ts.TypeNode, ...ts.TypeNode[]];
    if (!ts.isParenthesizedTypeNode(head) || !rest.every(t => propertyTypes.has(this.bareText(t)))) return node;
    return head.type;
  }

  private propertyName(name: ts.PropertyName): string | undefined {
    if (
      ts.isIdentifier(name) ||
      ts.isStringLiteral(name) ||
      ts.isNumericLiteral(name) ||
      ts.isNoSubstitutionTemplateLiteral(name)
    ) {
      return name.text;
    }
    this.report('JOTL2117', name);
    return undefined;
  }

  convertType(node: ts.TypeNode): JsonSchemaObject {
    switch (node.kind) {
      case ts.SyntaxKind.StringKeyword:
        return { type: 'string' };
      case ts.SyntaxKind.NumberKeyword:
        return { type: 'number' };
      case ts.SyntaxKind.BooleanKeyword:
        return { type: 'boolean' };
      case ts.SyntaxKind.ObjectKeyword:
        return { type: 'object' };
      case ts.SyntaxKind.UnknownKeyword:
      case ts.SyntaxKind.AnyKeyword:
        return {};
      case ts.SyntaxKind.NeverKeyword:
        return { not: {} };
      default:
        break;
    }
    if (ts.isParenthesizedTypeNode(node)) return this.convertType(node.type);
    if (ts.isLiteralTypeNode(node)) {
      const value = this.literalValue(node);
      if (value === undefined) return {};
      return value === null ? { type: 'null' } : { type: jsonType(value), const: value };
    }
    if (ts.isArrayTypeNode(node)) return { type: 'array', items: this.convertType(node.elementType) };
    if (ts.isTupleTypeNode(node)) return this.convertTuple(node);
    if (
      ts.isTypeOperatorNode(node) &&
      node.operator === ts.SyntaxKind.ReadonlyKeyword &&
      (ts.isArrayTypeNode(node.type) || ts.isTupleTypeNode(node.type))
    ) {
      return this.convertType(node.type);
    }
    if (ts.isTypeLiteralNode(node)) return this.convertMembers(node.members);
    if (ts.isUnionTypeNode(node)) return this.convertUnion(node);
    if (ts.isIntersectionTypeNode(node)) return this.convertIntersection(node);
    if (ts.isTypeReferenceNode(node)) return this.convertReference(node);
    if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) {
      this.report('JOTL2105', node);
      return {};
    }
    if (ts.isConditionalTypeNode(node) || ts.isInferTypeNode(node)) {
      this.report('JOTL2103', node);
      return {};
    }
    if (ts.isMappedTypeNode(node)) {
      this.report('JOTL2104', node);
      return {};
    }
    this.report('JOTL2106', node, { kind: this.snippet(node) });
    return {};
  }

  private literalValue(node: ts.LiteralTypeNode): LiteralValue | undefined {
    const literal = node.literal;
    switch (literal.kind) {
      case ts.SyntaxKind.NullKeyword:
        return null;
      case ts.SyntaxKind.TrueKeyword:
        return true;
      case ts.SyntaxKind.FalseKeyword:
        return false;
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        return (literal as ts.StringLiteral).text;
      case ts.SyntaxKind.NumericLiteral:
        return Number((literal as ts.NumericLiteral).text);
      default:
        break;
    }
    if (ts.isPrefixUnaryExpression(literal) && ts.isNumericLiteral(literal.operand)) {
      const value = Number(literal.operand.text);
      if (literal.operator === ts.SyntaxKind.MinusToken) return -value;
      if (literal.operator === ts.SyntaxKind.PlusToken) return value;
    }
    this.report('JOTL2106', node, { kind: this.snippet(node) });
    return undefined;
  }

  private convertTuple(node: ts.TupleTypeNode): JsonSchemaObject {
    const prefixItems: JsonSchemaObject[] = [];
    let items: JsonSchemaObject | false = false;
    node.elements.forEach((element, i) => {
      const last = i === node.elements.length - 1;
      const inner = ts.isNamedTupleMember(element) ? element : undefined;
      const rest = ts.isRestTypeNode(element) ? element.type : inner?.dotDotDotToken ? inner.type : undefined;
      if (rest !== undefined && last && ts.isArrayTypeNode(rest)) {
        items = this.convertType(rest.elementType);
      } else if (rest !== undefined || ts.isOptionalTypeNode(element) || inner?.questionToken) {
        this.report('JOTL2106', element, { kind: this.snippet(element) });
      } else {
        // 具名成员的名字还原为该位置的 title; 剩余元素的名字不对应关键字, 不读回.
        prefixItems.push(
          inner ? { title: inner.name.text, ...this.convertType(inner.type) } : this.convertType(element)
        );
      }
    });
    return { type: 'array', prefixItems, items };
  }

  private convertReference(node: ts.TypeReferenceNode): JsonSchemaObject {
    if (!ts.isIdentifier(node.typeName)) {
      this.report('JOTL2106', node, { kind: this.snippet(node) });
      return {};
    }
    const name = node.typeName.text;
    const args = node.typeArguments ?? [];
    if (args.length > 0) {
      if ((name === 'Array' || name === 'ReadonlyArray') && args.length === 1 && !this.declarations.has(name)) {
        return { type: 'array', items: this.convertType(args[0] as ts.TypeNode) };
      }
      if (
        name === 'Record' &&
        args.length === 2 &&
        args[0]?.kind === ts.SyntaxKind.StringKeyword &&
        !this.declarations.has(name)
      ) {
        return { type: 'object', additionalProperties: this.convertType(args[1] as ts.TypeNode) };
      }
      this.report('JOTL2102', node, { name });
      return {};
    }
    if (!this.declarations.has(name)) {
      this.report('JOTL2109', node.typeName, { name });
      return {};
    }
    return { $ref: `#/$defs/${escapePointerToken(name)}` };
  }

  private convertUnion(node: ts.UnionTypeNode): JsonSchemaObject {
    const isNull = (m: ts.TypeNode) => ts.isLiteralTypeNode(m) && m.literal.kind === ts.SyntaxKind.NullKeyword;
    // schemaToTs 把可空包装 anyOf [联合, null] 写成 `(A | B) | null`; 括号内的联合单独转换, 保留两层结构.
    const [head, tail] = node.types as unknown as [ts.TypeNode, ts.TypeNode | undefined];
    if (
      node.types.length === 2 &&
      ts.isParenthesizedTypeNode(head) &&
      ts.isUnionTypeNode(head.type) &&
      tail !== undefined &&
      isNull(tail)
    ) {
      return { anyOf: [this.convertType(head.type), { type: 'null' }] };
    }
    const members = flattenUnion(node);
    const literals = members.map(m => (ts.isLiteralTypeNode(m) ? this.literalValue(m) : undefined));
    if (literals.every(v => v !== undefined)) {
      const values = literals as LiteralValue[];
      const nonNullValues = values.filter(v => v !== null);
      // 与编译器的可空枚举一致: 字面量联合含 null 时写成 anyOf [枚举, null].
      if (nonNullValues.length > 0 && nonNullValues.length < values.length) {
        const inner =
          nonNullValues.length === 1
            ? { type: typeOfValues(nonNullValues), const: nonNullValues[0] }
            : { type: typeOfValues(nonNullValues), enum: nonNullValues };
        return { anyOf: [inner, { type: 'null' }] };
      }
      return values.length === 1
        ? { type: typeOfValues(values), const: values[0] }
        : { type: typeOfValues(values), enum: values };
    }
    const nonNull = members.filter(m => !isNull(m));
    if (nonNull.length === 1 && nonNull.length < members.length) {
      const member = nonNull[0] as ts.TypeNode;
      const inner = this.convertType(member);
      const keys = Object.keys(inner);
      const typia = ts.isIntersectionTypeNode(ts.isParenthesizedTypeNode(member) ? member.type : member);
      if (
        typeof inner.type === 'string' &&
        BASIC_TYPES.has(inner.type) &&
        keys.every(k => k === 'type' || (typia && TYPIA_KEYWORDS.has(k)))
      ) {
        return { ...inner, type: [inner.type, 'null'] };
      }
      return { anyOf: [inner, { type: 'null' }] };
    }
    const branches = members.map(m => this.convertType(m));
    return this.isDiscriminated(members) ? { oneOf: branches } : { anyOf: branches };
  }

  /**
   * 交叉类型: `X & {...}` 还原为 allOf 引用加同级关键字, 只有引用时为 allOf; typia 标签(`tags.X<...>`)还原为对应关键字.
   * 引用以外的成员至多一个; 多个时须都是只含属性且属性名互不相交的类型字面量, 合并为一个对象.
   */
  private convertIntersection(node: ts.IntersectionTypeNode): JsonSchemaObject {
    const parts = flattenIntersection(node);
    const typia = parts.filter(p => this.typiaTagName(p) !== undefined) as ts.TypeReferenceNode[];
    const refs = parts.filter(
      p =>
        !typia.includes(p as ts.TypeReferenceNode) &&
        ts.isTypeReferenceNode(p) &&
        ts.isIdentifier(p.typeName) &&
        p.typeArguments === undefined
    );
    const others = parts.filter(p => !typia.includes(p as ts.TypeReferenceNode) && !refs.includes(p));
    const literals = others.length > 1 ? this.mergeableLiterals(others) : undefined;
    if ((others.length > 1 && literals === undefined) || (others.length === 0 && refs.length === 0)) {
      this.report('JOTL2106', node, { kind: this.snippet(node) });
      return {};
    }
    const refSchemas = refs.map(r => this.convertType(r)).filter(r => r.$ref !== undefined);
    let schema: JsonSchemaObject;
    if (others.length >= 1) {
      schema = literals === undefined ? this.convertType(others[0] as ts.TypeNode) : this.mergeLiterals(literals);
      if (refSchemas.length > 0) {
        if ('allOf' in schema || '$ref' in schema) {
          this.report('JOTL2106', node, { kind: this.snippet(node) });
          return {};
        }
        schema.allOf = refSchemas;
      }
    } else {
      schema = refSchemas.length === 1 && typia.length > 0 ? { ...refSchemas[0] } : { allOf: refSchemas };
    }
    for (const tag of typia) this.applyTypiaTag(schema, tag);
    return schema;
  }

  /** 每个成员都是只含属性签名的类型字面量, 且属性名互不相交时返回这些字面量. */
  private mergeableLiterals(nodes: readonly ts.TypeNode[]): ts.TypeLiteralNode[] | undefined {
    const literals: ts.TypeLiteralNode[] = [];
    const names = new Set<string>();
    for (const node of nodes) {
      const literal = ts.isParenthesizedTypeNode(node) ? node.type : node;
      if (!ts.isTypeLiteralNode(literal)) return undefined;
      const own = new Set<string>();
      for (const member of literal.members) {
        const key = ts.isPropertySignature(member) ? member.name : undefined;
        const literalKey =
          key !== undefined &&
          (ts.isIdentifier(key) ||
            ts.isStringLiteral(key) ||
            ts.isNumericLiteral(key) ||
            ts.isNoSubstitutionTemplateLiteral(key));
        if (!literalKey || names.has(key.text)) return undefined;
        const name = key.text;
        own.add(name);
      }
      for (const name of own) names.add(name);
      literals.push(literal);
    }
    return literals;
  }

  private mergeLiterals(literals: readonly ts.TypeLiteralNode[]): JsonSchemaObject {
    const properties: Record<string, JsonSchemaObject> = {};
    const required: string[] = [];
    for (const literal of literals) {
      const part = this.convertMembers(literal.members);
      Object.assign(properties, part.properties);
      required.push(...(part.required ?? []));
    }
    const schema: JsonSchemaObject = { type: 'object' };
    if (Object.keys(properties).length > 0) schema.properties = properties;
    if (required.length > 0) schema.required = required;
    return schema;
  }

  private typiaTagName(node: ts.TypeNode): string | undefined {
    if (!ts.isTypeReferenceNode(node) || !ts.isQualifiedName(node.typeName)) return undefined;
    const { left, right } = node.typeName;
    return ts.isIdentifier(left) && this.typiaNames.has(left.text) ? right.text : undefined;
  }

  /** 按 schemaToTs 的 typiaTags 写法还原关键字(docs/ts-conversion.md "Write typia type tags"). */
  private applyTypiaTag(schema: JsonSchemaObject, node: ts.TypeReferenceNode): void {
    const name = this.typiaTagName(node) as string;
    const args = node.typeArguments ?? [];
    const arg = args.length === 1 ? (args[0] as ts.TypeNode) : undefined;
    const unsupported = () => this.report('JOTL2106', node, { kind: this.snippet(node) });
    const value = arg === undefined ? undefined : this.typeLiteralValue(arg);
    if (arg !== undefined && value === undefined) return;
    const keyword = `${name[0]?.toLowerCase()}${name.slice(1)}`;
    if ((NUMERIC_KEYWORDS as readonly string[]).includes(keyword)) {
      if (typeof value === 'number') schema[keyword] = value;
      else unsupported();
      return;
    }
    const text = TYPIA_TEXT_TAGS[name];
    if (text !== undefined) {
      if (typeof value === 'string') schema[text] = value;
      else unsupported();
      return;
    }
    switch (name) {
      case 'Type':
        if (typeof value !== 'string') unsupported();
        else if (TYPIA_INTEGER_TYPES.has(value)) {
          if (schema.type === 'number') schema.type = 'integer';
          else if (Array.isArray(schema.type) && schema.type.includes('number')) {
            schema.type = schema.type.map(t => (t === 'number' ? 'integer' : t));
          } else this.report('JOTL2115', node, { tag: name });
        }
        return;
      case 'UniqueItems':
        if (value === undefined || typeof value === 'boolean') schema.uniqueItems = value ?? true;
        else unsupported();
        return;
      case 'Default':
        if (value === undefined) unsupported();
        else schema.default = value;
        return;
      case 'JsonSchemaPlugin':
        if (isSchemaObject(value)) Object.assign(schema, value);
        else unsupported();
        return;
      default:
        unsupported();
    }
  }

  /** typia 标签参数中的字面量类型, 元组与类型字面量还原为 JSON 值; 不支持时报错并返回 undefined. */
  private typeLiteralValue(node: ts.TypeNode): unknown {
    if (ts.isParenthesizedTypeNode(node)) return this.typeLiteralValue(node.type);
    if (ts.isLiteralTypeNode(node)) return this.literalValue(node);
    if (ts.isTupleTypeNode(node)) {
      const values = node.elements.map(e => this.typeLiteralValue(e));
      return values.includes(undefined) ? undefined : values;
    }
    if (ts.isTypeLiteralNode(node)) {
      const out: Record<string, unknown> = {};
      for (const member of node.members) {
        const name =
          ts.isPropertySignature(member) && member.type !== undefined ? this.propertyName(member.name) : undefined;
        if (name === undefined || !ts.isPropertySignature(member) || member.type === undefined) {
          this.report('JOTL2106', member, { kind: this.snippet(member) });
          return undefined;
        }
        const value = this.typeLiteralValue(member.type);
        if (value === undefined) return undefined;
        Object.defineProperty(out, name, { value, enumerable: true, writable: true, configurable: true });
      }
      return out;
    }
    this.report('JOTL2106', node, { kind: this.snippet(node) });
    return undefined;
  }

  /** D39: 每个成员都是对象或指向对象的引用, 且有一个同名必填字段在各成员中是互不相同的字面量类型. */
  private isDiscriminated(members: ts.TypeNode[]): boolean {
    const shapes = members.map(m => this.objectMembers(m));
    if (shapes.some(s => s === undefined)) return false;
    const literalFields = (shape: readonly ts.TypeElement[]) => {
      const fields = new Map<string, string>();
      for (const member of shape) {
        if (!ts.isPropertySignature(member) || member.questionToken || member.type === undefined) continue;
        if (!ts.isIdentifier(member.name) && !ts.isStringLiteral(member.name)) continue;
        if (!ts.isLiteralTypeNode(member.type)) continue;
        const literal = member.type.literal;
        const text = ts.isStringLiteral(literal) ? JSON.stringify(literal.text) : literal.getText(this.file);
        fields.set(member.name.text, text);
      }
      return fields;
    };
    const fieldMaps = (shapes as (readonly ts.TypeElement[])[]).map(literalFields);
    const [first, ...rest] = fieldMaps;
    if (first === undefined) return false;
    return [...first.keys()].some(name => {
      const values = fieldMaps.map(f => f.get(name));
      return values.every(v => v !== undefined) && new Set(values).size === values.length && rest.length > 0;
    });
  }

  private objectMembers(node: ts.TypeNode, seen = new Set<string>()): readonly ts.TypeElement[] | undefined {
    if (ts.isParenthesizedTypeNode(node)) return this.objectMembers(node.type, seen);
    if (ts.isIntersectionTypeNode(node)) {
      const shapes = node.types.map(t => this.objectMembers(t, seen));
      return shapes.every(s => s !== undefined) ? shapes.flat() : undefined;
    }
    if (ts.isTypeLiteralNode(node)) return node.members;
    if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName) && node.typeArguments === undefined) {
      const name = node.typeName.text;
      const declaration = this.declarations.get(name);
      if (declaration === undefined || seen.has(name)) return undefined;
      if (ts.isInterfaceDeclaration(declaration)) return declaration.members;
      return this.objectMembers(declaration.type, new Set(seen).add(name));
    }
    return undefined;
  }

  /** 把注释的描述与标签合并进节点. */
  applyDoc(schema: JsonSchemaObject, doc: JsDocComment | undefined): JsonSchemaObject {
    if (doc === undefined) return schema;
    const out: JsonSchemaObject = { ...schema };
    if (doc.description !== undefined) out.description = decodeText(doc.description);
    const state = { itemDepth: 0 };
    for (const tag of doc.tags) this.applyTag(out, tag, state);
    const format = out['x-valueFormat'];
    if (typeof format === 'string' && isTimestampValueFormat(format)) {
      out.minimum ??= -Number.MAX_SAFE_INTEGER;
      out.maximum ??= Number.MAX_SAFE_INTEGER;
    }
    return out;
  }

  private json(tag: JsDocTag, decoded: DecodedJson): unknown {
    if (decoded.ok) return decoded.value;
    this.report('JOTL2113', tag, { tag: tag.name });
    return decoded.text;
  }

  private invalid(tag: JsDocTag, expected: string): void {
    this.report('JOTL2116', tag, { tag: tag.name, expected });
  }

  private applyTag(schema: JsonSchemaObject, tag: JsDocTag, state: { itemDepth: number }): void {
    const lower = tag.name.toLowerCase();
    const name = TAG_ALIASES[lower];
    if (name === undefined) {
      if (!IGNORED_TSDOC_TAGS.has(lower)) this.report('JOTL2114', tag, { tag: tag.name });
      return;
    }
    if ((TEXT_KEYWORDS as readonly string[]).includes(name)) {
      schema[name] = decodeTextTag(tag.text);
      return;
    }
    const extension = Object.entries(EXTENSION_TEXT_TAGS).find(([, tag]) => tag === name);
    if (extension !== undefined) {
      schema[extension[0]] = decodeTextTag(tag.text);
      return;
    }
    if ((NUMERIC_KEYWORDS as readonly string[]).includes(name)) {
      const value = decodeJson(tag.text);
      if (value.ok && typeof value.value === 'number') schema[name] = value.value;
      else this.invalid(tag, l10n('数字', 'a number'));
      return;
    }
    switch (name) {
      case 'description':
        schema.description = decodeText(tag.text);
        return;
      case 'privateRemarks':
        schema.$comment = decodeText(tag.text);
        return;
      case 'pattern':
        schema.pattern = decodePattern(tag.text);
        return;
      case 'defaultValue':
        schema.default = this.json(tag, decodeJson(tag.text));
        return;
      case 'example':
        schema.examples = [...(schema.examples ?? []), this.json(tag, decodeExample(tag.text))];
        return;
      case 'examples': {
        const value = decodeJson(tag.text);
        if (value.ok && Array.isArray(value.value)) schema.examples = [...(schema.examples ?? []), ...value.value];
        else this.invalid(tag, l10n('JSON 数组', 'a JSON array'));
        return;
      }
      case 'deprecated':
        schema.deprecated = true;
        if (tag.text !== '' && !DEPRECATED_DEFAULT_TEXTS.includes(decodeText(tag.text)))
          schema['x-deprecatedReason'] = decodeText(tag.text);
        return;
      case 'readonly':
        schema.readOnly = true;
        return;
      case 'writeOnly':
        schema.writeOnly = true;
        return;
      case 'uniqueItems': {
        if (tag.text === '') {
          schema.uniqueItems = true;
          return;
        }
        const value = decodeJson(tag.text);
        if (value.ok && typeof value.value === 'boolean') schema.uniqueItems = value.value;
        else this.invalid(tag, l10n('布尔值', 'a boolean'));
        return;
      }
      case 'asType':
        this.applyAsType(schema, tag);
        return;
      case 'ui': {
        const value = decodeJson(tag.text);
        if (value.ok && isSchemaObject(value.value)) schema['x-ui'] = { ...schema['x-ui'], ...value.value };
        else this.invalid(tag, l10n('JSON 对象', 'a JSON object'));
        return;
      }
      case 'widget':
        schema['x-ui'] = { ...schema['x-ui'], widget: decodeTextTag(tag.text) };
        return;
      case 'itemUi':
      case 'itemWidget':
        this.applyItemUi(schema, tag, ++state.itemDepth);
        return;
      case 'enumTitles':
        this.applyEnumLabels(schema, tag, 'title');
        return;
      case 'enumDescriptions':
        this.applyEnumLabels(schema, tag, 'description');
        return;
      case 'branchTitles': {
        const value = decodeJson(tag.text);
        const target = nullableUnionTarget(schema) ?? schema;
        const branches = Array.isArray(target.oneOf) ? target.oneOf : target.anyOf;
        if (!value.ok || !Array.isArray(value.value) || !value.value.every(t => typeof t === 'string' || t === null)) {
          this.invalid(tag, l10n('元素为字符串或 null 的 JSON 数组', 'a JSON array of strings or null'));
        } else if (
          !Array.isArray(branches) ||
          branches.length !== value.value.length ||
          !branches.every(isSchemaObject)
        ) {
          this.report('JOTL2115', tag, { tag: tag.name });
        } else {
          const titles = value.value as (string | null)[];
          const labeled = branches.map((b, i) =>
            titles[i] === null ? b : { ...(b as JsonSchemaObject), title: titles[i] as string }
          );
          const relabeled: JsonSchemaObject = Array.isArray(target.oneOf)
            ? { ...target, oneOf: labeled }
            : { ...target, anyOf: labeled };
          if (target === schema) Object.assign(schema, relabeled);
          else schema.anyOf = [relabeled, ...(schema.anyOf as JsonSchemaObject[]).slice(1)];
        }
        return;
      }
      case 'closed': {
        const target = valueObjectTarget(schema);
        if (target !== undefined && target.additionalProperties === undefined) target.additionalProperties = false;
        else this.report('JOTL2115', tag, { tag: tag.name });
        return;
      }
      case 'decimalRange': {
        const value = decodeJson(tag.text);
        const target = value.ok && isDecimalRange(value.value) ? valueObjectTarget(schema) : undefined;
        if (!value.ok || !isDecimalRange(value.value))
          this.invalid(tag, l10n('值为字符串的 JSON 对象', 'a JSON object with string values'));
        else if (target === undefined) this.report('JOTL2115', tag, { tag: tag.name });
        else target['x-decimalRange'] = value.value;
        return;
      }
      case 'root':
        if (!this.documentLevel) this.report('JOTL2115', tag, { tag: tag.name });
        return;
      case 'id':
        if (this.documentLevel) this.document.id = decodeTextTag(tag.text);
        else this.report('JOTL2115', tag, { tag: tag.name });
        return;
      case 'rules': {
        if (!this.documentLevel) {
          this.report('JOTL2115', tag, { tag: tag.name });
          return;
        }
        const value = decodeJson(tag.text);
        if (value.ok && Array.isArray(value.value)) this.document.rules = value.value as UiRule[];
        else this.invalid(tag, l10n('JSON 数组', 'a JSON array'));
        return;
      }
      case 'widgets': {
        if (!this.documentLevel) {
          this.report('JOTL2115', tag, { tag: tag.name });
          return;
        }
        const value = decodeJson(tag.text);
        if (value.ok && isSchemaObject(value.value))
          this.document.widgets = value.value as Record<string, XUiWidgetModule>;
        else this.invalid(tag, l10n('JSON 对象', 'a JSON object'));
        return;
      }
      case 'errorMessage': {
        const value = this.json(tag, decodeJson(tag.text));
        if (
          typeof value === 'string' ||
          (isSchemaObject(value) && Object.values(value).every(v => typeof v === 'string'))
        ) {
          schema.errorMessage = value as string | Record<string, string>;
        } else {
          this.invalid(tag, l10n('字符串或值为字符串的 JSON 对象', 'a string or a JSON object with string values'));
        }
        return;
      }
      default:
        this.report('JOTL2114', tag, { tag: tag.name });
    }
  }

  private applyAsType(schema: JsonSchemaObject, tag: JsDocTag): void {
    const value = decodeTextTag(tag.text);
    if (value !== 'integer') {
      this.report('JOTL2118', tag, { value });
      return;
    }
    if (schema.type === 'number') schema.type = 'integer';
    else if (Array.isArray(schema.type) && schema.type.includes('number')) {
      schema.type = schema.type.map(t => (t === 'number' ? 'integer' : t));
    } else this.report('JOTL2115', tag, { tag: tag.name });
  }

  /** 第 depth 个 `@itemUi` `@itemWidget` 作用于第 depth 层数组元素; 空对象只占位. */
  private applyItemUi(schema: JsonSchemaObject, tag: JsDocTag, depth: number): void {
    let value: Record<string, unknown>;
    if (tag.name.toLowerCase() === 'itemwidget') value = { widget: decodeTextTag(tag.text) };
    else {
      const decoded = decodeJson(tag.text);
      if (!decoded.ok || !isSchemaObject(decoded.value)) {
        this.invalid(tag, l10n('JSON 对象', 'a JSON object'));
        return;
      }
      value = decoded.value;
    }
    let probe: JsonSchemaObject = schema;
    for (let i = 0; i < depth; i++) {
      if (!isSchemaObject(probe.items)) {
        this.report('JOTL2115', tag, { tag: tag.name });
        return;
      }
      probe = probe.items;
    }
    if (Object.keys(value).length === 0) return;
    let target = schema;
    for (let i = 0; i < depth; i++) {
      const items: JsonSchemaObject = { ...(target.items as JsonSchemaObject) };
      target.items = items;
      target = items;
    }
    target['x-ui'] = { ...target['x-ui'], ...value };
  }

  /** 枚举标签与说明作用于节点本身, 或数组(逐层)元素中的枚举; 两个标签可先后作用于同一枚举. */
  private applyEnumLabels(schema: JsonSchemaObject, tag: JsDocTag, field: 'title' | 'description'): void {
    const decoded = decodeJson(tag.text);
    if (
      !decoded.ok ||
      !isSchemaObject(decoded.value) ||
      !Object.values(decoded.value).every(v => typeof v === 'string')
    ) {
      this.invalid(tag, l10n('值为字符串的 JSON 对象', 'a JSON object with string values'));
      return;
    }
    const titles = decoded.value as Record<string, string>;
    let target: JsonSchemaObject = schema;
    while (!('enum' in target) && !('const' in target) && !('oneOf' in target) && isSchemaObject(target.items)) {
      const items: JsonSchemaObject = { ...target.items };
      target.items = items;
      target = items;
    }
    const labeled =
      Array.isArray(target.oneOf) && target.oneOf.every(b => isSchemaObject(b) && 'const' in b)
        ? (target.oneOf as JsonSchemaObject[])
        : undefined;
    const values = Array.isArray(target.enum)
      ? target.enum
      : 'const' in target
        ? [target.const]
        : labeled?.map(b => b.const);
    if (values === undefined) {
      this.report('JOTL2115', tag, { tag: tag.name });
      return;
    }
    const keys = new Set(values.map(enumTitleKey));
    if (Object.keys(titles).some(k => !keys.has(k))) this.report('JOTL2115', tag, { tag: tag.name });
    delete target.enum;
    delete target.const;
    target.oneOf = values.map((v, i) => {
      const label = titles[enumTitleKey(v)];
      const branch: JsonSchemaObject = labeled?.[i] ?? { const: v };
      return label === undefined ? branch : { ...branch, [field]: label };
    });
  }
}

/** 可空包装 `anyOf: [{oneOf | anyOf}, {type: "null"}]` 的内层联合; `@branchTitles` 作用于它. */
function nullableUnionTarget(schema: JsonSchemaObject): JsonSchemaObject | undefined {
  if (Array.isArray(schema.oneOf) || !Array.isArray(schema.anyOf) || schema.anyOf.length !== 2) return undefined;
  const [inner, tail] = schema.anyOf;
  const nullTail = isSchemaObject(tail) && Object.keys(tail).length === 1 && tail.type === 'null';
  return nullTail && isSchemaObject(inner) && (Array.isArray(inner.oneOf) || Array.isArray(inner.anyOf))
    ? inner
    : undefined;
}

/**
 * `@closed` `@decimalRange` 作用的对象: 节点本身, 或依次经过数组(逐层)元素与一层可空包装 `anyOf [X, null]` 找到的对象,
 * 与 schemaToTs 上提的位置一一对应; 途经的节点换成副本后再写入. 找不到对象时返回 undefined.
 */
function valueObjectTarget(schema: JsonSchemaObject): JsonSchemaObject | undefined {
  let target = schema;
  while (target.type === 'array' && isSchemaObject(target.items)) {
    const items: JsonSchemaObject = { ...target.items };
    target.items = items;
    target = items;
  }
  const [inner, tail] = Array.isArray(target.anyOf) && target.anyOf.length === 2 ? target.anyOf : [];
  if (isSchemaObject(inner) && isSchemaObject(tail) && Object.keys(tail).length === 1 && tail.type === 'null') {
    const copy: JsonSchemaObject = { ...inner };
    target.anyOf = [copy, tail];
    target = copy;
  }
  return target.type === 'object' ? target : undefined;
}

function flattenUnion(node: ts.TypeNode): ts.TypeNode[] {
  if (ts.isUnionTypeNode(node)) return node.types.flatMap(flattenUnion);
  if (ts.isParenthesizedTypeNode(node) && ts.isUnionTypeNode(node.type)) return flattenUnion(node.type);
  return [node];
}

function flattenIntersection(node: ts.TypeNode): ts.TypeNode[] {
  if (ts.isIntersectionTypeNode(node)) return node.types.flatMap(flattenIntersection);
  if (ts.isParenthesizedTypeNode(node) && ts.isIntersectionTypeNode(node.type)) return flattenIntersection(node.type);
  return [node];
}

function syntaxDiagnostics(file: ts.SourceFile): readonly ts.DiagnosticWithLocation[] {
  const host: ts.CompilerHost = {
    getSourceFile: name => (name === file.fileName ? file : undefined),
    writeFile: () => undefined,
    getDefaultLibFileName: () => 'lib.d.ts',
    useCaseSensitiveFileNames: () => true,
    getCanonicalFileName: name => name,
    getCurrentDirectory: () => '/',
    getNewLine: () => '\n',
    fileExists: name => name === file.fileName,
    readFile: name => (name === file.fileName ? file.text : undefined),
  };
  const program = ts.createProgram([file.fileName], { noLib: true, noResolve: true, types: [] }, host);
  return program.getSyntacticDiagnostics(file);
}

/** 把 TS 声明文件文本转为 JSON Schema 2020-12 文档; 注释带 `@root` 的声明对应根 `$ref`, 没有时取 `export default X;`. */
export function tsToSchema(source: string, options: TsToSchemaOptions = {}): TsToSchemaResult {
  const fileName = options.fileName ?? 'types.d.ts';
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const converter = new Converter(file, fileName);

  const syntax = syntaxDiagnostics(file);
  if (syntax.length > 0) {
    return fail(
      syntax.map(d =>
        tsDiagnostic(
          'JOTL2101',
          { message: ts.flattenDiagnosticMessageText(d.messageText, '\n') },
          {
            location: { kind: 'source', range: converter.range(d.start, d.start + d.length) },
          }
        )
      )
    );
  }

  let defaultName: string | undefined;
  let defaultNode: ts.Node | undefined;
  const setDefault = (name: string | undefined, node: ts.Node): void => {
    if (name === undefined || defaultName !== undefined) converter.report('JOTL2112', node);
    else {
      defaultName = name;
      defaultNode = node;
    }
  };
  for (const statement of file.statements) {
    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      const name = statement.name.text;
      if (converter.declarations.has(name)) {
        converter.report('JOTL2111', statement.name, { name });
        continue;
      }
      converter.declarations.set(name, statement);
      if (statement.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) setDefault(name, statement);
    } else if (ts.isExportAssignment(statement)) {
      if (statement.isExportEquals) converter.report('JOTL2107', statement, { kind: 'export =' });
      else setDefault(ts.isIdentifier(statement.expression) ? statement.expression.text : undefined, statement);
    } else if (ts.isImportDeclaration(statement) || ts.isImportEqualsDeclaration(statement)) {
      converter.report('JOTL2108', statement);
      const bindings =
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === 'typia'
          ? statement.importClause?.namedBindings
          : undefined;
      if (bindings !== undefined && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if ((element.propertyName ?? element.name).text === 'tags') converter.typiaNames.add(element.name.text);
        }
      }
    } else if (ts.isExportDeclaration(statement) && statement.moduleSpecifier === undefined) {
      const clause = statement.exportClause;
      if (clause !== undefined && ts.isNamedExports(clause)) {
        for (const element of clause.elements) {
          if (element.name.text === 'default')
            setDefault((element.propertyName ?? element.name).getText(file), element);
        }
      }
    } else if (!ts.isEmptyStatement(statement)) {
      converter.report('JOTL2107', statement, { kind: ts.SyntaxKind[statement.kind] ?? 'unknown' });
    }
  }

  const tagged = [...converter.declarations.values()].find(declaration => converter.hasRootTag(declaration));
  const rootName = tagged?.name.text ?? defaultName;
  converter.rootDeclaration = rootName === undefined ? undefined : converter.declarations.get(rootName);
  const defs: Record<string, JsonSchemaObject> = {};
  for (const [name, declaration] of converter.declarations) {
    const parameters = declaration.typeParameters;
    if (parameters !== undefined && parameters.length > 0) {
      converter.report('JOTL2102', declaration.name, { name });
      continue;
    }
    if (ts.isInterfaceDeclaration(declaration) && declaration.heritageClauses !== undefined) {
      converter.report('JOTL2110', declaration.name, { name });
      continue;
    }
    defs[name] = converter.convertDeclaration(declaration);
  }

  const root: JsonSchemaObject = { $schema: JSON_SCHEMA_DIALECT };
  if (defaultName !== undefined && !converter.declarations.has(defaultName))
    converter.report('JOTL2112', defaultNode as ts.Node);
  if (rootName !== undefined && converter.declarations.has(rootName)) {
    root.$ref = `#/$defs/${escapePointerToken(rootName)}`;
    if (converter.document.id !== undefined) root.$id = converter.document.id;
    // 与 Jotl 编译器一致: 有根时在根写入 x-ui 协议版本.
    root['x-ui'] = {
      version: 1,
      ...(converter.document.rules === undefined ? {} : { rules: converter.document.rules }),
      ...(converter.document.widgets === undefined ? {} : { widgets: converter.document.widgets }),
    };
  }
  if (Object.keys(defs).length > 0) root.$defs = defs;
  const diagnostics = converter.diagnostics;
  if (hasErrors(diagnostics)) return fail(diagnostics);
  const result: TsToSchemaResult = ok(orderKeywords(root) as JsonSchemaObject, diagnostics);
  if (defaultName !== undefined && Object.hasOwn(defs, defaultName)) result.defaultExport = defaultName;
  return result;
}
