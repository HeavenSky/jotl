import { setLocale } from '@jotl/core';
import { afterEach, describe, expect, it } from 'vitest';
import {
  UI_CORE_DIAGNOSTICS,
  XUI_ISSUE_REASONS,
  XUI_ISSUE_REASONS_EN,
  uiCoreDiagnostic,
  xuiIssueReason,
} from '../../src/core/index.js';

const placeholders = (template: string) => [...template.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

afterEach(() => setLocale('zh-CN'));

describe('core 诊断代码表的英文模板', () => {
  it.each(Object.entries(UI_CORE_DIAGNOSTICS))('%s 有 en 且占位符与中文一致', (_, def) => {
    const definition = def as { message: string; en?: string };
    expect(definition.en).toBeTypeOf('string');
    expect(placeholders(definition.en!)).toEqual(placeholders(definition.message));
  });

  it('F3 原因短语中英键一致', () => {
    expect(Object.keys(XUI_ISSUE_REASONS_EN).sort()).toEqual(Object.keys(XUI_ISSUE_REASONS).sort());
  });

  it('按全局语言取模板与原因短语, 默认中文', () => {
    expect(uiCoreDiagnostic('JOTL5104', { value: '-1' }).message).toBe('maxDepth 必须是非负整数, 实际为 -1');
    expect(xuiIssueReason('type')).toBe('类型不符');
    setLocale('en');
    expect(uiCoreDiagnostic('JOTL5104', { value: '-1' }).message).toBe(
      'maxDepth must be a non-negative integer, got -1'
    );
    expect(xuiIssueReason('type')).toBe('type mismatch');
  });
});
