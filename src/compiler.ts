// Morpheus DSL Compiler API

import { Lexer } from './lexer/lexer';
import { Parser } from './parser/parser';
import { Resolver } from './analyzer/resolver';
import { TypeChecker } from './analyzer/type-checker';
import { IRGenerator } from './ir/ir-gen';
import { MIRProgram } from './ir/mir';
import { Program } from './parser/ast';
import { SymbolTable } from './analyzer/scope';

export interface CompileOptions {
  checkOnly?: boolean;
  target?: 'typescript' | 'python';
  outputDir?: string;
}

export interface CompileResult {
  success: boolean;
  ast?: Program;
  symbolTable?: SymbolTable;
  mir?: MIRProgram;
  errors: CompileError[];
}

export interface CompileError {
  message: string;
  file?: string;
  line?: number;
  column?: number;
}

export function compile(source: string, filename = '<input>', options: CompileOptions = {}): CompileResult {
  const errors: CompileError[] = [];

  // Lexical analysis
  const lexer = new Lexer(source, filename);
  const { tokens, errors: lexErrors } = lexer.tokenize();

  if (lexErrors.length > 0) {
    errors.push(
      ...lexErrors.map((e) => ({
        message: e.message,
        file: e.span.file,
        line: e.span.start.line,
        column: e.span.start.column,
      }))
    );
    return { success: false, errors };
  }

  // Parsing
  const parser = new Parser(tokens);
  const { program: ast, errors: parseErrors } = parser.parse();

  if (parseErrors.length > 0) {
    errors.push(
      ...parseErrors.map((e) => ({
        message: e.message,
        file: e.span.file,
        line: e.span.start.line,
        column: e.span.start.column,
      }))
    );
    return { success: false, ast, errors };
  }

  // Name resolution
  const resolver = new Resolver();
  const { symbolTable, errors: resolveErrors } = resolver.resolve(ast);

  if (resolveErrors.length > 0) {
    errors.push(...resolveErrors.map((e) => ({ message: e.message })));
    return { success: false, ast, symbolTable, errors };
  }

  // Type checking
  const typeChecker = new TypeChecker(symbolTable);
  const { errors: typeErrors } = typeChecker.check(ast);

  if (typeErrors.length > 0) {
    errors.push(...typeErrors.map((e) => ({ message: e.message })));
    return { success: false, ast, symbolTable, errors };
  }

  // Check-only mode
  if (options.checkOnly) {
    return { success: true, ast, symbolTable, errors: [] };
  }

  // IR generation
  const irGenerator = new IRGenerator(symbolTable);
  const mir = irGenerator.generate(ast);

  return {
    success: true,
    ast,
    symbolTable,
    mir,
    errors: [],
  };
}
