// 格式化: Jotl 源码 → 规范排版, 保留全部注释.
import { type Result, hasErrors } from "../../schema/index.js";
import { byPosition } from "../diagnostics.js";
import { parseSource } from "../parser.js";
import { renderFile } from "./render.js";

/**
 * 按规范排版重写源码, 不改变编译结果.
 * 排版: 两空格缩进; 顶层条目之间空一行, 标识独占一行写在条目之前; 体内条目一行一个; 枚举成员内部无注释时写在一行;
 * 键, 标签, `?`, 组件与元数据紧贴, `:` 后与体的 `{` 前留一个空格(枚举体紧贴); 省略 `,` `;` 分隔符;
 * 连续空行压成一个, 块首不留空行; 注释留在原来的两个记号之间; 字符串与数字保持原文.
 * 有语法错误时原样返回源码, 并附带语法诊断.
 */
export function format(text: string, file: string): Result<string> {
  const { ast, diagnostics } = parseSource(text, file);
  diagnostics.sort(byPosition);
  if (hasErrors(diagnostics)) return { value: text, diagnostics };
  return { value: renderFile(ast, { text, comments: ast.comments }), diagnostics };
}
