# Work with JSON Pointers

**English** · [简体中文](../zh/docs/json-pointer.md)

This page shows how to read, build and match the JSON Pointers that Jotl uses for source maps, diagnostic locations and data paths. Everything here is exported from `@jotl/core` and has no runtime dependencies.

## Read a value

```ts
import { evaluatePointer, lookupPointer } from "@jotl/core";

const doc = { list: [{ "a/b": 1 }] };
evaluatePointer(doc, "/list/0/a~1b"); // { value: 1, diagnostics: [] }
evaluatePointer(doc, "/list/1");
// { diagnostics: [{ code: "JOTL0002", severity: "error", message: "JSON Pointer target does not exist: /list/1" }] }
lookupPointer(doc, "/list/01"); // { found: false }
```

- `parsePointer` and `evaluatePointer` return a `Result`. An invalid pointer reports `JOTL0001`; a location that does not exist reports `JOTL0002`.
- `tryParsePointer`, `isPointer` and `lookupPointer` produce no diagnostics. `lookupPointer` returns `{ found, value }`; array tokens accept only canonical decimal indexes, and objects are looked up by own properties only.

## Build a pointer

```ts
import { appendPointer, joinPointer, lastPointerToken, parentPointer } from "@jotl/core";

appendPointer("/list", 0, "a/b"); // "/list/0/a~1b"
joinPointer("/a", "0/img"); // "/a/0/img"
parentPointer("/a/b"); // "/a"
lastPointerToken("/a/b~1c"); // "b/c"
```

- `formatPointer(tokens)` and `appendPointer(base, ...tokens)` take unescaped tokens and escape them.
- `joinPointer(base, relative)` appends an already escaped relative path; an empty string returns `base`.
- `escapePointerToken` and `unescapePointerToken` convert single tokens.

## Match pointers with wildcards

A `"*"` token (`POINTER_WILDCARD`) matches any single token. Use it to describe every item of an array, for example in rules that apply to each row.

```ts
import { fillWildcards, matchPointer } from "@jotl/core";

matchPointer("/list/*/x", "/list/3/x"); // true
fillWildcards("/list/*/x", [2]); // "/list/2/x"
fillWildcards("/l/*/x/*", [1]); // "/l/1/x/*"
```

`matchPointer(pattern, pointer)` also requires both to have the same number of tokens. `fillWildcards(template, indexes)` replaces `"*"` tokens with indexes in order and leaves the remaining `"*"` when the indexes run out.
