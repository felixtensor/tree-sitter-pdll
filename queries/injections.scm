;; ---------------------------------------------------------------------------
;; PDLL language injections
;;
;; Native `[{ ... }]` blocks (Constraint / Rewrite bodies and native inline
;; declarations) carry C++ source that mlir-tblgen emits verbatim, so their
;; content is highlighted as C++. Only the inner code_block_content is injected;
;; the `[{` / `}]` delimiters stay under PDLL highlighting.
;;
;; The string payloads of attr<"..."> / type<"..."> are MLIR attribute/type
;; fragments, not top-level MLIR ops. tree-sitter-mlir's start rule accepts only
;; operations / alias definitions, so injecting those fragments would produce
;; parse errors rather than better highlighting; they are intentionally left as
;; plain strings.
;; ---------------------------------------------------------------------------

((code_block_content) @injection.content
  (#set! injection.language "cpp"))
