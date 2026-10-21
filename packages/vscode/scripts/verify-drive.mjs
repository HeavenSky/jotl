// 经 CDP 驱动独立 VS Code 实例做插件实机验证(见 ../VERIFY.md 的 "环境准备").
// 用法:
//   node verify-drive.mjs -e '<代码>'      执行一段 async 代码, 可用 page, h(下方 helpers), log
//   node verify-drive.mjs <步骤脚本.mjs>   脚本 default 导出 async ({ page, h, log }) => {}
// 环境变量:
//   JOTL_VERIFY_CDP         CDP 地址, 默认 http://127.0.0.1:9333
//   JOTL_VERIFY_PLAYWRIGHT  playwright-core 的目录(不是仓库依赖, 需另装), 默认 <仓库>/.ai-ctx/cache/vscode-verify/node/node_modules/playwright-core
//   JOTL_VERIFY_SHOTS       截图目录, 默认当前目录
// 每次运行只连接后断开, 不关闭 VS Code.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const cdp = process.env.JOTL_VERIFY_CDP ?? 'http://127.0.0.1:9333';
const pwDir =
  process.env.JOTL_VERIFY_PLAYWRIGHT ?? join(repoRoot, '.ai-ctx/cache/vscode-verify/node/node_modules/playwright-core');
const shots = resolve(process.env.JOTL_VERIFY_SHOTS ?? '.');
const { chromium } = await import(pathToFileURL(join(pwDir, 'index.mjs')).href);

const sleep = ms => new Promise(r => setTimeout(r, ms));

