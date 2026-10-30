// 表单预览: 用 JotlForm 渲染 schema, 可切换呈现方式与初始数据来源, 并显示当前表单数据与最近一次通过校验的提交; schema 声明了扩展组件模块时在上方提示来源.
import { useEffect, useMemo, useRef, useState } from "react";
import { richTextEditor } from "@jotl/form";
import {
	JotlForm,
	type DegradeEvent,
	type JotlFormHandle,
	type ReactAdapters,
	type ReactRegistry,
} from "@jotl/form";
import type { JsonSchema, Locale } from "@jotl/core";
import { useCopy } from "./copy.js";
import { moduleBaseUrl, schemaModuleUrls } from "./widget-modules.js";
import { CodeBlock } from "./highlight.js";

export interface FormPreviewProps {
	schema: JsonSchema;
	locale: Locale;
	/** jotl.config.json 登记了模块时的注册表; 缺省用默认注册表. */
	registry?: ReactRegistry;
	onDegrade(event: DegradeEvent): void;
}

function formatData(value: unknown): string {
	return value === undefined ? "undefined" : JSON.stringify(value, null, 2);
}

/** 演示用: 上传只在本地生成 blob URL 预览, 不发网络请求; 富文本用 @jotl/form 自带的最小编辑器. */
const ADAPTERS: ReactAdapters = {
	upload: async file => URL.createObjectURL(file as Blob),
	richText: richTextEditor,
};

type Layout = "nested" | "flat";
type InitialData = "defaults" | "mock";

/** schema 变化时由调用方换 key 重新挂载, 表单数据随之回到默认值; 切换初始数据来源时同样重新挂载. */
export function FormPreview({ schema, locale, registry, onDegrade }: FormPreviewProps) {
	const COPY = useCopy();
	const baseUrl = moduleBaseUrl();
	const schemaModules = useMemo(() => ({ baseUrl }), [baseUrl]);
	const moduleUrls = useMemo(() => schemaModuleUrls(schema, baseUrl), [schema, baseUrl]);
	const form = useRef<JotlFormHandle>(null);
	const [data, setData] = useState<unknown>(undefined);
	const [submitted, setSubmitted] = useState<{ value: unknown } | undefined>(undefined);
	const [layout, setLayout] = useState<Layout>("nested");
	const [initialData, setInitialData] = useState<InitialData>("defaults");

	useEffect(() => {
		if (form.current !== null) setData(form.current.getValues());
	}, [initialData]);

	return (
		<div className="pg-form-preview">
			{moduleUrls.length > 0 && (
				<div className="pg-notice" role="note" data-testid="schema-modules">
					<p>{COPY.preview.schemaModules}</p>
					<ul>
						{moduleUrls.map(url => (
							<li key={url}>
								<code>{url}</code>
							</li>
						))}
					</ul>
				</div>
			)}
			<div className="pg-form-options">
				<label className="pg-form-option">
					{COPY.preview.layout}
					<select value={layout} onChange={e => setLayout(e.target.value as Layout)}>
						<option value="nested">{COPY.preview.nested}</option>
						<option value="flat">{COPY.preview.flat}</option>
					</select>
				</label>
				<label className="pg-form-option">
					{COPY.preview.initialData}
					<select
						value={initialData}
						onChange={e => setInitialData(e.target.value as InitialData)}
					>
						<option value="defaults">{COPY.preview.defaults}</option>
						<option value="mock">{COPY.preview.mock}</option>
					</select>
				</label>
			</div>
			<div className="pg-form-host">
				<JotlForm
					key={initialData}
					ref={form}
					schema={schema}
					locale={locale}
					{...(registry === undefined ? {} : { registry })}
					schemaModules={schemaModules}
					adapters={ADAPTERS}
					nested={layout === "nested"}
					collapsible={layout === "flat"}
					initialData={initialData}
					onChange={setData}
					onDegrade={onDegrade}
					onSubmit={value => setSubmitted({ value })}
				/>
			</div>
			<section className="pg-form-data" aria-label={COPY.output.formData}>
				<h3 className="pg-section-heading">{COPY.output.formData}</h3>
				<CodeBlock text={formatData(data)} lang="json" testId="form-data" />
				{submitted !== undefined && (
					<>
						<h3 className="pg-section-heading">{COPY.output.submitted}</h3>
						<CodeBlock
							text={formatData(submitted.value)}
							lang="json"
							testId="form-submitted"
						/>
					</>
				)}
			</section>
		</div>
	);
}
