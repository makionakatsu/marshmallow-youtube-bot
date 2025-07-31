/**
 * Background Service Worker メインコントローラー
 * 
 * 【責任範囲】
 * - 各サービスクラスの初期化と依存性注入
 * - Chrome Extension イベントの統合処理
 * - サービス間の協調動作の制御
 * - システム全体のライフサイクル管理
 * - メッセージルーティングとイベント処理
 * 
 * 【AI可読性のポイント】
 * - initialize(), handleMessage(), shutdown() など明確なライフサイクルメソッド
 * - ファサードパターンで複雑なサービス間連携を隠蔽
 * - 統一されたエラーハンドリングとログ出力
 * - 各機能への単一エントリーポイントを提供
 * 
 * 【依存関係】
 * - YouTubeLiveChatService: YouTube投稿機能
 * - QuestionQueueManager: 質問キュー管理
 * - AutoPostingScheduler: 自動投稿制御
 * - ConfigurationManager: 設定・認証管理
 * - 既存の共通ユーティリティクラス群
 */
class BackgroundServiceManager {
  /**
   * コンストラクタ
   */
  constructor() {
    // サービスインスタンス
    this.youtubeService = null;
    this.queueManager = null;
    this.scheduler = null;
    this.configManager = null;
    
    // 共通ユーティリティ
    this.storageService = null;
    this.errorHandler = null;
    this.inputValidator = null;
    this.appConfig = null;
    this.queueMutex = null;
    
    // システム状態
    this.isInitialized = false;
    this.isShuttingDown = false;
    
    // イベントハンドラーのバインド
    this._messageHandler = this._handleMessage.bind(this);
    this._alarmHandler = this._handleAlarm.bind(this);
    this._suspendHandler = this._handleSuspend.bind(this);
    this._storageChangeHandler = this._handleStorageChange.bind(this);
  }

  /**
   * サービスマネージャーを初期化
   * 
   * 【AI可読性】システム全体の初期化を一箇所で管理
   * 
   * @returns {Promise<boolean>} 初期化成功したかどうか
   */
  async initialize() {
    try {
      console.log('[BackgroundServiceManager] Initializing service manager');
      
      if (this.isInitialized) {
        console.warn('[BackgroundServiceManager] Already initialized');
        return true;
      }
      
      // 共通ユーティリティの初期化
      await this._initializeUtilities();
      
      // コアサービスの初期化
      await this._initializeCoreServices();
      
      // イベントリスナーの設定
      this._setupEventListeners();
      
      // 初期設定の読み込み
      await this._loadInitialConfiguration();
      
      // システム状態の復元
      await this._restoreSystemState();
      
      this.isInitialized = true;
      console.log('[BackgroundServiceManager] Service manager initialized successfully');
      
      return true;
    } catch (error) {
      console.error('[BackgroundServiceManager] Initialization failed:', error);
      await this.errorHandler?.handleError(error, 'BackgroundServiceManager.initialize');
      return false;
    }
  }

  /**
   * システムを安全にシャットダウン
   * 
   * 【AI可読性】クリーンアップ処理を明確に表現
   * 
   * @returns {Promise<void>}
   */
  async shutdown() {
    try {
      console.log('[BackgroundServiceManager] Starting shutdown sequence');
      
      if (this.isShuttingDown) {
        console.warn('[BackgroundServiceManager] Shutdown already in progress');
        return;
      }
      
      this.isShuttingDown = true;
      
      // 自動投稿を停止
      if (this.scheduler && this.scheduler.isRunning) {
        await this.scheduler.stopAutoPosting();
      }
      
      // イベントリスナーを削除
      this._removeEventListeners();
      
      // 各サービスのクリーンアップ
      await this._cleanupServices();
      
      this.isInitialized = false;
      console.log('[BackgroundServiceManager] Shutdown completed');
      
    } catch (error) {
      console.error('[BackgroundServiceManager] Shutdown error:', error);
    }
  }

  // ===========================================
  // 公開API - 各機能への統一インターフェース
  // ===========================================

