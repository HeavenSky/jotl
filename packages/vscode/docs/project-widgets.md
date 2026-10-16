# Register project widgets

**English** · [简体中文](../zh/docs/project-widgets.md)

After this page, the widgets your project adds are completed and checked in `.jotl` files like the built-in ones, with the underlying type you choose. You need the extension installed (see the [quick start](../README.md#get-a-live-preview-in-three-steps)).

## Declare widgets in `jotl.config.json`

A `jotl.config.json` gives each widget a name and an underlying type, and the `jotl` command line reads the same file, so the editor and your build agree.

1. Create `jotl.config.json` next to your `.jotl` files or in any parent folder:

   ```json
   { "widgets": { "ImagePicker": "url", "tag-list": "array", "headline": "string" } }
   ```

   The file itself gets completion and validation, and open `.jotl` files are re-checked as soon as you save it.

2. Use the widgets in a `.jotl` file:

   ```jotl
   Article: {
     cover: ImagePicker
     title: string[widget: 'headline']
   }
   ```

   `cover` compiles with the underlying type of `ImagePicker`, and `headline` no longer triggers the unregistered-widget warning `JOTL7001`.

## What you can write in the config

- **PascalCase names are extension widgets**: you can write them in the type position, as `cover: ImagePicker` does. Other names only register a `widget` name.
- An underlying type is a JSON Schema type name (`string`, `number`, `integer`, `boolean`, `array`, `object`), a built-in Jotl widget name that takes no body (not `enum` or `union`), or a schema object used as is.
- An object with a `module` key declares a React module as well; see [Load widget modules in the preview](widget-modules.md).
- The file has only two keys, `widgets` and `$schema`. Invalid entries are skipped and reported as `JOTL7002` at the top of every `.jotl` file that uses the config.

Each `.jotl` file uses the nearest `jotl.config.json` found by walking up from its folder, stopping at the folder that contains `.git` or at the file system root. For the full rules, including which constraint keys an extension widget accepts, see the extension widget rules in the "Entries" section of the [Jotl language specification](../../../docs/spec/jotl.md#entries).

## Register names with the `jotl.registeredWidgets` setting

Use the setting when you only need names, for example for widgets your form host registers at runtime. It is a list of strings and defaults to `[]`:

```json
{ "jotl.registeredWidgets": ["headline", "tag-list", "ImagePicker"] }
```

- Listed names appear in `widget: '` completions and no longer report `JOTL7001`.
- PascalCase names can also be written in the type position; they compile as `string`.
- When a name is in both places, `jotl.config.json` wins: the setting only adds names, never types.

Changes to the setting or the config file take effect immediately; you do not need to reload the window.
