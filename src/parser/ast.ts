// AST (Abstract Syntax Tree) definitions for Morpheus DSL

import { SourceSpan } from '../lexer/token';

// Base AST node
export interface ASTNode {
  kind: string;
  span: SourceSpan;
}

// Program
export interface Program extends ASTNode {
  kind: 'Program';
  declarations: Declaration[];
}

// Declarations
export type Declaration =
  | SchemaDecl
  | EnumDecl
  | UnitDecl
  | DimensionDecl
  | LookupDecl
  | TransformDecl
  | PipelineDecl
  | ConstraintDecl;

export interface SchemaDecl extends ASTNode {
  kind: 'SchemaDecl';
  annotations: Annotation[];
  name: string;
  genericParams: string[];
  extends?: string;
  fields: FieldDecl[];
}

export interface FieldDecl extends ASTNode {
  kind: 'FieldDecl';
  annotations: Annotation[];
  name: string;
  type: TypeExpr;
}

export interface EnumDecl extends ASTNode {
  kind: 'EnumDecl';
  annotations: Annotation[];
  name: string;
  variants: EnumVariant[];
}

export interface EnumVariant extends ASTNode {
  kind: 'EnumVariant';
  name: string;
  value?: Literal;
}

export interface DimensionDecl extends ASTNode {
  kind: 'DimensionDecl';
  name: string;
}

export interface UnitDecl extends ASTNode {
  kind: 'UnitDecl';
  name: string;
  dimension?: string;
  expr?: UnitExpr;
}

export interface LookupDecl extends ASTNode {
  kind: 'LookupDecl';
  annotations: Annotation[];
  name: string;
  keyType: TypeExpr;
  valueType: TypeExpr;
  source?: string;
  defaultValue?: Expr;
}

export interface TransformDecl extends ASTNode {
  kind: 'TransformDecl';
  annotations: Annotation[];
  name: string;
  genericParams: string[];
  sourceType: TypeExpr;
  targetType: TypeExpr;
  whereClause: Constraint[];
  rules: MappingRule[];
}

export interface PipelineDecl extends ASTNode {
  kind: 'PipelineDecl';
  annotations: Annotation[];
  name: string;
  steps: PipelineStep[];
}

export interface ConstraintDecl extends ASTNode {
  kind: 'ConstraintDecl';
  name: string;
  params: string[];
}

// Annotations
export interface Annotation extends ASTNode {
  kind: 'Annotation';
  name: string;
  args: AnnotationArg[];
}

export type AnnotationArg =
  | { kind: 'Named'; name: string; value: Literal }
  | { kind: 'Positional'; value: Literal };

// Type expressions
export type TypeExpr =
  | PrimitiveType
  | SchemaRef
  | EnumRef
  | ArrayType
  | OptionalType
  | QuantityType
  | TupleType
  | UnionType
  | GenericType;

export interface PrimitiveType extends ASTNode {
  kind: 'PrimitiveType';
  name: 'String' | 'Int' | 'Float' | 'Bool' | 'Date' | 'DateTime' | 'Void';
}

export interface SchemaRef extends ASTNode {
  kind: 'SchemaRef';
  name: string;
  genericArgs: TypeExpr[];
}

export interface EnumRef extends ASTNode {
  kind: 'EnumRef';
  name: string;
}

export interface ArrayType extends ASTNode {
  kind: 'ArrayType';
  element: TypeExpr;
}

export interface OptionalType extends ASTNode {
  kind: 'OptionalType';
  inner: TypeExpr;
}

export interface QuantityType extends ASTNode {
  kind: 'QuantityType';
  unit: UnitExpr;
}

export interface TupleType extends ASTNode {
  kind: 'TupleType';
  elements: TypeExpr[];
}

export interface UnionType extends ASTNode {
  kind: 'UnionType';
  members: TypeExpr[];
}

export interface GenericType extends ASTNode {
  kind: 'GenericType';
  name: string;
}

// Unit expressions
export type UnitExpr =
  | UnitRef
  | UnitMul
  | UnitDiv
  | UnitPow
  | UnitOne;

