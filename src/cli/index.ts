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
