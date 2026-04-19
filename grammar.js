module.exports = grammar({
  name: 'pdll',

  extras: $ => [
    $.comment,
    /\s+/
  ],

  word: $ => $.identifier,

  rules: {
    source_file: $ => repeat($._statement),

    _statement: $ => choice(
      $.include_directive,
      $.pattern_decl,
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
      optional($.identifier),
      optional($.argument_list),
      optional(seq('->', choice($.type_constraint, $.tuple_return_type))),
      choice(
        seq('{', repeat($._statement_inside_pattern), '}', optional(';')),
        seq('=>', $._expression, ';'),
        seq($.code_block, ';'),
        ';'
      )
    ),

    rewrite_decl: $ => seq(
      'Rewrite',
      optional($.identifier),
      optional($.argument_list),
      optional(seq('->', choice($.type_constraint, $.tuple_return_type))),
      choice(
        seq('{', repeat($._statement_inside_pattern), '}', optional(';')),
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

    // Used as a Constraint/Rewrite return signature: `-> (a: Attr, b: Type)`
    // or `-> (Attr, Type)`. Reuses the same shape as `argument` — a type
    // constraint with an optional leading `name:`.
    tuple_return_type: $ => seq(
      '(',
      commaSep($.argument),
      ')'
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
      $.constraint_decl,
      $.rewrite_decl,
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

    // Tuple expression: `(a, b)`, `(name = a, b)`, or a single named element
    // `(name = a)`. A single unnamed element would be ambiguous with a
    // parenthesised expression, so it's excluded.
    tuple_expr: $ => choice(
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

    call_expr: $ => seq(
      $.identifier,
      $.expression_list
    ),

    op_expr: $ => seq(
      'op',
      optional(seq('<', optional(choice($.identifier, $.string)), '>')),
      optional($.expression_list),
      optional($.op_attributes),
      optional(seq('->', choice($.type_constraint, $.tuple_return_type)))
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