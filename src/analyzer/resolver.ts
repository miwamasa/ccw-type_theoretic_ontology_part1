// Name resolution - Binds identifiers to their declarations

import * as AST from '../parser/ast';
import { SymbolTable, Symbol } from './scope';
import * as Types from './types';

export class ResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResolveError';
  }
}

export class Resolver {
  private symbolTable: SymbolTable;
  private errors: ResolveError[] = [];

  constructor() {
    this.symbolTable = new SymbolTable();
  }

  resolve(program: AST.Program): { symbolTable: SymbolTable; errors: ResolveError[] } {
    // First pass: register all declarations
    for (const decl of program.declarations) {
      try {
        this.registerDeclaration(decl);
      } catch (e) {
        if (e instanceof ResolveError) {
          this.errors.push(e);
        }
      }
    }

    // Second pass: resolve references (could be expanded)
    for (const decl of program.declarations) {
      try {
        this.resolveDeclaration(decl);
      } catch (e) {
        if (e instanceof ResolveError) {
          this.errors.push(e);
        }
      }
    }

    return { symbolTable: this.symbolTable, errors: this.errors };
  }

  private registerDeclaration(decl: AST.Declaration): void {
    switch (decl.kind) {
      case 'SchemaDecl':
        this.registerSchema(decl);
        break;

      case 'EnumDecl':
        this.registerEnum(decl);
        break;

      case 'DimensionDecl':
        this.registerDimension(decl);
        break;

      case 'UnitDecl':
        this.registerUnit(decl);
        break;

      case 'LookupDecl':
        this.registerLookup(decl);
        break;

      case 'TransformDecl':
        this.registerTransform(decl);
        break;

      case 'PipelineDecl':
        this.registerPipeline(decl);
        break;

      default:
        // Ignore unknown declarations
        break;
    }
  }

  private registerSchema(decl: AST.SchemaDecl): void {
    const fields = new Map<string, Types.Type>();
    // We'll fill in field types during type checking
    const type = Types.schemaType(decl.name, fields, decl.genericParams);

    const symbol: Symbol = {
      kind: 'Schema',
      name: decl.name,
      type,
      decl,
    };

    this.symbolTable.define(decl.name, symbol);
  }

  private registerEnum(decl: AST.EnumDecl): void {
    const variants = decl.variants.map((v) => v.name);
    const type = Types.enumType(decl.name, variants);

    const symbol: Symbol = {
      kind: 'Enum',
      name: decl.name,
      type,
      decl,
    };

    this.symbolTable.define(decl.name, symbol);
  }

  private registerDimension(decl: AST.DimensionDecl): void {
    const symbol: Symbol = {
      kind: 'Dimension',
      name: decl.name,
      decl,
    };

    this.symbolTable.define(decl.name, symbol);
  }

  private registerUnit(decl: AST.UnitDecl): void {
    const symbol: Symbol = {
      kind: 'Unit',
      name: decl.name,
      decl,
    };

    this.symbolTable.define(decl.name, symbol);
  }

  private registerLookup(decl: AST.LookupDecl): void {
    // Type resolution will be done during type checking
    const symbol: Symbol = {
      kind: 'Lookup',
      name: decl.name,
      keyType: Types.UNKNOWN_TYPE,
      valueType: Types.UNKNOWN_TYPE,
      decl,
    };

    this.symbolTable.define(decl.name, symbol);
  }

  private registerTransform(decl: AST.TransformDecl): void {
    const symbol: Symbol = {
      kind: 'Transform',
      name: decl.name,
      sourceType: Types.UNKNOWN_TYPE,
      targetType: Types.UNKNOWN_TYPE,
      decl,
    };

    this.symbolTable.define(decl.name, symbol);
  }

  private registerPipeline(decl: AST.PipelineDecl): void {
    const symbol: Symbol = {
      kind: 'Pipeline',
      name: decl.name,
      decl,
    };

    this.symbolTable.define(decl.name, symbol);
  }

  private resolveDeclaration(decl: AST.Declaration): void {
    // Additional resolution logic can be added here
    // For now, we just ensure that referenced types exist

    switch (decl.kind) {
      case 'SchemaDecl':
        if (decl.extends) {
          const parent = this.symbolTable.lookup(decl.extends);
          if (!parent || parent.kind !== 'Schema') {
            throw new ResolveError(`Schema '${decl.extends}' not found`);
          }
        }
        break;

      case 'TransformDecl':
        // Could verify that source and target types exist
        break;

      default:
        break;
    }
  }
}
