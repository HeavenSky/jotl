# TODO

## 方案待定

- 文档规范化后 core, data, form 的 README 仍以 "Known limitations" 链到根 `TODO.md` 的「确定不修」; 推荐改为各包 guide 内的已知限制页, 发布后 npm 页上不再指向内部待办
- 合并历史前的旧提交保留在本地分支 `backup/pre-squash`(author 为旧身份); 推荐确认新历史无误后删除该分支, 推送远端前必须删除

## 方案确定

### 文档发布前核对

- npm 包与插件尚未发布, 各 README 快速开始的 `pnpm add` 与市场安装命令在仓库外跑不通; 首次发布后按各 README 快速开始实测一遍
- `vscode-jotl` README 首屏只有代码示例, 缺预览面板截图; 补一张截图放 `packages/vscode/docs/images/` 并在 README 结果证据处引用
- vsce 打包时对 README 中跨出包目录的 `../` 链接(`../cli/README.md`, `../../docs/spec/*.md`)的改写未实测; 打包后解开 VSIX 检查 `extension/readme.md` 中的链接指向 `github.com/jotl-lang/jotl/blob/HEAD/...`

### 用户验证与发布

- 用户本人验证; 其余项已在独立 VS Code 实例与调试 Chrome 中模拟通过(记录见 `packages/vscode/VERIFY.md` 的 20261013_184446 一节)
  - 规范正式评审(`docs/spec/*.md`); 模拟只抽查了 `jotl.md` 12 段示例能编译
  - Firefox 下单选下拉弹层位置: Firefox 不支持 `appearance: base-select`, 走 `appearance: none` 加原生弹层的回落分支; 本机未装 Firefox, 用户决定暂缓
  - VS Code 插件亲自试用; 用例 40 与配置 schema 中英切换已在 20261014_173002 模拟通过
- 发布; 实施期间只做本地提交, 不 push, 不 publish(方案 D25), `pnpm check` 全绿且用户验证通过后, 经用户确认再 npm publish 并推送到 GitHub `jotl-lang`; 插件发布参数已定(市场 ID `jotl-lang.vscode-jotl`, 同发 Open VSX, `0.1.0` 预发布, 标签 `vscode-v0.1.0` 触发 `.github/workflows/vscode-release.yml`), 发布账号, token 与 GitHub 远端由用户建

## 确定不修

- 富文本编辑器不设为默认, 保持可选接入(`adapters.richText = richTextEditor`); 用户决定, `contenteditable` 方案未过 Safari/Firefox
- `@jotl/form` 预编译 CSS 带 `jt` 前缀且不含 preflight; 用户确认维持: 库 CSS 带 preflight 会重置宿主整页, 不加前缀会与宿主 Tailwind 同名类互相覆盖; 复用入口是 `--jotl-*` 变量, `jotl-*` 语义类与 className
- 凤蝶迁移的旧数据通不过新格式校验(Image File URL 带 `format: "uri"`, Color 只接受十六进制); 用户决定维持与 Jotl 语义类型一致, 旧数据由 `validate` 报告后人工修正(`migrate` 不处理 format 违规)
- 凤蝶 v1 扩展元数据(`source`/`sourceType`, `rule`, `reuseable`, `Component` 等语义类型, 条件必填/只读)本轮不纳入语法, 继续记 `x-fengdie`(`showKey` 已转为 `x-ui.summary`, `if` 中可精确映射的表达式已转为 `x-ui.visibleIf`); 用户决定, 按实际使用再逐项加, 背景见 `.ai-ctx/plans/20261008_Jotl语法对齐凤蝶与扩展设计.md`
- `@jotl/form` 原生 `maxLength` 与 `@jotl/antd` 的 `Input`/`TextArea`/`Password` `maxLength` 都按 UTF-16 计数, 含代理对字符时比 schema 更早拦截; 用户决定维持, 保留输入时拦截; antd 可改用 `count.strategy` 但需 antd ≥5.10, 现 peer 为 `^5.0.0 || ^6.0.0`

- Ajv 2020 与官方测试集 draft2020-12 不一致; Jotl 语法不提供这些写法, 只能经 `schema` 元数据透传; 规范中只有 `docs/spec/keyword-mapping.md:35`(中文版 `zh/docs/spec/keyword-mapping.md:35`)一句提到 `$dynamicRef`/`$vocabulary`
  - `$dynamicRef`, `unevaluated*` 与 `contains`/`if` 组合, 相对 URI 加嵌套 `$id` 的 `$ref`, 空 `enum`, `$vocabulary`, `__proto__` 属性名; ajv-formats 不支持 `idn-*` `iri*` 及 email, hostname, date-time, time, duration, uri, uri-reference, uri-template, uuid 的部分官方用例; `core/format.json` 因开启 format 断言而有意排除; 条数以排除清单为准(20261014 核对为 224 条)
  - 根无 `$id` 而子资源在同一节点同时写相对 `$id` 与 `$ref` 时 Ajv 编译栈溢出(报 JOTL4017); `@jotl/data` 默认数据与 Mock 的引用解析不受影响
  - 复现: `pnpm exec vitest run packages/data/test/ajv-test-suite.test.ts`, 排除清单 `packages/data/test/ajv-test-suite-exclusions.json`
