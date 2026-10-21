// 只读代码块着色: 把 JSON 与 schemaToTs 生成的 TS 按词法切成带类别的片段渲染, 不解析结构.
import { useMemo } from 'react';

export type TokenKind = 'key' | 'string' | 'number' | 'literal' | 'comment' | 'tag' | 'keyword' | 'type' | 'punct';
export interface Token {
  text: string;
  kind?: TokenKind;
}
export type CodeLang = 'json' | 'ts';

const JSON_TOKEN = /("(?:[^"\\\n]|\\.)*")(\s*:)?|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|\b(true|false|null)\b|([{}[\],])/g;

const TS_TOKEN =
  /(\/\*[\s\S]*?(?:\*\/|$))|(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\??\s*:)|([A-Za-z_$][\w$]*)|([{}()[\];:,<>|&?=.])/g;

const TS_KEYWORDS = new Set([
  'export',
  'import',
  'from',
  'default',
  'interface',
  'type',
  'extends',
  'readonly',
  'declare',
  'const',
  'let',
  'keyof',
  'typeof',
  'infer',
  'in',
  'as',
  'is',
  'namespace',
]);
const TS_LITERALS = new Set(['true', 'false', 'null', 'undefined']);
const TS_BUILTIN_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'bigint',
  'object',
  'unknown',
  'any',
  'never',
  'void',
  'symbol',
]);

function scan(text: string, pattern: RegExp, classify: (m: RegExpExecArray) => Token[]): Token[] {
  const out: Token[] = [];
  let last = 0;
  pattern.lastIndex = 0;
  for (let m = pattern.exec(text); m !== null; m = pattern.exec(text)) {
    if (m[0] === '') {
      pattern.lastIndex++;
      continue;
    }
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push(...classify(m));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function tokenizeJson(text: string): Token[] {
  return scan(text, JSON_TOKEN, m => {
    if (m[1] !== undefined)
      return m[2] === undefined
        ? [{ text: m[1], kind: 'string' }]
        : [
            { text: m[1], kind: 'key' },
            { text: m[2], kind: 'punct' },
          ];
    if (m[3] !== undefined) return [{ text: m[3], kind: 'number' }];
    if (m[4] !== undefined) return [{ text: m[4], kind: 'literal' }];
    return [{ text: m[0], kind: 'punct' }];
  });
}

/** 块注释内的 `@tag` 单独着色. */
function commentTokens(text: string): Token[] {
  return scan(text, /@[A-Za-z]\w*/g, m => [{ text: m[0], kind: 'tag' }]).map(t =>
    t.kind === undefined ? { ...t, kind: 'comment' } : t
  );
}

export function tokenizeTs(text: string): Token[] {
  return scan(text, TS_TOKEN, m => {
    if (m[1] !== undefined) return commentTokens(m[1]);
    if (m[2] !== undefined) return [{ text: m[2], kind: 'comment' }];
    if (m[3] !== undefined) return [{ text: m[3], kind: 'string' }];
    if (m[4] !== undefined) return [{ text: m[4], kind: 'number' }];
    if (m[5] !== undefined) return [{ text: m[5], kind: 'key' }];
    const word = m[6];
    if (word !== undefined) {
      if (TS_KEYWORDS.has(word)) return [{ text: word, kind: 'keyword' }];
      if (TS_LITERALS.has(word)) return [{ text: word, kind: 'literal' }];
      if (TS_BUILTIN_TYPES.has(word) || /^[A-Z]/.test(word)) return [{ text: word, kind: 'type' }];
      return [{ text: word }];
    }
    return [{ text: m[0], kind: 'punct' }];
  });
}

export function CodeBlock({ text, lang, testId }: { text: string; lang: CodeLang; testId?: string }) {
  const tokens = useMemo(() => (lang === 'json' ? tokenizeJson(text) : tokenizeTs(text)), [text, lang]);
  return (
    <pre className="pg-code" data-testid={testId}>
      {tokens.map((t, i) =>
        t.kind === undefined ? (
          t.text
        ) : (
          <span key={i} className={`pg-tok-${t.kind}`}>
            {t.text}
          </span>
        )
      )}
    </pre>
  );
}
