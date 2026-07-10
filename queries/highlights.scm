;; ---------------------------------------------------------------------------
;; PDLL syntax highlighting
;; For Neovim (nvim-treesitter), Helix, and other tree-sitter-compatible
;; editors. Captures are standard tree-sitter names plus three documented
;; extensions — @keyword.import, @type.definition, @variable.readonly — that
;; `tree-sitter highlight --check` flags as non-standard but are widely themed.
;;
;; tree-sitter highlighting is last-match-wins: the broad (identifier) and
;; (string) fallbacks appear first, and the specific roles below override them.
;; ---------------------------------------------------------------------------

(comment) @comment

;; ── Literals ────────────────────────────────────────────────────────────────
(string) @string
(integer) @number

;; ── Identifiers ─────────────────────────────────────────────────────────────
;; Broad fallback. PDLL bindings are single-assignment, so a plain value
;; identifier is read-only; the specific roles in the sections below override it.
(identifier) @variable.readonly

;; ── Punctuation & operators ─────────────────────────────────────────────────
["(" ")" "{" "}" "[" "]" "<" ">"] @punctuation.bracket
;; Native code block delimiters; the C++ content is injected separately.
(code_block ["[{" "}]"] @punctuation.special)
[":" "," ";"] @punctuation.delimiter
["=" "=>" "->" "."] @operator

;; ── Keywords ────────────────────────────────────────────────────────────────
"#include" @keyword.import
["Pattern" "Constraint" "Rewrite"] @keyword
["let" "erase" "replace" "rewrite" "return" "with" "not"] @keyword
;; op<> / attr<""> / type<""> introducers. Kept as @keyword so they stay
;; distinct from the op name / payload they introduce.
(op_expr "op" @keyword)
(attr_expr "attr" @keyword)
(type_expr "type" @keyword)
;; Pattern metadata: `with benefit(1), recursion`.
(benefit_metadata "benefit" @keyword)
(recursion_metadata) @keyword

;; ── Types ───────────────────────────────────────────────────────────────────
;; Builtin constraint types.
(type_constraint
  ["Op" "Attr" "Type" "Value" "ValueRange" "TypeRange"] @type.builtin)
;; A bare identifier in constraint position is a user constraint/type reference.
(type_constraint (identifier) @type)

;; ── Parameters ──────────────────────────────────────────────────────────────
;; `name: Type` in argument lists and tuple types.
(argument (identifier) @variable.parameter)
(named_type_constraint (identifier) @variable.parameter)

;; ── Declaration names ───────────────────────────────────────────────────────
;; Constraint names read as types — they are used in type position, e.g.
;; `x: MyConstraint` — while patterns and rewrites read as functions. The
;; constraint name is the type's definition site; its uses stay @type (above).
(pattern_decl (identifier) @function)
(rewrite_decl (identifier) @function)
(constraint_decl (identifier) @type.definition)

;; ── Calls & operation names ─────────────────────────────────────────────────
(call_expr (identifier) @function)
(negated_call_expr (identifier) @function)
;; Op names in op<ns.name> / Op<ns.name> — symbolic constants (matching the
;; LLVM PDLL `enummember` intent).
(op_name (identifier) @constant)
(op_name (string) @constant)

;; ── Attribute keys ──────────────────────────────────────────────────────────
(op_attribute (identifier) @attribute)
(op_attribute (string) @attribute)
