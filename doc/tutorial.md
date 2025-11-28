# Morpheus DSL チュートリアル

## 目次

1. [基礎編](#基礎編)
2. [中級編](#中級編)
3. [上級編](#上級編)
4. [実行方法](#実行方法)

---

## 基礎編

### 1. 最初のスキーマ定義

スキーマは、データの構造を定義します。

```morpheus
// 人物を表すスキーマ
schema Person {
  name: String
  age: Int
}
```

**基本型**:
- `String` - 文字列
- `Int` - 整数
- `Float` - 浮動小数点数
- `Bool` - 真偽値
- `Date` - 日付
- `DateTime` - 日時

### 2. 最初の変換

スキーマ間の変換を定義します。

```morpheus
// DTOスキーマ
schema PersonDTO {
  fullName: String
  ageYears: Int
}

// 変換の定義
transform PersonToDTO: Person -> PersonDTO {
  fullName <- $.name      // $は入力データ（source）を指す
  ageYears <- $.age
}
```

**構文**:
- `transform 名前: ソース型 -> ターゲット型 { ルール }`
- `ターゲットフィールド <- ソース式`
- `$` はソースオブジェクトを参照

### 3. コンパイルと実行

```bash
# コンパイル
node dist/cli/index.js compile my-file.morpheus --target typescript --output output

# TypeScriptビルド
cd output
npx tsc

# テスト実行
node dist/test.js
```

**出力例**:
```
=== PersonToDTO ===
Input: { name: 'Sample String', age: 42 }
Output: { fullName: 'Sample String', ageYears: 42 }
✓ PersonToDTO executed successfully!
```

### 4. 配列型

```morpheus
schema Team {
  name: String
  members: [Person]  // 配列型
}

schema TeamSummary {
  teamName: String
  memberCount: Int
}

transform TeamToSummary: Team -> TeamSummary {
  teamName <- $.name
  memberCount <- $.members.length  // 配列の長さ
}
```

### 5. Optional型

null許容型を定義します。

```morpheus
schema Employee {
  name: String
  email: String?     // Optional<String>
  manager: String?
}
```

**使用例**:
```morpheus
transform EmployeeToDTO: Employee -> EmployeeDTO {
  name <- $.name
  email <- $.email ?? "no-email@example.com"  // デフォルト値
}
```

---

## 中級編

### 1. Enum型

列挙型を定義します。

```morpheus
enum Status {
  Active
  Inactive
  Pending
}

schema Task {
  title: String
  status: Status
}
```

**Enum値の使用**:
```morpheus
transform TaskToActive: Task -> Task {
  title <- $.title
  status <- Status.Active  // Enum値の参照
}
```

### 2. 物理単位（Quantity型）

物理量を型安全に扱います。

```morpheus
// 単位の定義
unit kWh        // キロワット時
unit kg         // キログラム
unit kgCO2      // CO2排出量（kg単位）

schema EnergyData {
  productId: String
  consumption: Quantity<kWh>
  weight: Quantity<kg>
}
```

**単位演算**:
```morpheus
unit kgCO2_per_kWh = kgCO2 / kWh  // 合成単位

transform CalculateEmission: EnergyData -> EmissionData {
  productId <- $.productId
  emission <- $.consumption * emissionFactor  // Quantity演算
}
```

### 3. ルックアップテーブル

外部データを参照します。

```morpheus
// ルックアップテーブルの定義
lookup EmissionFactor {
  key: String
  value: Quantity<kgCO2_per_kWh>
  source: "emission_factors.csv"
}

transform CalculateCFP: ProductionRecord -> CFPResult {
  productId <- $.productId
  totalEmission <- $.electricityUsage * lookup(EmissionFactor, "electricity")
}
```

**lookupの構文**:
```
lookup(テーブル名, キー)
lookup(テーブル名, キー, デフォルト値)
```

### 4. 式と演算

**算術演算**:
```morpheus
result <- $.value1 + $.value2
result <- $.quantity * 2.0
result <- $.total / $.count
```

**比較演算**:
```morpheus
isAdult <- $.age >= 18
isValid <- $.status == Status.Active
```

**論理演算**:
```morpheus
canVote <- $.age >= 18 && $.isResident
hasDiscount <- $.isMember || $.isStudent
```

### 5. ネストしたスキーマ

```morpheus
schema Address {
  street: String
  city: String
  zipCode: String
}

schema Company {
  name: String
  address: Address  // ネストしたスキーマ
}

transform CompanyToFlat: Company -> FlatCompany {
  companyName <- $.name
  city <- $.address.city     // ネストしたフィールドへのアクセス
  zipCode <- $.address.zipCode
}
```

---

## 上級編

### 1. パイプライン

複数の変換を連結します。

```morpheus
pipeline DataProcessing: RawData -> FinalResult {
  ValidateData        // 1番目の変換
  -> NormalizeData    // 2番目の変換
  -> CalculateMetrics // 3番目の変換
  -> FormatOutput     // 4番目の変換
}
```

**並列実行**:
```morpheus
pipeline ParallelProcessing: Input -> Output {
  [TransformA, TransformB, TransformC]  // 並列実行
  -> MergeResults
}
```

**条件分岐**:
```morpheus
pipeline ConditionalPipeline: Data -> Result {
  if $.isValid then ValidPath else InvalidPath
  -> FinalTransform
}
```

### 2. 集約関数

配列データを集約します。

```morpheus
schema SalesRecord {
  productId: String
  sales: [SaleItem]
}

schema SalesSummary {
  productId: String
  totalRevenue: Float
  averagePrice: Float
  maxPrice: Float
  itemCount: Int
}

transform SalesToSummary: SalesRecord -> SalesSummary {
  productId <- $.productId
  totalRevenue <- sum($.sales, item -> item.price * item.quantity)
  averagePrice <- avg($.sales, item -> item.price)
  maxPrice <- max($.sales, item -> item.price)
  itemCount <- count($.sales)
}
```

**集約関数一覧**:
- `sum(array, lambda)` - 合計
- `avg(array, lambda)` - 平均
- `max(array, lambda)` - 最大値
- `min(array, lambda)` - 最小値
- `count(array)` - 要素数
- `filter(array, predicate)` - フィルタリング
- `map(array, lambda)` - 写像
- `groupBy(array, keyFunc)` - グルーピング

### 3. 複雑な例：カーボンフットプリント計算

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

// ルックアップテーブル
lookup EmissionFactor {
  key: String
  value: Quantity<kgCO2_per_kWh>
  source: "emission_factors.csv"
}

lookup MaterialEmissionFactor {
  key: String
  value: Quantity<kgCO2>
  source: "material_factors.csv"
}

// 変換
transform ProductionToCFP: ProductionRecord -> CFPResult {
  productId <- $.productId

  // 電力由来のCO2排出量
  electricityEmission <- $.electricityUsage * lookup(EmissionFactor, "electricity")

  // 材料由来のCO2排出量（集約）
  materialEmission <- sum(
    $.materials,
    m -> m.weight * lookup(MaterialEmissionFactor, m.code, 0.0)
  )

  // 合計
  totalEmission <- electricityEmission + materialEmission
}
```

### 4. 型安全性の恩恵

**コンパイルエラーの例**:

```morpheus
// エラー: 単位の不一致
emission <- $.weight + $.energy  // kg + kWh は型エラー

// エラー: フィールドが存在しない
name <- $.invalidField  // 'invalidField' は定義されていません

// エラー: 型の不一致
count <- $.name  // String を Int に代入できません

// OK: 正しい単位演算
totalEnergy <- $.energy1 + $.energy2  // kWh + kWh = kWh
emission <- $.energy * emissionFactor // kWh * kgCO2_per_kWh = kgCO2
```

---

## 実行方法

### 1. コンパイラのビルド

```bash
# プロジェクトのビルド
npm install
npm run build
```

### 2. Morpheusファイルのコンパイル

```bash
# 基本的な使い方
node dist/cli/index.js compile input.morpheus --target typescript --output output-dir

# 型チェックのみ
node dist/cli/index.js check input.morpheus
```

**オプション**:
- `--target` - ターゲット言語（現在はtypescriptのみ）
- `--output` - 出力ディレクトリ

### 3. 生成されたコードのビルド

```bash
cd output-dir
npm install  # TypeScriptをインストール
npm run build
```

### 4. テストの実行

```bash
# 自動生成されたテストを実行
node dist/test.js
```

### 5. 生成されたコードの使用

```typescript
import { PersonToDTO } from './output-dir/transforms';
import { Person, PersonDTO } from './output-dir/types';

const person: Person = {
  name: 'Alice',
  age: 30
};

const dto: PersonDTO = PersonToDTO(person);
console.log(dto);  // { fullName: 'Alice', ageYears: 30 }
```

### 6. ランタイムでの単位演算

```typescript
import * as Types from './output-dir/types';

const energy: Types.Quantity<'kWh'> = { value: 100, unit: 'kWh' };
const factor: Types.Quantity<'kgCO2_per_kWh'> = { value: 0.5, unit: 'kgCO2_per_kWh' };

// Quantity演算（自動生成された関数を使用）
const emission = Types.multiplyValue(energy, factor);
console.log(emission);  // { value: 50, unit: 'kWh_times_kgCO2_per_kWh' }
```

---

## ベストプラクティス

### 1. スキーマ設計

**Good**: 明確で一貫性のある命名
```morpheus
schema ProductionRecord {
  productId: String
  electricityUsage: Quantity<kWh>
}
```

**Bad**: 曖昧な命名
```morpheus
schema Data {
  id: String
  val: Float
}
```

### 2. 単位の使用

**Good**: 物理量には必ず単位を付ける
```morpheus
schema EnergyData {
  consumption: Quantity<kWh>
  power: Quantity<kW>
}
```

**Bad**: 単位なしの数値
```morpheus
schema EnergyData {
  consumption: Float  // 単位が不明！
}
```

### 3. 変換の分割

**Good**: 小さな変換を組み合わせる
```morpheus
transform Step1: A -> B { ... }
transform Step2: B -> C { ... }

pipeline Process: A -> C {
  Step1 -> Step2
}
```

**Bad**: 巨大な単一変換
```morpheus
transform HugeTransform: A -> Z {
  // 100行のルール...
}
```

### 4. ルックアップテーブルの活用

**Good**: 設定値は外部化
```morpheus
lookup Config {
  key: String
  value: Float
  source: "config.csv"
}
```

**Bad**: ハードコード
```morpheus
transform Calc: Input -> Output {
  result <- $.value * 0.5  // マジックナンバー
}
```

---

## トラブルシューティング

### Q: コンパイルエラーが出る

**A**: エラーメッセージを確認してください。

```
Error: Type mismatch at line 10, column 15
Expected: Quantity<kWh>
Found: Quantity<kg>
```

### Q: 生成されたコードが動かない

**A**: TypeScriptのコンパイルエラーを確認してください。

```bash
cd output
npx tsc --noEmit  # エラーチェックのみ
```

### Q: Quantity演算が動かない

**A**: ランタイム関数が正しくインポートされているか確認してください。

```typescript
import * as Types from './types';

// OK
const result = Types.multiplyValue(a, b);

// NG
const result = a * b;  // Quantityは直接演算できない
```

---

次へ: [事例集](./examples.md)
