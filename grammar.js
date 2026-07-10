/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// Rule-level precedence; higher numbers bind tighter and win ambiguities.
//
//   replacement_list (2): `(a, b)` in `replace X with (...)` must outrank the
//     other parenthesised forms (expression_list, tuple_expr) that share the
//     same `( … )` shape.
//   call / member_access / variable_def (1): compound expression forms that
//     must outrank a bare identifier once their trailing syntax appears —
//     `f(x)`, `a.b`, `x: Type`. member_access is left-associative (`a.b.c`).
//   keyword_identifier (-1): `op` / `attr` / `type` re-admitted as an ordinary
//     identifier; kept below the default so the keyword forms (op_expr,
//     attr_expr, type_expr) win whenever their `<` / `(` syntax follows.
const PREC = {
  keyword_identifier: -1,
  call: 1,
  member_access: 1,
  variable_def: 1,
  replacement_list: 2,
};

export default grammar({
  name: "pdll",

  // A comment or run of whitespace may appear between any two tokens.
  extras: ($) => [$.comment, /\s+/],

  // Treat `identifier` as the reserved-word token: every keyword literal is
  // matched against it, so keywords are never silently lexed as an identifier.
  word: ($) => $.identifier,

  rules: {
    // =========================================================================
    // Top level
    //   source-file ::= (include-directive | pattern | constraint | rewrite)*
    // =========================================================================
    source_file: ($) => repeat($._top_level_statement),

    _top_level_statement: ($) =>
      choice(
        $.include_directive,
        $.pattern_decl,
        $.constraint_decl,
        $.rewrite_decl,
      ),

    include_directive: ($) => seq("#include", $.string),

    // =========================================================================
    // Declarations
    //   Pattern, Constraint and Rewrite declarations and their signatures.
    // =========================================================================
    pattern_decl: ($) =>
      seq(
        "Pattern",
        optional($.identifier),
        optional($.pattern_metadata),
        choice(
          seq("{", repeat($._statement_inside_pattern), "}"),
          seq("=>", $._operation_rewrite_statement),
        ),
      ),

    pattern_metadata: ($) =>
      seq("with", commaSep1(choice($.benefit_metadata, $.recursion_metadata))),

    benefit_metadata: ($) => seq("benefit", "(", $.integer, ")"),
    recursion_metadata: ($) => "recursion",

    constraint_decl: ($) =>
      seq(
        user_decl_signature($, "Constraint", $.identifier),
        top_level_user_decl_body($),
      ),

    rewrite_decl: ($) =>
      seq(
        user_decl_signature($, "Rewrite", $.identifier),
        top_level_user_decl_body($),
      ),

    argument_list: ($) => seq("(", commaSep($.argument), ")"),

    argument: ($) => seq($._identifier_or_keyword, ":", $.type_constraint),

    // =========================================================================
    // Identifiers and keywords
    //   PDLL keywords are contextual: many double as ordinary names, so these
    //   helpers re-admit them as `identifier` in the positions where they may
    //   appear.
    // =========================================================================

    // A plain identifier, or one of the contextual keywords (`op`, `attr`,
    // `type`) used as a variable name — common in PDLL argument lists.
    _identifier_or_keyword: ($) =>
      choice(
        $.identifier,
        alias("op", $.identifier),
        alias("attr", $.identifier),
        alias("type", $.identifier),
      ),

    // Any keyword may appear as a dotted component of an operation name, e.g.
    // `op<my_dialect.return>`, so every reserved word is re-admitted here.
    _identifier_or_any_keyword: ($) =>
      choice(
        $.identifier,
        alias("attr", $.identifier),
        alias("Attr", $.identifier),
        alias("erase", $.identifier),
        alias("let", $.identifier),
        alias("Constraint", $.identifier),
        alias("not", $.identifier),
        alias("op", $.identifier),
        alias("Op", $.identifier),
        alias("OpName", $.identifier),
        alias("Pattern", $.identifier),
        alias("replace", $.identifier),
        alias("return", $.identifier),
        alias("rewrite", $.identifier),
        alias("Rewrite", $.identifier),
        alias("type", $.identifier),
        alias("Type", $.identifier),
        alias("TypeRange", $.identifier),
        alias("Value", $.identifier),
        alias("ValueRange", $.identifier),
        alias("with", $.identifier),
      ),

    // =========================================================================
    // Type constraints
    //   The `: Type` annotations on arguments, variables and tuple elements.
    // =========================================================================
    type_constraint: ($) =>
      choice(
        seq("Op", optional(seq("<", $.op_name, ">"))),
        seq("Attr", optional(seq("<", $._expression, ">"))),
        "Type",
        seq("Value", optional(seq("<", $._expression, ">"))),
        seq("ValueRange", optional(seq("<", $._expression, ">"))),
        "TypeRange",
        seq("[", commaSep($.type_constraint), "]"),
        $.tuple_type,
        $.identifier,
      ),

    // Nested anonymous tuple type. Each element may be an argument-shaped entry
    // (`name: Type`) or a type/attr literal (`type<"i32">`, `attr<"10">`).
    tuple_type: ($) => seq("(", commaSep($._tuple_type_element), ")"),

    _tuple_type_element: ($) =>
      choice(
        $.named_type_constraint,
        $.type_constraint,
        $.type_expr,
        $.attr_expr,
        alias("op", $.identifier),
        alias("attr", $.identifier),
        alias("type", $.identifier),
      ),

    // `name: Type`, shared by tuple-type elements and (via variable_def) by
    // expression position.
    named_type_constraint: ($) =>
      seq($._identifier_or_keyword, ":", $.type_constraint),

    // =========================================================================
    // Statements
    //   The statement forms that appear inside a pattern or user-decl body.
    // =========================================================================
    _statement_inside_pattern: ($) =>
      choice(
        $.let_statement,
        $._operation_rewrite_statement,
        $.return_statement,
        alias($._inline_constraint_statement_decl, $.constraint_decl),
        alias($._inline_rewrite_statement_decl, $.rewrite_decl),
        seq($._expression, ";"),
      ),

    _operation_rewrite_statement: ($) =>
      choice($.erase_statement, $.replace_statement, $.rewrite_statement),

    let_statement: ($) =>
      seq(
        "let",
        $._identifier_or_keyword,
        optional(seq(":", $.type_constraint)),
        optional(seq("=", $._expression)),
        ";",
      ),

    erase_statement: ($) => seq("erase", $._expression, ";"),

    replace_statement: ($) =>
      seq(
        "replace",
        $._expression,
        "with",
        choice($.replacement_list, $._replacement_expression),
        ";",
      ),

    _replacement_expression: ($) =>
      choice(
        $.variable_def,
        $.identifier,
        $._keyword_identifier,
        $.negated_call_expr,
        $.call_expr,
        $.op_expr,
        $.attr_expr,
        $.type_expr,
        $.member_access_expr,
        $.string,
        $.integer,
      ),

    // `(a, b, …)` as the right-hand side of `replace X with`. Its precedence
    // keeps it ahead of the other parenthesised expression forms.
    replacement_list: ($) =>
      prec(PREC.replacement_list, seq("(", commaSep1($._expression), ")")),

    rewrite_statement: ($) =>
      seq(
        "rewrite",
        $._expression,
        "with",
        seq("{", repeat($._statement_inside_pattern), "}"),
        ";",
      ),

    return_statement: ($) => seq("return", $._expression, ";"),

    // =========================================================================
    // Expressions
    // =========================================================================
    _expression: ($) =>
      choice(
        $.variable_def,
        $.identifier,
        $._keyword_identifier,
        $.negated_call_expr,
        $.call_expr,
        $.op_expr,
        $.attr_expr,
        $.type_expr,
        $.tuple_expr,
        $.member_access_expr,
        $.string,
        $.integer,
      ),

    // Keywords like `op`, `attr`, `type` double as common variable names
    // (e.g. `Constraint Foo(attr: Attr)` then `Foo(..., attr, ...)`). Re-admit
    // them as identifiers when they appear bare in expression position — i.e.
    // not followed by the syntax (`<`, `(`, `:`) that would make them a keyword
    // use. The negative precedence yields to those keyword forms.
    _keyword_identifier: ($) =>
      prec(
        PREC.keyword_identifier,
        choice(
          alias("op", $.identifier),
          alias("attr", $.identifier),
          alias("type", $.identifier),
        ),
      ),

    // `name: Type` used in expression position — for example `erase _: Op;` or
    // `op<>(_: Value, _: ValueRange)`. Also accepts `op` as a variable name,
    // which the op_expr keyword would otherwise shadow.
    variable_def: ($) =>
      prec(
        PREC.variable_def,
        seq($._identifier_or_keyword, ":", $.type_constraint),
      ),

    // Postfix `.name` / `.0` on an expression. Because the `.` operator is not
    // part of an identifier, ordinary member accesses — `tuple.firstElt`,
    // `op.0`, `foo().name` — all share this one rule.
    member_access_expr: ($) =>
      prec.left(
        PREC.member_access,
        seq($._expression, ".", choice($.identifier, $.integer)),
      ),

    tuple_expr: ($) => seq("(", commaSep($._tuple_element), ")"),

    named_tuple_element: ($) =>
      seq($._identifier_or_keyword, "=", $._expression),

    _tuple_element: ($) => choice($.named_tuple_element, $._expression),

    negated_call_expr: ($) => seq("not", $.identifier, $.expression_list),

    call_expr: ($) =>
      prec(
        PREC.call,
        seq(
          choice(
            $.identifier,
            alias($._inline_constraint_decl, $.constraint_decl),
            alias($._inline_rewrite_decl, $.rewrite_decl),
          ),
          $.expression_list,
        ),
      ),

    // Inline declarations used as callable expressions:
    //   Constraint(value: Value) { ... }(value)
    // These variants stop at the end of the declaration body and let call_expr
    // consume the following argument list.
    _inline_constraint_decl: ($) =>
      prec(
        PREC.call,
        seq(
          user_decl_signature($, "Constraint"),
          inline_callable_user_decl_body($),
        ),
      ),

    _inline_rewrite_decl: ($) =>
      prec(
        PREC.call,
        seq(
          user_decl_signature($, "Rewrite"),
          inline_callable_user_decl_body($),
        ),
      ),

    // Inline declarations used as a statement; their body is a pattern block,
    // an `=> expr` shorthand or a native code block, each terminated by `;`.
    _inline_constraint_statement_decl: ($) =>
      seq(
        user_decl_signature($, "Constraint"),
        inline_statement_user_decl_body($),
      ),

    _inline_rewrite_statement_decl: ($) =>
      seq(
        user_decl_signature($, "Rewrite"),
        inline_statement_user_decl_body($),
      ),

    expression_list: ($) => seq("(", commaSep($._expression), ")"),

    // =========================================================================
    // Operation expressions
    //   `op<name>(operands) { attrs } -> (results)` and its sub-parts.
    // =========================================================================
    op_expr: ($) =>
      seq(
        "op",
        "<",
        optional($.op_name),
        ">",
        optional($.expression_list),
        optional($.op_attributes),
        optional($.operation_result_list),
      ),

    op_name: ($) =>
      choice(
        seq(
          $._identifier_or_any_keyword,
          repeat(seq(".", $._identifier_or_any_keyword)),
        ),
        $.string,
      ),

    operation_result_list: ($) => seq("->", "(", commaSep($._expression), ")"),

    op_attributes: ($) => seq("{", commaSep($.op_attribute), "}"),

    op_attribute: ($) =>
      seq(choice($.identifier, $.string), optional(seq("=", $._expression))),

    attr_expr: ($) => seq("attr", "<", $.string, ">"),

    type_expr: ($) => seq("type", "<", $.string, ">"),

    // =========================================================================
    // Terminals
    // =========================================================================

    // Native code literal `[{ … }]`. The content runs up to the closing `}]`;
    // the scanner guards `}` (the terminator's first character) so a `}` only
    // ends the block when immediately followed by `]`. This lets C++ bodies
    // contain stray `]`, `}` and the `]}` sequence (e.g. `T{v[i]}`).
    code_block: ($) =>
      seq(
        "[{",
        alias(repeat(choice(/[^}]/, seq("}", /[^\]]/))), $.code_block_content),
        "}]",
      ),

    identifier: ($) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    integer: ($) => /[0-9]+/,

    // A double-quoted string literal with C-style escapes. Native code blocks
    // are a separate literal (code_block); they are only accepted as a
    // declaration body, never in a string position such as `#include` or
    // `attr<…>`.
    string: ($) =>
      seq('"', repeat(choice(/[^"\\\n]/, /\\(["\\nt]|[0-9a-fA-F]{2})/)), '"'),

    // Line comment (BCPL `//` to end of line).
    comment: ($) => token(seq("//", /.*/)),
  },
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

