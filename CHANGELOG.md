# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **0.x parse-tree stability.** Before 1.0 the parse-tree (AST) shape is not
> guaranteed stable across releases. Any change that alters the shape of the
> tree — even when the input still parses without error — is called out in a
> dedicated **Breaking AST changes** subsection so query and binding consumers
> can audit it.

## [Unreleased]

## [0.1.2] - 2026-11-22

Broad alignment with upstream LLVM MLIR PDLL (`Lexer.cpp` and `Parser.cpp`),
backed by a minimal C11 external scanner for `[{…}]` block strings, named AST
fields across grammar rules, field-based queries, refreshed `tree-sitter 0.27.2`
binding templates, and expanded corpus and highlight test coverage.

### Breaking AST changes

- Multi-result `Constraint` / `Rewrite` return types (`-> (Value, Attr)`) now
  emit `(tuple_type …)` directly under `constraint_decl` / `rewrite_decl`
  instead of wrapping it in an extra `(type_constraint (tuple_type …))`.
- `op_name` no longer accepts double-quoted strings (`op<"foo.bar">`) or
  single-segment names (`op<outer>`), matching MLIR's qualified `dialect.op`
  requirement.
- `[{…}]` blocks in non-native positions (`#include`, `attr<…>`, `type<…>`, and
  `op_attribute` keys) now emit a dedicated `(string_block)` node, while native
  `Constraint` / `Rewrite` bodies continue to emit `(code_block
  (code_block_content))` so C++ injection stays scoped to native code.
- Previously accepted invalid PDLL forms are now rejected to match MLIR
  `Parser.cpp`: empty `-> ()` and single named `-> (a: Value)` / `-> a: Value`
  return types, `type_expr` / `attr_expr` inside `tuple_type`, parameterized
  `Value<…>` / `Attr<…>` / `[…]` / `(…)` in argument or return positions,
  empty `op<> {}` attribute dicts, bare `string` / `integer` literals as general
  expressions, bare `_` outside anonymous `_: Type` variable definitions,
  postfix member access on anonymous `_: Type` variables (`_: Op.0`), `return`
  inside `Pattern` / `rewrite … with {}`, `erase` / `replace` / `rewrite` inside
  `Constraint`, raw `\r`/`\n` inside `"…"` strings, and reserved or dependent
  keywords where MLIR requires plain identifiers.
  (For editor resilience and compact parser tables, compound `Pattern` bodies
  remain permissive on statement order/presence, `Constraint`/`Rewrite` bodies
  do not enforce `return` placement, `Rewrite` contexts still parse empty-name
  `op<>`, and `[{…}]` blocks treat backslashes as opaque payload.)

### Added

- **scanner:** add a stateless C11 external scanner (`src/scanner.c`) for
  `[{…}]` block bodies, handling consecutive closing braces (`}}]`, `}\n}]`),
  comments, and newlines deterministically with zero LR conflicts.
- **fields:** add named `field(...)` annotations across declarations, type
  constraints, statements, expressions, and operation nodes (`name`,
  `parameters`, `return_type`, `body`, `metadata`, `type`, `value`, `target`,
  `replacement`, `object`, `member`, `function`, `arguments`, `operands`,
  `attributes`, `results`, `path`, `constraint`, `content`), exposed in
  `src/node-types.json` and usable via `child_by_field_name` /
  `children_by_field_name` (compound `{…}` bodies expose one `body` entry per
  statement).
- **grammar:** support all remaining valid MLIR PDLL constructs:
  - `[{…}]` string blocks (`string_block`) in `#include`, `attr<…>`, `type<…>`,
    and `op_attribute` keys.
  - Double-quoted `"…"` bodies on native `Constraint` / `Rewrite` declarations.
  - `Rewrite` lambda bodies containing `erase`, `replace`, or `rewrite`
    statements (both top-level and inline).
  - Empty angle brackets in `Op<>` type constraints.
  - Inline `Constraint` declarations in type-constraint positions (`let`,
    `[…]`, arguments, results, and `variable_def`).
  - Unified inline `Constraint` / `Rewrite` declarations in expression position
    and extended `call_expr` callees (`member_access_expr`, `call_expr`,
    `tuple_expr`, contextual keywords, and callable inline declarations).
- **tests & CI:** expand corpus coverage from 162 to 225 tests (including 80
  error cases and `test/corpus/08-fields.txt`), expand `test/highlight/` to 6
  domain fixtures (170 assertions across literals, declarations, types,
  expressions, disambiguation, and locals scoping), and assert `src/scanner.c`
  inclusion in the npm package check.

### Fixed

- **strings & comments:** wrap double-quoted string content, escapes, and
  closing quote in `token.immediate`, preventing `extras` (`//` comments and
  `\r`/`\n`/`\v`/`\f`) from splitting or sneaking inside `"…"` literals; stop
  `comment` before `\r` as well as `\n` for CRLF files.
- **keywords & identifiers:** reserve all 20 MLIR PDLL keywords via `reserved`
  from a single keyword list while allowing contextual keywords (`op`, `attr`,
  `type`, `benefit`, `recursion`) only where MLIR permits them; exclude bare
  `_` from general `identifier` matching.
