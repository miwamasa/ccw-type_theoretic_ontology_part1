オントロジー間変換のための汎用DSLを設計します。

## 設計方針

1. **宣言的記述** - 「何を」変換するかを記述し、「どう」は推論/生成
2. **型安全性** - 単位系・構造の整合性をコンパイル時に検証
3. **合成可能性** - 小さな変換を組み合わせて複雑な変換を構築
4. **双方向性** - 可能な範囲で逆変換も導出

---

## DSL: **Morpheus** (Mapping Ontologies via Reversible PHysically-typed Expressions with Units and Schemas)

### 1. 全体構造

```
┌─────────────────────────────────────────────────────────────┐
│  Morpheus DSL                                               │
├─────────────────────────────────────────────────────────────┤
│  1. Schema定義      - ソース/ターゲットの構造定義           │
│  2. Unit定義        - 物理単位と次元の定義                  │
│  3. Lookup定義      - 外部参照テーブルの定義                │
│  4. Transform定義   - 変換規則の定義                        │
│  5. Pipeline定義    - 変換の合成と実行順序                  │
└─────────────────────────────────────────────────────────────┘
```

### 2. 文法定義（EBNF）

```ebnf
(* トップレベル *)
Program        ::= Declaration*
Declaration    ::= SchemaDecl | UnitDecl | LookupDecl | TransformDecl | PipelineDecl

(* スキーマ定義 *)
SchemaDecl     ::= 'schema' Identifier '{' FieldDecl* '}'
FieldDecl      ::= Identifier ':' TypeExpr Annotation*
TypeExpr       ::= PrimitiveType | SchemaRef | ArrayType | OptionalType | QuantityType
PrimitiveType  ::= 'String' | 'Int' | 'Float' | 'Bool' | 'Date'
ArrayType      ::= '[' TypeExpr ']'
OptionalType   ::= TypeExpr '?'
QuantityType   ::= 'Quantity' '<' UnitExpr '>'
SchemaRef      ::= Identifier
Annotation     ::= '@' Identifier '(' AnnotationArgs? ')'

(* 単位定義 *)
UnitDecl       ::= 'unit' Identifier '=' UnitExpr
UnitExpr       ::= BaseUnit | UnitExpr '*' UnitExpr | UnitExpr '/' UnitExpr | UnitExpr '^' Int
BaseUnit       ::= Identifier | '1'

(* ルックアップテーブル定義 *)
LookupDecl     ::= 'lookup' Identifier '{' 
                     'key' ':' TypeExpr ',' 
                     'value' ':' TypeExpr ','
                     'source' ':' StringLiteral 
                   '}'

(* 変換定義 *)
TransformDecl  ::= 'transform' Identifier ':' SchemaRef '->' SchemaRef '{' MappingRule* '}'
MappingRule    ::= TargetPath '<-' SourceExpr

(* ソース式 *)
SourceExpr     ::= PathExpr
                 | SourceExpr BinaryOp SourceExpr
                 | UnaryOp SourceExpr
                 | FunctionCall
                 | Literal
                 | 'lookup' '(' Identifier ',' SourceExpr ')'
                 | 'if' SourceExpr 'then' SourceExpr 'else' SourceExpr
                 | 'match' SourceExpr '{' MatchCase* '}'
                 | AggregateExpr

PathExpr       ::= '$' '.' Identifier ('.' Identifier | '[' SourceExpr ']')*
AggregateExpr  ::= AggregateFunc '(' PathExpr ',' LambdaExpr ')'
AggregateFunc  ::= 'sum' | 'avg' | 'max' | 'min' | 'count' | 'collect'
LambdaExpr     ::= '|' Identifier '|' SourceExpr
MatchCase      ::= Pattern '=>' SourceExpr

(* パイプライン定義 *)
PipelineDecl   ::= 'pipeline' Identifier '{' PipelineStep* '}'
PipelineStep   ::= TransformRef | ParallelStep | ConditionalStep
ParallelStep   ::= 'parallel' '{' TransformRef (',' TransformRef)* '}'
ConditionalStep::= 'when' SourceExpr ':' TransformRef
```

### 3. 具体的な文法例

