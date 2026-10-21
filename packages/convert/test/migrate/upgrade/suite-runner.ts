// 官方 JSON-Schema-Test-Suite 的运行器: 升级源版本用例的 schema 后用 ajv/dist/2020 校验, 返回与期望不一致的用例.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Result, ok } from '@jotl/core';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { type SchemaVersion, upgradeDocuments } from '../../../src/migrate/upgrade/index.js';

export const SUITE_DIR = fileURLToPath(new URL('../../../../../vendor/json-schema-test-suite/', import.meta.url));
const REMOTES_DIR = join(SUITE_DIR, 'remotes');
const REMOTE_BASE = 'http://localhost:1234/';
const require = createRequire(import.meta.url);
const AJV_REFS = join(require.resolve('ajv/dist/2020.js'), '../refs');

/** 测试集目录名 → 源版本. */
export const SUITE_DRAFTS = {
  draft4: 'draft-04',
  draft6: 'draft-06',
  draft7: 'draft-07',
  'draft2019-09': '2019-09',
} as const satisfies Record<string, SchemaVersion>;

export type SuiteDraft = keyof typeof SUITE_DRAFTS;

interface SuiteTest {
  description: string;
  data: unknown;
  valid: boolean;
}

interface SuiteGroup {
  description: string;
  schema: unknown;
  tests: SuiteTest[];
}

export interface CaseOutcome {
  file: string;
  group: string;
  test: string;
  passed: boolean;
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** 元 schema 与 remotes 的本地来源; 不认识的 URI 交给 Ajv 自己处理(内置的 2020-12 元 schema)或让编译失败. */
function localDocument(uri: string): unknown {
  if (uri.startsWith(REMOTE_BASE)) {
    const path = join(REMOTES_DIR, uri.slice(REMOTE_BASE.length));
    return existsSync(path) ? readJson(path) : undefined;
  }
  const draft = /^https?:\/\/json-schema\.org\/(draft-0[67])\/schema$/.exec(uri);
  if (draft) return readJson(join(AJV_REFS, `json-schema-${draft[1]}.json`));
  const dated = /^https:\/\/json-schema\.org\/draft\/2019-09\/(schema|meta\/[a-z-]+)$/.exec(uri);
  if (dated) return readJson(join(AJV_REFS, 'json-schema-2019-09', `${dated[1]}.json`));
  return undefined;
}

export function suiteAvailable(): boolean {
  return existsSync(join(SUITE_DIR, 'tests'));
}

export function listSuiteFiles(draft: SuiteDraft): string[] {
  return readdirSync(join(SUITE_DIR, 'tests', draft))
    .filter(name => name.endsWith('.json'))
    .sort();
}

async function runGroup(draft: SuiteDraft, file: string, index: number, group: SuiteGroup): Promise<CaseOutcome[]> {
  const entry = `https://jotl-suite.test/${draft}/${file}/${index}.json`;
  const upgraded = await upgradeDocuments(entry, {
    version: SUITE_DRAFTS[draft],
    acceptNewerKeywords: false,
    onConflict: 'preferDeclared',
    load: (uri): Result<unknown> => ok(uri === entry ? group.schema : localDocument(uri)),
  });
  let check: ((data: unknown) => boolean) | undefined;
  if (upgraded.value !== undefined) {
    try {
      const ajv = new Ajv2020({ strict: false, validateFormats: false, logger: false });
      // 与 @jotl/data 的 createAjv 相同: 给 $id 一个空定义, 避免 $id 与指回本资源的 $ref 同在一个节点时编译栈溢出.
      ajv.removeKeyword('$id');
      ajv.addKeyword({ keyword: '$id', schemaType: 'string' });
      for (const [uri, doc] of upgraded.value.documents) {
        if (uri !== upgraded.value.entry) ajv.addSchema(doc.schema as object, uri);
      }
      const validate = ajv.compile(upgraded.value.documents.get(upgraded.value.entry)!.schema as object);
      check = data => validate(data);
    } catch {
      check = undefined;
    }
  }
  return group.tests.map(t => {
    let passed = false;
    try {
      passed = check !== undefined && check(t.data) === t.valid;
    } catch {
      passed = false;
    }
    return { file, group: group.description, test: t.description, passed };
  });
}

export async function runSuiteFile(draft: SuiteDraft, file: string): Promise<CaseOutcome[]> {
  const groups = readJson(join(SUITE_DIR, 'tests', draft, file)) as SuiteGroup[];
  const outcomes: CaseOutcome[] = [];
  for (const [index, group] of groups.entries()) outcomes.push(...(await runGroup(draft, file, index, group)));
  return outcomes;
}
