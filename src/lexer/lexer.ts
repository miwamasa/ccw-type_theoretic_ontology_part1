// Lexer for Morpheus DSL

import {
  Token,
  TokenType,
  SourceLocation,
  SourceSpan,
  KEYWORDS,
  createSourceLocation,
  createSourceSpan,
  createToken,
} from './token';

export class LexError extends Error {
  constructor(
    message: string,
    public span: SourceSpan
  ) {
    super(message);
    this.name = 'LexError';
  }
}

export class Lexer {
  private source: string;
  private tokens: Token[] = [];
  private errors: LexError[] = [];
  private start = 0;
  private current = 0;
  private line = 1;
  private column = 1;
  private file: string;

  constructor(source: string, file = '<input>') {
    this.source = source;
    this.file = file;
  }

  tokenize(): { tokens: Token[]; errors: LexError[] } {
    while (!this.isAtEnd()) {
      this.start = this.current;
      this.scanToken();
    }

    this.addToken(TokenType.EOF, '');
    return { tokens: this.tokens, errors: this.errors };
  }

  private scanToken(): void {
    const c = this.advance();

    switch (c) {
      // Single character tokens
      case '(': this.addToken(TokenType.LPAREN, c); break;
      case ')': this.addToken(TokenType.RPAREN, c); break;
      case '{': this.addToken(TokenType.LBRACE, c); break;
      case '}': this.addToken(TokenType.RBRACE, c); break;
      case '[': this.addToken(TokenType.LBRACKET, c); break;
      case ']': this.addToken(TokenType.RBRACKET, c); break;
      case ',': this.addToken(TokenType.COMMA, c); break;
      case '^': this.addToken(TokenType.CARET, c); break;
      case '%': this.addToken(TokenType.PERCENT, c); break;
      case '+': this.addToken(TokenType.PLUS, c); break;
      case '*': this.addToken(TokenType.STAR, c); break;

      // Two or more character tokens
      case '-':
        if (this.match('>')) {
          this.addToken(TokenType.RARROW, '->');
        } else {
          this.addToken(TokenType.MINUS, '-');
        }
        break;

      case '<':
        if (this.match('-')) {
          this.addToken(TokenType.LARROW, '<-');
        } else if (this.match('=')) {
          this.addToken(TokenType.LTE, '<=');
        } else {
          this.addToken(TokenType.LT, '<');
        }
        break;

      case '>':
        if (this.match('=')) {
          this.addToken(TokenType.GTE, '>=');
        } else {
          this.addToken(TokenType.GT, '>');
        }
        break;

      case '=':
        if (this.match('=')) {
          this.addToken(TokenType.EQ, '==');
        } else if (this.match('>')) {
          this.addToken(TokenType.FAT_ARROW, '=>');
        } else {
          this.error('Unexpected character \'=\'. Did you mean \'==\' or \'=>\'?');
        }
        break;

      case '!':
        if (this.match('=')) {
          this.addToken(TokenType.NEQ, '!=');
        } else {
          this.addToken(TokenType.NOT, '!');
        }
        break;

      case '&':
        if (this.match('&')) {
          this.addToken(TokenType.AND, '&&');
        } else {
          this.error('Unexpected character \'&\'. Did you mean \'&&\'?');
        }
        break;

      case '|':
        if (this.match('|')) {
          this.addToken(TokenType.OR, '||');
        } else {
          this.addToken(TokenType.PIPE, '|');
        }
        break;

      case '?':
        if (this.match('.')) {
          this.addToken(TokenType.QDOT, '?.');
        } else if (this.match('?')) {
          this.addToken(TokenType.NULLISH, '??');
        } else {
          this.addToken(TokenType.QUESTION, '?');
        }
        break;

      case '.':
        if (this.isDigit(this.peek())) {
          // Handle numbers starting with .
          this.number();
        } else {
          this.addToken(TokenType.DOT, '.');
        }
        break;

      case ':':
        if (this.match(':')) {
          this.addToken(TokenType.DOUBLE_COLON, '::');
        } else {
          this.addToken(TokenType.COLON, ':');
        }
        break;

      case '~':
        if (this.match('>')) {
          this.addToken(TokenType.TILDE_ARROW, '~>');
        } else {
          this.error('Unexpected character \'~\'. Did you mean \'~>\'?');
        }
        break;

      case '@': this.addToken(TokenType.AT, c); break;
      case '$': this.addToken(TokenType.DOLLAR, c); break;

      case '/':
        if (this.match('/')) {
          // Line comment
          while (this.peek() !== '\n' && !this.isAtEnd()) {
            this.advance();
          }
        } else if (this.match('*')) {
          // Block comment
          this.blockComment();
        } else {
          this.addToken(TokenType.SLASH, '/');
        }
        break;

      // Whitespace
      case ' ':
      case '\r':
      case '\t':
        // Ignore whitespace
        break;

      case '\n':
        this.line++;
        this.column = 1;
        break;

      // String literals
      case '"':
        this.string();
        break;

      default:
        if (this.isDigit(c)) {
          this.number();
        } else if (this.isAlpha(c)) {
          this.identifier();
        } else {
          this.error(`Unexpected character: '${c}'`);
        }
        break;
    }
  }