```morpheus
// ============================================
// 単位系の定義
// ============================================

unit kWh           // 電力量
unit kg            // 質量
unit km            // 距離
unit kgCO2         // CO2質量
unit kgCO2_per_kWh = kgCO2 / kWh
unit kgCO2_per_kg  = kgCO2 / kg
unit kgCO2_per_tkm = kgCO2 / (kg * km)  // トンキロあたり

// ============================================
// ソーススキーマ定義（生産管理）
// ============================================

schema ProductionRecord {
  productId: String @key
  
  process: ProcessData
  materials: [MaterialUsage]
  logistics: LogisticsData
  waste: WasteData
}

schema ProcessData {
  machineId: String
  electricityUsage: Quantity<kWh>
  fuelUsage: Quantity<kg>
  fuelType: String
}

schema MaterialUsage {
  materialCode: String
  weight: Quantity<kg>
  supplierRegion: String
}

schema LogisticsData {
  inboundDistance: Quantity<km>
  outboundDistance: Quantity<km>
  transportMode: TransportMode
  cargoWeight: Quantity<kg>
}

enum TransportMode {
  Truck, Rail, Ship, Air
}

schema WasteData {
  amount: Quantity<kg>
  disposalMethod: DisposalMethod
}

enum DisposalMethod {
  Landfill, Incineration, Recycle
}

// ============================================
// ターゲットスキーマ定義（CFP）
// ============================================

schema CFPResult {
  productId: String @key
  scope1: Quantity<kgCO2>
  scope2: Quantity<kgCO2>
  scope3Upstream: Quantity<kgCO2>
  scope3Downstream: Quantity<kgCO2>
  total: Quantity<kgCO2>
  calculatedAt: Date
}

// ============================================
// ルックアップテーブル定義
// ============================================

lookup ElectricityFactor {
  key: String                    // region
  value: Quantity<kgCO2_per_kWh>
  source: "emission_factors.electricity"
}

lookup FuelFactor {
  key: String                    // fuel type
  value: Quantity<kgCO2_per_kg>
  source: "emission_factors.fuel"
}

lookup MaterialFactor {
  key: String                    // material code
  value: Quantity<kgCO2_per_kg>
  source: "emission_factors.material"
}

lookup TransportFactor {
  key: TransportMode
  value: Quantity<kgCO2_per_tkm>
  source: "emission_factors.transport"
}

lookup WasteFactor {
  key: DisposalMethod
  value: Quantity<kgCO2_per_kg>
  source: "emission_factors.waste"
}

// ============================================
// 変換定義
// ============================================

transform ProductionToCFP: ProductionRecord -> CFPResult {
  
  // 直接マッピング
  productId <- $.productId
  
  // Scope1: 燃料燃焼（計算付きマッピング）
  scope1 <- $.process.fuelUsage * lookup(FuelFactor, $.process.fuelType)
  
  // Scope2: 購入電力
  scope2 <- $.process.electricityUsage * lookup(ElectricityFactor, "japan")
  
  // Scope3上流: 原材料 + 入荷輸送
  scope3Upstream <- 
    sum($.materials, |m| m.weight * lookup(MaterialFactor, m.materialCode))
    + $.logistics.inboundDistance 
      * $.logistics.cargoWeight 
      * lookup(TransportFactor, $.logistics.transportMode)
  
  // Scope3下流: 出荷輸送 + 廃棄
  scope3Downstream <-
    $.logistics.outboundDistance 
      * $.logistics.cargoWeight 
      * lookup(TransportFactor, $.logistics.transportMode)
    + $.waste.amount * lookup(WasteFactor, $.waste.disposalMethod)
  
  // 合計（他フィールドの参照）
  total <- @scope1 + @scope2 + @scope3Upstream + @scope3Downstream
  
  // 計算時刻
  calculatedAt <- now()
}

// ============================================
// パイプライン定義（複数変換の合成）
// ============================================

pipeline FullCFPCalculation {
  // 前処理
  NormalizeUnits
  
  // メイン変換
  ProductionToCFP
  
  // 後処理
  RoundToTwoDecimals
}
```

### 4. より高度な変換パターン

```morpheus
// ============================================
// 条件分岐を含む変換
// ============================================

transform ConditionalTransform: SourceSchema -> TargetSchema {
  
  // match式による分岐
  category <- match $.type {
    "A" => "CategoryAlpha"
    "B" => "CategoryBeta"
    _   => "CategoryOther"
  }
  
  // if式による条件付き計算
  adjustedValue <- if $.flag then $.value * 1.1 else $.value
  
  // 存在チェック付きアクセス（Optional handling）
  optionalField <- $.nested?.field ?? "default"
}

// ============================================
// 集約パターン
// ============================================

transform AggregationExamples: OrderList -> Summary {
  
  // 単純な合計
  totalAmount <- sum($.orders, |o| o.amount)
  
  // 条件付き集約
  highValueTotal <- sum($.orders, |o| if o.amount > 1000 then o.amount else 0)
  
  // グループ化して集約
  byCategory <- groupBy($.orders, |o| o.category, |group| {
    category: group.key,
    subtotal: sum(group.items, |i| i.amount)
  })
  
  // 配列の変換（map）
  itemNames <- collect($.orders, |o| o.name)
  
  // フィルタリング
  activeOrders <- filter($.orders, |o| o.status == "active")
}

// ============================================
// 合成型（複数ソースからの構築）
// ============================================

transform MergeTransform: (Source1, Source2) -> Target {
  // 複数ソースからフィールドを取得
  fromFirst <- $1.fieldA
  fromSecond <- $2.fieldB
  
  // 結合
  combined <- $1.value + $2.value
}

// ============================================
// 分解型（1つのソースから複数ターゲット）
// ============================================

transform SplitTransform: Source -> (Target1, Target2) {
  // Target1へのマッピング
  @1 {
    field1 <- $.common
    field2 <- $.specificA
  }
  
  // Target2へのマッピング
  @2 {
    field1 <- $.common
    field3 <- $.specificB
  }
}
```

