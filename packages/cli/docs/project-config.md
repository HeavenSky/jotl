# Register project components

**English** · [简体中文](../zh/docs/project-config.md)

After reading this page you can compile Jotl that uses your project's own components, and control which `jotl.config.json` each command reads. You need `jotl` installed as in the [quick start](../README.md).

## Register a component

A `jotl.config.json` next to your sources registers extension components under `widgets`. This one registers `ImagePicker` with the underlying type `url`:

```json
{ "widgets": { "ImagePicker": "url" } }
```

A Jotl file can now use `ImagePicker` in component position:

```jotl
Home: {
  logo: ImagePicker
}
```

`jotl compile home.jotl` compiles `logo` to `{ "type": "string", "format": "uri", "x-ui": { "widget": "ImagePicker" } }`. Without the registration the same command fails:

```console
$ jotl compile home.jotl --no-config
home.jotl:2:9 JOTL1006 error: `ImagePicker` is neither a type declared in this file nor a registered extension component
```

The value of each entry can be a JSON Schema primitive type name, a body-less built-in component name, a schema object, or a module declaration `{ base?, module, export? }`. UpperCamelCase names become extension components; other names are registered as widget names only. The full format is under extension components in the "Entries" section of the [Jotl language specification](../../../docs/spec/jotl.md#entries); the VS Code extension and the language server read the same file.

## Which commands read it

`compile`, `convert`, `check`, `validate` and `defaults` read the configuration when their input is Jotl. JSON Schema and TS input never read it, and neither do `format` (it only lays out source) and `migrate-schema`.

## How the file is found

For each Jotl source file, `jotl` looks for the nearest `jotl.config.json`, starting in the file's directory and moving up. The search stops at a directory that contains `.git`, or at the file system root. Stdin input (`-`) starts from the current directory.

Two options override the search:

| Option | Effect |
|---|---|
| `--config <file>` | Use this file for every source; no search |
| `--no-config` | Read no configuration |

Using both is usage error `JOTL9017`.

## When the configuration is broken

A broken configuration stops every source file that uses it from compiling, and the command exits with `1`. Each configuration file is read once per invocation, so its problems are reported once.

| Code | Meaning |
|---|---|
| `JOTL9050` | The file cannot be read |
| `JOTL9052` | The file is not valid JSON |
| `JOTL9056` | An entry is invalid; located at the offending key in the configuration file |

```console
$ jotl compile home.jotl --config bad.config.json
bad.config.json:1:16 JOTL9056 error: invalid config file: base type of `ImagePicker` must be a JSON Schema primitive type name, a body-less Jotl built-in component name, a schema object, or a module declaration `{base?, module, export?}`
```
