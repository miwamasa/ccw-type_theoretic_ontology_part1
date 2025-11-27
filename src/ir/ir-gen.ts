// IR Generator - Converts AST to MIR

import * as AST from '../parser/ast';
import * as MIR from './mir';
import { SymbolTable } from '../analyzer/scope';

export class IRGenerator {
  private program: MIR.MIRProgram;
  private tempCounter = 0;

  constructor(_symbolTable: SymbolTable) {
    // symbolTable is not used in this simplified implementation
    // but kept for future use in full implementation
    this.program = MIR.createMIRProgram();
  }

  generate(ast: AST.Program): MIR.MIRProgram {
    for (const decl of ast.declarations) {
      this.processDeclaration(decl);
    }

    return this.program;
  }

  private processDeclaration(decl: AST.Declaration): void {
    switch (decl.kind) {
      case 'SchemaDecl':
        this.processSchema(decl);
        break;

      case 'EnumDecl':
        this.processEnum(decl);
        break;

      case 'DimensionDecl':
        this.processDimension(decl);
        break;

      case 'UnitDecl':
        this.processUnit(decl);
        break;

      case 'LookupDecl':
        this.processLookup(decl);
        break;

      case 'TransformDecl':
        this.processTransform(decl);
        break;

      case 'PipelineDecl':
        this.processPipeline(decl);
        break;

      default:
        break;
    }
  }

  private processSchema(decl: AST.SchemaDecl): void {
    const fields: MIR.MIRField[] = decl.fields.map((f) => ({
      name: f.name,
      type: this.astTypeToMIRType(f.type),
    }));

    const mirSchema: MIR.MIRSchema = {
      name: decl.name,
      fields,
      genericParams: decl.genericParams,
    };

    this.program.schemas.set(decl.name, mirSchema);
  }

  private processEnum(decl: AST.EnumDecl): void {
    const mirEnum: MIR.MIREnum = {
      name: decl.name,
      variants: decl.variants.map((v) => v.name),
    };

    this.program.enums.set(decl.name, mirEnum);
  }

  private processDimension(decl: AST.DimensionDecl): void {
    const mirDim: MIR.MIRDimension = {
      name: decl.name,
    };

    this.program.dimensions.set(decl.name, mirDim);
  }

  private processUnit(decl: AST.UnitDecl): void {
    // This is a simplified version
    // In a full implementation, we would evaluate the unit expression
    const mirUnit: MIR.MIRUnit = {
      name: decl.name,
      dimensions: new Map(),
      scale: 1,
    };

    this.program.units.set(decl.name, mirUnit);
  }

  private processLookup(decl: AST.LookupDecl): void {
    const mirLookup: MIR.MIRLookup = {
      name: decl.name,
      keyType: this.astTypeToMIRType(decl.keyType),
      valueType: this.astTypeToMIRType(decl.valueType),
      source: decl.source,
      hasDefault: decl.defaultValue !== undefined,
    };

    this.program.lookups.set(decl.name, mirLookup);
  }

  private processTransform(decl: AST.TransformDecl): void {
    const body = this.generateTransformBody(decl);

    const mirTransform: MIR.MIRTransform = {
      name: decl.name,
      sourceType: this.astTypeToMIRType(decl.sourceType),
      targetType: this.astTypeToMIRType(decl.targetType),
      body,
    };

    this.program.transforms.set(decl.name, mirTransform);
  }

  private generateTransformBody(decl: AST.TransformDecl): MIR.MIRBlock {
    const instructions: MIR.MIRInstruction[] = [];

    for (const rule of decl.rules) {
      const value = this.generateExpr(rule.sourceExpr);

      instructions.push({
        kind: 'FieldSet',
        field: rule.targetPath.join('.'),
        value,
      });
    }

    return {
      instructions,
      result: { kind: 'TargetRef', field: '' },
    };
  }

