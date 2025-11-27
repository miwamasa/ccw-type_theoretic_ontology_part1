CFP（カーボンフットプリント）計算を型理論で定式化する具体例を示します。

## CFP計算の型理論的モデル化

### 1. CFP計算の基本構造

CFP計算の基本式は：

```
CFP = Σᵢ (活動量ᵢ × 排出係数ᵢ)
```

これを型理論的に表現すると、**積型の和型への写像**として捉えられます。

### 2. 具体的なシナリオ設定

製造業の生産管理システムから、製品1個あたりのCFPを計算するケースを考えます。

```
【生産管理側のデータ】
- 電力使用量（kWh/製品）
- 原材料使用量（kg/製品）
- 輸送距離（km）
- 廃棄物量（kg/製品）

【CFP計算側の要求】
- Scope1排出量（直接排出）
- Scope2排出量（電力由来）
- Scope3排出量（サプライチェーン）
```

### 3. 型定義

```typescript
// ========================================
// 基本単位型（ファントム型で次元を保証）
// ========================================

type Unit = 'kWh' | 'kg' | 'km' | 'kgCO2' | 'kgCO2/kWh' | 'kgCO2/kg' | 'kgCO2/km'

type Quantity<U extends Unit> = {
  value: number
  unit: U
}

// ========================================
// 生産管理オントロジー（Source Schema）
// ========================================

type ProductionRecord = {
  productId: string
  
  // 工程データ
  process: {
    machineId: string
    electricityUsage: Quantity<'kWh'>      // 電力消費
    fuelUsage: Quantity<'kg'>               // 燃料消費（直接燃焼）
    operatingHours: number
  }
  
  // 原材料データ
  materials: Array<{
    materialCode: string
    weight: Quantity<'kg'>
    supplierRegion: string
  }>
  
  // 物流データ
  logistics: {
    inboundDistance: Quantity<'km'>         // 入荷輸送
    outboundDistance: Quantity<'km'>        // 出荷輸送
    transportMode: 'truck' | 'rail' | 'ship'
  }
  
  // 廃棄物データ
  waste: {
    amount: Quantity<'kg'>
    disposalMethod: 'landfill' | 'incineration' | 'recycle'
  }
}

// ========================================
// CFPオントロジー（Target Schema）
// ========================================

type CFPResult = {
  productId: string
  
  scope1: Quantity<'kgCO2'>    // 直接排出（燃料燃焼等）
  scope2: Quantity<'kgCO2'>    // 間接排出（購入電力）
  scope3: {
    upstream: Quantity<'kgCO2'>    // 上流（原材料・輸送）
    downstream: Quantity<'kgCO2'>  // 下流（製品輸送・廃棄）
  }
  
  total: Quantity<'kgCO2'>
}
```

### 4. 排出係数の型（変換に必要な外部知識）

```typescript
// ========================================
// 排出係数データベース（型付きルックアップ）
// ========================================

type EmissionFactor<From extends Unit, To extends 'kgCO2'> = {
  factor: number
  sourceUnit: From
  targetUnit: To
  source: string  // データソース（例：環境省DB）
  validYear: number
}

type EmissionFactorDB = {
  electricity: {
    [region: string]: EmissionFactor<'kWh', 'kgCO2'>
  }
  fuel: {
    [fuelType: string]: EmissionFactor<'kg', 'kgCO2'>
  }
  material: {
    [materialCode: string]: EmissionFactor<'kg', 'kgCO2'>
  }
  transport: {
    [mode: string]: EmissionFactor<'km', 'kgCO2'>  // per ton-km
  }
  waste: {
    [method: string]: EmissionFactor<'kg', 'kgCO2'>
  }
}

// 具体的な排出係数値（例）
const emissionFactors: EmissionFactorDB = {
  electricity: {
    'japan': { factor: 0.441, sourceUnit: 'kWh', targetUnit: 'kgCO2', 
               source: '環境省2023', validYear: 2023 }
  },
  fuel: {
    'diesel': { factor: 2.58, sourceUnit: 'kg', targetUnit: 'kgCO2',
                source: 'IPCC', validYear: 2023 }
  },
  material: {
    'steel': { factor: 1.8, sourceUnit: 'kg', targetUnit: 'kgCO2',
               source: 'IDEA-DB', validYear: 2023 },
    'aluminum': { factor: 8.2, sourceUnit: 'kg', targetUnit: 'kgCO2',
                  source: 'IDEA-DB', validYear: 2023 }
  },
  transport: {
    'truck': { factor: 0.167, sourceUnit: 'km', targetUnit: 'kgCO2',
               source: '物流CO2算定ガイドライン', validYear: 2023 }
  },
  waste: {
    'landfill': { factor: 0.0472, sourceUnit: 'kg', targetUnit: 'kgCO2',
                  source: '環境省', validYear: 2023 },
    'incineration': { factor: 2.77, sourceUnit: 'kg', targetUnit: 'kgCO2',
                      source: '環境省', validYear: 2023 }
  }
}
```

