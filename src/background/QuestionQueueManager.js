/**
 * 質問キューの状態管理サービス
 * 
 * 【責任範囲】
 * - 質問の追加・削除・更新操作
 * - ステータス管理 (pending, next, sent, skipped)
 * - キューの永続化（Storage API）
 * - キューのサイズ制限と最適化
 * - 質問の優先順位制御
 * 
 * 【AI可読性のポイント】
 * - addQuestion(), getNextQuestion(), markAsSent() など直感的なメソッド名
 * - 質問のライフサイクル管理を一元化
 * - ステータス遷移を明確に定義
 * - 排他制御による並行アクセス対応
 * 
 * 【依存関係】
 * - OptimizedStorageService: データの永続化
 * - AsyncMutex: 排他制御
 * - UnifiedErrorHandler: エラーログ
 * - AppConfig: キュー設定値
 */
class QuestionQueueManager {
  /**
   * コンストラクタ
   * @param {OptimizedStorageService} storageService - ストレージサービス
   * @param {AsyncMutex} queueMutex - 排他制御
   * @param {UnifiedErrorHandler} errorHandler - エラーハンドリング
   * @param {AppConfig} appConfig - アプリケーション設定
   */
  constructor(storageService, queueMutex, errorHandler, appConfig) {
    this.storageService = storageService;
    this.queueMutex = queueMutex;
    this.errorHandler = errorHandler;
    this.appConfig = appConfig;
    
    // キューの設定値
    this.maxQueueSize = this.appConfig.get('queue.maxSize');
    this.sortBy = this.appConfig.get('queue.sortBy');
    this.sortOrder = this.appConfig.get('queue.sortOrder');
    
    // 有効なステータス定義
    this.validStatuses = ['pending', 'next', 'sent', 'skipped'];
    
    // キューのキャッシュ
    this._queueCache = null;
    this._cacheExpiry = 0;
    this._cacheTimeout = this.appConfig.get('performance.cacheTimeout');
  }

  /**
   * 新しい質問をキューに追加
   * 
   * 【AI可読性】メイン機能を表現する直感的なメソッド名
   * 
   * @param {Object} question - 質問オブジェクト
   * @param {string} question.text - 質問本文
   * @param {string} question.received_at - 受信日時（ISO形式）
   * @returns {Promise<string>} 追加された質問のID
   */
  async addQuestion(question) {
    try {
      return await this.queueMutex.withLock(async () => {
        console.log('[QuestionQueueManager] Adding new question to queue');
        
        // 質問オブジェクトの検証
        this._validateQuestionObject(question);
        
        // 現在のキューを取得
        const currentQueue = await this._getQueueFromStorage();
        
        // サイズ制限チェック
        if (currentQueue.length >= this.maxQueueSize) {
          console.warn(`[QuestionQueueManager] Queue size limit reached: ${this.maxQueueSize}`);
          // 最も古い sent または skipped の質問を削除
          this._removeOldProcessedQuestions(currentQueue);
        }
        
        // 新しい質問オブジェクトを作成
        const newQuestion = {
          id: this._generateQuestionId(),
          text: question.text.trim(),
          received_at: question.received_at || new Date().toISOString(),
          status: 'pending',
          created_at: new Date().toISOString(),
          retry_count: 0
        };
        
        // 重複チェック
        const isDuplicate = this._checkForDuplicate(currentQueue, newQuestion.text);
        if (isDuplicate) {
          console.warn('[QuestionQueueManager] Duplicate question detected, skipping');
          return null;
        }
        
        // キューに追加
        currentQueue.push(newQuestion);
        
        // ソート
        this._sortQueue(currentQueue);
        
        // 保存
        await this._saveQueueToStorage(currentQueue);
        
        console.log(`[QuestionQueueManager] Question added with ID: ${newQuestion.id}`);
        return newQuestion.id;
      });
    } catch (error) {
      await this.errorHandler.handleError(error, 'QuestionQueueManager.addQuestion');
      throw error;
    }
  }

