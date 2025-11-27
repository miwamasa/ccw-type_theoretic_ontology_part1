// Morpheus DSL - Main exports

// Lexer
export * from './lexer';

// Parser
export * from './parser';

// Analyzer - Export types with namespace to avoid conflicts
export * as AnalyzerTypes from './analyzer/types';
export { SymbolTable, Scope } from './analyzer/scope';
export { Resolver, ResolveError } from './analyzer/resolver';
export { TypeChecker, TypeCheckError } from './analyzer/type-checker';

// IR
export * from './ir';

// Runtime
export * as Runtime from './runtime/typescript';

// Errors
export * from './errors';

// Compiler API
export { compile } from './compiler';