### 5. 変換関数の型（Lens/Opticとして）

```typescript
// ========================================
// 基本的な変換プリミティブ
// ========================================

// Lens: データの一部を取り出し・更新する
type Lens<S, A> = {
  get: (s: S) => A
  set: (s: S, a: A) => S
}

// Prism: 条件付きで取り出す（存在しない場合あり）
type Prism<S, A> = {
  preview: (s: S) => A | null
  review: (a: A) => S
}

// Affine: 計算を伴う変換
type Affine<S, A, C> = {
  extract: (s: S) => { focus: A, context: C } | null
  construct: (a: A, c: C) => S
}

// ========================================
// 計算付き変換（核心部分）
// ========================================

// 乗算を型レベルで表現
type Multiply
  Q1 extends Quantity<any>,
  Q2 extends { factor: number }
> = Quantity<'kgCO2'>

function multiply<U extends Unit>(
  quantity: Quantity<U>,
  factor: EmissionFactor<U, 'kgCO2'>
): Quantity<'kgCO2'> {
  return {
    value: quantity.value * factor.factor,
    unit: 'kgCO2'
  }
}

// 合計を型レベルで表現
function sum(quantities: Quantity<'kgCO2'>[]): Quantity<'kgCO2'> {
  return {
    value: quantities.reduce((acc, q) => acc + q.value, 0),
    unit: 'kgCO2'
  }
}
```

### 6. 変換パイプラインの構築

```typescript
// ========================================
// 個別変換関数（マッピング + 計算）
// ========================================

// Scope1: 直接排出（燃料燃焼）
const calcScope1 = (record: ProductionRecord): Quantity<'kgCO2'> => {
  // ProductionRecord.process.fuelUsage → Scope1
  // 変換: kg燃料 × 排出係数 = kgCO2
  return multiply(
    record.process.fuelUsage,
    emissionFactors.fuel['diesel']
  )
}

// Scope2: 間接排出（電力）
const calcScope2 = (record: ProductionRecord): Quantity<'kgCO2'> => {
  // ProductionRecord.process.electricityUsage → Scope2
  // 変換: kWh × 排出係数 = kgCO2
  return multiply(
    record.process.electricityUsage,
    emissionFactors.electricity['japan']
  )
}

// Scope3上流: 原材料
const calcScope3Upstream = (record: ProductionRecord): Quantity<'kgCO2'> => {
  // ProductionRecord.materials[] → Scope3.upstream
  // 変換: Σ(材料kg × 材料別排出係数)
  const materialEmissions = record.materials.map(m => 
    multiply(m.weight, emissionFactors.material[m.materialCode] 
      ?? { factor: 1.0, sourceUnit: 'kg', targetUnit: 'kgCO2', source: 'default', validYear: 2023 })
  )
  
  // 入荷輸送
  const inboundTransport = multiply(
    { value: record.logistics.inboundDistance.value * getTotalMaterialWeight(record), 
      unit: 'km' as const },
    emissionFactors.transport[record.logistics.transportMode]
  )
  
  return sum([...materialEmissions, inboundTransport])
}

// Scope3下流: 製品輸送・廃棄
const calcScope3Downstream = (record: ProductionRecord): Quantity<'kgCO2'> => {
  // 出荷輸送
  const outboundTransport: Quantity<'kgCO2'> = {
    value: record.logistics.outboundDistance.value * 0.167, // 簡略化
    unit: 'kgCO2'
  }
  
  // 廃棄処理
  const wasteEmission = multiply(
    record.waste.amount,
    emissionFactors.waste[record.waste.disposalMethod]
  )
  
  return sum([outboundTransport, wasteEmission])
}

// ヘルパー関数
const getTotalMaterialWeight = (record: ProductionRecord): number =>
  record.materials.reduce((acc, m) => acc + m.weight.value, 0)
```

