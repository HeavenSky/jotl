// @vitest-environment jsdom
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { parentPointer, type Diagnostic, type JsonSchema } from '@jotl/core';
import { validate } from '@jotl/data';
import type { FieldProps } from '../../src/core/index.js';
import type { ReactNode } from 'react';
import { createDefaultRegistry, nodeId } from '../../src/react/index.js';
import { byPath, errorsAt, FORM_ID, formErrors, renderForm } from './helpers.js';
import { compositeRegistry, probeField } from './widgets.js';

// jsdom 环境按 web 模式转换模块, Vite 会把 test-utils 中的 new URL("../fixtures/", import.meta.url) 改写为 http 地址, 因此这里直接读样例目录.
const FIXTURES = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../fixtures');

interface InvalidCase {
  name: string;
  schema: JsonSchema;
  data: unknown;
  errors: { code: string; pointer: string }[];
}

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function invalidCases(): InvalidCase[] {
  const out: InvalidCase[] = [];
  for (const fixture of readdirSync(FIXTURES)
    .filter(n => /^\d{3}-/.test(n))
    .sort()) {
    const schemaPath = join(FIXTURES, fixture, 'schema.json');
    const invalidDir = join(FIXTURES, fixture, 'invalid');
    if (!existsSync(schemaPath) || !existsSync(invalidDir)) continue;
    for (const file of readdirSync(invalidDir)
      .filter(f => f.endsWith('.json') && !f.endsWith('.errors.json'))
      .sort()) {
      const base = file.slice(0, -'.json'.length);
      out.push({
        name: `${fixture}/${base}`,
        schema: readJson(schemaPath) as JsonSchema,
        data: readJson(join(invalidDir, file)),
        errors: readJson(join(invalidDir, `${base}.errors.json`)) as InvalidCase['errors'],
      });
    }
  }
  return out;
}

const FORM: JsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string', title: '标题', maxLength: 3 },
    count: { type: 'integer', title: '数量', minimum: 1 },
    tags: { type: 'array', title: '标签', minItems: 2, items: { type: 'string', maxLength: 2 } },
  },
  required: ['title'],
};

describe('校验时机', () => {
  it('change: 输入即校验并显示该字段的错误', () => {
    renderForm({ schema: FORM, validateOn: 'change', defaultValue: { title: 'a', tags: ['x', 'y'] } });
    fireEvent.change(byPath('/title')!, { target: { value: 'abcd' } });
    expect(errorsAt('/title')?.textContent).toContain('标题');
    // 未触碰的字段不显示错误.
    expect(errorsAt('/count')).toBeNull();
  });

  it('blur: 输入时不校验, 失焦后显示; 之后每次改动重新校验', () => {
    renderForm({ schema: FORM, validateOn: 'blur', defaultValue: { title: 'a', tags: ['x', 'y'] } });
    fireEvent.change(byPath('/title')!, { target: { value: 'abcd' } });
    expect(errorsAt('/title')).toBeNull();
    fireEvent.blur(byPath('/title')!);
    expect(errorsAt('/title')?.textContent).toContain('标题');
    fireEvent.change(byPath('/title')!, { target: { value: 'ab' } });
    expect(errorsAt('/title')).toBeNull();
  });

  it('提交前只显示已触碰字段的错误: 兄弟字段与父对象的必填错误等到提交后显示', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        title: { type: 'string', title: '标题' },
        level: { enum: [1, 2], title: '等级' },
        contact: {
          type: 'object',
          title: '联系方式',
          properties: { phone: { type: 'string', title: '电话' } },
          required: ['phone'],
        },
      },
      required: ['title', 'level', 'contact'],
    };
    renderForm({ schema, defaultValue: {} });
    fireEvent.blur(byPath('/title')!);
    expect(errorsAt('/title')?.textContent).toContain('标题');
    expect(errorsAt('/level')).toBeNull();
    fireEvent.blur(byPath('/contact/phone')!);
    expect(errorsAt('/contact')).toBeNull();
    expect(errorsAt('/level')).toBeNull();
    expect(formErrors()).toBeNull();
    fireEvent.change(byPath('/contact/phone')!, { target: { value: '1' } });
    fireEvent.change(byPath('/contact/phone')!, { target: { value: '' } });
    expect(errorsAt('/level')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(errorsAt('/level')?.textContent).toContain('等级');
    expect(errorsAt('/title')?.textContent).toContain('标题');
  });

  it('联合错误按细化后的字段判断是否已触碰', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        shape: {
          oneOf: [
            {
              type: 'object',
              properties: { kind: { const: 'circle' }, r: { type: 'number', title: '半径', minimum: 1 } },
              required: ['kind', 'r'],
            },
            {
              type: 'object',
              properties: { kind: { const: 'square' }, side: { type: 'number' } },
              required: ['kind', 'side'],
            },
          ],
        },
      },
    };
    renderForm({ schema, registry: compositeRegistry(), defaultValue: { shape: { kind: 'circle', r: 0 } } });
    fireEvent.blur(byPath('/shape/r')!);
    expect(errorsAt('/shape/r')?.textContent).toContain('半径');
  });

  it('submit: 失焦不校验, 提交时显示全部错误且不调用 onSubmit', () => {
    const onSubmit = vi.fn();
    const onValidate = vi.fn();
    renderForm({
      schema: FORM,
      validateOn: 'submit',
      onSubmit,
      onValidate,
      defaultValue: { title: 'abcd', tags: ['x'] },
    });
    fireEvent.blur(byPath('/title')!);
    expect(errorsAt('/title')).toBeNull();
    expect(onValidate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(errorsAt('/title')?.textContent).toContain('标题');
    expect(errorsAt('/tags')?.textContent).toContain('标签');
    fireEvent.change(byPath('/title')!, { target: { value: 'abc' } });
    fireEvent.change(byPath('/tags/0')!, { target: { value: 'y' } });
    fireEvent.click(screen.getByRole('button', { name: '新增' }));
    fireEvent.change(byPath('/tags/1')!, { target: { value: 'z' } });
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'abc', tags: ['y', 'z'] });
    expect(errorsAt('/title')).toBeNull();
  });
});

