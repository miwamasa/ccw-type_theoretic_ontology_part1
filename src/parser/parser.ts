// Parser for Morpheus DSL - Recursive Descent Parser

import { Token, TokenType, SourceSpan, createSourceSpan } from '../lexer/token';
import * as AST from './ast';

export class ParseError extends Error {
  constructor(
    message: string,
    public span: SourceSpan
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export class Parser {
  private tokens: Token[];
  private current = 0;
  private errors: ParseError[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  parse(): { program: AST.Program; errors: ParseError[] } {
    const declarations: AST.Declaration[] = [];

    while (!this.isAtEnd()) {
      try {
        const decl = this.declaration();
        if (decl) {
          declarations.push(decl);
        }
      } catch (e) {
        if (e instanceof ParseError) {
          this.errors.push(e);
        }
        this.synchronize();
      }
    }

    const program: AST.Program = {
      kind: 'Program',
      declarations,
      span: this.createSpan(0, this.current),
    };

    return { program, errors: this.errors };
  }

  // ========== Declarations ==========

  private declaration(): AST.Declaration | null {
    const annotations = this.parseAnnotations();

    if (this.match(TokenType.SCHEMA)) return this.schemaDecl(annotations);
    if (this.match(TokenType.ENUM)) return this.enumDecl(annotations);
    if (this.match(TokenType.DIMENSION)) return this.dimensionDecl();
    if (this.match(TokenType.UNIT)) return this.unitDecl();
    if (this.match(TokenType.LOOKUP)) return this.lookupDecl(annotations);
    if (this.match(TokenType.TRANSFORM)) return this.transformDecl(annotations);
    if (this.match(TokenType.PIPELINE)) return this.pipelineDecl(annotations);

    throw this.error('Expected declaration');
  }

  private schemaDecl(annotations: AST.Annotation[]): AST.SchemaDecl {
    const start = this.previous();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected schema name').lexeme;

    const genericParams = this.parseGenericParams();

    let extendsClause: string | undefined;
    if (this.match(TokenType.EXTENDS)) {
      extendsClause = this.consume(TokenType.IDENTIFIER, 'Expected schema name after extends').lexeme;
    }

    this.consume(TokenType.LBRACE, 'Expected \'{\' before schema body');

    const fields: AST.FieldDecl[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      fields.push(this.fieldDecl());
    }

    this.consume(TokenType.RBRACE, 'Expected \'}\' after schema body');

    return {
      kind: 'SchemaDecl',
      annotations,
      name,
      genericParams,
      extends: extendsClause,
      fields,
      span: this.createSpanFrom(start),
    };
  }

  private fieldDecl(): AST.FieldDecl {
    const start = this.peek();
    const annotations = this.parseAnnotations();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected field name').lexeme;
    this.consume(TokenType.COLON, 'Expected \':\' after field name');
    const type = this.typeExpr();

    return {
      kind: 'FieldDecl',
      annotations,
      name,
      type,
      span: this.createSpanFrom(start),
    };
  }

  private enumDecl(annotations: AST.Annotation[]): AST.EnumDecl {
    const start = this.previous();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected enum name').lexeme;

    this.consume(TokenType.LBRACE, 'Expected \'{\' before enum body');

    const variants: AST.EnumVariant[] = [];
    do {
      if (this.check(TokenType.RBRACE)) break;

      const variantStart = this.peek();
      const variantName = this.consume(TokenType.IDENTIFIER, 'Expected variant name').lexeme;

      let value: AST.Literal | undefined;
      if (this.match(TokenType.ASSIGN)) {
        value = this.literal();
      }

      variants.push({
        kind: 'EnumVariant',
        name: variantName,
        value,
        span: this.createSpanFrom(variantStart),
      });
    } while (this.match(TokenType.COMMA));

    this.consume(TokenType.RBRACE, 'Expected \'}\' after enum body');

    return {
      kind: 'EnumDecl',
      annotations,
      name,
      variants,
      span: this.createSpanFrom(start),
    };
  }

  private dimensionDecl(): AST.DimensionDecl {
    const start = this.previous();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected dimension name').lexeme;

    return {
      kind: 'DimensionDecl',
      name,
      span: this.createSpanFrom(start),
    };
  }

  private unitDecl(): AST.UnitDecl {
    const start = this.previous();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected unit name').lexeme;

    let dimension: string | undefined;
    let expr: AST.UnitExpr | undefined;

    if (this.match(TokenType.COLON)) {
      dimension = this.consume(TokenType.IDENTIFIER, 'Expected dimension name').lexeme;
    }

    if (this.match(TokenType.ASSIGN)) {
      expr = this.unitExpr();
    }

    return {
      kind: 'UnitDecl',
      name,
      dimension,
      expr,
      span: this.createSpanFrom(start),
    };
  }

  private lookupDecl(annotations: AST.Annotation[]): AST.LookupDecl {
    const start = this.previous();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected lookup name').lexeme;

    this.consume(TokenType.LBRACE, 'Expected \'{\' before lookup body');

    let keyType: AST.TypeExpr | null = null;
    let valueType: AST.TypeExpr | null = null;
    let source: string | undefined;
    let defaultValue: AST.Expr | undefined;

    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      const field = this.consume(TokenType.IDENTIFIER, 'Expected field name').lexeme;
      this.consume(TokenType.COLON, 'Expected \':\' after field name');

      switch (field) {
        case 'key':
          keyType = this.typeExpr();
          break;
        case 'value':
          valueType = this.typeExpr();
          break;
        case 'source':
          source = this.consume(TokenType.STRING_LITERAL, 'Expected string literal').literal;
          break;
        case 'default':
          defaultValue = this.expression();
          break;
        default:
          throw this.error(`Unknown lookup field: ${field}`);
      }
    }

    this.consume(TokenType.RBRACE, 'Expected \'}\' after lookup body');

    if (!keyType) throw this.error('Lookup must have a key type');
    if (!valueType) throw this.error('Lookup must have a value type');

    return {
      kind: 'LookupDecl',
      annotations,
      name,
      keyType,
      valueType,
      source,
      defaultValue,
      span: this.createSpanFrom(start),
    };
  }

  private transformDecl(annotations: AST.Annotation[]): AST.TransformDecl {
    const start = this.previous();

    const genericParams = this.parseGenericParams();

    const name = this.consume(TokenType.IDENTIFIER, 'Expected transform name').lexeme;
    this.consume(TokenType.COLON, 'Expected \':\' after transform name');

    const sourceType = this.typeExpr();
    this.consume(TokenType.RARROW, 'Expected \'->\' after source type');
    const targetType = this.typeExpr();

    const whereClause: AST.Constraint[] = [];
    if (this.match(TokenType.WHERE)) {
      do {
        whereClause.push(this.constraint());
      } while (this.match(TokenType.COMMA));
    }

    this.consume(TokenType.LBRACE, 'Expected \'{\' before transform body');

    const rules: AST.MappingRule[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      rules.push(this.mappingRule());
    }

    this.consume(TokenType.RBRACE, 'Expected \'}\' after transform body');

    return {
      kind: 'TransformDecl',
      annotations,
      name,
      genericParams,
      sourceType,
      targetType,
      whereClause,
      rules,
      span: this.createSpanFrom(start),
    };
  }

  private pipelineDecl(annotations: AST.Annotation[]): AST.PipelineDecl {
    const start = this.previous();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected pipeline name').lexeme;

    this.consume(TokenType.LBRACE, 'Expected \'{\' before pipeline body');

    const steps: AST.PipelineStep[] = [];
    while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
      steps.push(this.pipelineStep());
    }

    this.consume(TokenType.RBRACE, 'Expected \'}\' after pipeline body');

    return {
      kind: 'PipelineDecl',
      annotations,
      name,
      steps,
      span: this.createSpanFrom(start),
    };
  }

  // ========== Type expressions ==========

  private typeExpr(): AST.TypeExpr {
    let type = this.primaryType();

    // Handle optional (?)
    if (this.match(TokenType.QUESTION)) {
      const span = this.createSpanFrom(this.tokens[this.current - 2]);
      type = {
        kind: 'OptionalType',
        inner: type,
        span,
      };
    }

    // Handle union (|)
    if (this.check(TokenType.PIPE)) {
      const members: AST.TypeExpr[] = [type];
      while (this.match(TokenType.PIPE)) {
        members.push(this.primaryType());
      }
      const span = this.createSpanFrom(this.tokens[this.current - members.length]);
      type = {
        kind: 'UnionType',
        members,
        span,
      };
    }

    return type;
  }

  private primaryType(): AST.TypeExpr {
    const start = this.peek();

    // Array type
    if (this.match(TokenType.LBRACKET)) {
      const element = this.typeExpr();
      this.consume(TokenType.RBRACKET, 'Expected \']\' after array element type');
      return {
        kind: 'ArrayType',
        element,
        span: this.createSpanFrom(start),
      };
    }

    // Tuple type
    if (this.match(TokenType.LPAREN)) {
      const elements: AST.TypeExpr[] = [];
      do {
        if (this.check(TokenType.RPAREN)) break;
        elements.push(this.typeExpr());
      } while (this.match(TokenType.COMMA));

      this.consume(TokenType.RPAREN, 'Expected \')\' after tuple elements');

      if (elements.length === 1) {
        return elements[0]; // Parenthesized type
      }

      return {
        kind: 'TupleType',
        elements,
        span: this.createSpanFrom(start),
      };
    }

    // Primitive types
    if (this.match(TokenType.STRING, TokenType.INT, TokenType.FLOAT, TokenType.BOOL,
                    TokenType.DATE, TokenType.DATETIME, TokenType.VOID)) {
      const name = this.previous().lexeme as any;
      return {
        kind: 'PrimitiveType',
        name,
        span: this.createSpanFrom(start),
      };
    }

    // Quantity type
    if (this.match(TokenType.QUANTITY)) {
      this.consume(TokenType.LT, 'Expected \'<\' after Quantity');
      const unit = this.unitExpr();
      this.consume(TokenType.GT, 'Expected \'>\' after unit');
      return {
        kind: 'QuantityType',
        unit,
        span: this.createSpanFrom(start),
      };
    }

    // Schema or Enum reference
    if (this.check(TokenType.IDENTIFIER)) {
      const name = this.advance().lexeme;
      const genericArgs: AST.TypeExpr[] = [];

      if (this.match(TokenType.LT)) {
        do {
          genericArgs.push(this.typeExpr());
        } while (this.match(TokenType.COMMA));
        this.consume(TokenType.GT, 'Expected \'>\' after generic arguments');
      }

      return {
        kind: 'SchemaRef',
        name,
        genericArgs,
        span: this.createSpanFrom(start),
      };
    }

    throw this.error('Expected type expression');
  }

  // ========== Unit expressions ==========

  private unitExpr(): AST.UnitExpr {
    return this.unitMulDiv();
  }

  private unitMulDiv(): AST.UnitExpr {
    let expr = this.unitPow();

    while (this.match(TokenType.STAR, TokenType.SLASH)) {
      const op = this.previous().type;
      const right = this.unitPow();
      const span = expr.span; // Simplified

      if (op === TokenType.STAR) {
        expr = {
          kind: 'UnitMul',
          left: expr,
          right,
          span,
        };
      } else {
        expr = {
          kind: 'UnitDiv',
          left: expr,
          right,
          span,
        };
      }
    }

    return expr;
  }

  private unitPow(): AST.UnitExpr {
    let expr = this.unitPrimary();

    if (this.match(TokenType.CARET)) {
      const exponent = this.consume(TokenType.INT_LITERAL, 'Expected integer exponent').literal;
      expr = {
        kind: 'UnitPow',
        base: expr,
        exponent,
        span: expr.span,
      };
    }

    return expr;
  }

  private unitPrimary(): AST.UnitExpr {
    const start = this.peek();

    if (this.match(TokenType.LPAREN)) {
      const expr = this.unitExpr();
      this.consume(TokenType.RPAREN, 'Expected \')\' after unit expression');
      return expr;
    }

    if (this.check(TokenType.INT_LITERAL) && this.peek().literal === 1) {
      this.advance();
      return {
        kind: 'UnitOne',
        span: this.createSpanFrom(start),
      };
    }

    if (this.check(TokenType.IDENTIFIER)) {
      const name = this.advance().lexeme;
      return {
        kind: 'UnitRef',
        name,
        span: this.createSpanFrom(start),
      };
    }

    throw this.error('Expected unit expression');
  }

  // ========== Mapping rules ==========

  private mappingRule(): AST.MappingRule {
    const start = this.peek();
    const targetPath: string[] = [];

    // Parse target path
    targetPath.push(this.consume(TokenType.IDENTIFIER, 'Expected field name').lexeme);

    while (this.match(TokenType.DOT)) {
      targetPath.push(this.consume(TokenType.IDENTIFIER, 'Expected field name after \'.\'').lexeme);
    }

    this.consume(TokenType.LARROW, 'Expected \'<-\' in mapping rule');

    const sourceExpr = this.expression();

    return {
      kind: 'MappingRule',
      targetPath,
      sourceExpr,
      span: this.createSpanFrom(start),
    };
  }

  // ========== Expressions ==========

  private expression(): AST.Expr {
    return this.nullishCoalesce();
  }

  private nullishCoalesce(): AST.Expr {
    let expr = this.or();

    while (this.match(TokenType.NULLISH)) {
      const right = this.or();
      const span = expr.span; // Simplified
      expr = {
        kind: 'BinaryExpr',
        op: '??',
        left: expr,
        right,
        span,
      };
    }

    return expr;
  }

  private or(): AST.Expr {
    let expr = this.and();

    while (this.match(TokenType.OR)) {
      const right = this.and();
      const span = expr.span; // Simplified
      expr = {
        kind: 'BinaryExpr',
        op: '||',
        left: expr,
        right,
        span,
      };
    }

    return expr;
  }

  private and(): AST.Expr {
    let expr = this.equality();

    while (this.match(TokenType.AND)) {
      const right = this.equality();
      const span = expr.span; // Simplified
      expr = {
        kind: 'BinaryExpr',
        op: '&&',
        left: expr,
        right,
        span,
      };
    }

    return expr;
  }

  private equality(): AST.Expr {
    let expr = this.comparison();

    while (this.match(TokenType.EQ, TokenType.NEQ)) {
      const op = this.previous().type === TokenType.EQ ? '==' : '!=';
      const right = this.comparison();
      const span = expr.span; // Simplified
      expr = {
        kind: 'BinaryExpr',
        op: op as AST.BinaryOp,
        left: expr,
        right,
        span,
      };
    }

    return expr;
  }

  private comparison(): AST.Expr {
    let expr = this.additive();

    while (this.match(TokenType.LT, TokenType.GT, TokenType.LTE, TokenType.GTE)) {
      const prev = this.previous();
      let op: AST.BinaryOp;
      switch (prev.type) {
        case TokenType.LT: op = '<'; break;
        case TokenType.GT: op = '>'; break;
        case TokenType.LTE: op = '<='; break;
        case TokenType.GTE: op = '>='; break;
        default: throw this.error('Invalid comparison operator');
      }

      const right = this.additive();
      const span = expr.span; // Simplified
      expr = {
        kind: 'BinaryExpr',
        op,
        left: expr,
        right,
        span,
      };
    }

    return expr;
  }

  private additive(): AST.Expr {
    let expr = this.multiplicative();

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const op = this.previous().type === TokenType.PLUS ? '+' : '-';
      const right = this.multiplicative();
      const span = expr.span; // Simplified
      expr = {
        kind: 'BinaryExpr',
        op: op as AST.BinaryOp,
        left: expr,
        right,
        span,
      };
    }

    return expr;
  }

