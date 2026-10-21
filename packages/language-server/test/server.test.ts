// 服务接线: 进程内连接上的初始化, 打开与增量变更时推送诊断, 补全, 快速修复, 悬停, 跳转, 引用, 大纲与预览请求.
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { setLocale } from "@jotl/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	CodeActionRequest,
	CompletionRequest,
	createConnection,
	DefinitionRequest,
	DocumentSymbolRequest,
	HoverRequest,
	ReferencesRequest,
	createProtocolConnection,
	DidChangeConfigurationNotification,
	DidChangeWatchedFilesNotification,
	FileChangeType,
	DidChangeTextDocumentNotification,
	DidCloseTextDocumentNotification,
	DidOpenTextDocumentNotification,
	InitializedNotification,
	InitializeRequest,
	type InitializeResult,
	type ProtocolConnection,
	type PublishDiagnosticsParams,
	PublishDiagnosticsNotification,
	TextDocumentSyncKind,
} from "vscode-languageserver/node";
import {
	COMPLETION_TRIGGER_CHARACTERS,
	createServer,
	PREVIEW_CONFIG_CHANGED_METHOD,
	PREVIEW_REQUEST_METHOD,
	type PreviewContent,
	type ServerOptions,
} from "../src/index.js";
import { URI } from "./helpers.js";

let client: ProtocolConnection;
let published: PublishDiagnosticsParams[];
let waiters: (() => void)[];

function nextDiagnostics(): Promise<PublishDiagnosticsParams> {
	const seen = published.length;
	return new Promise(resolve => {
		const check = () => {
			if (published.length > seen) resolve(published[seen]!);
			else waiters.push(check);
		};
		check();
	});
}

/** locale 缺省为 zh-CN(现有断言为中文); 传 null 时不带 locale, 走服务端默认语言. */
async function initialize(
	initializationOptions?: unknown,
	locale: string | null = "zh-CN"
): Promise<InitializeResult> {
	const result = await client.sendRequest(InitializeRequest.type, {
		processId: null,
		rootUri: null,
		capabilities: {},
		initializationOptions,
		...(locale === null ? {} : { locale }),
	});
	await client.sendNotification(InitializedNotification.type, {});
	return result;
}

async function open(text: string, uri = URI): Promise<PublishDiagnosticsParams> {
	const diagnostics = nextDiagnostics();
	await client.sendNotification(DidOpenTextDocumentNotification.type, {
		textDocument: { uri, languageId: "jotl", version: 1, text },
	});
	return diagnostics;
}

function connect(options: ServerOptions): void {
	const toServer = new PassThrough();
	const toClient = new PassThrough();
	const server = createConnection(toServer, toClient);
	createServer(server, options);
	server.listen();
	client = createProtocolConnection(toClient, toServer);
	published = [];
	waiters = [];
	client.onNotification(PublishDiagnosticsNotification.type, params => {
		published.push(params);
		for (const waiter of waiters.splice(0)) waiter();
	});
	client.listen();
}

beforeEach(() => {
	connect({ diagnosticsDelay: 0 });
});

afterEach(() => {
	client.dispose();
	setLocale("zh-CN");
});

