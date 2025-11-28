# Morpheus DSL 理論編

## 目次

1. [型理論の基礎](#型理論の基礎)
2. [次元解析と物理単位](#次元解析と物理単位)
3. [オントロジーマッピング](#オントロジーマッピング)
   - [AI支援マッピングと型システム](#ai支援マッピングと型システム)
4. [コンパイラアーキテクチャ](#コンパイラアーキテクチャ)
5. [意味論](#意味論)

---

## 型理論の基礎

### スキーマ型（Σ型）

Morpheus DSLのスキーマは、依存型理論における**依存積型（Σ型）**に対応します。

**形式的定義**:
```
Σ(x:A).B(x)
```

これは「型Aの値xと、xに依存する型B(x)の値のペア」を表します。

**Morpheusでの実装例**:
```morpheus
schema Person {
  name: String
  age: Int
}
```

これは以下のΣ型に対応：
```
Σ(name:String, age:Int)
```

### 型の階層

Morpheus DSLは以下の型階層を持ちます：

```
Type ::= Primitive
       | Schema
       | Enum
       | Array<Type>
       | Optional<Type>
       | Quantity<Unit>
       | Tuple<Type₁, ..., Typeₙ>
       | Union<Type₁ | ... | Typeₙ>
```

#### 基本型（Primitive）
- `String`, `Int`, `Float`, `Bool`, `Date`, `DateTime`

#### スキーマ型（Schema）
レコード型、積型として機能：
```
Person = { name: String, age: Int }
≅ String × Int
```

#### Enum型
和型として機能：
```
enum Status { Active | Inactive | Pending }
≅ Active + Inactive + Pending
```

#### 配列型（Array）
リスト型：
```
Array<T> = List(T)
```

#### Optional型
Maybe型：
```
Optional<T> = Some(T) | None
≅ T + 1
```

#### Quantity型
物理単位付き型（後述）：
```
Quantity<kWh> = { value: Float, unit: kWh }
```

---

## 次元解析と物理単位

### 次元の型システム

物理量の次元は、基本次元（長さ、質量、時間など）の積として表現されます。

**基本次元**:
```
Dimension ::= Length | Mass | Time | Current | Temperature | Amount | Luminosity
```

**合成次元**:
```
Speed = Length / Time = Length × Time⁻¹
Energy = Mass × Length² × Time⁻²
```

### 単位の代数

Morpheus DSLでは、単位を型として扱い、以下の演算を定義します：

**単位の乗算**:
```
kWh × kgCO2/kWh = kgCO2
```

**単位の除算**:
```
kWh / h = kW
```

**型規則**:
```
Γ ⊢ e₁ : Quantity<U₁>    Γ ⊢ e₂ : Quantity<U₂>
────────────────────────────────────────────────
Γ ⊢ e₁ * e₂ : Quantity<U₁ × U₂>
```

### 実装における次元解析

**コンパイル時チェック**:
```morpheus
unit kWh
unit kg
unit kgCO2

// OK: 同じ単位同士の加算
totalEnergy: Quantity<kWh> <- energy1 + energy2

// エラー: 異なる単位の加算
invalid <- energy + weight  // Type Error: kWh vs kg
```

**ランタイム演算**:
```typescript
// multiplyValue関数（自動生成）
export function multiplyValue(a: any, b: any): any {
  if (isQuantity(a) && isQuantity(b)) {
    return {
      value: a.value * b.value,
      unit: `${a.unit}_times_${b.unit}`
    };
  }
  // ... その他のケース
}
```

### Kennedy's Algorithm

Andrew Kennedyの論文「Programming Languages and Dimensions」に基づく次元推論アルゴリズム：

1. **単位変数の割り当て**: 各式に単位変数を割り当て
2. **制約生成**: 型規則から単位制約を生成
3. **制約解消**: 単位制約を解いて具体的な単位を決定

---

## オントロジーマッピング

### オントロジーとは

オントロジーは、ドメインの概念とその関係を形式的に記述したものです。

**例: 製造ドメイン**:
```
ProductionRecord ⊆ Entity
  ├─ hasProductId: String
  ├─ hasElectricityUsage: Quantity<kWh>
  └─ hasMaterials: Array<MaterialUsage>

CFPResult ⊆ Entity
  ├─ hasProductId: String
  └─ hasTotalEmission: Quantity<kgCO2>
```

### スキーママッピングの意味論

**変換の正しさ**: 変換は元のスキーマの意味を保存する必要があります。

**形式的定義**:
```
transform f: S → T

∀s ∈ S, f(s) ∈ T ∧ meaning(s) ≅ meaning(f(s))
```

### ホモモルフィズム

理想的な変換は、構造を保存する**ホモモルフィズム**です。

**例**:
```morpheus
schema Source {
  a: Int
  b: Int
}

schema Target {
  sum: Int
}

transform SourceToTarget: Source -> Target {
  sum <- $.a + $.b
}
```

これは `(+)` 演算を保存します：
```
f(s₁ + s₂).sum = f(s₁).sum + f(s₂).sum
```

### AI支援マッピングと型システム

#### 動機：マッピング合成の課題

オントロジー間のマッピングを手動で記述することは、以下の課題があります：

1. **大規模スキーマの複雑性**: 数十〜数百のフィールドを持つスキーマ間のマッピング
2. **ドメイン知識の要求**: 単純な名前の一致だけでは不十分（例: `electricityUsage` → `scope2Emissions`）
3. **単位変換の計算**: 排出係数の適用、次元整合性の検証

#### 型システムによる探索空間の制約

型システムは、AIが探索すべきマッピング候補空間を大幅に削減します。

**型制約による候補の絞り込み**:

```
SourceSchema S = { f₁: T₁, f₂: T₂, ..., fₙ: Tₙ }
TargetSchema T = { g₁: U₁, g₂: U₂, ..., gₘ: Uₘ }

マッピング候補 M(gⱼ) ⊆ { (fᵢ, expr) | typeOf(expr(fᵢ)) ⊑ Uⱼ }
```

ここで `⊑` は型の部分型関係を表します：
- `Int ⊑ Float`（整数は浮動小数点数の部分型）
- `T ⊑ Optional<T>`（値は任意値の部分型）
- `Quantity<U₁> ⊑ Quantity<U₂>` iff `dim(U₁) = dim(U₂)`（次元が一致する場合のみ）

**探索空間の削減例**:

```morpheus
schema Source {
  count: Int        // 候補: 4個
  price: Float      // 候補: 5個
  name: String      // 候補: 3個
}

schema Target {
  totalCost: Float  // 型制約により Int, Float フィールドのみ候補
  productName: String  // 型制約により String フィールドのみ候補
}
```

型制約なし: 3 × 5 = 15通りの組み合わせ
型制約あり: 2 + 1 = 3通りの組み合わせ
**削減率: 80%**

#### 次元解析による物理的整合性

物理単位を持つ `Quantity` 型では、次元解析が追加の制約を提供します。

**次元整合性の定理**:

```
∀ expr: Quantity<U₁> → Quantity<U₂>
  valid(expr) ⟺ dim(result(expr)) = dim(U₂)
```

**実例: GHG排出量計算**:

```morpheus
// ソース
electricityUsage: Quantity<kWh>  // 次元: [Energy]

// ターゲット
scope2Emissions: Quantity<tCO2e>  // 次元: [Mass]

// 型システムが要求する変換
dim([Energy] × [Mass/Energy] × [dimensionless]) = dim([Mass])
         ↓
$.electricityUsage * emissionFactor * unitConversion
```

AIは次元解析により、以下を理解します：
1. エネルギー → 排出量 には係数が必要（`kgCO2e/kWh`）
2. 単位変換係数が必要（`kg → t` で `/1000`）

#### 型誘導AI生成プロンプト

型情報をAIプロンプトに埋め込むことで、生成精度が向上します。

**プロンプト構造**:

```
**Source Schema**: FactoryProductionData
  - electricityUsage: Quantity<kWh>  ← 型情報
  - naturalGasUsage: Quantity<m³>

**Target Schema**: GHGEmissionsReport
  - scope2Electricity: Quantity<tCO2e>  ← 型情報

**Type Compatibility Rules**:
  - Quantity<U₁> → Quantity<U₂> requires dim(U₁) compatible with dim(U₂)
  - Conversion factor must be explicit: kWh → tCO2e needs (kgCO2e/kWh × 1/1000)
```

型システムがAIに提供する情報：
1. **許容される変換のみ提案**: 型不適合なマッピングを排除
2. **必要な変換を示唆**: `DateTime → Date` には `toDate()` が必要
3. **次元整合性を保証**: 単位変換の係数を明示

#### 自動検証パイプライン

生成されたマッピングは、型チェッカーによって自動検証されます。

**検証プロセス**:

```
AI生成コード
    ↓
[Sanitization] Unicode正規化、構文修正
    ↓
[Lexer] 字句解析
    ↓
[Parser] 構文解析
    ↓
[Type Checker] 型検証 ← 型システムの活用
    ↓
✅ Valid / ❌ Invalid (詳細なエラーメッセージ)
```

**型エラーの例**:

```morpheus
// AI生成（誤り）
totalCost <- $.count  // ❌ Type error: Int cannot be assigned to Float

// 型チェッカーの指摘
Type error: Cannot assign type 'Int' to type 'Float'
  Source: count: Int
  Target: totalCost: Float
  Suggestion: Add explicit conversion: toFloat($.count)
```

#### 理論的利点のまとめ

| 観点 | 型システムなし | 型システムあり |
|------|--------------|--------------|
| **探索空間** | O(n×m) 全組み合わせ | O(k) 型互換のみ (k << n×m) |
| **次元整合性** | AIが推測 | 型システムが保証 |
| **エラー検出** | 実行時 | コンパイル時 |
| **信頼性** | AIの判断に依存 | 形式的検証 |
| **フィードバック** | 曖昧 | 具体的な型エラー |

**形式的保証**:

```
Theorem (Type Safety for AI-Generated Mappings):
  ∀ mapping m: S → T generated by AI,
  if typecheck(m) = Valid
  then ∀s ∈ S, m(s) ∈ T ∧ typeOf(m(s)) = T
```

型システムは、AI生成コードに対して**soundness**（健全性）を保証します。

---

## コンパイラアーキテクチャ

### パイプライン構成

```
Source Code (.morpheus)
    ↓
[1] Lexical Analysis (Lexer)
    ↓
Tokens
    ↓
[2] Syntax Analysis (Parser)
    ↓
Abstract Syntax Tree (AST)
    ↓
[3] Name Resolution (Resolver)
    ↓
AST + Symbol Table
    ↓
[4] Type Checking (Type Checker)
    ↓
Typed AST
    ↓
[5] IR Generation (IR Generator)
    ↓
Morpheus IR (MIR)
    ↓
[6] Code Generation (Codegen)
    ↓
TypeScript Code
```

### 各フェーズの詳細

#### 1. 字句解析（Lexical Analysis）

**役割**: ソースコードをトークン列に変換

**例**:
```morpheus
schema Person { name: String }
```
↓
```
[SCHEMA, IDENTIFIER("Person"), LBRACE, IDENTIFIER("name"), COLON, IDENTIFIER("String"), RBRACE]
```

#### 2. 構文解析（Syntax Analysis）

**役割**: トークン列をASTに変換

**文法（BNF）**:
```bnf
Program     ::= Declaration*
Declaration ::= SchemaDecl | EnumDecl | TransformDecl | ...
SchemaDecl  ::= 'schema' IDENTIFIER '{' Field* '}'
Field       ::= IDENTIFIER ':' TypeExpr
```

**AST構造**:
```typescript
interface SchemaDecl {
  kind: 'SchemaDecl'
  name: string
  fields: Field[]
}
```

#### 3. 名前解決（Name Resolution）

**役割**: 識別子を定義に紐付け

**シンボルテーブル**:
```
Global Scope:
  Person -> SchemaDecl
  PersonDTO -> SchemaDecl
  PersonToDTO -> TransformDecl
```

#### 4. 型チェック（Type Checking）

**型推論規則**:
```
Γ ⊢ e₁ : Int    Γ ⊢ e₂ : Int
─────────────────────────────
Γ ⊢ e₁ + e₂ : Int


Γ ⊢ e : Quantity<U>    Γ ⊢ s : Float
──────────────────────────────────────
Γ ⊢ e * s : Quantity<U>
```

**単位チェック**:
```typescript
checkBinaryExpr(expr: BinaryExpr): Type {
  const leftType = this.checkExpr(expr.left);
  const rightType = this.checkExpr(expr.right);

  if (expr.op === '+' || expr.op === '-') {
    // 加減算は同じ単位のみ
    if (leftType.kind === 'Quantity' && rightType.kind === 'Quantity') {
      if (!unitsEqual(leftType.unit, rightType.unit)) {
        throw new Error('Unit mismatch');
      }
    }
  }
  // ...
}
```

#### 5. IR生成（IR Generation）

**役割**: ASTを中間表現（MIR）に変換

**MIR命令**:
```typescript
type MIRInstruction =
  | { kind: 'FieldGet', target: string, object: MIRValue, field: string }
  | { kind: 'FieldSet', field: string, value: MIRValue }
  | { kind: 'BinOp', target: string, op: string, left: MIRValue, right: MIRValue }
  | { kind: 'Lookup', target: string, table: string, key: MIRValue }
```

**例**:
```morpheus
fullName <- $.name
```
↓
```typescript
FieldGet(_t0, source, "name")
FieldSet("fullName", _t0)
```

#### 6. コード生成（Code Generation）

**役割**: MIRをTypeScriptコードに変換

**生成例**:
```typescript
// MIR
BinOp(_t3, "*", _t1, _t2)

// Generated TypeScript
const _t3 = Types.multiplyValue(_t1, _t2);
```

---

## 意味論

### 操作的意味論（Operational Semantics）

**環境（Environment）**:
```
Env = Var → Value
```

**評価規則（Small-Step）**:
```
────────────────────── (E-Value)
⟨v, σ⟩ → ⟨v, σ⟩


⟨e₁, σ⟩ → ⟨e₁', σ'⟩
──────────────────────────── (E-BinOp-Left)
⟨e₁ op e₂, σ⟩ → ⟨e₁' op e₂, σ'⟩


⟨e₂, σ⟩ → ⟨e₂', σ'⟩
──────────────────────────── (E-BinOp-Right)
⟨v₁ op e₂, σ⟩ → ⟨v₁ op e₂', σ'⟩


────────────────────────────────── (E-BinOp-Compute)
⟨v₁ op v₂, σ⟩ → ⟨δ(op, v₁, v₂), σ⟩
```

### 表示的意味論（Denotational Semantics）

**変換の意味**:
```
⟦transform f: S → T { rules }⟧ : ⟦S⟧ → ⟦T⟧
```

**ルールの意味**:
```
⟦field <- expr⟧(s) = { field: ⟦expr⟧(s) }
```

### 型安全性（Type Safety）

**進行定理（Progress）**:
```
∀e, τ. (⊢ e : τ) ⇒ (e is value ∨ ∃e'. e → e')
```

**保存定理（Preservation）**:
```
∀e, e', τ. (⊢ e : τ ∧ e → e') ⇒ ⊢ e' : τ
```

---

## まとめ

Morpheus DSLは以下の理論的基盤の上に構築されています：

1. **型理論**: スキーマ型、積型、和型による堅牢な型システム
2. **次元解析**: 物理単位のコンパイル時検証
3. **オントロジーマッピング**: 意味を保存するスキーマ変換
4. **コンパイラ理論**: 多段階の変換による最適化とコード生成

これらの理論により、Morpheus DSLは：
- **型安全**: コンパイル時に多くのエラーを検出
- **表現力**: 複雑なドメインロジックを簡潔に記述
- **正確性**: 物理単位の整合性を保証

次へ: [チュートリアル](./tutorial.md)
