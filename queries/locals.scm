;; ---------------------------------------------------------------------------
;; PDLL locals — scopes, definitions, and references.
;;
;; Drives scope-aware highlighting and go-to-definition. Definitions and
;; references link by identifier text within the nearest enclosing scope.
;;
;; References are listed explicitly by syntactic role rather than via a broad
;; `(identifier) @local.reference`, so non-variable identifiers (`op<a.b>`,
;; `{ key = v }`, `t.member`, `(label = v)`, `-> (res: Value, ...)`) are never
;; hijacked by same-named `let` bindings or parameters.
;;
;; Top-level declaration names stay scoped to their own declaration node so
;; cross-declaration references keep their role-specific highlight (`@type` in
;; constraint position vs `@function` at call sites).
;; ---------------------------------------------------------------------------

;; ── Scopes ──────────────────────────────────────────────────────────────────
(source_file) @local.scope
(pattern_decl) @local.scope
(constraint_decl) @local.scope
(rewrite_decl) @local.scope
(rewrite_statement) @local.scope

;; ── Definitions ─────────────────────────────────────────────────────────────
;; Named declarations, parameters, let-bound values, and inline variable
;; definitions (`x: Value`). Anonymous `_` placeholders are excluded so they
;; never cross-link.
(pattern_decl name: (identifier) @local.definition)
(constraint_decl name: (identifier) @local.definition)
(rewrite_decl name: (identifier) @local.definition)
(argument name: (identifier) @local.definition)
(let_statement name: (identifier) @local.definition)
((variable_def name: (identifier) @local.definition)
  (#not-eq? @local.definition "_"))

;; ── References ──────────────────────────────────────────────────────────────
;; Value, callable, and type-constraint reference positions only.
(pattern_decl body: (identifier) @local.reference)
(constraint_decl body: (identifier) @local.reference)
(rewrite_decl body: (identifier) @local.reference)
(rewrite_statement target: (identifier) @local.reference)
(rewrite_statement body: (identifier) @local.reference)
(let_statement value: (identifier) @local.reference)
(erase_statement target: (identifier) @local.reference)
(replace_statement target: (identifier) @local.reference)
(replace_statement replacement: (identifier) @local.reference)
(replacement_list (identifier) @local.reference)
(return_statement value: (identifier) @local.reference)
(member_access_expr object: (identifier) @local.reference)
(named_tuple_element value: (identifier) @local.reference)
(tuple_expr (identifier) @local.reference)
(call_expr function: (identifier) @local.reference)
(negated_call_expr function: (identifier) @local.reference)
(expression_list (identifier) @local.reference)
(operation_result_list (identifier) @local.reference)
(op_attribute value: (identifier) @local.reference)
(type_constraint name: (identifier) @local.reference)
(type_constraint type: (identifier) @local.reference)
