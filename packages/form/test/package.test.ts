import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  exports: Record<string, unknown>;
  files: string[];
};

function sourceText(dir: string): string {
  return readdirSync(dir, { withFileTypes: true })
    .map(entry =>
      entry.isDirectory() ? sourceText(join(dir, entry.name)) : readFileSync(join(dir, entry.name), 'utf8')
    )
    .join('\n');
}

describe('style.css', () => {
  it('在 exports 中声明为 ./style.css 并随包发布', () => {
    expect(manifest.exports['./style.css']).toBe('./style.css');
    expect(manifest.files).toContain('style.css');
    expect(existsSync(join(root, 'style.css'))).toBe(true);
  });

  it('Tailwind 源样式在 exports 中声明并随包发布, 组件源码一并发布供宿主扫描', () => {
    expect(manifest.exports['./tailwind.css']).toBe('./tailwind.css');
    expect(manifest.exports['./theme.css']).toBe('./theme.css');
    expect(manifest.files).toEqual(expect.arrayContaining(['tailwind.css', 'theme.css', 'src']));
  });

  it('预编译的 style.css 与源样式重新生成的结果一致(不一致时运行 pnpm run build:css)', () => {
    const generated = execFileSync(join(root, 'node_modules', '.bin', 'tailwindcss'), ['-i', 'style.entry.css'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    expect(readFileSync(join(root, 'style.css'), 'utf8').trimEnd()).toBe(generated.trimEnd());
  });

  it('样式表只引用组件实际输出的 jotl- 类名', () => {
    const css = readFileSync(join(root, 'style.css'), 'utf8');
    // 工具类名经转义出现在选择器里(如 .jt\:in-\[\.jotl-array-item-content\]\:p-0), 其中的 \.jotl- 不是选择器类名.
    const classes = new Set([...css.matchAll(/(?<!\\)\.(jotl-[\w-]+)/g)].map(m => m[1] ?? ''));
    const source = sourceText(join(root, 'src'));
    const used = (name: string) => {
      // 修饰类在源码中以模板拼接 `jotl-object--${layout}` 出现.
      const prefix = name.replace(/--[\w-]+$/, '--');
      return (
        source.includes(`'${name}'`) ||
        source.includes(`"${name}"`) ||
        source.includes(` ${name}`) ||
        source.includes(`${name} `) ||
        source.includes(`${prefix}\${`)
      );
    };
    expect([...classes].filter(name => !used(name))).toEqual([]);
  });
});
