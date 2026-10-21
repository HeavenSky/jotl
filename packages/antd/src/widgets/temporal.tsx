// 日期组件 date time datetime: DatePicker / TimePicker 按本地时区显示, 写回时按节点的存储格式(x-valueFormat)换算; 存量值解析不了时交给 @jotl/form 的原生组件(原样显示并提示, 不改写数据).
import type { ComponentType } from "react";
import { DatePicker, TimePicker, type TimePickerProps } from "antd";
import {
	DEFAULT_VALUE_FORMATS,
	isTimestampValueFormat,
	isValueFormatAlias,
	matchesValueFormatText,
	type JsonSchemaObject,
} from "@jotl/core";
import { DateTimeWidget, DateWidget, TimeWidget } from "@jotl/form";
import { textAttributes, type AntdFieldProps } from "../shared.js";

/** antd 日期控件使用的 Dayjs 实例类型. */
export type AntdDayjs = NonNullable<TimePickerProps["value"]>;

/** 传入 antd 所用的同一个 dayjs(含 antd 已加载的 customParseFormat 与 advancedFormat 插件). */
export interface DayjsFactory {
	(input?: string | number | Date, format?: string, strict?: boolean): AntdDayjs;
	unix(seconds: number): AntdDayjs;
}

export type TemporalKind = "date" | "time" | "datetime";

type TemporalValue = string | number;

const RFC3339 =
	/^\d{4}-\d{2}-\d{2}[Tt](?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;

export function storageFormat(schema: JsonSchemaObject, kind: TemporalKind): string {
	const vf = schema["x-valueFormat"];
	return typeof vf === "string" && vf !== "" ? vf : DEFAULT_VALUE_FORMATS[kind];
}

/** 存储值 → 时刻; 不符合存储格式时返回 undefined. 时间戳只认整数. */
export function parseStored(
	dayjs: DayjsFactory,
	value: unknown,
	format: string
): AntdDayjs | undefined {
	let d: AntdDayjs | undefined;
	if (isTimestampValueFormat(format)) {
		if (typeof value !== "number" || !Number.isInteger(value)) return undefined;
		d = format === "x" ? dayjs(value) : dayjs.unix(value);
	} else if (typeof value !== "string") {
		return undefined;
	} else if (isValueFormatAlias(format)) {
		// 日期部分另做严格检查, Date 会把 2 月 30 日顺延.
		if (!RFC3339.test(value) || !dayjs(value.slice(0, 10), "YYYY-MM-DD", true).isValid())
			return undefined;
		d = dayjs(value);
	} else {
		d = dayjs(value, format, true);
		// 严格模式按本地时区重新格式化比对, 带非本地偏移或落在本地 DST 跳过时段的值会被误判; 文本已符合格式串时改用宽松解析.
		if (!d.isValid() && matchesValueFormatText(format, value) === true)
			d = dayjs(value, format);
	}
	return d.isValid() ? d : undefined;
}

/** 时刻 → 存储值(本地时区); 别名的写法须与 @jotl/form 的原生日期组件一致. */
export function formatStored(d: AntdDayjs, format: string): string | number {
	switch (format) {
		case "x":
			return d.valueOf();
		case "X":
			return d.unix();
		case "iso":
			return d.format();
		case "iso-x": {
			const iso = d.format();
			return `${iso.slice(0, -6)}.${d.format("SSS")}${iso.slice(-6)}`;
		}
		case "utc-x":
			return d.toISOString();
		case "utc":
			return d.toISOString().replace(/\.\d{3}Z$/, "Z");
		default:
			return d.format(format);
	}
}

/** 控件的时间精度: 自定义格式含毫秒时到毫秒, 含秒时到秒; 别名与时间戳到秒; 否则到分钟. */
export function timeFormatOf(format: string): string {
	if (isTimestampValueFormat(format) || isValueFormatAlias(format)) return "HH:mm:ss";
	const tokens = format.replace(/\[[^\]]*\]/g, "");
	if (/S/.test(tokens)) return "HH:mm:ss.SSS";
	if (/s/.test(tokens)) return "HH:mm:ss";
	return "HH:mm";
}

/** 控件选出的时刻按种类与精度截齐: date 取当天零点, 不显示的秒与毫秒置零. */
function normalize(d: AntdDayjs, kind: TemporalKind, timeFormat: string): AntdDayjs {
	if (kind === "date") return d.startOf("day");
	if (timeFormat === "HH:mm") return d.second(0).millisecond(0);
	if (timeFormat === "HH:mm:ss") return d.millisecond(0);
	return d;
}

const NATIVE: Readonly<Record<TemporalKind, ComponentType<AntdFieldProps<TemporalValue>>>> = {
	date: DateWidget,
	time: TimeWidget,
	datetime: DateTimeWidget,
};

function TemporalPicker({
	dayjs,
	kind,
	...props
}: AntdFieldProps<TemporalValue> & { dayjs: DayjsFactory; kind: TemporalKind }) {
	const format = storageFormat(props.schema, kind);
	const raw = props.value;
	const empty = raw === undefined || raw === null || raw === "";
	const parsed = empty ? undefined : parseStored(dayjs, raw, format);
	if (!empty && parsed === undefined) {
		const Native = NATIVE[kind];
		return <Native {...props} />;
	}
	const timeFormat = timeFormatOf(format);
	const { readOnly, ...attributes } = textAttributes(props);
	const common = {
		...attributes,
		className: `jotl-input jotl-${kind}`,
		style: { width: "100%" },
		disabled: props.mode !== "edit",
		inputReadOnly: readOnly,
		value: parsed ?? null,
		onChange: (d: AntdDayjs | null) =>
			props.onChange(
				d === null ? undefined : formatStored(normalize(d, kind, timeFormat), format)
			),
	};
	if (kind === "time") return <TimePicker {...common} format={timeFormat} />;
	if (kind === "date") return <DatePicker {...common} format="YYYY-MM-DD" />;
	return (
		<DatePicker
			{...common}
			showTime={{ format: timeFormat }}
			format={`YYYY-MM-DD ${timeFormat}`}
		/>
	);
}

/** 绑定 dayjs 后的三个日期组件. */
export function temporalWidgets(
	dayjs: DayjsFactory
): Record<TemporalKind, ComponentType<AntdFieldProps<TemporalValue>>> {
	return {
		date: props => <TemporalPicker {...props} dayjs={dayjs} kind="date" />,
		time: props => <TemporalPicker {...props} dayjs={dayjs} kind="time" />,
		datetime: props => <TemporalPicker {...props} dayjs={dayjs} kind="datetime" />,
	};
}
