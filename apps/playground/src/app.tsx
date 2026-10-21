// Playground 主界面: 编辑源码与 jotl.config.json, 防抖编译, 保存到本地存储, 加载示例, 切换界面语言, 诊断定位与输出页签.
import { useEffect, useMemo, useRef, useState } from "react";
import { setLocale, type Locale, type Severity } from "@jotl/core";
import { schemaToTs } from "@jotl/convert";
import {
	allDiagnostics,
	buildPlayground,
	type PlaygroundBuild,
	type PlaygroundDiagnostic,
} from "./compile.js";
import { DEFAULT_CONFIG, readConfig } from "./config.js";
import { CopyContext, copyOf } from "./copy.js";
import { DiagnosticList } from "./diagnostic-list.js";
import { Editor, type EditorHandle } from "./editor.js";
import { EXAMPLES, defaultSource, findExample } from "./examples.js";
import { LOCALES, browserLanguage, initialLocale, isLocale } from "./locale.js";
import { OutputTabs } from "./output-tabs.js";
import {
	loadConfig,
	loadLocaleChoice,
	loadSource,
	saveConfig,
	saveLocaleChoice,
	saveSource,
} from "./storage.js";

/** 最后一次输入之后等待多久再编译. */
export const COMPILE_DEBOUNCE_MS = 300;

type SourceTab = "source" | "config";

interface BuildInput {
	source: string;
	config: string;
}

interface BuildState {
	current: PlaygroundBuild;
	/** 最近一次编译成功的结果. */
	lastGood?: PlaygroundBuild;
}

/** 诊断与输出按全局语言生成, 调用前须已 setLocale. */
function build(input: BuildInput): PlaygroundBuild {
	return buildPlayground(input.source, schemaToTs, readConfig(input.config));
}

function inputOf(build: PlaygroundBuild): BuildInput {
	return { source: build.report.source, config: build.config?.text ?? "" };
}

function advance(prev: BuildState | undefined, next: PlaygroundBuild): BuildState {
	if (next.report.output !== undefined) return { current: next, lastGood: next };
	return prev?.lastGood === undefined
		? { current: next }
		: { current: next, lastGood: prev.lastGood };
}

/** 切换语言后按原输入重新生成, 使诊断与已过期的上次成功结果也换成新语言. */
function rebuild(prev: BuildState): BuildState {
	const current = build(inputOf(prev.current));
	if (prev.lastGood === undefined || prev.lastGood === prev.current)
		return advance(undefined, current);
	return { current, lastGood: build(inputOf(prev.lastGood)) };
}

const SEVERITY_RANK: Record<Severity, number> = { info: 0, warning: 1, error: 2 };

/** 配置诊断定位在 jotl.config.json 页签, 其余诊断定位在源码页签. */
function tabOf(diagnostic: PlaygroundDiagnostic): SourceTab {
	return diagnostic.stage === "config" ? "config" : "source";
}

function lineMarkers(
	diagnostics: readonly PlaygroundDiagnostic[],
	tab: SourceTab
): Map<number, Severity> {
	const markers = new Map<number, Severity>();
	for (const diagnostic of diagnostics) {
		const { start, severity } = diagnostic;
		if (start === undefined || tabOf(diagnostic) !== tab) continue;
		const existing = markers.get(start.line);
		if (existing === undefined || SEVERITY_RANK[severity] > SEVERITY_RANK[existing])
			markers.set(start.line, severity);
	}
	return markers;
}

function startLocale(): Locale {
	const locale = initialLocale(loadLocaleChoice(), browserLanguage());
	setLocale(locale);
	return locale;
}