- **queries:** migrate `highlights.scm`, `locals.scm`, and `tags.scm` to named
  field selectors (`name:`, `function:`, `member:`) so anonymous lambda bodies
  (`Constraint(v: Value) => v`), attribute values (`{ key = myVal }`), and
  parameterized type constraints (`Attr<myType>` / `Value<myType>`) are never
  misclassified; narrow `locals.scm` `@local.reference` to explicit reference
  slots so same-named local bindings no longer hijack `op<a.b>`, `{ key = v }`,
  `t.first`, or `(first = v)` highlights; highlight `member_access_expr` members
  and `named_tuple_element` labels as `@property`, member calls `t.helper(x)` as
  `@function`, and anonymous `_` placeholders as `@variable.builtin`; record
  non-`_` inline `variable_def` bindings in `locals.scm`; add `(string_block)`
  to `highlights.scm`, `folds.scm`, and `indents.scm`, and add `@indent.end` to
  `indents.scm`.

### Changed

- **grammar:** compact `grammar.js` layout and add `.prettierignore` to preserve
  concise tree-sitter DSL formatting.
- **bindings:** refresh C/CMake/Makefile, Rust (edition 2024, `tree-sitter`
  0.27.2, and valid PDLL doctest), Node (Windows relative import, Bun
  standalone, and async load test), Python (lazy resource import and sdist
  globs), Swift (5.6 `Context.packageDirectory` and `swift-tree-sitter` 0.10),
  and Zig templates from `tree-sitter` 0.27.2.
- **CI:** install the tree-sitter CLI version `package-lock.json` resolves, so
  Dependabot's npm updates move CI with them, and bump `tree-sitter-cli` to
  `0.27.2`.

## [0.1.1] - 2026-07-10

Query set, highlight ergonomics, and CI maturity — the first release that ships
with editor support out of the box.

### Breaking AST changes

- Statement nodes renamed to the tree-sitter-conventional full-word form:
  `erase_stmt` → `erase_statement`, `replace_stmt` → `replace_statement`,
  `rewrite_stmt` → `rewrite_statement`, `return_stmt` → `return_statement`.
  The existing `let_statement` is unchanged.
- `(string)` nodes no longer contain `(code_block)` children. Native `[{…}]`
  blocks are now standalone `(code_block)` nodes accepted only as a
  declaration body; they are no longer accepted in `#include`, `attr<…>`,
  `type<…>`, or op name positions.

### Added

- **queries:** ship the standard six-file tree-sitter query set —
  `highlights.scm`, `injections.scm`, `locals.scm`, `tags.scm`, `folds.scm`,
  and `indents.scm` — wired into `tree-sitter.json`. Covers all 38 named
  node types with official tree-sitter captures plus three documented
  extensions (`@keyword.import`, `@type.definition`, `@variable.readonly`).
- **injection:** native `[{…}]` C++ blocks are injected as `cpp` on the
  `code_block_content` node, so editor highlighting delegates to the C++
  grammar for verbatim mlir-tblgen output.
- **grammar:** expose `escape_sequence` and `invalid_escape` as child nodes
  of `string` literals. `(escape_sequence) @string.escape` and
  `(invalid_escape) @error` in the highlight query.
- **ci:** `tree-sitter highlight --check` guards every shipped highlight
  capture through `test/highlight/` fixtures — the corpus-based test suite
  already covers every parser feature, and highlight tests now cover every
  capture category.

### Fixed

- **ESM generation:** `grammar.js` uses `export default` to match the
  `"type": "module"` declaration in `package.json`. The config-sync commit
  that added the module type had left the grammar on CommonJS `module.exports`,
  which made `tree-sitter generate` exit with a `ReferenceError`.
- **native code block `]}` parsing:** the `[{…}]` content scanner now guards
  the terminator's first character `}` instead of `]`, so `T{v[i]}` and other
  C++ initializer-list expressions parse correctly rather than erroring.
- **npm Package-check CI:** added `package-lock.json` so the npm job's
  `setup-node` cache step and lock-file diff succeed.

### Changed

- Grammar code and comment style aligned with `tree-sitter-mlir`: Prettier 3
  formatting, `($) =>` arrows, `/// <reference>` + `@ts-check` header,
  `// ===` full-width section banners, a documented `PREC` block, and
  "why"-focused rule comments.
- Highlight captures refined against the LLVM PDLL VS Code grammar and Zed
  plugin: constraint declaration names → `@type` / `@type.definition`,
  pattern/rewrite names → `@function`, op names → `@constant`,
  `#include` → `@keyword.import`, single-assignment value identifiers →
  `@variable.readonly`.

## [0.1.0] - 2026-07-08

Initial tagged grammar.

### Added
- PDLL grammar for tree-sitter: `include` directives, `Pattern` /
  `Constraint` / `Rewrite` declarations with metadata, type and attribute
  constraints, operation expressions with results and attributes, tuple and
  member-access expressions, and the `let` / `erase` / `replace` / `rewrite` /
  `return` statement set.
- Example corpus from the upstream `llvm-project` `mlir/test/mlir-pdll` suite.
- C, Go, Node, Python, Rust, Swift, and Zig bindings.

[Unreleased]: https://github.com/felixtensor/tree-sitter-pdll/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/felixtensor/tree-sitter-pdll/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/felixtensor/tree-sitter-pdll/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/felixtensor/tree-sitter-pdll/releases/tag/v0.1.0
