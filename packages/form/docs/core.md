# Build a renderer with `@jotl/form/core`

**English** · [简体中文](../zh/docs/core.md)

This page shows how to use the subpath `@jotl/form/core` to build a Jotl renderer or widget package for another UI framework, or to query from a tool (such as the language service) which widget a schema node gets. It does not depend on React; install `@jotl/form` without `react` if you only use this subpath. This package's React renderer and default HTML widgets are built on it.

## Plan a schema

```ts
import { BUILTIN_WIDGETS, createRegistry, evaluateCondition, plan } from '@jotl/form/core';

const schema = {
  type: 'object',
  properties: {
    title: { type: 'string', title: '标题', 'x-ui': { widget: 'headline' } },
    kind: { enum: ['a', 'b'] },
    extra: { type: 'string', 'x-ui': { visibleIf: { field: '/kind', eq: 'b' } } },
  },
  required: ['title'],
};

// A component package usually registers one implementation per built-in component name; here the name itself is a placeholder.
const registry = createRegistry(
  Object.entries(BUILTIN_WIDGETS).map(([name, { level }]) => ({ name, level, component: name }))
);

const { value: root, diagnostics } = plan(schema, registry);
// root.widget === "form", and its only child is the data root, with widget "page".
// /title: headline is not registered, falls back to "input", degraded is [{ reason: "F1", from: "headline" }].
// diagnostics: [JOTL5001 warning].
// /kind: an enum (with at least 2 options) defaults to "select"; when x-ui.widget names a built-in this shape does not accept (e.g. "switch"), it falls back to "select" via F2.

const extra = root!.children[0]!.children.find(c => c.dataPath === '/extra')!;
evaluateCondition(extra.visibleIf!, { kind: 'b' }, extra.dataPath); // true
```

- The render plan is a template tree (`RenderPlanNode`) that does not depend on data: array indexes are written as `*`, and your renderer decides the number of array elements and the active branch of a union from the data.
- `summary` (objects, arrays, maps) and `thousands` (`number` `money` `bigint`; `true` by default for `money`) on nodes come from the merged `x-ui`, for drill-down entry rows and numeric widgets.
- Values, validation and defaults are not part of `core`; this package's React renderer uses `@jotl/data` for them.
- A widget package should provide an implementation for every name in `BUILTIN_WIDGETS`; the props each level receives are described in [Write a widget](widget-contract.md).

## Pick the function you need

The signatures are in the type declarations; this table says what each export is for.

| Export                                                                                                                  | Purpose                                                                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createRegistry(registrations?, parent?)`                                                                               | Creates a registry; passing `parent` is the same as `parent.extend()`. In `list()` this level's registrations come first, and on equal matcher scores the earlier one wins                                                                                                                                                                                                                                  |
| `plan(schema, registry, options?)`                                                                                      | Returns `Result<RenderPlanNode>`. With an empty `schemaPointer` (default) the root node is the view widget `form`; with a pointer to a child node, planning starts at that node, for on-demand planning at render time                                                                                                                                                                                      |
| `expand(node, schema, registry, ctx?)`                                                                                  | Expands a node marked `lazy: true` and returns `Result<RenderPlanNode>`. Scene, mode and `maxDepth` from `ctx` take precedence, then the values `plan()` used when it produced the node in the same process, then defaults                                                                                                                                                                                  |
| `resolvePlanNode(node, schema)`                                                                                         | The effective schema (`ResolvedNode`) of a plan node, the same one `plan()` used to decide the shape, including branches split from a `type` array and the empty element schema of arrays without `items`. A node that was copied or serialized is resolved by its `schemaPointer`                                                                                                                          |
| `resolveSchemaAt(schema, pointer)` `resolveSchema(document, schema, pointer?)`                                          | The effective schema: in-document `$ref` (`#` and `#/...`) is shallow-merged from far to near into the referencing site, and `allOf` members are merged. `origin` gives the schema location of each keyword and `unresolvedRef` the reference that could not be resolved. `resolveSchemaAt` caches by document and pointer and returns an empty schema for a missing pointer                                |
| `evaluateCondition(cond, data, dataPath)`                                                                               | Evaluates `visibleIf` against data. `dataPath` is the actual path, and `*` in a condition's `field` takes the token at the same position from it; for leaves with `base: "node"`, `field` is relative to the object containing the node; `gt` `gte` `lt` `lte` only compare numbers                                                                                                                         |
| `jsonEqual(a, b)`                                                                                                       | Deep equality of JSON values, as used in condition comparisons                                                                                                                                                                                                                                                                                                                                              |
| `resolveXUi(schema, schemaPointer?, options?)`                                                                          | Returns `Result<ResolvedXUi>`: the merged `x-ui` at a location, the candidate widgets of each layer, the matched root `rules`, the chosen widget and fallbacks. Without `registry` it assumes every widget name is registered. For language services and debug views                                                                                                                                        |
| `checkXUi(value)`                                                                                                       | Structural `x-ui` check without Ajv; returns the first problem or `undefined`. Same rules as `xUiMetaSchema` of `@jotl/core`                                                                                                                                                                                                                                                                                |
| `matchBuiltinWidget(schema, document?)`                                                                                 | The built-in widget name from the schema shape alone, ignoring `x-ui` and the registry                                                                                                                                                                                                                                                                                                                      |
| `builtinAccepts(name, schema, document?)`                                                                               | Whether a built-in widget name can handle the data shape; `undefined` for names that are not built in                                                                                                                                                                                                                                                                                                       |
| `BUILTIN_WIDGETS` `FORMAT_WIDGETS`                                                                                      | Built-in widget names with their levels, and the mapping from `format` to widget name                                                                                                                                                                                                                                                                                                                       |
| `decimalKind(schema)` `RICH_TEXT_MEDIA_TYPE` `JSON_TEXT_MEDIA_TYPE` `splitBranch`                                       | Shape recognition: `money` / `bigint` value objects, rich-text and JSON-text strings, and the branches that `nullable` and `union` split from type arrays                                                                                                                                                                                                                                                   |
| `toBig(x)` `fromBig(b, template, decimals?)` `isDecimalValue` `EXACT_DECIMAL`                                           | Exact decimals: convert numbers, exact numeric strings and `money` / `bigint` value objects to and from `Big` (big.js); no unit conversion                                                                                                                                                                                                                                                                  |
| `valueFormatOf(schema, type)` `valueFormatWidget(format)`                                                               | The date storage format `x-valueFormat`, recognized only on strings without a standard `format` and on integers with format `x` or `X`. Without `x-ui.widget`, `date`, `time` or `datetime` is chosen from the format (timestamps and aliases give `datetime`); all three accept these shapes, except that `time` does not accept timestamps. `valueFormatWidget` is `valueFormatComponent` of `@jotl/core` |
| `formatThousands(text)` `stripThousands(text)`                                                                          | Thousands separators: insert `,` every 3 digits in the integer part of an exact numeric string; strip `,` `，` whitespace and `_`                                                                                                                                                                                                                                                                           |
| `enumOptions` `fieldLabel` `requiredKeys` `schemaTypes` `isBuiltinWidget`                                               | Schema reading helpers shared by widget packages                                                                                                                                                                                                                                                                                                                                                            |
| Types `Registry` `WidgetRegistration` `RenderPlanNode` `PlanOptions` `Adapters` `UploadContext` and the per-level props | The widget contract, defined in [`src/core/contracts.ts`](../src/core/contracts.ts)                                                                                                                                                                                                                                                                                                                         |

