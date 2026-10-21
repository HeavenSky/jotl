// 诊断列表: 按编译与 TS 生成的顺序列出诊断, 有源码位置的条目可点击定位到编辑器.
import { countBySeverity, type PlaygroundDiagnostic } from './compile.js';
import { useCopy } from './copy.js';

export interface DiagnosticListProps {
  diagnostics: readonly PlaygroundDiagnostic[];
  onReveal(diagnostic: PlaygroundDiagnostic): void;
}

function DiagnosticBody({ diagnostic }: { diagnostic: PlaygroundDiagnostic }) {
  const COPY = useCopy();
  const { start } = diagnostic;
  return (
    <>
      <span className={`pg-severity pg-severity-${diagnostic.severity}`}>
        {COPY.diagnostics.severity[diagnostic.severity]}
      </span>
      <span className="pg-diagnostic-location">
        {start === undefined ? COPY.diagnostics.noLocation : COPY.diagnostics.location(start.line, start.column)}
      </span>
      <span className="pg-diagnostic-stage">{COPY.diagnostics.stage[diagnostic.stage]}</span>
      {diagnostic.code !== undefined && <code className="pg-diagnostic-code">{diagnostic.code}</code>}
      <span className="pg-diagnostic-message">{diagnostic.message}</span>
    </>
  );
}

export function DiagnosticList({ diagnostics, onReveal }: DiagnosticListProps) {
  const COPY = useCopy();
  const { errors, warnings } = countBySeverity(diagnostics);
  return (
    <section className="pg-diagnostics" aria-labelledby="pg-diagnostics-heading">
      <h2 id="pg-diagnostics-heading" className="pg-section-heading">
        {COPY.diagnostics.heading}
        <span className="pg-diagnostics-count">
          {diagnostics.length === 0 ? COPY.diagnostics.none : COPY.diagnostics.count(errors, warnings)}
        </span>
      </h2>
      {diagnostics.length > 0 && (
        <ul className="pg-diagnostic-list">
          {diagnostics.map((diagnostic, i) => (
            <li key={i} className="pg-diagnostic">
              {diagnostic.start === undefined ? (
                <div className="pg-diagnostic-row">
                  <DiagnosticBody diagnostic={diagnostic} />
                </div>
              ) : (
                <button
                  type="button"
                  className="pg-diagnostic-row pg-diagnostic-button"
                  onClick={() => onReveal(diagnostic)}
                >
                  <DiagnosticBody diagnostic={diagnostic} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
