// eslint-plugin-jsdoc 的预设(子路径 `@jotl/convert/eslint`): `jsdoc/check-tag-names` 的 `definedTags`.
import { CUSTOM_TAGS, TSDOC_ONLY_TAGS } from './tags.js';

/** 用法: `rules: { "jsdoc/check-tag-names": ["error", { definedTags }] }`. */
export const definedTags: readonly string[] = [...CUSTOM_TAGS.map(t => t.name), ...TSDOC_ONLY_TAGS];
