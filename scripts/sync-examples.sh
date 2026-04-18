#!/usr/bin/env bash
# sync-examples.sh — Sync PDLL test files from llvm-project into examples/
#
# Usage:
#   ./scripts/sync-examples.sh [LLVM_PROJECT_DIR]
#
# If no argument is given, uses $LLVM_PROJECT_DIR or defaults to ../llvm-project.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
EXAMPLES_DIR="$PROJECT_DIR/examples"

LLVM_DIR="${1:-${LLVM_PROJECT_DIR:-$PROJECT_DIR/../llvm-project}}"
LLVM_DIR="$(cd "$LLVM_DIR" 2>/dev/null && pwd)" || {
  echo "Error: llvm-project directory not found at: ${1:-${LLVM_PROJECT_DIR:-../llvm-project}}"
  echo "Usage: $0 [LLVM_PROJECT_DIR]"
  exit 1
}

PDLL_TEST_DIR="$LLVM_DIR/mlir/test/mlir-pdll"

if [ ! -d "$PDLL_TEST_DIR" ]; then
  echo "Error: $PDLL_TEST_DIR does not exist. Is this a valid llvm-project checkout?"
  exit 1
fi

TARGET_DIR="$EXAMPLES_DIR/mlir-pdll"
echo "Syncing PDLL examples from: $PDLL_TEST_DIR"
echo "Target directory: $TARGET_DIR"
echo ""

# ── Helper ───────────────────────────────────────────────────────────────────
sync_tree() {
  local src="$1"
  local dst="$2"
  local count=0
  local skipped=0

  mkdir -p "$dst"

  # Remove stale *.pdll files in dst (only top level of this subtree).
  for f in "$dst"/*.pdll; do
    [ -f "$f" ] || continue
    local basename="$(basename "$f")"
    if [ ! -f "$src/$basename" ]; then
      rm "$f"
    fi
  done

  for f in "$src"/*.pdll; do
    [ -f "$f" ] || continue
    local basename="$(basename "$f")"

    # Skip files marked as intentional parse failures.
    if [[ "$basename" == *failure* ]]; then
      skipped=$((skipped + 1))
      continue
    fi

    cp "$f" "$dst/"
    count=$((count + 1))
  done

  # Recurse into subdirectories (e.g. `include/`).
  for sub in "$src"/*/; do
    [ -d "$sub" ] || continue
    local name="$(basename "$sub")"
    sync_tree "$sub" "$dst/$name"
  done

  local rel="${dst#$EXAMPLES_DIR/}"
  echo "  $rel: $count files, $skipped skipped"
}

# ── Copy top-level files and known sub-trees ─────────────────────────────────
mkdir -p "$TARGET_DIR"

# top-level .pdll (e.g. split-markers.pdll) and lit.local.cfg
for f in "$PDLL_TEST_DIR"/*.pdll "$PDLL_TEST_DIR"/lit.local.cfg; do
  [ -f "$f" ] || continue
  cp "$f" "$TARGET_DIR/"
done

SUBDIRS="Parser CodeGen Integration"
for sub in $SUBDIRS; do
  src="$PDLL_TEST_DIR/$sub"
  dst="$TARGET_DIR/$sub"
  if [ ! -d "$src" ]; then
    echo "$sub: SKIPPED (directory not found)"
    continue
  fi
  echo "$sub:"
  sync_tree "$src" "$dst"
done

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
total_files=$(find "$EXAMPLES_DIR" -name '*.pdll' | wc -l | tr -d ' ')
total_lines=$(find "$EXAMPLES_DIR" -name '*.pdll' -exec cat {} + | wc -l | tr -d ' ')
echo "═══════════════════════════════════════════"
echo "  Total: $total_files files, $total_lines lines"
echo "═══════════════════════════════════════════"
