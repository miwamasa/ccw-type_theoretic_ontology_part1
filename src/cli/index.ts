#!/usr/bin/env node

// Morpheus DSL Compiler CLI

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { Lexer } from '../lexer/lexer';
import { Parser } from '../parser/parser';
import { Resolver } from '../analyzer/resolver';
import { TypeChecker } from '../analyzer/type-checker';
import { IRGenerator } from '../ir/ir-gen';
import { TypeScriptCodegen } from '../codegen/typescript/ts-codegen';
import { AIMappingSynthesizer } from '../analyzer/ai-mapping-synthesizer';
import * as AST from '../parser/ast';

const program = new Command();

program
  .name('morpheus')
  .description('Morpheus DSL Compiler - Type-safe data transformation')
  .version('0.1.0');

program
  .command('compile')
  .description('Compile Morpheus DSL file to TypeScript')
  .argument('<file>', 'Input .morpheus file')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('--target <lang>', 'Target language (typescript|python)', 'typescript')
  .option('--check-only', 'Only perform type checking')
  .action((file: string, options) => {
    try {
      compile(file, options);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    }
  });

program
  .command('check')
  .description('Type check Morpheus DSL file')
  .argument('<file>', 'Input .morpheus file')
  .action((file: string) => {
    try {
      compile(file, { checkOnly: true });
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    }
  });

