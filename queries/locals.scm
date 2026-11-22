;; ---------------------------------------------------------------------------
;; PDLL locals — scopes, definitions, and references.
;;
;; Drives scope-aware highlighting and go-to-definition. Definitions and
;; references link by identifier text within the nearest enclosing scope. The
;; broad (identifier) @local.reference is paired with the specific
;; @local.definition patterns; the definition role wins for a node matched by
;; both.
;; ---------------------------------------------------------------------------

;; ── Scopes ──────────────────────────────────────────────────────────────────
;; The file holds top-level Pattern / Constraint / Rewrite names; each
;; declaration body and each `rewrite … with { … }` block opens a nested scope
;; for its arguments and let-bound values.
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
(identifier) @local.reference
