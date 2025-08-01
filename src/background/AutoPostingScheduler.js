/**
 * 自動投稿スケジューリングサービス
 * 
 * 【責任範囲】
 * - Chrome Alarms APIによる定期実行制御
 * - 投稿間隔の動的調整
 * - 自動投稿の開始・停止・一時停止
 * - スケジュール状態の監視
 * - メモリクリーンアップの管理
 * 
 * 【AI可読性のポイント】
 * - startAutoPosting(), stopAutoPosting(), scheduleNext() など直感的なメソッド名
 * - 時間ベースの処理を集約し、複雑なタイミング制御を隠蔽
 * - スケジュール状態を明確に管理
 * - エラー発生時の自動復旧機能
 * 
 * 【依存関係】
 * - QuestionQueueManager: 投稿対象の質問取得
 * - YouTubeLiveChatService: 実際の投稿処理
 * - ConfigurationManager: 投稿間隔設定
 * - UnifiedErrorHandler: エラーログとユーザー通知
 */
class AutoPostingScheduler {
  /**
   * コンストラクタ
   * @param {QuestionQueueManager} queueManager - 質問キュー管理
   * @param {YouTubeLiveChatService} youtubeService - YouTube投稿サービス
   * @param {ConfigurationManager} configManager - 設定管理
   * @param {UnifiedErrorHandler} errorHandler - エラーハンドリング
   */
  constructor(queueManager, youtubeService, configManager, errorHandler) {
    this.queueManager = queueManager;
    this.youtubeService = youtubeService;
    this.configManager = configManager;
    this.errorHandler = errorHandler;
    
    // スケジュール状態
    this.isRunning = false;
    this.isPaused = false;
    this.currentAlarmName = 'postLiveChat';
    this.lastPostTime = 0;
    
    // 統計情報
    this.stats = {
      totalPosts: 0,
      successfulPosts: 0,
      failedPosts: 0,
      lastPostTime: null,
      lastErrorTime: null,
      uptime: 0,
      startTime: null
    };
    
    // メモリ管理
    this.cleanupIntervalId = null;
    this.statusCheckIntervalId = null;
    
    // アラームリスナーを設定
    this._setupAlarmListener();
  }

