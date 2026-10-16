// 颜色: ColorPicker 写回 #rrggbb 文本, 清除写回 undefined.
import { ColorPicker } from "antd";
import { ariaAttributes, choiceDisabled, type AntdFieldProps } from "../shared.js";

export function AntdColorWidget(props: AntdFieldProps<string>) {
  const value = typeof props.value === "string" && props.value !== "" ? props.value : undefined;
  return (
    <span {...ariaAttributes(props)} id={props.id} className="jotl-color">
      <ColorPicker
        format="hex"
        // 空值时 antd 内部取透明色, 此时 disabledAlpha 会触发开发模式警告; 改由 onChange 截掉 alpha 保证写回 #rrggbb.
        {...(value === undefined ? {} : { disabledAlpha: true })}
        showText
        allowClear={!props.required}
        disabled={choiceDisabled(props)}
        value={value ?? null}
        onChange={(color) => props.onChange(`#${color.toHex().slice(0, 6)}`)}
        onClear={() => props.onChange(undefined)}
      />
    </span>
  );
}
