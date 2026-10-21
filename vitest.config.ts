// 全仓测试入口: 收集各包与各应用 test 目录下的用例.
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["packages/*/test/**/*.test.{ts,tsx}", "apps/*/test/**/*.test.{ts,tsx}"],
		passWithNoTests: true,
		setupFiles: ["test-utils/locale-zh.ts"],
	},
});