program
  .command('ai-map')
  .description('Generate transform mapping using AI (Anthropic Claude)')
  .argument('<file>', 'Input .morpheus file containing schemas')
  .requiredOption('--source <schema>', 'Source schema name')
  .requiredOption('--target <schema>', 'Target schema name')
  .option('--transform <name>', 'Transform name to generate')
  .option('--domain <context>', 'Domain context for better AI understanding')
  .option('--model <model>', 'Claude model to use (default: sonnet, or set ANTHROPIC_MODEL)')
  .option('--min-confidence <score>', 'Minimum confidence score (0-1)', '0.5')
  .option('-o, --output <file>', 'Output file for generated transform')
  .action(async (file: string, options) => {
    try {
      await aiMapCommand(file, options);
    } catch (error) {
      if (error instanceof Error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    }
  });

program.parse();

function compile(inputFile: string, options: any): void {
  // Read input file
  const source = fs.readFileSync(inputFile, 'utf-8');

  console.log(`Compiling ${inputFile}...`);

  // Lexical analysis
  console.log('  [1/5] Lexical analysis...');
  const lexer = new Lexer(source, inputFile);
  const { tokens, errors: lexErrors } = lexer.tokenize();

  if (lexErrors.length > 0) {
    console.error('Lexical errors:');
    for (const error of lexErrors) {
      console.error(`  ${error.span.start.line}:${error.span.start.column} - ${error.message}`);
    }
    process.exit(1);
  }

  console.log(`    Found ${tokens.length} tokens`);

  // Parsing
  console.log('  [2/5] Parsing...');
  const parser = new Parser(tokens);
  const { program: ast, errors: parseErrors } = parser.parse();

  if (parseErrors.length > 0) {
    console.error('Parse errors:');
    for (const error of parseErrors) {
      console.error(`  ${error.span.start.line}:${error.span.start.column} - ${error.message}`);
    }
    process.exit(1);
  }

  console.log(`    Found ${ast.declarations.length} declarations`);

  // Name resolution
  console.log('  [3/5] Name resolution...');
  const resolver = new Resolver();
  const { symbolTable, errors: resolveErrors } = resolver.resolve(ast);

  if (resolveErrors.length > 0) {
    console.error('Resolution errors:');
    for (const error of resolveErrors) {
      console.error(`  ${error.message}`);
    }
    process.exit(1);
  }

  // Type checking
  console.log('  [4/5] Type checking...');
  const typeChecker = new TypeChecker(symbolTable);
  const { errors: typeErrors } = typeChecker.check(ast);

  if (typeErrors.length > 0) {
    console.error('Type errors:');
    for (const error of typeErrors) {
      console.error(`  ${error.message}`);
    }
    process.exit(1);
  }

  console.log('    Type checking passed');

  if (options.checkOnly) {
    console.log('✓ Check completed successfully');
    return;
  }

  // IR generation
  console.log('  [5/5] IR generation...');
  const irGenerator = new IRGenerator(symbolTable);
  const mir = irGenerator.generate(ast);

  console.log(`    Generated IR with:`);
  console.log(`      ${mir.schemas.size} schemas`);
  console.log(`      ${mir.transforms.size} transforms`);
  console.log(`      ${mir.lookups.size} lookups`);
  console.log(`      ${mir.pipelines.size} pipelines`);

  // Code generation
  if (options.target === 'typescript') {
    console.log('\n  [6/6] Generating TypeScript code...');
    const codegen = new TypeScriptCodegen();
    const files = codegen.generate(mir);

    // Create output directory
    const outputDir = options.output || './output';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write generated files
    let fileCount = 0;
    for (const [filename, content] of files) {
      const filepath = path.join(outputDir, filename);
      const dir = path.dirname(filepath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filepath, content, 'utf-8');
      console.log(`    ✓ Generated ${filename}`);
      fileCount++;
    }

    console.log(`\n✓ Successfully generated ${fileCount} file(s) in ${outputDir}/`);
  } else {
    console.log(`\n  Code generation for ${options.target} is not yet implemented.`);
  }

  console.log('\n✓ Compilation completed successfully');
}

// Model name resolver - supports aliases and full model names
function resolveModelName(modelInput: string): string {
  const aliases: { [key: string]: string } = {
    'sonnet': 'claude-3-5-sonnet-20241022',
    'opus': 'claude-3-opus-20240229',
    'haiku': 'claude-3-haiku-20240307',
    'sonnet-3': 'claude-3-sonnet-20240229',
    'sonnet-3.5': 'claude-3-5-sonnet-20241022',
  };

  return aliases[modelInput.toLowerCase()] || modelInput;
}

async function aiMapCommand(inputFile: string, options: any): Promise<void> {
  // Check for API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable not set');
    console.error('Please set it with: export ANTHROPIC_API_KEY="your-api-key"');
    process.exit(1);
  }

  // Determine model to use (priority: CLI option > env variable > default)
  const modelInput = options.model ||
                     process.env.ANTHROPIC_MODEL ||
                     'claude-3-5-sonnet-20241022';
  const model = resolveModelName(modelInput);

  // Read and parse input file
  const source = fs.readFileSync(inputFile, 'utf-8');

  console.log(`🔍 Analyzing schemas in ${inputFile}...`);

  const lexer = new Lexer(source, inputFile);
  const { tokens, errors: lexErrors } = lexer.tokenize();

  if (lexErrors.length > 0) {
    console.error('Lexical errors:');
    for (const error of lexErrors) {
      console.error(`  ${error.message}`);
    }
    process.exit(1);
  }

  const parser = new Parser(tokens);
  const { program: ast, errors: parseErrors } = parser.parse();

  if (parseErrors.length > 0) {
    console.error('Parse errors:');
    for (const error of parseErrors) {
      console.error(`  ${error.message}`);
    }
    process.exit(1);
  }

  // Find source and target schemas
  const sourceSchema = ast.declarations.find(
    d => d.kind === 'SchemaDecl' && d.name === options.source
  ) as AST.SchemaDecl | undefined;

  const targetSchema = ast.declarations.find(
    d => d.kind === 'SchemaDecl' && d.name === options.target
  ) as AST.SchemaDecl | undefined;

  if (!sourceSchema) {
    console.error(`Error: Source schema '${options.source}' not found`);
    process.exit(1);
  }

  if (!targetSchema) {
    console.error(`Error: Target schema '${options.target}' not found`);
    process.exit(1);
  }

  console.log(`\n📋 Source: ${sourceSchema.name} (${sourceSchema.fields.length} fields)`);
  console.log(`📋 Target: ${targetSchema.name} (${targetSchema.fields.length} fields)`);

  // Initialize AI synthesizer
  const synthesizer = new AIMappingSynthesizer({
    apiKey,
    model
  });

  // Generate mappings
  console.log(`\n🤖 Calling Claude AI (${model})...`);

  const mappings = await synthesizer.synthesize(
    sourceSchema,
    targetSchema,
    {
      domainContext: options.domain,
      minConfidence: parseFloat(options.minConfidence)
    }
  );

  if (mappings.length === 0) {
    console.log('\n⚠️  No mappings found with sufficient confidence');
    return;
  }

  // Print mapping report
  console.log(`\n📊 Mapping Report:\n`);
  for (const mapping of mappings.sort((a, b) => b.confidence - a.confidence)) {
    const confidencePercent = (mapping.confidence * 100).toFixed(0);
    const icon = mapping.confidence >= 0.9 ? '✓' :
                 mapping.confidence >= 0.7 ? '⚡' : '?';

    console.log(`${icon} ${mapping.targetField} <- $.${mapping.sourceField}`);
    console.log(`   Confidence: ${confidencePercent}%`);
    console.log(`   Reason: ${mapping.reasoning}`);
    if (mapping.transformExpr) {
      console.log(`   Transform: ${mapping.transformExpr}`);
    }
    console.log('');
  }

  // Generate transform code
  const transformName = options.transform ||
                        `${sourceSchema.name}To${targetSchema.name}`;

  const transformCode = synthesizer.generateTransformCode(
    transformName,
    sourceSchema,
    targetSchema,
    mappings
  );

  console.log('━'.repeat(60));
  console.log('Generated Transform:');
  console.log('━'.repeat(60));
  console.log(transformCode);
  console.log('━'.repeat(60));

  // Save to file if output specified
  if (options.output) {
    fs.writeFileSync(options.output, transformCode, 'utf-8');
    console.log(`\n✓ Saved to ${options.output}`);
  } else {
    console.log('\nℹ️  Use --output to save the generated transform to a file');
  }

  // Statistics
  const avgConfidence = mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length;
  console.log(`\n📈 Statistics:`);
  console.log(`   Total mappings: ${mappings.length} / ${targetSchema.fields.length}`);
  console.log(`   Average confidence: ${(avgConfidence * 100).toFixed(0)}%`);
  console.log(`   Coverage: ${((mappings.length / targetSchema.fields.length) * 100).toFixed(0)}%`);
}