  private multiplicative(): AST.Expr {
    let expr = this.unary();

    while (this.match(TokenType.STAR, TokenType.SLASH, TokenType.PERCENT, TokenType.CARET)) {
      const prev = this.previous();
      let op: AST.BinaryOp;
      switch (prev.type) {
        case TokenType.STAR: op = '*'; break;
        case TokenType.SLASH: op = '/'; break;
        case TokenType.PERCENT: op = '%'; break;
        case TokenType.CARET: op = '^'; break;
        default: throw this.error('Invalid multiplicative operator');
      }

      const right = this.unary();
      const span = expr.span; // Simplified
      expr = {
        kind: 'BinaryExpr',
        op,
        left: expr,
        right,
        span,
      };
    }

    return expr;
  }

  private unary(): AST.Expr {
    if (this.match(TokenType.NOT, TokenType.MINUS)) {
      const op = this.previous().type === TokenType.NOT ? '!' : '-';
      const start = this.previous();
      const operand = this.unary();
      return {
        kind: 'UnaryExpr',
        op: op as AST.UnaryOp,
        operand,
        span: this.createSpanFrom(start),
      };
    }

    return this.postfix();
  }

  private postfix(): AST.Expr {
    let expr = this.primary();

    while (true) {
      if (this.match(TokenType.DOT, TokenType.QDOT)) {
        const optional = this.previous().type === TokenType.QDOT;
        const field = this.consume(TokenType.IDENTIFIER, 'Expected field name after \'.\'').lexeme;

        // Extend path expression
        if (expr.kind === 'PathExpr') {
          expr.segments.push({ kind: 'FieldAccess', field, optional });
        } else {
          // This shouldn't happen in well-formed code
          throw this.error('Field access on non-path expression');
        }
      } else if (this.match(TokenType.LBRACKET)) {
        const index = this.expression();
        this.consume(TokenType.RBRACKET, 'Expected \']\' after index');

        if (expr.kind === 'PathExpr') {
          expr.segments.push({ kind: 'IndexAccess', index });
        } else {
          throw this.error('Index access on non-path expression');
        }
      } else if (this.match(TokenType.LPAREN)) {
        // Function call (not yet implemented in detail)
        const args: AST.Expr[] = [];
        if (!this.check(TokenType.RPAREN)) {
          do {
            args.push(this.expression());
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, 'Expected \')\' after arguments');
        // For now, skip this
        break;
      } else {
        break;
      }
    }

    return expr;
  }

  private primary(): AST.Expr {
    const start = this.peek();

    // Literals
    if (this.match(TokenType.INT_LITERAL, TokenType.FLOAT_LITERAL, TokenType.STRING_LITERAL, TokenType.BOOL_LITERAL)) {
      return this.literal();
    }

    // Path expression ($)
    if (this.match(TokenType.DOLLAR)) {
      let sourceIndex: number | undefined;

      // Check for source index ($0, $1, etc.)
      if (this.check(TokenType.INT_LITERAL)) {
        sourceIndex = this.advance().literal;
      }

      const segments: AST.PathSegment[] = [];

      while (this.match(TokenType.DOT, TokenType.QDOT)) {
        const optional = this.previous().type === TokenType.QDOT;
        const field = this.consume(TokenType.IDENTIFIER, 'Expected field name').lexeme;
        segments.push({ kind: 'FieldAccess', field, optional });
      }

      return {
        kind: 'PathExpr',
        sourceIndex,
        segments,
        span: this.createSpanFrom(start),
      };
    }

    // Target reference (@)
    if (this.match(TokenType.AT)) {
      const field = this.consume(TokenType.IDENTIFIER, 'Expected field name after \'@\'').lexeme;
      return {
        kind: 'TargetRef',
        field,
        span: this.createSpanFrom(start),
      };
    }

    // If expression
    if (this.match(TokenType.IF)) {
      const condition = this.expression();
      this.consume(TokenType.THEN, 'Expected \'then\' after condition');
      const thenExpr = this.expression();
      this.consume(TokenType.ELSE, 'Expected \'else\' after then branch');
      const elseExpr = this.expression();

      return {
        kind: 'IfExpr',
        condition,
        thenExpr,
        elseExpr,
        span: this.createSpanFrom(start),
      };
    }

    // Match expression
    if (this.match(TokenType.MATCH)) {
      const scrutinee = this.expression();
      this.consume(TokenType.LBRACE, 'Expected \'{\' after match scrutinee');

      const cases: AST.MatchCase[] = [];
      while (!this.check(TokenType.RBRACE) && !this.isAtEnd()) {
        cases.push(this.matchCase());
      }

      this.consume(TokenType.RBRACE, 'Expected \'}\' after match cases');

      return {
        kind: 'MatchExpr',
        scrutinee,
        cases,
        span: this.createSpanFrom(start),
      };
    }

    // Lambda expression (|x| ...)
    if (this.match(TokenType.PIPE)) {
      const param = this.consume(TokenType.IDENTIFIER, 'Expected parameter name').lexeme;

      let paramType: AST.TypeExpr | undefined;
      if (this.match(TokenType.COLON)) {
        paramType = this.typeExpr();
      }

      this.consume(TokenType.PIPE, 'Expected \'|\' after lambda parameter');

      const body = this.expression();

      return {
        kind: 'LambdaExpr',
        param,
        paramType,
        body,
        span: this.createSpanFrom(start),
      };
    }

    // Aggregate functions
    if (this.match(TokenType.SUM, TokenType.AVG, TokenType.MAX, TokenType.MIN,
                    TokenType.COUNT, TokenType.COLLECT, TokenType.FILTER, TokenType.GROUPBY)) {
      const func = this.previous().lexeme.toLowerCase() as AST.AggregateFunc;
      this.consume(TokenType.LPAREN, `Expected '(' after '${func}'`);
      const source = this.expression();
      this.consume(TokenType.COMMA, 'Expected \',\' after source expression');
      const lambda = this.expression() as AST.LambdaExpr;

      if (lambda.kind !== 'LambdaExpr') {
        throw this.error('Expected lambda expression as second argument');
      }

      this.consume(TokenType.RPAREN, `Expected ')' after ${func} arguments`);

      return {
        kind: 'AggregateExpr',
        func,
        source,
        lambda,
        span: this.createSpanFrom(start),
      };
    }

    // Lookup function
    if (this.match(TokenType.LOOKUP)) {
      this.consume(TokenType.LPAREN, 'Expected \'(\' after \'lookup\'');
      const table = this.consume(TokenType.IDENTIFIER, 'Expected table name').lexeme;
      this.consume(TokenType.COMMA, 'Expected \',\' after table name');
      const key = this.expression();

      let defaultValue: AST.Expr | undefined;
      if (this.match(TokenType.COMMA)) {
        defaultValue = this.expression();
      }

      this.consume(TokenType.RPAREN, 'Expected \')\' after lookup arguments');

      return {
        kind: 'LookupExpr',
        table,
        key,
        defaultValue,
        span: this.createSpanFrom(start),
      };
    }

    // Parenthesized expression
    if (this.match(TokenType.LPAREN)) {
      const expr = this.expression();
      this.consume(TokenType.RPAREN, 'Expected \')\' after expression');
      return expr;
    }

    throw this.error('Expected expression');
  }

  private literal(): AST.Literal {
    const token = this.previous();
    const start = token;

    let type: 'Int' | 'Float' | 'String' | 'Bool' | 'Null';
    let value: any;

    switch (token.type) {
      case TokenType.INT_LITERAL:
        type = 'Int';
        value = token.literal;
        break;
      case TokenType.FLOAT_LITERAL:
        type = 'Float';
        value = token.literal;
        break;
      case TokenType.STRING_LITERAL:
        type = 'String';
        value = token.literal;
        break;
      case TokenType.BOOL_LITERAL:
        type = 'Bool';
        value = token.literal;
        break;
      default:
        throw this.error('Expected literal');
    }

    return {
      kind: 'Literal',
      type,
      value,
      span: start.span,
    };
  }

  // ========== Pipeline steps ==========

  private pipelineStep(): AST.PipelineStep {
    const start = this.peek();

    if (this.match(TokenType.PARALLEL)) {
      this.consume(TokenType.LBRACE, 'Expected \'{\' after \'parallel\'');

      const transforms: string[] = [];
      do {
        transforms.push(this.consume(TokenType.IDENTIFIER, 'Expected transform name').lexeme);
      } while (this.match(TokenType.COMMA));

      this.consume(TokenType.RBRACE, 'Expected \'}\' after parallel transforms');

      return {
        kind: 'ParallelStep',
        transforms,
        span: this.createSpanFrom(start),
      };
    }

    if (this.match(TokenType.WHEN)) {
      const condition = this.expression();
      this.consume(TokenType.COLON, 'Expected \':\' after condition');
      const transform = this.consume(TokenType.IDENTIFIER, 'Expected transform name').lexeme;

      return {
        kind: 'ConditionalStep',
        condition,
        transform,
        span: this.createSpanFrom(start),
      };
    }

    const name = this.consume(TokenType.IDENTIFIER, 'Expected transform name').lexeme;
    return {
      kind: 'TransformStep',
      name,
      span: this.createSpanFrom(start),
    };
  }

  private matchCase(): AST.MatchCase {
    const start = this.peek();
    const pattern = this.pattern();
    this.consume(TokenType.FAT_ARROW, 'Expected \'=>\' after pattern');
    const body = this.expression();

    return {
      kind: 'MatchCase',
      pattern,
      body,
      span: this.createSpanFrom(start),
    };
  }

  private pattern(): AST.Pattern {
    if (this.match(TokenType.INT_LITERAL, TokenType.FLOAT_LITERAL, TokenType.STRING_LITERAL, TokenType.BOOL_LITERAL)) {
      return {
        kind: 'LiteralPattern',
        value: this.literal(),
      };
    }

    if (this.check(TokenType.IDENTIFIER) && this.peek().lexeme === '_') {
      this.advance();
      return { kind: 'WildcardPattern' };
    }

    if (this.check(TokenType.IDENTIFIER)) {
      const name = this.advance().lexeme;
      return {
        kind: 'IdentifierPattern',
        name,
      };
    }

    throw this.error('Expected pattern');
  }

  // ========== Helpers ==========

  private parseAnnotations(): AST.Annotation[] {
    const annotations: AST.Annotation[] = [];

    while (this.check(TokenType.AT) && this.peekNext()?.type === TokenType.IDENTIFIER) {
      const start = this.advance(); // @
      const name = this.advance().lexeme;
      const args: AST.AnnotationArg[] = [];

      if (this.match(TokenType.LPAREN)) {
        if (!this.check(TokenType.RPAREN)) {
          do {
            // Check for named argument
            if (this.check(TokenType.IDENTIFIER) && this.peekNext()?.type === TokenType.COLON) {
              const argName = this.advance().lexeme;
              this.advance(); // :
              const value = this.literal();
              args.push({ kind: 'Named', name: argName, value });
            } else {
              const value = this.literal();
              args.push({ kind: 'Positional', value });
            }
          } while (this.match(TokenType.COMMA));
        }
        this.consume(TokenType.RPAREN, 'Expected \')\' after annotation arguments');
      }

      annotations.push({
        kind: 'Annotation',
        name,
        args,
        span: start.span,
      });
    }

    return annotations;
  }

  private parseGenericParams(): string[] {
    if (!this.match(TokenType.LT)) return [];

    const params: string[] = [];
    do {
      params.push(this.consume(TokenType.IDENTIFIER, 'Expected generic parameter name').lexeme);
    } while (this.match(TokenType.COMMA));

    this.consume(TokenType.GT, 'Expected \'>\' after generic parameters');
    return params;
  }

  private constraint(): AST.Constraint {
    const start = this.peek();
    const name = this.consume(TokenType.IDENTIFIER, 'Expected constraint name').lexeme;

    this.consume(TokenType.LT, 'Expected \'<\' after constraint name');

    const args: AST.TypeExpr[] = [];
    do {
      args.push(this.typeExpr());
    } while (this.match(TokenType.COMMA));

    this.consume(TokenType.GT, 'Expected \'>\' after constraint arguments');

    return {
      kind: 'Constraint',
      name,
      args,
      span: this.createSpanFrom(start),
    };
  }

  // ========== Utility methods ==========

  private match(...types: TokenType[]): boolean {
    for (const type of types) {
      if (this.check(type)) {
        this.advance();
        return true;
      }
    }
    return false;
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous();
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  private peek(): Token {
    return this.tokens[this.current];
  }

  private peekNext(): Token | null {
    if (this.current + 1 >= this.tokens.length) return null;
    return this.tokens[this.current + 1];
  }

  private previous(): Token {
    return this.tokens[this.current - 1];
  }

  private consume(type: TokenType, message: string): Token {
    if (this.check(type)) return this.advance();
    throw this.error(message);
  }

  private error(message: string): ParseError {
    const token = this.peek();
    return new ParseError(message, token.span);
  }

  private synchronize(): void {
    this.advance();

    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.RBRACE) return;

      switch (this.peek().type) {
        case TokenType.SCHEMA:
        case TokenType.ENUM:
        case TokenType.UNIT:
        case TokenType.DIMENSION:
        case TokenType.LOOKUP:
        case TokenType.TRANSFORM:
        case TokenType.PIPELINE:
          return;
      }

      this.advance();
    }
  }

  private createSpan(start: number, end: number): SourceSpan {
    if (start >= this.tokens.length) start = this.tokens.length - 1;
    if (end >= this.tokens.length) end = this.tokens.length - 1;

    return createSourceSpan(
      this.tokens[start].span.start,
      this.tokens[end].span.end,
      this.tokens[start].span.file
    );
  }

  private createSpanFrom(start: Token): SourceSpan {
    const end = this.previous();
    return createSourceSpan(start.span.start, end.span.end, start.span.file);
  }
}
