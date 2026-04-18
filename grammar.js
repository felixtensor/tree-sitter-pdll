module.exports = grammar({
  name: 'pdll',

  extras: $ => [
    $.comment,
    /\s+/
  ],

  rules: {
    source_file: $ => repeat($._statement),

    _statement: $ => choice(
      $.include_directive,
      $.pattern_decl,
      $.constraint_decl,
      $.rewrite_decl,
      $._statement_inside_pattern
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
        seq('=>', $._statement_inside_pattern)
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
      'Constraint',
      $.identifier,
      optional($.argument_list),
      optional(seq('->', $.type_constraint)),
      choice(
        seq('{', repeat($._statement_inside_pattern), '}'),
        seq('=>', $._expression, ';'),
        seq($.code_block, ';'),
        ';'
      )
    ),

    rewrite_decl: $ => seq(
      'Rewrite',
      $.identifier,
      optional($.argument_list),
      optional(seq('->', $.type_constraint)),
      choice(
        seq('{', repeat($._statement_inside_pattern), '}'),
        seq('=>', $._expression, ';'),
        seq($.code_block, ';'),
        ';'
      )
    ),

    argument_list: $ => seq(
      '(',
      commaSep($.argument),
      ')'
    ),

    argument: $ => seq(
      optional(seq($.identifier, ':')),
      $.type_constraint
    ),

    type_constraint: $ => choice(
      seq('Op', optional(seq('<', choice($.identifier, $.string), '>'))),
      seq('Attr', optional(seq('<', $._type_constraint_param, '>'))),
      seq('Type', optional(seq('<', $._type_constraint_param, '>'))),
      seq('Value', optional(seq('<', $._type_constraint_param, '>'))),
      seq('ValueRange', optional(seq('<', $._type_constraint_param, '>'))),
      seq('TypeRange', optional(seq('<', $._type_constraint_param, '>'))),
      seq('[', commaSep($.type_constraint), ']'),
      $.identifier
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
      $.erase_stmt,
      $.replace_stmt,
      $.rewrite_stmt,
      $.return_stmt,
      $.not_stmt,
      seq($._expression, ';')
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
      $.call_expr,
      $.op_expr,
      $.attr_expr,
      $.type_expr,
      $.string,
      $.integer
    ),

    // `name: Type` used in expression position — for example
    // `erase _: Op;` or `op<>(_: Value, _: ValueRange, _: Value)`.
    variable_def: $ => prec(1, seq(
      $.identifier,
      ':',
      $.type_constraint
    )),

    call_expr: $ => seq(
      $.identifier,
      $.expression_list
    ),

    op_expr: $ => seq(
      'op',
      optional(seq('<', optional(choice($.identifier, $.string)), '>')),
      optional($.expression_list),
      optional(seq('->', choice($.type_constraint, seq('(', commaSep($.type_constraint), ')'))))
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
      repeat(choice(
        /[^\]]/,
        seq(']', /[^}]/)
      )),
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