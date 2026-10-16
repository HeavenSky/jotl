# 在脚本与 CI 中使用 jotl

[English](../../docs/scripting.md) · **简体中文**

读完本页，你能让 CI 任务按 `jotl` 的结果决定成败，逐行解析诊断，固定输出语言，并在 Node 里直接调用而不必另起进程。前提是已按[快速开始](../README.md)装好 `jotl`。

## 按退出码判定任务成败

**退出码决定任务该不该失败**：警告与提示从不影响它。

| 退出码 | 含义 |
|---|---|
| `0` | 成功；仍可能输出警告与提示 |
| `1` | 至少有一条错误级诊断，含文件读写失败与内部错误（`JOTL9099`） |
| `2` | 用法错误：未知命令或选项、缺少或非法的取值、互斥的选项 |

典型的 CI 步骤是检查全部 schema 并校验样例数据：

```sh
jotl check schemas/*.jotl
jotl validate schemas/home.jotl fixtures/home/*.json
```

## 解析诊断

结果写到 stdout，诊断写到 stderr，一条一行：

```text
<file>:<line>:<column> <code> <severity>: <message>
<file>#<JSON Pointer> <code> <severity>: <message>
```

- 有源码位置时用第一种，只有 JSON Pointer 时用第二种。行列从 1 起，列按 UTF-16 代码单元计。
- 级别在中文输出中为 `错误`、`警告`、`提示`，英文输出中为 `error`、`warning`、`info`。
- 多行消息与相关位置接在后续行，以两个空格缩进。要一行取一条诊断，只取不以空格开头的行。
- 从 stdin 读入的输入写作 `-`。用法错误的位置写作 `jotl`，下一行提示该运行哪个 `--help`。

```console
$ jotl compile
jotl JOTL9006 错误: 缺少参数 <file.jotl>
运行 `jotl compile --help` 查看用法
```

代码说明问题出在哪个环节：

| 代码 | 来源 |
|---|---|
| `JOTL9001`-`JOTL9017` | 命令行用法错误（退出码 `2`） |
| `JOTL9050`-`JOTL9056` | 读取文件与输入：文件读写失败、JSON 不合法、schema 版本回落、没有默认数据、迁移输入的判定、`jotl.config.json` 不合法 |
| `JOTL9099` | `jotl` 内部错误；下一行请你报告问题 |
| `JOTL0xxx`、`JOTL1xxx` | `@jotl/core`：JSON Pointer 与 Jotl 编译 |
| `JOTL2xxx`、`JOTL3xxx`、`JOTL8xxx` | `@jotl/convert`：TS 转换、JSON Schema 升级、凤蝶迁移 |
| `JOTL4xxx` | `@jotl/data`：校验与默认数据 |

命令行自身的代码表以 `CLI_DIAGNOSTICS` 导出。

## 选择输出语言

帮助、诊断消息、级别标签、结论行与生成文字（如 TS 文件头）按中文或英文输出。CI 里最好固定语言，日志解析就不受运行机器的语言环境影响。

- `--lang <zh|en>`（也可写 `--lang=en`）可写在 `--` 之前的任意位置，接受 `zh-CN`、`zh_CN`、`en-US` 等地区写法，不区分大小写。多次出现时以最后一次为准；其他取值报用法错误 `JOTL9005`。
- 不写 `--lang` 时，取 `JOTL_LANG`、`LC_ALL`、`LC_MESSAGES`、`LANG` 中第一个非空值：以 `zh` 开头（如 `zh_CN.UTF-8`）为中文，其余（含 `C` 与 `POSIX`）为英文。都为空时输出英文。

```sh
jotl check home.jotl --lang en
JOTL_LANG=en jotl validate form.schema.json data.json
```

## 在代码中调用 jotl

`run(argv, io, options?)` 执行一次调用并返回退出码，不调用 `process.exit`。`createNodeIo()` 返回基于 Node 进程与文件系统的实现。

```ts
import { createNodeIo, run } from "@jotl/cli";

process.exitCode = run(["check", "home.jotl"], createNodeIo(), { env: process.env });
```

- 输出语言先取 `argv` 中的 `--lang`，再取 `options.env`（解析规则同[选择输出语言](#选择输出语言)，另导出 `localeFromEnv(env)`）。不给 `env` 时沿用 `@jotl/core` 当前的全局语言。`run` 在调用期间写入全局语言，结束后恢复为调用前的值。
- `io` 是 `CliIo`：`cwd`、`stdout`、`stderr`、`readFile`、`readStdin`、`writeFile`、`exists` 与 `isSameFile`。测试时注入内存实现即可；查找 `jotl.config.json` 以及在 `.git` 处停止，都经由 `exists` 判断。
- 其余导出：`EXIT_CODES`（`{ ok: 0, error: 1, usage: 2 }`）、`COMMAND_NAMES`、`CLI_DIAGNOSTICS`，以及按上面的行格式格式化单条诊断的 `formatDiagnostic`。
