// Symbol table and scope management

import { Type } from './types';
import * as AST from '../parser/ast';

export type Symbol =
  | SchemaSymbol
  | EnumSymbol
  | UnitSymbol
  | DimensionSymbol
  | LookupSymbol
  | TransformSymbol
  | PipelineSymbol
  | VariableSymbol;

export interface SchemaSymbol {
  kind: 'Schema';
  name: string;
  type: Type;
  decl: AST.SchemaDecl;
}

export interface EnumSymbol {
  kind: 'Enum';
  name: string;
  type: Type;
  decl: AST.EnumDecl;
}

export interface UnitSymbol {
  kind: 'Unit';
  name: string;
  decl: AST.UnitDecl;
}

export interface DimensionSymbol {
  kind: 'Dimension';
  name: string;
  decl: AST.DimensionDecl;
}

export interface LookupSymbol {
  kind: 'Lookup';
  name: string;
  keyType: Type;
  valueType: Type;
  decl: AST.LookupDecl;
}

export interface TransformSymbol {
  kind: 'Transform';
  name: string;
  sourceType: Type;
  targetType: Type;
  decl: AST.TransformDecl;
}

export interface PipelineSymbol {
  kind: 'Pipeline';
  name: string;
  decl: AST.PipelineDecl;
}

export interface VariableSymbol {
  kind: 'Variable';
  name: string;
  type: Type;
}

export class Scope {
  private symbols: Map<string, Symbol> = new Map();
  private parent: Scope | null;

  constructor(parent: Scope | null = null) {
    this.parent = parent;
  }

  define(name: string, symbol: Symbol): void {
    if (this.symbols.has(name)) {
      throw new Error(`Symbol '${name}' is already defined in this scope`);
    }
    this.symbols.set(name, symbol);
  }

  lookup(name: string): Symbol | null {
    const symbol = this.symbols.get(name);
    if (symbol) return symbol;
    if (this.parent) return this.parent.lookup(name);
    return null;
  }

  has(name: string): boolean {
    return this.symbols.has(name);
  }

  getParent(): Scope | null {
    return this.parent;
  }

  getAllSymbols(): Map<string, Symbol> {
    return new Map(this.symbols);
  }
}

export class SymbolTable {
  private globalScope: Scope;
  private currentScope: Scope;

  constructor() {
    this.globalScope = new Scope();
    this.currentScope = this.globalScope;
  }

  enterScope(): void {
    this.currentScope = new Scope(this.currentScope);
  }

  exitScope(): void {
    const parent = this.currentScope.getParent();
    if (!parent) {
      throw new Error('Cannot exit global scope');
    }
    this.currentScope = parent;
  }

  define(name: string, symbol: Symbol): void {
    this.currentScope.define(name, symbol);
  }

  lookup(name: string): Symbol | null {
    return this.currentScope.lookup(name);
  }

  has(name: string): boolean {
    return this.lookup(name) !== null;
  }

  getGlobalScope(): Scope {
    return this.globalScope;
  }

  getCurrentScope(): Scope {
    return this.currentScope;
  }
}