  private generateExpr(expr: AST.Expr): MIR.MIRValue {
    switch (expr.kind) {
      case 'Literal':
        return this.generateLiteral(expr);

      case 'PathExpr':
        return this.generatePathExpr(expr);

      case 'BinaryExpr':
        return this.generateBinaryExpr(expr);

      case 'UnaryExpr':
        return this.generateUnaryExpr(expr);

      case 'LookupExpr':
        return this.generateLookupExpr(expr);

      default:
        return { kind: 'Null' };
    }
  }

  private generateLiteral(expr: AST.Literal): MIR.MIRValue {
    switch (expr.type) {
      case 'Int':
        return { kind: 'IntLit', value: expr.value };
      case 'Float':
        return { kind: 'FloatLit', value: expr.value };
      case 'String':
        return { kind: 'StringLit', value: expr.value };
      case 'Bool':
        return { kind: 'BoolLit', value: expr.value };
      case 'Null':
        return { kind: 'Null' };
      default:
        return { kind: 'Null' };
    }
  }

  private generatePathExpr(expr: AST.PathExpr): MIR.MIRValue {
    if (expr.segments.length === 0) {
      return { kind: 'SourceRef' };
    }

    // Simplified: just return a variable reference
    // In a full implementation, we would generate field access instructions
    const fieldPath = expr.segments
      .map((s) => (s.kind === 'FieldAccess' ? s.field : ''))
      .join('.');

    return { kind: 'Var', name: `$${fieldPath}` };
  }

  private generateBinaryExpr(_expr: AST.BinaryExpr): MIR.MIRValue {
    // Simplified: return a temp variable
    // In a full implementation, we would generate the instruction
    const temp = this.freshTemp();
    return { kind: 'Var', name: temp };
  }

  private generateUnaryExpr(_expr: AST.UnaryExpr): MIR.MIRValue {
    const temp = this.freshTemp();
    return { kind: 'Var', name: temp };
  }

  private generateLookupExpr(_expr: AST.LookupExpr): MIR.MIRValue {
    const temp = this.freshTemp();
    return { kind: 'Var', name: temp };
  }

  private processPipeline(decl: AST.PipelineDecl): void {
    const steps: MIR.MIRPipelineStep[] = decl.steps.map((step) => {
      if (step.kind === 'TransformStep') {
        return { kind: 'Transform', name: step.name };
      } else if (step.kind === 'ParallelStep') {
        return { kind: 'Parallel', names: step.transforms };
      } else {
        return {
          kind: 'Conditional',
          condition: { kind: 'BoolLit', value: true },
          name: step.transform,
        };
      }
    });

    const mirPipeline: MIR.MIRPipeline = {
      name: decl.name,
      steps,
    };

    this.program.pipelines.set(decl.name, mirPipeline);
  }

  private astTypeToMIRType(type: AST.TypeExpr): MIR.MIRType {
    switch (type.kind) {
      case 'PrimitiveType':
        return { kind: 'Primitive', name: type.name };

      case 'SchemaRef':
        return {
          kind: 'Schema',
          name: type.name,
          genericArgs: type.genericArgs.map((a) => this.astTypeToMIRType(a)),
        };

      case 'EnumRef':
        return { kind: 'Enum', name: type.name };

      case 'ArrayType':
        return { kind: 'Array', element: this.astTypeToMIRType(type.element) };

      case 'OptionalType':
        return { kind: 'Optional', inner: this.astTypeToMIRType(type.inner) };

      case 'QuantityType':
        // Simplified: store unit as string
        return { kind: 'Quantity', unit: 'unknown' };

      case 'TupleType':
        return {
          kind: 'Tuple',
          elements: type.elements.map((e) => this.astTypeToMIRType(e)),
        };

      case 'UnionType':
        return {
          kind: 'Union',
          members: type.members.map((m) => this.astTypeToMIRType(m)),
        };

      default:
        return { kind: 'Primitive', name: 'Void' };
    }
  }

  private freshTemp(): string {
    return `_t${this.tempCounter++}`;
  }
}
