# PDLL Examples for Parser Testing

This directory contains `.pdll` files sourced from the official
[LLVM/MLIR test suite](https://github.com/llvm/llvm-project/tree/main/mlir/test/mlir-pdll)
and is used as **Tier 2** testing for the tree-sitter-pdll grammar.

## Purpose

While `test/corpus/` contains hand-written tests with exact AST snapshot
verification (`tree-sitter test`), this directory holds **real-world PDLL
files** that are validated using `tree-sitter parse` — the parser must
eventually produce a complete parse tree with **no ERROR nodes**.

This two-tier approach follows the convention established by
[tree-sitter-rust](https://github.com/tree-sitter/tree-sitter-rust) and other
official tree-sitter grammars.

## Directory Structure

```
examples/
└── mlir-pdll/          ← mirrors llvm-project/mlir/test/mlir-pdll
    ├── Parser/         ← parser / frontend tests
    ├── CodeGen/        ← code-generation tests (CPP, MLIR backends)
    ├── Integration/    ← end-to-end integration tests
    └── split-markers.pdll
```

## Running Tests

```bash
# Parse all examples and show statistics
npm run test:examples

# Run both corpus and examples tests
npm run test:all
```

## Updating Examples

To sync files from a local copy of llvm-project:

```bash
./scripts/sync-examples.sh /path/to/llvm-project
```

By default it looks for `../llvm-project` or the `LLVM_PROJECT_DIR`
environment variable.

## File Selection Policy

- **Included**: All `*.pdll` files from `mlir/test/mlir-pdll/`, including
  `include/` sub-directories that are referenced by `#include` directives.
- **Excluded**: Files with `failure` in the name (these contain intentionally
  broken syntax for MLIR diagnostic testing).
