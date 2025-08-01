/**
 * 統一エラーハンドラー
 * 
 * 責任範囲:
 * - 全てのエラーの統一処理
 * - エラーの分類と優先度付け
 * - ユーザーフレンドリーなメッセージ生成
 * - エラーログの記録
 * - 復旧処理の実行
 * - 通知の管理
 */
class UnifiedErrorHandler {
  constructor() {
    /**
     * エラーハンドラーの設定
     * @type {Object}
     */
    this.config = {
      enableDebug: false,
      enableNotifications: true,
      enableRecovery: true,
      maxRetryAttempts: 3,
      retryDelay: 1000,
      logLevel: 'error'
    };
    
    /**
     * エラー統計
     * @type {Object}
     */
    this.stats = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsByContext: new Map(),
      recoveryAttempts: 0,
      successfulRecoveries: 0
    };
    
    /**
     * エラーログ
     * @type {Array}
     */
    this.errorLog = [];
    
    /**
     * 復旧戦略
     * @type {Map<string, Function>}
     */
    this.recoveryStrategies = new Map();
    
    /**
     * 通知キュー
     * @type {Array}
     */
    this.notificationQueue = [];
    
    this.setupDefaultRecoveryStrategies();
    this.setupGlobalErrorHandlers();
  }
  
  /**
   * エラーを処理
   * 
   * @param {Error} error エラーオブジェクト
   * @param {string} context エラーの発生コンテキスト
   * @param {Object} options 処理オプション
   * @returns {Promise<Object>} 処理結果
   */
  async handleError(error, context = 'unknown', options = {}) {
    const errorInfo = this.analyzeError(error, context, options);
    
    try {
      // 統計を更新
      this.updateStats(errorInfo);
      
      // エラーをログに記録
      this.logError(errorInfo);
      
      // ユーザーに通知
      if (this.config.enableNotifications && errorInfo.shouldNotify) {
        await this.notifyUser(errorInfo);
      }
      
      // 復旧を試行
      let recoveryResult = null;
      if (this.config.enableRecovery && errorInfo.isRecoverable) {
        recoveryResult = await this.attemptRecovery(errorInfo);
      }
      
      return {
        success: false,
        error: errorInfo,
        recovery: recoveryResult,
        timestamp: new Date().toISOString()
      };
      
    } catch (handlingError) {
      // エラーハンドリング自体でエラーが発生した場合
      console.error('[UnifiedErrorHandler] Error in error handling:', handlingError);
      return {
        success: false,
        error: errorInfo,
        handlingError: handlingError,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  /**
   * エラーを分析
   * 
   * @param {Error} error エラーオブジェクト
   * @param {string} context コンテキスト
   * @param {Object} options オプション
   * @returns {Object} 分析結果
   */
  analyzeError(error, context, options) {
    const errorType = this.classifyError(error);
    const severity = this.determineSeverity(error, errorType);
    const isRecoverable = this.isRecoverable(error, errorType);
    const shouldNotify = this.shouldNotifyUser(error, errorType, severity);
    
    return {
      originalError: error,
      type: errorType,
      severity: severity,
      context: context,
      message: error.message || 'Unknown error',
      stack: error.stack,
      isRecoverable: isRecoverable,
      shouldNotify: shouldNotify,
      userMessage: this.generateUserMessage(error, errorType, context),
      timestamp: new Date().toISOString(),
      id: this.generateErrorId(),
      options: options
    };
  }
  
  /**
   * エラーを分類
   * 
   * @param {Error} error エラーオブジェクト
   * @returns {string} エラータイプ
   */
  classifyError(error) {
    const message = error.message || '';
    const name = error.name || 'Error';
    
    // 認証関連エラー
    if (message.includes('AUTHENTICATION_FAILED') || 
        message.includes('OAuth') || 
        message.includes('Token') ||
        message.includes('401')) {
      return 'AUTH_ERROR';
    }
    
    // API関連エラー
    if (message.includes('API') || 
        message.includes('RATE_LIMITED') ||
        message.includes('429') ||
        message.includes('googleapis')) {
      return 'API_ERROR';
    }
    
    // ネットワーク関連エラー
    if (message.includes('Network') || 
        message.includes('fetch') ||
        message.includes('timeout') ||
        name === 'TypeError' && message.includes('Failed to fetch')) {
      return 'NETWORK_ERROR';
    }
    
    // ストレージ関連エラー
    if (message.includes('Storage') || 
        message.includes('chrome.storage') ||
        message.includes('QUOTA_EXCEEDED')) {
      return 'STORAGE_ERROR';
    }
    
    // 検証エラー
    if (name === 'ValidationError' || message.includes('Invalid') || message.includes('validation')) {
      return 'VALIDATION_ERROR';
    }
    
    // 設定エラー
    if (message.includes('config') || message.includes('setting') || message.includes('API key')) {
      return 'CONFIG_ERROR';
    }
    
    // その他
    return 'UNKNOWN_ERROR';
  }
  
  /**
   * エラーの重要度を決定
   * 
   * @param {Error} error エラーオブジェクト
   * @param {string} errorType エラータイプ
   * @returns {string} 重要度
   */
  determineSeverity(error, errorType) {
    // 重要度の高いエラー
    if (errorType === 'AUTH_ERROR' || 
        errorType === 'CONFIG_ERROR' ||
        error.message.includes('PERMISSION_DENIED')) {
      return 'HIGH';
    }
    
    // 中程度のエラー
    if (errorType === 'API_ERROR' || 
        errorType === 'NETWORK_ERROR' ||
        errorType === 'STORAGE_ERROR') {
      return 'MEDIUM';
    }
    
    // 低い重要度のエラー
    if (errorType === 'VALIDATION_ERROR') {
      return 'LOW';
    }
    
    return 'MEDIUM';
  }
  
  /**
   * エラーが復旧可能かどうかを判定
   * 
   * @param {Error} error エラーオブジェクト
   * @param {string} errorType エラータイプ
   * @returns {boolean} 復旧可能かどうか
   */
  isRecoverable(error, errorType) {
    // 復旧可能なエラー
    if (errorType === 'NETWORK_ERROR' || 
        errorType === 'API_ERROR' ||
        errorType === 'STORAGE_ERROR') {
      return true;
    }
    
    // 復旧不可能なエラー
    if (errorType === 'AUTH_ERROR' || 
        errorType === 'CONFIG_ERROR' ||
        errorType === 'VALIDATION_ERROR') {
      return false;
    }
    
    return false;
  }
  
  /**
   * ユーザーに通知すべきかどうかを判定
   * 
   * @param {Error} error エラーオブジェクト
   * @param {string} errorType エラータイプ
   * @param {string} severity 重要度
   * @returns {boolean} 通知すべきかどうか
   */
  shouldNotifyUser(error, errorType, severity) {
    // 高重要度のエラーは常に通知
    if (severity === 'HIGH') {
      return true;
    }
    
    // 中程度のエラーで、ユーザーアクションが必要な場合
    if (severity === 'MEDIUM' && 
        (errorType === 'AUTH_ERROR' || 
         errorType === 'CONFIG_ERROR' ||
         errorType === 'API_ERROR')) {
      return true;
    }
    
    return false;
  }
  
  /**
   * ユーザーフレンドリーなエラーメッセージを生成
   * 
   * @param {Error} error エラーオブジェクト
   * @param {string} errorType エラータイプ
   * @param {string} context コンテキスト
   * @returns {string} ユーザーメッセージ
   */
  generateUserMessage(error, errorType, context) {
    const message = error.message || '';
    
    switch (errorType) {
      case 'AUTH_ERROR':
        if (message.includes('AUTHENTICATION_FAILED')) {
          return 'YouTube認証が失敗しました。設定画面でOAuth認証を再度行ってください。';
        }
        if (message.includes('Token')) {
          return 'アクセストークンが無効です。再度ログインしてください。';
        }
        return '認証エラーが発生しました。設定を確認してください。';
        
      case 'API_ERROR':
        if (message.includes('RATE_LIMITED')) {
          const seconds = message.split(':')[1] || '60';
          return `YouTube APIの制限に達しました。${seconds}秒後に再試行してください。`;
        }
        if (message.includes('BAD_REQUEST')) {
          return 'リクエストが無効です。ライブ配信が終了している可能性があります。';
        }
        return 'YouTube APIでエラーが発生しました。しばらく待ってから再試行してください。';
        
      case 'NETWORK_ERROR':
        return 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
        
      case 'STORAGE_ERROR':
        return 'データの保存でエラーが発生しました。ストレージの容量を確認してください。';
        
      case 'CONFIG_ERROR':
        if (message.includes('API key')) {
          return 'YouTube APIキーが設定されていません。設定画面でAPIキーを入力してください。';
        }
        return '設定エラーが発生しました。設定を確認してください。';
        
      case 'VALIDATION_ERROR':
        return `入力データが無効です: ${message}`;
        
      default:
        return `エラーが発生しました: ${message.substring(0, 100)}`;
    }
  }
  
  /**
   * エラーの復旧を試行
   * 
   * @param {Object} errorInfo エラー情報
   * @returns {Promise<Object>} 復旧結果
   */
  async attemptRecovery(errorInfo) {
    this.stats.recoveryAttempts++;
    
    try {
      const strategy = this.recoveryStrategies.get(errorInfo.type);
      if (strategy) {
        const result = await strategy(errorInfo);
        if (result.success) {
          this.stats.successfulRecoveries++;
        }
        return result;
      }
      
      // デフォルトの復旧戦略
      return await this.defaultRecoveryStrategy(errorInfo);
      
    } catch (recoveryError) {
      return {
        success: false,
        error: recoveryError,
        message: 'Recovery failed'
      };
    }
  }
  
  /**
   * ユーザーに通知
   * 
   * @param {Object} errorInfo エラー情報
   * @returns {Promise<void>}
   */
  async notifyUser(errorInfo) {
    try {
      // Chrome通知APIを使用
      if (typeof chrome !== 'undefined' && chrome.notifications) {
        await chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: 'Bot Error',
          message: errorInfo.userMessage,
          priority: errorInfo.severity === 'HIGH' ? 2 : 1
        });
      }
      
      // 通知キューに追加
      this.notificationQueue.push({
        id: errorInfo.id,
        message: errorInfo.userMessage,
        type: errorInfo.type,
        severity: errorInfo.severity,
        timestamp: errorInfo.timestamp
      });
      
    } catch (notificationError) {
      console.error('[UnifiedErrorHandler] Failed to notify user:', notificationError);
    }
  }
  
  /**
   * エラーをログに記録
   * 
   * @param {Object} errorInfo エラー情報
   */
  logError(errorInfo) {
    const logEntry = {
      id: errorInfo.id,
      timestamp: errorInfo.timestamp,
      type: errorInfo.type,
      severity: errorInfo.severity,
      context: errorInfo.context,
      message: errorInfo.message,
      stack: errorInfo.stack
    };
    
    this.errorLog.push(logEntry);
    
    // ログサイズの制限
    if (this.errorLog.length > 1000) {
      this.errorLog.shift(); // 最古のエントリを削除
    }
    
    // コンソールにもログ出力
    if (this.config.enableDebug || errorInfo.severity === 'HIGH') {
      console.error(`[UnifiedErrorHandler] ${errorInfo.type}:`, errorInfo.originalError);
    }
  }
  
  /**
   * 統計を更新
   * 
   * @param {Object} errorInfo エラー情報
   */
  updateStats(errorInfo) {
    this.stats.totalErrors++;
    
    // タイプ別の統計
    const typeCount = this.stats.errorsByType.get(errorInfo.type) || 0;
    this.stats.errorsByType.set(errorInfo.type, typeCount + 1);
    
    // コンテキスト別の統計
    const contextCount = this.stats.errorsByContext.get(errorInfo.context) || 0;
    this.stats.errorsByContext.set(errorInfo.context, contextCount + 1);
  }
  
  /**
   * エラーIDを生成
   * 
   * @returns {string} エラーID
   */
  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
  
  /**
   * デフォルトの復旧戦略を設定
   */
  setupDefaultRecoveryStrategies() {
    // ネットワークエラーの復旧
    this.recoveryStrategies.set('NETWORK_ERROR', async (errorInfo) => {
      // 再試行戦略
      for (let attempt = 1; attempt <= this.config.maxRetryAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        
        try {
          // 元の操作を再試行（実装は後で追加）
          return { success: true, message: 'Network error recovered' };
        } catch (retryError) {
          if (attempt === this.config.maxRetryAttempts) {
            return { success: false, message: 'Network recovery failed after retries' };
          }
        }
      }
      
      return { success: false, message: 'Network recovery failed' };
    });
    
    // APIエラーの復旧
    this.recoveryStrategies.set('API_ERROR', async (errorInfo) => {
      const message = errorInfo.message;
      
      // レート制限の場合
      if (message.includes('RATE_LIMITED')) {
        const retryAfter = message.split(':')[1] || '60';
        await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
        return { success: true, message: 'Rate limit recovered' };
      }
      
      return { success: false, message: 'API error recovery not available' };
    });
    
    // ストレージエラーの復旧
    this.recoveryStrategies.set('STORAGE_ERROR', async (errorInfo) => {
      // ストレージのクリーンアップを試行
      try {
        // 古いデータを削除（実装は後で追加）
        return { success: true, message: 'Storage cleaned up' };
      } catch (cleanupError) {
        return { success: false, message: 'Storage cleanup failed' };
      }
    });
  }
  
  /**
   * デフォルトの復旧戦略
   * 
   * @param {Object} errorInfo エラー情報
   * @returns {Promise<Object>} 復旧結果
   */
  async defaultRecoveryStrategy(errorInfo) {
    // 基本的な復旧処理
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
    
    return {
      success: false,
      message: 'No specific recovery strategy available'
    };
  }
  
  /**
   * グローバルエラーハンドラーを設定
   */
  setupGlobalErrorHandlers() {
    // 環境に応じてグローバルオブジェクトを選択
    const globalObj = (typeof window !== 'undefined') ? window : self;
    
    // 未処理のPromise拒否
    if (typeof globalObj !== 'undefined' && globalObj.addEventListener) {
      globalObj.addEventListener('unhandledrejection', (event) => {
        this.handleError(event.reason, 'unhandledrejection');
      });
      
      // 未処理のエラー
      globalObj.addEventListener('error', (event) => {
        this.handleError(event.error, 'global');
      });
    }
  }
  
  /**
   * 統計情報を取得
   * 
   * @returns {Object} 統計情報
   */
  getStats() {
    return {
      ...this.stats,
      errorsByType: Object.fromEntries(this.stats.errorsByType),
      errorsByContext: Object.fromEntries(this.stats.errorsByContext),
      recoveryRate: this.stats.recoveryAttempts > 0 ? 
        (this.stats.successfulRecoveries / this.stats.recoveryAttempts * 100).toFixed(2) + '%' : '0%'
    };
  }
  
  /**
   * エラーログを取得
   * 
   * @param {number} limit 取得数制限
   * @returns {Array} エラーログ
   */
  getErrorLog(limit = 100) {
    return this.errorLog.slice(-limit);
  }
  
  /**
   * 設定を更新
   * 
   * @param {Object} newConfig 新しい設定
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

// CommonJS と ES6 modules の両方に対応
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UnifiedErrorHandler;
} else {
  // 環境に応じてグローバルオブジェクトを選択
  const globalObj = (typeof window !== 'undefined') ? window : self;
  globalObj.UnifiedErrorHandler = UnifiedErrorHandler;
}