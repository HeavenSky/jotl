# Jotl 语法规范 v1

编写, 解析或生成 Jotl 源码时读本页; 对应 `packages/core`

Jotl 源码编译为 JSON Schema 2020-12 文档; `x-ui` 的取值语义与渲染约定见 [x-ui 规范](x-ui.md), 关键字在 JSON Schema 与 TS 中的对应见 [关键字对照](keyword-mapping.md).

## 示例

```jotl
// 普通注释, 编译时丢弃
Banner(轮播项): [closed: true] {
  img(图片): image[props: {maxWidth: 750}]
  href(链接)?: url
  target(打开方式)?: enum[node_if: 'href']{ self(当前页) blank(新窗口) }
}

Block(区块): union[discriminator: 'kind'] {
  text(文本): { content(正文): text }
  image(图片): { src(图片地址): image, alt(替代文字)?: string }
}

<root/>
Home(首页): [layout: 'tabs', groups: [{title: '外观', fields: ['theme', 'mode', 'darkLogo']}], description: '首页配置'] {
  title(标题): string[default: '欢迎', maxLength: 20, errorMessage: {maxLength: '最多 20 字'}]
  note(备注)
  theme(主题色)?: color[default: '#1677ff']
  mode(模式): enum[default: 'light']{ light(浅色) dark(深色) }
  darkLogo(深色 Logo)?: image[root_if: {left: 'mode', op: 'eq', right: 'dark'}, description: '只在深色模式下显示']
  tags(标签)?: array[array_item: 'string', item_meta: {maxLength: 10}, maxItems: 5]
  channels(渠道): enum[multiple: true, widget: 'checkbox']{ app(App) web(网页) mini(小程序) }
  price(价格): money[currency: 'CNY', minimum: '0']
  address(地址)?: [widget: 'inline', layout: 'grid', columns: 2] {
    city(城市): string
    detail(详细地址)?: text[maxLength: 200]
  }
  banners(轮播图)?: array[array_item: 'Banner', maxItems: 5, summary: 'href']
  blocks(区块): array[array_item: 'Block']
  i18n(多语言标题)?: map[map_item: 'string', key_meta: {pattern: '^[a-z]{2}$'}]
  extra(扩展配置)?: jsontext
  remark(备注)?: string[nullable: true]
}
```

## 词法

