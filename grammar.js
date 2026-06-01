const PREC = {
  call: 1,
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
      optional(seq($._identifier_or_keyword, ':')),
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

    type_constraint: $ => choice(
      seq('Op', optional(seq('<', choice($.identifier, $.string), '>'))),
      seq('Attr', optional(seq('<', $._type_constraint_param, '>'))),
      seq('Type', optional(seq('<', $._type_constraint_param, '>'))),
      seq('Value', optional(seq('<', $._type_constraint_param, '>'))),
      seq('ValueRange', optional(seq('<', $._type_constraint_param, '>'))),
      seq('TypeRange', optional(seq('<', $._type_constraint_param, '>'))),
      seq('[', commaSep($.type_constraint), ']'),
      $.tuple_type,
      $.identifier
    ),

    // Nested anonymous tuple type. Each element may be an argument-shaped
    // entry (`name: Type`) or a type/attr literal (`type<"i32">`,
    // `attr<"10">`).
    tuple_type: $ => seq('(', commaSep($._tuple_type_element), ')'),

    _tuple_type_element: $ => choice(
      $.argument,
      $.type_expr,
      $.attr_expr,
      alias('op', $.identifier),
      alias('attr', $.identifier),
      alias('type', $.identifier)
    ),

    // Parameter inside `Value<...>`, `TypeRange<...>` etc. — either a
    // plain type constraint or a named/anonymous variable declaration
    // like `operandType: Type` or `_: TypeRange`.
    _type_constraint_param: $ => choice(
      $.variable_def,
      $.type_constraint
    ),

    _statement_inside_pattern: $ => choice(
      $.let_statement,
      $._operation_rewrite_statement,
      $.return_stmt,
      $.not_stmt,
      alias($._inline_constraint_statement_decl, $.constraint_decl),
      alias($._inline_rewrite_statement_decl, $.rewrite_decl),
      seq($._expression, ';')
    ),

    _operation_rewrite_statement: $ => choice(
      $.erase_stmt,
      $.replace_stmt,
      $.rewrite_stmt
    ),

    not_stmt: $ => seq('not', $._expression, ';'),

    let_statement: $ => seq(
      'let',
      $.identifier,
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
      $._expression,
      ';'
    ),

    rewrite_stmt: $ => seq(
      'rewrite',
      $._expression,
      'with',
      choice(
        seq('{', repeat($._statement_inside_pattern), '}'),
        $.identifier
      ),
      ';'
    ),

    return_stmt: $ => seq(
      'return',
      optional($._expression),
      ';'
    ),

    _expression: $ => choice(
      $.variable_def,
      $.identifier,
      $._keyword_identifier,
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
    // identifier lexer accepts `.`, forms like `tuple.firstElt` are still
    // matched as a single identifier at the token level — this rule covers
    // cases where a `.` cannot be part of the preceding token, e.g.
    // `op<my.dialect>.0` or `foo().name`.
    member_access_expr: $ => prec.left(1, seq(
      $._expression,
      '.',
      choice($.identifier, $.integer)
    )),

    // Tuple expression: `()`, `(a, b)`, `(name = a, b)`, or a single named
    // element `(name = a)`. A single *unnamed* element would be ambiguous
    // with a parenthesised expression, so it's excluded.
    tuple_expr: $ => choice(
      seq('(', ')'),
      seq('(', $.named_tuple_element, optional(seq(',', commaSep1($._tuple_element))), ')'),
      seq('(', $._expression, ',', commaSep1($._tuple_element), ')')
    ),

    named_tuple_element: $ => seq($.identifier, '=', $._expression),

    _tuple_element: $ => choice(
      $.named_tuple_element,
      $._expression
    ),

    // `name: Type` used in expression position — for example
    // `erase _: Op;` or `op<>(_: Value, _: ValueRange, _: Value)`.
    // Also accepts `op` as a variable name, which would otherwise be
    // shadowed by the `op_expr` keyword.
    variable_def: $ => prec(1, seq(
      choice($.identifier, alias('op', $.identifier)),
      ':',
      $.type_constraint
    )),

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
      optional(seq('<', optional(choice($.identifier, $.string)), '>')),
      optional($.expression_list),
      optional($.op_attributes),
      optional(seq('->', $.type_constraint))
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

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_$.-]*/,
    
    integer: $ => /[0-9]+/,

    string: $ => choice(
      seq('"', /[^"\n]*/, '"'),
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