  /**
   * 新しいマシュマロメッセージを処理
   * 
   * 【AI可読性】外部からの主要機能呼び出しを抽象化
   * 
   * @param {Array} messages - マシュマロメッセージ配列
   * @returns {Promise<Object>} 処理結果
   */
  async handleNewMarshmallowMessages(messages) {
    try {
      if (!this.isInitialized) {
        throw new Error('Service manager not initialized');
      }
      
      console.log(`[BackgroundServiceManager] Processing ${messages.length} new messages`);
      
      let addedCount = 0;
      let duplicateCount = 0;
      let errorCount = 0;
      
      for (const message of messages) {
        try {
          const questionId = await this.queueManager.addQuestion({
            text: message.text,
            received_at: message.received_at || new Date().toISOString()
          });
          
          if (questionId) {
            addedCount++;
          } else {
            duplicateCount++;
          }
        } catch (error) {
          console.error(`[BackgroundServiceManager] Failed to add message:`, error);
          errorCount++;
        }
      }
      
      const result = {
        success: true,
        addedCount,
        duplicateCount,
        errorCount,
        totalProcessed: messages.length
      };
      
      console.log(`[BackgroundServiceManager] Message processing completed:`, result);
      return result;
      
    } catch (error) {
      await this.errorHandler.handleError(error, 'BackgroundServiceManager.handleNewMarshmallowMessages');
      return {
        success: false,
        error: error.message,
        addedCount: 0,
        duplicateCount: 0,
        errorCount: messages.length,
        totalProcessed: messages.length
      };
    }
  }

  /**
   * 手動投稿を実行
   * 
   * 【AI可読性】手動操作を直感的に表現
   * 
   * @param {string} questionId - 特定の質問ID（省略可）
   * @returns {Promise<Object>} 投稿結果
   */
  async executeManualPost(questionId = null) {
    try {
      if (!this.isInitialized) {
        throw new Error('Service manager not initialized');
      }
      
      console.log(`[BackgroundServiceManager] Executing manual post${questionId ? ` for question: ${questionId}` : ''}`);
      
      let result;
      
      if (questionId) {
        // 特定の質問を投稿
        const question = await this._getQuestionById(questionId);
        if (!question) {
          throw new Error(`Question not found: ${questionId}`);
        }
        
        if (question.status === 'sent') {
          throw new Error(`Question already sent: ${questionId}`);
        }
        
        // 質問をnextに設定
        await this.queueManager.setAsNext(questionId);
      }
      
      // スケジューラーを通じて投稿実行
      result = await this.scheduler.triggerImmediatePost();
      
      console.log('[BackgroundServiceManager] Manual post completed:', result);
      return result;
      
    } catch (error) {
      await this.errorHandler.handleError(error, 'BackgroundServiceManager.executeManualPost');
      return {
        success: false,
        error: this._getUserFriendlyErrorMessage(error)
      };
    }
  }

  /**
   * 自動投稿を開始
   * 
   * 【AI可読性】自動投稿制御を明確に表現
   * 
   * @param {Object} options - 開始オプション
   * @returns {Promise<boolean>} 開始成功したかどうか
   */
  async startAutoPosting(options = {}) {
    try {
      if (!this.isInitialized) {
        throw new Error('Service manager not initialized');
      }
      
      console.log('[BackgroundServiceManager] Starting auto posting');
      
      const success = await this.scheduler.startAutoPosting(options);
      if (success) {
        // システム状態を更新
        await this.configManager.setRunningState(true);
        this._updateBadge('running');
      }
      
      return success;
      
    } catch (error) {
      await this.errorHandler.handleError(error, 'BackgroundServiceManager.startAutoPosting');
      return false;
    }
  }

  /**
   * 自動投稿を停止
   * 
   * 【AI可読性】停止処理を明確に表現
   * 
   * @returns {Promise<boolean>} 停止成功したかどうか
   */
  async stopAutoPosting() {
    try {
      if (!this.isInitialized) {
        throw new Error('Service manager not initialized');
      }
      
      console.log('[BackgroundServiceManager] Stopping auto posting');
      
      const success = await this.scheduler.stopAutoPosting();
      if (success) {
        // システム状態を更新
        await this.configManager.setRunningState(false);
        this._updateBadge('idle');
      }
      
      return success;
      
    } catch (error) {
      await this.errorHandler.handleError(error, 'BackgroundServiceManager.stopAutoPosting');
      return false;
    }
  }

