// 逐级改写规则的接口: 规则在单个 schema 节点上就地改写浅拷贝, 通过上下文报告变更, 冲突与子 schema 的移动.
import type { UpgradeDiagnosticCode } from "./diagnostics.js";
import type { SchemaVersion } from "./versions.js";

/** 规则改写的是节点的浅拷贝; 子 schema 与其他嵌套值仍是输入对象, 规则不得原地修改它们. */
export type MutableSchema = Record<string, unknown>;

export type DiagnosticParams = Readonly<Record<string, string | number>>;

/** 冲突时采用的语义: 声明版本, 或 2020-12. */
export type ConflictChoice = "declared" | "latest";

export interface RuleContext {
	/** 节点所属文档(或带 `$schema` 的嵌套资源)的声明版本. */
	readonly declared: SchemaVersion;
	readonly acceptNewerKeywords: boolean;
	/** 节点是否为 schema 资源的根(文档根或带 `$id` 的节点). */
	readonly isResourceRoot: boolean;
	/** 节点所在资源的根是否带 `$recursiveAnchor: true`. */
	readonly resourceHasRecursiveAnchor: boolean;
	/** path 为相对节点的当前关键字路径, 由上下文换算为输入文档中的 JSON Pointer. */
	report(code: UpgradeDiagnosticCode, params: DiagnosticParams, path: readonly string[]): void;
	/** 报告冲突并按 onConflict 返回采用的语义; onConflict 为 error 时记 error 并返回 "declared" 以便继续收集. */
	conflict(
		code: UpgradeDiagnosticCode,
		params: DiagnosticParams,
		path: readonly string[]
	): ConflictChoice;
	/** 登记子 schema 的改名, 用于换算输入位置与改写 `$ref`; 必须在 report 该位置之后调用. */
	move(from: readonly string[], to: readonly string[]): void;
	/** 冲突中被舍弃的子 schema: 指向 from 的 $ref 改指保留下来的 to; 不影响位置换算. */
	alias(from: readonly string[], to: readonly string[]): void;
}

export type Rule = (node: MutableSchema, ctx: RuleContext) => void;

/** 相邻两版之间的一组规则. */
export interface Level {
	from: SchemaVersion;
	to: SchemaVersion;
	rules: readonly Rule[];
}
