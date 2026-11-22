#include "tree_sitter/parser.h"

enum TokenType {
  BLOCK_CONTENT,
  ERROR_SENTINEL,
};

void *tree_sitter_pdll_external_scanner_create(void) { return NULL; }

void tree_sitter_pdll_external_scanner_destroy(void *payload) { (void)payload; }

unsigned tree_sitter_pdll_external_scanner_serialize(void *payload,
                                                     char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_pdll_external_scanner_deserialize(void *payload,
                                                   const char *buffer,
                                                   unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

// Scan the verbatim body of a `[{ ... }]` block (native code block or string
// block).
//
// Consumes every character starting immediately after `[{` until the first `}]`
// delimiter, preventing `extras` (whitespace or `//` comments) from interfering
// and handling arbitrary consecutive `}` characters (e.g. `}}]` or `}\n}]`).
//
// Unlike MLIR's `Lexer::lexString(..., isStringBlock=true)`, backslashes inside
// `[{ ... }]` are intentionally treated as opaque payload rather than validated
// as PDLL escape sequences: `}]` cannot be escaped by `\`, so block boundaries
// stay exact for all valid PDLL while embedded C++ code remains resilient.
bool tree_sitter_pdll_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {
  (void)payload;

  // Bail out during error recovery (when all external tokens are marked valid).
  if (valid_symbols[ERROR_SENTINEL] || !valid_symbols[BLOCK_CONTENT]) {
    return false;
  }

  bool has_content = false;
  while (!lexer->eof(lexer)) {
    if (lexer->lookahead == '}') {
      lexer->mark_end(lexer);
      lexer->advance(lexer, false);
      if (lexer->lookahead == ']') {
        if (has_content) {
          lexer->result_symbol = BLOCK_CONTENT;
          return true;
        }
        return false;
      }
      has_content = true;
      continue;
    }
    lexer->advance(lexer, false);
    has_content = true;
  }

  // Reached EOF without finding closing `}]`.
  return false;
}