  /**
   * 次に投稿する質問を取得
   * 
   * 【AI可読性】次のアクションを示す分かりやすいメソッド名
   * 
   * @returns {Promise<Object|null>} 次の質問オブジェクト、またはnull
   */
  async getNextQuestion() {
    try {
      return await this.queueMutex.withLock(async () => {
        console.log('[QuestionQueueManager] Getting next question for posting');
        
        const currentQueue = await this._getQueueFromStorage();
        
        // 既にnextステータスの質問があるかチェック
        let nextQuestion = currentQueue.find(q => q.status === 'next');
        
        if (!nextQuestion) {
          // pending状態の質問から最も古いものを選択
          const pendingQuestions = currentQueue.filter(q => q.status === 'pending');
          
          if (pendingQuestions.length === 0) {
            console.log('[QuestionQueueManager] No pending questions available');
            return null;
          }
          
          // 最も古い質問を取得（received_atで昇順ソート）
          pendingQuestions.sort((a, b) => 
            new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
          );
          nextQuestion = pendingQuestions[0];
          
          // ステータスをnextに変更
          nextQuestion.status = 'next';
          nextQuestion.next_at = new Date().toISOString();
          
          await this._saveQueueToStorage(currentQueue);
          console.log(`[QuestionQueueManager] Set question ${nextQuestion.id} as next`);
        }
        
        return { ...nextQuestion }; // 防御的コピー
      });
    } catch (error) {
      await this.errorHandler.handleError(error, 'QuestionQueueManager.getNextQuestion');
      throw error;
    }
  }

  /**
   * 質問を送信済みとしてマーク
   * 
   * 【AI可読性】状態変更を明確に表現するメソッド名
   * 
   * @param {string} questionId - 質問ID
   * @returns {Promise<boolean>} 更新成功したかどうか
   */
  async markAsSent(questionId) {
    try {
      return await this.queueMutex.withLock(async () => {
        console.log(`[QuestionQueueManager] Marking question ${questionId} as sent`);
        
        const currentQueue = await this._getQueueFromStorage();
        const question = currentQueue.find(q => q.id === questionId);
        
        if (!question) {
          console.warn(`[QuestionQueueManager] Question not found: ${questionId}`);
          return false;
        }
        
        // ステータス更新
        question.status = 'sent';
        question.sent_at = new Date().toISOString();
        question.retry_count = 0; // リトライカウントをリセット
        
        await this._saveQueueToStorage(currentQueue);
        console.log(`[QuestionQueueManager] Question ${questionId} marked as sent`);
        
        return true;
      });
    } catch (error) {
      await this.errorHandler.handleError(error, 'QuestionQueueManager.markAsSent');
      return false;
    }
  }

  /**
   * 質問をスキップ済みとしてマーク
   * 
   * 【AI可読性】スキップ処理を明確に表現
   * 
   * @param {string} questionId - 質問ID
   * @param {string} reason - スキップ理由
   * @returns {Promise<boolean>} 更新成功したかどうか
   */
  async markAsSkipped(questionId, reason = 'Manual skip') {
    try {
      return await this.queueMutex.withLock(async () => {
        console.log(`[QuestionQueueManager] Marking question ${questionId} as skipped: ${reason}`);
        
        const currentQueue = await this._getQueueFromStorage();
        const question = currentQueue.find(q => q.id === questionId);
        
        if (!question) {
          console.warn(`[QuestionQueueManager] Question not found: ${questionId}`);
          return false;
        }
        
        // ステータス更新
        question.status = 'skipped';
        question.skipped_at = new Date().toISOString();
        question.skipped_reason = reason;
        
        await this._saveQueueToStorage(currentQueue);
        console.log(`[QuestionQueueManager] Question ${questionId} marked as skipped`);
        
        return true;
      });
    } catch (error) {
      await this.errorHandler.handleError(error, 'QuestionQueueManager.markAsSkipped');
      return false;
    }
  }

  /**
   * 特定の質問を次の投稿対象に設定
   * 
   * 【AI可読性】優先順位の変更を直感的に表現
   * 
   * @param {string} questionId - 質問ID
   * @returns {Promise<boolean>} 設定成功したかどうか
   */
  async setAsNext(questionId) {
    try {
      return await this.queueMutex.withLock(async () => {
        console.log(`[QuestionQueueManager] Setting question ${questionId} as next`);
        
        const currentQueue = await this._getQueueFromStorage();
        
        // 既存のnextステータスをpendingに戻す
        currentQueue.forEach(q => {
          if (q.status === 'next') {
            q.status = 'pending';
            delete q.next_at;
          }
        });
        
        // 指定された質問をnextに設定
        const targetQuestion = currentQueue.find(q => q.id === questionId);
        if (!targetQuestion) {
          console.warn(`[QuestionQueueManager] Question not found: ${questionId}`);
          return false;
        }
        
        if (targetQuestion.status !== 'pending') {
          console.warn(`[QuestionQueueManager] Question ${questionId} is not pending (status: ${targetQuestion.status})`);
          return false;
        }
        
        targetQuestion.status = 'next';
        targetQuestion.next_at = new Date().toISOString();
        
        await this._saveQueueToStorage(currentQueue);
        console.log(`[QuestionQueueManager] Question ${questionId} set as next`);
        
        return true;
      });
    } catch (error) {
      await this.errorHandler.handleError(error, 'QuestionQueueManager.setAsNext');
      return false;
    }
  }

