// Type checker for Morpheus DSL

import * as AST from '../parser/ast';
import * as Types from './types';
import { SymbolTable } from './scope';
import { Unit, UNIT_ONE } from './types';

export class TypeCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TypeCheckError';
  }
}

export class TypeChecker {
  private symbolTable: SymbolTable;
  private errors: TypeCheckError[] = [];
  private units: Map<string, Unit> = new Map();
  private dimensions: Map<string, string> = new Map();

  constructor(symbolTable: SymbolTable) {
    this.symbolTable = symbolTable;
  }

  check(program: AST.Program): { errors: TypeCheckError[] } {
    // First pass: Process dimensions and units
    for (const decl of program.declarations) {
      if (decl.kind === 'DimensionDecl') {
        this.processDimension(decl);
      } else if (decl.kind === 'UnitDecl') {
        this.processUnit(decl);
      }
    }

    // Second pass: Type check all declarations
    for (const decl of program.declarations) {
      try {
        this.checkDeclaration(decl);
      } catch (e) {
        if (e instanceof TypeCheckError) {
          this.errors.push(e);
        }
      }
    }

    return { errors: this.errors };
  }

  private processDimension(decl: AST.DimensionDecl): void {
    this.dimensions.set(decl.name, decl.name);
  }

  private processUnit(decl: AST.UnitDecl): void {
    let unit: Unit;

    if (decl.expr) {
      unit = this.evaluateUnitExpr(decl.expr);
    } else if (decl.dimension) {
      // Base unit for a dimension
      const dims = new Map<string, number>();
      dims.set(decl.dimension, 1);
      unit = Types.createUnit(dims);
    } else {
      // Dimensionless unit
      unit = UNIT_ONE;
    }

    this.units.set(decl.name, unit);
  }

  private evaluateUnitExpr(expr: AST.UnitExpr): Unit {
    switch (expr.kind) {
      case 'UnitOne':
        return UNIT_ONE;

      case 'UnitRef':
        const unit = this.units.get(expr.name);
        if (!unit) {
          throw new TypeCheckError(`Unit '${expr.name}' not found`);
        }
        return unit;

      case 'UnitMul':
        const left = this.evaluateUnitExpr(expr.left);
        const right = this.evaluateUnitExpr(expr.right);
        return Types.multiplyUnits(left, right);

      case 'UnitDiv':
        const leftDiv = this.evaluateUnitExpr(expr.left);
        const rightDiv = this.evaluateUnitExpr(expr.right);
        return Types.divideUnits(leftDiv, rightDiv);

      case 'UnitPow':
        const base = this.evaluateUnitExpr(expr.base);
        return Types.powerUnit(base, expr.exponent);

      default:
        throw new TypeCheckError('Invalid unit expression');
    }
  }

  private checkDeclaration(decl: AST.Declaration): void {
    switch (decl.kind) {
      case 'SchemaDecl':
        this.checkSchema(decl);
        break;

      case 'LookupDecl':
        this.checkLookup(decl);
        break;

      case 'TransformDecl':
        this.checkTransform(decl);
        break;

      case 'PipelineDecl':
        this.checkPipeline(decl);
        break;

      default:
        break;
    }
  }

  private checkSchema(decl: AST.SchemaDecl): void {
    const fields = new Map<string, Types.Type>();

    for (const field of decl.fields) {
      const type = this.resolveTypeExpr(field.type);
      fields.set(field.name, type);
    }

    // Update the symbol with resolved field types
    const symbol = this.symbolTable.lookup(decl.name);
    if (symbol && symbol.kind === 'Schema') {
      (symbol.type as Types.SchemaType).fields = fields;
    }
  }

  private checkLookup(decl: AST.LookupDecl): void {
    const keyType = this.resolveTypeExpr(decl.keyType);
    const valueType = this.resolveTypeExpr(decl.valueType);

    // Update the symbol with resolved types
    const symbol = this.symbolTable.lookup(decl.name);
    if (symbol && symbol.kind === 'Lookup') {
      symbol.keyType = keyType;
      symbol.valueType = valueType;
    }
  }

  private checkTransform(decl: AST.TransformDecl): void {
    const sourceType = this.resolveTypeExpr(decl.sourceType);
    const targetType = this.resolveTypeExpr(decl.targetType);

    // Update the symbol with resolved types
    const symbol = this.symbolTable.lookup(decl.name);
    if (symbol && symbol.kind === 'Transform') {
      symbol.sourceType = sourceType;
      symbol.targetType = targetType;
    }

    // Type check mapping rules
    for (const rule of decl.rules) {
      this.checkMappingRule(rule, sourceType, targetType);
    }
  }

