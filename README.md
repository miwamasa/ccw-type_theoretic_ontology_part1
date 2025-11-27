# Morpheus DSL

**M**apping **O**ntologies via **R**eversible **PH**ysically-typed **E**xpressions with **U**nits and **S**chemas

Morpheus is a domain-specific language (DSL) for type-safe data transformation between different ontologies (schemas), with built-in support for physical units and dimensional analysis.

## Features

- **Type-safe transformations**: Compile-time verification of data transformations
- **Unit system**: Physical units with dimensional analysis
- **Schema definitions**: Define source and target data structures
- **Lookup tables**: Type-safe external data references
- **Aggregate operations**: sum, avg, max, min, collect, filter, groupBy
- **Pipeline composition**: Chain multiple transformations
- **Multi-target code generation**: TypeScript and Python (planned)

## Installation

```bash
npm install
npm run build
```

## Usage

### CLI

Compile a Morpheus file:

```bash
npx morpheus compile examples/cfp-example.morpheus
```

Type check only:

```bash
npx morpheus check examples/cfp-example.morpheus
```

### API

```typescript
import { compile } from '@morpheus/dsl';

const source = `
schema Person {
  name: String
  age: Int
}

schema PersonDTO {
  fullName: String
  ageInYears: Int
}

transform PersonToDTO: Person -> PersonDTO {
  fullName <- $.name
  ageInYears <- $.age
}
`;

const result = compile(source);

if (result.success) {
  console.log('Compilation successful!');
  console.log('Generated MIR:', result.mir);
} else {
  console.error('Errors:', result.errors);
}
```

## Example

```morpheus
// Define units
unit kWh
unit kg
unit kgCO2
unit kgCO2_per_kWh = kgCO2 / kWh

// Source schema
schema ProductionRecord {
  productId: String
  electricityUsage: Quantity<kWh>
}

// Target schema
schema CFPResult {
  productId: String
  totalEmission: Quantity<kgCO2>
}

// Lookup table
lookup EmissionFactor {
  key: String
  value: Quantity<kgCO2_per_kWh>
  source: "emission_factors.csv"
}

// Transform
transform ProductionToCFP: ProductionRecord -> CFPResult {
  productId <- $.productId
  totalEmission <- $.electricityUsage * lookup(EmissionFactor, "electricity")
}
```

## Architecture

```
┌─────────────────────────────────────┐
│     Morpheus Compiler                │
├─────────────────────────────────────┤
│  Source (.morpheus)                  │
│         ↓                            │
│  ┌─────────────┐                    │
│  │   Lexer     │ → Tokens            │
│  └─────────────┘                    │
│         ↓                            │
│  ┌─────────────┐                    │
│  │   Parser    │ → AST               │
│  └─────────────┘                    │
│         ↓                            │
│  ┌─────────────┐                    │
│  │  Resolver   │ → Symbol Table      │
│  └─────────────┘                    │
│         ↓                            │
│  ┌─────────────┐                    │
│  │ TypeChecker │ → Typed AST         │
│  └─────────────┘                    │
│         ↓                            │
│  ┌─────────────┐                    │
│  │ IR Generator│ → MIR               │
│  └─────────────┘                    │
│         ↓                            │
│  ┌─────────────┐                    │
│  │  Code Gen   │ → TypeScript/Python │
│  └─────────────┘                    │
└─────────────────────────────────────┘
```

## Project Structure

```
morpheus/
├── src/
│   ├── lexer/          # Lexical analysis
│   ├── parser/         # Syntax analysis
│   ├── analyzer/       # Type checking & analysis
│   ├── ir/             # Intermediate representation
│   ├── codegen/        # Code generation
│   ├── runtime/        # Runtime libraries
│   ├── cli/            # CLI tool
│   └── errors/         # Error handling
├── examples/           # Example Morpheus files
├── specifications/     # Language specification
└── tests/              # Test suite
```

## Development

```bash
# Build
npm run build

# Watch mode
npm run watch

# Run tests
npm test

# Format code
npm run format

# Lint
npm run lint
```

## Theoretical Foundation

Morpheus is based on:

- **Type theory**: Record types (Σ-types) for schemas
- **Category theory**: Transformations as morphisms in a schema category
- **Optics**: Lenses, prisms, and traversals for data access
- **Dimensional analysis**: Type-level tracking of physical units

## References

See `specifications/` for detailed language specification.

## License

MIT