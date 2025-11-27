// Token type definitions for Morpheus DSL

export enum TokenType {
  // Literals
  INT_LITERAL = 'INT_LITERAL',
  FLOAT_LITERAL = 'FLOAT_LITERAL',
  STRING_LITERAL = 'STRING_LITERAL',
  BOOL_LITERAL = 'BOOL_LITERAL',

  // Identifier
  IDENTIFIER = 'IDENTIFIER',

  // Keywords
  SCHEMA = 'SCHEMA',
  ENUM = 'ENUM',
  UNIT = 'UNIT',
  DIMENSION = 'DIMENSION',
  LOOKUP = 'LOOKUP',
  TRANSFORM = 'TRANSFORM',
  PIPELINE = 'PIPELINE',
  CONSTRAINT = 'CONSTRAINT',
  INFER = 'INFER',
  HINTS = 'HINTS',
  IF = 'IF',
  THEN = 'THEN',
  ELSE = 'ELSE',
  MATCH = 'MATCH',
  WHEN = 'WHEN',
  WHERE = 'WHERE',
  EXTENDS = 'EXTENDS',
  PARALLEL = 'PARALLEL',

  // Aggregate functions
  SUM = 'SUM',
  AVG = 'AVG',
  MAX = 'MAX',
  MIN = 'MIN',
  COUNT = 'COUNT',
  COLLECT = 'COLLECT',
  FILTER = 'FILTER',
  GROUPBY = 'GROUPBY',

  // Type keywords
  STRING = 'STRING',
  INT = 'INT',
  FLOAT = 'FLOAT',
  BOOL = 'BOOL',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  VOID = 'VOID',
  QUANTITY = 'QUANTITY',

  // Operators
  PLUS = 'PLUS',             // +
  MINUS = 'MINUS',           // -
  STAR = 'STAR',             // *
  SLASH = 'SLASH',           // /
  CARET = 'CARET',           // ^
  PERCENT = 'PERCENT',       // %
  ASSIGN = 'ASSIGN',         // =
  EQ = 'EQ',                 // ==
  NEQ = 'NEQ',               // !=
  LT = 'LT',                 // <
  GT = 'GT',                 // >
  LTE = 'LTE',               // <=
  GTE = 'GTE',               // >=
  AND = 'AND',               // &&
  OR = 'OR',                 // ||
  NOT = 'NOT',               // !
  LARROW = 'LARROW',         // <-
  RARROW = 'RARROW',         // ->
  FAT_ARROW = 'FAT_ARROW',   // =>
  TILDE_ARROW = 'TILDE_ARROW', // ~>
  DOT = 'DOT',               // .
  QDOT = 'QDOT',             // ?.
  NULLISH = 'NULLISH',       // ??
  AT = 'AT',                 // @
  DOLLAR = 'DOLLAR',         // $
  COLON = 'COLON',           // :
  DOUBLE_COLON = 'DOUBLE_COLON', // ::
  PIPE = 'PIPE',             // |
  COMMA = 'COMMA',           // ,
  QUESTION = 'QUESTION',     // ?

  // Brackets
  LPAREN = 'LPAREN',         // (
  RPAREN = 'RPAREN',         // )
  LBRACE = 'LBRACE',         // {
  RBRACE = 'RBRACE',         // }
  LBRACKET = 'LBRACKET',     // [
  RBRACKET = 'RBRACKET',     // ]

  // Special
  EOF = 'EOF',
  ERROR = 'ERROR',
}

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface SourceSpan {
  start: SourceLocation;
  end: SourceLocation;
  file: string;
}

export interface Token {
  type: TokenType;
  lexeme: string;
  literal?: any;
  span: SourceSpan;
}

export const KEYWORDS: Map<string, TokenType> = new Map([
  ['schema', TokenType.SCHEMA],
  ['enum', TokenType.ENUM],
  ['unit', TokenType.UNIT],
  ['dimension', TokenType.DIMENSION],
  ['lookup', TokenType.LOOKUP],
  ['transform', TokenType.TRANSFORM],
  ['pipeline', TokenType.PIPELINE],
  ['constraint', TokenType.CONSTRAINT],
  ['infer', TokenType.INFER],
  ['hints', TokenType.HINTS],
  ['if', TokenType.IF],
  ['then', TokenType.THEN],
  ['else', TokenType.ELSE],
  ['match', TokenType.MATCH],
  ['when', TokenType.WHEN],
  ['where', TokenType.WHERE],
  ['extends', TokenType.EXTENDS],
  ['parallel', TokenType.PARALLEL],
  ['sum', TokenType.SUM],
  ['avg', TokenType.AVG],
  ['max', TokenType.MAX],
  ['min', TokenType.MIN],
  ['count', TokenType.COUNT],
  ['collect', TokenType.COLLECT],
  ['filter', TokenType.FILTER],
  ['groupBy', TokenType.GROUPBY],
  ['String', TokenType.STRING],
  ['Int', TokenType.INT],
  ['Float', TokenType.FLOAT],
  ['Bool', TokenType.BOOL],
  ['Date', TokenType.DATE],
  ['DateTime', TokenType.DATETIME],
  ['Void', TokenType.VOID],
  ['Quantity', TokenType.QUANTITY],
  ['true', TokenType.BOOL_LITERAL],
  ['false', TokenType.BOOL_LITERAL],
]);

export function createSourceLocation(line: number, column: number, offset: number): SourceLocation {
  return { line, column, offset };
}

export function createSourceSpan(start: SourceLocation, end: SourceLocation, file: string): SourceSpan {
  return { start, end, file };
}

export function createToken(
  type: TokenType,
  lexeme: string,
  span: SourceSpan,
  literal?: any
): Token {
  return { type, lexeme, span, literal };
}