### 5. 型システムの詳細

```morpheus
// ============================================
// 物理次元の型チェック
// ============================================

// 単位の次元定義
dimension Length
dimension Mass  
dimension Time
dimension ElectricCurrent

// 基本単位と次元の関連付け
unit m: Length
unit kg: Mass
unit s: Time
unit A: ElectricCurrent

// 派生単位
unit kWh = kg * m^2 / s^2 * 3.6e6  // エネルギー（ジュール換算係数付き）
unit N = kg * m / s^2               // 力

// 型チェック例
// OK: Quantity<kg> * Quantity<kgCO2/kg> = Quantity<kgCO2>
// Error: Quantity<kg> * Quantity<kgCO2/kWh> = 次元不一致

// ============================================
// 構造的部分型
// ============================================

schema Base {
  id: String
  name: String
}

schema Extended extends Base {
  extra: Int
}

// Extended は Base の部分型として使用可能
transform UseBase: Base -> Target { ... }
// UseBase は Extended にも適用可能

// ============================================
// ジェネリック変換
// ============================================

transform<T, U> MapArray: [T] -> [U] 
  where Transformable<T, U>
{
  @ <- collect($, |item| transform<T, U>(item))
}

// 型制約
constraint Transformable<T, U> {
  exists transform: T -> U
}
```

### 6. メタデータとドキュメンテーション

```morpheus
// ============================================
// アノテーションによるメタデータ
// ============================================

@version("1.0.0")
@author("DataTeam")
@description("生産管理データからCFPを計算する変換")
transform ProductionToCFP: ProductionRecord -> CFPResult {
  
  @description("製品を一意に識別するID")
  @mapping(direct: true)
  productId <- $.productId
  
  @description("Scope1排出量：事業者自らの直接排出")
  @formula("燃料使用量 × 排出係数")
  @dataSource("環境省排出係数データベース2023")
  @uncertainty(5%)  // 不確実性
  scope1 <- $.process.fuelUsage * lookup(FuelFactor, $.process.fuelType)
}

// ============================================
// バリデーションルール
// ============================================

schema CFPResult {
  @validate(min: 0)
  @validate(max: 1000000)
  total: Quantity<kgCO2>
  
  @validate(regex: "^PROD-[0-9]+$")
  productId: String
}

// 変換後のアサーション
transform WithValidation: A -> B {
  value <- $.input
  
  @assert(value >= 0, "値は非負である必要があります")
  @assert(value <= $.maxAllowed, "最大許容値を超えています")
}
```

### 7. TypeScriptへのコンパイル出力例

DSLコンパイラが生成するTypeScriptコード：

```typescript
// ============================================
// 自動生成コード（morpheus compile output）
// ============================================

// --- 型定義 ---
interface ProductionRecord {
  productId: string;
  process: ProcessData;
  materials: MaterialUsage[];
  logistics: LogisticsData;
  waste: WasteData;
}

interface CFPResult {
  productId: string;
  scope1: Quantity<'kgCO2'>;
  scope2: Quantity<'kgCO2'>;
  scope3Upstream: Quantity<'kgCO2'>;
  scope3Downstream: Quantity<'kgCO2'>;
  total: Quantity<'kgCO2'>;
  calculatedAt: Date;
}

// --- ルックアップ ---
const lookupElectricityFactor = createLookup<string, Quantity<'kgCO2_per_kWh'>>(
  'emission_factors.electricity'
);
const lookupFuelFactor = createLookup<string, Quantity<'kgCO2_per_kg'>>(
  'emission_factors.fuel'
);
// ...

// --- 変換関数 ---
export const productionToCFP: Transform<ProductionRecord, CFPResult> = ($) => {
  const scope1 = multiply($.process.fuelUsage, lookupFuelFactor($.process.fuelType));
  const scope2 = multiply($.process.electricityUsage, lookupElectricityFactor('japan'));
  const scope3Upstream = add(
    sumOver($.materials, (m) => multiply(m.weight, lookupMaterialFactor(m.materialCode))),
    multiply(
      multiply($.logistics.inboundDistance, $.logistics.cargoWeight),
      lookupTransportFactor($.logistics.transportMode)
    )
  );
  const scope3Downstream = add(
    multiply(
      multiply($.logistics.outboundDistance, $.logistics.cargoWeight),
      lookupTransportFactor($.logistics.transportMode)
    ),
    multiply($.waste.amount, lookupWasteFactor($.waste.disposalMethod))
  );
  const total = add(add(add(scope1, scope2), scope3Upstream), scope3Downstream);
  
  return {
    productId: $.productId,
    scope1,
    scope2,
    scope3Upstream,
    scope3Downstream,
    total,
    calculatedAt: new Date()
  };
};

// --- 型安全なランタイム ---
type Quantity<U extends string> = { value: number; unit: U };

function multiply<U1 extends string, U2 extends string>(
  q1: Quantity<U1>,
  q2: Quantity<U2>
): Quantity<ResultUnit<U1, U2>> {
  return {
    value: q1.value * q2.value,
    unit: deriveUnit(q1.unit, '*', q2.unit) as ResultUnit<U1, U2>
  };
}
```

