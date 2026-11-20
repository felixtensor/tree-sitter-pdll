/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// ---------------------------------------------------------------------------
// Grammar DSL helpers (pure expansion; keep generated grammar.json flat)
// ---------------------------------------------------------------------------

// prettier-ignore
/** @param {RuleOrLiteral} rule */
const commaSep1 = rule => seq(rule, repeat(seq(',', rule)));

// prettier-ignore
/** @param {RuleOrLiteral} rule */
const commaSep = rule => optional(commaSep1(rule));

// Shared `Keyword name(args) -> result` signature for Constraint / Rewrite
// declarations. `name` is optional so inline (anonymous) forms can reuse it.
// prettier-ignore
/**
 * @param {GrammarSymbols<any>} $
 * @param {string} keyword
 * @param {RuleOrLiteral} [name]
 */
const user_decl_signature = ($, keyword, name = optional($.identifier)) => seq(
  keyword, name, $.argument_list, optional(seq('->', $.type_constraint)),
);

// `{ statement* }` — compound body shared by every declaration form.
// prettier-ignore
/** @param {GrammarSymbols<any>} $ */
const user_decl_block = $ => seq('{', repeat($._statement_inside_pattern), '}');

// Body of a top-level Constraint / Rewrite: block, `=> expr;`, native code block, or `;`.
// prettier-ignore
/** @param {GrammarSymbols<any>} $ */
const top_level_user_decl_body = $ => choice(
  user_decl_block($),
  seq('=>', $._expression, ';'),
  seq($.code_block, ';'),
  ';',
);

// Body of an inline statement declaration; always `;`-terminated (no forward decl).
// prettier-ignore
/** @param {GrammarSymbols<any>} $ */
const inline_statement_user_decl_body = $ => choice(
  seq(user_decl_block($), ';'),
  seq('=>', $._expression, ';'),
  seq($.code_block, ';'),
);

// Body of an inline callable declaration; stops before the call's argument list.
// prettier-ignore
/** @param {GrammarSymbols<any>} $ */
const inline_callable_user_decl_body = $ => choice(user_decl_block($), $.code_block);

// Rule-level precedence (higher binds tighter):
//   2 — replacement_list: `(a, b)` in `replace X with (...)` > expression_list / tuple_expr
//   1 — call / member_access / variable_def: `f(x)`, `a.b`, `x: Type` > bare identifier
//  -1 — keyword_identifier: `op` / `attr` / `type` as identifier < op_expr / attr_expr / type_expr
const PREC = {
  keyword_identifier: -1,
  call: 1,
  member_access: 1,
  variable_def: 1,
  replacement_list: 2,
};