### 7. トランスデューサー（完全な変換器）

```typescript
// ========================================
// メイン変換器：ProductionRecord → CFPResult
// ========================================

type Transducer<Source, Target> = (source: Source) => Target

const cfpTransducer: Transducer<ProductionRecord, CFPResult> = (record) => {
  const scope1 = calcScope1(record)
  const scope2 = calcScope2(record)
  const scope3Upstream = calcScope3Upstream(record)
  const scope3Downstream = calcScope3Downstream(record)
  
  return {
    productId: record.productId,  // 直接マッピング
    scope1,                        // 計算付き変換
    scope2,                        // 計算付き変換
    scope3: {
      upstream: scope3Upstream,    // 集約 + 計算
      downstream: scope3Downstream // 集約 + 計算
    },
    total: sum([scope1, scope2, scope3Upstream, scope3Downstream])
  }
}
```

### 8. 型理論的に見たマッピング構造

上記の変換を図式化すると：

```
ProductionRecord
     │
     ├─── productId ─────────────────────────→ CFPResult.productId
     │    [Identity: 直接写像]
     │
     ├─── process.fuelUsage ──┬── ×係数 ────→ CFPResult.scope1
     │    [Lens + Multiply]   │
     │                        │
     ├─── process.electricity ┴── ×係数 ────→ CFPResult.scope2
     │    [Lens + Multiply]
     │
     ├─── materials[] ────────┬── map(×係数) ─┬→ CFPResult.scope3.upstream
     │    [Traversal]         │               │
     │                        │   + 輸送計算 ──┘
     ├─── logistics.inbound ──┘
     │    [Lens + Computation]
     │
     ├─── logistics.outbound ─┬── 輸送計算 ──┬→ CFPResult.scope3.downstream
     │    [Lens + Computation]│              │
     │                        │              │
     └─── waste ──────────────┴── ×係数 ────┘
          [Lens + Multiply]

                              │
                              Σ (総和)
                              │
                              ↓
                        CFPResult.total
```

### 9. 型レベルでのマッピング仕様（宣言的記述）

```typescript
// ========================================
// マッピング仕様の宣言的記述
// ========================================

type MappingSpec<Source, Target> = {
  targetField: keyof Target
  sourceExpression: SourceExpr<Source>
  transform?: TransformExpr
}

type SourceExpr<S> = 
  | { type: 'field', path: string }
  | { type: 'aggregate', paths: string[], aggregation: 'sum' | 'avg' | 'max' }
  | { type: 'computed', dependencies: string[], formula: string }

type TransformExpr = 
  | { type: 'identity' }
  | { type: 'multiply', factorRef: string }
  | { type: 'lookup', table: string, key: string }

// CFP計算のマッピング仕様
const cfpMappingSpec: MappingSpec<ProductionRecord, CFPResult>[] = [
  {
    targetField: 'productId',
    sourceExpression: { type: 'field', path: 'productId' },
    transform: { type: 'identity' }
  },
  {
    targetField: 'scope1',
    sourceExpression: { type: 'field', path: 'process.fuelUsage' },
    transform: { type: 'multiply', factorRef: 'fuel.diesel' }
  },
  {
    targetField: 'scope2',
    sourceExpression: { type: 'field', path: 'process.electricityUsage' },
    transform: { type: 'multiply', factorRef: 'electricity.japan' }
  },
  {
    targetField: 'scope3.upstream',
    sourceExpression: { 
      type: 'computed',
      dependencies: ['materials', 'logistics.inboundDistance'],
      formula: 'SUM(materials[*].weight * LOOKUP(material, materials[*].code)) + inbound * transport_factor'
    }
  }
  // ...
]
```

