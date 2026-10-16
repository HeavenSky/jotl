// 测试用组件: html/ 尚未提供的复合组件(union nullable tree map)与计数, 记录属性的探针组件.
import type { ReactNode } from "react";
import { escapePointerToken } from "@jotl/core";
import type { FieldProps, MapProps, NullableProps, TreeProps, UnionProps, WidgetRegistration } from "../../src/core/index.js";
import { createDefaultRegistry, type ReactRegistry, type ReactWidgetComponent } from "../../src/react/index.js";

type N = ReactNode;

function Errors({ id, errors }: { id: string; errors: readonly { message: string }[] }) {
  if (errors.length === 0) return null;
  return (
    <div id={`${id}-errors`} role="alert">
      {errors.map((e, i) => (
        <p key={i}>{e.message}</p>
      ))}
    </div>
  );
}

export function TestUnion(props: UnionProps<N>) {
  return (
    <div id={props.id} data-testid={`union:${props.dataPath}`}>
      <select aria-label={`branch:${props.dataPath}`} value={props.activeBranch} disabled={props.mode !== "edit"} onChange={(e) => props.selectBranch(Number(e.target.value))}>
        {props.branches.map((b, i) => (
          <option key={i} value={i}>
            {b.title}
          </option>
        ))}
      </select>
      {props.renderContent()}
      <Errors id={props.id} errors={props.errors} />
    </div>
  );
}

export function TestNullable(props: NullableProps<N>) {
  return (
    <div id={props.id}>
      <label>
        <input type="checkbox" aria-label={`null:${props.dataPath}`} checked={props.isNull} onChange={(e) => props.setNull(e.target.checked)} />
      </label>
      {props.renderContent()}
      <Errors id={props.id} errors={props.errors} />
    </div>
  );
}

export function TestTree(props: TreeProps<N>) {
  return (
    <div id={props.id}>
      <button type="button" aria-label={`toggle:${props.dataPath}`} onClick={() => props.setExpanded(!props.expanded)}>
        {props.expanded ? "-" : "+"}
      </button>
      {props.renderContent()}
      <Errors id={props.id} errors={props.errors} />
    </div>
  );
}

export function TestMap(props: MapProps<N>) {
  return (
    <div id={props.id}>
      {props.entries.map((entry) => (
        <div key={entry.key} data-key={entry.key}>
          <span>{entry.name}</span>
          {props.renderChild(escapePointerToken(entry.name))}
        </div>
      ))}
      <Errors id={props.id} errors={props.errors} />
    </div>
  );
}

/** 登记了测试复合组件的注册表(html/ 原生组件之上的实例级注册表). */
export function compositeRegistry(): ReactRegistry {
  const registry = createDefaultRegistry().extend();
  registry.register({ name: "union", level: "composite", component: TestUnion });
  registry.register({ name: "nullable", level: "composite", component: TestNullable });
  registry.register({ name: "tree", level: "composite", component: TestTree });
  registry.register({ name: "kv", level: "composite", component: TestMap });
  return registry;
}

/** 记录每次渲染属性的字段组件; 渲染为文本框. */
export function probeField(log: FieldProps<unknown, N>[]): ReactWidgetComponent {
  return function Probe(props: FieldProps<unknown, N>) {
    log.push(props);
    return (
      <input
        id={props.id}
        data-path={props.dataPath}
        value={typeof props.value === "string" ? props.value : JSON.stringify(props.value ?? "")}
        readOnly={props.mode !== "edit"}
        onChange={(e) => props.onChange(e.target.value)}
        onBlur={props.onBlur}
      />
    );
  };
}

export function field(name: string, component: ReactWidgetComponent, extra: Partial<WidgetRegistration<ReactWidgetComponent>> = {}): WidgetRegistration<ReactWidgetComponent> {
  return { name, level: "field", component, ...extra };
}
