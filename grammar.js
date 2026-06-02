const PREC = {
  call: 1,
  replacement_list: 2,
};

module.exports = grammar({
  name: 'pdll',

  extras: $ => [
    $.comment,
    /\s+/
  ],

  word: $ => $.identifier,

  rules: {
    source_file: $ => repeat($._top_level_statement),

    _top_level_statement: $ => choice(
      $.include_directive,
      $.pattern_decl,
      $.constraint_decl,
      $.rewrite_decl
    ),

    include_directive: $ => seq(
      '#include',
      $.string
    ),

    pattern_decl: $ => seq(
      'Pattern',
      optional($.identifier),
      optional($.pattern_metadata),
      choice(
        seq('{', repeat($._statement_inside_pattern), '}'),
        seq('=>', $._operation_rewrite_statement)
      )
    ),

    pattern_metadata: $ => seq(
      'with',
      commaSep1(choice(
        $.benefit_metadata,
        $.recursion_metadata
      ))
    ),

    benefit_metadata: $ => seq('benefit', '(', $.integer, ')'),
    recursion_metadata: $ => 'recursion',

    constraint_decl: $ => seq(
      user_decl_signature($, 'Constraint', $.identifier),
      top_level_user_decl_body($)
    ),

    rewrite_decl: $ => seq(
      user_decl_signature($, 'Rewrite', $.identifier),
      top_level_user_decl_body($)
    ),

    argument_list: $ => seq(
      '(',
      commaSep($.argument),
      ')'
    ),

    argument: $ => seq(
      $._identifier_or_keyword,
      ':',
      $.type_constraint
    ),

    // A plain identifier, or one of the contextual keywords (`op`, `attr`,
    // `type`) used as a variable name — common in PDLL argument lists.
    _identifier_or_keyword: $ => choice(
      $.identifier,
      alias('op', $.identifier),
      alias('attr', $.identifier),
      alias('type', $.identifier)
    ),

    _identifier_or_any_keyword: $ => choice(
      $.identifier,
      alias('attr', $.identifier),
      alias('Attr', $.identifier),
      alias('erase', $.identifier),
      alias('let', $.identifier),
      alias('Constraint', $.identifier),
      alias('not', $.identifier),
      alias('op', $.identifier),
      alias('Op', $.identifier),
      alias('OpName', $.identifier),
      alias('Pattern', $.identifier),
      alias('replace', $.identifier),
      alias('return', $.identifier),
      alias('rewrite', $.identifier),
      alias('Rewrite', $.identifier),
      alias('type', $.identifier),
      alias('Type', $.identifier),
      alias('TypeRange', $.identifier),
      alias('Value', $.identifier),
      alias('ValueRange', $.identifier),
      alias('with', $.identifier)
    ),

    type_constraint: $ => choice(
      seq('Op', optional(seq('<', $.op_name, '>'))),
      seq('Attr', optional(seq('<', $._expression, '>'))),
      'Type',
      seq('Value', optional(seq('<', $._expression, '>'))),
      seq('ValueRange', optional(seq('<', $._expression, '>'))),
      'TypeRange',
      seq('[', commaSep($.type_constraint), ']'),
      $.tuple_type,
      $.identifier
    ),

    // Nested anonymous tuple type. Each element may be an argument-shaped
    // entry (`name: Type`) or a type/attr literal (`type<"i32">`,
    // `attr<"10">`).
    tuple_type: $ => seq('(', commaSep($._tuple_type_element), ')'),

    _tuple_type_element: $ => choice(
      $.named_type_constraint,
      $.type_constraint,
      $.type_expr,
      $.attr_expr,
      alias('op', $.identifier),
      alias('attr', $.identifier),
      alias('type', $.identifier)
    ),

    _statement_inside_pattern: $ => choice(
      $.let_statement,
      $._operation_rewrite_statement,
      $.return_stmt,
      alias($._inline_constraint_statement_decl, $.constraint_decl),
      alias($._inline_rewrite_statement_decl, $.rewrite_decl),
      seq($._expression, ';')
    ),

    _operation_rewrite_statement: $ => choice(
      $.erase_stmt,
      $.replace_stmt,
      $.rewrite_stmt
    ),

    negated_call_expr: $ => seq(
      'not',
      $.identifier,
      $.expression_list
    ),

    let_statement: $ => seq(
      'let',
      $._identifier_or_keyword,
      optional(seq(':', $.type_constraint)),
      optional(seq('=', $._expression)),
      ';'
    ),

    erase_stmt: $ => seq(
      'erase',
      $._expression,
      ';'
    ),

    replace_stmt: $ => seq(
      'replace',
      $._expression,
      'with',
      choice($.replacement_list, $._replacement_expression),
      ';'
    ),

    _replacement_expression: $ => choice(
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
      $.integer
    ),

    replacement_list: $ => prec(PREC.replacement_list, seq(
      '(',
      commaSep1($._expression),
      ')'
    )),

    rewrite_stmt: $ => seq(
      'rewrite',
      $._expression,
      'with',
      seq('{', repeat($._statement_inside_pattern), '}'),
      ';'
    ),

    return_stmt: $ => seq(
      'return',
      $._expression,
      ';'
    ),

    _expression: $ => choice(
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
      $.integer
    ),

    // Keywords like `op`, `attr`, `type` double as common variable names
    // (e.g. `Constraint Foo(attr: Attr)` then `Foo(..., attr, ...)`).
    // Re-admit them as identifiers when they appear bare in expression
    // position — i.e. not followed by the syntax that would make them a
    // keyword use (`<`, `(`, `:`).
    _keyword_identifier: $ => prec(-1, choice(
      alias('op', $.identifier),
      alias('attr', $.identifier),
      alias('type', $.identifier)
    )),

    // Postfix `.name` / `.0` on an expression. Note that because the
    // operator itself is not part of identifiers, so normal member accesses
    // such as `tuple.firstElt`, `op.0`, and `foo().name` share this rule.
    member_access_expr: $ => prec.left(1, seq(
      $._expression,
      '.',
      choice($.identifier, $.integer)
    )),

    tuple_expr: $ => seq('(', commaSep($._tuple_element), ')'),

    named_tuple_element: $ => seq($._identifier_or_keyword, '=', $._expression),

    _tuple_element: $ => choice(
      $.named_tuple_element,
      $._expression
    ),

    // `name: Type` used in expression position — for example
    // `erase _: Op;` or `op<>(_: Value, _: ValueRange, _: Value)`.
    // Also accepts `op` as a variable name, which would otherwise be
    // shadowed by the `op_expr` keyword.
    variable_def: $ => prec(1, seq(
      $._identifier_or_keyword,
      ':',
      $.type_constraint
    )),

    named_type_constraint: $ => seq(
      $._identifier_or_keyword,
      ':',
      $.type_constraint
    ),

    call_expr: $ => prec(PREC.call, seq(
      choice(
        $.identifier,
        alias($._inline_constraint_decl, $.constraint_decl),
        alias($._inline_rewrite_decl, $.rewrite_decl)
      ),
      $.expression_list
    )),

    // Inline declarations can be used as callable expressions:
    //   Constraint(value: Value) { ... }(value)
    // These variants stop at the end of the declaration body and let call_expr
    // consume the following argument list.
    _inline_constraint_decl: $ => prec(PREC.call, seq(
      user_decl_signature($, 'Constraint'),
      inline_callable_user_decl_body($)
    )),

    _inline_rewrite_decl: $ => prec(PREC.call, seq(
      user_decl_signature($, 'Rewrite'),
      inline_callable_user_decl_body($)
    )),

    _inline_constraint_statement_decl: $ => seq(
      user_decl_signature($, 'Constraint'),
      inline_statement_user_decl_body($)
    ),

    _inline_rewrite_statement_decl: $ => seq(
      user_decl_signature($, 'Rewrite'),
      inline_statement_user_decl_body($)
    ),

    op_expr: $ => seq(
      'op',
      '<',
      optional($.op_name),
      '>',
      optional($.expression_list),
      optional($.op_attributes),
      optional($.operation_result_list)
    ),

    op_name: $ => choice(
      seq($._identifier_or_any_keyword, repeat(seq('.', $._identifier_or_any_keyword))),
      $.string
    ),

    operation_result_list: $ => seq(
      '->',
      '(',
      commaSep($._expression),
      ')'
    ),

    op_attributes: $ => seq(
      '{',
      commaSep($.op_attribute),
      '}'
    ),

    op_attribute: $ => seq(
      choice($.identifier, $.string),
      optional(seq('=', $._expression))
    ),

    expression_list: $ => seq(
      '(',
      commaSep($._expression),
      ')'
    ),

    attr_expr: $ => seq(
      'attr',
      '<',
      $.string,
      '>'
    ),

    type_expr: $ => seq(
      'type',
      '<',
      $.string,
      '>'
    ),

    code_block: $ => seq(
      '[{',
      alias(
        repeat(choice(
          /[^\]]/,
          seq(']', /[^}]/)
        )),
        $.code_block_content
      ),
      '}]'
    ),

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    
    integer: $ => /[0-9]+/,

    string: $ => choice(
      seq('"', repeat(choice(/[^"\\\n]/, /\\(["\\nt]|[0-9a-fA-F]{2})/)), '"'),
      $.code_block
    ),

    comment: $ => token(seq('//', /.*/))
  }
});

function commaSep(rule) {
  return optional(commaSep1(rule));
}

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

function user_decl_signature($, keyword, name = optional($.identifier)) {
  return seq(
    keyword,
    name,
    $.argument_list,
    optional(seq('->', $.type_constraint))
  );
}

function user_decl_block($) {
  return seq('{', repeat($._statement_inside_pattern), '}');
}

function top_level_user_decl_body($) {
  return choice(
    user_decl_block($),
    seq('=>', $._expression, ';'),
    seq($.code_block, ';'),
    ';'
  );
}

function inline_statement_user_decl_body($) {
  return choice(
    seq(user_decl_block($), ';'),
    seq('=>', $._expression, ';'),
    seq($.code_block, ';')
  );
}

function inline_callable_user_decl_body($) {
  return choice(
    user_decl_block($),
    $.code_block
  );
}
