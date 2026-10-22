// Jotl 语言核心: schema/ 为 JSON Schema 2020-12 与 x-ui 类型契约, 诊断, JSON Pointer 与数据能力接口; syntax/ 为 Jotl 语法的解析, 编译, 打印与格式化.
export * from "./schema/index.js";
export * from "./syntax/index.js";
export { type JsonSyntaxError, jsonPointerOffsets, locateJsonError } from "./syntax/json-locate.js";
export {
	type HoistedDefs,
	embeddedResources,
	hoistDefs,
	restorePointer,
} from "./schema/hoist-defs.js";
