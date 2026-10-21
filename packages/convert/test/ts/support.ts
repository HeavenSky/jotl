// 测试共用工具: 按 `tsdoc.json` 预设解析注释, 用 TS 编译器对内存中的产物做类型检查.
import { lstatSync, mkdirSync, symlinkSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TSDocConfiguration, TSDocParser } from '@microsoft/tsdoc';
import { TSDocConfigFile } from '@microsoft/tsdoc-config';
import ts from 'typescript';
import type { SchemaToTsOptions } from '../../src/ts/index.js';
import type { Fixture } from '../../../../test-utils/fixtures.js';

export const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const PRESET_PATH = join(PACKAGE_DIR, 'tsdoc.json');
/** 模拟消费方项目的目录, 其 tsdoc.json 以 `extends: ["@jotl/convert/tsdoc.json"]` 继承预设. */
export const CONSUMER_DIR = join(PACKAGE_DIR, 'test', 'ts', 'tsdoc-consumer');

/** 消费方目录下的 node_modules/@jotl/convert 链接到本包, 模拟安装后的解析路径; node_modules 不入库, 缺失时创建. */
export function ensureConsumerLink(): void {
  const link = join(CONSUMER_DIR, 'node_modules', '@jotl', 'convert');
  try {
    lstatSync(link);
    return;
  } catch {
    // 不存在时创建.
  }
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(relative(dirname(link), PACKAGE_DIR), link, 'dir');
}

/** 加载 tsdoc.json(含 extends 链)并配置解析器; 配置文件有错误时一并返回. */
export function loadTsdocParser(configPath: string): { parser: TSDocParser; errors: string | undefined } {
  const configFile = TSDocConfigFile.loadFile(configPath);
  const configuration = new TSDocConfiguration();
  configFile.configureParser(configuration);
  return {
    parser: new TSDocParser(configuration),
    errors: configFile.hasErrors ? configFile.getErrorSummary() : undefined,
  };
}

/** 文本中全部 `/** *\/` 注释经 TSDoc 解析得到的告警, 每条为 "messageId: 文本". */
export function tsdocMessages(parser: TSDocParser, text: string): string[] {
  const comments = text.match(/\/\*\*[\s\S]*?\*\//g) ?? [];
  return comments.flatMap(comment =>
    parser.parseString(comment).log.messages.map(m => `${m.messageId}: ${m.unformattedText} @ ${comment}`)
  );
}

/**
 * 对内存中的文件做类型检查, 返回格式化的诊断; 文件放在本包 test 目录下的虚拟路径,
 * 以便按本包的 node_modules 解析 `typia` 等依赖.
 */
export function typecheck(files: Record<string, string>): string[] {
  const root = join(PACKAGE_DIR, 'test', 'ts', '__virtual__');
  const virtual = new Map(Object.entries(files).map(([name, text]) => [join(root, name), text]));
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2023,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    skipLibCheck: false,
    types: [],
  };
  const host = ts.createCompilerHost(options);
  const original = { getSourceFile: host.getSourceFile, fileExists: host.fileExists, readFile: host.readFile };
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    const text = virtual.get(fileName);
    return text === undefined
      ? original.getSourceFile.call(host, fileName, languageVersion, onError, shouldCreate)
      : ts.createSourceFile(fileName, text, languageVersion, true);
  };
  host.fileExists = fileName => virtual.has(fileName) || original.fileExists.call(host, fileName);
  host.readFile = fileName => virtual.get(fileName) ?? original.readFile.call(host, fileName);
  const program = ts.createProgram([...virtual.keys()], options, host);
  return ts.getPreEmitDiagnostics(program).map(d => {
    const where = d.file
      ? `${d.file.fileName.slice(root.length + 1)}:${d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1}`
      : '';
    return `${where} TS${d.code}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
  });
}

/** 样例 `meta.json` 的 `defaultExport`: 默认导出与根不同的样例记录 source.jotl 编译出的默认导出名(syntax 的样例测试核对两者一致). */
export function fixtureTsOptions(fixture: Fixture): SchemaToTsOptions {
  const name = (fixture.meta as { defaultExport?: unknown }).defaultExport;
  return typeof name === 'string' ? { defaultExport: name } : {};
}
