;; ---------------------------------------------------------------------------
;; PDLL code folding
;;
;; PDLL has no `region` node; the brace-delimited declaration bodies, the
;; `rewrite … with { … }` block, and `[{ … }]` code / string blocks are what
;; benefit from folding. Short parenthesised lists and attribute dicts are left
;; unfolded.
;; ---------------------------------------------------------------------------

[
  (pattern_decl)
  (constraint_decl)
  (rewrite_decl)
  (rewrite_statement)
  (code_block)
  (string_block)
] @fold
