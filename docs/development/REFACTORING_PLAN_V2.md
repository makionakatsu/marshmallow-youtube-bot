# Marshmallow to YouTube Bot - リファクタリング計画 V2.0

**策定日:** 2025年1月13日  
**対象:** content_script.js (433行 → 300行, 30%削減)  
**目標:** メンテナンス性向上とAI可読性向上

---

## 🎯 リファクタリング方針

### 基本原則
1. **単一責任の原則**: 各クラスは1つの明確な責任を持つ
2. **AI可読性優先**: 自然言語に近いメソッド名とコメント
3. **依存性の明確化**: クラス間の依存関係を最小化
4. **段階的移行**: 既存機能を維持しながら段階的にリファクタリング

### 設計目標
- **コード品質**: 循環的複雑度50%削減
- **保守性**: 機能追加時の影響範囲を1クラスに限定
- **テスタビリティ**: 各クラスが独立してテスト可能
- **AI理解**: 設計意図がGPTモデルに伝わりやすい構造

---

## 🏗️ 新アーキテクチャ設計

### 全体構成図
```
ContentScriptApplication (オーケストレーター)
├── ExtensionContextManager     (Extension生存管理)
├── MarshmallowPageInteractor   (マシュマロサイト連携)
├── BackgroundCommunicator      (Background Script通信)
├── DOMWatcher                  (DOM変更監視)
└── PollingManager              (定期実行制御)
```

### クラス設計詳細

#### 1. ExtensionContextManager
```javascript
/**
 * Chrome Extension コンテキストの生存管理を担当
 * 
 * 【責任】
 * - Extension コンテキストの有効性監視
 * - 無効化時の全システムの安全なシャットダウン
 * - グローバル状態の一元管理
 * 
 * 【AI可読性のポイント】
 * - isAlive(), shutdown() など直感的なメソッド名
 * - 状態変更時のイベント通知機能
 */
class ExtensionContextManager {
  constructor() {
    this.isContextValid = true;
    this.shutdownInProgress = false;
    this.observers = []; // 状態変更通知先
  }

  /**
   * Extension コンテキストが生きているかチェック
   * @returns {boolean} コンテキストが有効かどうか
   */
  isAlive() { }

  /**
   * 全システムの安全なシャットダウン実行
   */
  initiateShutdown() { }

  /**
   * 状態変更を他のクラスに通知
   * @param {Object} observer 通知先オブジェクト
   */
  addObserver(observer) { }
}
```

#### 2. MarshmallowPageInteractor
```javascript
/**
 * マシュマロサイトとの相互作用を担当
 * 
 * 【責任】
 * - ログイン状態の検出
 * - 新しい質問メッセージの抽出
 * - DOM要素の検索とパース
 * 
 * 【AI可読性のポイント】
 * - getUserLoginStatus(), extractNewMessages() など目的が明確
 * - DOMセレクターを定数として外部化
 */
class MarshmallowPageInteractor {
  constructor() {
    this.selectors = {
      MESSAGE_LIST: '.js-messageList',
      LOGIN_INDICATOR: '.js-user-menu',
      MESSAGE_ITEM: '.js-messageItem'
    };
  }

  /**
   * ユーザーのログイン状態を確認
   * @returns {boolean} ログインしているかどうか
   */
  getUserLoginStatus() { }

  /**
   * ページから新しい質問メッセージを抽出
   * @returns {Array<Object>} 抽出された質問オブジェクトの配列
   */
  extractNewMessages() { }

  /**
   * DOM要素から質問テキストを安全に抽出
   * @param {Element} messageElement 質問要素
   * @returns {Object|null} 質問オブジェクト
   */
  parseMessageElement(messageElement) { }
}
```

#### 3. BackgroundCommunicator
```javascript
/**
 * Background Script との通信を担当
 * 
 * 【責任】
 * - Background Script への安全なメッセージ送信
 * - 通信エラーの統一的な処理
 * - レスポンスの解析と結果の通知
 * 
 * 【AI可読性のポイント】
 * - sendMessageSafely(), handleCommunicationError() など意図が明確
 * - エラー種別ごとの専用処理メソッド
 */
class BackgroundCommunicator {
  constructor(extensionContextManager) {
    this.contextManager = extensionContextManager;
    this.maxRetries = 3;
  }

  /**
   * Background Script にメッセージを安全に送信
   * @param {Object} message 送信するメッセージ
   * @returns {Promise<Object>} レスポンスオブジェクト
   */
  async sendMessageSafely(message) { }

  /**
   * 通信エラーを種別に応じて処理
   * @param {Error} error エラーオブジェクト
   * @param {string} context エラー発生コンテキスト
   */
  handleCommunicationError(error, context) { }

  /**
   * Extension context 無効化エラーの特別処理
   */
  handleExtensionContextInvalidated() { }
}
```

