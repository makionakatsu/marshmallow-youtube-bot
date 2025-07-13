# Marshmallow to YouTube Live Chat Bot - 要件定義書 V2.0

**最終更新:** 2025年1月13日  
**作成者:** Claude Code  
**バージョン:** 2.0 (リファクタリング版)

## 🔄 V2.0 更新内容

### 主な変更点
- **アーキテクチャの全面刷新**: 複雑化したコードの大幅な簡素化
- **コード量削減**: 434行 → 150行 (65%削減目標)
- **エラーハンドリング統一**: Extension Context無効化問題の根本解決
- **保守性向上**: クラスベース設計による責任の明確化

### リファクタリング要件

#### 1. 設計原則
```javascript
// シンプルなクラスベース設計
class MarshmallowContentScript {
  constructor() {
    this.isRunning = false;
    this.observer = null;
    this.interval = null;
    this.lastMessages = [];
  }

  // 単一のエラーハンドリング戦略
  safeExecute(fn, context = 'unknown') {
    try {
      if (!chrome?.runtime?.id) return false;
      return fn();
    } catch (error) {
      console.warn(`Error in ${context}:`, error.message);
      this.cleanup();
      return false;
    }
  }

  // 簡潔なクリーンアップ
  cleanup() {
    if (this.observer) this.observer.disconnect();
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
  }
}
```

#### 2. 品質目標

| 項目 | 現在 | 目標 | 削減率 |
|------|------|------|--------|
| **行数** | 434行 | 150行 | 65% |
| **関数数** | 15個 | 8個 | 47% |
| **グローバル変数** | 8個 | 3個 | 63% |
| **エラーハンドリング箇所** | 12箇所 | 1箇所 | 92% |

#### 3. 実装フェーズ

**Phase 1: 基本構造のリファクタリング**
- 現在の`content_script.js`をクラスベース設計に変更
- 重複するエラーハンドリングを統一関数に集約
- グローバル変数を削減

**Phase 2: 機能統合**
- MutationObserverとpollingの統合
- メッセージ抽出ロジックの簡素化
- 設定管理の一元化

**Phase 3: 品質保証**
- 基本機能の動作確認
- エラーハンドリングの検証
- パフォーマンス最適化

---

## 🎯 システム概要

### 目的
マシュマロ（質問投稿サービス）で受信した質問を、YouTube Live Chatに自動投稿するChrome拡張機能。

### 基本機能
- マシュマロの受信箱から質問を自動抽出
- YouTube Live Chatへの自動投稿
- 手動投稿モードの提供
- 質問キューの管理

---

## 📋 機能要件

### コア機能

#### マシュマロ連携
- **ログイン状態の検出**: マシュマロサイトのログイン状態を監視
- **質問の自動抽出**: 受信箱から新しい質問を定期的に取得
- **リアルタイム監視**: DOM変更を監視してリアルタイムで質問を検出

#### YouTube連携
- **API認証**: YouTube Data API v3による認証
- **ライブ配信の検出**: 配信URLからliveChatIdを取得
- **メッセージ投稿**: Live Chat APIによるメッセージ送信

#### 質問キュー管理
- **ステータス管理**: pending → next → sent → skipped
- **順序制御**: 受信日時順（古い順）での自動送信
- **手動制御**: ユーザーによる質問選択と手動送信

### ユーザーインターフェース

#### ポップアップUI
- **配信URL設定**: YouTube Live URLの入力と検証
- **実行制御**: 開始/停止ボタン
- **モード切替**: 自動モード/手動モード
- **ステータス表示**: 接続状況とマシュマロ状態

#### キュー表示
- **質問一覧**: 受信質問の表示（古い順）
- **ステータス表示**: 各質問の現在状態
- **操作ボタン**: 手動送信・削除・NEXT設定
- **視覚的フィードバック**: NEXTステータスの青枠表示

---

## ⚡ 非機能要件

### パフォーマンス
- **応答性**: UI操作への1秒以内の応答
- **効率性**: 30秒間隔での軽量なポーリング
- **メモリ使用量**: 10MB以下での動作

### 信頼性
- **エラー処理**: Extension Context無効化への対応
- **データ保護**: 質問データの永続化
- **自動復旧**: 一時的なネットワーク障害からの回復

### セキュリティ
- **データサニタイズ**: XSS防止のテキスト処理
- **認証管理**: OAuth tokenの安全な管理
- **プライバシー**: 質問内容の適切な暗号化

### 保守性 (V2.0 新要件)
- **コード品質**: 150行以下のシンプルな構造
- **モジュール化**: 責任の明確な分離
- **テスタビリティ**: 単体テスト可能な設計

---

## 🏗️ 技術仕様

### プラットフォーム
- **Chrome拡張**: Manifest V3準拠
- **JavaScript**: ES2020+の標準機能のみ使用
- **API**: YouTube Data API v3

### アーキテクチャ (V2.0 更新)
```
├── MarshmallowContentScript (クラス)
│   ├── constructor()
│   ├── safeExecute()
│   ├── start()
│   ├── cleanup()
│   ├── extractMessages()
│   └── sendToBackground()
├── Background Service Worker
├── Popup Interface
└── Settings Manager
```

### データ構造
```javascript
// 質問オブジェクト
{
  id: string,           // 一意識別子
  text: string,         // 質問本文
  received_at: string,  // 受信日時 (ISO 8601)
  status: string,       // pending|next|sent|skipped
  sent_at: string,      // 送信日時（送信済みの場合）
  skipped_reason: string // スキップ理由（該当時）
}
```

---

## 📊 成功基準

### 機能基準
- マシュマロからの質問抽出成功率: 95%以上
- YouTube Live Chatへの投稿成功率: 90%以上
- 質問の順序保持: 100%

### 品質基準 (V2.0 新基準)
- **コード品質**: 複雑度メトリクス50%改善
- **保守性**: 新機能追加時間50%短縮
- **信頼性**: Extension Context エラー0件
- **メモリ効率**: メモリリーク24時間連続動作で検出されない

### ユーザビリティ基準
- 初回設定完了時間: 5分以内
- 操作ミス率: 5%以下
- ユーザー満足度: 80%以上

---

## 📅 リリース計画 V2.0

### Phase 1: リファクタリング実施
- [ ] content_script.jsの全面書き直し
- [ ] エラーハンドリングの統一
- [ ] コード品質の向上

### Phase 2: 機能検証
- [ ] 既存機能の動作確認
- [ ] パフォーマンステスト
- [ ] 新設計の妥当性検証

### Phase 3: 最終調整
- [ ] ユーザビリティテスト
- [ ] ドキュメント更新
- [ ] リリース準備

---

## 📈 変更履歴

- **2025-01-13**: V2.0 リファクタリング版要件定義作成
- **2025-07-10**: V1.3 マシュマロ未ログイン時のアナウンス要件追加
- **2025-07-10**: V1.2 CORS対応とService Worker永続化対応
- **2025-07-10**: V1.1 OAuth設定とアーキテクチャ定義

---

**注意**: この要件定義書は既存機能を維持しながら、コードの複雑性を大幅に削減することを目的としています。