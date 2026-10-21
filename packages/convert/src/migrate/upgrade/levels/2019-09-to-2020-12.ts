// 2019-09 → 2020-12: 数组形式的 items 改为 prefixItems, additionalItems 改为 items, $recursive* 改为 $dynamic*.
import type { Level, MutableSchema, RuleContext } from "../rule-context.js";

/** $recursiveAnchor: true 改写后的 $dynamicAnchor 名称; $recursiveRef "#" 改为指向它的 $dynamicRef. */
export const RECURSIVE_ANCHOR_NAME = "recursiveAnchor";

function rewriteArrayItems(node: MutableSchema, ctx: RuleContext): void {
	if (!Array.isArray(node.items)) {
		if (node.additionalItems !== undefined) {
			ctx.report("JOTL3114", {}, ["additionalItems"]);
			delete node.additionalItems;
		}
		return;
	}
	if (node.prefixItems !== undefined) {
		const choice = ctx.conflict("JOTL3302", { declared: ctx.declared }, ["items"]);
		if (choice === "latest") {
			ctx.alias(["items"], ["prefixItems"]);
			delete node.items;
			delete node.additionalItems;
			return;
		}
	} else {
		ctx.report("JOTL3112", {}, ["items"]);
	}
	node.prefixItems = node.items;
	delete node.items;
	ctx.move(["items"], ["prefixItems"]);
	if (node.additionalItems !== undefined) {
		ctx.report("JOTL3113", {}, ["additionalItems"]);
		node.items = node.additionalItems;
		delete node.additionalItems;
		ctx.move(["additionalItems"], ["items"]);
	}
}

function rewriteRecursiveAnchor(node: MutableSchema, ctx: RuleContext): void {
	if (!Object.hasOwn(node, "$recursiveAnchor")) return;
	if (node.$recursiveAnchor === true && ctx.isResourceRoot && node.$dynamicAnchor === undefined) {
		ctx.report("JOTL3115", { anchor: RECURSIVE_ANCHOR_NAME }, ["$recursiveAnchor"]);
		node.$dynamicAnchor = RECURSIVE_ANCHOR_NAME;
	} else {
		ctx.report("JOTL3116", {}, ["$recursiveAnchor"]);
	}
	delete node.$recursiveAnchor;
}

function rewriteRecursiveRef(node: MutableSchema, ctx: RuleContext): void {
	const ref = node.$recursiveRef;
	if (typeof ref !== "string") return;
	let keyword: "$ref" | "$dynamicRef";
	let value: string;
	if (ref === "#" && ctx.resourceHasRecursiveAnchor) {
		keyword = "$dynamicRef";
		value = "#" + RECURSIVE_ANCHOR_NAME;
		ctx.report("JOTL3117", { ref, dynamicRef: value }, ["$recursiveRef"]);
	} else {
		keyword = "$ref";
		value = ref;
		ctx.report("JOTL3118", { ref }, ["$recursiveRef"]);
	}
	delete node.$recursiveRef;
	if (node[keyword] === undefined) {
		node[keyword] = value;
	} else {
		node.allOf = [...(Array.isArray(node.allOf) ? node.allOf : []), { [keyword]: value }];
	}
}

export const DRAFT_2019_09_TO_2020_12: Level = {
	from: "2019-09",
	to: "2020-12",
	rules: [rewriteArrayItems, rewriteRecursiveAnchor, rewriteRecursiveRef],
};