#### 4. DOMWatcher
```javascript
/**
 * DOM変更の監視を担当
 * 
 * 【責任】
 * - MutationObserver の設定と管理
 * - 監視対象要素の検索と監視開始
 * - ページライフサイクルイベントの処理
 * 
 * 【AI可読性のポイント】
 * - startWatching(), stopWatching() など動作が明確
 * - コールバック関数の設定をメソッドで分離
 */
class DOMWatcher {
  constructor(onDOMChange) {
    this.observer = null;
    this.onChangeCallback = onDOMChange;
    this.targetSelectors = ['.js-messageList'];
  }

  /**
   * DOM監視を開始
   * @param {Array<string>} selectors 監視対象のCSSセレクター
   */
  startWatching(selectors = this.targetSelectors) { }

  /**
   * DOM監視を停止
   */
  stopWatching() { }

  /**
   * 監視対象要素を検索して監視を再開
   */
  reconnectObserver() { }

  /**
   * ページの可視性変更時の処理
   */
  handleVisibilityChange() { }
}
```

#### 5. PollingManager
```javascript
/**
 * 定期実行処理を担当
 * 
 * 【責任】
 * - 設定されたインターバルでの定期実行
 * - Chrome Storage からの設定読み込み
 * - タイマーのライフサイクル管理
 * 
 * 【AI可読性のポイント】
 * - startPolling(), stopPolling() など操作が自明
 * - 設定変更時の動的なインターバル調整
 */
class PollingManager {
  constructor(pollCallback) {
    this.pollCallback = pollCallback;
    this.intervalId = null;
    this.defaultInterval = 30000; // 30秒
  }

  /**
   * 定期実行を開始
   * @param {number} intervalMs 実行間隔（ミリ秒）
   */
  startPolling(intervalMs = this.defaultInterval) { }

  /**
   * 定期実行を停止
   */
  stopPolling() { }

  /**
   * Chrome Storage から設定を読み込んでインターバル調整
   */
  async updateIntervalFromSettings() { }

  /**
   * 設定変更を監視して自動でインターバル更新
   */
  watchSettingsChanges() { }
}
```

#### 6. ContentScriptApplication
```javascript
/**
 * 全体の調整と初期化を担当するオーケストレーター
 * 
 * 【責任】
 * - 各クラスのインスタンス化と依存性注入
 * - アプリケーション全体の初期化フロー
 * - エラー発生時の全体調整
 * 
 * 【AI可読性のポイント】
 * - initialize(), start(), shutdown() でライフサイクルが明確
 * - 各機能クラスとの連携ロジックをメソッドで分離
 */
class ContentScriptApplication {
  constructor() {
    this.contextManager = null;
    this.pageInteractor = null;
    this.communicator = null;
    this.domWatcher = null;
    this.pollingManager = null;
  }

  /**
   * アプリケーション全体を初期化
   */
  async initialize() { }

  /**
   * 全機能を開始
   */
  start() { }

  /**
   * 全機能を安全に停止
   */
  shutdown() { }

  /**
   * 定期実行時の処理フロー（ポーリング + DOM監視の共通処理）
   */
  async executeMainFlow() { }
}
```

---

## 📋 段階的リファクタリング計画

### Phase 1: 基盤クラスの実装 (3-4日)

#### Day 1: ExtensionContextManager + BackgroundCommunicator
```javascript
// 目標: Extension Context管理の一元化
- ExtensionContextManager の実装
- BackgroundCommunicator の基本機能実装
- 既存のエラーハンドリングロジックを統合
```

#### Day 2: MarshmallowPageInteractor
```javascript
// 目標: DOM操作とマシュマロサイト連携の分離
- MarshmallowPageInteractor の実装
- DOM要素検索とパースロジックの移行
- DOMセレクターの定数化
```

#### Day 3: DOMWatcher + PollingManager
```javascript
// 目標: 監視システムの分離
- DOMWatcher の実装
- PollingManager の実装
- MutationObserver とタイマー管理の統合
```

