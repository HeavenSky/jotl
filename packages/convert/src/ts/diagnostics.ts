// ts/ 的诊断代码表(JOTL2xxx): JOTL20xx 为 schema → TS, JOTL21xx 为 TS → schema.
import { defineDiagnostics } from '@jotl/core';

export const TS_DIAGNOSTICS = {
  JOTL2001: { severity: 'error', message: '输入不是 JSON Schema 对象', en: 'Input is not a JSON Schema object' },
  JOTL2002: {
    severity: 'warning',
    message: '关键字 {keyword} 无法用 TS 表达, 转换时丢弃',
    en: 'Keyword {keyword} cannot be expressed in TS and is dropped',
  },
  JOTL2003: {
    severity: 'warning',
    message: '引用 {ref} 不指向本文档的 $defs, 按 unknown 输出',
    en: 'Reference {ref} does not point to $defs in this document; emitted as unknown',
  },
  JOTL2004: {
    severity: 'warning',
    message: '类型名 {name} 不是合法的 TS 标识符, 改名为 {renamed}',
    en: 'Type name {name} is not a valid TS identifier; renamed to {renamed}',
  },
  JOTL2005: {
    severity: 'warning',
    message: '值 {value} 无法写成 TS 字面量类型, 按 unknown 输出',
    en: 'Value {value} cannot be written as a TS literal type; emitted as unknown',
  },
  JOTL2006: {
    severity: 'warning',
    message: '根 schema 不是指向 $defs 的 $ref, 其内容输出为类型 {name}',
    en: 'Root schema is not a $ref to $defs; its content is emitted as type {name}',
  },

  JOTL2101: { severity: 'error', message: 'TS 语法错误: {message}', en: 'TS syntax error: {message}' },
  JOTL2102: { severity: 'error', message: '不支持泛型: {name}', en: 'Generics are not supported: {name}' },
  JOTL2103: { severity: 'error', message: '不支持条件类型', en: 'Conditional types are not supported' },
  JOTL2104: { severity: 'error', message: '不支持映射类型', en: 'Mapped types are not supported' },
  JOTL2105: { severity: 'error', message: '不支持函数类型', en: 'Function types are not supported' },
  JOTL2106: { severity: 'error', message: '不支持的 TS 类型写法: {kind}', en: 'Unsupported TS type syntax: {kind}' },
  JOTL2107: {
    severity: 'error',
    message: '不支持的声明: {kind}; 只支持 interface, type 与 export default',
    en: 'Unsupported declaration: {kind}; only interface, type and export default are supported',
  },
  JOTL2108: {
    severity: 'warning',
    message: '导入声明已忽略, 跨文件类型不会被转换',
    en: 'Import declarations are ignored; cross-file types are not converted',
  },
  JOTL2109: { severity: 'error', message: '未定义的类型: {name}', en: 'Undefined type: {name}' },
  JOTL2110: {
    severity: 'error',
    message: '不支持接口继承: {name}',
    en: 'Interface inheritance is not supported: {name}',
  },
  JOTL2111: { severity: 'error', message: '类型 {name} 重复声明', en: 'Type {name} is declared more than once' },
  JOTL2112: {
    severity: 'error',
    message: 'export default 只能引用本文件中声明的类型, 且一个文件最多一个',
    en: 'export default can only reference a type declared in this file, and at most once per file',
  },
  JOTL2113: {
    severity: 'warning',
    message: '标签 @{tag} 的值不是合法 JSON, 按字符串处理',
    en: 'The value of tag @{tag} is not valid JSON; treated as a string',
  },
  JOTL2114: { severity: 'warning', message: '未知标签 @{tag} 已忽略', en: 'Unknown tag @{tag} ignored' },
  JOTL2115: {
    severity: 'warning',
    message: '标签 @{tag} 不适用于该类型, 已忽略',
    en: 'Tag @{tag} does not apply to this type; ignored',
  },
  JOTL2116: {
    severity: 'error',
    message: '标签 @{tag} 的值不合法, 需要{expected}',
    en: 'Invalid value for tag @{tag}; expected {expected}',
  },
  JOTL2117: { severity: 'error', message: '不支持计算属性名', en: 'Computed property names are not supported' },
  JOTL2118: {
    severity: 'warning',
    message: '@asType 只支持 integer, 已忽略 {value}',
    en: '@asType only supports integer; ignored {value}',
  },
} as const;

export type TsDiagnosticCode = keyof typeof TS_DIAGNOSTICS;

export const tsDiagnostic = defineDiagnostics(TS_DIAGNOSTICS);
