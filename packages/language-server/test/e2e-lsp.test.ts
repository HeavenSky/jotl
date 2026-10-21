// 端到端: 进程内 LSP 连接上打开共享样例, 核对诊断, 补全, 快速修复, 悬停, 大纲与跳转.
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CodeActionRequest,
  CompletionRequest,
  createConnection,
  DefinitionRequest,
  DocumentSymbolRequest,
  HoverRequest,
  createProtocolConnection,
  DiagnosticSeverity,
  DidOpenTextDocumentNotification,
  InitializedNotification,
  InitializeRequest,
  type CompletionItem,
  type CompletionList,
  type DocumentSymbol,
  type MarkupContent,
  type ProtocolConnection,
  type PublishDiagnosticsParams,
  PublishDiagnosticsNotification,
} from 'vscode-languageserver/node';
import { parse } from '@jotl/core';
import { listFixtures, readFixture, sortByKey } from '../../../test-utils/fixtures.js';
import { createServer } from '../src/index.js';

let client: ProtocolConnection;
const published = new Map<string, PublishDiagnosticsParams>();
let waiters: (() => void)[] = [];

function diagnosticsFor(uri: string): Promise<PublishDiagnosticsParams> {
  return new Promise(resolve => {
    const check = () => {
      const found = published.get(uri);
      if (found) resolve(found);
      else waiters.push(check);
    };
    check();
  });
}

async function open(uri: string, text: string): Promise<PublishDiagnosticsParams> {
  const pending = diagnosticsFor(uri);
  await client.sendNotification(DidOpenTextDocumentNotification.type, {
    textDocument: { uri, languageId: 'jotl', version: 1, text },
  });
  return pending;
}

function items(result: CompletionItem[] | CompletionList | null): string[] {
  if (result === null) return [];
  return (Array.isArray(result) ? result : result.items).map(i => i.label);
}

beforeEach(async () => {
  const toServer = new PassThrough();
  const toClient = new PassThrough();
  const server = createConnection(toServer, toClient);
  createServer(server);
  server.listen();
  client = createProtocolConnection(toClient, toServer);
  published.clear();
  waiters = [];
  client.onNotification(PublishDiagnosticsNotification.type, params => {
    published.set(params.uri, params);
    for (const waiter of waiters.splice(0)) waiter();
  });
  client.listen();
  await client.sendRequest(InitializeRequest.type, {
    processId: null,
    rootUri: null,
    capabilities: {},
    locale: 'zh-CN',
  });
  await client.sendNotification(InitializedNotification.type, {});
});

afterEach(() => {
  client.dispose();
});

describe('语言服务端到端', () => {
  it('全部共享样例: 无期望诊断的样例不报 error, 有期望诊断的样例与编译器诊断一致', async () => {
    for (const name of listFixtures()) {
      const fixture = readFixture(name);
      const uri = `file:///fixtures/${name}/source.jotl`;
      const { diagnostics } = await open(uri, fixture.source ?? '');
      if (fixture.diagnostics) {
        const actual = diagnostics
          .filter(d => String(d.code).startsWith('JOTL1'))
          .map(d => ({ code: String(d.code), line: d.range.start.line + 1, column: d.range.start.character + 1 }));
        expect(sortByKey(actual), name).toEqual(sortByKey(fixture.diagnostics));
      } else {
        expect(
          diagnostics.filter(d => d.severity === DiagnosticSeverity.Error),
          name
        ).toEqual([]);
      }
    }
  });

  it('013 中未登记的自定义组件只报警告', async () => {
    const { diagnostics } = await open('file:///fixtures/013.jotl', readFixture('013-x-ui-basic').source ?? '');
    const widgets = diagnostics.filter(d => d.code === 'JOTL7001');
    expect(widgets.length).toBeGreaterThan(0);
    expect(widgets.every(d => d.severity === DiagnosticSeverity.Warning)).toBe(true);
  });

  it("`widget: '` 引号内补全该组件的候选", async () => {
    const text = "A: {\n  t: string[widget: '']\n}\n";
    const uri = 'file:///complete.jotl';
    await open(uri, text);
    const result = await client.sendRequest(CompletionRequest.type, {
      textDocument: { uri },
      position: { line: 1, character: text.split('\n')[1]!.indexOf("''") + 1 },
    });
    expect(items(result)).toEqual(['input', 'textarea', 'password', 'richtext', 'output', 'json']);
  });

  it('顶层的小写字段提供 "包进 Root" 快速修复', async () => {
    const text = 'title: string\ncount: integer\n';
    const uri = 'file:///fix.jotl';
    const { diagnostics } = await open(uri, text);
    const target = diagnostics.find(d => d.code === 'JOTL1036');
    expect(target).toBeDefined();
    const actions = await client.sendRequest(CodeActionRequest.type, {
      textDocument: { uri },
      range: target!.range,
      context: { diagnostics: [target!] },
    });
    const edits = (actions ?? []).flatMap(a => ('edit' in a && a.edit?.changes ? (a.edit.changes[uri] ?? []) : []));
    expect(edits.map(e => e.newText).join('')).toContain('Root(根): {');
  });

  it('全部共享样例: 大纲列出每个声明, 声明名上的悬停片段等于期望 schema 中的 $defs 条目, 声明名跳转到自身', async () => {
    let checked = 0;
    for (const name of listFixtures()) {
      const fixture = readFixture(name);
      const source = fixture.source ?? '';
      const uri = `file:///fixtures/${name}/source.jotl`;
      await open(uri, source);
      const declarations = parse(source, uri).value!.entries;
      const symbols = (await client.sendRequest(DocumentSymbolRequest.type, { textDocument: { uri } })) as
        | DocumentSymbol[]
        | null;
      expect(
        symbols?.map(s => s.name),
        name
      ).toEqual(declarations.map(d => d.key.name));
      if (!fixture.hasSchema || fixture.diagnostics) continue;
      const defs = (fixture.schema as { $defs?: Record<string, unknown> }).$defs ?? {};
      for (const declaration of declarations) {
        const start = declaration.key.span.range.start;
        const position = { line: start.line - 1, character: start.column - 1 };
        const hover = await client.sendRequest(HoverRequest.type, { textDocument: { uri }, position });
        const value = (hover?.contents as MarkupContent | undefined)?.value ?? '';
        const block = /(`{3,})json\n([\s\S]*?)\n\1/.exec(value)?.[2];
        const declared = declaration.key.name;
        if (block !== undefined && !block.endsWith('…'))
          expect(JSON.parse(block), `${name} ${declared}`).toEqual(defs[declared]);
        else expect(value, `${name} ${declared}`).toContain('只显示前');
        const definition = await client.sendRequest(DefinitionRequest.type, { textDocument: { uri }, position });
        expect(definition, `${name} ${declared}`).toEqual([
          {
            uri,
            range: { start: position, end: { line: position.line, character: position.character + declared.length } },
          },
        ]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