describe("语言服务连接", () => {
	it("初始化时声明增量同步, 补全触发字符与快速修复", async () => {
		const result = await initialize();
		expect(result.capabilities.textDocumentSync).toEqual({
			openClose: true,
			change: TextDocumentSyncKind.Incremental,
		});
		expect(result.capabilities.completionProvider?.triggerCharacters).toEqual([
			...COMPLETION_TRIGGER_CHARACTERS,
		]);
		expect(result.capabilities.codeActionProvider).toEqual({ codeActionKinds: ["quickfix"] });
	});

	it("打开时推送诊断, 增量变更后重新推送, 关闭时清空", async () => {
		await initialize();
		const opened = await open("A: {\r\n  a: strng\r\n}");
		expect(opened.uri).toBe(URI);
		expect(opened.diagnostics.map(d => d.code)).toEqual(["JOTL1004"]);

		const fixed = nextDiagnostics();
		await client.sendNotification(DidChangeTextDocumentNotification.type, {
			textDocument: { uri: URI, version: 2 },
			contentChanges: [
				{
					range: { start: { line: 1, character: 5 }, end: { line: 1, character: 10 } },
					text: "string",
				},
			],
		});
		expect((await fixed).diagnostics).toEqual([]);

		const broken = nextDiagnostics();
		await client.sendNotification(DidChangeTextDocumentNotification.type, {
			textDocument: { uri: URI, version: 3 },
			contentChanges: [
				{
					range: { start: { line: 1, character: 11 }, end: { line: 1, character: 11 } },
					text: "[widget: 'fancy']",
				},
				{
					range: { start: { line: 1, character: 2 }, end: { line: 1, character: 3 } },
					text: "b",
				},
			],
		});
		const diagnostics = (await broken).diagnostics;
		expect(diagnostics.map(d => d.code)).toEqual(["JOTL7001"]);
		expect(diagnostics[0]!.range.start).toEqual({ line: 1, character: 20 });

		const closed = nextDiagnostics();
		await client.sendNotification(DidCloseTextDocumentNotification.type, {
			textDocument: { uri: URI },
		});
		expect((await closed).diagnostics).toEqual([]);
	});

	it("initialize 的 locale 为 en 时诊断与悬停为英文; 为 zh-CN 时为中文; 未提供时为英文", async () => {
		await initialize(undefined, "en");
		const opened = await open("A: {\n  a: string[widget: 'fancy']\n}");
		expect(opened.diagnostics[0]!.message).toBe(
			"widget `fancy` is not registered and will fall back when rendering"
		);
		const hover = await client.sendRequest(HoverRequest.type, {
			textDocument: { uri: URI },
			position: { line: 1, character: 6 },
		});
		const value = (hover?.contents as { value: string } | undefined)?.value ?? "";
		expect(value).toContain("Built-in component `string`");
		expect(value).toContain("Single-line string");
		const items = await client.sendRequest(CompletionRequest.type, {
			textDocument: { uri: URI },
			position: { line: 1, character: 21 },
		});
		expect(
			Array.isArray(items) ? items.find(i => i.label === "input")?.detail : undefined
		).toBe("Built-in widget");

		client.dispose();
		connect({ diagnosticsDelay: 0 });
		await initialize();
		expect((await open("A: {\n  a: string[widget: 'fancy']\n}")).diagnostics[0]!.message).toBe(
			"widget `fancy` 未注册, 渲染时将降级"
		);

		client.dispose();
		connect({ diagnosticsDelay: 0 });
		await initialize(undefined, null);
		expect((await open("A: {\n  a: string[widget: 'fancy']\n}")).diagnostics[0]!.message).toBe(
			"widget `fancy` is not registered and will fall back when rendering"
		);
	});

	it("initializationOptions.locale 覆盖 initialize 的 locale; 设置节的 locale 变更后按新语言重新诊断", async () => {
		await initialize({ locale: "zh-CN" }, "en");
		const opened = await open("A: {\n  a: string[widget: 'fancy']\n}");
		expect(opened.diagnostics[0]!.message).toContain("未注册");

		const next = nextDiagnostics();
		await client.sendNotification(DidChangeConfigurationNotification.type, {
			settings: { jotl: { locale: "en-US" } },
		});
		expect((await next).diagnostics[0]!.message).toContain("is not registered");
	});

	it("全量变更替换整个文档", async () => {
		await initialize();
		await open("A: strng");
		const next = nextDiagnostics();
		await client.sendNotification(DidChangeTextDocumentNotification.type, {
			textDocument: { uri: URI, version: 2 },
			contentChanges: [{ text: "A: string" }],
		});
		expect((await next).diagnostics).toEqual([]);
	});

	it("初始化选项中的额外组件名用于诊断与补全", async () => {
		await initialize({ registeredWidgets: ["fancy"] });
		const opened = await open("A: {\n  a: string[widget: 'fancy']\n  b: string[widget: '']\n}");
		expect(opened.diagnostics.map(d => d.code)).not.toContain("JOTL7001");
		const items = await client.sendRequest(CompletionRequest.type, {
			textDocument: { uri: URI },
			position: { line: 2, character: 21 },
		});
		expect(Array.isArray(items) ? items.map(i => i.label) : []).toContain("fancy");
	});

	it("设置变更后按新的组件名重新诊断已打开的文档", async () => {
		await initialize();
		const opened = await open("A: {\n  a: string[widget: 'fancy']\n}");
		expect(opened.diagnostics.map(d => d.code)).toEqual(["JOTL7001"]);

		const registered = nextDiagnostics();
		await client.sendNotification(DidChangeConfigurationNotification.type, {
			settings: { jotl: { registeredWidgets: ["fancy"] } },
		});
		expect((await registered).diagnostics).toEqual([]);
		const items = await client.sendRequest(CompletionRequest.type, {
			textDocument: { uri: URI },
			position: { line: 1, character: 21 },
		});
		expect(Array.isArray(items) ? items.map(i => i.label) : []).toContain("fancy");

		const removed = nextDiagnostics();
		await client.sendNotification(DidChangeConfigurationNotification.type, {
			settings: { jotl: { registeredWidgets: [] } },
		});
		expect((await removed).diagnostics.map(d => d.code)).toEqual(["JOTL7001"]);
	});

	it("按文档路径并入最近的 jotl.config.json: 配置为准, 设置补充; 配置有误时报 JOTL7002 并忽略出错的项", async () => {
		await initialize({ registeredWidgets: ["Fancy", "ImagePicker"] });
		const text =
			"A: {\n  a: ImagePicker\n  b: Fancy\n  c: array[array_item: 'string', widget: 'tag-list']\n}";
		const uri = new URL("fixtures/config/pages/a.jotl", import.meta.url).href;
		expect((await open(text, uri)).diagnostics).toEqual([]);
		const preview = await client.sendRequest<PreviewContent | null>(PREVIEW_REQUEST_METHOD, {
			textDocument: { uri },
		});
		expect(preview?.schema).toContain('"format": "uri"');
		expect(preview?.configFile).toBe(
			fileURLToPath(new URL("fixtures/config/jotl.config.json", import.meta.url))
		);
		expect(preview?.modules).toEqual({});

		const invalid = new URL("fixtures/config-invalid/a.jotl", import.meta.url).href;
		const opened = await open("A: { a: string[widget: 'headline'], b: ImagePicker }", invalid);
		expect(opened.diagnostics.map(d => d.code)).toEqual(["JOTL7002"]);
		expect(opened.diagnostics[0]!.message).toContain("/widgets/ImagePicker");
		expect(opened.diagnostics[0]!.range.start).toEqual({ line: 0, character: 0 });

		expect((await open("A: { a: ImagePicker }")).diagnostics.map(d => d.code)).toEqual([]);
	});

	it("配置为非大驼峰 widget 名写了底层类型时, 与字段类型不兼容报 JOTL1052; 只在设置中登记的名字不报", async () => {
		client.dispose();
		const files: Record<string, string> = {
			"/w/jotl.config.json": JSON.stringify({
				widgets: { headline: "string", gauge: "number" },
			}),
		};
		connect({
			diagnosticsDelay: 0,
			configHost: { exists: path => path in files, readFile: path => files[path]! },
		});
		await initialize({ registeredWidgets: ["counter"] });
		const opened = await open(
			"A: {\n  count: integer[widget: 'headline']\n  ratio: integer[widget: 'gauge']\n  n: string[widget: 'counter']\n}",
			"file:///w/a.jotl"
		);
		expect(opened.diagnostics.map(d => [d.code, d.severity, d.message, d.range.start])).toEqual(
			[
				[
					"JOTL1052",
					2,
					"widget `headline` 声明的底层类型 `string` 与字段类型 `integer` 不兼容",
					{ line: 1, character: 25 },
				],
			]
		);
	});

	it("jotl.config.json 变更后重新诊断已打开的文档; 其他文件变更不触发", async () => {
		await initialize();
		await open("A: strng");
		const before = published.length;
		await client.sendNotification(DidChangeWatchedFilesNotification.type, {
			changes: [{ uri: "file:///w/other.json", type: FileChangeType.Changed }],
		});
		const next = nextDiagnostics();
		await client.sendNotification(DidChangeWatchedFilesNotification.type, {
			changes: [{ uri: "file:///w/jotl.config.json", type: FileChangeType.Created }],
		});
		expect((await next).diagnostics.map(d => d.code)).toEqual(["JOTL1004"]);
		expect(published.length).toBe(before + 1);
	});

	it("jotl.config.json 变更: 清掉配置缓存后才通知预览刷新, 收到通知时请求的预览已是新配置", async () => {
		client.dispose();
		const files: Record<string, string> = {
			"/w/jotl.config.json": JSON.stringify({
				widgets: { Color: { module: "./widgets/color.js" } },
			}),
		};
		connect({
			diagnosticsDelay: 0,
			configHost: { exists: path => path in files, readFile: path => files[path]! },
		});
		await initialize();
		const uri = "file:///w/modules/a.jotl";
		await open("A: { c: string[widget: Color] }", uri);
		const request = () =>
			client.sendRequest<PreviewContent | null>(PREVIEW_REQUEST_METHOD, {
				textDocument: { uri },
			});
		const moduleOf = async () => (await request())?.modules.Color?.module;
		expect(await moduleOf()).toBe("./widgets/color.js");

		// 模拟客户端行为: 收到通知立即请求预览, 两次变更各取一次, 不得落后一次.
		const seen: Promise<string | undefined>[] = [];
		let notified: () => void = () => {};
		client.onNotification(PREVIEW_CONFIG_CHANGED_METHOD, () => {
			seen.push(moduleOf());
			notified();
		});
		const change = async (module: string) => {
			files["/w/jotl.config.json"] = JSON.stringify({ widgets: { Color: { module } } });
			const done = new Promise<void>(resolve => (notified = resolve));
			await client.sendNotification(DidChangeWatchedFilesNotification.type, {
				changes: [{ uri: "file:///w/jotl.config.json", type: FileChangeType.Changed }],
			});
			await done;
		};
		await change("./widgets/missing.js");
		await change("./widgets/color.js");
		expect(await Promise.all(seen)).toEqual(["./widgets/missing.js", "./widgets/color.js"]);

		const count = seen.length;
		await client.sendNotification(DidChangeWatchedFilesNotification.type, {
			changes: [{ uri: "file:///w/other.json", type: FileChangeType.Changed }],
		});
		expect(await moduleOf()).toBe("./widgets/color.js");
		expect(seen.length).toBe(count);
	});

	it("连续变更防抖: 只按最后的文本推送一次诊断", async () => {
		client.dispose();
		connect({ diagnosticsDelay: 50 });
		await initialize();
		await open("A: strng");
		const before = published.length;
		const settled = nextDiagnostics();
		for (const [version, text] of [
			[2, "A: strin"],
			[3, "A: string"],
		] as const) {
			await client.sendNotification(DidChangeTextDocumentNotification.type, {
				textDocument: { uri: URI, version },
				contentChanges: [{ text }],
			});
		}
		expect((await settled).diagnostics).toEqual([]);
		await new Promise(resolve => setTimeout(resolve, 100));
		expect(published.length).toBe(before + 1);
	});

	it("关闭文档时取消尚未推送的诊断", async () => {
		client.dispose();
		connect({ diagnosticsDelay: 50 });
		await initialize();
		await open("A: strng");
		await client.sendNotification(DidChangeTextDocumentNotification.type, {
			textDocument: { uri: URI, version: 2 },
			contentChanges: [{ text: "A: strin" }],
		});
		const closed = nextDiagnostics();
		await client.sendNotification(DidCloseTextDocumentNotification.type, {
			textDocument: { uri: URI },
		});
		expect((await closed).diagnostics).toEqual([]);
		const count = published.length;
		await new Promise(resolve => setTimeout(resolve, 100));
		expect(published.length).toBe(count);
	});

	it("快速修复请求", async () => {
		await initialize();
		await open("name: string");
		const actions = await client.sendRequest(CodeActionRequest.type, {
			textDocument: { uri: URI },
			range: { start: { line: 0, character: 1 }, end: { line: 0, character: 1 } },
			context: { diagnostics: [] },
		});
		expect(actions?.map(a => a.title)).toEqual(["包进 `Root(根): {...}` 并标 `<root/>`"]);
	});

	it("未打开的文档返回空结果", async () => {
		await initialize();
		const items = await client.sendRequest(CompletionRequest.type, {
			textDocument: { uri: "file:///other.jotl" },
			position: { line: 0, character: 0 },
		});
		expect(items).toEqual([]);
	});

	it("初始化时声明悬停, 定义, 引用与大纲", async () => {
		const { capabilities } = await initialize();
		expect(capabilities.hoverProvider).toBe(true);
		expect(capabilities.definitionProvider).toBe(true);
		expect(capabilities.referencesProvider).toBe(true);
		expect(capabilities.documentSymbolProvider).toBe(true);
	});

	it("悬停, 定义, 引用与大纲请求使用变更后的文本", async () => {
		await initialize();
		await open("A: {\n  b: string\n}");
		const changed = nextDiagnostics();
		await client.sendNotification(DidChangeTextDocumentNotification.type, {
			textDocument: { uri: URI, version: 2 },
			contentChanges: [{ text: "A: {\n  b: B\n}\nB: email" }],
		});
		await changed;
		const hover = await client.sendRequest(HoverRequest.type, {
			textDocument: { uri: URI },
			position: { line: 3, character: 4 },
		});
		expect(JSON.stringify(hover?.contents)).toContain("内置组件 `email`");
		const definition = await client.sendRequest(DefinitionRequest.type, {
			textDocument: { uri: URI },
			position: { line: 1, character: 5 },
		});
		expect(definition).toEqual([
			{
				uri: URI,
				range: { start: { line: 3, character: 0 }, end: { line: 3, character: 1 } },
			},
		]);
		const refs = await client.sendRequest(ReferencesRequest.type, {
			textDocument: { uri: URI },
			position: { line: 3, character: 0 },
			context: { includeDeclaration: false },
		});
		expect(refs).toEqual([
			{
				uri: URI,
				range: { start: { line: 1, character: 5 }, end: { line: 1, character: 6 } },
			},
		]);
		const symbols = await client.sendRequest(DocumentSymbolRequest.type, {
			textDocument: { uri: URI },
		});
		expect(symbols?.map(s => s.name)).toEqual(["A", "B"]);
	});

	it("预览请求返回当前文本的预览内容; 未打开的文档返回 null", async () => {
		await initialize({ registeredWidgets: ["fancy"] });
		await open("A: { a: string[widget: 'fancy'] }");
		const preview = await client.sendRequest<PreviewContent | null>(PREVIEW_REQUEST_METHOD, {
			textDocument: { uri: URI },
		});
		expect(preview?.diagnostics).toEqual([]);
		expect(JSON.parse(preview!.schema!).$ref).toBe("#/$defs/A");
		expect(
			await client.sendRequest(PREVIEW_REQUEST_METHOD, {
				textDocument: { uri: "file:///other.jotl" },
			})
		).toBeNull();
	});

	it("未打开的文档上悬停, 定义, 引用与大纲返回空结果", async () => {
		await initialize();
		const textDocument = { uri: "file:///other.jotl" };
		const position = { line: 0, character: 0 };
		expect(await client.sendRequest(HoverRequest.type, { textDocument, position })).toBeNull();
		expect(
			await client.sendRequest(DefinitionRequest.type, { textDocument, position })
		).toEqual([]);
		expect(
			await client.sendRequest(ReferencesRequest.type, {
				textDocument,
				position,
				context: { includeDeclaration: true },
			})
		).toEqual([]);
		expect(await client.sendRequest(DocumentSymbolRequest.type, { textDocument })).toEqual([]);
	});
});