  private checkMappingRule(rule: AST.MappingRule, sourceType: Types.Type, targetType: Types.Type): void {
    // Resolve target path type
    const targetFieldType = this.resolveTargetPath(targetType, rule.targetPath);

    // Infer source expression type
    const sourceExprType = this.inferExpr(rule.sourceExpr, sourceType);

    // Check assignability
    if (!Types.isSubtype(sourceExprType, targetFieldType)) {
      throw new TypeCheckError(
        `Type mismatch: cannot assign ${Types.formatType(sourceExprType)} to ${Types.formatType(targetFieldType)}`
      );
    }
  }

  private checkPipeline(decl: AST.PipelineDecl): void {
    // Verify that all referenced transforms exist
    for (const step of decl.steps) {
      if (step.kind === 'TransformStep') {
        const symbol = this.symbolTable.lookup(step.name);
        if (!symbol || symbol.kind !== 'Transform') {
          throw new TypeCheckError(`Transform '${step.name}' not found`);
        }
      } else if (step.kind === 'ParallelStep') {
        for (const name of step.transforms) {
          const symbol = this.symbolTable.lookup(name);
          if (!symbol || symbol.kind !== 'Transform') {
            throw new TypeCheckError(`Transform '${name}' not found`);
          }
        }
      }
    }
  }

  private resolveTypeExpr(typeExpr: AST.TypeExpr): Types.Type {
    switch (typeExpr.kind) {
      case 'PrimitiveType':
        return Types.primitiveType(typeExpr.name);

      case 'SchemaRef':
        const symbol = this.symbolTable.lookup(typeExpr.name);
        if (!symbol || symbol.kind !== 'Schema') {
          throw new TypeCheckError(`Schema '${typeExpr.name}' not found`);
        }
        return symbol.type;

      case 'EnumRef':
        const enumSymbol = this.symbolTable.lookup(typeExpr.name);
        if (!enumSymbol || enumSymbol.kind !== 'Enum') {
          throw new TypeCheckError(`Enum '${typeExpr.name}' not found`);
        }
        return enumSymbol.type;

      case 'ArrayType':
        return Types.arrayType(this.resolveTypeExpr(typeExpr.element));

      case 'OptionalType':
        return Types.optionalType(this.resolveTypeExpr(typeExpr.inner));

      case 'QuantityType':
        const unit = this.evaluateUnitExpr(typeExpr.unit);
        return Types.quantityType(unit);

      case 'TupleType':
        return Types.tupleType(typeExpr.elements.map((e) => this.resolveTypeExpr(e)));

      case 'UnionType':
        return Types.unionType(typeExpr.members.map((m) => this.resolveTypeExpr(m)));

      default:
        return Types.UNKNOWN_TYPE;
    }
  }

  private resolveTargetPath(type: Types.Type, path: string[]): Types.Type {
    let current = type;

    for (const field of path) {
      if (current.kind === 'Schema') {
        const fieldType = current.fields.get(field);
        if (!fieldType) {
          throw new TypeCheckError(`Field '${field}' not found in schema '${current.name}'`);
        }
        current = fieldType;
      } else {
        throw new TypeCheckError(`Cannot access field '${field}' on non-schema type`);
      }
    }

    return current;
  }

  private inferExpr(expr: AST.Expr, contextType: Types.Type): Types.Type {
    switch (expr.kind) {
      case 'Literal':
        return this.inferLiteral(expr);

      case 'PathExpr':
        return this.inferPathExpr(expr, contextType);

      case 'BinaryExpr':
        return this.inferBinaryExpr(expr, contextType);

      case 'UnaryExpr':
        return this.inferUnaryExpr(expr, contextType);

      case 'IfExpr':
        return this.inferIfExpr(expr, contextType);

      case 'AggregateExpr':
        return this.inferAggregateExpr(expr, contextType);

      case 'LookupExpr':
        return this.inferLookupExpr(expr);

      default:
        return Types.UNKNOWN_TYPE;
    }
  }

