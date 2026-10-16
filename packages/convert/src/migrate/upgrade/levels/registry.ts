// 逐级升级的级别表; 新版本发布时追加一级, 并把上一个终点改为指向它.
import { l10n } from "@jotl/core";
import type { Level } from "../rule-context.js";
import type { SchemaVersion } from "../versions.js";
import { DRAFT_04_TO_06 } from "./draft-04-to-06.js";
import { DRAFT_06_TO_07 } from "./draft-06-to-07.js";
import { DRAFT_07_TO_2019_09 } from "./draft-07-to-2019-09.js";
import { DRAFT_2019_09_TO_2020_12 } from "./2019-09-to-2020-12.js";
import { OPENAPI_3_0_TO_2020_12 } from "./openapi-3-0-to-2020-12.js";
import { SWAGGER_2_TO_OPENAPI_3_0 } from "./swagger-2-to-openapi-3-0.js";

export const TARGET_VERSION: SchemaVersion = "2020-12";

const OPENAPI_3_1_TO_2020_12: Level = { from: "openapi-3.1", to: "2020-12", rules: [] };

export const LEVELS: readonly Level[] = [
  DRAFT_04_TO_06,
  DRAFT_06_TO_07,
  DRAFT_07_TO_2019_09,
  DRAFT_2019_09_TO_2020_12,
  SWAGGER_2_TO_OPENAPI_3_0,
  OPENAPI_3_0_TO_2020_12,
  OPENAPI_3_1_TO_2020_12,
];

/** 从 version 到 2020-12 依次经过的级别. */
export function levelChain(version: SchemaVersion): Level[] {
  const chain: Level[] = [];
  let current = version;
  while (current !== TARGET_VERSION) {
    const level = LEVELS.find((l) => l.from === current);
    if (level === undefined) throw new Error(l10n(`没有从 ${current} 出发的升级级别`, `No upgrade level starts from ${current}`));
    chain.push(level);
    current = level.to;
  }
  return chain;
}