  private blockComment(): void {
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        this.advance(); // consume *
        this.advance(); // consume /
        return;
      }
      if (this.peek() === '\n') {
        this.line++;
        this.column = 0;
      }
      this.advance();
    }
    this.error('Unterminated block comment');
  }

  private string(): void {
    const startLine = this.line;
    const startColumn = this.column;

    while (this.peek() !== '"' && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 0;
      }
      if (this.peek() === '\\') {
        this.advance(); // consume backslash
        if (!this.isAtEnd()) {
          this.advance(); // consume escaped character
        }
      } else {
        this.advance();
      }
    }

    if (this.isAtEnd()) {
      this.error('Unterminated string');
      return;
    }

    // Closing "
    this.advance();

    // Extract the string value (without quotes)
    const value = this.source.substring(this.start + 1, this.current - 1);
    // Process escape sequences
    const processed = this.processEscapeSequences(value);
    this.addToken(TokenType.STRING_LITERAL, this.source.substring(this.start, this.current), processed);
  }

  private processEscapeSequences(str: string): string {
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }

  private number(): void {
    while (this.isDigit(this.peek())) {
      this.advance();
    }

    // Look for decimal point
    if (this.peek() === '.' && this.isDigit(this.peekNext())) {
      // Consume the '.'
      this.advance();

      while (this.isDigit(this.peek())) {
        this.advance();
      }

      // Look for exponent
      if (this.peek() === 'e' || this.peek() === 'E') {
        this.advance();
        if (this.peek() === '+' || this.peek() === '-') {
          this.advance();
        }
        while (this.isDigit(this.peek())) {
          this.advance();
        }
      }

      const value = parseFloat(this.source.substring(this.start, this.current));
      this.addToken(TokenType.FLOAT_LITERAL, this.source.substring(this.start, this.current), value);
    } else {
      const value = parseInt(this.source.substring(this.start, this.current), 10);
      this.addToken(TokenType.INT_LITERAL, this.source.substring(this.start, this.current), value);
    }
  }

  private identifier(): void {
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }

    const text = this.source.substring(this.start, this.current);
    const type = KEYWORDS.get(text);

    if (type) {
      if (type === TokenType.BOOL_LITERAL) {
        this.addToken(type, text, text === 'true');
      } else {
        this.addToken(type, text);
      }
    } else {
      this.addToken(TokenType.IDENTIFIER, text);
    }
  }

  private match(expected: string): boolean {
    if (this.isAtEnd()) return false;
    if (this.source.charAt(this.current) !== expected) return false;

    this.current++;
    this.column++;
    return true;
  }

  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source.charAt(this.current);
  }

  private peekNext(): string {
    if (this.current + 1 >= this.source.length) return '\0';
    return this.source.charAt(this.current + 1);
  }

  private isAlpha(c: string): boolean {
    return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
  }

  private isDigit(c: string): boolean {
    return c >= '0' && c <= '9';
  }

  private isAlphaNumeric(c: string): boolean {
    return this.isAlpha(c) || this.isDigit(c);
  }

  private isAtEnd(): boolean {
    return this.current >= this.source.length;
  }

  private advance(): string {
    const c = this.source.charAt(this.current);
    this.current++;
    this.column++;
    return c;
  }

  private addToken(type: TokenType, lexeme: string, literal?: any): void {
    const start = createSourceLocation(this.line, this.column - lexeme.length, this.start);
    const end = createSourceLocation(this.line, this.column, this.current);
    const span = createSourceSpan(start, end, this.file);
    this.tokens.push(createToken(type, lexeme, span, literal));
  }

  private error(message: string): void {
    const start = createSourceLocation(this.line, this.column - 1, this.start);
    const end = createSourceLocation(this.line, this.column, this.current);
    const span = createSourceSpan(start, end, this.file);
    this.errors.push(new LexError(message, span));
  }
}
