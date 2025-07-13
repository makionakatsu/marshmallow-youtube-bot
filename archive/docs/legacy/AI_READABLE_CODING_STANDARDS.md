# AI可読性向上のためのコーディング規約

**策定日:** 2025年1月13日  
**対象:** Marshmallow to YouTube Bot リファクタリングプロジェクト  
**目的:** 将来のAIによる理解・解析・修正を容易にする

---

## 🤖 AI可読性の基本方針

### 設計思想
1. **自然言語に近い命名**: メソッド名や変数名が英語として自然に読める
2. **明示的な意図表現**: コードを読んだだけで「何をしているか」「なぜそうしているか」が分かる
3. **構造的な文書化**: AIが文脈を理解しやすいコメント構造
4. **パターンの一貫性**: 同じ目的のコードは同じパターンで記述

### AI理解促進のための原則
- **因果関係の明示**: 処理の前後関係や依存関係を明確に記述
- **例外処理の文脈化**: なぜその例外が発生するかの背景を記載
- **設計判断の記録**: なぜそのような実装を選択したかの理由を残す

---

## 📝 JSDocコメント規約

### 基本テンプレート
```javascript
/**
 * [一行で機能概要を記述]
 * 
 * [詳細説明（複数行可）]
 * 
 * 【AI理解のためのポイント】
 * - [このメソッドが解決する問題]
 * - [他のメソッドとの関係性]
 * - [注意すべき副作用や制約]
 * 
 * @param {型} パラメータ名 - パラメータの説明
 * @returns {型} 戻り値の説明
 * @throws {Error} エラーの条件と対処法
 * 
 * @example
 * // 実際の使用例
 * const result = methodName(param);
 */
```

### クラス設計用テンプレート
```javascript
/**
 * [クラスの役割と責任を1行で]
 * 
 * [このクラスが存在する理由と、システム全体での位置づけ]
 * 
 * 【設計意図】
 * - [なぜこのクラスが必要なのか]
 * - [他のクラスとの連携方法]
 * - [将来的な拡張の可能性]
 * 
 * 【AI理解のためのポイント】
 * - [このクラスが管理する状態]
 * - [外部からの依存関係]
 * - [ライフサイクルイベント]
 * 
 * @since バージョン2.0
 * @author Claude Code AI
 */
class ClassName {
```

---

## 🏗️ クラス設計規約

### クラス命名規則
```javascript
// ✅ 良い例: 役割が明確
class ExtensionContextManager
class MarshmallowPageInteractor
class BackgroundCommunicator

// ❌ 悪い例: 抽象的すぎる
class Helper
class Manager
class Utils
```

### メソッド命名規則
```javascript
// ✅ 良い例: 動詞+目的語の形で自然な英語
getUserLoginStatus()        // ユーザーのログイン状態を取得
extractNewMessages()        // 新しいメッセージを抽出
sendMessageSafely()         // メッセージを安全に送信
initiateShutdown()          // シャットダウンを開始

// ❌ 悪い例: 意図が不明確
check()
process()
handle()
run()
```

### 状態管理の明示化
```javascript
class ExtensionContextManager {
  constructor() {
    /**
     * Extension コンテキストの生存状態
     * @type {boolean}
     * @description Chrome Extension が有効かどうかを示す
     * false になった場合は全機能を停止する必要がある
     */
    this.isContextValid = true;
    
    /**
     * シャットダウン処理の進行状態
     * @type {boolean}
     * @description 重複したシャットダウンを防ぐためのフラグ
     */
    this.shutdownInProgress = false;
  }
}
```

---

## 🔄 エラーハンドリング規約

### エラー文脈の明示化
```javascript
/**
 * Chrome Extension コンテキストが無効化された際のエラーハンドリング
 * 
 * 【発生条件】
 * - 拡張機能がアップデートされた時
 * - 拡張機能が無効化された時
 * - ブラウザが再起動された時
 * 
 * 【対処方針】
 * - 全てのタイマーとObserverを停止
 * - 他のクラスにシャットダウンを通知
 * - グレースフルシャットダウンを実行
 */
handleExtensionContextInvalidated() {
  if (this.shutdownInProgress) {
    return; // 既にシャットダウン中の場合は何もしない
  }
  
  console.warn('Extension context invalidated. Starting graceful shutdown...');
  this.initiateShutdown();
}
```

### エラー種別の体系化
```javascript
/**
 * エラーの種類と対処法を体系的に定義
 */
const ErrorTypes = {
  EXTENSION_CONTEXT_INVALID: {
    name: 'EXTENSION_CONTEXT_INVALID',
    description: 'Chrome Extension コンテキストが無効化された',
    action: 'graceful_shutdown',
    recoverable: false
  },
  
  NETWORK_ERROR: {
    name: 'NETWORK_ERROR', 
    description: 'ネットワーク通信でエラーが発生した',
    action: 'retry_with_backoff',
    recoverable: true
  },
  
  DOM_NOT_FOUND: {
    name: 'DOM_NOT_FOUND',
    description: '期待するDOM要素が見つからない',
    action: 'wait_and_retry',
    recoverable: true
  }
};
```

---

## 📚 ドキュメント構造規約