describe('错误分发', () => {
  it('字段错误给字段与外壳: 外壳与字段同一 id, label for 与 aria-describedby 对得上', () => {
    const { handle } = renderForm({ schema: FORM, defaultValue: { title: 'abcd', tags: ['a', 'b'] } });
    act(() => void handle().validate());
    const input = byPath('/title') as HTMLInputElement;
    expect(document.querySelector(`label[for="${input.id}"]`)?.textContent).toContain('标题');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(errorsAt('/title')!.id);
    expect(errorsAt('/title')!.closest('.jotl-field')).toBe(input.closest('.jotl-field'));
  });

  it('数组层自身的错误只交给数组组件, 外壳不重复显示, id 不冲突', () => {
    const { handle } = renderForm({ schema: FORM, defaultValue: { title: 'a', tags: ['a'] } });
    act(() => void handle().validate());
    expect(document.querySelectorAll(`[id="${nodeId(FORM_ID, '/tags')}-errors"]`)).toHaveLength(1);
    expect(errorsAt('/tags')!.closest('.jotl-array')).toBe(byPath('/tags'));
    expect(byPath('/tags')!.closest('.jotl-field')!.classList.contains('jotl-field--invalid')).toBe(false);
  });

  it('数组元素的错误显示在元素上', () => {
    const { handle } = renderForm({ schema: FORM, defaultValue: { title: 'a', tags: ['a', 'long'] } });
    act(() => void handle().validate());
    expect(errorsAt('/tags/1')?.textContent).toBeTruthy();
    expect(errorsAt('/tags')).toBeNull();
  });

  it('联合节点的错误细化到当前分支内的字段', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        shape: {
          oneOf: [
            {
              type: 'object',
              properties: { kind: { const: 'circle' }, r: { type: 'number', title: '半径', minimum: 1 } },
              required: ['kind', 'r'],
            },
            {
              type: 'object',
              properties: { kind: { const: 'square' }, side: { type: 'number' } },
              required: ['kind', 'side'],
            },
          ],
        },
      },
    };
    const { handle } = renderForm({
      schema,
      registry: compositeRegistry(),
      defaultValue: { shape: { kind: 'circle', r: 0 } },
    });
    act(() => void handle().validate());
    expect(errorsAt('/shape/r')?.textContent).toContain('半径');
    expect(errorsAt('/shape')).toBeNull();
  });

  it('联合分支内以分支根为父的错误标签取联合字段的标题, 不是 "数据"', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        v: { title: '取值', anyOf: [{ type: 'array', items: { type: 'number', minimum: 5 } }, { type: 'boolean' }] },
      },
    };
    const { handle } = renderForm({ schema, registry: compositeRegistry(), defaultValue: { v: [1] } });
    act(() => void handle().validate());
    const text = errorsAt('/v/0')?.textContent ?? '';
    expect(text).toContain('取值 的第 1 项');
    expect(text).not.toContain('数据');
  });

  it('标签页布局的字段错误计入 LayoutField.errorCount, 标签页上显示错误数', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'string', minLength: 3 },
        c: { type: 'object', properties: { d: { type: 'number', minimum: 5 } } },
      },
      'x-ui': {
        layout: 'tabs',
        groups: [
          { title: '基本', fields: ['a'] },
          { title: '高级', fields: ['b', 'c'] },
        ],
      },
    };
    const { handle } = renderForm({ schema, defaultValue: { a: '', b: 'x', c: { d: 1 } } });
    expect(screen.getByRole('tab', { name: '高级' })).toBeTruthy();
    act(() => void handle().validate());
    expect(screen.getByRole('tab', { name: '高级 2 个错误' }).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByRole('tab', { name: '基本' })).toBeTruthy();
  });

  it('FieldProps.required 按父对象的 required 计算, 根与数组元素为 false', () => {
    const log: FieldProps<unknown, ReactNode>[] = [];
    const registry = createDefaultRegistry().extend();
    registry.register({ name: 'input', level: 'field', component: probeField(log) });
    const schema: JsonSchema = {
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'string' }, list: { type: 'array', items: { type: 'string' } } },
      required: ['a', 'list'],
    };
    renderForm({ schema, registry, defaultValue: { list: ['x'] } });
    const required = (path: string) => log.filter(p => p.dataPath === path).at(-1)?.required;
    expect(required('/a')).toBe(true);
    expect(required('/b')).toBe(false);
    expect(required('/list/0')).toBe(false);
    log.length = 0;
    renderForm({ schema: { type: 'string' }, registry, defaultValue: 'r' });
    expect(log.at(-1)?.required).toBe(false);
  });
});

