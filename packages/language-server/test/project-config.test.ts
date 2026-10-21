// jotl.config.json 的查找, 读取, 缓存与并入语言服务选项.
import { describe, expect, it } from "vitest";
import { compileOptions, withConfigWidgets } from "../src/options.js";
import { type ConfigHost, configDiagnostics, createConfigLookup } from "../src/project-config.js";

function memoryHost(
	files: Record<string, string>,
	dirs: string[] = []
): ConfigHost & { reads: string[] } {
	const reads: string[] = [];
	return {
		reads,
		exists: path => Object.hasOwn(files, path) || dirs.includes(path),
		readFile(path) {
			reads.push(path);
			if (!Object.hasOwn(files, path)) throw new Error(`不存在 ${path}`);
			return files[path]!;
		},
	};
}

const CONFIG = JSON.stringify({ widgets: { ImagePicker: "url" } });

describe("createConfigLookup", () => {
	it("从文档所在目录向上找最近的配置, 同一目录只读一次, clear 后重新读取", () => {
		const files: Record<string, string> = { "/w/jotl.config.json": CONFIG };
		const host = memoryHost(files);
		const lookup = createConfigLookup(host);
		expect(lookup.forDocument("file:///w/a/b/x.jotl")).toEqual({
			file: "/w/jotl.config.json",
			widgets: { ImagePicker: { type: "string", format: "uri" } },
			modules: {},
			widgetTypes: {},
			problems: [],
		});
		lookup.forDocument("file:///w/a/b/y.jotl");
		expect(host.reads).toEqual(["/w/jotl.config.json"]);
		files["/w/a/jotl.config.json"] = JSON.stringify({ widgets: { ImagePicker: "number" } });
		expect(lookup.forDocument("file:///w/a/b/x.jotl")?.file).toBe("/w/jotl.config.json");
		lookup.clear();
		expect(lookup.forDocument("file:///w/a/b/x.jotl")?.widgets).toEqual({
			ImagePicker: { type: "number" },
		});
	});

	it("模块声明记入 modules, module 原样保留", () => {
		const text = JSON.stringify({
			widgets: {
				Rating: { base: "integer", module: "./w/rating.js", export: "Rating" },
				Plain: "url",
			},
		});
		const config = createConfigLookup(memoryHost({ "/w/jotl.config.json": text })).forDocument(
			"file:///w/x.jotl"
		);
		expect(config?.modules).toEqual({ Rating: { module: "./w/rating.js", export: "Rating" } });
		expect(config?.widgets.Rating).toEqual({ type: "integer" });
	});

	it("写了底层类型的非大驼峰名记入 widgetTypes, 并入选项后传给编译器", () => {
		const text = JSON.stringify({
			widgets: { ImagePicker: "url", headline: "string", rich: { module: "./rich.js" } },
		});
		const config = createConfigLookup(memoryHost({ "/w/jotl.config.json": text })).forDocument(
			"file:///w/x.jotl"
		);
		expect(config?.widgetTypes).toEqual({ headline: { type: "string" } });
		const options = withConfigWidgets(
			{ registeredWidgets: ["counter"] },
			config!.widgets,
			config!.widgetTypes
		);
		expect(compileOptions(options)).toEqual({
			widgets: { ImagePicker: { type: "string", format: "uri" } },
			widgetTypes: { headline: { type: "string" } },
		});
		expect(compileOptions({ registeredWidgets: ["counter"] })).toEqual({});
	});

	it("不跨越 git 顶层; 非 file 文档不查找", () => {
		const lookup = createConfigLookup(memoryHost({ "/jotl.config.json": CONFIG }, ["/w/.git"]));
		expect(lookup.forDocument("file:///w/a/x.jotl")).toBeUndefined();
		expect(lookup.forDocument("untitled:Untitled-1")).toBeUndefined();
		expect(lookup.forDocument("file:///v/x.jotl")?.file).toBe("/jotl.config.json");
	});

	it("JSON 不合法或内容有误时记为 problems, 合法的项照常登记, 并转为 JOTL7002", () => {
		const lookup = createConfigLookup(
			memoryHost({
				"/a/jotl.config.json": "{",
				"/b/jotl.config.json":
					"\uFEFF" + JSON.stringify({ widgets: { A: "enum", B: "url" } }),
			})
		);
		const broken = lookup.forDocument("file:///a/x.jotl");
		expect(broken?.problems).toEqual(["不是合法的 JSON"]);
		const partial = lookup.forDocument("file:///b/x.jotl");
		expect(partial?.widgets).toEqual({ B: { type: "string", format: "uri" } });
		const diagnostics = configDiagnostics(partial);
		expect(diagnostics.map(d => [d.code, d.severity])).toEqual([["JOTL7002", "warning"]]);
		expect(diagnostics[0]!.message).toContain("/widgets/A");
		expect(configDiagnostics(undefined)).toEqual([]);
	});
});

describe("withConfigWidgets", () => {
	it("配置文件为准, 设置中的名字补充; 未在配置中的扩展组件按 string 编译", () => {
		const merged = withConfigWidgets(
			{ registeredWidgets: ["Fancy", "ImagePicker", "card"] },
			{ ImagePicker: { type: "integer" }, "tag-list": { type: "array" } }
		);
		expect(merged.registeredWidgets).toEqual(["ImagePicker", "tag-list", "Fancy", "card"]);
		expect(compileOptions(merged)).toEqual({
			widgets: { ImagePicker: { type: "integer" }, Fancy: { type: "string" } },
		});
		const settings = { registeredWidgets: ["Fancy"] };
		expect(withConfigWidgets(settings, {})).toBe(settings);
	});
});