export interface UnitRef extends ASTNode {
  kind: 'UnitRef';
  name: string;
}

export interface UnitMul extends ASTNode {
  kind: 'UnitMul';
  left: UnitExpr;
  right: UnitExpr;
}

export interface UnitDiv extends ASTNode {
  kind: 'UnitDiv';
  left: UnitExpr;
  right: UnitExpr;
}

export interface UnitPow extends ASTNode {
  kind: 'UnitPow';
  base: UnitExpr;
  exponent: number;
}

export interface UnitOne extends ASTNode {
  kind: 'UnitOne';
}

// Mapping rules
export interface MappingRule extends ASTNode {
  kind: 'MappingRule';
  targetPath: string[];
  sourceExpr: Expr;
}

// Constraints
export interface Constraint extends ASTNode {
  kind: 'Constraint';
  name: string;
  args: TypeExpr[];
}

// Expressions
export type Expr =
  | Literal
  | PathExpr
  | TargetRef
  | BinaryExpr
  | UnaryExpr
  | IfExpr
  | MatchExpr
  | LambdaExpr
  | AggregateExpr
  | LookupExpr
  | CallExpr;

export interface Literal extends ASTNode {
  kind: 'Literal';
  type: 'Int' | 'Float' | 'String' | 'Bool' | 'Null';
  value: any;
}

export interface PathExpr extends ASTNode {
  kind: 'PathExpr';
  sourceIndex?: number; // For multiple source case: $0, $1, etc.
  segments: PathSegment[];
}

export type PathSegment =
  | { kind: 'FieldAccess'; field: string; optional: boolean }
  | { kind: 'IndexAccess'; index: Expr };

export interface TargetRef extends ASTNode {
  kind: 'TargetRef';
  field: string;
}

export interface BinaryExpr extends ASTNode {
  kind: 'BinaryExpr';
  op: BinaryOp;
  left: Expr;
  right: Expr;
}

export type BinaryOp =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '^'
  | '=='
  | '!='
  | '<'
  | '>'
  | '<='
  | '>='
  | '&&'
  | '||'
  | '??';

export interface UnaryExpr extends ASTNode {
  kind: 'UnaryExpr';
  op: UnaryOp;
  operand: Expr;
}

export type UnaryOp = '!' | '-';

export interface IfExpr extends ASTNode {
  kind: 'IfExpr';
  condition: Expr;
  thenExpr: Expr;
  elseExpr: Expr;
}

export interface MatchExpr extends ASTNode {
  kind: 'MatchExpr';
  scrutinee: Expr;
  cases: MatchCase[];
}

export interface MatchCase extends ASTNode {
  kind: 'MatchCase';
  pattern: Pattern;
  body: Expr;
}

export type Pattern =
  | { kind: 'LiteralPattern'; value: Literal }
  | { kind: 'IdentifierPattern'; name: string }
  | { kind: 'WildcardPattern' };

export interface LambdaExpr extends ASTNode {
  kind: 'LambdaExpr';
  param: string;
  paramType?: TypeExpr;
  body: Expr;
}

export interface AggregateExpr extends ASTNode {
  kind: 'AggregateExpr';
  func: AggregateFunc;
  source: Expr;
  lambda: LambdaExpr;
}

export type AggregateFunc =
  | 'sum'
  | 'avg'
  | 'max'
  | 'min'
  | 'count'
  | 'collect'
  | 'filter'
  | 'groupBy';

export interface LookupExpr extends ASTNode {
  kind: 'LookupExpr';
  table: string;
  key: Expr;
  defaultValue?: Expr;
}

export interface CallExpr extends ASTNode {
  kind: 'CallExpr';
  func: string;
  args: Expr[];
}

// Pipeline steps
export type PipelineStep =
  | TransformStep
  | ParallelStep
  | ConditionalStep;

export interface TransformStep extends ASTNode {
  kind: 'TransformStep';
  name: string;
}

export interface ParallelStep extends ASTNode {
  kind: 'ParallelStep';
  transforms: string[];
}

export interface ConditionalStep extends ASTNode {
  kind: 'ConditionalStep';
  condition: Expr;
  transform: string;
}