export function App() {
	const [locale, setLocaleState] = useState(startLocale);
	const [source, setSource] = useState(() => loadSource() ?? defaultSource());
	const [config, setConfig] = useState(() => loadConfig() ?? DEFAULT_CONFIG);
	const [state, setState] = useState(() => advance(undefined, build({ source, config })));
	const [storageOk, setStorageOk] = useState(true);
	const [sourceTab, setSourceTab] = useState<SourceTab>("source");
	const editor = useRef<EditorHandle>(null);
	const configEditor = useRef<EditorHandle>(null);
	const COPY = copyOf(locale);

	const built = inputOf(state.current);
	const pending = source !== built.source || config !== built.config;

	useEffect(() => {
		if (!pending) return;
		const timer = setTimeout(
			() => setState(prev => advance(prev, build({ source, config }))),
			COMPILE_DEBOUNCE_MS
		);
		return () => clearTimeout(timer);
	}, [source, config, pending]);

	useEffect(() => {
		document.documentElement.lang = locale;
	}, [locale]);

	const updateSource = (next: string) => {
		setSource(next);
		setStorageOk(saveSource(next));
	};

	const updateConfig = (next: string) => {
		setConfig(next);
		setStorageOk(saveConfig(next));
	};

	const changeLocale = (next: string) => {
		if (!isLocale(next) || next === locale) return;
		setLocale(next);
		saveLocaleChoice(next);
		setLocaleState(next);
		setState(prev => rebuild(prev));
	};

	const loadExample = (id: string) => {
		const example = findExample(id);
		if (example === undefined) return;
		updateSource(example.source);
		setSourceTab("source");
		setState(prev => advance(prev, build({ source: example.source, config })));
	};

	const diagnostics = useMemo(() => allDiagnostics(state.current), [state]);
	const markers = useMemo(() => lineMarkers(diagnostics, "source"), [diagnostics]);
	const configMarkers = useMemo(() => lineMarkers(diagnostics, "config"), [diagnostics]);
	const stale = state.current.report.output === undefined && state.lastGood !== undefined;

	return (
		<CopyContext.Provider value={COPY}>
			<div className="pg-app">
				<header className="pg-header">
					<h1 className="pg-title">{COPY.appTitle}</h1>
					<label className="pg-examples">
						{COPY.examples.label}
						<select value="" onChange={event => loadExample(event.target.value)}>
							<option value="" disabled>
								{COPY.examples.placeholder}
							</option>
							{EXAMPLES.map(example => (
								<option key={example.id} value={example.id}>
									{example.id}
								</option>
							))}
						</select>
					</label>
					<label className="pg-examples pg-language">
						{COPY.language.label}
						<select value={locale} onChange={event => changeLocale(event.target.value)}>
							{LOCALES.map(item => (
								<option key={item} value={item}>
									{COPY.language.names[item]}
								</option>
							))}
						</select>
					</label>
					{!storageOk && (
						<p className="pg-alert" role="alert">
							{COPY.storage.unavailable}
						</p>
					)}
				</header>
				<main className="pg-main">
					<div className="pg-left">
						<div className="pg-tablist" role="tablist" aria-label={COPY.sources.label}>
							{(["source", "config"] as const).map(tab => (
								<button
									key={tab}
									type="button"
									role="tab"
									className="pg-tab"
									aria-selected={tab === sourceTab}
									onClick={() => setSourceTab(tab)}
								>
									{COPY.sources[tab]}
								</button>
							))}
						</div>
						{sourceTab === "source" ? (
							<Editor
								key="source"
								ref={editor}
								label={COPY.editor.label}
								value={source}
								onChange={updateSource}
								markers={markers}
								{...(pending ? { status: COPY.editor.pending } : {})}
							/>
						) : (
							<Editor
								key="config"
								ref={configEditor}
								label={COPY.config.label}
								value={config}
								onChange={updateConfig}
								markers={configMarkers}
								{...(pending ? { status: COPY.editor.pending } : {})}
							/>
						)}
						<DiagnosticList
							diagnostics={diagnostics}
							onReveal={diagnostic => {
								const { start, end } = diagnostic;
								if (start === undefined) return;
								const tab = tabOf(diagnostic);
								const target = tab === "source" ? editor : configEditor;
								if (sourceTab === tab) {
									target.current?.reveal(start, end);
									return;
								}
								// 切换页签后目标编辑器要先挂载, 下一帧再定位.
								setSourceTab(tab);
								requestAnimationFrame(() => target.current?.reveal(start, end));
							}}
						/>
					</div>
					<div className="pg-right">
						<OutputTabs
							{...(state.lastGood === undefined ? {} : { build: state.lastGood })}
							stale={stale}
							locale={locale}
						/>
					</div>
				</main>
			</div>
		</CopyContext.Provider>
	);
}
