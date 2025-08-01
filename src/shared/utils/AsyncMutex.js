/**
 * 非同期処理の排他制御を行うミューテックス
 * 
 * 責任範囲:
 * - 非同期処理の排他制御
 * - デッドロック防止
 * - パフォーマンス効率の最適化
 * 
 * 使用例:
 * const mutex = new AsyncMutex();
 * await mutex.acquire();
 * try {
 *   // 排他制御が必要な処理
 * } finally {
 *   mutex.release();
 * }
 */
class AsyncMutex {
  constructor() {
    /**
     * 待機中のPromiseを管理するキュー
     * @type {(() => void)[]}
     */
    this.queue = [];
    
    /**
     * ロック状態を示すフラグ
     * @type {boolean}
     */
    this.locked = false;
    
    /**
     * デバッグ用の識別子
     * @type {string}
     */
    this.id = Math.random().toString(36).substring(2, 15);
    
    /**
     * 統計情報
     * @type {Object}
     */
    this.stats = {
      acquireCount: 0,
      releaseCount: 0,
      maxQueueSize: 0,
      currentQueueSize: 0
    };
    
    // デバッグモードの設定
    this.debug = false;
  }
  
  /**
   * ロックを取得
   * 
   * @returns {Promise<void>} ロック取得の完了を示すPromise
   */
  async acquire() {
    this.stats.acquireCount++;
    
    if (this.debug) {
      console.log(`[AsyncMutex:${this.id}] Attempting to acquire lock, queue size: ${this.queue.length}`);
    }
    
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        if (this.debug) {
          console.log(`[AsyncMutex:${this.id}] Lock acquired immediately`);
        }
        resolve();
      } else {
        // キューに追加
        this.queue.push(resolve);
        this.stats.currentQueueSize = this.queue.length;
        this.stats.maxQueueSize = Math.max(this.stats.maxQueueSize, this.stats.currentQueueSize);
        
        if (this.debug) {
          console.log(`[AsyncMutex:${this.id}] Added to queue, position: ${this.queue.length}`);
        }
      }
    });
  }
  
  /**
   * ロックを解放
   * 
   * @throws {Error} ロックが取得されていない場合
   */
  release() {
    if (!this.locked) {
      throw new Error(`[AsyncMutex:${this.id}] Cannot release unlocked mutex`);
    }
    
    this.stats.releaseCount++;
    this.locked = false;
    
    // キューから次の待機者を取得
    const next = this.queue.shift();
    if (next) {
      this.locked = true;
      this.stats.currentQueueSize = this.queue.length;
      
      if (this.debug) {
        console.log(`[AsyncMutex:${this.id}] Lock passed to next waiter, queue size: ${this.queue.length}`);
      }
      
      // 次の待機者に制御を渡す
      next();
    } else {
      if (this.debug) {
        console.log(`[AsyncMutex:${this.id}] Lock released, no waiters`);
      }
    }
  }
  
  /**
   * 自動でロックを取得・解放するヘルパー関数
   * 
   * @param {Function} operation 実行する非同期処理
   * @returns {Promise<any>} 処理の結果
   */
  async withLock(operation) {
    await this.acquire();
    try {
      return await operation();
    } finally {
      this.release();
    }
  }
  
  /**
   * ロック状態を取得
   * 
   * @returns {boolean} ロック状態
   */
  isLocked() {
    return this.locked;
  }
  
  /**
   * 待機中のタスク数を取得
   * 
   * @returns {number} 待機中のタスク数
   */
  getQueueSize() {
    return this.queue.length;
  }
  
  /**
   * 統計情報を取得
   * 
   * @returns {Object} 統計情報
   */
  getStats() {
    return {
      ...this.stats,
      locked: this.locked,
      queueSize: this.queue.length
    };
  }
  
  /**
   * デバッグモードを設定
   * 
   * @param {boolean} enabled デバッグモードの有効/無効
   */
  setDebug(enabled) {
    this.debug = enabled;
  }
  
  /**
   * ミューテックスをリセット（テスト用）
   * 
   * @throws {Error} 本番環境では使用不可
   */
  reset() {
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      throw new Error('reset() is not allowed in production environment');
    }
    
    this.locked = false;
    this.queue = [];
    this.stats = {
      acquireCount: 0,
      releaseCount: 0,
      maxQueueSize: 0,
      currentQueueSize: 0
    };
    
    if (this.debug) {
      console.log(`[AsyncMutex:${this.id}] Reset completed`);
    }
  }
}

// CommonJS と ES6 modules の両方に対応
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AsyncMutex;
} else if (typeof window !== 'undefined') {
  window.AsyncMutex = AsyncMutex;
}