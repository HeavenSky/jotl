// 界面语言的初始取值: 保存的选择优先, 否则按浏览器语言.
import { describe, expect, it } from 'vitest';
import { initialLocale, isLocale } from '../src/locale.js';

describe('initialLocale', () => {
  it('保存过合法的选择时用它', () => {
    expect(initialLocale('en', 'zh-CN')).toBe('en');
    expect(initialLocale('zh-CN', 'en-US')).toBe('zh-CN');
  });

  it('没有或不合法的选择时按浏览器语言: zh 开头为中文, 其余为英文', () => {
    expect(initialLocale(undefined, 'zh-TW')).toBe('zh-CN');
    expect(initialLocale('fr', 'en-GB')).toBe('en');
    expect(initialLocale(undefined, 'ja')).toBe('en');
  });

  it('isLocale 只接受支持的语言', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('zh')).toBe(false);
  });
});
