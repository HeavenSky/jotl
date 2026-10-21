// 资源组件: image 与 file 用 URL 输入; 有 adapters.upload 时增加上传按钮(触发隐藏的文件选择)并写回上传得到的 URL.
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useCopy } from "../copy.js";
import { className, controlAttributes, type HtmlFieldProps } from "../props.js";
import { cn, styles } from "../styles.js";

type UploadStatus = "idle" | "pending" | "failed";

/** 上传过程状态; 只有最后一次选择的文件的结果会写回. */
function useUpload(props: HtmlFieldProps<string>) {
	const [status, setStatus] = useState<UploadStatus>("idle");
	const latest = useRef(0);
	const onChange = useRef(props.onChange);
	onChange.current = props.onChange;
	useEffect(() => {
		// 卸载后作废进行中的上传, 避免向已不存在的字段写回.
		return () => {
			latest.current += 1;
		};
	}, []);
	const upload = props.adapters.upload;
	const start = (file: File) => {
		if (upload === undefined) return;
		const ticket = ++latest.current;
		setStatus("pending");
		let request: Promise<string>;
		try {
			request = upload(file, { dataPath: props.dataPath, schema: props.schema });
		} catch {
			request = Promise.reject(new Error("upload threw"));
		}
		request.then(
			url => {
				if (ticket !== latest.current) return;
				setStatus("idle");
				onChange.current(url);
			},
			() => {
				if (ticket !== latest.current) return;
				setStatus("failed");
			}
		);
	};
	return { enabled: upload !== undefined, status, start };
}

function acceptOf(
	schema: HtmlFieldProps["schema"],
	fallback: string | undefined
): string | undefined {
	return typeof schema.contentMediaType === "string" ? schema.contentMediaType : fallback;
}

function ResourceInput(
	props: HtmlFieldProps<string> & {
		kind: string;
		accept: string | undefined;
		uploadLabel: string;
		preview?: (url: string) => ReactNode;
	}
) {
	const COPY = useCopy();
	const { enabled, status, start } = useUpload(props);
	const picker = useRef<HTMLInputElement>(null);
	const pickDisabled = props.mode === "disabled" || status === "pending";
	const statusId = `${props.id}-upload-status`;
	const url = typeof props.value === "string" ? props.value : "";
	return (
		<div className={className("jotl-resource", props.kind, styles.resource)}>
			<input
				{...controlAttributes(props, ...(status === "failed" ? [statusId] : []))}
				type="url"
				className={cn("jotl-input jotl-url", styles.input, styles.resourceInput)}
				value={url}
				onChange={(e: ChangeEvent<HTMLInputElement>) =>
					props.onChange(e.target.value === "" ? undefined : e.target.value)
				}
			/>
			{enabled && props.mode !== "view" && (
				<>
					<button
						type="button"
						className={cn("jotl-button jotl-upload-button", styles.button())}
						disabled={pickDisabled}
						onClick={() => picker.current?.click()}
					>
						{props.uploadLabel}
					</button>
					<input
						ref={picker}
						type="file"
						className="jotl-file-input"
						hidden
						tabIndex={-1}
						aria-label={props.uploadLabel}
						accept={props.accept}
						disabled={pickDisabled}
						onChange={(e: ChangeEvent<HTMLInputElement>) => {
							const file = e.target.files?.[0];
							// 清空选择, 同一文件再次选择时仍会触发 change.
							e.target.value = "";
							if (file !== undefined) start(file);
						}}
					/>
				</>
			)}
			{status !== "idle" && (
				<span
					id={statusId}
					className={className(
						"jotl-upload-status",
						status === "failed" && "jotl-upload-status--failed",
						styles.uploadStatus({ failed: status === "failed" })
					)}
					role="status"
				>
					{status === "pending" ? COPY.uploading : COPY.uploadFailed}
				</span>
			)}
			{url !== "" && props.preview?.(url)}
		</div>
	);
}

export function ImageWidget(props: HtmlFieldProps<string>) {
	const COPY = useCopy();
	return (
		<ResourceInput
			{...props}
			kind="jotl-image"
			uploadLabel={COPY.uploadImage}
			accept={acceptOf(props.schema, "image/*")}
			preview={url => (
				<img
					className={`jotl-image-preview ${styles.imagePreview}`}
					src={url}
					alt={COPY.imagePreview}
				/>
			)}
		/>
	);
}

export function FileWidget(props: HtmlFieldProps<string>) {
	const COPY = useCopy();
	return (
		<ResourceInput
			{...props}
			kind="jotl-file"
			uploadLabel={COPY.upload}
			accept={acceptOf(props.schema, undefined)}
		/>
	);
}
