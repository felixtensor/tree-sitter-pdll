/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// ---------------------------------------------------------------------------
// Grammar DSL helpers (pure expansion; keep generated grammar.json flat)
// ---------------------------------------------------------------------------

// All 20 keywords from MLIR PDLL Lexer.h (Token::Kind).
// Dependent keywords may be used as variable names; all keywords may appear in
// op names, attribute keys, and member access.
const DEPENDENT_KEYWORDS = ['attr', 'op', 'type'];
const GENERAL_KEYWORDS = [
  'Attr', 'erase', 'let', 'Constraint', 'not', 'Op', 'OpName',
  'Pattern', 'replace', 'return', 'rewrite', 'Rewrite',
  'Type', 'TypeRange', 'Value', 'ValueRange', 'with',
];
const ALL_KEYWORDS = [...DEPENDENT_KEYWORDS, ...GENERAL_KEYWORDS];

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
  keyword, name, $.argument_list, optional(seq('->', $._result_type)),
);

// Shared native body (`[{ ... }]` or `"..."`), matching MLIR Token::isString().
// prettier-ignore
/** @param {GrammarSymbols<any>} $ */
const native_decl_body = $ => choice($.code_block, $.string);

// Rule-level precedence (higher binds tighter):
//   2 — replacement_list: `(a, b)` in `replace X with (...)` > call_expr / tuple_expr
//   1 — call / member_access / variable_def: `f(x)`, `a.b`, `x: Type` > bare identifier
//  -1 — keyword_identifier: `op` / `attr` / `type` as identifier < op_expr / attr_expr / type_expr
//  -2 — lambda: `=> expr` binds looser than postfix `.member` / `(args)`
const PREC = {
  lambda: -2,
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
  externals: $ => [$._block_content, $._error_sentinel],
  // Match keyword literals against `identifier` so reserved words are never silently lexed as identifiers.
  word: $ => $.identifier,
  // Contexts that allow dependent or arbitrary keywords explicitly opt in via
  // `_identifier_or_keyword` / `_identifier_or_any_keyword`.
  reserved: {
    global: $ => ALL_KEYWORDS,
  },

  rules: {
    // =========================================================================
    // Top level
    // =========================================================================
    source_file: $ => repeat($._top_level_statement),
    _top_level_statement: $ => choice(
      $.include_directive, $.pattern_decl, $.constraint_decl, $.rewrite_decl,
    ),
    include_directive: $ => seq('#include', $._string_literal),

    // =========================================================================
    // Declarations
    // =========================================================================
    pattern_decl: $ => seq(
      'Pattern',
      optional($.identifier),
      optional($.pattern_metadata),
      choice(
        seq('{', repeat($._pattern_statement), '}'),
        seq('=>', $._operation_rewrite_statement),
      ),
    ),
    pattern_metadata: $ => seq('with', commaSep1(choice($.benefit_metadata, $.recursion_metadata))),
    benefit_metadata: $ => seq('benefit', '(', $.integer, ')'),
    recursion_metadata: $ => 'recursion',

    constraint_decl: $ => seq(
      user_decl_signature($, 'Constraint', $.identifier),
      choice(
        seq('{', repeat($._constraint_statement), '}'),
        seq('=>', $._expression, ';'),
        seq(native_decl_body($), ';'),
        ';',
      ),
    ),
    rewrite_decl: $ => seq(
      user_decl_signature($, 'Rewrite', $.identifier),
      choice(
        seq('{', repeat($._rewrite_statement), '}'),
        seq('=>', choice($._operation_rewrite_statement, seq($._expression, ';'))),
        seq(native_decl_body($), ';'),
        ';',
      ),
    ),

    argument_list: $ => seq('(', commaSep($.argument), ')'),
    argument: $ => seq($._identifier_or_keyword, ':', alias($._arg_result_type_constraint, $.type_constraint)),

    // =========================================================================
    // Identifiers and keywords
    // =========================================================================

    // Plain identifier, or dependent keyword (`op`, `attr`, `type`) used as a variable name.
    _identifier_or_keyword: $ => choice(
      $.identifier,
      ...DEPENDENT_KEYWORDS.map(kw => alias(kw, $.identifier)),
    ),

    // Any keyword may appear in op names, attribute keys, and member access.
    _identifier_or_any_keyword: $ => choice(
      $.identifier,
      ...ALL_KEYWORDS.map(kw => alias(kw, $.identifier)),
    ),

    // =========================================================================
    // Type constraints
    // =========================================================================

    // Variable constraint (used in `let` and inline `variable_def`): single
    // constraint or non-empty, non-nested `[c1, c2, ...]` list.
    _variable_constraint: $ => choice(
      $.type_constraint,
      alias($._constraint_list, $.type_constraint),
    ),
    _constraint_list: $ => seq('[', commaSep1($.type_constraint), ']'),

    // Single constraint in variable position (permits inline `<type-expr>`).
    type_constraint: $ => choice(
      seq('Op', optional(seq('<', optional($.op_name), '>'))),
      seq('Attr', optional(seq('<', $._expression, '>'))),
      'Type',
      seq('Value', optional(seq('<', $._expression, '>'))),
      seq('ValueRange', optional(seq('<', $._expression, '>'))),
      'TypeRange',
      alias($._inline_constraint_decl, $.constraint_decl),
      $.identifier,
    ),

    // Single constraint in argument or result position: MLIR Parser.cpp forbids
    // inline `<type-expr>` on `Attr`, `Value`, and `ValueRange`.
    _arg_result_type_constraint: $ => choice(
      seq('Op', optional(seq('<', optional($.op_name), '>'))),
      'Attr',
      'Type',
      'Value',
      'ValueRange',
      'TypeRange',
      alias($._inline_constraint_decl, $.constraint_decl),
      $.identifier,
    ),

    // Return signature after `->`: single unnamed constraint, or non-empty
    // parenthesized result list (single-element lists may not be named).
    _result_type: $ => choice(
      alias($._arg_result_type_constraint, $.type_constraint),
      $.tuple_type,
    ),
    tuple_type: $ => seq('(', choice(
      seq(
        alias($._arg_result_type_constraint, $.type_constraint),
        repeat(seq(',', $._tuple_type_element)),
      ),
      seq(
        $.named_type_constraint,
        repeat1(seq(',', $._tuple_type_element)),
      ),
    ), ')'),
    _tuple_type_element: $ => choice(
      $.named_type_constraint,
      alias($._arg_result_type_constraint, $.type_constraint),
    ),
    named_type_constraint: $ => seq(
      $._identifier_or_keyword, ':', alias($._arg_result_type_constraint, $.type_constraint),
    ),

    // =========================================================================
    // Statements
    // =========================================================================

    // Pattern and `rewrite ... with { ... }` bodies forbid `return`.
    _pattern_statement: $ => choice(
      $.let_statement,
      $._operation_rewrite_statement,
      seq($._expression, ';'),
    ),
    // Constraint bodies forbid `erase`, `replace`, and `rewrite`.
    _constraint_statement: $ => choice(
      $.let_statement,
      $.return_statement,
      seq($._expression, ';'),
    ),
    // Rewrite bodies allow all statement kinds.
    _rewrite_statement: $ => choice(
      $.let_statement,
      $._operation_rewrite_statement,
      $.return_statement,
      seq($._expression, ';'),
    ),
    _operation_rewrite_statement: $ => choice(
      $.erase_statement, $.replace_statement, $.rewrite_statement,
    ),
    // Semicolon-free rewrite statements for inline `Rewrite(...) => ...` bodies.
    _inline_operation_rewrite_statement: $ => choice(
      alias($._erase_body, $.erase_statement),
      alias($._replace_body, $.replace_statement),
      alias($._rewrite_body, $.rewrite_statement),
    ),

    let_statement: $ => seq(
      'let', $._identifier_or_keyword,
      optional(seq(':', $._variable_constraint)),
      optional(seq('=', $._expression)),
      ';',
    ),
    _erase_body: $ => seq('erase', $._expression),
    erase_statement: $ => seq($._erase_body, ';'),
    _replace_body: $ => seq(
      'replace', $._expression, 'with',
      choice($.replacement_list, $._replacement_expression),
    ),
    replace_statement: $ => seq($._replace_body, ';'),
    _replacement_expression: $ => prec(PREC.lambda, choice(
      $.variable_def,
      alias($._anonymous_variable_def, $.variable_def),
      $.identifier, $._keyword_identifier,
      $.negated_call_expr, $.call_expr,
      $.op_expr, $.attr_expr, $.type_expr,
      $.member_access_expr,
      alias($._inline_constraint_decl, $.constraint_decl),
      alias($._inline_rewrite_decl, $.rewrite_decl),
    )),
    replacement_list: $ => prec(PREC.replacement_list, seq('(', commaSep1($._expression), ')')),
    _rewrite_body: $ => seq(
      'rewrite', $._expression, 'with',
      seq('{', repeat($._pattern_statement), '}'),
    ),
    rewrite_statement: $ => seq($._rewrite_body, ';'),
    return_statement: $ => seq('return', $._expression, ';'),

    // =========================================================================
    // Expressions
    // =========================================================================

    // Expressions that may serve as the receiver of postfix `.member`.
    _value_expression: $ => choice(
      $.variable_def, $.identifier, $._keyword_identifier,
      $.negated_call_expr, $.call_expr,
      $.op_expr, $.attr_expr, $.type_expr,
      $.tuple_expr, $.member_access_expr,
    ),
    _expression: $ => choice(
      $._value_expression,
      alias($._anonymous_variable_def, $.variable_def),
      alias($._inline_constraint_decl, $.constraint_decl),
      alias($._inline_rewrite_decl, $.rewrite_decl),
    ),

    // Re-admit bare `op`, `attr`, `type` in expression position when not followed by `<`, `:`.
    _keyword_identifier: $ => prec(PREC.keyword_identifier, choice(
      ...DEPENDENT_KEYWORDS.map(kw => alias(kw, $.identifier)),
    )),

    // `name: Type` in expression position (may take postfix `.member`, e.g. `x: Op.0`).
    variable_def: $ => prec(PREC.variable_def, seq(
      $._identifier_or_keyword, ':', $._variable_constraint,
    )),
    // Anonymous `_: Type` in expression position: MLIR Parser.cpp:1796 returns
    // before the postfix `.` / `(` loop, so `_: Op.0` is rejected.
    _anonymous_variable_def: $ => seq(
      alias('_', $.identifier), ':', $._variable_constraint,
    ),

    // Postfix `.name` / `.0` on an expression (`tuple.firstElt`, `op.0`, `foo().return`).
    member_access_expr: $ => prec.left(PREC.member_access, seq(
      $._value_expression, '.', choice($._identifier_or_any_keyword, $.integer),
    )),

    tuple_expr: $ => seq('(', commaSep($._tuple_element), ')'),
    named_tuple_element: $ => seq($._identifier_or_keyword, '=', $._expression),
    _tuple_element: $ => choice($.named_tuple_element, $._expression),

    negated_call_expr: $ => seq('not', $.identifier, $.expression_list),
    call_expr: $ => prec.left(PREC.call, seq(
      choice(
        $.identifier,
        $._keyword_identifier,
        alias($._inline_callable_constraint_decl, $.constraint_decl),
        alias($._inline_callable_rewrite_decl, $.rewrite_decl),
        $.tuple_expr,
        $.member_access_expr,
        $.call_expr,
      ),
      $.expression_list,
    )),

    // Inline declarations callable directly (`Constraint(...) { ... }(x)` / `[{ ... }](x)`).
    // Lambda (`=>`) forms greedily consume trailing `(args)` into their body in MLIR Parser.cpp.
    _inline_callable_constraint_decl: $ => seq(
      user_decl_signature($, 'Constraint'),
      choice(seq('{', repeat($._constraint_statement), '}'), native_decl_body($)),
    ),
    _inline_callable_rewrite_decl: $ => seq(
      user_decl_signature($, 'Rewrite'),
      choice(seq('{', repeat($._rewrite_statement), '}'), native_decl_body($)),
    ),

    // Inline declarations in expression/constraint/statement position (no forward decl).
    _inline_constraint_decl: $ => choice(
      $._inline_callable_constraint_decl,
      prec.right(PREC.lambda, seq(user_decl_signature($, 'Constraint'), '=>', $._expression)),
    ),
    _inline_rewrite_decl: $ => choice(
      $._inline_callable_rewrite_decl,
      prec.right(PREC.lambda, seq(
        user_decl_signature($, 'Rewrite'),
        '=>',
        choice($._inline_operation_rewrite_statement, $._expression),
      )),
    ),

    expression_list: $ => seq('(', commaSep($._expression), ')'),

    // =========================================================================
    // Operation expressions
    // =========================================================================
    op_expr: $ => prec.right(seq(
      'op', '<', optional($.op_name), '>',
      optional($.expression_list), optional($.op_attributes), optional($.operation_result_list),
    )),
    op_name: $ => seq(
      $._identifier_or_any_keyword,
      repeat1(seq('.', $._identifier_or_any_keyword)),
    ),
    operation_result_list: $ => seq('->', '(', commaSep($._expression), ')'),
    op_attributes: $ => seq('{', commaSep1($.op_attribute), '}'),
    op_attribute: $ => seq(
      choice($._identifier_or_any_keyword, $._string_literal),
      optional(seq('=', $._expression)),
    ),

    attr_expr: $ => seq('attr', '<', $._string_literal, '>'),
    type_expr: $ => seq('type', '<', $._string_literal, '>'),

    // =========================================================================
    // Terminals
    // =========================================================================

    // String literal accepted wherever MLIR Token::isString() applies (other than
    // native C++ code blocks, which use `code_block` for C++ language injection).
    _string_literal: $ => choice($.string, $.string_block),

    // Native C++ code block `[{ ... }]` (injected as C++ via `code_block_content`).
    code_block: $ => seq(
      '[{',
      optional(alias($._block_content, $.code_block_content)),
      token.immediate('}]'),
    ),
    // General multi-line string block `[{ ... }]` (no C++ injection).
    string_block: $ => seq(
      '[{',
      optional($._block_content),
      token.immediate('}]'),
    ),

    // Plain identifier; excludes bare `_` (Token::underscore in MLIR Lexer.cpp).
    identifier: $ => /[a-zA-Z][a-zA-Z0-9_]*|_[a-zA-Z0-9_]+/,
    integer: $ => /[0-9]+/,

    // Single-line double-quoted string; `token.immediate` keeps `extras`
    // (whitespace / `//` comments) from splitting or terminating string contents.
    string: $ => seq(
      '"',
      repeat(choice(
        token.immediate(prec(1, /[^"\\\n\x0b\x0c]+/)),
        $.escape_sequence,
        $.invalid_escape,
      )),
      token.immediate('"'),
    ),
    escape_sequence: $ => token.immediate(seq('\\', choice(/["\\nt]/, /[0-9a-fA-F]{2}/))),
    invalid_escape: $ => token.immediate(seq('\\', /[^\n\x0b\x0c]/)),

    comment: $ => token(seq('//', /[^\r\n]*/)),
  },
});
