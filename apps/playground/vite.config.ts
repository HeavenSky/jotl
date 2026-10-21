// Playground 的 Vite 构建配置.
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const TYPESCRIPT_MODULE = /[\\/]node_modules[\\/](?:\.pnpm[\\/])?typescript[@\\/]/;

// 产物里混入 typescript 编译器时让构建失败, 防止误从 @jotl/convert/from-ts 导入使产物静默膨胀.
function forbidTypescriptInBundle(): Plugin {
	return {
		name: "jotl-playground:forbid-typescript",
		apply: "build",
		generateBundle(_options, bundle) {
			for (const output of Object.values(bundle)) {
				if (output.type !== "chunk") continue;
				const offender = output.moduleIds.find(id => TYPESCRIPT_MODULE.test(id));
				if (offender !== undefined)
					this.error(`typescript 被打包进了 ${output.fileName}: ${offender}`);
			}
		},
	};
}

// 产物用相对路径引用资源, 部署到任意子路径都能打开.
export default defineConfig({
	base: "./",
	plugins: [react(), tailwindcss(), forbidTypescriptInBundle()],
	build: {
		rolldownOptions: {
			output: {
				codeSplitting: {
					groups: [
						{
							name: "react",
							test: /[\\/]node_modules[\\/](?:\.pnpm[\\/])?(?:react|react-dom|scheduler)[@\\/]/,
						},
						{ name: "vendor", test: /[\\/]node_modules[\\/]/ },
					],
				},
			},
		},
	},
});
