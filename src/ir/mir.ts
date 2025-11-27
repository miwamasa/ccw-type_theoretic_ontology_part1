// Morpheus Intermediate Representation (MIR)

// MIR Program
export interface MIRProgram {
  schemas: Map<string, MIRSchema>;
  enums: Map<string, MIREnum>;
  dimensions: Map<string, MIRDimension>;
  units: Map<string, MIRUnit>;
  lookups: Map<string, MIRLookup>;
  transforms: Map<string, MIRTransform>;
  pipelines: Map<string, MIRPipeline>;
}

// Schema
export interface MIRSchema {
  name: string;
  fields: MIRField[];
  genericParams: string[];
}

export interface MIRField {
  name: string;
  type: MIRType;
}

// Enum
export interface MIREnum {
  name: string;
  variants: string[];
}

// Dimension
export interface MIRDimension {
  name: string;
}

// Unit
export interface MIRUnit {
  name: string;
  dimensions: Map<string, number>;
  scale: number;
}

// Lookup
export interface MIRLookup {
  name: string;
  keyType: MIRType;
  valueType: MIRType;
  source?: string;
  hasDefault: boolean;
}

// Transform
export interface MIRTransform {
  name: string;
  sourceType: MIRType;
  targetType: MIRType;
  body: MIRBlock;
}

// Pipeline
export interface MIRPipeline {
  name: string;
  steps: MIRPipelineStep[];
}

export type MIRPipelineStep =
  | { kind: 'Transform'; name: string }
  | { kind: 'Parallel'; names: string[] }
  | { kind: 'Conditional'; condition: MIRValue; name: string };

// Types
export type MIRType =
  | { kind: 'Primitive'; name: 'String' | 'Int' | 'Float' | 'Bool' | 'Date' | 'DateTime' | 'Void' }
  | { kind: 'Schema'; name: string; genericArgs: MIRType[] }
  | { kind: 'Enum'; name: string }
  | { kind: 'Array'; element: MIRType }
  | { kind: 'Optional'; inner: MIRType }
  | { kind: 'Quantity'; unit: string }
  | { kind: 'Tuple'; elements: MIRType[] }
  | { kind: 'Union'; members: MIRType[] };

// Block
export interface MIRBlock {
  instructions: MIRInstruction[];
  result: MIRValue;
}

// Instructions
export type MIRInstruction =
  | MIRAssign
  | MIRFieldGet
  | MIRFieldSet
  | MIRBinOp
  | MIRUnaryOp
  | MIRCall
  | MIRLookupInstr
  | MIRAggregateInstr
  | MIRBranch;

export interface MIRAssign {
  kind: 'Assign';
  target: string;
  value: MIRValue;
}

export interface MIRFieldGet {
  kind: 'FieldGet';
  target: string;
  object: MIRValue;
  field: string;
}

export interface MIRFieldSet {
  kind: 'FieldSet';
  field: string;
  value: MIRValue;
}

export interface MIRBinOp {
  kind: 'BinOp';
  target: string;
  op: string;
  left: MIRValue;
  right: MIRValue;
}

export interface MIRUnaryOp {
  kind: 'UnaryOp';
  target: string;
  op: string;
  operand: MIRValue;
}

export interface MIRCall {
  kind: 'Call';
  target: string;
  func: string;
  args: MIRValue[];
}

export interface MIRLookupInstr {
  kind: 'Lookup';
  target: string;
  table: string;
  key: MIRValue;
  default?: MIRValue;
}

export interface MIRAggregateInstr {
  kind: 'Aggregate';
  target: string;
  func: string;
  source: MIRValue;
  lambdaParam: string;
  lambdaBody: MIRBlock;
}

export interface MIRBranch {
  kind: 'Branch';
  condition: MIRValue;
  thenBlock: MIRBlock;
  elseBlock: MIRBlock;
}

// Values
export type MIRValue =
  | { kind: 'Var'; name: string }
  | { kind: 'IntLit'; value: number }
  | { kind: 'FloatLit'; value: number }
  | { kind: 'StringLit'; value: string }
  | { kind: 'BoolLit'; value: boolean }
  | { kind: 'Null' }
  | { kind: 'SourceRef' }
  | { kind: 'TargetRef'; field: string };

// Helper functions
export function createMIRProgram(): MIRProgram {
  return {
    schemas: new Map(),
    enums: new Map(),
    dimensions: new Map(),
    units: new Map(),
    lookups: new Map(),
    transforms: new Map(),
    pipelines: new Map(),
  };
}
