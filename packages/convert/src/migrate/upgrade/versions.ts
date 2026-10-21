// 可升级的源版本, `$schema` URI 与版本的对应, 以及各关键字的引入版本.
export const SCHEMA_VERSIONS = [
	"draft-04",
	"draft-06",
	"draft-07",
	"2019-09",
	"2020-12",
	"swagger-2.0",
	"openapi-3.0",
	"openapi-3.1",
] as const;

export type SchemaVersion = (typeof SCHEMA_VERSIONS)[number];

/** JSON Schema 规范本身的各版, 按发布先后排列. */
export type DraftVersion = "draft-04" | "draft-06" | "draft-07" | "2019-09" | "2020-12";

const DRAFT_ORDER: readonly DraftVersion[] = [
	"draft-04",
	"draft-06",
	"draft-07",
	"2019-09",
	"2020-12",
];

export function isSchemaVersion(value: unknown): value is SchemaVersion {
	return typeof value === "string" && (SCHEMA_VERSIONS as readonly string[]).includes(value);
}

/**
 * 判断关键字新旧时所对照的 JSON Schema 版本.
 * Swagger 2.0 与 OpenAPI 3.0 的 Schema Object 基于 draft-04 的关键字集合; OpenAPI 3.1 即 2020-12.
 */
export function vocabularyBase(version: SchemaVersion): DraftVersion {
	switch (version) {
		case "swagger-2.0":
		case "openapi-3.0":
			return "draft-04";
		case "openapi-3.1":
			return "2020-12";
		default:
			return version;
	}
}

export function draftRank(version: DraftVersion): number {
	return DRAFT_ORDER.indexOf(version);
}

/** `version` 的关键字集合是否早于 `than`(按 vocabularyBase 比较). */
export function isOlderThan(version: SchemaVersion, than: DraftVersion): boolean {
	return draftRank(vocabularyBase(version)) < draftRank(than);
}

export function isOpenApi(version: SchemaVersion): boolean {
	return version === "swagger-2.0" || version === "openapi-3.0";
}

export type DialectMatch =
	| { kind: "version"; version: SchemaVersion }
	| { kind: "draft-03" }
	| { kind: "unknown" };

const DRAFT_URI = /^https?:\/\/json-schema\.org\/(draft-0[3467])\/(?:hyper-)?schema#?$/;
const DATED_URI = /^https?:\/\/json-schema\.org\/draft\/(2019-09|2020-12)\/(?:hyper-)?schema#?$/;
/** JSON Schema 稳定版 v1 的方言 URI; 关键字集合沿用 2020-12, 按 2020-12 读取. */
const STABLE_V1_URI = /^https:\/\/json-schema\.org\/v1(?:\/\d{4})?#?$/;
const OPENAPI_31_URI = /^https:\/\/spec\.openapis\.org\/oas\/3\.1\/dialect\/[A-Za-z0-9-]+#?$/;

/** 按 `$schema` 的取值识别版本; 同时接受 http 与 https, 带或不带空片段, 以及对应的 hyper-schema. */
export function matchDialect(uri: string): DialectMatch {
	const draft = DRAFT_URI.exec(uri);
	if (draft) {
		if (draft[1] === "draft-03") return { kind: "draft-03" };
		return { kind: "version", version: draft[1] as SchemaVersion };
	}
	const dated = DATED_URI.exec(uri);
	if (dated) return { kind: "version", version: dated[1] as SchemaVersion };
	if (STABLE_V1_URI.test(uri)) return { kind: "version", version: "2020-12" };
	if (OPENAPI_31_URI.test(uri)) return { kind: "version", version: "openapi-3.1" };
	return { kind: "unknown" };
}

/** 每个 JSON Schema 关键字首次出现的版本; 不在表中的关键字视为未知关键字. */
export const KEYWORD_INTRODUCED: Readonly<Record<string, DraftVersion>> = {
	id: "draft-04",
	$schema: "draft-04",
	$ref: "draft-04",
	title: "draft-04",
	description: "draft-04",
	default: "draft-04",
	multipleOf: "draft-04",
	maximum: "draft-04",
	exclusiveMaximum: "draft-04",
	minimum: "draft-04",
	exclusiveMinimum: "draft-04",
	maxLength: "draft-04",
	minLength: "draft-04",
	pattern: "draft-04",
	additionalItems: "draft-04",
	items: "draft-04",
	maxItems: "draft-04",
	minItems: "draft-04",
	uniqueItems: "draft-04",
	maxProperties: "draft-04",
	minProperties: "draft-04",
	required: "draft-04",
	additionalProperties: "draft-04",
	definitions: "draft-04",
	properties: "draft-04",
	patternProperties: "draft-04",
	dependencies: "draft-04",
	enum: "draft-04",
	type: "draft-04",
	format: "draft-04",
	allOf: "draft-04",
	anyOf: "draft-04",
	oneOf: "draft-04",
	not: "draft-04",
	$id: "draft-06",
	const: "draft-06",
	contains: "draft-06",
	propertyNames: "draft-06",
	examples: "draft-06",
	if: "draft-07",
	then: "draft-07",
	else: "draft-07",
	$comment: "draft-07",
	contentMediaType: "draft-07",
	contentEncoding: "draft-07",
	readOnly: "draft-07",
	writeOnly: "draft-07",
	$defs: "2019-09",
	$anchor: "2019-09",
	$recursiveRef: "2019-09",
	$recursiveAnchor: "2019-09",
	$vocabulary: "2019-09",
	dependentRequired: "2019-09",
	dependentSchemas: "2019-09",
	unevaluatedProperties: "2019-09",
	unevaluatedItems: "2019-09",
	minContains: "2019-09",
	maxContains: "2019-09",
	deprecated: "2019-09",
	contentSchema: "2019-09",
	prefixItems: "2020-12",
	$dynamicRef: "2020-12",
	$dynamicAnchor: "2020-12",
};

/** Swagger 2.0 / OpenAPI 3.0 的 Schema Object 自带, 不按 draft-04 视为新关键字. */
export const OPENAPI_NATIVE_KEYWORDS: ReadonlySet<string> = new Set([
	"readOnly",
	"writeOnly",
	"deprecated",
]);

export function isKnownKeyword(keyword: string): boolean {
	return Object.hasOwn(KEYWORD_INTRODUCED, keyword);
}