  /**
   * システム状態を取得
   * 
   * 【AI可読性】全体状況の把握を直感的に表現
   * 
   * @returns {Promise<Object>} システム状態
   */
  async getSystemStatus() {
    try {
      if (!this.isInitialized) {
        return { initialized: false };
      }
      
      const [queueStats, schedulerStatus, settings] = await Promise.all([
        this.queueManager.getQueueStats(),
        Promise.resolve(this.scheduler.getStatus()),
        this.configManager.getAllSettings()
      ]);
      
      return {
        initialized: true,
        isShuttingDown: this.isShuttingDown,
        queue: queueStats,
        scheduler: schedulerStatus,
        settings: settings,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      await this.errorHandler.handleError(error, 'BackgroundServiceManager.getSystemStatus');
      return { initialized: false, error: error.message };
    }
  }

  // ===========================================
  // プライベートメソッド（初期化とイベント処理）
  // ===========================================

  /**
   * 共通ユーティリティを初期化
   * @private
   */
  async _initializeUtilities() {
    console.log('[BackgroundServiceManager] Initializing utilities');
    
    // 既存のグローバルインスタンスを使用
    this.queueMutex = new AsyncMutex();
    this.storageService = new OptimizedStorageService();
    this.errorHandler = new UnifiedErrorHandler();
    this.appConfig = new AppConfig();
    this.inputValidator = new InputValidator();
    
    // デバッグモードの設定
    const debugMode = this.appConfig.get('development.enableDebugLogs');
    if (debugMode) {
      this.queueMutex.setDebug(true);
      this.storageService.updateConfig({ enableDebug: true });
      this.errorHandler.updateConfig({ enableDebug: true });
    }
  }

  /**
   * コアサービスを初期化
   * @private
   */
  async _initializeCoreServices() {
    console.log('[BackgroundServiceManager] Initializing core services');
    
    // 依存性注入でサービスを初期化
    this.configManager = new ConfigurationManager(
      this.storageService,
      this.inputValidator,
      this.errorHandler,
      this.appConfig
    );
    
    this.youtubeService = new YouTubeLiveChatService(
      this.configManager,
      this.errorHandler,
      this.inputValidator
    );
    
    this.queueManager = new QuestionQueueManager(
      this.storageService,
      this.queueMutex,
      this.errorHandler,
      this.appConfig
    );
    
    this.scheduler = new AutoPostingScheduler(
      this.queueManager,
      this.youtubeService,
      this.configManager,
      this.errorHandler
    );
  }

  /**
   * イベントリスナーを設定
   * @private
   */
  _setupEventListeners() {
    console.log('[BackgroundServiceManager] Setting up event listeners');
    
    // メッセージリスナー
    chrome.runtime.onMessage.addListener(this._messageHandler);
    
    // ストレージ変更リスナー
    chrome.storage.onChanged.addListener(this._storageChangeHandler);
    
    // 拡張機能停止リスナー
    chrome.runtime.onSuspend.addListener(this._suspendHandler);
  }

  /**
   * イベントリスナーを削除
   * @private
   */
  _removeEventListeners() {
    console.log('[BackgroundServiceManager] Removing event listeners');
    
    try {
      chrome.runtime.onMessage.removeListener(this._messageHandler);
      chrome.storage.onChanged.removeListener(this._storageChangeHandler);
      chrome.runtime.onSuspend.removeListener(this._suspendHandler);
    } catch (error) {
      console.warn('[BackgroundServiceManager] Error removing listeners:', error);
    }
  }

  /**
   * 初期設定を読み込み
   * @private
   */
  async _loadInitialConfiguration() {
    console.log('[BackgroundServiceManager] Loading initial configuration');
    
    try {
      // 設定の妥当性チェック
      const settings = await this.configManager.getAllSettings();
      console.log('[BackgroundServiceManager] Initial settings loaded:', {
        hasApiKey: settings.hasApiKey,
        hasLiveChatId: settings.hasLiveChatId,
        testMode: settings.testMode,
        isRunning: settings.isRunning
      });
    } catch (error) {
      console.error('[BackgroundServiceManager] Failed to load initial configuration:', error);
    }
  }

  /**
   * システム状態を復元
   * @private
   */
  async _restoreSystemState() {
    console.log('[BackgroundServiceManager] Restoring system state');
    
    try {
      const isRunning = await this.configManager.getRunningState();
      const autoMode = await this.storageService.get('AUTO_MODE', true);
      
      if (isRunning && autoMode) {
        console.log('[BackgroundServiceManager] Restoring auto posting state');
        
        const postInterval = await this.configManager.getPostInterval();
        await this.scheduler.startAutoPosting({ intervalSeconds: postInterval });
        
        this._updateBadge('running');
      } else {
        this._updateBadge('idle');
      }
      
    } catch (error) {
      console.error('[BackgroundServiceManager] Failed to restore system state:', error);
      this._updateBadge('error');
    }
  }

  /**
   * Chrome Runtime メッセージを処理
   * @private
   */
  async _handleMessage(request, sender, sendResponse) {
    try {
      console.log(`[BackgroundServiceManager] Handling message: ${request.action}`);
      
      if (!this.isInitialized && request.action !== 'getSystemStatus') {
        sendResponse({ error: 'Service manager not initialized' });
        return;
      }
      
      let result;
      
      switch (request.action) {
        case 'newMarshmallowMessages':
          result = await this.handleNewMarshmallowMessages(request.messages || []);
          break;
          
        case 'manualPost':
          result = await this.executeManualPost(request.questionId);
          break;
          
        case 'startAutoPosting':
          result = { success: await this.startAutoPosting(request.options) };
          break;
          
        case 'stopAutoPosting':
          result = { success: await this.stopAutoPosting() };
          break;
          
        case 'getSystemStatus':
          result = await this.getSystemStatus();
          break;
          
        case 'setQuestionAsNext':
          result = { success: await this.queueManager.setAsNext(request.questionId) };
          break;
          
        case 'deleteQuestion':
          result = { success: await this.queueManager.deleteQuestion(request.questionId) };
          break;
          
        case 'getLiveVideoInfo':
          result = await this.youtubeService.getVideoInfo(request.videoId);
          break;
          
        default:
          result = { error: `Unknown action: ${request.action}` };
      }
      
      sendResponse(result);
      
    } catch (error) {
      console.error('[BackgroundServiceManager] Message handling error:', error);
      await this.errorHandler?.handleError(error, 'BackgroundServiceManager._handleMessage');
      sendResponse({ error: error.message });
    }
    
    return true; // 非同期レスポンスを示す
  }

  /**
   * ストレージ変更を処理
   * @private
   */
  async _handleStorageChange(changes, namespace) {
    if (namespace !== 'local') return;
    
    try {
      // 実行状態の変更を監視
      if (changes.isRunning) {
        const newValue = changes.isRunning.newValue;
        console.log(`[BackgroundServiceManager] Running state changed to: ${newValue}`);
        
        if (newValue && !this.scheduler?.isRunning) {
          await this.startAutoPosting();
        } else if (!newValue && this.scheduler?.isRunning) {
          await this.stopAutoPosting();
        }
      }
      
      // 投稿間隔の変更を監視
      if (changes.POST_INTERVAL_SEC && this.scheduler?.isRunning) {
        const newInterval = changes.POST_INTERVAL_SEC.newValue;
        console.log(`[BackgroundServiceManager] Post interval changed to: ${newInterval}`);
        await this.scheduler.updateInterval(newInterval);
      }
      
    } catch (error) {
      console.error('[BackgroundServiceManager] Storage change handling error:', error);
    }
  }

  /**
   * 拡張機能停止を処理
   * @private
   */
  async _handleSuspend() {
    console.log('[BackgroundServiceManager] Extension suspending');
    await this.shutdown();
  }

  /**
   * 各サービスのクリーンアップ
   * @private
   */
  async _cleanupServices() {
    console.log('[BackgroundServiceManager] Cleaning up services');
    
    // 各サービスのクリーンアップメソッドがある場合は呼び出し
    try {
      if (this.storageService?.clearCache) {
        this.storageService.clearCache();
      }
      
      if (this.queueMutex?.queue) {
        this.queueMutex.queue = [];
      }
      
    } catch (error) {
      console.error('[BackgroundServiceManager] Service cleanup error:', error);
    }
  }

  /**
   * バッジを更新
   * @private
   */
  _updateBadge(status) {
    try {
      const badgeConfig = {
        'idle': { text: '', color: '#4CAF50' },
        'running': { text: '⚡', color: '#2196F3' },
        'error': { text: '!', color: '#F44336' },
        'paused': { text: '⏸', color: '#FF9800' }
      };
      
      const config = badgeConfig[status] || badgeConfig['idle'];
      
      chrome.action.setBadgeText({ text: config.text });
      chrome.action.setBadgeBackgroundColor({ color: config.color });
      
    } catch (error) {
      console.error('[BackgroundServiceManager] Badge update error:', error);
    }
  }

  /**
   * 質問IDで質問を取得
   * @private
   */
  async _getQuestionById(questionId) {
    try {
      const queue = await this.queueManager.getQueue();
      return queue.find(q => q.id === questionId);
    } catch (error) {
      console.error('[BackgroundServiceManager] Error getting question by ID:', error);
      return null;
    }
  }

  /**
   * ユーザーフレンドリーなエラーメッセージに変換
   * @private
   */
  _getUserFriendlyErrorMessage(error) {
    const errorMessage = error.message || error.toString();
    
    if (errorMessage.includes('Question already sent')) {
      return 'この質問は既に送信済みです。';
    }
    if (errorMessage.includes('Question not found')) {
      return '指定された質問が見つかりません。';
    }
    if (errorMessage.includes('No questions available')) {
      return '送信可能な質問がありません。';
    }
    if (errorMessage.includes('Service manager not initialized')) {
      return 'システムが初期化されていません。拡張機能を再読み込みしてください。';
    }
    
    return `エラーが発生しました: ${errorMessage.substring(0, 100)}`;
  }
}

// グローバルインスタンスを作成（既存コードとの互換性のため）
if (typeof window !== 'undefined') {
  window.BackgroundServiceManager = BackgroundServiceManager;
}

// モジュールとして利用可能にする
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BackgroundServiceManager;
}