// Error handling for Morpheus DSL

import { SourceSpan } from '../lexer/token';

export class MorpheusError extends Error {
  constructor(
    message: string,
    public readonly span?: SourceSpan
  ) {
    super(message);
    this.name = 'MorpheusError';
  }

  format(): string {
    if (this.span) {
      const { file, start } = this.span;
      return `${file}:${start.line}:${start.column} - ${this.message}`;
    }
    return this.message;
  }
}

export class CompilationError extends MorpheusError {
  constructor(message: string, span?: SourceSpan) {
    super(message, span);
    this.name = 'CompilationError';
  }
}

export function formatErrors(errors: MorpheusError[]): string {
  return errors.map((e) => e.format()).join('\n');
}
