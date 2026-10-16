// 调试视图 JotlDebug(W9): 列出渲染计划中每个节点选中的组件, 来源与降级记录; 以及收集降级事件的 useDegradeLog.
import { useCallback, useMemo, useState } from "react";
import { DEFAULT_SCENE, getLocale, matchPointer, type JsonSchema, type Locale } from "@jotl/core";
import { plan, type RenderMode, type RenderPlanNode } from "../core/index.js";
import { copyOf, type Copy } from "./diagnostics.js";
import { sharedDefaultRegistry } from "./registry.js";
import type { DegradeEvent, ReactRegistry } from "./types.js";

export interface JotlDebugProps {
  schema: JsonSchema;
  /** 与表单使用同一个注册表, 结果才一致. */
  registry?: ReactRegistry;
  scene?: string;
  mode?: RenderMode;
  maxDepth?: number;
  /** 表单 onDegrade 收到的事件, 按节点并入降级记录. */
  events?: readonly DegradeEvent[];
  /** 界面语言; 缺省取全局 getLocale(). */
  locale?: Locale;
}

interface Row {
  key: string;
  depth: number;
  node: RenderPlanNode;
}

function flatten(node: RenderPlanNode, depth: number, rows: Row[], key: string): void {
  rows.push({ key, depth, node });
  node.children.forEach((child, i) => {
    flatten(child, depth + 1, rows, `${key}.${i}`);
  });
}

function describeEvent(event: DegradeEvent, COPY: Copy): string {
  return `${event.code} ${event.dataPath || "/"}: ${event.from ?? COPY.debug.none} → ${event.to}`;
}

export function JotlDebug(props: JotlDebugProps) {
  const { schema, scene = DEFAULT_SCENE, mode = "edit", maxDepth, events = [] } = props;
  const registry = props.registry ?? sharedDefaultRegistry();
  const COPY = copyOf(props.locale ?? getLocale());
  const planned = useMemo(
    () => plan(schema, registry, maxDepth === undefined ? { scene, mode } : { scene, mode, maxDepth }),
    [maxDepth, mode, registry, scene, schema],
  );
  const rows = useMemo(() => {
    const out: Row[] = [];
    if (planned.value !== undefined) flatten(planned.value, 0, out, "0");
    return out;
  }, [planned]);
  return (
    <div className="jotl-debug">
      {planned.diagnostics.length > 0 && (
        <ul className="jotl-debug-diagnostics">
          {planned.diagnostics.map((d, i) => (
            <li key={i}>{`${d.code} ${d.message}`}</li>
          ))}
        </ul>
      )}
      <table className="jotl-debug-table">
        <caption>{COPY.debug.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{COPY.debug.dataPath}</th>
            <th scope="col">{COPY.debug.schemaPointer}</th>
            <th scope="col">{COPY.debug.widget}</th>
            <th scope="col">{COPY.debug.level}</th>
            <th scope="col">{COPY.debug.source}</th>
            <th scope="col">{COPY.debug.degraded}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, depth, node }) => {
            const planned = node.degraded.map((d) => `${d.reason}: ${d.from ?? COPY.debug.none} → ${node.widget}`);
            const runtime = events
              .filter((e) => e.schemaPointer === node.schemaPointer && matchPointer(node.dataPath, e.dataPath))
              .map((e) => describeEvent(e, COPY));
            const records = [...planned, ...runtime];
            return (
              <tr key={key} data-widget={node.widget} data-data-path={node.dataPath}>
                <td style={{ paddingInlineStart: `${depth}em` }}>{node.dataPath || "/"}</td>
                <td>{node.schemaPointer || "#"}</td>
                <td>
                  {node.widget}
                  {node.lazy === true && ` (${COPY.debug.lazy})`}
                </td>
                <td>{node.level}</td>
                <td>{node.source}</td>
                <td>
                  {records.length === 0 ? (
                    COPY.debug.none
                  ) : (
                    <ul className="jotl-debug-degraded">
                      {records.map((text, i) => (
                        <li key={i}>{text}</li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface DegradeLog {
  events: DegradeEvent[];
  /** 传给 JotlForm 的 onDegrade. */
  onDegrade(event: DegradeEvent): void;
  clear(): void;
}

/** 收集表单的降级事件, 交给 JotlDebug 显示. */
export function useDegradeLog(): DegradeLog {
  const [events, setEvents] = useState<DegradeEvent[]>([]);
  const onDegrade = useCallback((event: DegradeEvent) => setEvents((list) => [...list, event]), []);
  const clear = useCallback(() => setEvents([]), []);
  return { events, onDegrade, clear };
}
