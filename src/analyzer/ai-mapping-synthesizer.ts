// AI-powered Mapping Synthesizer using Anthropic Claude
// Automatically generates transform mappings based on semantic understanding

import * as AST from '../parser/ast';
import { Lexer } from '../lexer/lexer';
import { Parser } from '../parser/parser';
import { TypeChecker } from '../analyzer/type-checker';
import { SymbolTable } from '../analyzer/scope';

export interface MappingCandidate {
  targetField: string;
  sourceField: string;
  confidence: number;  // 0.0 - 1.0
  reasoning: string;
  transformExpr?: string;  // Optional transformation expression
}

export interface AIConfig {
  apiKey: string;
  model: string;  // "claude-3-5-sonnet-20241022", "claude-3-opus-20240229", etc.
  baseURL?: string;
}

export interface SynthesizeOptions {
  domainContext?: string;
  minConfidence?: number;
  maxTokens?: number;
  temperature?: number;
  validateGenerated?: boolean;  // Whether to type-check generated code (default: true)
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class AIMappingSynthesizer {
  private apiKey: string;
  private model: string;
  private baseURL: string;

  constructor(config: AIConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.baseURL = config.baseURL || 'https://api.anthropic.com/v1';
  }

  async synthesize(
    sourceSchema: AST.SchemaDecl,
    targetSchema: AST.SchemaDecl,
    options: SynthesizeOptions = {}
  ): Promise<MappingCandidate[]> {

    console.log(`\n🤖 AI-assisted mapping: ${sourceSchema.name} → ${targetSchema.name}`);

    // Build prompt for Claude
    const prompt = this.buildPrompt(sourceSchema, targetSchema, options);

    // Call Anthropic API
    const response = await this.callClaude(prompt, options);

    // Parse response
    const mappings = this.parseResponse(response);

    // Filter by confidence threshold
    const minConfidence = options.minConfidence || 0.5;
    const filtered = mappings.filter(m => m.confidence >= minConfidence);

    console.log(`   Found ${filtered.length} mappings (min confidence: ${(minConfidence * 100).toFixed(0)}%)`);

    return filtered;
  }

  private buildPrompt(
    sourceSchema: AST.SchemaDecl,
    targetSchema: AST.SchemaDecl,
    options: SynthesizeOptions
  ): string {
    const domainContext = options.domainContext || 'General data transformation';

    const sourceFields = sourceSchema.fields.map(f => ({
      name: f.name,
      type: this.typeToString(f.type)
    }));

    const targetFields = targetSchema.fields.map(f => ({
      name: f.name,
      type: this.typeToString(f.type)
    }));

    return `You are an expert data schema mapping assistant. Your task is to determine the best field mappings between two data schemas.

**Domain Context**: ${domainContext}

**Source Schema: ${sourceSchema.name}**
${sourceFields.map(f => `  - ${f.name}: ${f.type}`).join('\n')}

**Target Schema: ${targetSchema.name}**
${targetFields.map(f => `  - ${f.name}: ${f.type}`).join('\n')}

**Type System Rules**:
1. **Type Compatibility**:
   - String can map to String
   - Int can map to Int or Float
   - Float can map to Float
   - Bool can map to Bool
   - Date/DateTime types require conversion functions (parseDate, toDate)
   - Optional types (T?) can accept T or null
   - Quantity<Unit1> can map to Quantity<Unit2> ONLY with proper unit conversion

2. **Unit Conversions** (for Quantity types):
   - Preserve dimensional consistency: length*length = area, not volume
   - Common conversions: kWh→MWh (÷1000), kg→t (÷1000), m→km (÷1000)
   - Emission factors: energy*intensity = emissions (e.g., kWh * kgCO2e/kWh = kgCO2e)
   - Always include conversion factors in transformExpr when changing units

3. **Morpheus Syntax Requirements** (CRITICAL):
   - Use ONLY straight single quotes (') for strings, NOT smart/curly quotes ('')
   - Use ONLY ASCII characters - NO unicode superscripts (³), special symbols
   - Field access: $.fieldName
   - String concatenation: $.field1 + ' ' + $.field2
   - Arithmetic: +, -, *, / (standard operators only)
   - Comparison: ==, !=, <, >, <=, >=
   - Functions: parseDate(), toDate(), toLowerCase(), toUpperCase()
   - Conditionals: if CONDITION then EXPR else EXPR

**Your Task**:
For each field in the Target Schema, determine:
1. Which Source Schema field(s) it should map from
2. Confidence score (0.0 to 1.0) indicating how certain you are about type correctness
3. Clear reasoning for the mapping, explaining type compatibility
4. Transformation logic using VALID Morpheus syntax only

**Requirements**:
- Only suggest mappings where types are compatible according to Type System Rules
- For Quantity types, verify dimensional analysis is correct
- Use only valid Morpheus syntax - no unicode, only ASCII
- For unit conversions, show the conversion factor explicitly (e.g., * 0.001 for kg→t)
- If types are incompatible, omit the mapping or reduce confidence score
- Explain type reasoning: "Int to Int - direct compatible types" or "String to Date - requires parseDate()"

**Output Format** (JSON array):
\`\`\`json
[
  {
    "targetField": "field_name",
    "sourceField": "source_field_name",
    "confidence": 0.95,
    "reasoning": "Type-aware explanation: source is String, target is String, direct compatible mapping",
    "transformExpr": "$.sourceField"
  },
  {
    "targetField": "total",
    "sourceField": "value1,value2",
    "confidence": 0.90,
    "reasoning": "Type-aware: both Float types, sum operation preserves type",
    "transformExpr": "$.value1 + $.value2"
  }
]
\`\`\`

**Examples of Valid transformExpr**:
- "$.customerId" (direct mapping)
- "$.firstName + ' ' + $.lastName" (string concatenation - use ' not ')
- "($.electricityUsage * 0.5) / 1000" (unit conversion with explicit factors)
- "$.accountStatus == 'active'" (boolean comparison)
- "parseDate($.dateString)" (type conversion)
- "if $.count > 0 then $.total / $.count else 0" (conditional)

**INVALID Examples** (DO NOT USE):
- 'GHG Protocol – Emission factors...' (uses – em dash, should use - hyphen)
- 'Natural gas 2.0 kgCO2e/m³' (uses ³ superscript, write as m3)
- "$.field" (uses smart quotes, use ' instead)

Provide only the JSON array, no additional text.`;
  }

  private async callClaude(
    prompt: string,
    options: SynthesizeOptions
  ): Promise<string> {
    const maxTokens = options.maxTokens || 4000;
    const temperature = options.temperature || 0.2;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    const requestBody = {
      model: this.model,
      max_tokens: maxTokens,
      temperature: temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    };

    const url = `${this.baseURL}/messages`;

    console.log(`\n🔍 Debug: API Request Details`);
    console.log(`   URL: ${url}`);
    console.log(`   Model: ${this.model}`);
    console.log(`   Max Tokens: ${maxTokens}`);
    console.log(`   Temperature: ${temperature}`);
    console.log(`   API Key: ${this.apiKey.substring(0, 20)}...${this.apiKey.slice(-4)}`);

    // Check for proxy settings
    const httpProxy = process.env.HTTP_PROXY || process.env.http_proxy;
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const noProxy = process.env.NO_PROXY || process.env.no_proxy;

    if (httpProxy || httpsProxy) {
      console.log(`\n🔌 Proxy Settings Detected:`);
      if (httpProxy) console.log(`   HTTP_PROXY: ${httpProxy}`);
      if (httpsProxy) console.log(`   HTTPS_PROXY: ${httpsProxy}`);
      if (noProxy) console.log(`   NO_PROXY: ${noProxy}`);
    } else {
      console.log(`\n🔌 Proxy: Not configured (using direct connection)`);
    }

    // Check for SSL/TLS settings
    const tlsReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    const extraCerts = process.env.NODE_EXTRA_CA_CERTS;

    console.log(`\n🔒 SSL/TLS Settings:`);
    console.log(`   NODE_TLS_REJECT_UNAUTHORIZED: ${tlsReject || 'not set (default: 1)'}`);
    if (extraCerts) {
      console.log(`   NODE_EXTRA_CA_CERTS: ${extraCerts}`);
    } else {
      console.log(`   NODE_EXTRA_CA_CERTS: not set`);
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`\n⏱️  Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      let response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(requestBody)
        });
      } catch (error) {
        console.error(`\n❌ Fetch Error Details (Attempt ${attempt + 1}/${maxRetries + 1}):`);
        console.error(`   Error Type: ${error instanceof Error ? error.constructor.name : typeof error}`);
        console.error(`   Error Message: ${error instanceof Error ? error.message : String(error)}`);
        if (error instanceof Error && 'cause' in error) {
          console.error(`   Cause: ${error.cause}`);
        }
        console.error(`   URL Attempted: ${url}`);
        console.error(`   Model: ${this.model}`);

        if (error instanceof Error) {
          // Check for SSL certificate errors (not retryable)
          const isCertError = error.message.includes('unable to get local issuer certificate') ||
                            error.message.includes('certificate') ||
                            error.message.includes('CERT_') ||
                            error.message.includes('self signed certificate');

          if (isCertError) {
            console.error(`\n⚠️  SSL Certificate Error Detected!`);
            console.error(`\nThis usually happens in corporate environments with SSL inspection.`);
            console.error(`\n💡 Solutions:`);
            console.error(`   1. Temporary workaround (NOT for production):`);
            console.error(`      export NODE_TLS_REJECT_UNAUTHORIZED=0`);
            console.error(`\n   2. Proper solution - Add your corporate CA certificate:`);
            console.error(`      export NODE_EXTRA_CA_CERTS=/path/to/corporate-ca.crt`);
            console.error(`\n   3. Get the certificate from your IT department or:`);
            console.error(`      openssl s_client -showcerts -connect api.anthropic.com:443 < /dev/null`);
            throw new Error(`SSL Certificate Verification Failed: ${error.message}\n\nSee above for solutions.`);
          }

          lastError = new Error(`Failed to call Anthropic API: ${error.message}\nModel: ${this.model}\nURL: ${url}\nError Type: ${error.constructor.name}`);

          // Check if error is retryable (network errors like ECONNRESET, ETIMEDOUT, etc.)
          const isRetryable = error.message.includes('ECONNRESET') ||
                            error.message.includes('ETIMEDOUT') ||
                            error.message.includes('ENOTFOUND') ||
                            error.message.includes('ECONNREFUSED') ||
                            error.message.includes('fetch failed');

          if (isRetryable && attempt < maxRetries) {
            console.log(`   ⚠️  Network error detected, will retry...`);
            continue;
          }
        }
        throw lastError || error;
      }

      console.log(`\n📡 Response Status: ${response.status} ${response.statusText}`);
      console.log(`   Headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);

      if (!response.ok) {
        const error = await response.text();
        console.error(`\n❌ API Error Response:`);
        console.error(`   Status: ${response.status} ${response.statusText}`);
        console.error(`   Body: ${error}`);

        // Retry on 529 (overloaded) or 5xx server errors
        if ((response.status === 529 || response.status >= 500) && attempt < maxRetries) {
          console.log(`   ⚠️  Server error detected, will retry...`);
          lastError = new Error(`Anthropic API error: ${response.status} ${error}`);
          continue;
        }

        throw new Error(`Anthropic API error: ${response.status} ${error}`);
      }

      const data = await response.json() as any;

      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response from Anthropic API');
      }

      return data.content[0].text as string;
    }

