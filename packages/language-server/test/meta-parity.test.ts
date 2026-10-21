// 元数据键补全与编译器的适用性检查口径一致; widget 候选与编译器的降级检查口径一致.
import { BUILTIN_WIDGETS, COMPONENT_NAMES, compile, META_KEY_NAMES } from '@jotl/core';
import { describe, expect, it } from 'vitest';
import { WIDGET_CANDIDATES } from '../src/completion.js';
import { getCompletions } from '../src/index.js';
import { URI, withCursor } from './helpers.js';

/** 每个组件不带元数据就能编译的最小写法: `{meta}` 处插入元数据. */
const COMPONENT_SAMPLES: Readonly<Record<string, string>> = {
  enum: 'enum[{meta}]{ a b }',
  array: 'array[{meta}] { x: string }',
  map: 'map[{meta}] { x: string }',
  union: 'union[{meta}] { a: { x: string } }',
};

function sample(component: string, meta: string): string {
  const template = COMPONENT_SAMPLES[component] ?? `${component}[{meta}]`;
  const extra = component === 'union' ? "discriminator: 'k', " : '';
  return `A: { a: ${template.replace('{meta}', `${extra}${meta}`)} }`;
}

describe('补全给出的元数据键不会被编译器判为不适用(JOTL1007)', () => {
  it.each(COMPONENT_NAMES.map(name => [name]))('%s', component => {
    const { text, position } = withCursor(sample(component, '‸'));
    const offered = new Set(getCompletions(text, position).map(item => item.label));
    for (const key of META_KEY_NAMES) {
      const rejected = compile(sample(component, `${key}: null`), URI).diagnostics.some(
        d => d.code === 'JOTL1007' || d.code === 'JOTL1011'
      );
      if (offered.has(key)) expect(rejected, `${component} ${key}`).toBe(false);
    }
  });
});

describe('widget 候选恰为编译器不降级(JOTL1045)的内置名', () => {
  it.each(Object.entries(WIDGET_CANDIDATES).filter(([name]) => name !== 'enum'))('%s', (component, candidates) => {
    for (const widget of BUILTIN_WIDGETS) {
      if (widget === 'form' || widget === 'field') continue;
      const diagnostics = compile(sample(component, `widget: '${widget}'`), URI).diagnostics;
      expect(diagnostics.map(d => d.code).includes('JOTL1045'), `${component} ${widget}`).toBe(
        !candidates.includes(widget)
      );
    }
  });
});