  /**
   * 自動投稿を開始
   * 
   * 【AI可読性】メイン機能を表現する直感的なメソッド名
   * 
   * @param {Object} options - 開始オプション
   * @param {number} options.intervalSeconds - 投稿間隔（秒）
   * @param {boolean} options.immediate - 即座に投稿するか
   * @returns {Promise<boolean>} 開始成功したかどうか
   */
  async startAutoPosting(options = {}) {
    try {
      console.log('[AutoPostingScheduler] Starting auto posting service');
      
      if (this.isRunning) {
        console.warn('[AutoPostingScheduler] Auto posting is already running');
        return true;
      }
      
      // 設定を取得
      const intervalSeconds = options.intervalSeconds || 
        await this.configManager.getPostInterval();
      const immediate = options.immediate || false;
      
      // バリデーション
      if (intervalSeconds < 10) {
        throw new Error('Post interval must be at least 10 seconds');
      }
      
      // 状態を更新
      this.isRunning = true;
      this.isPaused = false;
      this.stats.startTime = new Date().toISOString();
      
      // 設定を保存
      await this.configManager.setRunningState(true);
      
      // アラームを作成
      const intervalMinutes = intervalSeconds / 60;
      chrome.alarms.create(this.currentAlarmName, {
        periodInMinutes: intervalMinutes
      });
      
      // メモリクリーンアップを開始
      this._startMemoryCleanup();
      
      // 状態監視を開始
      this._startStatusMonitoring();
      
      console.log(`[AutoPostingScheduler] Auto posting started with ${intervalSeconds}s interval`);
      
      // 即座に投稿する場合
      if (immediate) {
        setTimeout(() => this._handleScheduledPost(), 1000);
      }
      
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'AutoPostingScheduler.startAutoPosting');
      this.isRunning = false;
      return false;
    }
  }

  /**
   * 自動投稿を停止
   * 
   * 【AI可読性】停止処理を明確に表現するメソッド名
   * 
   * @returns {Promise<boolean>} 停止成功したかどうか
   */
  async stopAutoPosting() {
    try {
      console.log('[AutoPostingScheduler] Stopping auto posting service');
      
      if (!this.isRunning) {
        console.warn('[AutoPostingScheduler] Auto posting is not running');
        return true;
      }
      
      // 状態を更新
      this.isRunning = false;
      this.isPaused = false;
      
      // 設定を保存
      await this.configManager.setRunningState(false);
      
      // アラームを削除
      chrome.alarms.clear(this.currentAlarmName);
      
      // メモリクリーンアップを停止
      this._stopMemoryCleanup();
      
      // 状態監視を停止
      this._stopStatusMonitoring();
      
      // 稼働時間を計算
      if (this.stats.startTime) {
        const startTime = new Date(this.stats.startTime).getTime();
        this.stats.uptime += Date.now() - startTime;
      }
      
      console.log('[AutoPostingScheduler] Auto posting stopped');
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'AutoPostingScheduler.stopAutoPosting');
      return false;
    }
  }

  /**
   * 自動投稿を一時停止
   * 
   * 【AI可読性】一時停止を明確に表現
   * 
   * @returns {Promise<boolean>} 一時停止成功したかどうか
   */
  async pauseAutoPosting() {
    try {
      console.log('[AutoPostingScheduler] Pausing auto posting');
      
      if (!this.isRunning) {
        console.warn('[AutoPostingScheduler] Auto posting is not running');
        return false;
      }
      
      this.isPaused = true;
      console.log('[AutoPostingScheduler] Auto posting paused');
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'AutoPostingScheduler.pauseAutoPosting');
      return false;
    }
  }

  /**
   * 自動投稿を再開
   * 
   * 【AI可読性】再開処理を明確に表現
   * 
   * @returns {Promise<boolean>} 再開成功したかどうか
   */
  async resumeAutoPosting() {
    try {
      console.log('[AutoPostingScheduler] Resuming auto posting');
      
      if (!this.isRunning) {
        console.warn('[AutoPostingScheduler] Auto posting is not running');
        return false;
      }
      
      if (!this.isPaused) {
        console.log('[AutoPostingScheduler] Auto posting is not paused');
        return true;
      }
      
      this.isPaused = false;
      console.log('[AutoPostingScheduler] Auto posting resumed');
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'AutoPostingScheduler.resumeAutoPosting');
      return false;
    }
  }

  /**
   * 投稿間隔を動的に変更
   * 
   * 【AI可読性】設定変更を直感的に表現
   * 
   * @param {number} intervalSeconds - 新しい投稿間隔（秒）
   * @returns {Promise<boolean>} 変更成功したかどうか
   */
  async updateInterval(intervalSeconds) {
    try {
      console.log(`[AutoPostingScheduler] Updating interval to ${intervalSeconds}s`);
      
      // バリデーション
      if (intervalSeconds < 10) {
        throw new Error('Post interval must be at least 10 seconds');
      }
      
      // 設定を保存
      await this.configManager.setPostInterval(intervalSeconds);
      
      // 実行中の場合はアラームを再作成
      if (this.isRunning) {
        chrome.alarms.clear(this.currentAlarmName);
        
        const intervalMinutes = intervalSeconds / 60;
        chrome.alarms.create(this.currentAlarmName, {
          periodInMinutes: intervalMinutes
        });
        
        console.log(`[AutoPostingScheduler] Interval updated and alarm recreated`);
      }
      
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'AutoPostingScheduler.updateInterval');
      return false;
    }
  }

  /**
   * 次の投稿を手動で実行
   * 
   * 【AI可読性】手動実行を明確に表現
   * 
   * @returns {Promise<Object>} 投稿結果
   */
  async triggerImmediatePost() {
    try {
      console.log('[AutoPostingScheduler] Triggering immediate post');
      
      // レート制限チェック
      const now = Date.now();
      const timeSinceLastPost = now - this.lastPostTime;
      const minInterval = 5000; // 5秒間隔
      
      if (timeSinceLastPost < minInterval) {
        const waitTime = minInterval - timeSinceLastPost;
        throw new Error(`Please wait ${Math.ceil(waitTime / 1000)} seconds before posting again`);
      }
      
      // 投稿処理を実行
      const result = await this._handleScheduledPost(true);
      
      console.log('[AutoPostingScheduler] Immediate post completed');
      return result;
    } catch (error) {
      await this.errorHandler.handleError(error, 'AutoPostingScheduler.triggerImmediatePost');
      return { success: false, error: error.message };
    }
  }

  /**
   * スケジューラーの状態を取得
   * 
   * 【AI可読性】状態情報の取得を直感的に表現
   * 
   * @returns {Object} 状態情報
   */
  getStatus() {
    const currentTime = Date.now();
    const uptime = this.stats.startTime ? 
      this.stats.uptime + (currentTime - new Date(this.stats.startTime).getTime()) : 
      this.stats.uptime;
    
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      alarmName: this.currentAlarmName,
      stats: {
        ...this.stats,
        currentUptime: uptime,
        successRate: this.stats.totalPosts > 0 ? 
          (this.stats.successfulPosts / this.stats.totalPosts) * 100 : 0
      },
      lastPostTime: this.lastPostTime,
      nextPostEstimate: this._getNextPostEstimate()
    };
  }

  /**
   * 統計情報をリセット
   * 
   * 【AI可読性】データのクリアを明確に表現
   */
  resetStats() {
    console.log('[AutoPostingScheduler] Resetting statistics');
    
    this.stats = {
      totalPosts: 0,
      successfulPosts: 0,
      failedPosts: 0,
      lastPostTime: null,
      lastErrorTime: null,
      uptime: 0,
      startTime: this.isRunning ? new Date().toISOString() : null
    };
  }

  // ===========================================
  // プライベートメソッド（内部実装の詳細）
  // ===========================================

  /**
   * アラームリスナーを設定
   * @private
   */
  _setupAlarmListener() {
    // アラームリスナーは background.service_worker.js で管理されるため、
    // ここでは設定しない（重複を避けるため）
    console.log('[AutoPostingScheduler] Alarm handler ready (managed by background worker)');
  }

  /**
   * スケジュールされた投稿を処理
   * @private
   */
  async _handleScheduledPost(isManual = false) {
    try {
      // 実行状態チェック
      if (!this.isRunning && !isManual) {
        console.log('[AutoPostingScheduler] Bot is stopped, skipping post');
        return { success: false, message: 'Bot is stopped' };
      }
      
      if (this.isPaused && !isManual) {
        console.log('[AutoPostingScheduler] Bot is paused, skipping post');
        return { success: false, message: 'Bot is paused' };
      }
      
      console.log('[AutoPostingScheduler] Processing scheduled post');
      
      // 次の質問を取得
      const nextQuestion = await this.queueManager.getNextQuestion();
      if (!nextQuestion) {
        console.log('[AutoPostingScheduler] No questions available for posting');
        return { success: false, message: 'No questions available' };
      }
      
      // NGワードフィルタリング
      const isNgContent = await this._checkNgContent(nextQuestion.text);
      if (isNgContent) {
        console.log(`[AutoPostingScheduler] Question contains NG content, skipping: ${nextQuestion.id}`);
        await this.queueManager.markAsSkipped(nextQuestion.id, 'NG content detected');
        return { success: false, message: 'Question skipped due to NG content' };
      }
      
      // 質問テキストをフォーマット
      const formattedText = await this._formatQuestionText(nextQuestion.text);
      
      // YouTube投稿を実行
      this.stats.totalPosts++;
      this.lastPostTime = Date.now();
      
      const postResult = await this.youtubeService.postMessage(formattedText, nextQuestion.id);
      
      if (postResult.success) {
        // 成功時の処理
        await this.queueManager.markAsSent(nextQuestion.id);
        this.stats.successfulPosts++;
        this.stats.lastPostTime = new Date().toISOString();
        
        console.log(`[AutoPostingScheduler] Successfully posted question: ${nextQuestion.id}`);
        return { success: true, message: 'Question posted successfully', questionId: nextQuestion.id };
      } else {
        // 失敗時の処理
        this.stats.failedPosts++;
        this.stats.lastErrorTime = new Date().toISOString();
        
        console.error(`[AutoPostingScheduler] Failed to post question: ${nextQuestion.id}`);
        return { success: false, error: postResult.error, questionId: nextQuestion.id };
      }
      
    } catch (error) {
      this.stats.failedPosts++;
      this.stats.lastErrorTime = new Date().toISOString();
      
      console.error('[AutoPostingScheduler] Error in scheduled post:', error);
      await this.errorHandler.handleError(error, 'AutoPostingScheduler._handleScheduledPost');
      
      return { success: false, error: error.message };
    }
  }

  /**
   * NGコンテンツをチェック
   * @private
   */
  async _checkNgContent(questionText) {
    try {
      const ngKeywords = await this.configManager.getNgKeywords();
      if (!ngKeywords || ngKeywords.length === 0) {
        return false;
      }
      
      const lowerText = questionText.toLowerCase();
      return ngKeywords.some(keyword => 
        lowerText.includes(keyword.toLowerCase())
      );
    } catch (error) {
      console.error('[AutoPostingScheduler] Error checking NG content:', error);
      return false;
    }
  }

  /**
   * 質問テキストをフォーマット
   * @private
   */
  async _formatQuestionText(questionText) {
    try {
      const prefix = await this.configManager.getQuestionPrefix();
      return `${prefix} ${questionText}`;
    } catch (error) {
      console.error('[AutoPostingScheduler] Error formatting text:', error);
      return questionText;
    }
  }

  /**
   * 次の投稿時間を推定
   * @private
   */
  async _getNextPostEstimate() {
    if (!this.isRunning || this.isPaused) {
      return null;
    }
    
    try {
      const intervalSeconds = await this.configManager.getPostInterval();
      const nextPostTime = this.lastPostTime + (intervalSeconds * 1000);
      return new Date(nextPostTime).toISOString();
    } catch (error) {
      return null;
    }
  }

  /**
   * メモリクリーンアップを開始
   * @private
   */
  _startMemoryCleanup() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
    }
    
    this.cleanupIntervalId = setInterval(() => {
      this._performMemoryCleanup();
    }, 60 * 60 * 1000); // 1時間ごと
    
    console.log('[AutoPostingScheduler] Memory cleanup started');
  }

  /**
   * メモリクリーンアップを停止
   * @private
   */
  _stopMemoryCleanup() {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
    
    console.log('[AutoPostingScheduler] Memory cleanup stopped');
  }

  /**
   * メモリクリーンアップを実行
   * @private
   */
  async _performMemoryCleanup() {
    try {
      console.log('[AutoPostingScheduler] Performing memory cleanup');
      
      // 古い統計データのクリーンアップ
      const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7日前
      
      if (this.stats.lastErrorTime) {
        const errorTime = new Date(this.stats.lastErrorTime).getTime();
        if (errorTime < cutoffTime) {
          this.stats.lastErrorTime = null;
        }
      }
      
      console.log('[AutoPostingScheduler] Memory cleanup completed');
    } catch (error) {
      console.error('[AutoPostingScheduler] Error during memory cleanup:', error);
    }
  }

  /**
   * 状態監視を開始
   * @private
   */
  _startStatusMonitoring() {
    if (this.statusCheckIntervalId) {
      clearInterval(this.statusCheckIntervalId);
    }
    
    this.statusCheckIntervalId = setInterval(() => {
      this._checkSystemHealth();
    }, 5 * 60 * 1000); // 5分ごと
    
    console.log('[AutoPostingScheduler] Status monitoring started');
  }

  /**
   * 状態監視を停止
   * @private
   */
  _stopStatusMonitoring() {
    if (this.statusCheckIntervalId) {
      clearInterval(this.statusCheckIntervalId);
      this.statusCheckIntervalId = null;
    }
    
    console.log('[AutoPostingScheduler] Status monitoring stopped');
  }

  /**
   * システムヘルスチェック
   * @private
   */
  async _checkSystemHealth() {
    try {
      // アラームの存在確認
      chrome.alarms.getAll((alarms) => {
        const hasOurAlarm = alarms.some(alarm => alarm.name === this.currentAlarmName);
        
        if (this.isRunning && !hasOurAlarm) {
          console.warn('[AutoPostingScheduler] Alarm missing, recreating...');
          this._recreateAlarm();
        }
      });
      
    } catch (error) {
      console.error('[AutoPostingScheduler] Error during health check:', error);
    }
  }

  /**
   * アラームを再作成
   * @private
   */
  async _recreateAlarm() {
    try {
      const intervalSeconds = await this.configManager.getPostInterval();
      const intervalMinutes = intervalSeconds / 60;
      
      chrome.alarms.create(this.currentAlarmName, {
        periodInMinutes: intervalMinutes
      });
      
      console.log('[AutoPostingScheduler] Alarm recreated successfully');
    } catch (error) {
      console.error('[AutoPostingScheduler] Failed to recreate alarm:', error);
    }
  }
}

// モジュールとして利用可能にする
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutoPostingScheduler;
} else if (typeof self !== 'undefined') {
  self.AutoPostingScheduler = AutoPostingScheduler;
}