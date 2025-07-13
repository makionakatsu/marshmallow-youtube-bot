// content_script_v2.js - リファクタリング版
// Phase 1 Day 1: ExtensionContextManager + BackgroundCommunicator

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
  isAlive() {
    try {
      // より厳密なチェック
      if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
        return false;
      }
      // runtime.id が存在するかチェック
      if (!chrome.runtime.id) {
        return false;
      }
      return this.isContextValid;
    } catch (error) {
      console.warn('Extension context check failed:', error.message);
      this.isContextValid = false;
      return false;
    }
  }

  /**
   * 全システムの安全なシャットダウン実行
   */
  initiateShutdown() {
    if (this.shutdownInProgress) {
      return; // 既にシャットダウン処理中
    }
    
    this.shutdownInProgress = true;
    this.isContextValid = false;
    console.warn('Extension context invalidated. Initiating graceful shutdown.');
    
    // 登録されたオブザーバーに通知
    this.notifyObservers('shutdown');
    
    console.log('Extension context manager shutdown complete.');
  }

  /**
   * 状態変更を他のクラスに通知
   * @param {Object} observer 通知先オブジェクト
   */
  addObserver(observer) {
    if (observer && typeof observer.onContextChange === 'function') {
      this.observers.push(observer);
    }
  }

  /**
   * 登録されたオブザーバーに状態変更を通知
   * @private
   * @param {string} eventType イベントタイプ
   */
  notifyObservers(eventType) {
    this.observers.forEach(observer => {
      try {
        observer.onContextChange(eventType);
      } catch (error) {
        console.warn('Error notifying observer:', error.message);
      }
    });
  }

  /**
   * 定期的なコンテキスト有効性チェック
   */
  startHealthCheck() {
    const checkInterval = setInterval(() => {
      if (!this.isAlive()) {
        clearInterval(checkInterval);
        this.initiateShutdown();
      }
    }, 5000); // 5秒間隔でチェック

    return checkInterval;
  }
}

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
    this.retryDelay = 1000; // 1秒
  }

  /**
   * Background Script にメッセージを安全に送信
   * @param {Object} message 送信するメッセージ
   * @returns {Promise<Object>} レスポンスオブジェクト
   */
  async sendMessageSafely(message) {
    if (!this.contextManager.isAlive()) {
      throw new Error('Extension context is not valid');
    }

    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        });

        return response;
      } catch (error) {
        lastError = error;
        console.warn(`Send message attempt ${attempt} failed:`, error.message);

        // Extension context無効化エラーの場合は即座に処理
        if (this.isExtensionContextError(error)) {
          this.handleExtensionContextInvalidated();
          throw error;
        }

        // 最後の試行でない場合は待機してリトライ
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    // 全ての試行が失敗した場合
    this.handleCommunicationError(lastError, 'sendMessageSafely');
    throw lastError;
  }

  /**
   * 通信エラーを種別に応じて処理
   * @param {Error} error エラーオブジェクト
   * @param {string} context エラー発生コンテキスト
   */
  handleCommunicationError(error, context) {
    console.error(`Communication error in ${context}:`, error.message);

    if (this.isExtensionContextError(error)) {
      this.handleExtensionContextInvalidated();
    } else if (this.isNetworkError(error)) {
      console.warn('Network error detected, continuing operation');
    } else {
      console.warn('Unknown communication error, continuing operation');
    }
  }

  /**
   * Extension context 無効化エラーの特別処理
   */
  handleExtensionContextInvalidated() {
    console.warn('Extension context invalidated during communication');
    this.contextManager.initiateShutdown();
  }

  /**
   * Extension context関連のエラーかチェック
   * @private
   * @param {Error} error エラーオブジェクト
   * @returns {boolean} Extension contextエラーかどうか
   */
  isExtensionContextError(error) {
    const message = error.message.toLowerCase();
    return message.includes('extension context invalidated') ||
           message.includes('message port closed') ||
           message.includes('receiving end does not exist');
  }

  /**
   * ネットワーク関連のエラーかチェック
   * @private
   * @param {Error} error エラーオブジェクト
   * @returns {boolean} ネットワークエラーかどうか
   */
  isNetworkError(error) {
    const message = error.message.toLowerCase();
    return message.includes('network') ||
           message.includes('timeout') ||
           message.includes('connection');
  }

  /**
   * 指定時間待機するユーティリティ
   * @private
   * @param {number} ms 待機時間（ミリ秒）
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Context変更イベントの処理（Observer パターン）
   * @param {string} eventType イベントタイプ
   */
  onContextChange(eventType) {
    if (eventType === 'shutdown') {
      console.log('BackgroundCommunicator received shutdown notification');
      // 必要に応じて通信のクリーンアップ処理を実行
    }
  }
}

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
      INBOX_COUNT: '#inbox-count',
      MESSAGE_LIST: 'ul#messages > li.message',
      MESSAGE_TEXT: 'div[data-outview-target="searchable"] a[data-obscene-word-target="content"]',
      TIME_SELECTORS: [
        'time',
        '[datetime]',
        '.time',
        '.date',
        '.timestamp',
        '[data-time]',
        'span[title*="日"]',
        'span[title*="時"]'
      ]
    };
    this.lastExtractedMessages = [];
  }

  /**
   * ユーザーのログイン状態を確認
   * @returns {boolean} ログインしているかどうか
   */
  getUserLoginStatus() {
    try {
      // #inbox-count 要素の存在でログイン状態と受信箱ページにいることを判断
      const isLoggedIn = document.querySelector(this.selectors.INBOX_COUNT) !== null;
      return isLoggedIn;
    } catch (error) {
      console.warn('Error checking login status:', error.message);
      return false;
    }
  }

  /**
   * ページから新しい質問メッセージを抽出
   * @returns {Array<Object>} 抽出された質問オブジェクトの配列
   */
  extractNewMessages() {
    try {
      const messages = [];
      const messageElements = document.querySelectorAll(this.selectors.MESSAGE_LIST);

      messageElements.forEach((element, index) => {
        const messageData = this.parseMessageElement(element, index);
        if (messageData) {
          messages.push(messageData);
        }
      });

      return messages;
    } catch (error) {
      console.warn('Error extracting messages:', error.message);
      return [];
    }
  }

  /**
   * DOM要素から質問テキストを安全に抽出
   * @param {Element} messageElement 質問要素
   * @param {number} index DOM内での順序
   * @returns {Object|null} 質問オブジェクト
   */
  parseMessageElement(messageElement, index) {
    try {
      // メッセージIDの抽出 (id="message_UUID" から UUID を取得)
      const id = messageElement.id ? messageElement.id.replace('message_', '') : null;
      
      // 質問本文の抽出
      const textElement = messageElement.querySelector(this.selectors.MESSAGE_TEXT);
      const text = textElement ? textElement.textContent.trim() : '';
      
      // 受信日時の抽出
      const receivedAt = this.extractTimestamp(messageElement, index);

      if (id && text) {
        return {
          id: id,
          text: text,
          received_at: receivedAt
        };
      }

      return null;
    } catch (error) {
      console.warn('Error parsing message element:', error.message);
      return null;
    }
  }

  /**
   * メッセージ要素からタイムスタンプを抽出
   * @private
   * @param {Element} messageElement メッセージ要素
   * @param {number} index DOM内での順序
   * @returns {string} ISO形式のタイムスタンプ
   */
  extractTimestamp(messageElement, index) {
    // 複数の可能な日時要素をチェック
    for (const selector of this.selectors.TIME_SELECTORS) {
      const timeElement = messageElement.querySelector(selector);
      if (timeElement) {
        // datetime 属性をチェック
        const datetimeAttr = timeElement.getAttribute('datetime');
        if (datetimeAttr) {
          return new Date(datetimeAttr).toISOString();
        }
        
        // title 属性をチェック
        const titleAttr = timeElement.getAttribute('title');
        if (titleAttr) {
          const parsedDate = new Date(titleAttr);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        }
        
        // テキストコンテンツをチェック
        const timeText = timeElement.textContent.trim();
        if (timeText) {
          const parsedDate = new Date(timeText);
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
          }
        }
      }
    }
    
    // 日時が取得できない場合は、DOM内の順序を基にした疑似時刻を使用
    const baseTime = new Date();
    // index 0 = 最新、index n = 最古として時刻を設定
    baseTime.setMinutes(baseTime.getMinutes() - (index * 10)); // 10分間隔で設定
    const pseudoTimestamp = baseTime.toISOString();
    console.log(`No timestamp found for message (index: ${index}). Using pseudo-timestamp: ${pseudoTimestamp}`);
    return pseudoTimestamp;
  }

  /**
   * メッセージの変更を検出
   * @param {Array<Object>} currentMessages 現在のメッセージリスト
   * @returns {boolean} メッセージに変更があったかどうか
   */
  hasMessagesChanged(currentMessages) {
    const currentMessageIds = currentMessages.map(msg => msg.id);
    const lastMessageIds = this.lastExtractedMessages.map(msg => msg.id);

    // 新しいメッセージが追加されたか、既存のメッセージが削除されたかをチェック
    const newMessagesAdded = currentMessageIds.some(id => !lastMessageIds.includes(id));
    const oldMessagesRemoved = lastMessageIds.some(id => !currentMessageIds.includes(id));

    return newMessagesAdded || oldMessagesRemoved;
  }

  /**
   * 最後に抽出したメッセージを更新
   * @param {Array<Object>} messages メッセージリスト
   */
  updateLastExtractedMessages(messages) {
    this.lastExtractedMessages = [...messages];
  }

  /**
   * Context変更イベントの処理（Observer パターン）
   * @param {string} eventType イベントタイプ
   */
  onContextChange(eventType) {
    if (eventType === 'shutdown') {
      console.log('MarshmallowPageInteractor received shutdown notification');
      this.lastExtractedMessages = [];
    }
  }
}

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
    this.targetNode = null;
    this.isWatching = false;
    this.targetSelectors = [
      'ul#messages',           // 元の想定
      '#messages',             // ID直接
      '.messages',             // クラス
      '[data-messages]',       // data属性
      'main',                  // メインコンテンツ
      '.inbox-container',      // 受信箱コンテナ
      '.message-list'          // メッセージリスト
    ];
  }

  /**
   * DOM監視を開始
   * @param {Array<string>} selectors 監視対象のCSSセレクター
   */
  startWatching(selectors = this.targetSelectors) {
    if (this.isWatching) {
      console.log('DOM watching is already active');
      return;
    }

    this.targetNode = this.findTargetNode(selectors);
    
    if (this.targetNode) {
      this.observer = new MutationObserver((mutationsList, observer) => {
        this.handleMutations(mutationsList);
      });
      
      this.observer.observe(this.targetNode, { 
        childList: true, 
        subtree: true 
      });
      
      this.isWatching = true;
      console.log('DOM watching started successfully');
    } else {
      console.warn('Target node for DOM watching not found');
      this.logAvailableElements();
    }
  }

  /**
   * DOM監視を停止
   */
  stopWatching() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isWatching = false;
    console.log('DOM watching stopped');
  }

  /**
   * 監視対象要素を検索
   * @private
   * @param {Array<string>} selectors セレクターリスト
   * @returns {Element|null} 見つかった要素
   */
  findTargetNode(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node) {
        console.log(`Found target node with selector: ${selector}`);
        return node;
      }
    }
    return null;
  }

  /**
   * MutationObserverのコールバック処理
   * @private
   * @param {Array<MutationRecord>} mutationsList 変更リスト
   */
  handleMutations(mutationsList) {
    try {
      if (this.onChangeCallback && typeof this.onChangeCallback === 'function') {
        this.onChangeCallback(mutationsList);
      }
    } catch (error) {
      console.warn('Error in DOM change callback:', error.message);
    }
  }

  /**
   * 監視対象要素を検索して監視を再開
   */
  reconnectObserver() {
    if (this.isWatching) {
      this.stopWatching();
    }
    this.startWatching();
  }

  /**
   * ページの可視性変更時の処理
   */
  handleVisibilityChange() {
    if (document.hidden) {
      this.stopWatching();
      console.log('DOM watching paused due to page being hidden');
    } else {
      // ページが再び表示された際に監視を再開
      if (!this.isWatching) {
        this.startWatching();
        console.log('DOM watching resumed due to page being visible');
      }
    }
  }

  /**
   * 利用可能な要素をログ出力（デバッグ用）
   * @private
   */
  logAvailableElements() {
    console.warn('Available IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
    console.warn('Available classes:', Array.from(document.querySelectorAll('[class]')).map(el => el.className));
  }

  /**
   * Context変更イベントの処理（Observer パターン）
   * @param {string} eventType イベントタイプ
   */
  onContextChange(eventType) {
    if (eventType === 'shutdown') {
      console.log('DOMWatcher received shutdown notification');
      this.stopWatching();
    }
  }
}

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
    this.isPolling = false;
  }

  /**
   * 定期実行を開始
   * @param {number} intervalMs 実行間隔（ミリ秒）
   */
  startPolling(intervalMs = this.defaultInterval) {
    if (this.isPolling) {
      console.log('Polling is already active');
      return;
    }

    this.intervalId = setInterval(() => {
      this.executePoll();
    }, intervalMs);

    this.isPolling = true;
    console.log(`Polling started with interval: ${intervalMs}ms`);
  }

  /**
   * 定期実行を停止
   */
  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isPolling = false;
    console.log('Polling stopped');
  }

  /**
   * ポーリング処理の実行
   * @private
   */
  executePoll() {
    try {
      if (this.pollCallback && typeof this.pollCallback === 'function') {
        this.pollCallback();
      }
    } catch (error) {
      console.warn('Error in polling callback:', error.message);
    }
  }

  /**
   * Chrome Storage から設定を読み込んでインターバル調整
   */
  async updateIntervalFromSettings() {
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(['pollingInterval'], resolve);
        });
        
        const customInterval = result.pollingInterval;
        if (customInterval && typeof customInterval === 'number' && customInterval > 0) {
          this.defaultInterval = customInterval;
          
          // 現在ポーリング中の場合は再起動
          if (this.isPolling) {
            this.stopPolling();
            this.startPolling(this.defaultInterval);
          }
          
          console.log(`Polling interval updated to: ${this.defaultInterval}ms`);
        }
      }
    } catch (error) {
      console.warn('Error updating polling interval from settings:', error.message);
    }
  }

  /**
   * 設定変更を監視して自動でインターバル更新
   */
  watchSettingsChanges() {
    try {
      if (chrome && chrome.storage && chrome.storage.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'local' && changes.pollingInterval) {
            this.updateIntervalFromSettings();
          }
        });
      }
    } catch (error) {
      console.warn('Error setting up settings watcher:', error.message);
    }
  }

  /**
   * Context変更イベントの処理（Observer パターン）
   * @param {string} eventType イベントタイプ
   */
  onContextChange(eventType) {
    if (eventType === 'shutdown') {
      console.log('PollingManager received shutdown notification');
      this.stopPolling();
    }
  }
}

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
    this.isInitialized = false;
    this.isRunning = false;
    this.lastLoginStatus = false;
  }

  /**
   * アプリケーション全体を初期化
   */
  async initialize() {
    try {
      console.log('Initializing Marshmallow Content Script Application V2...');

      // 1. ExtensionContextManager を最初に初期化
      this.contextManager = new ExtensionContextManager();
      
      if (!this.contextManager.isAlive()) {
        throw new Error('Extension context is not valid at startup');
      }

      // 2. 各機能クラスを初期化
      this.pageInteractor = new MarshmallowPageInteractor();
      this.communicator = new BackgroundCommunicator(this.contextManager);

      // 3. DOM監視とポーリングの設定
      this.domWatcher = new DOMWatcher((mutations) => {
        this.handleDOMChange(mutations);
      });

      this.pollingManager = new PollingManager(() => {
        this.handlePolling();
      });

      // 4. オブザーバーパターンでコンテキスト変更を監視
      this.contextManager.addObserver(this.communicator);
      this.contextManager.addObserver(this.pageInteractor);
      this.contextManager.addObserver(this.domWatcher);
      this.contextManager.addObserver(this.pollingManager);
      this.contextManager.addObserver(this);

      // 5. ページライフサイクルイベントの設定
      this.setupPageLifecycleHandlers();

      // 6. 設定の読み込み
      await this.pollingManager.updateIntervalFromSettings();
      this.pollingManager.watchSettingsChanges();

      this.isInitialized = true;
      console.log('Content script application initialized successfully');

    } catch (error) {
      console.error('Failed to initialize content script application:', error.message);
      this.shutdown();
      throw error;
    }
  }

  /**
   * 全機能を開始
   */
  start() {
    if (!this.isInitialized) {
      throw new Error('Application must be initialized before starting');
    }

    if (this.isRunning) {
      console.log('Application is already running');
      return;
    }

    try {
      console.log('Starting content script application...');

      // 初期状態の取得と送信
      this.lastLoginStatus = this.pageInteractor.getUserLoginStatus();
      this.executeMainFlow();

      // DOM監視の開始
      this.domWatcher.startWatching();

      // ポーリングの開始
      this.pollingManager.startPolling();

      // ヘルスチェックの開始
      this.contextManager.startHealthCheck();

      this.isRunning = true;
      console.log('Content script application started successfully');

    } catch (error) {
      console.error('Failed to start content script application:', error.message);
      this.shutdown();
    }
  }

  /**
   * 全機能を安全に停止
   */
  shutdown() {
    console.log('Shutting down content script application...');

    try {
      // 各コンポーネントの停止
      if (this.pollingManager) {
        this.pollingManager.stopPolling();
      }

      if (this.domWatcher) {
        this.domWatcher.stopWatching();
      }

      // 状態をリセット
      this.isRunning = false;
      this.isInitialized = false;

      console.log('Content script application shutdown complete');

    } catch (error) {
      console.warn('Error during shutdown:', error.message);
    }
  }

  /**
   * 定期実行時の処理フロー（ポーリング + DOM監視の共通処理）
   */
  async executeMainFlow() {
    try {
      // Extension context の有効性チェック
      if (!this.contextManager.isAlive()) {
        console.warn('Extension context invalid during main flow execution');
        return;
      }

      // ログイン状態の確認
      const currentLoginStatus = this.pageInteractor.getUserLoginStatus();
      
      // ログイン状態が変化した場合
      if (currentLoginStatus !== this.lastLoginStatus) {
        await this.communicator.sendMessageSafely({
          action: 'newMarshmallowMessages',
          messages: [],
          isLoggedIn: currentLoginStatus
        });
        this.lastLoginStatus = currentLoginStatus;
        console.log(`Login status changed to: ${currentLoginStatus}`);
      }

      // ログイン中の場合のみメッセージを処理
      if (currentLoginStatus) {
        await this.processMessages();
      }

    } catch (error) {
      console.warn('Error in main flow execution:', error.message);
      
      // Extension context エラーの場合はシャットダウン
      if (error.message.includes('Extension context')) {
        this.contextManager.initiateShutdown();
      }
    }
  }

  /**
   * メッセージの処理と送信
   * @private
   */
  async processMessages() {
    const currentMessages = this.pageInteractor.extractNewMessages();
    
    // メッセージに変更があった場合のみ送信
    if (this.pageInteractor.hasMessagesChanged(currentMessages)) {
      await this.communicator.sendMessageSafely({
        action: 'newMarshmallowMessages',
        messages: currentMessages,
        isLoggedIn: true
      });
      
      this.pageInteractor.updateLastExtractedMessages(currentMessages);
      console.log(`Sent ${currentMessages.length} messages to background`);
    }
  }

  /**
   * DOM変更時のハンドラー
   * @private
   * @param {Array<MutationRecord>} mutations 変更リスト
   */
  handleDOMChange(mutations) {
    if (!this.isRunning) return;
    
    console.log('DOM changed, executing main flow...');
    this.executeMainFlow();
  }

  /**
   * ポーリング時のハンドラー
   * @private
   */
  handlePolling() {
    if (!this.isRunning) return;
    
    console.log('Polling executed, executing main flow...');
    this.executeMainFlow();
  }

  /**
   * ページライフサイクルイベントの設定
   * @private
   */
  setupPageLifecycleHandlers() {
    // ページアンロード時のクリーンアップ
    window.addEventListener('beforeunload', () => {
      this.shutdown();
    });

    // ページの可視性変更時の処理
    document.addEventListener('visibilitychange', () => {
      if (this.domWatcher) {
        this.domWatcher.handleVisibilityChange();
      }
    });
  }

  /**
   * Context変更イベントの処理（Observer パターン）
   * @param {string} eventType イベントタイプ
   */
  onContextChange(eventType) {
    if (eventType === 'shutdown') {
      console.log('ContentScriptApplication received shutdown notification');
      this.shutdown();
    }
  }
}

// Phase 1 最終実装とテスト
if (typeof window !== 'undefined') {
  console.log('=== Marshmallow Content Script V2.0 ===');
  console.log('Phase 1 implementation complete. Testing full application...');

  // アプリケーションの初期化と起動
  const app = new ContentScriptApplication();
  
  // グローバルアクセス用
  window.marshmallowV2 = app;

  // 初期化と開始
  app.initialize().then(() => {
    console.log('Application initialized successfully');
    app.start();
    console.log('Application started successfully');
  }).catch(error => {
    console.error('Application failed to start:', error.message);
  });

  console.log('=== Phase 1 Day 4 Complete ===');
}