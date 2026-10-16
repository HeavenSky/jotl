// TS 声明 + JSDoc → JSON Schema; 依赖 typescript 编译器, 因此不从主入口导出.
export { tsToSchema, type TsToSchemaOptions, type TsToSchemaResult } from "./ts/ts-to-schema.js";
