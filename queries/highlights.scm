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
(string_block) @string
;; Escapes overlay on the string; a malformed escape is flagged.
(escape_sequence) @string.escape
(invalid_escape) @error
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
;; User constraint/type reference (`x: MyConstraint`); excludes `type:` payloads
;; on `Attr<myType>` / `Value<myType>` which stay @variable.readonly.
(type_constraint name: (identifier) @type)

;; ── Parameters ──────────────────────────────────────────────────────────────
;; `name: Type` in argument lists and tuple types.
(argument name: (identifier) @variable.parameter)
(named_type_constraint name: (identifier) @variable.parameter)

;; ── Declaration names ───────────────────────────────────────────────────────
;; Constraint names read as types — they are used in type position, e.g.
;; `x: MyConstraint` — while patterns and rewrites read as functions. The
;; constraint name is the type's definition site; its uses stay @type (above).
(pattern_decl name: (identifier) @function)
(rewrite_decl name: (identifier) @function)
(constraint_decl name: (identifier) @type.definition)

;; ── Calls & operation names ─────────────────────────────────────────────────
(call_expr function: (identifier) @function)
(negated_call_expr function: (identifier) @function)
;; Op names in op<ns.name> / Op<ns.name> — symbolic constants (matching the
;; LLVM PDLL `enummember` intent).
(op_name (identifier) @constant)

;; ── Member access, tuple labels & attribute keys ────────────────────────────
(member_access_expr member: (identifier) @property)
(named_tuple_element name: (identifier) @property)
(op_attribute name: [(identifier) (string) (string_block)] @attribute)
