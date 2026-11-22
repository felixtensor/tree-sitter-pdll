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
;; Declaration names. Anchored with `.` so anonymous lambda bodies are not
;; captured as declaration names.
(pattern_decl . (identifier) @local.definition)
(constraint_decl . (identifier) @local.definition)
(rewrite_decl . (identifier) @local.definition)
;; Parameters, let-bound values, and inline variable definitions (`x: Value`).
;; Anchors select the bound name rather than initializer / constraint children,
;; and anonymous `_` placeholders are excluded so they never cross-link.
(argument (identifier) @local.definition)
(let_statement . (identifier) @local.definition)
((variable_def . (identifier) @local.definition)
  (#not-eq? @local.definition "_"))

;; ── References ──────────────────────────────────────────────────────────────
(identifier) @local.reference
