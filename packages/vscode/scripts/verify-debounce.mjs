// 诊断防抖用例(VERIFY.md 第 32 条)的步骤脚本, 由 verify-drive.mjs 执行: 在 scratch.jotl 中快速连续输入, 记录诊断装饰(波浪线)的变化时刻.
// 预期 changesRelativeToLastKeyMs 只有一项, 约 200ms(语言服务的 DIAGNOSTICS_DELAY), 输入过程中不刷新.
export default async ({ page, h, log }) => {
	await h.focusGroup(0);
	await h.openFile(".ai-ctx/cache/vscode-verify/scratch.jotl");
	await h.goto(3, 200);
	await page.keyboard.press("End");
	await page.keyboard.press("Enter");
	await h.sleep(1000);
	await page.evaluate(() => {
		const sig = () =>
			[
				...document.querySelectorAll(
					".editor-group-container.active .view-overlays .squiggly-error, .editor-group-container.active .view-overlays .squiggly-warning"
				),
			]
				.map(e => e.className + e.parentElement.style.top + e.style.left + e.style.width)
				.sort()
				.join("|");
		window.__jv = { last: sig(), changes: [] };
		window.__jvObs = new MutationObserver(() => {
			const s = sig();
			if (s !== window.__jv.last) {
				window.__jv.last = s;
				window.__jv.changes.push(performance.now());
			}
		});
		window.__jvObs.observe(
			document.querySelector(".editor-group-container.active .monaco-editor"),
			{ subtree: true, childList: true, attributes: true }
		);
	});
	const text = "extraField: strng";
	const keys = [];
	for (const ch of text) {
		await page.keyboard.type(ch);
		keys.push(await page.evaluate(() => performance.now()));
		await h.sleep(40);
	}
	await h.sleep(1500);
	const changes = await page.evaluate(() => {
		window.__jvObs.disconnect();
		return window.__jv.changes;
	});
	const lastKey = keys[keys.length - 1];
	const gaps = keys.slice(1).map((t, i) => Math.round(t - keys[i]));
	log({
		typed: keys.length,
		keyGapMs: gaps,
		changesRelativeToLastKeyMs: changes.map(t => Math.round(t - lastKey)),
	});
	log((await h.editorText()).slice(0, 6));
	await h.shot("N4-debounce");
};
