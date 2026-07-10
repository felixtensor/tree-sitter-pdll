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

## [0.1.0] - 2026-04-19

Initial tagged grammar.

### Added
- PDLL grammar for tree-sitter: `include` directives, `Pattern` /
  `Constraint` / `Rewrite` declarations with metadata, type and attribute
  constraints, operation expressions with results and attributes, tuple and
  member-access expressions, and the `let` / `erase` / `replace` / `rewrite` /
  `return` statement set.
- Example corpus from the upstream `llvm-project` `mlir/test/mlir-pdll` suite.
- C, Go, Node, Python, Rust, Swift, and Zig bindings.

[Unreleased]: https://github.com/felixtensor/tree-sitter-pdll/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/felixtensor/tree-sitter-pdll/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/felixtensor/tree-sitter-pdll/releases/tag/v0.1.0