// Zero or more `rule`, comma-separated.
function commaSep(rule) {
  return optional(commaSep1(rule));
}

// One or more `rule`, comma-separated.
function commaSep1(rule) {
  return seq(rule, repeat(seq(",", rule)));
}

// Shared `Keyword name(args) -> result` signature for Constraint / Rewrite
// declarations. `name` is optional so the inline (anonymous) forms can reuse it.
function user_decl_signature($, keyword, name = optional($.identifier)) {
  return seq(
    keyword,
    name,
    $.argument_list,
    optional(seq("->", $.type_constraint)),
  );
}

// `{ statement* }` — the compound body shared by every declaration form.
function user_decl_block($) {
  return seq("{", repeat($._statement_inside_pattern), "}");
}

// Body of a top-level Constraint / Rewrite: a block, an `=> expr;` shorthand, a
// native code block, or a bare `;` forward declaration.
function top_level_user_decl_body($) {
  return choice(
    user_decl_block($),
    seq("=>", $._expression, ";"),
    seq($.code_block, ";"),
    ";",
  );
}

// Body of an inline declaration used as a statement; like the top-level body
// but always terminated by `;` and without the bare forward-declaration form.
function inline_statement_user_decl_body($) {
  return choice(
    seq(user_decl_block($), ";"),
    seq("=>", $._expression, ";"),
    seq($.code_block, ";"),
  );
}

// Body of an inline declaration used as a callable expression: it stops at the
// end of the block or code block so call_expr can consume the argument list.
function inline_callable_user_decl_body($) {
  return choice(user_decl_block($), $.code_block);
}