  /**
   * 質問を削除
   * 
   * 【AI可読性】削除処理を明確に表現
   * 
   * @param {string} questionId - 質問ID
   * @returns {Promise<boolean>} 削除成功したかどうか
   */
  async deleteQuestion(questionId) {
    try {
      return await this.queueMutex.withLock(async () => {
        console.log(`[QuestionQueueManager] Deleting question ${questionId}`);
        
        const currentQueue = await this._getQueueFromStorage();
        const initialLength = currentQueue.length;
        
        // 質問を除外した新しい配列を作成
        const filteredQueue = currentQueue.filter(q => q.id !== questionId);
        
        if (filteredQueue.length === initialLength) {
          console.warn(`[QuestionQueueManager] Question not found: ${questionId}`);
          return false;
        }
        
        await this._saveQueueToStorage(filteredQueue);
        console.log(`[QuestionQueueManager] Question ${questionId} deleted`);
        
        return true;
      });
    } catch (error) {
      await this.errorHandler.handleError(error, 'QuestionQueueManager.deleteQuestion');
      return false;
    }
  }

  /**
   * キューの統計情報を取得
   * 
   * 【AI可読性】データの概要を把握しやすいメソッド名
   * 
   * @returns {Promise<Object>} キューの統計情報
   */
  async getQueueStats() {
    try {
      const currentQueue = await this._getQueueFromStorage();
      
      const stats = {
        total: currentQueue.length,
        pending: currentQueue.filter(q => q.status === 'pending').length,
        next: currentQueue.filter(q => q.status === 'next').length,
        sent: currentQueue.filter(q => q.status === 'sent').length,
        skipped: currentQueue.filter(q => q.status === 'skipped').length,
        oldestPending: null,
        newestPending: null
      };
      
      // pending質問の日時情報
      const pendingQuestions = currentQueue.filter(q => q.status === 'pending');
      if (pendingQuestions.length > 0) {
        const sortedByDate = [...pendingQuestions].sort((a, b) => 
          new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
        );
        stats.oldestPending = sortedByDate[0].received_at;
        stats.newestPending = sortedByDate[sortedByDate.length - 1].received_at;
      }
      
      return stats;
    } catch (error) {
      await this.errorHandler.handleError(error, 'QuestionQueueManager.getQueueStats');
      return { total: 0, pending: 0, next: 0, sent: 0, skipped: 0 };
    }
  }

  /**
   * キューを取得（読み取り専用）
   * 
   * 【AI可読性】データアクセスを明確に表現
   * 
   * @returns {Promise<Array>} 質問配列（防御的コピー）
   */
  async getQueue() {
    try {
      const queue = await this._getQueueFromStorage();
      return queue.map(q => ({ ...q })); // 防御的コピー
    } catch (error) {
      await this.errorHandler.handleError(error, 'QuestionQueueManager.getQueue');
      return [];
    }
  }

  /**
   * キューをクリア
   * 
   * 【AI可読性】全削除を明確に表現
   * 
   * @param {boolean} includeSent - 送信済み質問も削除するか
   * @returns {Promise<number>} 削除された質問数
   */
  async clearQueue(includeSent = false) {
    try {
      return await this.queueMutex.withLock(async () => {
        console.log(`[QuestionQueueManager] Clearing queue (includeSent: ${includeSent})`);
        
        const currentQueue = await this._getQueueFromStorage();
        const initialCount = currentQueue.length;
        
        let filteredQueue;
        if (includeSent) {
          filteredQueue = [];
        } else {
          // 送信済みと処理済みは保持
          filteredQueue = currentQueue.filter(q => 
            q.status === 'sent' || q.status === 'skipped'
          );
        }
        
        await this._saveQueueToStorage(filteredQueue);
        const deletedCount = initialCount - filteredQueue.length;
        
        console.log(`[QuestionQueueManager] Cleared ${deletedCount} questions from queue`);
        return deletedCount;
      });
    } catch (error) {
      await this.errorHandler.handleError(error, 'QuestionQueueManager.clearQueue');
      return 0;
    }
  }

