;; ---------------------------------------------------------------------------
;; PDLL code navigation — symbol outline and go-to-definition.
;;
;; Surfaces the named top-level declarations (Pattern / Constraint / Rewrite)
;; and links call sites back to them. Anonymous patterns have no name child and
;; are not tagged. Standard tree-sitter tags captures:
;;   https://tree-sitter.github.io/tree-sitter/code-navigation
;; ---------------------------------------------------------------------------

(pattern_decl (identifier) @name) @definition.function
(constraint_decl (identifier) @name) @definition.function
(rewrite_decl (identifier) @name) @definition.function

(call_expr (identifier) @name) @reference.call
(negated_call_expr (identifier) @name) @reference.call
