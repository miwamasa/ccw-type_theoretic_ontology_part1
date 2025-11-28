# Morpheus DSL Documentation

Morpheus DSLは、型理論に基づいた型安全なデータ変換言語です。物理単位を含むデータのオントロジーマッピングを、コンパイル時型チェックにより安全に実行します。

## ドキュメント構成

### 1. [理論編](./theory.md)
Morpheus DSLの理論的基盤について説明します。

- **型理論**: スキーマ型（Σ型）、積型、和型
- **次元解析**: 物理単位のコンパイル時検証
- **オントロジーマッピング**: 異なるスキーマ間の意味保存変換
- **コンパイラアーキテクチャ**: 字句解析からコード生成まで

対象読者: コンパイラ設計者、型システム研究者

### 2. [チュートリアル](./tutorial.md)
Morpheus DSLの基本的な使い方から応用まで、段階的に学習します。

- **基礎編**: スキーマ定義、単純な変換
- **中級編**: 単位付き型、ルックアップテーブル
- **上級編**: パイプライン、集約関数
- **実行方法**: コンパイルとテスト実行

対象読者: DSLユーザー、データエンジニア

### 3. [事例集](./examples.md)
実際のユースケースにおけるMorpheus DSLの適用例を紹介します。

- **基本的なマッピング**: Person → PersonDTO
- **単位変換**: エネルギー消費データの変換
- **カーボンフットプリント計算**: 製造データからCO2排出量を算出
- **サプライチェーン**: 複雑なビジネスロジックのモデリング

対象読者: ドメインエキスパート、ビジネスアナリスト

## クイックスタート

```bash
# Morpheusファイルをコンパイル
node dist/cli/index.js compile examples/simple-test.morpheus --target typescript --output output

# 生成されたコードをビルド・実行
cd output
npx tsc
node dist/test.js
```

## 生成されるファイル

Morpheusコンパイラは以下の6つのファイルを生成します：

| ファイル | 説明 |
|---------|------|
| `types.ts` | スキーマ、Enum、Quantity型の定義とランタイム関数 |
| `transforms.ts` | 変換関数の実装 |
| `index.ts` | エクスポート用インデックス |
| `tsconfig.json` | TypeScriptコンパイラ設定 |
| `package.json` | npm設定とビルドスクリプト |
| `test.ts` | 自動生成されたテストコード |

## 主な機能

### ✅ 型安全性
コンパイル時に型エラーを検出し、実行時エラーを防ぎます。

### ✅ 単位付き型
物理単位（kWh, kg, kgCO2など）を型として扱い、単位の不整合を検出します。

### ✅ ランタイム演算
Quantity型の四則演算をサポートし、自動的にランタイム関数を生成します。

### ✅ 宣言的マッピング
SQLライクな宣言的構文でデータ変換を記述します。

### ✅ コード生成
TypeScriptコードを生成し、既存のプロジェクトに統合可能です。

## プロジェクト構成

```
ccw-type_theoretic_ontology_part1/
├── src/
│   ├── lexer/          # 字句解析器
│   ├── parser/         # 構文解析器
│   ├── analyzer/       # 意味解析（型チェック、名前解決）
│   ├── ir/             # 中間表現（MIR）
│   ├── codegen/        # コード生成（TypeScript）
│   ├── runtime/        # ランタイムライブラリ
│   └── cli/            # CLIインターフェース
├── examples/           # サンプルコード
├── specifications/     # 仕様書
└── doc/               # ドキュメント（本ディレクトリ）
```

## 参考文献

1. **型理論**: Benjamin C. Pierce, "Types and Programming Languages"
2. **次元解析**: Andrew Kennedy, "Programming Languages and Dimensions"
3. **オントロジーマッピング**: Semantic Web技術、RDF/OWL
4. **コンパイラ設計**: "Modern Compiler Implementation in ML/Java/C"

## ライセンス

MIT License

## コントリビューション

Issue、Pull Requestを歓迎します。

---

次へ: [理論編](./theory.md) | [チュートリアル](./tutorial.md) | [事例集](./examples.md)
