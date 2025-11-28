# AI-Powered Schema Mapping

Morpheus DSLは、Anthropic Claudeを使用した自動スキーママッピング機能をサポートしています。

## セットアップ

### 1. Anthropic APIキーの取得

[Anthropic Console](https://console.anthropic.com/)でAPIキーを取得してください。

### 2. 環境変数の設定

```bash
export ANTHROPIC_API_KEY="sk-ant-..."

# オプション: デフォルトのモデルを指定（エイリアス使用可能）
export ANTHROPIC_MODEL="sonnet"    # claude-3-5-sonnet-20241022
# または
export ANTHROPIC_MODEL="haiku"     # claude-3-haiku-20240307
# または
export ANTHROPIC_MODEL="opus"      # claude-3-opus-20240229
```

### 3. 依存関係のインストール

```bash
npm install
npm run build
```

## 使い方

### 基本的な使用法

```bash
node dist/cli/index.js ai-map examples/ai-mapping-test.morpheus \
  --source CustomerRecord \
  --target UserProfile
```

### オプション

| オプション | 説明 | デフォルト |
|----------|------|-----------|
| `--source <schema>` | ソーススキーマ名（必須） | - |
| `--target <schema>` | ターゲットスキーマ名（必須） | - |
| `--transform <name>` | 生成する変換名 | `{Source}To{Target}` |
| `--domain <context>` | ドメインコンテキスト | - |
| `--model <model>` | Claudeモデル | `claude-3-5-sonnet-20241022` |
| `--min-confidence <score>` | 最小信頼度（0-1） | `0.5` |
| `-o, --output <file>` | 出力ファイル | - |

### 例1: 基本的なマッピング

```bash
node dist/cli/index.js ai-map examples/ai-mapping-test.morpheus \
  --source CustomerRecord \
  --target UserProfile \
  -o generated-transform.morpheus
```

**出力例**:
```
🔍 Analyzing schemas in examples/ai-mapping-test.morpheus...

📋 Source: CustomerRecord (8 fields)
📋 Target: UserProfile (7 fields)

🤖 Calling Claude AI (claude-3-5-sonnet-20241022)...
   Found 7 mappings (min confidence: 50%)

📊 Mapping Report:

✓ id <- $.customerId
   Confidence: 98%
   Reason: Both fields represent unique identifiers

✓ fullName <- $.firstName
   Confidence: 95%
   Reason: Combining first and last names for full name
   Transform: $.firstName + ' ' + $.lastName

✓ email <- $.emailAddress
   Confidence: 100%
   Reason: Direct semantic match for email fields

⚡ phone <- $.phoneNumber
   Confidence: 92%
   Reason: Phone number mapping

✓ memberSince <- $.registrationDate
   Confidence: 88%
   Reason: Registration date indicates membership start

✓ points <- $.loyaltyPoints
   Confidence: 95%
   Reason: Loyalty points correspond to user points

⚡ active <- $.accountStatus
   Confidence: 75%
   Reason: Account status can indicate if user is active
   Transform: $.accountStatus == "active"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generated Transform:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI-generated transform (confidence scores in comments)
transform CustomerRecordToUserProfile: CustomerRecord -> UserProfile {
  // Both fields represent unique identifiers (confidence: 98%)
  id <- $.customerId
  // Combining first and last names for full name (confidence: 95%)
  fullName <- $.firstName + ' ' + $.lastName
  // Direct semantic match for email fields (confidence: 100%)
  email <- $.emailAddress
  // Phone number mapping (confidence: 92%)
  phone <- $.phoneNumber
  // Registration date indicates membership start (confidence: 88%)
  memberSince <- $.registrationDate
  // Loyalty points correspond to user points (confidence: 95%)
  points <- $.loyaltyPoints
  // Account status can indicate if user is active (confidence: 75%)
  active <- $.accountStatus == "active"
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ Saved to generated-transform.morpheus

📈 Statistics:
   Total mappings: 7 / 7
   Average confidence: 92%
   Coverage: 100%
```

### 例2: ドメインコンテキストの指定

```bash
node dist/cli/index.js ai-map examples/ai-mapping-test.morpheus \
  --source ProductData \
  --target ProductDTO \
  --domain "E-commerce product catalog management" \
  -o product-transform.morpheus
```

ドメインコンテキストを指定することで、AIがより正確なマッピングを生成できます。

### 例3: モデルと信頼度の調整

```bash
# より高度なモデルを使用（エイリアスで指定）
node dist/cli/index.js ai-map examples/ai-mapping-test.morpheus \
  --source CustomerRecord \
  --target UserProfile \
  --model opus \
  --min-confidence 0.8

# または環境変数で指定
export ANTHROPIC_MODEL="haiku"
node dist/cli/index.js ai-map examples/ai-mapping-test.morpheus \
  --source CustomerRecord \
  --target UserProfile \
  --min-confidence 0.6
```

## 利用可能なClaudeモデル

### モデルの指定方法

モデルは以下の3つの方法で指定できます（優先順位順）：
1. **CLIオプション**: `--model` オプションで指定
2. **環境変数**: `ANTHROPIC_MODEL` 環境変数
3. **デフォルト**: `claude-3-5-sonnet-20241022`

### モデルエイリアス

簡単な名前でモデルを指定できます：

| エイリアス | 実際のモデル |
|-----------|------------|
| `sonnet` | `claude-3-5-sonnet-20241022` |
| `sonnet-3.5` | `claude-3-5-sonnet-20241022` |
| `sonnet-3` | `claude-3-sonnet-20240229` |
| `opus` | `claude-3-opus-20240229` |
| `haiku` | `claude-3-haiku-20240307` |

使用例：
```bash
# エイリアスを使用
export ANTHROPIC_MODEL="haiku"
node dist/cli/index.js ai-map examples/ai-mapping-test.morpheus --source CustomerRecord --target UserProfile

# CLIオプションでオーバーライド
node dist/cli/index.js ai-map examples/ai-mapping-test.morpheus \
  --source CustomerRecord \
  --target UserProfile \
  --model opus
```

### モデル比較

| モデル | 説明 | 推奨用途 |
|-------|------|---------|
| `claude-3-5-sonnet-20241022` (`sonnet`) | 最新のSonnetモデル（推奨） | バランスの取れたパフォーマンス |
| `claude-3-opus-20240229` (`opus`) | 最も高性能なモデル | 複雑なマッピング |
| `claude-3-sonnet-20240229` (`sonnet-3`) | 前世代のSonnet | コスト重視 |
| `claude-3-haiku-20240307` (`haiku`) | 高速・低コスト | シンプルなマッピング |

## 料金の目安

- Claude 3.5 Sonnet: 入力 $3/MTok, 出力 $15/MTok
- 1回のマッピング（10フィールド程度）: 約 $0.05-0.10

## ベストプラクティス

### 1. ドメインコンテキストを明示する

```bash
--domain "Manufacturing carbon footprint calculation for automotive industry"
```

具体的なドメイン情報を提供すると、AIがより正確なマッピングを生成します。

### 2. 信頼度の閾値を調整する

```bash
--min-confidence 0.8  # 高い信頼度のみ
--min-confidence 0.5  # より多くの候補を取得
```

### 3. 生成結果を確認する

AIが生成したマッピングは必ず確認してください。特に：
- ビジネスロジックが正しいか
- データ型の変換が適切か
- 単位の扱いが正しいか

### 4. 複雑な変換は手動で調整する

AIが生成した変換をベースに、必要に応じて手動で調整：

```morpheus
// AI生成
transform CustomerToUser: Customer -> User {
  name <- $.firstName + ' ' + $.lastName
}

// 手動調整（ミドルネームを追加）
transform CustomerToUser: Customer -> User {
  name <- if $.middleName != null
          then $.firstName + ' ' + $.middleName + ' ' + $.lastName
          else $.firstName + ' ' + $.lastName
}
```

## トラブルシューティング

### APIキーエラー

```
Error: ANTHROPIC_API_KEY environment variable not set
```

→ 環境変数を設定してください：
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### ネットワークエラー

#### 接続エラー（ECONNRESET, fetch failed）

```
Error: Failed to call Anthropic API: fetch failed
Cause: Error: read ECONNRESET
```

**原因**:
- ネットワークの一時的な問題
- プロキシやファイアウォールの設定
- タイムアウト

**対処法**:

1. **自動リトライ**: 3回まで自動的にリトライします（1秒、2秒、4秒の間隔）

2. **プロキシ設定**: プロキシ経由の場合、環境変数を設定：
```bash
export HTTP_PROXY="http://proxy.example.com:8080"
export HTTPS_PROXY="http://proxy.example.com:8080"
export NO_PROXY="localhost,127.0.0.1"
```

3. **認証付きプロキシ**:
```bash
export HTTPS_PROXY="http://username:password@proxy.example.com:8080"
```

4. **プロキシ除外**: Anthropic API を直接接続する場合：
```bash
export NO_PROXY="api.anthropic.com"
```

5. **ネットワーク確認**:
```bash
# 接続テスト
curl -I https://api.anthropic.com/v1/messages

# プロキシ経由でテスト
curl -x http://proxy.example.com:8080 -I https://api.anthropic.com/v1/messages
```

#### サーバーエラー

```
Error: Anthropic API error: 500
```

→ しばらく待ってから再試行してください（自動リトライされます）。

### マッピングが見つからない

```
⚠️  No mappings found with sufficient confidence
```

→ 以下を試してください：
- `--min-confidence` を下げる（例: 0.3）
- `--domain` でより詳細なコンテキストを指定
- スキーマのフィールド名をより明確にする

## 制限事項

1. **変換式の生成**: 単純な式のみサポート（複雑なロジックは手動調整が必要）
2. **単位変換**: 物理単位の変換は手動で確認が必要
3. **配列操作**: 集約関数などの複雑な配列操作は未対応

## 次のステップ

1. 生成された変換をプロジェクトに追加
2. `compile` コマンドでTypeScriptコードを生成
3. テストを実行して動作確認

```bash
# 1. AI生成変換を既存ファイルに追加
cat generated-transform.morpheus >> my-transforms.morpheus

# 2. コンパイル
node dist/cli/index.js compile my-transforms.morpheus -o output

# 3. テスト実行
cd output
npx tsc
node dist/test.js
```

## フィードバック

AI生成機能の改善要望や不具合報告は、GitHubのIssueにお願いします。