### 8. ツールチェーン構成

```
┌──────────────────────────────────────────────────────────────────┐
│                     Morpheus Toolchain                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │ .morpheus   │───▶│   Parser    │───▶│      Type          │  │
│  │   files     │    │             │    │     Checker        │  │
│  └─────────────┘    └─────────────┘    └──────────┬──────────┘  │
│                                                   │              │
│                                                   ▼              │
│                                        ┌─────────────────────┐  │
│                                        │   IR (Intermediate  │  │
│                                        │   Representation)   │  │
│                                        └──────────┬──────────┘  │
│                                                   │              │
│         ┌──────────────────┬──────────────────────┼─────────┐   │
│         ▼                  ▼                      ▼         ▼   │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐  ┌────────┐│
│  │ TypeScript │    │   Python   │    │    JSON    │  │  Docs  ││
│  │  Codegen   │    │  Codegen   │    │   Schema   │  │  Gen   ││
│  └────────────┘    └────────────┘    └────────────┘  └────────┘│
│         │                  │                │             │     │
│         ▼                  ▼                ▼             ▼     │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐  ┌────────┐│
│  │   .ts      │    │   .py      │    │   .json    │  │  .md   ││
│  │  files     │    │  files     │    │  schemas   │  │  docs  ││
│  └────────────┘    └────────────┘    └────────────┘  └────────┘│
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│  CLI Commands:                                                   │
│    morpheus check   - 型チェック                                 │
│    morpheus compile - コード生成                                 │
│    morpheus run     - 直接実行                                   │
│    morpheus docs    - ドキュメント生成                           │
│    morpheus test    - テスト実行                                 │
│    morpheus infer   - マッピング推論（実験的）                   │
└──────────────────────────────────────────────────────────────────┘
```

### 9. マッピング推論機能（実験的）

```morpheus
// ============================================
// 型からマッピング候補を推論
// ============================================

// 推論リクエスト
infer mapping: SourceSchema -> TargetSchema {
  // ヒントを与えることで推論を補助
  hints {
    // フィールド名の対応
    $.electricity_kwh ~> @.energyConsumption
    
    // 単位の対応
    Quantity<kWh> ~> Quantity<kgCO2> via EmissionFactor
  }
  
  // 制約
  constraints {
    // すべてのターゲットフィールドは埋まる必要がある
    coverage: complete
    
    // 計算の深さ制限
    maxComputationDepth: 3
  }
}

// 推論結果（ツールが出力）
// > Found 3 candidate mappings:
// > 
// > Candidate 1 (confidence: 0.92):
// >   @.energyConsumption <- $.electricity_kwh * lookup(...)
// >   @.totalEmission <- sum(...)
// > 
// > Candidate 2 (confidence: 0.78):
// >   ...
```

---

## まとめ

**Morpheus DSL** の特徴：

| 機能 | 説明 |
|------|------|
| **型安全性** | 物理単位・構造の整合性をコンパイル時検証 |
| **宣言的記述** | 変換ロジックを簡潔に記述可能 |
| **合成可能** | 小さな変換を組み合わせてパイプライン構築 |
| **多言語出力** | TypeScript/Python/JSONなど複数ターゲット |
| **推論機能** | 型情報から変換候補を自動推論 |
| **ドキュメント生成** | アノテーションから仕様書を自動生成 |

実装を進める場合、どの部分から着手しますか？
- パーサー実装
- 型チェッカー実装
- TypeScriptコード生成
- ランタイムライブラリ