  // ===========================================
  // プライベートメソッド（内部実装の詳細）
  // ===========================================

  /**
   * ストレージからキューを取得（キャッシュ対応）
   * @private
   */
  async _getQueueFromStorage() {
    const now = Date.now();
    
    // キャッシュが有効な場合は使用
    if (this._queueCache && now < this._cacheExpiry) {
      return this._queueCache;
    }
    
    try {
      const queue = await this.storageService.get('questionQueue', []);
      
      // データの整合性チェック
      if (!Array.isArray(queue)) {
        console.warn('[QuestionQueueManager] Invalid queue data format, resetting');
        await this.storageService.set('questionQueue', []);
        return [];
      }
      
      // キャッシュを更新
      this._queueCache = queue;
      this._cacheExpiry = now + this._cacheTimeout;
      
      return queue;
    } catch (error) {
      console.error('[QuestionQueueManager] Failed to get queue from storage:', error);
      return [];
    }
  }

  /**
   * キューをストレージに保存
   * @private
   */
  async _saveQueueToStorage(queue) {
    try {
      // データの検証
      if (!Array.isArray(queue)) {
        throw new Error('Queue must be an array');
      }
      
      await this.storageService.set('questionQueue', queue);
      
      // キャッシュを更新
      this._queueCache = [...queue];
      this._cacheExpiry = Date.now() + this._cacheTimeout;
      
      console.log(`[QuestionQueueManager] Saved queue with ${queue.length} items`);
    } catch (error) {
      console.error('[QuestionQueueManager] Failed to save queue:', error);
      throw error;
    }
  }

  /**
   * 質問オブジェクトの妥当性検証
   * @private
   */
  _validateQuestionObject(question) {
    if (!question || typeof question !== 'object') {
      throw new Error('Question must be an object');
    }
    
    if (!question.text || typeof question.text !== 'string') {
      throw new Error('Question text is required and must be a string');
    }
    
    if (question.text.trim().length === 0) {
      throw new Error('Question text cannot be empty');
    }
    
    if (question.text.length > 500) {
      throw new Error('Question text is too long (max 500 characters)');
    }
  }

  /**
   * 質問IDを生成
   * @private
   */
  _generateQuestionId() {
    return `q_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * 重複質問をチェック
   * @private
   */
  _checkForDuplicate(queue, questionText) {
    const normalizedText = questionText.toLowerCase().trim();
    const recentCutoff = Date.now() - (24 * 60 * 60 * 1000); // 24時間以内
    
    return queue.some(q => {
      const questionTime = new Date(q.received_at).getTime();
      const isSimilar = q.text.toLowerCase().trim() === normalizedText;
      const isRecent = questionTime > recentCutoff;
      
      return isSimilar && isRecent;
    });
  }

  /**
   * キューをソート
   * @private
   */
  _sortQueue(queue) {
    queue.sort((a, b) => {
      const aValue = new Date(a[this.sortBy]).getTime();
      const bValue = new Date(b[this.sortBy]).getTime();
      
      return this.sortOrder === 'desc' ? bValue - aValue : aValue - bValue;
    });
  }

  /**
   * 古い処理済み質問を削除
   * @private
   */
  _removeOldProcessedQuestions(queue) {
    const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7日前
    
    // 古い sent または skipped の質問を削除
    for (let i = queue.length - 1; i >= 0; i--) {
      const question = queue[i];
      const questionTime = new Date(question.received_at).getTime();
      
      if ((question.status === 'sent' || question.status === 'skipped') && 
          questionTime < cutoffTime) {
        queue.splice(i, 1);
        console.log(`[QuestionQueueManager] Removed old processed question: ${question.id}`);
        break; // 1つずつ削除
      }
    }
  }
}

// モジュールとして利用可能にする
if (typeof module !== 'undefined' && module.exports) {
  module.exports = QuestionQueueManager;
} else if (typeof window !== 'undefined') {
  window.QuestionQueueManager = QuestionQueueManager;
}