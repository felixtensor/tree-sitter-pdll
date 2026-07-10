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

[Unreleased]: https://github.com/felixtensor/tree-sitter-pdll/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/felixtensor/tree-sitter-pdll/releases/tag/v0.1.0