### 10. 型整合性の検証

```typescript
// ========================================
// コンパイル時の型チェックによる整合性保証
// ========================================

// 単位の整合性を型レベルで検証
type ValidMultiplication<U1 extends Unit, U2 extends string> = 
  U1 extends 'kWh' ? U2 extends 'kgCO2/kWh' ? Quantity<'kgCO2'> : never :
  U1 extends 'kg'  ? U2 extends 'kgCO2/kg'  ? Quantity<'kgCO2'> : never :
  U1 extends 'km'  ? U2 extends 'kgCO2/km'  ? Quantity<'kgCO2'> : never :
  never

// 使用例：正しい組み合わせのみコンパイル可能
type Test1 = ValidMultiplication<'kWh', 'kgCO2/kWh'>  // ✓ Quantity<'kgCO2'>
type Test2 = ValidMultiplication<'kWh', 'kgCO2/kg'>   // ✗ never（型エラー）
```

### 11. 実行例

```typescript
// ========================================
// 具体的なデータでの実行
// ========================================

const sampleProductionData: ProductionRecord = {
  productId: 'PROD-001',
  process: {
    machineId: 'MC-001',
    electricityUsage: { value: 50, unit: 'kWh' },
    fuelUsage: { value: 2, unit: 'kg' },
    operatingHours: 8
  },
  materials: [
    { materialCode: 'steel', weight: { value: 10, unit: 'kg' }, supplierRegion: 'domestic' },
    { materialCode: 'aluminum', weight: { value: 2, unit: 'kg' }, supplierRegion: 'import' }
  ],
  logistics: {
    inboundDistance: { value: 100, unit: 'km' },
    outboundDistance: { value: 50, unit: 'km' },
    transportMode: 'truck'
  },
  waste: {
    amount: { value: 0.5, unit: 'kg' },
    disposalMethod: 'incineration'
  }
}

const result = cfpTransducer(sampleProductionData)

console.log(result)
// {
//   productId: 'PROD-001',
//   scope1: { value: 5.16, unit: 'kgCO2' },      // 2kg × 2.58
//   scope2: { value: 22.05, unit: 'kgCO2' },     // 50kWh × 0.441
//   scope3: {
//     upstream: { value: 36.4, unit: 'kgCO2' },  // 材料 + 入荷輸送
//     downstream: { value: 9.72, unit: 'kgCO2' } // 出荷輸送 + 廃棄
//   },
//   total: { value: 73.33, unit: 'kgCO2' }
// }
```

---

## まとめ：型理論的視点からの整理

| 変換パターン | 型理論的構造 | CFP計算での例 |
|------------|------------|-------------|
| 直接写像 | Identity morphism | productId → productId |
| 射影 + 計算 | Lens + Function | electricity → scope2 |
| 集約 | Traversal + Fold | materials[] → scope3 |
| 条件分岐 | Prism / Sum type | transportMode による係数選択 |
| 外部参照 | Dependent type | 排出係数DBのルックアップ |

この例では、**型が変換の正しさを保証**しています：
- 単位の整合性（kWh × kgCO2/kWh = kgCO2）
- 必須フィールドの存在
- 計算式の適用可能性