#### Day 4: ContentScriptApplication
```javascript
// 目標: オーケストレーターの実装
- ContentScriptApplication の実装
- 各クラスの依存性注入設定
- 既存機能との互換性確認
```

### Phase 2: 段階的移行とテスト (2-3日)

#### Day 5-6: 既存コードから新アーキテクチャへの移行
```javascript
// 目標: 機能ごとの段階的移行
1. ExtensionContextManager を先行導入
2. MarshmallowPageInteractor の機能を段階的に移行
3. BackgroundCommunicator で通信部分を置換
4. DOMWatcher + PollingManager でイベント処理を統合
```

#### Day 7: 統合テストと品質確認
```javascript
// 目標: リファクタリング後の品質検証
1. 既存機能の動作確認
2. エラーハンドリングの検証
3. メモリリーク検査
4. パフォーマンス測定
```

### Phase 3: 品質向上と最適化 (1-2日)

#### Day 8: AI可読性とドキュメント向上
```javascript
// 目標: 将来の AI による理解と改修の容易性向上
1. JSDoc コメントの充実
2. README の更新
3. 設計意図のドキュメント化
4. 使用例とサンプルコードの作成
```

---

## 📊 品質目標と成功指標

### 量的目標
| 項目 | 現在 | 目標 | 改善率 |
|------|------|------|--------|
| **総行数** | 433行 | 300-320行 | 30% |
| **クラス数** | 0個 | 6個 | - |
| **重複エラーハンドリング** | 7箇所 | 1箇所 | 85% |
| **グローバル変数** | 8個 | 2個 | 75% |
| **JSDocコメント率** | 0% | 90%以上 | - |

### 質的目標
1. **単一責任**: 各クラスが1つの明確な責任を持つ
2. **依存性管理**: クラス間の依存関係が constructor で明示される
3. **テスタビリティ**: 各クラスが独立してモックテスト可能
4. **AI可読性**: GPT-4が設計意図を80%以上理解できる
5. **保守性**: 新機能追加時の影響範囲を1クラスに限定

### 技術的指標
- **循環的複雑度**: 平均5以下（現在: 10-15）
- **メソッド長**: 最大30行（現在: 最大100行）
- **ネストレベル**: 最大3レベル（現在: 最大6レベル）
- **ESLint準拠率**: 100%（新規追加）
- **TypeScript対応度**: JSDoc型注釈95%以上

### AI可読性指標
| 指標 | 測定方法 | 目標値 |
|------|----------|--------|
| **命名の明確性** | 英語として自然に読めるか | 95%以上 |
| **設計意図の記述** | 「なぜ」が記載されているか | 90%以上 |
| **例外処理の説明** | エラー原因と対処法が明記されているか | 100% |
| **関係性の明示** | クラス間の依存関係が説明されているか | 100% |
| **テスト設計の示唆** | モック方法が推測できるか | 80%以上 |

### パフォーマンス指標
| 項目 | 現在 | 目標 | 備考 |
|------|------|------|------|
| **初期化時間** | 測定予定 | 100ms以下 | クラス化によるオーバーヘッド管理 |
| **メモリ使用量** | 測定予定 | 現在+20%以下 | クラスインスタンス化のコスト |
| **DOM操作頻度** | 測定予定 | 現在-30% | 効率的な監視による改善 |
| **エラー発生率** | 測定予定 | 現在-50% | 統一的エラーハンドリング効果 |

---

## 🛡️ リスク管理

### 主要リスク
1. **既存機能の破綻**: 段階的移行で最小化
2. **パフォーマンス劣化**: クラス化によるオーバーヘッド
3. **拡張機能の複雑化**: 責任分散による理解の困難

### 対策
1. **バックアップ戦略**: 既存 content_script.js を保持
2. **段階的検証**: 各 Phase で動作確認
3. **ロールバック計画**: 問題発生時の復旧手順を策定

---

## 🎯 次のアクション

1. **Phase 1 Day 1 の開始**: ExtensionContextManager の実装
2. **開発環境の準備**: テスト用の Chrome 拡張機能設定
3. **ベンチマーク取得**: リファクタリング前のパフォーマンス測定

このリファクタリング計画により、保守性とAI可読性が大幅に向上し、将来の機能追加や修正が容易になることを目指します。