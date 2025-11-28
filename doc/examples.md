# Morpheus DSL 事例集

実際のビジネスシーンにおけるMorpheus DSLの活用例を紹介します。

## 目次

1. [基本的なマッピング](#基本的なマッピング)
2. [エネルギー管理システム](#エネルギー管理システム)
3. [カーボンフットプリント計算](#カーボンフットプリント計算)
4. [サプライチェーン管理](#サプライチェーン管理)
5. [金融データ変換](#金融データ変換)
6. [IoTデータ処理](#iotデータ処理)

---

## 基本的なマッピング

### 例1: Person → PersonDTO

**シナリオ**: 内部の`Person`モデルをAPIレスポンス用の`PersonDTO`に変換

```morpheus
schema Person {
  name: String
  age: Int
  email: String?
  department: String
}

schema PersonDTO {
  fullName: String
  ageYears: Int
  contactEmail: String
}

transform PersonToDTO: Person -> PersonDTO {
  fullName <- $.name
  ageYears <- $.age
  contactEmail <- $.email ?? "no-email@example.com"
}
```

**生成されるTypeScriptコード**:
```typescript
export function PersonToDTO(source: Types.Person): Types.PersonDTO {
  const result: any = {};
  const _t0 = source.name;
  result.fullName = _t0;
  const _t1 = source.age;
  result.ageYears = _t1;
  const _t2 = source.email ?? "no-email@example.com";
  result.contactEmail = _t2;
  return result;
}
```

**使用例**:
```typescript
const person: Person = {
  name: 'Alice',
  age: 30,
  email: 'alice@example.com',
  department: 'Engineering'
};

const dto = PersonToDTO(person);
// { fullName: 'Alice', ageYears: 30, contactEmail: 'alice@example.com' }
```

---

## エネルギー管理システム

### 例2: 電力消費データの集約

**シナリオ**: 時系列の電力消費データから日次サマリーを生成

```morpheus
// 単位定義
unit kWh
unit kW
unit hour

// ソースデータ（1時間ごとの測定値）
schema HourlyReading {
  timestamp: DateTime
  consumption: Quantity<kWh>
  peakPower: Quantity<kW>
  temperature: Float
}

schema DailyEnergyRecord {
  date: Date
  readings: [HourlyReading]
}

// ターゲットデータ（日次サマリー）
schema DailyEnergySummary {
  date: Date
  totalConsumption: Quantity<kWh>
  averagePower: Quantity<kW>
  peakPower: Quantity<kW>
  averageTemperature: Float
  readingCount: Int
}

transform DailyRecordToSummary: DailyEnergyRecord -> DailyEnergySummary {
  date <- $.date

  // 合計消費電力量
  totalConsumption <- sum($.readings, r -> r.consumption)

  // 平均電力（消費電力量 / 時間）
  averagePower <- $.totalConsumption / 24.0

  // ピーク電力
  peakPower <- max($.readings, r -> r.peakPower)

  // 平均気温
  averageTemperature <- avg($.readings, r -> r.temperature)

  // 測定回数
  readingCount <- count($.readings)
}
```

**実行例**:
```typescript
const dailyRecord: DailyEnergyRecord = {
  date: new Date('2024-01-15'),
  readings: [
    { timestamp: new Date('2024-01-15 00:00'), consumption: { value: 12.5, unit: 'kWh' }, peakPower: { value: 15.0, unit: 'kW' }, temperature: 18.5 },
    { timestamp: new Date('2024-01-15 01:00'), consumption: { value: 11.2, unit: 'kWh' }, peakPower: { value: 14.0, unit: 'kW' }, temperature: 17.8 },
    // ... 24時間分
  ]
};

const summary = DailyRecordToSummary(dailyRecord);
// {
//   date: 2024-01-15,
//   totalConsumption: { value: 300, unit: 'kWh' },
//   averagePower: { value: 12.5, unit: 'kW' },
//   peakPower: { value: 20.0, unit: 'kW' },
//   averageTemperature: 18.2,
//   readingCount: 24
// }
```

---

## カーボンフットプリント計算

### 例3: 製造プロセスのCO2排出量計算

**シナリオ**: 製造データから製品ごとのCO2排出量を計算

```morpheus
// 単位定義
unit kWh
unit kg
unit kgCO2
unit kgCO2_per_kWh = kgCO2 / kWh
unit kgCO2_per_kg = kgCO2 / kg

// 製造記録
schema ProductionRecord {
  productId: String
  productName: String
  electricityUsage: Quantity<kWh>
  materials: [MaterialUsage]
  processes: [ProcessStep]
}

schema MaterialUsage {
  materialCode: String
  materialName: String
  weight: Quantity<kg>
}

schema ProcessStep {
  processName: String
  energyConsumption: Quantity<kWh>
  duration: Float  // hours
}

// 排出量結果
schema CFPResult {
  productId: String
  productName: String
  totalEmission: Quantity<kgCO2>
  breakdown: EmissionBreakdown
}

schema EmissionBreakdown {
  electricityEmission: Quantity<kgCO2>
  materialEmission: Quantity<kgCO2>
  processEmission: Quantity<kgCO2>
}

// ルックアップテーブル
lookup ElectricityEmissionFactor {
  key: String  // 地域コード
  value: Quantity<kgCO2_per_kWh>
  source: "electricity_factors.csv"
}

lookup MaterialEmissionFactor {
  key: String  // 材料コード
  value: Quantity<kgCO2_per_kg>
  source: "material_factors.csv"
}

// 変換
transform ProductionToCFP: ProductionRecord -> CFPResult {
  productId <- $.productId
  productName <- $.productName

  // 電力由来のCO2排出量
  electricityEmission <- $.electricityUsage * lookup(ElectricityEmissionFactor, "JP", 0.5)

  // 材料由来のCO2排出量
  materialEmission <- sum(
    $.materials,
    m -> m.weight * lookup(MaterialEmissionFactor, m.materialCode, 0.0)
  )

  // プロセス由来のCO2排出量
  processEmission <- sum(
    $.processes,
    p -> p.energyConsumption * lookup(ElectricityEmissionFactor, "JP", 0.5)
  )

  // 合計
  totalEmission <- electricityEmission + materialEmission + processEmission

  // 内訳
  breakdown <- {
    electricityEmission: electricityEmission,
    materialEmission: materialEmission,
    processEmission: processEmission
  }
}
```

**データ例**:

`electricity_factors.csv`:
```csv
key,value
JP,0.456
US,0.417
EU,0.295
```

`material_factors.csv`:
```csv
key,value
STEEL,2.5
ALUMINUM,8.5
PLASTIC,3.2
```

**実行結果**:
```typescript
const production: ProductionRecord = {
  productId: 'P001',
  productName: 'Widget A',
  electricityUsage: { value: 100, unit: 'kWh' },
  materials: [
    { materialCode: 'STEEL', materialName: 'Steel Sheet', weight: { value: 50, unit: 'kg' } },
    { materialCode: 'PLASTIC', materialName: 'Plastic Parts', weight: { value: 10, unit: 'kg' } }
  ],
  processes: [
    { processName: 'Cutting', energyConsumption: { value: 20, unit: 'kWh' }, duration: 2.0 },
    { processName: 'Assembly', energyConsumption: { value: 15, unit: 'kWh' }, duration: 1.5 }
  ]
};

const cfp = ProductionToCFP(production);
// {
//   productId: 'P001',
//   productName: 'Widget A',
//   totalEmission: { value: 212.6, unit: 'kgCO2' },
//   breakdown: {
//     electricityEmission: { value: 45.6, unit: 'kgCO2' },   // 100 * 0.456
//     materialEmission: { value: 157.0, unit: 'kgCO2' },     // 50*2.5 + 10*3.2
//     processEmission: { value: 10.0, unit: 'kgCO2' }        // (20+15) * 0.456
//   }
// }
```

---

## サプライチェーン管理

### 例4: 発注データの変換

**シナリオ**: 社内の発注システムから取引先のEDI形式に変換

```morpheus
// 社内フォーマット
schema InternalPurchaseOrder {
  orderId: String
  orderDate: DateTime
  supplierId: String
  items: [OrderItem]
  deliveryAddress: Address
  requestedDeliveryDate: Date
}

schema OrderItem {
  itemCode: String
  itemName: String
  quantity: Int
  unitPrice: Float
  unit: String  // "個", "kg" など
}

schema Address {
  postalCode: String
  prefecture: String
  city: String
  street: String
  building: String?
}

// EDIフォーマット
schema EDIPurchaseOrder {
  documentType: String
  documentNumber: String
  issueDate: String  // YYYY-MM-DD
  supplierCode: String
  lineItems: [EDILineItem]
  deliveryInfo: EDIDeliveryInfo
  totalAmount: Float
}

schema EDILineItem {
  lineNumber: Int
  productCode: String
  quantityOrdered: Int
  unitOfMeasure: String
  unitPrice: Float
  lineAmount: Float
}

schema EDIDeliveryInfo {
  requestedDate: String  // YYYY-MM-DD
  deliveryPostalCode: String
  deliveryAddress: String
}

// ルックアップ: 単位変換
lookup UnitCodeMapping {
  key: String     // 社内単位名
  value: String   // EDI単位コード
  source: "unit_mapping.csv"
}

// 変換
transform InternalToEDI: InternalPurchaseOrder -> EDIPurchaseOrder {
  documentType <- "PO"  // Purchase Order
  documentNumber <- $.orderId
  issueDate <- formatDate($.orderDate, "YYYY-MM-DD")
  supplierCode <- $.supplierId

  // 明細行の変換（行番号を追加）
  lineItems <- map(
    $.items,
    (item, index) -> {
      lineNumber: index + 1,
      productCode: item.itemCode,
      quantityOrdered: item.quantity,
      unitOfMeasure: lookup(UnitCodeMapping, item.unit, "EA"),
      unitPrice: item.unitPrice,
      lineAmount: item.quantity * item.unitPrice
    }
  )

  // 配送情報
  deliveryInfo <- {
    requestedDate: formatDate($.requestedDeliveryDate, "YYYY-MM-DD"),
    deliveryPostalCode: $.deliveryAddress.postalCode,
    deliveryAddress: concat(
      $.deliveryAddress.prefecture,
      $.deliveryAddress.city,
      $.deliveryAddress.street
    )
  }

  // 合計金額
  totalAmount <- sum($.items, item -> item.quantity * item.unitPrice)
}
```

**実行例**:
```typescript
const internalOrder: InternalPurchaseOrder = {
  orderId: 'PO-2024-001',
  orderDate: new Date('2024-01-15T10:30:00'),
  supplierId: 'SUP-123',
  items: [
    { itemCode: 'ITEM-A', itemName: 'Product A', quantity: 100, unitPrice: 500, unit: '個' },
    { itemCode: 'ITEM-B', itemName: 'Product B', quantity: 50, unitPrice: 1200, unit: 'kg' }
  ],
  deliveryAddress: {
    postalCode: '100-0001',
    prefecture: '東京都',
    city: '千代田区',
    street: '丸の内1-1-1',
    building: 'ビルA'
  },
  requestedDeliveryDate: new Date('2024-01-20')
};

const ediOrder = InternalToEDI(internalOrder);
// {
//   documentType: 'PO',
//   documentNumber: 'PO-2024-001',
//   issueDate: '2024-01-15',
//   supplierCode: 'SUP-123',
//   lineItems: [
//     { lineNumber: 1, productCode: 'ITEM-A', quantityOrdered: 100, unitOfMeasure: 'EA', unitPrice: 500, lineAmount: 50000 },
//     { lineNumber: 2, productCode: 'ITEM-B', quantityOrdered: 50, unitOfMeasure: 'KG', unitPrice: 1200, lineAmount: 60000 }
//   ],
//   deliveryInfo: {
//     requestedDate: '2024-01-20',
//     deliveryPostalCode: '100-0001',
//     deliveryAddress: '東京都千代田区丸の内1-1-1'
//   },
//   totalAmount: 110000
// }
```

---

## 金融データ変換

### 例5: トレーディングデータの正規化

**シナリオ**: 複数の取引所からのデータを統一フォーマットに変換

```morpheus
// 取引所Aのフォーマット
schema ExchangeA_Trade {
  tradeId: String
  symbol: String
  side: String  // "BUY" or "SELL"
  price: Float
  size: Float
  timestamp: Int  // Unix timestamp (ms)
  currency: String
}

// 取引所Bのフォーマット
schema ExchangeB_Trade {
  id: String
  instrument: String
  direction: Int  // 1=買い, 2=売り
  executionPrice: Float
  volume: Float
  tradeTime: DateTime
  quoteCurrency: String
}

// 統一フォーマット
enum TradeSide {
  Buy
  Sell
}

schema NormalizedTrade {
  tradeId: String
  exchangeCode: String
  symbol: String
  side: TradeSide
  price: Float
  quantity: Float
  tradedAt: DateTime
  currency: String
}

// 変換: 取引所A → 統一
transform ExchangeAToNormalized: ExchangeA_Trade -> NormalizedTrade {
  tradeId <- $.tradeId
  exchangeCode <- "EXCA"
  symbol <- $.symbol
  side <- if $.side == "BUY" then TradeSide.Buy else TradeSide.Sell
  price <- $.price
  quantity <- $.size
  tradedAt <- fromUnixTimestamp($.timestamp)
  currency <- $.currency
}

// 変換: 取引所B → 統一
transform ExchangeBToNormalized: ExchangeB_Trade -> NormalizedTrade {
  tradeId <- $.id
  exchangeCode <- "EXCB"
  symbol <- $.instrument
  side <- if $.direction == 1 then TradeSide.Buy else TradeSide.Sell
  price <- $.executionPrice
  quantity <- $.volume
  tradedAt <- $.tradeTime
  currency <- $.quoteCurrency
}
```

---

## IoTデータ処理

### 例6: センサーデータの集約とアラート生成

**シナリオ**: IoTセンサーからの時系列データを分析し、異常を検出

```morpheus
// 単位定義
unit celsius
unit percent
unit ppm  // parts per million

// センサーデータ
schema SensorReading {
  sensorId: String
  timestamp: DateTime
  temperature: Quantity<celsius>
  humidity: Quantity<percent>
  co2Level: Quantity<ppm>
  location: String
}

schema SensorDataBatch {
  sensorId: String
  location: String
  startTime: DateTime
  endTime: DateTime
  readings: [SensorReading]
}

// 分析結果
enum AlertLevel {
  Normal
  Warning
  Critical
}

schema SensorAnalysis {
  sensorId: String
  location: String
  period: String
  averageTemperature: Quantity<celsius>
  maxTemperature: Quantity<celsius>
  minTemperature: Quantity<celsius>
  averageHumidity: Quantity<percent>
  maxCO2: Quantity<ppm>
  alertLevel: AlertLevel
  alerts: [String]
}

// しきい値設定
lookup TemperatureThreshold {
  key: String  // location
  value: Float
  source: "temp_thresholds.csv"
}

lookup CO2Threshold {
  key: String  // location
  value: Float
  source: "co2_thresholds.csv"
}

// 変換
transform AnalyzeSensorData: SensorDataBatch -> SensorAnalysis {
  sensorId <- $.sensorId
  location <- $.location
  period <- concat(formatDate($.startTime, "HH:mm"), " - ", formatDate($.endTime, "HH:mm"))

  // 温度統計
  averageTemperature <- avg($.readings, r -> r.temperature)
  maxTemperature <- max($.readings, r -> r.temperature)
  minTemperature <- min($.readings, r -> r.temperature)

  // 湿度統計
  averageHumidity <- avg($.readings, r -> r.humidity)

  // CO2最大値
  maxCO2 <- max($.readings, r -> r.co2Level)

  // アラート判定
  tempThreshold <- lookup(TemperatureThreshold, $.location, 30.0)
  co2Threshold <- lookup(CO2Threshold, $.location, 1000.0)

  isTempHigh <- maxTemperature > tempThreshold
  isCO2High <- maxCO2 > co2Threshold

  alertLevel <- if isTempHigh && isCO2High then AlertLevel.Critical
                else if isTempHigh || isCO2High then AlertLevel.Warning
                else AlertLevel.Normal

  alerts <- filter([
    if isTempHigh then "High temperature detected" else null,
    if isCO2High then "High CO2 level detected" else null
  ], a -> a != null)
}
```

**実行例**:
```typescript
const batch: SensorDataBatch = {
  sensorId: 'SENSOR-01',
  location: 'Office-A',
  startTime: new Date('2024-01-15 09:00'),
  endTime: new Date('2024-01-15 12:00'),
  readings: [
    { sensorId: 'SENSOR-01', timestamp: new Date('2024-01-15 09:00'), temperature: { value: 22.5, unit: 'celsius' }, humidity: { value: 45, unit: 'percent' }, co2Level: { value: 800, unit: 'ppm' }, location: 'Office-A' },
    { sensorId: 'SENSOR-01', timestamp: new Date('2024-01-15 10:00'), temperature: { value: 25.2, unit: 'celsius' }, humidity: { value: 48, unit: 'percent' }, co2Level: { value: 950, unit: 'ppm' }, location: 'Office-A' },
    { sensorId: 'SENSOR-01', timestamp: new Date('2024-01-15 11:00'), temperature: { value: 28.5, unit: 'celsius' }, humidity: { value: 52, unit: 'percent' }, co2Level: { value: 1200, unit: 'ppm' }, location: 'Office-A' },
  ]
};

const analysis = AnalyzeSensorData(batch);
// {
//   sensorId: 'SENSOR-01',
//   location: 'Office-A',
//   period: '09:00 - 12:00',
//   averageTemperature: { value: 25.4, unit: 'celsius' },
//   maxTemperature: { value: 28.5, unit: 'celsius' },
//   minTemperature: { value: 22.5, unit: 'celsius' },
//   averageHumidity: { value: 48.3, unit: 'percent' },
//   maxCO2: { value: 1200, unit: 'ppm' },
//   alertLevel: AlertLevel.Warning,
//   alerts: ['High CO2 level detected']
// }
```

---

## まとめ

Morpheus DSLは以下のような場面で威力を発揮します：

1. **型安全性が重要**: コンパイル時に多くのエラーを検出
2. **物理単位が絡む**: エネルギー、製造、IoTなど
3. **複雑な集約**: 時系列データ、統計処理
4. **マッピングが多い**: システム間のデータ変換
5. **ドメイン知識の形式化**: ビジネスルールの明示的な記述

次のステップ:
- [理論編](./theory.md)で背景を理解
- [チュートリアル](./tutorial.md)で実装を学習
- 実際のプロジェクトに適用

---

[ドキュメントトップに戻る](./README.md)
