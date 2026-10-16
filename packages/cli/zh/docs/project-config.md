# 登记项目组件

[English](../../docs/project-config.md) · **简体中文**

读完本页，你能编译用到项目自有组件的 Jotl，并控制每个命令读取哪个 `jotl.config.json`。前提是已按[快速开始](../README.md)装好 `jotl`。

## 登记一个组件

在源码旁放一个 `jotl.config.json`，在 `widgets` 下登记扩展组件。下面把 `ImagePicker` 登记为底层类型 `url`：

```json
{ "widgets": { "ImagePicker": "url" } }
```

之后 Jotl 文件就能在组件位置写 `ImagePicker`：

```jotl
Home: {
  logo: ImagePicker
}
```

`jotl compile home.jotl` 把 `logo` 编译为 `{ "type": "string", "format": "uri", "x-ui": { "widget": "ImagePicker" } }`。没有登记时，同一命令会失败：

```console
$ jotl compile home.jotl --no-config
home.jotl:2:9 JOTL1006 错误: `ImagePicker` 既不是本文件声明的类型, 也不是已登记的扩展组件
```

每一项的值可以是 JSON Schema 基本类型名、无体的内置组件名、schema 对象，或模块声明 `{ base?, module, export? }`。大驼峰名成为扩展组件，其余名字只登记为 widget 名。完整格式见 [Jotl 语法规范](../../../../zh/docs/spec/jotl.md#条目)「条目」一节中的扩展组件；VS Code 插件与语言服务读的是同一个文件。

## 哪些命令会读

`compile`、`convert`、`check`、`validate` 与 `defaults` 在输入为 Jotl 时读取配置。JSON Schema 与 TS 输入不读；`format`（只排版）与 `migrate-schema` 也不读。

## 怎么找到配置文件

对每个 Jotl 源文件，`jotl` 从文件所在目录开始向上找最近的 `jotl.config.json`，到含 `.git` 的目录或文件系统根为止。stdin 输入（`-`）从当前目录开始找。

两个选项可以替代查找：

| 选项 | 效果 |
|---|---|
| `--config <file>` | 所有源文件都用这个文件，不再查找 |
| `--no-config` | 不读任何配置 |

两者同用报用法错误 `JOTL9017`。

## 配置有误时

配置有误时，用到它的源文件都不编译，命令以 `1` 退出。同一个配置文件在一次调用中只读一次，问题也只报一次。

| 代码 | 含义 |
|---|---|
| `JOTL9050` | 文件读不到 |
| `JOTL9052` | 不是合法的 JSON |
| `JOTL9056` | 某一项不合法；位置为配置文件中出错的键 |

```console
$ jotl compile home.jotl --config bad.config.json
bad.config.json:1:16 JOTL9056 错误: 配置文件不合法: `ImagePicker` 的底层类型必须是 JSON Schema 基本类型名, 无体的 Jotl 内置组件名, schema 对象或模块声明 `{base?, module, export?}`
```