  private inferLiteral(expr: AST.Literal): Types.Type {
    switch (expr.type) {
      case 'Int':
        return Types.primitiveType('Int');
      case 'Float':
        return Types.primitiveType('Float');
      case 'String':
        return Types.primitiveType('String');
      case 'Bool':
        return Types.primitiveType('Bool');
      case 'Null':
        return Types.NEVER_TYPE;
      default:
        return Types.UNKNOWN_TYPE;
    }
  }

  private inferPathExpr(expr: AST.PathExpr, contextType: Types.Type): Types.Type {
    let current = contextType;

    for (const segment of expr.segments) {
      if (segment.kind === 'FieldAccess') {
        if (current.kind === 'Schema') {
          const fieldType = current.fields.get(segment.field);
          if (!fieldType) {
            throw new TypeCheckError(`Field '${segment.field}' not found`);
          }
          current = fieldType;

          if (segment.optional && current.kind !== 'Optional') {
            current = Types.optionalType(current);
          }
        } else {
          throw new TypeCheckError(`Cannot access field on non-schema type`);
        }
      } else if (segment.kind === 'IndexAccess') {
        if (current.kind === 'Array') {
          current = current.element;
        } else {
          throw new TypeCheckError(`Cannot index non-array type`);
        }
      }
    }

    return current;
  }

  private inferBinaryExpr(expr: AST.BinaryExpr, contextType: Types.Type): Types.Type {
    const leftType = this.inferExpr(expr.left, contextType);
    const rightType = this.inferExpr(expr.right, contextType);

    switch (expr.op) {
      case '+':
      case '-':
        // For Quantity types, units must match
        if (leftType.kind === 'Quantity' && rightType.kind === 'Quantity') {
          if (!Types.unitsEqual(leftType.unit, rightType.unit)) {
            throw new TypeCheckError('Unit mismatch in addition/subtraction');
          }
          return leftType;
        }
        return leftType;

      case '*':
        if (leftType.kind === 'Quantity' && rightType.kind === 'Quantity') {
          return Types.quantityType(Types.multiplyUnits(leftType.unit, rightType.unit));
        }
        return leftType;

      case '/':
        if (leftType.kind === 'Quantity' && rightType.kind === 'Quantity') {
          return Types.quantityType(Types.divideUnits(leftType.unit, rightType.unit));
        }
        return leftType;

      case '==':
      case '!=':
      case '<':
      case '>':
      case '<=':
      case '>=':
        return Types.primitiveType('Bool');

      case '&&':
      case '||':
        return Types.primitiveType('Bool');

      case '??':
        return rightType;

      default:
        return Types.UNKNOWN_TYPE;
    }
  }

  private inferUnaryExpr(expr: AST.UnaryExpr, contextType: Types.Type): Types.Type {
    const operandType = this.inferExpr(expr.operand, contextType);

    switch (expr.op) {
      case '!':
        return Types.primitiveType('Bool');
      case '-':
        return operandType;
      default:
        return Types.UNKNOWN_TYPE;
    }
  }

  private inferIfExpr(expr: AST.IfExpr, contextType: Types.Type): Types.Type {
    // Type check condition (not used but ensures it's valid)
    this.inferExpr(expr.condition, contextType);
    const thenType = this.inferExpr(expr.thenExpr, contextType);
    const elseType = this.inferExpr(expr.elseExpr, contextType);

    // Return union of then and else types (simplified)
    if (Types.typesEqual(thenType, elseType)) {
      return thenType;
    }

    return Types.unionType([thenType, elseType]);
  }

  private inferAggregateExpr(expr: AST.AggregateExpr, contextType: Types.Type): Types.Type {
    const sourceType = this.inferExpr(expr.source, contextType);

    if (sourceType.kind !== 'Array') {
      throw new TypeCheckError('Aggregate source must be an array');
    }

    const elementType = sourceType.element;
    const bodyType = this.inferExpr(expr.lambda.body, elementType);

    switch (expr.func) {
      case 'sum':
      case 'avg':
        return bodyType;

      case 'collect':
        return Types.arrayType(bodyType);

      case 'filter':
        return sourceType;

      case 'count':
        return Types.primitiveType('Int');

      default:
        return Types.UNKNOWN_TYPE;
    }
  }

  private inferLookupExpr(expr: AST.LookupExpr): Types.Type {
    const symbol = this.symbolTable.lookup(expr.table);
    if (!symbol || symbol.kind !== 'Lookup') {
      throw new TypeCheckError(`Lookup table '${expr.table}' not found`);
    }

    return symbol.valueType;
  }
}
