// AI-powered Mapping Synthesizer using Anthropic Claude
// Automatically generates transform mappings based on semantic understanding

import * as AST from '../parser/ast';

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

**Your Task**:
For each field in the Target Schema, determine:
1. Which Source Schema field(s) it should map from
2. Confidence score (0.0 to 1.0) indicating how certain you are
3. Clear reasoning for the mapping
4. Any transformation logic needed (e.g., concatenation, unit conversion)

**Requirements**:
- Only suggest mappings where types are semantically compatible
- Consider field names, types, and semantic meaning
- Explain your reasoning clearly
- If a mapping requires transformation (e.g., combining firstName + lastName → fullName), specify the logic
- If no good mapping exists for a target field, omit it

**Output Format** (JSON array):
\`\`\`json
[
  {
    "targetField": "field_name",
    "sourceField": "source_field_name",
    "confidence": 0.95,
    "reasoning": "Detailed explanation",
    "transformExpr": "$.firstName + ' ' + $.lastName"
  }
]
\`\`\`

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

      const jsonStr = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) {
        console.error('Response is not an array:', parsed);
        return [];
      }

      return parsed.map(item => ({
        targetField: item.targetField,
        sourceField: item.sourceField,
        confidence: item.confidence,
        reasoning: item.reasoning,
        transformExpr: item.transformExpr
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
        // Use provided transformation expression
        lines.push(`  ${mapping.targetField} <- ${mapping.transformExpr}`);
      } else {
        // Simple field mapping
        lines.push(`  ${mapping.targetField} <- $.${mapping.sourceField}`);
      }
    }

    lines.push(`}`);

    return lines.join('\n');
  }
}