- `migrate` 不修复 `maxItems` `uniqueItems` `maxLength` 等约束违规; 留给 `validate` 报告, 自动截断会丢数据
- upgrade 不执行规范化规则 2(命名类型只在根 `$defs`); 把嵌套 `$defs` 提到根会改变 `$ref` 解析, 保留原位置
- 预览面板 webview 的 CSP 放开了 `'unsafe-eval'`; Ajv 用 `new Function` 生成校验函数, 不放开时表单校验报错; 脚本来源只放行带 nonce 的标签, 开启扩展组件模块时另放行 `cspSource` 与 `https:`; schema 随编辑实时变化, Ajv standalone 预编译不适用
- 带 `$schema` 的 `*.schema.json` 中 `x-ui` 补全与校验失效; VS Code JSON 服务按文档根 `$schema` 取 schema, 优先于按文件名关联的 schema, 经 JSON 服务无法叠加(绕开 JSON 服务由语言服务自管 json 文档的诊断与补全约 200-400 行); 已在 `packages/vscode/README.md` 写明限制与绕过办法
- `@jotl/antd` 不依赖 dayjs, 日期组件用调用方传入的 dayjs 实例(`createAntdRegistry({ dayjs })`), 不传时回落原生日期输入; 按推荐保持, antd 用户本就安装 dayjs, 不增加依赖
- Biome formatter 不启用, 不做全仓格式化; 现有风格一致, 全仓重排会产生大 diff 且无行为收益
- 以下为已知限制, 出现实际需求再做; 用户确认不列入近期计划
  - `@jotl/antd`: `richtext` `money` `bigint` `output` `image` `file` `json` `kv` `union` `nullable` `tree` `tuple` 回落 html 默认组件
  - eslint-plugin-tsdoc 与 eslint-plugin-jsdoc 加载 `@jotl/convert` 预设后的实际表现未测; `tsdoc.json` 的 `extends` 已实测可用, 两个插件不在依赖中
  - `typescript@6.0.3` 经典 API 在浏览器中运行(自定义 CompilerHost)未验证
  - 编译期 `value_format` 校验器只认 `YYYY MM DD HH mm ss SSS Z ZZ A a` 与 `[..]`, 含其他 dayjs 记号的格式在编译期放行; 按需扩展记号
  - 通用 schema 转换: allOf 合并只认全为对象 `$ref` 的情形, `anyOf` 中常量 + 同类型开放分支打印为该类型, 常量值记入 `examples`(已有 `examples` 时不记), 各常量分支的 `title`/`description` 丢失; 按需扩展合并范围
  - 凤蝶多导出文档迁移后第一个导出成为根(v1 不能表达无根文件); 随多文件 `import` 一起设计纯类型库
  - 扩展组件 `base` 为 `'integer'` 时, 节点 `{type: "integer", x-ui.widget}` 打印为 `integer[widget: ...]`, 重新编译多出安全整数上下界, 往返不再深度相等(声明本身的 `base` 能保留); 配置 schema 中 "底层 schema 分支排除带 module 的对象" 只对编辑器生效
  - 打印前的 JSON 深度预检取 `4 * MAX_NESTING`(1024)层, 是保守近似, 罕见的深 JSON 浅 Jotl 形态会被误拒
  - 对象的 `patternProperties` 仍按 F7 整体用 `json`, 未接 "其他键" 编辑; 按需补
  - 元组位置上的 `title` 转 TS 时报 JOTL2002; 剩余元素不能上移, 下移或复制; 按需补
  - 默认数据, Mock 与错误文案的引用解析: 同一 JS 对象被多个 `$id` 资源共享引用时以先遍历到的资源 base 为准; `$dynamicRef` 按普通 `$ref` 解析
  - `jotl.config.json` 中非大驼峰的 widget 名写的底层类型只做格式校验, 编译器不使用; 按需让渲染侧按底层类型校验 widget 适用性
  - 模块组件默认按 `field` 级登记(`moduleWidgetRegistrations` 的 `level` 缺省); 直接调用 `moduleWidgetRegistrations` 不传 `locale` 时加载失败文案读全局语言
  - 字段外壳的 `<label for>` 在渲染后按实际内层元素补上, 服务端渲染输出不带 `for`
  - 未知关键字下恰好名为 `default` `const` 等的属性被 `$ref` 指向时会被当作数据位置跳过升级; 仅凭路径无法区分, 记为已知限制
  - `regExp` 同时带 `u` 与 `i` 时, `[kK]` 写法丢掉 Unicode 特殊折叠(`k` 匹配开尔文符号, `s` 匹配 `ſ`); 按需补折叠表(约 15-20 行), 收益低
  - 凤蝶 `if` 只转换可精确映射到 `visibleIf` 的写法(路径真假, `===` `!==`, 与 `null` 的 `==`/`!=`, 字段类型已知时的宽松相等与数值比较, `&&` `||` `!` 与括号); 函数调用, 其他变量, 算术等记入 `x-fengdie` 条件不生效; 路径中间段为 undefined 时 JS 抛异常而转换后只为假; 依赖字段类型的转换假设数据符合声明类型
  - `item_meta` 写在 `*_item` 之前时补全拿不到类型串, 按无类型串处理; 按需改为全体扫描
  - 预览加载扩展组件模块只放行 `https:` 与本地资源: http 本地开发服务器, 模块自带 CSS 与 `fetch`, 工作区外的本地依赖不可用; untitled 文档的相对路径无法解析; Windows 盘符路径与 `file:` 地址经 import map 映射为 webview 地址, 未在 Windows 实测; 放行 http 本地服务, 模块 CSS 与 `fetch` 各是 CSP 一行, 属安全取舍不放开