/** 错误应显示的位置: 该路径或最近的有错误列表的祖先(json 接管子树时), 没有外壳的字段显示在表单级列表. */
function locate(pointer: string): { element: HTMLElement; owner: string } {
  let path: string | undefined = pointer;
  while (path !== undefined) {
    const element = errorsAt(path);
    if (element !== null) return { element, owner: path };
    path = parentPointer(path);
  }
  return { element: formErrors()!, owner: 'form' };
}

const UNION_COLLAPSED_CODES = new Set(['JOTL4012', 'JOTL4015']);

describe('fixtures 的 invalid 数据: 错误显示在正确字段', () => {
  const cases = invalidCases();

  it('样例集中有 invalid 数据', () => {
    expect(cases.length).toBeGreaterThan(20);
  });

  it.each(cases.map(c => [c.name, c] as const))('%s', (_, { schema, data, errors: expected }) => {
    expect(expected.length).toBeGreaterThan(0);
    const { handle } = renderForm({ schema, registry: compositeRegistry() });
    // setValues 不填充默认值, 保证校验的正是样例数据.
    act(() => handle().setValues(data));
    let valid: boolean | undefined;
    act(() => {
      valid = handle().validate().valid;
    });
    expect(valid).toBe(false);
    const diagnostics = validate(schema, handle().getValues()).diagnostics;
    for (const { code, pointer } of expected) {
      const diagnostic = diagnostics.find(
        (d: Diagnostic) => d.code === code && d.location?.kind === 'pointer' && d.location.pointer === pointer
      );
      expect(diagnostic, `${code} ${pointer}`).toBeDefined();
      // 联合层的汇总错误在区分字段匹配某个分支时被细化为分支内字段的错误, 此时要求子树中有字段标记错误.
      if (
        UNION_COLLAPSED_CODES.has(code) &&
        errorsAt(pointer) === null &&
        !(formErrors()?.textContent ?? '').includes(diagnostic!.message)
      ) {
        const subtree = byPath(pointer);
        expect(subtree, `${code} ${pointer}`).not.toBeNull();
        // 区分字段不匹配任何分支时错误留在联合组件上; 细化出的分支外字段(如多余字段)进表单级列表.
        const shown =
          subtree!.querySelector('[aria-invalid="true"]') !== null ||
          (subtree!.textContent ?? '').includes(diagnostic!.message) ||
          (formErrors()?.textContent ?? '') !== '';
        expect(shown, `${code} ${pointer} 细化后的错误`).toBe(true);
        continue;
      }
      const { element, owner } = locate(pointer);
      expect(element.textContent, `${code} ${pointer}`).toContain(diagnostic!.message);
      if (owner === 'form') {
        // 没有外壳的字段把错误交给表单级列表, 字段自身仍标记 aria-invalid;
        // 没有对应节点的字段(schema 外的多余字段, 被 visibleIf 隐藏的字段)只出现在表单级列表.
        const field = byPath(pointer);
        if (field !== null) expect(field.getAttribute('aria-invalid'), pointer).toBe('true');
      } else if (owner !== pointer) {
        // 子路径没有节点时只能由显示整个值的字段层组件(json, 多选框等)接管, 不能落到对象或数组容器上.
        const element = byPath(owner);
        expect(element, `${pointer} -> ${owner}`).not.toBeNull();
        expect(element!.matches('.jotl-object, .jotl-array'), `${pointer} -> ${owner}`).toBe(false);
      }
      if (owner !== 'form') expect(formErrors()?.textContent ?? '').not.toContain(diagnostic!.message);
    }
  });
});