## Plan options

`plan()` and `expand()` take `PlanOptions`:

| Option                 | Default                 | Meaning                                                                                                                                                                                            |
| ---------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scene`                | `"default"`             | Selects a scene from `x-ui.variants`                                                                                                                                                               |
| `mode`                 | `"edit"`                | `"edit"` `"view"` `"disabled"`, passed to matchers in the resolve context                                                                                                                          |
| `schemaPointer`        | `""`                    | Where planning starts; reports `JOTL5102` when it does not exist or is not a schema                                                                                                                |
| `dataPath`             | `""`                    | The template data path of the start                                                                                                                                                                |
| `depth` `parentWidget` | `0`, none               | Pass these when planning from a child node, matching the renderer's context                                                                                                                        |
| `maxDepth`             | `DEFAULT_MAX_DEPTH` (2) | How many times a recursive reference to the same type is expanded along one path; beyond that the node is marked `lazy: true` without children, and the renderer calls `expand()` when it is shown |

## Handle fallbacks and diagnostics

- Built-in widget names are checked against the shapes they accept (the built-in widget name table of the [`x-ui` specification](../../../docs/spec/x-ui.md#built-in-widget-names)). When `x-ui.widget` names a built-in the shape does not accept, it falls back with F2 to the shape's default widget, for example `radio` on a multi-select enum falls back to `select`. A registration's `accepts` applies on top. On nullable nodes (type arrays or `anyOf` / `oneOf: [T, null]`) built-in field widget names apply to the content node.
- Fallbacks during `plan()` are recorded in the node's `degraded` with the codes F1 (not registered), F2 (shape not accepted or rejected by `accepts`), F3 (invalid `x-ui`) and F7 (unsupported schema feature), and each one also produces a warning diagnostic. F4 to F9 happen at render time; the [`x-ui` specification](../../../docs/spec/x-ui.md#fallback-ownership) lists who handles each code.
- `fallbackChain` lists the alternative widget names after the chosen one and always ends with `json`; a renderer substitutes them in order when a widget throws.
- Diagnostic codes are `JOTL5xxx`: `JOTL5001` to `JOTL5005` are fallback warnings and `JOTL51xx` are argument errors (with `value` `undefined`). The code table is `UI_CORE_DIAGNOSTICS` in [`src/core/diagnostics.ts`](../src/core/diagnostics.ts), and the F3 reason phrases are `XUI_ISSUE_REASONS` in the same file.
- When several places reference the same `x-ui`, each diagnostic is reported once.
