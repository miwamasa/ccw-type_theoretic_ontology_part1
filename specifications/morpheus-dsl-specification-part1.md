# Morpheus DSL 実装仕様書 Part 1

**Version**: 1.0.0-draft  
**Date**: 2025-01  
**Status**: Implementation Ready  
**Scope**: 第1章〜第9章（基盤部分）

---

## 目次

1. [概要](#1-概要)
2. [設計思想と理論的背景](#2-設計思想と理論的背景)
3. [言語仕様](#3-言語仕様)
4. [型システム](#4-型システム)
5. [セマンティクス](#5-セマンティクス)
6. [コンパイラアーキテクチャ](#6-コンパイラアーキテクチャ)
7. [パーサー実装](#7-パーサー実装)
8. [型チェッカー実装](#8-型チェッカー実装)
9. [中間表現(IR)](#9-中間表現ir)

**Part 2 で扱う内容**:
- コード生成（TypeScript/Python）
- ランタイムライブラリ
- CLI設計
- エラー処理
- テスト戦略
- 実装ロードマップ

---

## 1. 概要

### 1.1 Morpheusとは

Morpheus（**M**apping **O**ntologies via **R**eversible **PH**ysically-typed **E**xpressions with **U**nits and **S**chemas）は、異なるオントロジー（スキーマ）間のデータ変換を型安全に記述するためのドメイン固有言語（DSL）である。

### 1.2 解決する課題

1. **オントロジー間のギャップ**: データ発生源のスキーマと利用先のスキーマの構造的差異
2. **計算を伴う変換**: 単純なフィールドマッピングだけでなく、中間計算が必要なケース
3. **単位系の整合性**: 物理量を扱う際の次元・単位の一貫性保証
4. **変換の検証可能性**: 変換ロジックの正しさをコンパイル時に検証

### 1.3 主要機能

| 機能 | 説明 |
|------|------|
| スキーマ定義 | ソース/ターゲットの構造を型として定義 |
| 単位システム | 物理単位と次元解析の型レベルサポート |
| 変換記述 | 宣言的なマッピングルール記述 |
| 集約・分解 | 配列操作、グループ化、条件分岐 |
| 外部参照 | ルックアップテーブルへの型安全なアクセス |
| パイプライン | 複数変換の合成 |
| 多言語出力 | TypeScript/Python/JSONへのコード生成 |

### 1.4 使用例（ユースケース）

- 製造業：生産管理データ → CFP（カーボンフットプリント）計算
- 金融：取引データ → 会計仕訳データ
- 医療：電子カルテ → 保険請求データ
- IoT：センサーデータ → 分析用正規化データ

### 1.5 サンプルコード

```morpheus
// 単位定義
unit kWh
unit kg
unit kgCO2
unit kgCO2_per_kWh = kgCO2 / kWh

// ソーススキーマ
schema ProductionRecord {
  productId: String
  electricityUsage: Quantity<kWh>
  materials: [MaterialUsage]
}

schema MaterialUsage {
  code: String
  weight: Quantity<kg>
}

// ターゲットスキーマ
schema CFPResult {
  productId: String
  totalEmission: Quantity<kgCO2>
}

// ルックアップ
lookup EmissionFactor {
  key: String
  value: Quantity<kgCO2_per_kWh>
  source: "emission_factors.csv"
}

// 変換定義
transform ProductionToCFP: ProductionRecord -> CFPResult {
  productId <- $.productId
  totalEmission <- $.electricityUsage * lookup(EmissionFactor, "electricity")
}
```

---

## 2. 設計思想と理論的背景

### 2.1 型理論的基盤

Morpheusは以下の型理論的概念に基づいている：

#### 2.1.1 レコード型としてのスキーマ

スキーマを依存積型（Σ型）として表現：

```
Schema = Σ(field₁: Type₁, field₂: Type₂, ..., fieldₙ: Typeₙ)
```

#### 2.1.2 Lens/Opticsとしての変換

変換プリミティブをOpticsの観点で分類：

| Optic | 用途 | 型シグネチャ |
|-------|------|-------------|
| Lens | フィールドアクセス | `Lens S A = { get: S → A, set: (S, A) → S }` |
| Prism | 部分構造アクセス | `Prism S A = { preview: S → A?, review: A → S }` |
| Traversal | 配列要素アクセス | `Traversal S A = { toList: S → [A], over: (A → A) → S → S }` |
| Affine | 条件付きアクセス | `Affine S A = Lens ∩ Prism` |

#### 2.1.3 計算としての型変換

型の分解と合成を計算として捉える：

```
decompose : S → (A × B × C)      -- 型の分解
transform : A → A'               -- 個別変換
compose   : (A' × B' × C') → T   -- 型の合成
```

### 2.2 圏論的基盤

#### 2.2.1 スキーマ圏

- **対象（Objects）**: スキーマ（型）
- **射（Morphisms）**: 変換関数
- **合成**: 変換のパイプライン化
- **恒等射**: 恒等変換

#### 2.2.2 関手としての変換

構造を保存する変換は関手として定式化：

```
F: SchemaCategory → SchemaCategory
F(A → B) = F(A) → F(B)
```

### 2.3 設計原則

1. **宣言的記述**: 「何を」変換するかを記述、「どう」は推論
2. **型安全性**: 単位系・構造の整合性をコンパイル時に検証
3. **合成可能性**: 小さな変換を組み合わせて複雑な変換を構築
4. **可読性**: ドメインエキスパートが理解可能な構文
5. **拡張性**: 新しい変換パターンを追加可能

---

## 3. 言語仕様

### 3.1 字句仕様（Lexical Specification）

#### 3.1.1 トークン定義

```
// 識別子
IDENTIFIER     = [a-zA-Z_][a-zA-Z0-9_]*

// リテラル
INT_LITERAL    = [0-9]+
FLOAT_LITERAL  = [0-9]+\.[0-9]+([eE][+-]?[0-9]+)?
STRING_LITERAL = "([^"\\]|\\.)*"
BOOL_LITERAL   = "true" | "false"

// キーワード
KEYWORDS = {
  "schema", "enum", "unit", "dimension", "lookup", "transform", "pipeline",
  "if", "then", "else", "match", "when", "where",
  "sum", "avg", "max", "min", "count", "collect", "filter", "groupBy",
  "extends", "constraint", "infer", "hints", "parallel"
}

// 演算子
OPERATORS = {
  "+", "-", "*", "/", "^", "%",
  "==", "!=", "<", ">", "<=", ">=",
  "&&", "||", "!",
  "<-", "->", "=>", "~>",
  ".", "?.", "??", "@", "$",
  ":", "::", "|", ","
}

// 括弧類
BRACKETS = { "(", ")", "{", "}", "[", "]", "<", ">" }

// コメント
LINE_COMMENT  = "//" [^\n]*
BLOCK_COMMENT = "/*" .* "*/"
```

### 3.2 構文仕様（Syntax Specification）

#### 3.2.1 完全EBNF文法

```ebnf
(* ========== トップレベル ========== *)

Program        ::= Declaration*

Declaration    ::= SchemaDecl
                 | EnumDecl
                 | UnitDecl
                 | DimensionDecl
                 | LookupDecl
                 | TransformDecl
                 | PipelineDecl
                 | ConstraintDecl
                 | InferDecl

(* ========== スキーマ定義 ========== *)

SchemaDecl     ::= Annotation* "schema" Identifier GenericParams? ExtendsClause? 
                   "{" FieldDecl* "}"

GenericParams  ::= "<" Identifier ("," Identifier)* ">"

ExtendsClause  ::= "extends" SchemaRef

FieldDecl      ::= Annotation* Identifier ":" TypeExpr

TypeExpr       ::= PrimitiveType
                 | SchemaRef
                 | EnumRef
                 | ArrayType
                 | OptionalType
                 | QuantityType
                 | TupleType
                 | UnionType
                 | GenericType

PrimitiveType  ::= "String" | "Int" | "Float" | "Bool" | "Date" | "DateTime" | "Void"

SchemaRef      ::= Identifier GenericArgs?

GenericArgs    ::= "<" TypeExpr ("," TypeExpr)* ">"

ArrayType      ::= "[" TypeExpr "]"

OptionalType   ::= TypeExpr "?"

QuantityType   ::= "Quantity" "<" UnitExpr ">"

TupleType      ::= "(" TypeExpr ("," TypeExpr)+ ")"

UnionType      ::= TypeExpr ("|" TypeExpr)+

(* ========== 列挙型定義 ========== *)

EnumDecl       ::= Annotation* "enum" Identifier "{" EnumVariant ("," EnumVariant)* "}"

EnumVariant    ::= Identifier ("=" Literal)?

(* ========== 単位定義 ========== *)

DimensionDecl  ::= "dimension" Identifier

UnitDecl       ::= "unit" Identifier (":" DimensionRef)? ("=" UnitExpr)?

UnitExpr       ::= UnitTerm (("*" | "/") UnitTerm)*

UnitTerm       ::= UnitFactor ("^" IntLiteral)?

UnitFactor     ::= Identifier | "1" | "(" UnitExpr ")"

(* ========== ルックアップ定義 ========== *)

LookupDecl     ::= Annotation* "lookup" Identifier "{" LookupField* "}"

LookupField    ::= "key" ":" TypeExpr
                 | "value" ":" TypeExpr
                 | "source" ":" StringLiteral
                 | "default" ":" Literal

(* ========== 変換定義 ========== *)

TransformDecl  ::= Annotation* "transform" GenericParams? Identifier ":" 
                   SourceType "->" TargetType WhereClause? "{" MappingRule* "}"

SourceType     ::= TypeExpr | "(" TypeExpr ("," TypeExpr)+ ")"

TargetType     ::= TypeExpr | "(" TypeExpr ("," TypeExpr)+ ")"

WhereClause    ::= "where" Constraint ("," Constraint)*

Constraint     ::= Identifier "<" TypeExpr ("," TypeExpr)* ">"

MappingRule    ::= TargetPath "<-" SourceExpr
                 | "@" IntLiteral "{" MappingRule* "}"

TargetPath     ::= Identifier ("." Identifier)*

(* ========== ソース式 ========== *)

SourceExpr     ::= OrExpr

OrExpr         ::= AndExpr ("||" AndExpr)*

AndExpr        ::= EqualityExpr ("&&" EqualityExpr)*

EqualityExpr   ::= CompareExpr (("==" | "!=") CompareExpr)*

CompareExpr    ::= AddExpr (("<" | ">" | "<=" | ">=") AddExpr)*

AddExpr        ::= MulExpr (("+" | "-") MulExpr)*

MulExpr        ::= UnaryExpr (("*" | "/" | "%") UnaryExpr)*

UnaryExpr      ::= ("!" | "-")? PostfixExpr

PostfixExpr    ::= PrimaryExpr (PostfixOp)*

PostfixOp      ::= "." Identifier
                 | "?." Identifier
                 | "[" SourceExpr "]"
                 | "(" ArgList? ")"

PrimaryExpr    ::= Literal
                 | PathExpr
                 | TargetRef
                 | ParenExpr
                 | IfExpr
                 | MatchExpr
                 | LambdaExpr
                 | AggregateExpr
                 | LookupExpr
                 | FunctionCall

PathExpr       ::= "$" ("." Identifier | "[" SourceExpr "]")*
                 | "$" IntLiteral ("." Identifier | "[" SourceExpr "]")*

TargetRef      ::= "@" Identifier

IfExpr         ::= "if" SourceExpr "then" SourceExpr "else" SourceExpr

MatchExpr      ::= "match" SourceExpr "{" MatchCase+ "}"

MatchCase      ::= Pattern "=>" SourceExpr

Pattern        ::= Literal | Identifier | "_"

LambdaExpr     ::= "|" Identifier (":" TypeExpr)? "|" SourceExpr

AggregateExpr  ::= AggregateFunc "(" SourceExpr "," LambdaExpr ")"

AggregateFunc  ::= "sum" | "avg" | "max" | "min" | "count" | "collect" | "filter" | "groupBy"

LookupExpr     ::= "lookup" "(" Identifier "," SourceExpr ("," SourceExpr)? ")"

(* ========== パイプライン定義 ========== *)

PipelineDecl   ::= Annotation* "pipeline" Identifier "{" PipelineStep* "}"

PipelineStep   ::= TransformRef
                 | ParallelStep
                 | ConditionalStep

TransformRef   ::= Identifier

ParallelStep   ::= "parallel" "{" TransformRef ("," TransformRef)* "}"

ConditionalStep::= "when" SourceExpr ":" TransformRef

(* ========== アノテーション ========== *)

Annotation     ::= "@" Identifier ("(" AnnotationArgs ")")?

AnnotationArgs ::= AnnotationArg ("," AnnotationArg)*

AnnotationArg  ::= Identifier ":" Literal | Literal
```

### 3.3 予約語一覧

```
schema, enum, unit, dimension, lookup, transform, pipeline,
constraint, infer, hints, constraints, parallel, when,
if, then, else, match, where, extends,
sum, avg, max, min, count, collect, filter, groupBy,
true, false, null,
String, Int, Float, Bool, Date, DateTime, Void, Quantity
```

---

## 4. 型システム

### 4.1 型の種類

#### 4.1.1 プリミティブ型

| 型名 | 説明 | 対応するランタイム型（TS） |
|------|------|--------------------------|
| `String` | 文字列 | `string` |
| `Int` | 整数 | `number` |
| `Float` | 浮動小数点 | `number` |
| `Bool` | 真偽値 | `boolean` |
| `Date` | 日付 | `Date` |
| `DateTime` | 日時 | `Date` |
| `Void` | 値なし | `void` |

#### 4.1.2 複合型

| 型構成子 | 構文 | 説明 |
|---------|------|------|
| 配列 | `[T]` | T型の配列 |
| オプショナル | `T?` | TまたはNull |
| タプル | `(T1, T2, ...)` | 固定長の異種配列 |
| ユニオン | `T1 \| T2` | いずれかの型 |
| 数量 | `Quantity<U>` | 単位Uを持つ数値 |

#### 4.1.3 スキーマ型

```morpheus
schema Person {
  name: String
  age: Int
  email: String?
}
```

内部表現：
```
Person = Record {
  fields: [
    ("name", String),
    ("age", Int),
    ("email", Optional(String))
  ]
}
```

### 4.2 単位システム

#### 4.2.1 次元（Dimension）

物理量の基本次元：

```morpheus
dimension Length
dimension Mass
dimension Time
dimension Temperature
dimension Amount        // 物質量
dimension Current       // 電流
dimension Luminosity    // 光度
```

#### 4.2.2 単位（Unit）

```morpheus
// 基本単位
unit m: Length
unit kg: Mass
unit s: Time

// 派生単位
unit km = 1000 * m
unit kWh = kg * m^2 / s^2 * 3.6e6
unit N = kg * m / s^2

// 無次元単位
unit percent = 1 / 100
```

#### 4.2.3 次元解析

単位式の次元を追跡：

```
dim(m) = Length
dim(kg) = Mass
dim(m * kg) = Length * Mass
dim(m / s) = Length / Time
dim(m^2) = Length^2
dim(1) = Dimensionless
```

#### 4.2.4 単位互換性チェック

```
// 加算・減算：同一単位が必要
Quantity<m> + Quantity<m> = Quantity<m>     ✓
Quantity<m> + Quantity<kg> = Error          ✗

// 乗算：単位が合成される
Quantity<kg> * Quantity<m/s^2> = Quantity<N>

// 除算：単位が簡約される
Quantity<m> / Quantity<s> = Quantity<m/s>
```

### 4.3 型推論規則

#### 4.3.1 リテラルの型

```
───────────────────
IntLiteral : Int

───────────────────
FloatLiteral : Float

───────────────────
StringLiteral : String
```

#### 4.3.2 パス式の型

```
Γ ⊢ $ : Source
─────────────────────
Γ ⊢ $.field : Source.field.type

Γ ⊢ e : [T]    Γ ⊢ i : Int
───────────────────────────
Γ ⊢ e[i] : T
```

#### 4.3.3 演算子の型

```
Γ ⊢ e₁ : Quantity<U₁>    Γ ⊢ e₂ : Quantity<U₂>
──────────────────────────────────────────────
Γ ⊢ e₁ * e₂ : Quantity<U₁ * U₂>

Γ ⊢ e₁ : Quantity<U>    Γ ⊢ e₂ : Quantity<U>
────────────────────────────────────────────
Γ ⊢ e₁ + e₂ : Quantity<U>
```

#### 4.3.4 集約式の型

```
Γ ⊢ e : [T]    Γ, x:T ⊢ f : Quantity<U>
───────────────────────────────────────
Γ ⊢ sum(e, |x| f) : Quantity<U>

Γ ⊢ e : [T]    Γ, x:T ⊢ f : R
─────────────────────────────
Γ ⊢ collect(e, |x| f) : [R]
```

### 4.4 部分型関係

#### 4.4.1 構造的部分型

```
schema Base { a: Int, b: String }
schema Extended { a: Int, b: String, c: Bool }

Extended <: Base   // Extended は Base の部分型
```

#### 4.4.2 オプショナルの部分型

```
T <: T?      // 非オプショナルはオプショナルの部分型
T? ≮: T      // 逆は成り立たない
```

---

## 5. セマンティクス

### 5.1 評価規則（Operational Semantics）

#### 5.1.1 環境

```typescript
Env = {
  source: Value,                    // ソースデータ
  target: Map<String, Value>,       // 構築中のターゲット
  lookups: Map<String, LookupTable>,
  context: Map<String, Value>       // ローカル変数
}
```

#### 5.1.2 値

```typescript
Value = 
  | VInt(n: Int)
  | VFloat(n: Float)
  | VString(s: String)
  | VBool(b: Bool)
  | VQuantity(value: Float, unit: Unit)
  | VArray(items: [Value])
  | VRecord(fields: Map<String, Value>)
  | VNull
  | VEnum(variant: String)
```

#### 5.1.3 主要な評価規則

**パス式**
```
eval($.field, env) = env.source.fields[field]
eval($[i], env) = env.source[eval(i, env)]
```

**算術演算**
```
eval(e₁ + e₂, env) = 
  match (eval(e₁, env), eval(e₂, env)) with
  | (VQuantity(n₁, u), VQuantity(n₂, u)) -> VQuantity(n₁ + n₂, u)
  | (VInt(n₁), VInt(n₂)) -> VInt(n₁ + n₂)
```

**集約**
```
eval(sum(arr, |x| body), env) =
  fold(eval(arr, env), 0, λ(acc, item).
    acc + eval(body, env.context.add(x, item))
  )
```

**ルックアップ**
```
eval(lookup(L, key), env) =
  env.lookups[L].get(eval(key, env)) ?? env.lookups[L].default
```

### 5.2 変換の評価

```
evalTransform(transform, source, env) =
  let env' = { ...env, source: source, target: {} } in
  for rule in transform.rules:
    let value = eval(rule.sourceExpr, env') in
    env'.target.set(rule.targetPath, value)
  return env'.target
```

---

## 6. コンパイラアーキテクチャ

### 6.1 全体構成

```
┌─────────────────────────────────────────────────────────────────┐
│                        Morpheus Compiler                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Source Files (.morpheus)                                        │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────┐                                            │
│  │     Lexer       │  → Tokens                                  │
│  └────────┬────────┘                                            │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │     Parser      │  → AST (Concrete Syntax Tree)              │
│  └────────┬────────┘                                            │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │  Name Resolver  │  → AST (with resolved references)          │
│  └────────┬────────┘                                            │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │  Type Checker   │  → Typed AST                               │
│  └────────┬────────┘                                            │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │  Unit Checker   │  → Unit-verified AST                       │
│  └────────┬────────┘                                            │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │   IR Generator  │  → MIR (Morpheus IR)                       │
│  └────────┬────────┘                                            │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │   Optimizer     │  → Optimized MIR                           │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ├──────────────┬──────────────┬──────────────┐        │
│           ▼              ▼              ▼              ▼        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────┐ │
│  │ TS Codegen   │ │ Python       │ │ JSON Schema  │ │ Docs   │ │
│  │              │ │ Codegen      │ │ Generator    │ │ Gen    │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 モジュール構成

```
morpheus/
├── src/
│   ├── lexer/
│   │   ├── token.ts          # トークン定義
│   │   ├── lexer.ts          # 字句解析器
│   │   └── index.ts
│   │
│   ├── parser/
│   │   ├── ast.ts            # AST定義
│   │   ├── parser.ts         # 構文解析器
│   │   └── index.ts
│   │
│   ├── analyzer/
│   │   ├── scope.ts          # スコープ管理
│   │   ├── resolver.ts       # 名前解決
│   │   ├── types.ts          # 型定義
│   │   ├── type-checker.ts   # 型検査
│   │   ├── units.ts          # 単位定義
│   │   ├── unit-checker.ts   # 単位検査
│   │   └── index.ts
│   │
│   ├── ir/
│   │   ├── mir.ts            # 中間表現定義
│   │   ├── ir-gen.ts         # IR生成
│   │   ├── optimizer.ts      # 最適化
│   │   └── index.ts
│   │
│   ├── codegen/
│   │   ├── typescript/
│   │   ├── python/
│   │   ├── json-schema/
│   │   └── docs/
│   │
│   ├── runtime/
│   │   ├── typescript/
│   │   └── python/
│   │
│   ├── cli/
│   │   └── index.ts
│   │
│   └── errors/
│       └── index.ts
│
├── tests/
├── examples/
└── package.json
```

---

## 7. パーサー実装

### 7.1 Token型定義

```typescript
// src/lexer/token.ts

export enum TokenType {
  // リテラル
  INT_LITERAL = 'INT_LITERAL',
  FLOAT_LITERAL = 'FLOAT_LITERAL',
  STRING_LITERAL = 'STRING_LITERAL',
  BOOL_LITERAL = 'BOOL_LITERAL',
  
  // 識別子
  IDENTIFIER = 'IDENTIFIER',
  
  // キーワード
  SCHEMA = 'SCHEMA',
  ENUM = 'ENUM',
  UNIT = 'UNIT',
  DIMENSION = 'DIMENSION',
  LOOKUP = 'LOOKUP',
  TRANSFORM = 'TRANSFORM',
  PIPELINE = 'PIPELINE',
  IF = 'IF',
  THEN = 'THEN',
  ELSE = 'ELSE',
  MATCH = 'MATCH',
  WHEN = 'WHEN',
  WHERE = 'WHERE',
  EXTENDS = 'EXTENDS',
  PARALLEL = 'PARALLEL',
  
  // 集約関数
  SUM = 'SUM',
  AVG = 'AVG',
  MAX = 'MAX',
  MIN = 'MIN',
  COUNT = 'COUNT',
  COLLECT = 'COLLECT',
  FILTER = 'FILTER',
  GROUPBY = 'GROUPBY',
  
  // 型キーワード
  STRING = 'STRING',
  INT = 'INT',
  FLOAT = 'FLOAT',
  BOOL = 'BOOL',
  DATE = 'DATE',
  DATETIME = 'DATETIME',
  VOID = 'VOID',
  QUANTITY = 'QUANTITY',
  
  // 演算子
  PLUS = 'PLUS',             // +
  MINUS = 'MINUS',           // -
  STAR = 'STAR',             // *
  SLASH = 'SLASH',           // /
  CARET = 'CARET',           // ^
  PERCENT = 'PERCENT',       // %
  EQ = 'EQ',                 // ==
  NEQ = 'NEQ',               // !=
  LT = 'LT',                 // <
  GT = 'GT',                 // >
  LTE = 'LTE',               // <=
  GTE = 'GTE',               // >=
  AND = 'AND',               // &&
  OR = 'OR',                 // ||
  NOT = 'NOT',               // !
  LARROW = 'LARROW',         // <-
  RARROW = 'RARROW',         // ->
  FAT_ARROW = 'FAT_ARROW',   // =>
  DOT = 'DOT',               // .
  QDOT = 'QDOT',             // ?.
  NULLISH = 'NULLISH',       // ??
  AT = 'AT',                 // @
  DOLLAR = 'DOLLAR',         // $
  COLON = 'COLON',           // :
  PIPE = 'PIPE',             // |
  COMMA = 'COMMA',           // ,
  
  // 括弧類
  LPAREN = 'LPAREN',
  RPAREN = 'RPAREN',
  LBRACE = 'LBRACE',
  RBRACE = 'RBRACE',
  LBRACKET = 'LBRACKET',
  RBRACKET = 'RBRACKET',
  
  // 特殊
  EOF = 'EOF',
  ERROR = 'ERROR',
}

export interface SourceLocation {
  line: number;
  column: number;
  offset: number;
}

export interface SourceSpan {
  start: SourceLocation;
  end: SourceLocation;
  file: string;
}

export interface Token {
  type: TokenType;
  lexeme: string;
  literal?: any;
  span: SourceSpan;
}
```

### 7.2 AST定義（主要部分）

```typescript
// src/parser/ast.ts

export interface ASTNode {
  kind: string;
  span: SourceSpan;
}

export interface Program extends ASTNode {
  kind: 'Program';
  declarations: Declaration[];
}

export type Declaration =
  | SchemaDecl
  | EnumDecl
  | UnitDecl
  | DimensionDecl
  | LookupDecl
  | TransformDecl
  | PipelineDecl;

export interface SchemaDecl extends ASTNode {
  kind: 'SchemaDecl';
  annotations: Annotation[];
  name: string;
  genericParams: string[];
  extends?: string;
  fields: FieldDecl[];
}

export interface TransformDecl extends ASTNode {
  kind: 'TransformDecl';
  annotations: Annotation[];
  name: string;
  genericParams: string[];
  sourceType: TypeExpr;
  targetType: TypeExpr;
  whereClause: Constraint[];
  rules: MappingRule[];
}

export interface MappingRule extends ASTNode {
  kind: 'MappingRule';
  targetPath: string[];
  sourceExpr: Expr;
}

// 型式
export type TypeExpr =
  | PrimitiveType
  | SchemaRef
  | ArrayType
  | OptionalType
  | QuantityType
  | TupleType
  | UnionType;

// 式
export type Expr =
  | Literal
  | PathExpr
  | TargetRef
  | BinaryExpr
  | UnaryExpr
  | IfExpr
  | MatchExpr
  | LambdaExpr
  | AggregateExpr
  | LookupExpr
  | CallExpr;

export interface PathExpr extends ASTNode {
  kind: 'PathExpr';
  sourceIndex?: number;
  segments: PathSegment[];
}

export interface AggregateExpr extends ASTNode {
  kind: 'AggregateExpr';
  func: 'sum' | 'avg' | 'max' | 'min' | 'count' | 'collect' | 'filter' | 'groupBy';
  source: Expr;
  lambda: LambdaExpr;
}

export interface LookupExpr extends ASTNode {
  kind: 'LookupExpr';
  table: string;
  key: Expr;
  default?: Expr;
}
```

### 7.3 Parser実装方針

再帰下降パーサーを使用：

1. **トップダウンパース**: 宣言からパースを開始
2. **演算子優先順位**: Pratt パーサー風の優先順位処理
3. **エラー回復**: 同期ポイントでのエラー回復
4. **ソース位置追跡**: すべてのASTノードにSpan情報

```typescript
// src/parser/parser.ts (概要)

export class Parser {
  private tokens: Token[];
  private current = 0;
  private errors: ParseError[] = [];

  parse(): { program: Program; errors: ParseError[] } {
    const declarations: Declaration[] = [];
    
    while (!this.isAtEnd()) {
      try {
        declarations.push(this.declaration());
      } catch (e) {
        this.synchronize();
      }
    }
    
    return { program: { kind: 'Program', declarations, span: ... }, errors: this.errors };
  }

  private declaration(): Declaration {
    const annotations = this.parseAnnotations();
    
    if (this.match(TokenType.SCHEMA)) return this.schemaDecl(annotations);
    if (this.match(TokenType.ENUM)) return this.enumDecl(annotations);
    if (this.match(TokenType.UNIT)) return this.unitDecl();
    if (this.match(TokenType.LOOKUP)) return this.lookupDecl(annotations);
    if (this.match(TokenType.TRANSFORM)) return this.transformDecl(annotations);
    if (this.match(TokenType.PIPELINE)) return this.pipelineDecl(annotations);
    
    throw this.error('Expected declaration');
  }

  // 式のパース（演算子優先順位に従う）
  private expression(): Expr {
    return this.nullishCoalesce();
  }

  private nullishCoalesce(): Expr { /* ?? */ }
  private or(): Expr { /* || */ }
  private and(): Expr { /* && */ }
  private equality(): Expr { /* == != */ }
  private comparison(): Expr { /* < > <= >= */ }
  private additive(): Expr { /* + - */ }
  private multiplicative(): Expr { /* * / % */ }
  private unary(): Expr { /* ! - */ }
  private postfix(): Expr { /* . ?. [] () */ }
  private primary(): Expr { /* literals, paths, etc */ }
}
```

---

## 8. 型チェッカー実装

### 8.1 型定義

```typescript
// src/analyzer/types.ts

export type Type =
  | PrimitiveType
  | SchemaType
  | EnumType
  | ArrayType
  | OptionalType
  | QuantityType
  | TupleType
  | UnionType
  | FunctionType
  | TypeVariable
  | NeverType
  | UnknownType;

export interface PrimitiveType {
  kind: 'Primitive';
  name: 'String' | 'Int' | 'Float' | 'Bool' | 'Date' | 'DateTime' | 'Void';
}

export interface SchemaType {
  kind: 'Schema';
  name: string;
  fields: Map<string, Type>;
  genericArgs: Type[];
}

export interface QuantityType {
  kind: 'Quantity';
  unit: Unit;
}

export interface Unit {
  dimensions: Map<string, number>;  // 次元 -> べき乗
  scale: number;
}

export const UNIT_ONE: Unit = { dimensions: new Map(), scale: 1 };
```

### 8.2 型チェッカー実装方針

```typescript
// src/analyzer/type-checker.ts

export class TypeChecker {
  private symbolTable: SymbolTable;
  private errors: TypeCheckError[] = [];

  check(program: Program): { typedAST: TypedProgram; errors: TypeCheckError[] } {
    // パス1: 全ての宣言を登録
    for (const decl of program.declarations) {
      this.registerDeclaration(decl);
    }
    
    // パス2: 型チェック
    for (const decl of program.declarations) {
      this.checkDeclaration(decl);
    }
    
    return { typedAST: this.buildTypedAST(program), errors: this.errors };
  }

  private checkTransform(decl: TransformDecl): void {
    const sourceType = this.resolveTypeExpr(decl.sourceType);
    const targetType = this.resolveTypeExpr(decl.targetType);
    
    for (const rule of decl.rules) {
      // ターゲットフィールドの型を取得
      const targetFieldType = this.resolveTargetPath(targetType, rule.targetPath);
      
      // ソース式の型を推論
      const sourceExprType = this.inferExpr(rule.sourceExpr, sourceType);
      
      // 型互換性チェック
      if (!this.isAssignable(sourceExprType, targetFieldType)) {
        this.error(`Type mismatch: ${sourceExprType} -> ${targetFieldType}`);
      }
    }
  }

  // 単位の乗算
  private multiplyUnits(a: Unit, b: Unit): Unit {
    const dimensions = new Map(a.dimensions);
    for (const [dim, exp] of b.dimensions) {
      dimensions.set(dim, (dimensions.get(dim) ?? 0) + exp);
    }
    return { dimensions, scale: a.scale * b.scale };
  }

  // 単位の等価性チェック
  private unitsEqual(a: Unit, b: Unit): boolean {
    if (a.dimensions.size !== b.dimensions.size) return false;
    for (const [dim, exp] of a.dimensions) {
      if (b.dimensions.get(dim) !== exp) return false;
    }
    return true;
  }
}
```

### 8.3 型推論の主要ルール

| 式の種類 | 推論ルール |
|---------|-----------|
| `$.field` | ソーススキーマのフィールド型 |
| `@field` | ターゲットスキーマのフィールド型 |
| `e1 + e2` | 同一単位の場合のみ許可、結果も同一単位 |
| `e1 * e2` | 単位の積を計算 |
| `lookup(T, k)` | ルックアップのvalue型 |
| `sum(arr, \|x\| f)` | fの型（数値またはQuantity） |
| `if c then t else e` | tとeの共通型 |

---

## 9. 中間表現(IR)

### 9.1 MIR定義

```typescript
// src/ir/mir.ts

export interface MIRProgram {
  schemas: Map<string, MIRSchema>;
  enums: Map<string, MIREnum>;
  units: Map<string, MIRUnit>;
  lookups: Map<string, MIRLookup>;
  transforms: Map<string, MIRTransform>;
  pipelines: Map<string, MIRPipeline>;
}

export interface MIRTransform {
  name: string;
  sourceType: MIRType;
  targetType: MIRType;
  body: MIRBlock;
}

export interface MIRBlock {
  instructions: MIRInstruction[];
  result: MIRValue;
}

export type MIRInstruction =
  | MIRAssign
  | MIRFieldGet
  | MIRFieldSet
  | MIRBinOp
  | MIRCall
  | MIRLookupInstr
  | MIRAggregateInstr
  | MIRBranch;

export interface MIRAssign {
  kind: 'Assign';
  target: string;
  value: MIRValue;
}

export interface MIRFieldGet {
  kind: 'FieldGet';
  target: string;
  object: MIRValue;
  field: string;
}

export interface MIRBinOp {
  kind: 'BinOp';
  target: string;
  op: string;
  left: MIRValue;
  right: MIRValue;
}

export interface MIRAggregateInstr {
  kind: 'Aggregate';
  target: string;
  func: string;
  source: MIRValue;
  lambdaParam: string;
  lambdaBody: MIRBlock;
}

export type MIRValue =
  | { kind: 'Var'; name: string }
  | { kind: 'IntLit'; value: number }
  | { kind: 'FloatLit'; value: number }
  | { kind: 'StringLit'; value: string }
  | { kind: 'BoolLit'; value: boolean }
  | { kind: 'Null' }
  | { kind: 'SourceRef' }
  | { kind: 'TargetRef'; field: string };
```

### 9.2 IR生成の目的

1. **抽象化**: ソース言語の詳細から切り離す
2. **最適化**: 共通部分式除去、定数畳み込み
3. **多言語出力**: TypeScript/Python両方に変換可能

### 9.3 最適化パス

| 最適化 | 説明 |
|--------|------|
| 定数畳み込み | コンパイル時に計算可能な式を評価 |
| 共通部分式除去 | 重複計算を一時変数にまとめる |
| デッドコード除去 | 使用されない計算を削除 |
| インライン展開 | 小さな関数をインライン化 |

---

## 付録A: 実装の優先順位

### Phase 1: MVP（最小実行可能製品）

1. **Lexer** - 完全実装
2. **Parser** - 基本構文のみ（schema, transform, lookup）
3. **型チェッカー** - プリミティブ型とスキーマ型
4. **TypeScript Codegen** - 基本変換のみ

### Phase 2: 単位システム

5. **単位パーサー** - 単位式のパース
6. **次元解析** - 単位の整合性チェック
7. **Quantityランタイム** - 実行時の単位付き計算

### Phase 3: 高度な機能

8. **集約関数** - sum, collect, filter等
9. **パイプライン** - 変換の合成
10. **Python Codegen** - Python出力対応

---

## 付録B: テストケース例

### B.1 パーサーテスト

```typescript
describe('Parser', () => {
  it('should parse simple schema', () => {
    const input = `
      schema Person {
        name: String
        age: Int
      }
    `;
    const result = parse(input);
    expect(result.declarations[0].kind).toBe('SchemaDecl');
    expect(result.declarations[0].fields.length).toBe(2);
  });

  it('should parse transform with lookup', () => {
    const input = `
      transform T: A -> B {
        x <- $.y * lookup(Table, $.key)
      }
    `;
    const result = parse(input);
    expect(result.declarations[0].rules[0].sourceExpr.kind).toBe('BinaryExpr');
  });
});
```

### B.2 型チェッカーテスト

```typescript
describe('TypeChecker', () => {
  it('should detect unit mismatch', () => {
    const input = `
      unit m
      unit kg
      schema A { x: Quantity<m>, y: Quantity<kg> }
      schema B { z: Quantity<m> }
      transform T: A -> B {
        z <- $.x + $.y  // Error: different units
      }
    `;
    const errors = typeCheck(parse(input));
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

---

## 付録C: 参考文献

1. Zimmermann et al., "Formalizing ontology alignment with category theory" (2006)
2. Bohannon et al., "Lenses: Bidirectional Transformations" (2006)
3. Riley, "Categories of Optics" (2018)
4. Harper, "Practical Foundations for Programming Languages" (2016)

---

**End of Part 1**

Part 2では以下を扱います：
- 第10章: コード生成（TypeScript/Python）
- 第11章: ランタイムライブラリ
- 第12章: CLI設計
- 第13章: エラー処理
- 第14章: テスト戦略
- 第15章: 実装ロードマップ
- 第16章: 完全なサンプル実装