// prettier-ignore
export default grammar({
  name: 'pdll',
  extras: $ => [$.comment, /\s+/],
  // Match keyword literals against `identifier` so reserved words are never silently lexed as identifiers.
  word: $ => $.identifier,

  rules: {
    // =========================================================================
    // Top level
    // =========================================================================
    source_file: $ => repeat($._top_level_statement),
    _top_level_statement: $ => choice(
      $.include_directive, $.pattern_decl, $.constraint_decl, $.rewrite_decl,
    ),
    include_directive: $ => seq('#include', $.string),

    // =========================================================================
    // Declarations
    // =========================================================================
    pattern_decl: $ => seq(
      'Pattern',
      optional($.identifier),
      optional($.pattern_metadata),
      choice(
        seq('{', repeat($._statement_inside_pattern), '}'),
        seq('=>', $._operation_rewrite_statement),
      ),
    ),
    pattern_metadata: $ => seq('with', commaSep1(choice($.benefit_metadata, $.recursion_metadata))),
    benefit_metadata: $ => seq('benefit', '(', $.integer, ')'),
    recursion_metadata: $ => 'recursion',

    constraint_decl: $ => seq(
      user_decl_signature($, 'Constraint', $.identifier),
      top_level_user_decl_body($),
    ),
    rewrite_decl: $ => seq(
      user_decl_signature($, 'Rewrite', $.identifier),
      top_level_user_decl_body($),
    ),

    argument_list: $ => seq('(', commaSep($.argument), ')'),
    argument: $ => seq($._identifier_or_keyword, ':', $.type_constraint),

    // =========================================================================
    // Identifiers and keywords
    // =========================================================================

    // Plain identifier, or contextual keyword (`op`, `attr`, `type`) used as a variable name.
    _identifier_or_keyword: $ => choice(
      $.identifier,
      alias('op', $.identifier),
      alias('attr', $.identifier),
      alias('type', $.identifier),
    ),

    // Any keyword may appear as a dotted component of an op name (e.g. `op<my_dialect.return>`).
    _identifier_or_any_keyword: $ => choice(
      $.identifier,
      alias('attr', $.identifier), alias('Attr', $.identifier),
      alias('erase', $.identifier), alias('let', $.identifier),
      alias('Constraint', $.identifier), alias('not', $.identifier),
      alias('op', $.identifier), alias('Op', $.identifier), alias('OpName', $.identifier),
      alias('Pattern', $.identifier), alias('replace', $.identifier),
      alias('return', $.identifier), alias('rewrite', $.identifier), alias('Rewrite', $.identifier),
      alias('type', $.identifier), alias('Type', $.identifier), alias('TypeRange', $.identifier),
      alias('Value', $.identifier), alias('ValueRange', $.identifier),
      alias('with', $.identifier),
    ),

    // =========================================================================
    // Type constraints
    // =========================================================================
    type_constraint: $ => choice(
      seq('Op', optional(seq('<', $.op_name, '>'))),
      seq('Attr', optional(seq('<', $._expression, '>'))),
      'Type',
      seq('Value', optional(seq('<', $._expression, '>'))),
      seq('ValueRange', optional(seq('<', $._expression, '>'))),
      'TypeRange',
      seq('[', commaSep($.type_constraint), ']'),
      $.tuple_type,
      $.identifier,
    ),

    // Nested anonymous tuple type: `name: Type` entries or `type<...>` / `attr<...>` literals.
    tuple_type: $ => seq('(', commaSep($._tuple_type_element), ')'),
    _tuple_type_element: $ => choice(
      $.named_type_constraint, $.type_constraint, $.type_expr, $.attr_expr,
      alias('op', $.identifier), alias('attr', $.identifier), alias('type', $.identifier),
    ),
    named_type_constraint: $ => seq($._identifier_or_keyword, ':', $.type_constraint),

    // =========================================================================
    // Statements
    // =========================================================================
    _statement_inside_pattern: $ => choice(
      $.let_statement,
      $._operation_rewrite_statement,
      $.return_statement,
      alias($._inline_constraint_statement_decl, $.constraint_decl),
      alias($._inline_rewrite_statement_decl, $.rewrite_decl),
      seq($._expression, ';'),
    ),
    _operation_rewrite_statement: $ => choice(
      $.erase_statement, $.replace_statement, $.rewrite_statement,
    ),

    let_statement: $ => seq(
      'let', $._identifier_or_keyword,
      optional(seq(':', $.type_constraint)),
      optional(seq('=', $._expression)),
      ';',
    ),
    erase_statement: $ => seq('erase', $._expression, ';'),
    replace_statement: $ => seq(
      'replace', $._expression, 'with',
      choice($.replacement_list, $._replacement_expression), ';',
    ),
    _replacement_expression: $ => choice(
      $.variable_def, $.identifier, $._keyword_identifier,
      $.negated_call_expr, $.call_expr,
      $.op_expr, $.attr_expr, $.type_expr,
      $.member_access_expr, $.string, $.integer,
    ),
    replacement_list: $ => prec(PREC.replacement_list, seq('(', commaSep1($._expression), ')')),
    rewrite_statement: $ => seq(
      'rewrite', $._expression, 'with',
      seq('{', repeat($._statement_inside_pattern), '}'), ';',
    ),
    return_statement: $ => seq('return', $._expression, ';'),

    // =========================================================================
    // Expressions
    // =========================================================================
    _expression: $ => choice(
      $.variable_def, $.identifier, $._keyword_identifier,
      $.negated_call_expr, $.call_expr,
      $.op_expr, $.attr_expr, $.type_expr,
      $.tuple_expr, $.member_access_expr, $.string, $.integer,
    ),

    // Re-admit bare `op`, `attr`, `type` in expression position when not followed by `<`, `(`, `:`.
    _keyword_identifier: $ => prec(PREC.keyword_identifier, choice(
      alias('op', $.identifier), alias('attr', $.identifier), alias('type', $.identifier),
    )),

    // `name: Type` in expression position (e.g. `erase _: Op;` or `op<>(_: Value)`).
    variable_def: $ => prec(PREC.variable_def, seq(
      $._identifier_or_keyword, ':', $.type_constraint,
    )),

    // Postfix `.name` / `.0` on an expression (`tuple.firstElt`, `op.0`, `foo().name`).
    member_access_expr: $ => prec.left(PREC.member_access, seq(
      $._expression, '.', choice($.identifier, $.integer),
    )),

    tuple_expr: $ => seq('(', commaSep($._tuple_element), ')'),
    named_tuple_element: $ => seq($._identifier_or_keyword, '=', $._expression),
    _tuple_element: $ => choice($.named_tuple_element, $._expression),

    negated_call_expr: $ => seq('not', $.identifier, $.expression_list),
    call_expr: $ => prec(PREC.call, seq(
      choice(
        $.identifier,
        alias($._inline_constraint_decl, $.constraint_decl),
        alias($._inline_rewrite_decl, $.rewrite_decl),
      ),
      $.expression_list,
    )),

    // Inline declarations used as callable expressions: `Constraint(v: Value) { ... }(v)`.
    _inline_constraint_decl: $ => prec(PREC.call, seq(
      user_decl_signature($, 'Constraint'), inline_callable_user_decl_body($),
    )),
    _inline_rewrite_decl: $ => prec(PREC.call, seq(
      user_decl_signature($, 'Rewrite'), inline_callable_user_decl_body($),
    )),

    // Inline declarations used as statements (`;`-terminated).
    _inline_constraint_statement_decl: $ => seq(
      user_decl_signature($, 'Constraint'), inline_statement_user_decl_body($),
    ),
    _inline_rewrite_statement_decl: $ => seq(
      user_decl_signature($, 'Rewrite'), inline_statement_user_decl_body($),
    ),

    expression_list: $ => seq('(', commaSep($._expression), ')'),

    // =========================================================================
    // Operation expressions
    // =========================================================================
    op_expr: $ => seq(
      'op', '<', optional($.op_name), '>',
      optional($.expression_list), optional($.op_attributes), optional($.operation_result_list),
    ),
    op_name: $ => choice(
      seq($._identifier_or_any_keyword, repeat(seq('.', $._identifier_or_any_keyword))),
      $.string,
    ),
    operation_result_list: $ => seq('->', '(', commaSep($._expression), ')'),
    op_attributes: $ => seq('{', commaSep($.op_attribute), '}'),
    op_attribute: $ => seq(choice($.identifier, $.string), optional(seq('=', $._expression))),

    attr_expr: $ => seq('attr', '<', $.string, '>'),
    type_expr: $ => seq('type', '<', $.string, '>'),

    // =========================================================================
    // Terminals
    // =========================================================================

    // Native code literal `[{ ... }]`; `}` only terminates when immediately followed by `]`.
    code_block: $ => seq(
      '[{',
      alias(repeat(choice(/[^}]/, seq('}', /[^\]]/))), $.code_block_content),
      '}]',
    ),

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    integer: $ => /[0-9]+/,

    string: $ => seq('"', repeat(choice(/[^"\\\n]+/, $.escape_sequence, $.invalid_escape)), '"'),
    escape_sequence: $ => token(seq('\\', choice(/["\\nt]/, /[0-9a-fA-F]{2}/))),
    invalid_escape: $ => token(seq('\\', /[^\n]/)),

    comment: $ => token(seq('//', /.*/)),
  },
});
