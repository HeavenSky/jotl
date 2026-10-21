// 测试用的中文界面文字: 用中文 l10n bundle 查表构造, 缺译文时直接抛错.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createPreviewText, type PreviewText } from '../src/preview-text.js';

const bundle = JSON.parse(readFileSync(join(import.meta.dirname, '../l10n/bundle.l10n.zh-cn.json'), 'utf8')) as Record<
  string,
  string
>;

export const ZH_TEXT: PreviewText = createPreviewText({
  t(message) {
    const translated = bundle[message];
    if (translated === undefined) throw new Error(`中文 bundle 缺少: ${message}`);
    return translated;
  },
});
