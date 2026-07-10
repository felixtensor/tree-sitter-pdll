;; ---------------------------------------------------------------------------
;; PDLL indentation (nvim-treesitter indent module).
;;
;; PDLL has no `region` node, so the brace-bearing declaration / statement nodes
;; and op attribute dicts drive indentation; the closing `}` returns to the
;; parent level. Native code blocks, strings and comments are ignored — their
;; contents belong to the injected language (C++) or are opaque.
;; ---------------------------------------------------------------------------

[
  (pattern_decl)
  (constraint_decl)
  (rewrite_decl)
  (rewrite_statement)
  (op_attributes)
] @indent.begin

"}" @indent.branch

[(code_block) (string) (comment)] @indent.ignore