    // If we get here, all retries failed
    throw lastError || new Error('Failed to call Anthropic API after all retries');
  }

  private parseResponse(response: string): MappingCandidate[] {
    try {
      // Extract JSON from response (Claude might wrap it in ```json ... ```)
      const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                        response.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        console.error('No JSON found in response:', response);
        return [];
      }

      let jsonStr = jsonMatch[1] || jsonMatch[0];

      // Sanitize the JSON string before parsing
      jsonStr = this.sanitizeGeneratedCode(jsonStr);

      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) {
        console.error('Response is not an array:', parsed);
        return [];
      }

      // Sanitize each mapping candidate
      return parsed.map(item => ({
        targetField: item.targetField,
        sourceField: item.sourceField,
        confidence: item.confidence,
        reasoning: this.sanitizeGeneratedCode(item.reasoning || ''),
        transformExpr: item.transformExpr ? this.sanitizeGeneratedCode(item.transformExpr) : undefined
      }));
    } catch (e) {
      console.error('Failed to parse AI response:', e);
      console.error('Response was:', response);
      return [];
    }
  }

  private typeToString(type: AST.TypeExpr): string {
    switch (type.kind) {
      case 'PrimitiveType':
        return type.name;
      case 'SchemaRef':
        return type.name;
      case 'EnumRef':
        return type.name;
      case 'ArrayType':
        return `[${this.typeToString(type.element)}]`;
      case 'OptionalType':
        return `${this.typeToString(type.inner)}?`;
      case 'QuantityType':
        return `Quantity<${type.unit}>`;
      case 'TupleType':
        return `(${type.elements.map(e => this.typeToString(e)).join(', ')})`;
      case 'UnionType':
        return type.members.map(m => this.typeToString(m)).join(' | ');
      default:
        return 'unknown';
    }
  }

  // Sanitize AI-generated code to fix common issues
  private sanitizeGeneratedCode(code: string): string {
    let sanitized = code;

    // Replace ALL non-ASCII apostrophe-like characters with straight single quote
    // This includes: ' ' ` ´ ʹ ʻ ʼ ʾ ʿ ˈ ˊ ˋ ˴  ᾽ ᾿  '  ' ‛ ′ ‵ `
    sanitized = sanitized.replace(/[\u0060\u00B4\u02B9-\u02BC\u02BE\u02BF\u02C8\u02CA\u02CB\u02F4\u1FBD\u1FBF\u2018\u2019\u201B\u2032\u2035]/g, "'");

    // Replace ALL non-ASCII double-quote-like characters with straight double quote
    // This includes: " " „ ‟ ″ ‶
    sanitized = sanitized.replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '"');

    // Replace em/en dashes with hyphens
    sanitized = sanitized.replace(/[\u2013\u2014]/g, '-');  // – —

    // Replace unicode superscripts with ASCII
    sanitized = sanitized.replace(/²/g, '2');
    sanitized = sanitized.replace(/³/g, '3');
    sanitized = sanitized.replace(/⁴/g, '4');
    sanitized = sanitized.replace(/⁰/g, '0');
    sanitized = sanitized.replace(/¹/g, '1');

    // Replace multiplication dot with asterisk
    sanitized = sanitized.replace(/·/g, '*');

    // Replace unicode fractions
    sanitized = sanitized.replace(/½/g, '0.5');
    sanitized = sanitized.replace(/¼/g, '0.25');
    sanitized = sanitized.replace(/¾/g, '0.75');

    return sanitized;
  }

  // Generate Morpheus transform code from mappings
  generateTransformCode(
    transformName: string,
    sourceSchema: AST.SchemaDecl,
    targetSchema: AST.SchemaDecl,
    mappings: MappingCandidate[]
  ): string {
    const lines: string[] = [];

    lines.push(`// AI-generated transform (confidence scores in comments)`);
    lines.push(`transform ${transformName}: ${sourceSchema.name} -> ${targetSchema.name} {`);

    for (const mapping of mappings) {
      const confidencePercent = (mapping.confidence * 100).toFixed(0);
      lines.push(`  // ${mapping.reasoning} (confidence: ${confidencePercent}%)`);

      if (mapping.transformExpr) {
        // Use provided transformation expression (already sanitized in parseResponse)
        lines.push(`  ${mapping.targetField} <- ${mapping.transformExpr}`);
      } else {
        // Simple field mapping
        lines.push(`  ${mapping.targetField} <- $.${mapping.sourceField}`);
      }
    }

    lines.push(`}`);

    return lines.join('\n');
  }

  // Validate generated transform code using the type checker
  validateTransformCode(
    transformCode: string,
    filename: string = 'ai-generated.morpheus'
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Lexical analysis
      const lexer = new Lexer(transformCode, filename);
      const { tokens, errors: lexErrors } = lexer.tokenize();

      if (lexErrors.length > 0) {
        errors.push(...lexErrors.map(e => `Lexical error: ${e.message}`));
        return { valid: false, errors, warnings };
      }

      // Parsing
      const parser = new Parser(tokens);
      const { program, errors: parseErrors } = parser.parse();

      if (parseErrors.length > 0) {
        errors.push(...parseErrors.map(e => `Parse error: ${e.message}`));
        return { valid: false, errors, warnings };
      }

      // Type checking
      const symbolTable = new SymbolTable();
      const typeChecker = new TypeChecker(symbolTable);
      const { errors: typeErrors } = typeChecker.check(program);

      if (typeErrors.length > 0) {
        errors.push(...typeErrors.map((e: { message: string }) => `Type error: ${e.message}`));
        return { valid: false, errors, warnings };
      }

      // Success
      return { valid: true, errors: [], warnings };

    } catch (error) {
      if (error instanceof Error) {
        errors.push(`Validation exception: ${error.message}`);
      } else {
        errors.push(`Unknown validation error: ${String(error)}`);
      }
      return { valid: false, errors, warnings };
    }
  }

  // Generate and validate transform code
  generateAndValidateTransformCode(
    transformName: string,
    sourceSchema: AST.SchemaDecl,
    targetSchema: AST.SchemaDecl,
    mappings: MappingCandidate[],
    sourceFile: string = ''
  ): { code: string; validation: ValidationResult } {
    // Generate the complete Morpheus program with schema declarations
    const lines: string[] = [];

    // Include schema declarations from original file (if available)
    if (sourceFile) {
      lines.push(`// Original schemas from: ${sourceFile}`);
      lines.push(``);
    }

    // For validation, we need the schema declarations
    lines.push(`schema ${sourceSchema.name} {`);
    for (const field of sourceSchema.fields) {
      lines.push(`  ${field.name}: ${this.typeToString(field.type)}`);
    }
    lines.push(`}`);
    lines.push(``);

    lines.push(`schema ${targetSchema.name} {`);
    for (const field of targetSchema.fields) {
      lines.push(`  ${field.name}: ${this.typeToString(field.type)}`);
    }
    lines.push(`}`);
    lines.push(``);

    // Generate transform
    const transformCode = this.generateTransformCode(transformName, sourceSchema, targetSchema, mappings);
    lines.push(transformCode);

    let fullCode = lines.join('\n');

    // Sanitize the full code before validation
    fullCode = this.sanitizeGeneratedCode(fullCode);

    // Validate
    const validation = this.validateTransformCode(fullCode);

    return { code: transformCode, validation };
  }
}