### ファイル先頭のメタ情報
```javascript
/**
 * @fileoverview マシュマロサイトとの相互作用を担当するクラス
 * 
 * このファイルは Marshmallow to YouTube Bot の content_script.js から
 * マシュマロサイト連携機能を分離したものです。
 * 
 * 【主な機能】
 * - ユーザーのログイン状態検出
 * - 新着質問メッセージの抽出
 * - DOM要素の安全な検索とパース
 * 
 * 【依存関係】
 * - ExtensionContextManager (Extension生存状態)
 * - DOM API (マシュマロサイトのDOM構造)
 * 
 * @version 2.0
 * @since 2025-01-13
 * @author Claude Code AI
 */
```

### モジュール間の関係性記述
```javascript
/**
 * 他のクラスとの連携方法
 * 
 * 【ExtensionContextManager との関係】
 * - Extension無効化時に通知を受け取る
 * - DOM操作前に必ず生存状態をチェック
 * 
 * 【BackgroundCommunicator との関係】
 * - 抽出した質問データを Background Script に送信
 * - 送信エラー時の再試行は BackgroundCommunicator に委譲
 * 
 * 【DOMWatcher との関係】
 * - DOM変更検知時にメッセージ抽出を実行
 * - 抽出対象のDOMセレクターを提供
 */
```

---

## 🧪 テスタビリティ向上規約

### テスト可能な設計
```javascript
class MarshmallowPageInteractor {
  constructor(domSearcher = document) {
    /**
     * DOM操作を外部から注入可能にすることで、
     * テスト時にモックオブジェクトを使用できる
     */
    this.domSearcher = domSearcher;
  }
  
  /**
   * テスト時のモック注入を想定した設計
   * 
   * @example テスト用のモック注入
   * const mockDom = {
   *   querySelector: jest.fn(),
   *   querySelectorAll: jest.fn()
   * };
   * const interactor = new MarshmallowPageInteractor(mockDom);
   */
  extractNewMessages() {
    const messageList = this.domSearcher.querySelector('.js-messageList');
    // ...
  }
}
```

### 副作用の分離
```javascript
/**
 * 純粋関数として設計し、副作用を分離
 * これにより AI がテストケースを理解・生成しやすくなる
 */
class MessageParser {
  /**
   * DOM要素から質問オブジェクトを抽出（純粋関数）
   * 
   * 【AI理解のためのポイント】
   * - 入力: DOM要素
   * - 出力: 質問オブジェクト
   * - 副作用: なし（DOM操作やAPI呼び出しを含まない）
   * 
   * @param {Element} messageElement メッセージのDOM要素
   * @returns {Object|null} 質問オブジェクト
   */
  static parseMessageElement(messageElement) {
    if (!messageElement) return null;
    
    // 純粋な変換処理のみ
    return {
      id: this.extractId(messageElement),
      text: this.extractText(messageElement),
      receivedAt: this.extractTimestamp(messageElement)
    };
  }
}
```

---

## 🔍 AI支援開発のための補助情報

### デバッグ支援情報
```javascript
/**
 * AI がバグ修正時に参考にできる情報を含める
 */
class DOMWatcher {
  startWatching() {
    /**
     * 【デバッグ情報】
     * - よくある失敗パターン: 監視対象要素が見つからない
     * - 確認方法: console.log で targetElement の存在をチェック
     * - 復旧方法: reconnectObserver() を呼び出して再接続
     */
    const targetElement = document.querySelector('.js-messageList');
    
    if (!targetElement) {
      console.warn('DOMWatcher: Target element not found. Will retry in 5 seconds.');
      setTimeout(() => this.reconnectObserver(), 5000);
      return;
    }
    
    // Observer設定...
  }
}
```

### 設計判断の記録
```javascript
/**
 * なぜその実装を選択したかを記録
 * AI が将来的に改修判断をする際の参考情報
 */
class PollingManager {
  constructor(pollCallback) {
    /**
     * 【設計判断】setInterval ではなく setTimeout の再帰を使用
     * 
     * 理由:
     * - setInterval は処理時間が間隔を超えた場合に重複実行のリスクがある
     * - setTimeout の再帰なら前の処理完了を待ってから次の実行を予約できる
     * - Chrome Extension の場合、DOM操作やAPI通信で処理時間が不安定
     * 
     * 参考: https://javascript.info/settimeout-setinterval
     */
    this.scheduleNextPoll = () => {
      this.timeoutId = setTimeout(() => {
        this.pollCallback();
        this.scheduleNextPoll(); // 処理完了後に次回を予約
      }, this.interval);
    };
  }
}
```

---

## 📊 コード品質指標

### AI可読性チェックリスト
- [ ] クラス名から責任が推測できる
- [ ] メソッド名が自然な英語として読める
- [ ] 複雑な処理に理由と文脈が記載されている
- [ ] エラー処理に発生条件と対処法が明記されている
- [ ] 他のクラスとの関係性が説明されている
- [ ] テスト時のモック方法が想像できる

### 定期チェック項目
```javascript
// コード品質を定期的にチェックするための自動化
const QualityChecks = {
  // メソッド長: 30行以下
  maxMethodLength: 30,
  
  // ネストレベル: 3以下
  maxNestLevel: 3,
  
  // JSDocコメント: public メソッドは必須
  requireJSDoc: true,
  
  // 命名規則: 動詞+名詞の組み合わせ
  methodNamingPattern: /^[a-z]+[A-Z][a-z]+.*$/
};
```

この規約に従ってリファクタリングを進めることで、将来のAIによる理解・修正・拡張が容易になります。