function helpers(page) {
  const kb = page.keyboard;
  const h = {
    sleep,
    /** 用 Cmd+P 打开工作区内的文件(相对仓库根的路径). */
    async openFile(rel) {
      await kb.press('Escape');
      await kb.press('Meta+P');
      await page.waitForSelector('.quick-input-widget .input', { state: 'visible' });
      await kb.type(rel);
      await sleep(700);
      await kb.press('Enter');
      await sleep(1200);
    },
    /** 聚焦第 n 个(0 起算)编辑器组: 点它的活动标签; 预览 webview 持有焦点时快捷键到不了工作台, 先用它取回焦点. */
    async focusGroup(n = 0) {
      await page.locator('.editor-group-container').nth(n).locator('.tab.active').first().click();
      await sleep(300);
    },
    /** 在命令面板中按标题执行命令. */
    async command(title) {
      await kb.press('Escape');
      await kb.press('Meta+Shift+P');
      await page.waitForSelector('.quick-input-widget .input', { state: 'visible' });
      await kb.type(title);
      await sleep(700);
      await kb.press('Enter');
      await sleep(600);
    },
    /** 把光标移到 1 起算的行列(Ctrl+G). */
    async goto(line, col = 1) {
      await kb.press('Escape');
      await kb.press('Control+G');
      await page.waitForSelector('.quick-input-widget .input', { state: 'visible' });
      await kb.type(`${line}:${col}`);
      await kb.press('Enter');
      await sleep(250);
    },
    /**
     * 在仓库内文件的磁盘内容中找第 n 次出现的 text, 返回 1 起算的 [line, col].
     * col 按 Ctrl+G 的口径: 中日韩等宽字符算 2 列.
     */
    find(rel, text, nth = 1) {
      const visual = s => [...s].reduce((n, ch) => n + (ch.codePointAt(0) >= 0x2e80 ? 2 : 1), 0);
      const lines = readFileSync(join(repoRoot, rel), 'utf8').split('\n');
      let seen = 0;
      for (let i = 0; i < lines.length; i++) {
        let from = 0;
        for (;;) {
          const idx = lines[i].indexOf(text, from);
          if (idx < 0) break;
          if (++seen === nth) return [i + 1, visual(lines[i].slice(0, idx)) + 1];
          from = idx + 1;
        }
      }
      throw new Error(`${rel} 中找不到 ${text}`);
    },
    /** 在光标处显示悬停(editor.action.showHover), 返回卡片文本. */
    async hoverAt(line, col) {
      await h.goto(line, col);
      await h.command('Show or Focus Hover');
      await sleep(1200);
      return h.text('.monaco-hover:not(.hidden) .hover-contents, .monaco-hover:not(.hidden)');
    },
    /** 触发建议并返回建议列表各项的文本. */
    async suggest() {
      await kb.press('Control+Space');
      await sleep(1500);
      return page.$$eval('.suggest-widget.visible .monaco-list-row', rows =>
        rows.map(r => r.getAttribute('aria-label') ?? r.textContent)
      );
    },
    async text(selector) {
      const el = await page.$(selector);
      return el ? (await el.innerText()).trim() : null;
    },
    /**
     * 打开问题面板并返回各行文本; 列表是虚拟滚动的, 只含可见行,
     * 文件多时传 filter(如文件名)用面板的过滤框缩小范围, 传 "" 清除过滤.
     */
    async problems(filter) {
      await h.command('Problems: Focus on Problems View');
      await sleep(500);
      if (filter !== undefined) {
        await page.locator('.viewpane-filter input').first().fill(filter);
        await sleep(800);
      }
      await sleep(300);
      return page.$$eval('.markers-panel .monaco-list-row', rows =>
        rows.map(r => r.getAttribute('aria-label') ?? r.textContent)
      );
    },
    /** 状态栏语言模式. */
    async language() {
      return h.text('#status\\.editor\\.mode');
    },
    /** 当前编辑器可见行的文本. */
    async editorText() {
      return page.$$eval('.editor-group-container.active .monaco-editor .view-line', ls =>
        ls.map(l => l.textContent.replace(/ /g, ' '))
      );
    },
    /** 可见行中各记号的文本与颜色, 用于判断高亮. */
    async tokens(maxLines = 40) {
      return page.$$eval(
        '.editor-group-container.active .monaco-editor .view-line',
        (ls, max) =>
          ls
            .map(l => ({ top: parseFloat(l.style.top), l }))
            .sort((a, b) => a.top - b.top)
            .slice(0, max)
            .map(({ l }) =>
              [...l.querySelectorAll('span > span')].map(s => [s.textContent, getComputedStyle(s).color])
            ),
        maxLines
      );
    },
    /** 当前活动编辑器中的诊断装饰数(波浪线). */
    async squiggles() {
      return page.$$eval(
        '.editor-group-container.active .squiggly-error, .editor-group-container.active .squiggly-warning',
        e => e.map(x => x.className)
      );
    },
    async shot(name) {
      const file = join(shots, `${name}.png`);
      await page.screenshot({ path: file });
      return file;
    },
    /** 返回预览 webview 的内容 frame(VS Code webview 是嵌套 iframe). */
    async previewFrame() {
      for (let i = 0; i < 20; i++) {
        // 外层 iframe 是 VS Code 的 webview 宿主, 插件内容在它的子 iframe 中.
        const inner = page
          .frames()
          .filter(
            f => f.url().startsWith('vscode-webview://') && f.parentFrame()?.url().startsWith('vscode-webview://')
          );
        if (inner.length > 0) return inner[inner.length - 1];
        await sleep(300);
      }
      const all = page.frames().map(f => f.url());
      throw new Error(`找不到预览 frame: ${all.join(' | ')}`);
    },
  };
  return h;
}

const browser = await chromium.connectOverCDP(cdp);
try {
  const page = browser
    .contexts()
    .flatMap(c => c.pages())
    .find(p => p.url().includes('workbench.html'));
  if (!page) throw new Error('找不到 workbench 页面');
  // 让页面在没有系统焦点时也认为自己有焦点; 按键与鼠标都经 CDP 发送, 不激活窗口, 不抢用户的键盘焦点.
  // 不要调用 bringToFront, 也不要用 code CLI 向该实例打开文件(会把窗口置前).
  const cdpSession = await page.context().newCDPSession(page);
  await cdpSession.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  const h = helpers(page);
  const log = (...a) => console.log(...a.map(x => (typeof x === 'string' ? x : JSON.stringify(x, null, 1))));
  const AsyncFunction = (async () => {}).constructor;
  if (process.argv[2] === '-e') {
    await new AsyncFunction('page', 'h', 'log', process.argv[3])(page, h, log);
  } else {
    const mod = await import(pathToFileURL(resolve(process.argv[2])).href);
    await mod.default({ page, h, log });
  }
} finally {
  // 只断开 CDP 连接, 不关闭 VS Code.
  await browser.close();
}