| 项 | 规则 |
|---|---|
| 编码 | UTF-8; 文件开头 BOM 忽略 |
| 空白 | JS `WhiteSpace`(TAB VT FF SP NBSP ZWNBSP 与 Zs 类) |
| 换行 | LF, CR, CRLF; U+2028 U+2029 按空白, 不计行; 行列从 1, 偏移从 0, 按 UTF-16 代码单元(与 LSP 一致) |
| 注释 | `//` 行注释, `/* */` 块注释(不嵌套); 编译时丢弃. 没有文档注释: `///` 就是普通行注释; 说明写元数据 `description` |
| 标识符 | JS `IdentifierName`(Unicode `ID_Start` `ID_Continue`, `$` `_`), 不支持 `\u` 转义 |
| 字符串 | JSON5: `'...'` 与 `"..."`, JSON5 转义, 允许 `\` 续行; 未知转义报错并保留反斜杠, 快速修复为 `\\` |
| 数字 | JSON5 数字(含 `+1` `.5` `0x10`); `Infinity` `NaN` 报错 |
| 标签 | `(` 到配对的 `)`, 允许成对嵌套(`价格(元)`); 转义 `\(` `\)` `\\`; 不跨行; 去首尾空白后不能为空 |
| 标点 | `{ } [ ] ( ) , ; : ?` |
| 标识记号 | `<root/>` `<default/>` 各为一个整体记号; 其他以 `<` 开头的写法报错 |
| 非法字符 | `\|` `<` `>` `.` `@` `=` `#` 在字符串外出现即报错(`\|` 只出现在类型串字符串里) |
| 关键字 | 没有保留关键字: 内置组件名只在组件位置有含义; `true` `false` `null` 只作为元数据中的 JSON 值, `true` `false` 另可作枚举成员值; 枚举体中裸 `null` 报错, 见 [枚举](#枚举) |
| 保留 | `import` `export` `from` 保留给多文件, 当前在组件位置写出即报错 |
| 空白敏感 | 不敏感: 键, 标签, `?`, `:`, 组件, 元数据, 体之间可有任意空白与换行(标签内部除外); `print` 输出紧贴形式 |

## 名字

| 位置 | 规则 |
|---|---|
| 顶层类型名 | 大驼峰 `[A-Z][A-Za-z0-9]*`; 进入 `$defs`, 是引用目标, 也是 TS 类型名 |
| 内置组件名 | 小写纯字母 `[a-z]+`, 区分大小写, 清单见 [内置组件](#内置组件) |
| 扩展组件名 | 大驼峰, 与顶层类型名共用一个命名空间, 重名报错; 组件位置看到大驼峰名时先查本文件类型, 再查扩展组件清单 |
| 字段键 | 标识符(含中文等 Unicode), 另允许中间带 `-`(`a-b`)与非负整数(`0` `12`); 其余加引号(`'x.y'` `"x y"` `'<root/>'`); 引号字符串永远是键 |
| 枚举成员 | 同字段键; 另可直接写数字, 布尔, 引号字符串作为值 |
| 元数据键 | JSON5 对象键; 命名: JSON Schema 与 ajv-errors 原有关键字用原名(驼峰), Jotl 自有键用 snake, 自定义键以 `x_` 开头; 未知键报错 |

## 文件结构

```ebnf
File     = { TopEntry } ;
TopEntry = { Marker } Entry ;
Marker   = "<root/>" | "<default/>" ;
```

- 顶层条目一律是类型定义, 名字必须是大驼峰; 小写, 中文或引号名在顶层报错: "顶层只能声明类型, 根的属性写进根类型的体里", 快速修复为把连续的这类条目包进 `Root(根): {...}` 并标 `<root/>`.
- 顶层条目不能写 `?`.
- 标识写在顶层条目之前(同一行或上一行), 只标记紧随其后的条目; 同一条可同时带两个; 写在体内报错; 每个标识全文件至多一个.
- 根与默认导出:
  - 两个标识都不写: 第一条既是根也是默认导出.
  - 只写一个: 另一个跟随它.
  - 两个都写在不同条目上: 各自生效.
- 根编译为根 schema 的 `$ref: "#/$defs/<名>"`, 根的元数据(含 `rules` `id` `widgets`)写在根条目自己的 `[...]` 上.
- 默认导出只影响 TS 输出的 `export default` 与以后的多文件 `import`, 不写进 JSON Schema: `compile` 的结果另给出 `defaultExport`(类型名), 生成 TS 时传给 `schemaToTs` 的同名选项, 打印 Jotl 时传给 `print` 的同名选项(与根不同时写出 `<default/>` 并给根条目补 `<root/>`), `tsToSchema` 的结果同样带出 `defaultExport`; 与根不同时根类型的注释写 `@root`, 见 [关键字对照](keyword-mapping.md).
- 没有条目的文件只编译出 `$schema`. 纯类型库(无根)随多文件 `import` 一起设计.
- `root` `default` 在任何位置都只是普通名字, 不需要引号.

## 条目

```ebnf
Entry   = Key [ Label ] [ "?" ] [ ":" Content ] [ "," | ";" ] ;
Key     = Ident | Number | String | "*" ;      (* 取值规则见 [名字](#名字) *)
Label   = "(" 标签文本 ")" ;                    (* 见 [词法](#词法) 的 "标签" *)
Ident   = IdentifierName { "-" IdentifierPart { IdentifierPart } } ;   (* JS IdentifierName, 中间可带 `-`: `a-b` *)
Number  = JSON5 数字 ;
String  = JSON5 字符串 ;
Content = Comp [ Meta ] [ Body ]
        | Meta [ Body ]                (* 省略组件: 无体为 string, 有体为 object *)
        | Body ;                       (* 省略组件与元数据: object *)
Comp    = 内置组件名 | 大驼峰名 ;
Meta    = "[" [ Member { "," Member } [ "," ] ] "]" ;   (* JSON5 对象成员 *)
Body    = "{" { Entry | EnumMember } "}" ;              (* 体的内容由组件决定, [体与内部类型](#体与内部类型) *)
```

- 元数据只在组件与体之间.
- 冒号: 只有光秃的 `key(标签)`(冒号后没有内容)可以不写冒号, 此时为选填 `string`; 冒号后有内容时必须写冒号.
- 省略组件只限 `string` 与 `object`: `key: [maxLength: 10]` 为 `string`, `key: {...}` 或 `key: [...] {...}` 为 `object`.
- 必填: 写了 `:` 且没有 `?` 为必填; 光秃的 `key(标签)` 与写了 `?` 的为选填.
- 标签编译为 `title`; 说明只写元数据 `description`.
- 条目间用换行, `,` 或 `;` 分隔, 都可省.
- 引用类型: 组件位置写大驼峰类型名; 可带 [元数据键](#元数据键) 表中适用于 "任意" 的键, 指向枚举时另可带 `multiple` 与项数约束, 指向对象时另可带 `summary`; 编译为 `$ref` 旁的同级关键字; 不能带体, 要改结构就另声明类型. 适用性以 `packages/core/src/syntax/builtins.ts` 的 `META_KEYS` 为准.
- 扩展组件: 组件位置可写已登记的扩展组件, 底层类型取自登记项(`{ ImagePicker: { type: "string", format: "uri" } }`); 未登记报错; 不想登记时写 `string[widget: 'ImagePicker']`. 登记项的值(配置文件与根元数据 `widgets` 写法相同):
  - 底层类型: JSON Schema 基本类型名(`string` `number` `integer` `boolean` `array` `object`, 编译为 `{ type }`), 其余无体的内置组件名(取该组件编译出的 schema, 去掉 `x-ui`; `enum` `union` 不可用), 或 schema 对象(原样使用).
  - 模块声明: 带 `module` 键的对象 `{ base?, module, export? }`, 同时给出实现该 widget 的 ES 模块; `base` 为上一条的底层类型, 缺省 `object`; `module` 为非空的模块地址, 原样保留, 相对路径由使用方按声明所在文件的目录解析; `export` 为导出名, 缺省 `default`; 只能有这三个键. 不带 `module` 的对象一律当作 schema.
  - 大驼峰名是扩展组件, 其余名字只登记为 widget 名(模块声明仍有效).
- 扩展组件可带的元数据: [元数据键](#元数据键) 表中适用于 "任意" 的键, 以及按底层 schema 放行的约束键, 规则与同类内置组件一致: 底层 `type`(去掉 `"null"` 后唯一)为 `string` 时放行 `minLength` `maxLength` `pattern` `format`; `number` 时放行 `minimum` `maximum` `exclusiveMinimum` `exclusiveMaximum` `decimals`; `integer` 时放行上下界四键; `array` 时放行 `minItems` `maxItems` `uniqueItems`; `object` 时放行 `minProperties` `maxProperties`; 底层为 `money` `bigint` 形态时放行上下界四键(写成字符串, 编译到 `x-decimalRange`). 底层没有 `type`(如只有 `anyOf` `$ref`)或有多个类型时不放行任何约束键. 其余键报 JOTL1007. 例: 登记 `Rating: {base: 'integer', module: '...'}` 后可写 `score: Rating[minimum: 0, maximum: 5]`.
  - 约束合并进底层 schema, 同名关键字以元数据为准(如 `integer` 底层的安全整数上下界被覆盖); `format` 与底层不同时与内置组件一样报 JOTL1048 warning; 一端来自元数据, 另一端来自底层的上下界冲突报 JOTL1020. `default` 按合并后的 schema 校验. 放行表以 `packages/core/src/syntax/shapes.ts` 的 `EXTENSION_CONSTRAINT_KEYS` 为准.
- 登记入口:
  - 项目配置 `jotl.config.json`: 形如 `{ "widgets": { "ImagePicker": { "base": "url", "module": "https://esm.sh/image-picker" }, "tag-list": "array", "headline": "string" } }`; 只有 `widgets` 与 `$schema` 两个键; 不合法的项跳过并报配置问题. `readJotlConfig` 的结果中 `config.widgets` 为名字 → 底层 schema, `config.modules` 为模块声明项的名字 → `{ module, export? }`; 配置中的模块声明不写进编译产物, 由使用方按 `config.modules` 加载. 每个源文件使用从所在目录向上找到的最近一个, 到 git 顶层(含 `.git` 的目录)或文件系统根为止. 配置文件自身的 JSON Schema 由 `@jotl/core` 的 `createJotlConfigJsonSchema()` 生成.
  - 根条目元数据 `widgets`: 形如 `Form: [widgets: {ImagePicker: {base: 'url', module: 'https://esm.sh/image-picker'}}] {...}`, 只能写在根条目; 由编译器处理, 任何调用 `compile` 的入口(含 Playground)都生效; 本文件内即可使用这些扩展组件, 与其他入口合并, 同名时以文件内为准; 其中的模块声明编译进根 `x-ui.widgets`(名字 → `{ base?, module, export? }`, 声明了 `object` 以外的 `base` 时原样带上, 见 [x-ui 规范](x-ui.md)); 类型名与文件内声明的扩展组件重名报 JOTL1028, 取值不合法报 JOTL1020.
  - 命令行: 编译 Jotl 的命令自动查找, `--config` 指定, `--no-config` 关闭, 见 `packages/cli/README.md`.
  - VS Code(语言服务): 按文档路径查找, 与设置 `jotl.registeredWidgets`(只有名字)合并, 同名时以配置文件为准, 只在设置中的大驼峰名按 `string` 编译; 配置文件变更后重新诊断, 见 `packages/language-server/README.md`.
  - `@jotl/core` `compile` 的 `options.widgets`(组件名 → 底层 schema): 该包不读文件, 由调用方传入; `readJotlConfig` 与 `configCompileOptions` 把配置内容换算为该选项.

各类条目能写的部分:

| 条目 | 键 | 标签 | `?` | `:` 与内容 |
|---|---|---|---|---|
| 顶层类型 | 大驼峰 | 可 | 否 | 可 |
| 对象字段 | 字段键 | 可 | 可 | 可 |
| 元组位置 | `0` `1` ... 或 `*` | 可 | 只在末尾连续位置; `*` 上不可 | 可 |
| union 分支 | 区分字段的取值 | 可 | 否 | 必须, 内容为对象体或对象类型引用 |
| 枚举成员 | 成员值 | 可 | 否 | 否; 可带只含 `description` 的元数据 |

## 内置组件

术语: "组件" 指写在组件位置上的名字(内置组件与扩展组件), 只决定数据形态(编译出的 JSON Schema); "widget" 指渲染用的控件名(`input` `select` ...), 由元数据 `widget` 选择, 首项为默认. `widget` 只在不等于默认时写入 `x-ui.widget`.

| 组件 | JSON Schema | 默认与常用 `widget`(首个默认) | 体 |
|---|---|---|---|
| `string` | `type: string` | `input` `textarea` `password` | 无 |
| `text` | 同 `string` | 同 `string`, 默认 `textarea` | 无 |
| `richtext` | `string` + `contentMediaType: text/html` | `richtext`(无适配器时退化为 textarea) | 无 |
| `number` | `type: number` | `number` `range` | 无 |
| `integer` | `type: integer`, 默认 `±MAX_SAFE_INTEGER` | `number` `range` | 无 |
| `money` | 对象, 见 [数值, 金额与大整数](#数值-金额与大整数) | `money` | 无 |
| `bigint` | 对象, 见 [数值, 金额与大整数](#数值-金额与大整数) | `bigint` | 无 |
| `boolean` | `type: boolean` | `switch` `checkbox` | 无 |
| `enum` 单选 | `enum` / `oneOf` / 单成员为 `const` | `select` `radio`; 单成员默认 `output`(只读) | 成员 |
| `enum` 多选(`multiple: true`) | `array` + `uniqueItems` | `select`(多选下拉) `checkbox` | 成员 |
| `date` `time` `datetime` | 由 `value_format` 决定, 见 [日期与时间](#日期与时间) | 与组件同名 | 无 |
| `url` `email` | `string` + `format` `uri` / `email` | 与组件同名 | 无 |
| `color` | `string` + `format: color` | `color` | 无 |
| `image` | `string` + `format: uri` | `image`(上传 + 预览) `input` | 无 |
| `file` | `string` + `format: uri` | `file`(上传) `input` | 无 |
| `object` | `type: object` | `page`(钻取) `inline` `json`; 根总是 `page` | 字段 |
| `array` | `type: array` | `list` `json`; `array_item: 'tuple'` 时为 `tuple` `json` | [体与内部类型](#体与内部类型) |
| `map` | `object` + `additionalProperties` | `kv` `json` | [体与内部类型](#体与内部类型) |
| `union` | `oneOf` / `anyOf` | `union`(分支下拉; `props: {selector: 'buttons'}` 且分支不超过 4 个时为分段按钮) | [体与内部类型](#体与内部类型) |
| `any` | `{}` | `json` | 无 |
| `jsontext` | `string` + `contentMediaType: application/json` | `json` | 字段, 或无 |

- 候选按数据形态判定, 比上表宽: 任意组件可选 `json` 与 `output`; 底层为字符串的组件之间 widget 互通, 都可选 `input` `textarea` `password` `richtext`, 带 `format: uri` 的另可选 `url` `image` `file`(如 `url[widget: 'input']` `jsontext[widget: 'textarea']`); 按 `value_format` 编译出 `x-valueFormat` 的日期组件可在 `date` `time` `datetime` 间互换(时间戳格式不能用 `time`). 判定以 `packages/core/src/syntax/shapes.ts` 的 `acceptsWidget` 为准, 语言服务补全的候选与它一致.
- 非法组合降级: 先定改变数据形态的键(`multiple` `array_item` `map_item` `union_item` `nullable` ...), 再按该形态判定 `widget`; 不接受时取默认, 编译器报 warning(JOTL1045). 未登记的扩展 widget 由语言服务报 warning, 运行时按降级链降级. 例: `enum[multiple: true, widget: 'radio']` 保留多选, `widget` 降为 `select`.
- 注册表按 (组件, `widget`) 解析: `checkbox` 在 `boolean` 与多选 `enum` 下是不同实现.
- `nullable` 是包在任意组件外的置空开关, 不是 `widget` 候选.
- 已移除: `textarea` `select{}` `radio{}` `checkbox{}` `json` 作为组件; 字面量类型与 `const` 写法; `T[]` 后缀数组; `A | B` 联合; `map<T>`; `x-ui.semantic`; `///` 文档注释; 文件开头 `[...]`.

## 体与内部类型

内部类型的键:

| 键 | 用于 | 取值 |
|---|---|---|
| `array_item` | `array` | 类型串; 或 `'tuple'` |
| `map_item` | `map` | 类型串 |
| `union_item` | `union` | 类型串, 至少两个名字 |
| `json_item` | `jsontext` | 类型串 |
| `item_meta` | 以上四种 | 内部类型的元数据; 类型串含多个名字时按名字分键: `{string: {...}, Link: {...}}` |
| `key_meta` | `map` | 键的约束, 只接受 `pattern` `minLength` `maxLength`, 编译为 `propertyNames` |
| `discriminator` | `union` | 区分字段名 |

类型串: `名字 { "|" 名字 }`, 名字为内置组件名或大驼峰类型名; 不含 `null`(可空写 `nullable`); 选择族 `enum` 不能出现在类型串中(多选写 `multiple`); 名字重复报错; 多于一个名字时按 [union](#union) 的 JSON 类型区分规则校验.

各组件的体:

| 组件 | 条件 | 体 |
|---|---|---|
| `object` | - | 字段 |
| `array` | 无 `array_item` | 元素对象的字段(字段名任意, 含 `*` `0`); 元素对象自身的元数据写 `item_meta` |
| `array` | `array_item: 'tuple'` | 位置条目 `0` `1` ...(从 0 连续), 可另有一个 `*` 表示其余元素; 编译为 `prefixItems` + `items`, 没有 `*` 时 `items: false`; `minItems` 取必填位置数 |
| `array` | `array_item: 类型串` | 无 |
| `map` | 无 `map_item` | 值对象的字段 |
| `map` | `map_item: 类型串` | 无 |
| `union` | 有 `discriminator` | 分支, [union](#union) |
| `union` | `union_item` | 无 |
| `enum` | - | 成员, [枚举](#枚举) |
| `jsontext` | 无 `json_item` | 解析后对象的字段(可为空体或省略体, 省略时内容为任意 JSON) |
| `jsontext` | `json_item: 类型串` | 无 |
| 其他 | - | 写体报错 |

- 嵌套数组: `array[array_item: 'array', item_meta: {array_item: 'number'}]`.
- 只有 `array_item: 'tuple'` 下 `*` 与数字键有特殊含义; 其余体中它们是普通字段键.

## 枚举

```ebnf
EnumMember = ( Ident | Number | String | "true" | "false" ) [ Label ] [ Meta ] [ "," | ";" ] ;
```

- 写法 `enum[元数据]{ a(甲) b(乙) }`; 成员间空白, 换行, `,` 或 `;` 分隔.
- 成员值: 标识符成员的值为同名字符串; 数字, 布尔, 引号字符串按字面量取值: `enum{ 1(一级) 2(二级) }`; 成员值重复报错.
- 裸 `null` 不能作成员, 报错(JOTL1046): 可空写 `nullable: true`; 要字符串 `"null"` 时写 `'null'`.
- 有任一标签或 `description` 时编译为 `oneOf: [{const, title, description}]`, 否则 `enum`; 单成员编译为 `const`.
- 全局选项: 先声明 `Cities(城市): enum{...}`, 字段写 `city: Cities`; 多选写 `cities: Cities[multiple: true]`.
- 多选: `multiple: true`, 值为成员值数组, 自动 `uniqueItems`, 默认可以一项都不选; `minItems` `maxItems` 作用于所选个数.
- 语法层不支持运行时选项源, 成员只能写在源码中; 渲染层契约中的 `Adapters.loadOptions` 只是预留给自定义 widget 的外部能力, 内置 widget 不调用它, 见 [x-ui 规范](x-ui.md).

## union

只接受两种:

1. 可区分联合: `union[discriminator: 'kind'] { text(文本): {...}  image(图片): ImageBlock }`
   - 分支的键是区分字段的取值, 标签为分支标题; 分支内容是对象体或对象类型引用.
   - 区分字段由编译器补为 `const`, 分支里不写; 编译为 `oneOf`.
   - 数据: `{ "kind": "text", "content": "..." }`.
2. 按 JSON 类型区分: `union[union_item: 'number|string', item_meta: {string: {pattern: '^\\d+%$'}}]`
   - 各分支的 JSON 类型(string number boolean array object)互不相同, 各至多一个; `money` `bigint` 按自身 `type` 字段区分, 不占 object 名额.
   - 同为一种 JSON 类型的分支(`email|url`)编译报错, 提示改用可区分联合.
   - 编译为 `anyOf`.

- `null` 不进联合, 可空一律写 `nullable: true`.
- 渲染: 左侧用下拉选分支(`props: {selector: 'buttons'}` 且分支不超过 4 个时为分段按钮), 右侧是当前分支内容, 空间不足时换行(见 [HTML 组件约定](html-widgets.md)); 切换时用新分支默认值替换, 各分支最后一次的值在本次编辑中缓存, 切回恢复.

## 可空, 必填与空值

| 含义 | 写法 |
|---|---|
| 可以不存在(`undefined`) | `key?:` 或光秃 `key(标签)` |
| 可以为 `null` | `nullable: true` |
| 字符串不能为空串 | `minLength: 1`(默认允许空串) |
| 数组, 多选不能为空 | `minItems: 1`(默认允许空数组) |

- 默认允许空: 字符串类不加 `minLength`, 数组与多选不加 `minItems`; 要禁止空串或空数组时写 `minLength: 1` / `minItems: 1`. 带 `format` 的字符串组件由格式本身拒绝空串.
- 渲染器: 选填字段被清空时删除该键, 不写空串或空数组; `nullable` 字段另有置空开关.

## 元数据键

| 键 | 取值 | 编译到 | 适用 |
|---|---|---|---|
| `description` | 字符串 | `description` | 任意条目, 枚举成员 |
| `default` | JSON 值 | `default`; 编译期按约束校验, 含 `schema` 写入的约束与常用 `format`(`email` `uri` `date` `date-time` `time` `uuid` `color` `ipv4` `ipv6` `hostname`) | 任意 |
| `minLength` `maxLength` `pattern` `format` | 同 JSON Schema | 同名 | 字符串类, 底层为字符串的扩展组件 |
| `minimum` `maximum` `exclusiveMinimum` `exclusiveMaximum` | 数字; `money` `bigint` 上为字符串 | 同名; `money` `bigint` 上为 `x-decimalRange` | 数值, 底层为数值的扩展组件 |
| `decimals` | 非负整数 | `x-decimals` | `number`, `money`, 底层为 `number` 的扩展组件 |
| `minItems` `maxItems` `uniqueItems` | 整数 / 布尔 | 同名 | `array`, 多选(含指向枚举的引用加 `multiple`), 底层为 `array` 的扩展组件 |
| `minProperties` `maxProperties` | 整数 | 同名 | `object` `map`, 底层为 `object` 的扩展组件 |
| `examples` | 数组 | `examples` | 除引用类型 |
| `deprecated` | `true` 或原因字符串 | `deprecated: true` + `x-deprecatedReason` | 任意 |
| `readOnly` | 布尔 | 同名 | 任意 |
| `writeOnly` | 布尔 | 同名 | 除引用类型 |
| `errorMessage` | 字符串, 或 关键字 → 文案 | `errorMessage` | 除引用类型 |
| `comment` | 字符串 | `$comment` | 除引用类型 |
| `closed` | 布尔 | `additionalProperties: false` | `object` |
| `nullable` | 布尔 | 类型加 `null` | 任意 |
| `multiple` | 布尔 | [枚举](#枚举) | `enum`, 指向枚举的引用 |
| `array_item` `map_item` `union_item` `json_item` `item_meta` `key_meta` `discriminator` | [体与内部类型](#体与内部类型), [union](#union) | - | [体与内部类型](#体与内部类型) |
| `currency` `unit` | [数值, 金额与大整数](#数值-金额与大整数) | `money` 的属性 schema | `money` |
| `value_format` | [日期与时间](#日期与时间) | `format` 或 `x-valueFormat` | `date` `time` `datetime` |
| `thousands` | 布尔 | `x-ui.thousands` | `number` `integer` `money` `bigint` |
| `widget` | widget 名, [内置组件](#内置组件) 中的候选或已登记的扩展 widget | `x-ui.widget` | 任意 |
| `props` | 对象 | `x-ui.props` | 任意 |
| `decorator` | 外壳 widget 名或 `false` | `x-ui.decorator` | 任意 |
| `hidden` | 布尔 | `x-ui.hidden` | 任意 |
| `order` | 字段名数组 | `x-ui.order` | `object` |
| `groups` | `[{title, fields}]`, 每个字段最多出现在一个分组中一次 | `x-ui.groups` | `object` |
| `layout` `columns` | `'stack' \| 'tabs' \| 'grid'`, 不小于 1 的整数 | `x-ui.layout` `x-ui.columns` | `object`, 只在 `widget: 'page'` / `'inline'` 下生效; `columns` 必须与 `layout: 'grid'` 一起写, 否则报 JOTL1017 |
| `summary` | 字段名 | `x-ui.summary` | `object`, 指向对象的引用, 元素为对象的 `array` / `map`; 元素确定不是对象时报 warning(JOTL1049) |
| `root_if` `node_if` | 条件, [条件](#条件) | `x-ui.visibleIf` | 任意 |
| `variants` | 场景名 → 覆盖对象 | `x-ui.variants` | 任意 |
| `rules` | 规则数组 `[{match, ui}]` | 根 `x-ui.rules` | 只在根条目 |
| `id` | URI 字符串 | 根 `$id` | 只在根条目 |
| `widgets` | 名字 → 底层类型或模块声明, 见 [条目](#条目) 的扩展组件 | 本文件登记扩展组件; 模块声明写入根 `x-ui.widgets` | 只在根条目 |
| `schema` | JSON 对象 | 原样合并, 冲突时以它为准并报 warning | 任意 |
| `x_*` | JSON 值 | `x-` 加驼峰(`x_biz_code` → `x-bizCode`) | 任意 |

- 标题不进元数据, 只由标签表达.
- `variants` 内的覆盖对象与 `rules` 各规则的 `ui` 用 `x-ui` 字段名, 条件写 `root_if` / `node_if`(编译为 `visibleIf`, 也接受直接写 `visibleIf`).
- `x-ui.version` 由编译器在根自动写入, 作者不写.
- v1(凤蝶)别名(`min` `max` `regExp` `errorMsg` ...)不进解析器, 由迁移工具转换.

## 数值, 金额与大整数

- `number` / `integer` 共用数字框; `decimals` 指定小数位, `integer` 固定为 0, `number` 默认不限; 按它设 `step`, 失焦舍入; 校验编译为 `x-decimals`, 由 ajv 自定义关键字按十进制位数检查, 不用 `multipleOf`.
- 精确数字符串: `^-?\d+(\.\d+)?$`, 只禁止指数, 千分位, 空白.
- `money` 的值: `{ type: 'money', value, currency, unit? }`
  - `value` 为精确数字符串; 没有 `unit` 时为主单位, 小数位定长, 默认取 ISO 4217 位数(CNY USD 2, JPY 0); 有 `unit` 时默认不限; `decimals` 都可覆盖.
  - `currency` 为 ISO 4217 代码, 总是存入数据; 元数据 `currency: 'CNY'` 固定(编译为 `const`), `currency: ['CNY', 'USD']` 可选(编译为 `enum`, 首个为默认).
  - `unit` 由业务定义, 只校验为字符串, 原样透传; 元数据 `unit: 'fen'` 固定, `unit: ['yuan', 'fen']` 可选, 不写则不显示单位选择.
- `bigint` 的值: `{ type: 'bigint', value }`, `value` 为 `^-?\d+$`.
- 范围: `money` `bigint` 上的 `minimum` `maximum` 写字符串, 编译为 `x-decimalRange` 作用于 `value`, 按精确数比较; 默认不限正负.
- 运算: `@jotl/form/core` 依赖 `big.js`, 提供 `toBig(x): Big` 与 `fromBig(b, template, decimals?)`; 不提供单位换算.
- 千分位: 存储值永远不含千分位; 聚焦时显示原值, 失焦与只读时显示带千分位的值, 不在输入时实时插入; 键入与粘贴时去掉 `,` `，` 空格 `_` 再校验, 不合法时保留草稿并提示; 对字符串整数部分按 3 位插 `,`, 不经过 `Number` / `Intl`; 固定 `,` 分组 `.` 小数点; `thousands` 开关, `money` 默认开, `number` `integer` `bigint` 默认关; `money` `bigint` 与开了千分位的 `number` `integer` 用 `<input type="text">`, 小数位为 0 时(`integer` `bigint` 或 `decimals: 0`) `inputmode="numeric"`, 否则 `decimal`.
- TS 输出: `{ type: 'money'; value: string; currency: 'CNY'; unit?: string }`, `{ type: 'bigint'; value: string }`.

## 日期与时间

`date` `time` `datetime` 分别渲染为 `<input type="date">` `<input type="time">` `<input type="datetime-local">`; 存储格式由元数据 `value_format` 决定.

| 组件 | 原生值 | 默认 `value_format` | 默认存储示例 |
|---|---|---|---|
| `date` | `2026-10-13` | `YYYY-MM-DD` | `2026-10-13` |
| `time` | `09:30`, 设了 step 时 `09:30:15` | `HH:mm:ss` | `09:30:15` |
| `datetime` | `2026-10-13T09:30`(无时区) | `iso` | `2026-10-13T09:30:15+08:00` |

`value_format` 取值:

- dayjs 格式串(`YYYYMMDD` `YYYY-MM-DD HH:mm:ss` `HH:mm` ...); 不含时区的按浏览器本地时区解释与写回; 校验时严格解析.
- `x` 毫秒时间戳, `X` 秒时间戳, 值为整数; `time` 不能用; `date` 取当天本地零点.
- 别名, 读取时接受任意合法 RFC 3339 date-time(带不带毫秒, `Z` 或 `±HH:mm`), 写回时统一:

| 别名 | 示例(北京时间 09:30:15) | 写回实现 |
|---|---|---|
| `iso` | `2026-10-13T09:30:15+08:00` | `dayjs(v).format()` |
| `iso-x` | `2026-10-13T09:30:15.000+08:00` | `iso` 的结果在偏移前插入 `.` 与 `dayjs(v).format('SSS')` |
| `utc` | `2026-10-13T01:30:15Z` | `utc-x` 的结果去掉毫秒 |
| `utc-x` | `2026-10-13T01:30:15.000Z` | `dayjs(v).toISOString()` |

别名也可用于 `date` `time`: 值为按别名写回的完整日期时间串, 编译时归入下表 "其他" 一行.

编译:

| `value_format` | JSON Schema |
|---|---|
| `date` 的 `YYYY-MM-DD`(默认) | `{type: string, format: date}` |
| `datetime` 的四个别名(默认 `iso`) | `{type: string, format: date-time}`, 不是 `iso` 时另写 `x-valueFormat` |
| `x` / `X` | `{type: integer, minimum: -MAX_SAFE_INTEGER, maximum: MAX_SAFE_INTEGER, x-valueFormat}` + `x-ui.widget` 为组件名 |
| 其他(含 `time` 默认 `HH:mm:ss`) | `{type: string, x-valueFormat}` + `x-ui.widget` 为组件名 |

- 标准 `format: time` 要求带时区, 所以 `time` 默认不再编译为它; 已有的 `format: time` 按普通字符串打印为 `string[format: 'time']`.
- 格式串含 `Z` 时接受任意偏移, 读入后按本地时区显示; 写回时用本地偏移.
- `value_format` 用在其他组件上报 `JOTL1007`; `time` 用 `x` / `X` 报 `JOTL1020`; 数据不符合存储格式报 `JOTL4025`.
- 编译期按 `value_format` 检查 `default`, 不符报 `JOTL1008`: 时间戳要求整数, 别名按 RFC 3339, 格式串严格逐位匹配并校验日历日期; 格式串只检查 `YYYY MM DD HH mm ss SSS Z ZZ A a` 与 `[..]` 转义, 含其他记号时不检查.

## 条件

```jotl
a?: string[root_if: {left: 'mode', op: 'eq', right: 'dark'}]
b?: string[node_if: {left: 'type', op: 'in', right: ['paid', 'vip']}]
c?: string[root_if: {and: [{left: 'list[*].on', op: 'truthy'}, {not: {left: 'a.b[0]', op: 'eq', right: 1}}]}]
d?: string[node_if: 'href']
```

- 叶子 `{left: 路径, op, right?}`; `op`: `eq` `ne` `in` `not_in` `gt` `gte` `lt` `lte` `truthy` `falsy`, 后两个不写 `right`.
- 组合 `{and: [...]}` `{or: [...]}` `{not: 条件}`; 直接写路径字符串等价 `{left: 路径, op: 'truthy'}`.
- 路径为 lodash `get` 语法(`a.b[0].c` `a['x-y']`), `[*]` 取当前节点所在数组的对应下标; `root_if` 另接受 `$.` 前缀.
- 基准: `root_if` 从数据根, `node_if` 从字段所在对象; 不支持向上引用.
- 编译为 `x-ui.visibleIf`([x-ui 规范](x-ui.md) 的条件格式):

| 写法 | 编译为 |
|---|---|
| `left` 路径 | `field`: JSON Pointer(`[*]` 保留为 `*` 片段); `node_if` 另加 `base: "node"` |
| `op: 'eq'` `'ne'` `'in'` `'gt'` `'gte'` `'lt'` `'lte'` | 同名键, 值为 `right` |
| `op: 'not_in'` | `notIn`, 值为 `right` |
| `op: 'truthy'` / 路径字符串 | `truthy: true` |
| `op: 'falsy'` | `truthy: false` |
| `{and: [...]}` `{or: [...]}` `{not: 条件}` | `{all: [...]}` `{any: [...]}` `{not: 条件}` |
| 同时写 `root_if` 与 `node_if` | `{all: [根条件, 节点条件]}` |

- 只控制显示, 不控制必填与只读.

## 编译与打印

- 编译结果满足下文 [规范化规则](#规范化规则).
- `print` 输出规范形: 单引号字符串, 能不加引号的键不加, 各段紧贴, 一行一个条目, 无分隔符; 默认的 `widget` 不写出; 无法表达的关键字经 `schema: {...}` 写出; 组件名按 JSON Schema 与 `widget` 还原(`string` + `widget: 'textarea'` 还原为 `text`); 经 `schema` 写出的 `$ref` 随类型改名与内联根移入 `$defs/<根名>` 改指; 根 `x-ui.widgets` 写回根条目的 `widgets`(模块声明形态, 有 `base` 时一并写回; 与类型名重名或取值不合法时报 JOTL1032 并忽略); 输出嵌套超过 256 层, 或输入 JSON 嵌套超过 1024 层时不输出源码, 报 JOTL1029.
- v0 写法(`export type X = ...`, `@注解`, `= v`, `Enum` `Image` 等大写语义类型)不再接受; v0 源码先用旧版编译器编译, 再用 `print` 打印即得到 v1 源码.

## 诊断

代码与消息文本见 `packages/core/src/syntax/diagnostics.ts` 的 `SYNTAX_DIAGNOSTICS`; 下表按情形归类.

| 级别 | 代码 | 情形 |
|---|---|---|
| error | JOTL1001 JOTL1018 JOTL1019 JOTL1022 JOTL1023 JOTL1026 | 词法: 非法字符与未知 `<...>` 记号; 字符串缺结束引号; 块注释未闭合; 未知转义或字符串中的控制字符; 数字写法不合法(含 `Infinity` `NaN`); 标签为空 |
| error | JOTL1002 JOTL1003 JOTL1040 | 语法: 此处应为另一种记号; 缺右括号; 冒号后有内容却省略冒号 |
| error | JOTL1036 JOTL1037 JOTL1038 JOTL1039 JOTL1015 JOTL1028 | 顶层: 顶层名不是大驼峰; 顶层写 `?`; 标识写在体内; 标识重复; 类型名重复; 类型名与扩展组件(含根元数据 `widgets` 声明的)重名 |
| error | JOTL1004 JOTL1006 JOTL1014 JOTL1041 JOTL1044 JOTL1047 | 组件: 未知组件; 未声明的类型或未登记的扩展组件; 保留字 `import` `export` `from`; 不允许体的组件写了体; 引用类型带体; 写法不完整(如 `union` 缺 `discriminator` 与 `union_item`) |
| error | JOTL1005 JOTL1024 JOTL1025 JOTL1046 | 体与键: 同一体或同一元数据内键重复; 枚举值重复; 枚举没有成员; 体中条目不合法(枚举成员写 `?` `:` 或裸 `null`, 元组位置, union 分支写法等) |
| error | JOTL1011 JOTL1007 JOTL1012 JOTL1020 JOTL1017 | 元数据: 未知键; 键不适用于该组件; 键不能用在此处(只能写在根, 需要 `multiple`, `schema` 写入保留关键字等); 取值不合法; `x-ui` 相关取值不合法(`order` `groups` `layout` `columns` `summary` 条件 `variants` `rules`, 空 `widget`) |
| error | JOTL1042 JOTL1043 JOTL1008 JOTL1029 | 类型串不合法(含 `null` `enum`, 名字重复或为空); 按 JSON 类型区分的联合有同类分支; `default` 不满足约束; 嵌套超过上限 |
| warning | JOTL1045 JOTL1016 JOTL1048 JOTL1049 JOTL1050 | `widget` 不接受该数据形态(降级为默认); `schema` 与生成结果冲突; `format` 覆盖组件自带的格式(如 `image[format: 'email']`, 以元数据为准); `summary` 用在元素不是对象的 `array` / `map` 上; `schema` 写入的 `x-ui` 不符合 x-ui meta-schema 或含根专属字段 `version` `rules` `widgets`(原样写入, 不阻断) |
| error | JOTL1030 JOTL1031 JOTL1035 | `print`: 输入不是 JSON Schema; 含非 JSON 值; `rootName` 不是大驼峰 |
| warning | JOTL1032 JOTL1033 JOTL1034 JOTL1051 | `print`: 关键字无法表达已忽略; 布尔 schema 按等价对象打印; 类型名不合法已改名; 选项 `defaultExport` 不是 `$defs` 的键已忽略 |

## 规范化规则

编译器, 打印器与各转换模块输出的 schema 都满足以下规则, 读取时可以假定已满足; 例外: `@jotl/convert` 的版本升级不执行规则 2, 嵌套 `$defs` 保留原位(提到根会改变 `$ref` 的解析):

1. 根对象带 `$schema: "https://json-schema.org/draft/2020-12/schema"`.
2. 命名类型只出现在根的 `$defs` 中.
3. 带标签或说明的枚举(至少一个成员有标签或 `description`)统一为 `oneOf: [{ const, title?, description? }]`; 其余多值枚举为 `enum`, 单值为 `const`.
4. 枚举, `oneOf` 枚举与 `const` 外层带 `type`: 成员 JSON 类型唯一时为字符串, 否则为类型数组; 整数值的 JSON 类型记为 `integer`, 其余数值为 `number`.
5. 空 schema `{}` 保持对象形式, 不改写为 `true`.
6. `required` 按声明顺序排列, 为空时省略.
7. 对象关键字顺序: `$schema $id $ref $comment title description type const enum oneOf anyOf format contentMediaType` → 各类约束 → `properties required additionalProperties prefixItems items uniqueItems` → `default examples deprecated readOnly writeOnly x-ui x-deprecatedReason $defs`; 未列出的关键字按字母序排在 `x-ui` 之前. 顺序只影响输出可读性, 比较 schema 时按深度相等.

规则 7 的实现是 `@jotl/core` 的 `orderKeywords`.
