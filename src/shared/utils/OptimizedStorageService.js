/**
 * 最適化されたChrome Storage サービス
 * 
 * 責任範囲:
 * - Chrome Storage APIの抽象化
 * - キャッシュ機能による高速化
 * - バッチ処理による効率化
 * - エラーハンドリングの統一
 * 
 * 特徴:
 * - メモリキャッシュによる高速アクセス
 * - 書き込みのバッチ処理
 * - 統計情報の収集
 * - エラーの詳細な記録
 */
class OptimizedStorageService {
  constructor() {
    /**
     * メモリキャッシュ
     * @type {Map<string, any>}
     */
    this.cache = new Map();
    
    /**
     * 保留中の書き込み操作
     * @type {Map<string, any>}
     */
    this.pendingWrites = new Map();
    
    /**
     * バッチ処理用のタイマー
     * @type {NodeJS.Timeout|null}
     */
    this.batchTimeout = null;
    
    /**
     * キャッシュの有効期限管理
     * @type {Map<string, number>}
     */
    this.cacheTimestamps = new Map();
    
    /**
     * 統計情報
     * @type {Object}
     */
    this.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      reads: 0,
      writes: 0,
      batchWrites: 0,
      errors: 0
    };
    
    /**
     * 設定
     * @type {Object}
     */
    this.config = {
      batchDelay: 100,           // バッチ処理の遅延時間（ms）
      cacheTimeout: 5 * 60 * 1000, // キャッシュの有効期限（5分）
      maxCacheSize: 1000,        // 最大キャッシュサイズ
      enableDebug: false         // デバッグモード
    };
    
    // Chrome Storage の変更を監視
    this.setupStorageListener();
  }
  
  /**
   * データを取得（キャッシュ優先）
   * 
   * @param {string} key 取得するキー
   * @param {any} defaultValue デフォルト値
   * @returns {Promise<any>} 取得されたデータ
   */
  async get(key, defaultValue = undefined) {
    this.stats.reads++;
    
    try {
      // キャッシュの確認
      if (this.isValidCache(key)) {
        this.stats.cacheHits++;
        const value = this.cache.get(key);
        
        if (this.config.enableDebug) {
          console.log(`[OptimizedStorageService] Cache hit for key: ${key}`);
        }
        
        return value;
      }
      
      // キャッシュミス - Chrome Storage から読み込み
      this.stats.cacheMisses++;
      const result = await this.readFromStorage(key);
      const value = result[key] !== undefined ? result[key] : defaultValue;
      
      // キャッシュに保存
      this.setCacheValue(key, value);
      
      if (this.config.enableDebug) {
        console.log(`[OptimizedStorageService] Cache miss for key: ${key}, loaded from storage`);
      }
      
      return value;
      
    } catch (error) {
      this.stats.errors++;
      console.error(`[OptimizedStorageService] Error getting key ${key}:`, error);
      throw new Error(`Failed to get storage key ${key}: ${error.message}`);
    }
  }
  
  /**
   * データを設定（バッチ処理）
   * 
   * @param {string} key 設定するキー
   * @param {any} value 設定する値
   * @returns {Promise<void>}
   */
  async set(key, value) {
    this.stats.writes++;
    
    try {
      // キャッシュを更新
      this.setCacheValue(key, value);
      
      // バッチ処理キューに追加
      this.pendingWrites.set(key, value);
      
      if (this.config.enableDebug) {
        console.log(`[OptimizedStorageService] Queued write for key: ${key}`);
      }
      
      // バッチ処理をスケジュール
      this.scheduleBatchWrite();
      
    } catch (error) {
      this.stats.errors++;
      console.error(`[OptimizedStorageService] Error setting key ${key}:`, error);
      throw new Error(`Failed to set storage key ${key}: ${error.message}`);
    }
  }
  
  /**
   * 複数のデータを一括取得
   * 
   * @param {string[]} keys 取得するキーの配列
   * @returns {Promise<Map<string, any>>} 取得されたデータのマップ
   */
  async getMultiple(keys) {
    const results = new Map();
    const uncachedKeys = [];
    
    // キャッシュから取得可能なものを先に処理
    for (const key of keys) {
      if (this.isValidCache(key)) {
        results.set(key, this.cache.get(key));
        this.stats.cacheHits++;
      } else {
        uncachedKeys.push(key);
      }
    }
    
    // キャッシュにないものをまとめて取得
    if (uncachedKeys.length > 0) {
      try {
        const storageData = await this.readFromStorage(uncachedKeys);
        
        for (const key of uncachedKeys) {
          const value = storageData[key];
          results.set(key, value);
          this.setCacheValue(key, value);
          this.stats.cacheMisses++;
        }
      } catch (error) {
        this.stats.errors++;
        throw new Error(`Failed to get multiple storage keys: ${error.message}`);
      }
    }
    
    return results;
  }
  
  /**
   * 複数のデータを一括設定
   * 
   * @param {Map<string, any>} data 設定するデータのマップ
   * @returns {Promise<void>}
   */
  async setMultiple(data) {
    try {
      // キャッシュとバッチキューを更新
      for (const [key, value] of data) {
        this.setCacheValue(key, value);
        this.pendingWrites.set(key, value);
        this.stats.writes++;
      }
      
      // バッチ処理をスケジュール
      this.scheduleBatchWrite();
      
    } catch (error) {
      this.stats.errors++;
      throw new Error(`Failed to set multiple storage keys: ${error.message}`);
    }
  }
  
  /**
   * データを削除
   * 
   * @param {string} key 削除するキー
   * @returns {Promise<void>}
   */
  async remove(key) {
    try {
      // キャッシュから削除
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      
      // バッチキューから削除
      this.pendingWrites.delete(key);
      
      // Chrome Storage から削除
      await this.removeFromStorage(key);
      
      if (this.config.enableDebug) {
        console.log(`[OptimizedStorageService] Removed key: ${key}`);
      }
      
    } catch (error) {
      this.stats.errors++;
      throw new Error(`Failed to remove storage key ${key}: ${error.message}`);
    }
  }
  
  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
    
    if (this.config.enableDebug) {
      console.log('[OptimizedStorageService] Cache cleared');
    }
  }
  
  /**
   * 保留中の書き込みを強制実行
   * 
   * @returns {Promise<void>}
   */
  async flushPendingWrites() {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    
    await this.flushWrites();
  }
  
  /**
   * Storage変更を監視
   * 
   * @param {Function} callback 変更時のコールバック
   */
  onChanged(callback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
          callback(changes);
        }
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
      cacheSize: this.cache.size,
      pendingWrites: this.pendingWrites.size,
      cacheHitRate: this.stats.reads > 0 ? (this.stats.cacheHits / this.stats.reads * 100).toFixed(2) + '%' : '0%'
    };
  }
  
  /**
   * 設定を更新
   * 
   * @param {Object} newConfig 新しい設定
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
  
  // === Private Methods ===
  
  /**
   * キャッシュの有効性をチェック
   * 
   * @param {string} key キー
   * @returns {boolean} キャッシュが有効かどうか
   */
  isValidCache(key) {
    if (!this.cache.has(key)) {
      return false;
    }
    
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) {
      return false;
    }
    
    const now = Date.now();
    if (now - timestamp > this.config.cacheTimeout) {
      // 期限切れのキャッシュを削除
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * キャッシュに値を設定
   * 
   * @param {string} key キー
   * @param {any} value 値
   */
  setCacheValue(key, value) {
    // キャッシュサイズ制限をチェック
    if (this.cache.size >= this.config.maxCacheSize) {
      // 最も古いエントリを削除
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.cacheTimestamps.delete(oldestKey);
    }
    
    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }
  
  /**
   * Chrome Storage から読み込み
   * 
   * @param {string|string[]} key キーまたはキーの配列
   * @returns {Promise<Object>} 読み込み結果
   */
  readFromStorage(key) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        reject(new Error('Chrome Storage API is not available'));
        return;
      }
      
      chrome.storage.local.get(key, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Chrome Storage error: ${chrome.runtime.lastError.message}`));
        } else {
          resolve(result);
        }
      });
    });
  }
  
  /**
   * Chrome Storage に書き込み
   * 
   * @param {Object} data 書き込みデータ
   * @returns {Promise<void>}
   */
  writeToStorage(data) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        reject(new Error('Chrome Storage API is not available'));
        return;
      }
      
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Chrome Storage error: ${chrome.runtime.lastError.message}`));
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Chrome Storage から削除
   * 
   * @param {string} key キー
   * @returns {Promise<void>}
   */
  removeFromStorage(key) {
    return new Promise((resolve, reject) => {
      if (typeof chrome === 'undefined' || !chrome.storage) {
        reject(new Error('Chrome Storage API is not available'));
        return;
      }
      
      chrome.storage.local.remove(key, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Chrome Storage error: ${chrome.runtime.lastError.message}`));
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * バッチ書き込みをスケジュール
   */
  scheduleBatchWrite() {
    if (this.batchTimeout) {
      return; // 既にスケジュール済み
    }
    
    this.batchTimeout = setTimeout(() => {
      this.flushWrites();
    }, this.config.batchDelay);
  }
  
  /**
   * 保留中の書き込みを実行
   * 
   * @returns {Promise<void>}
   */
  async flushWrites() {
    this.batchTimeout = null;
    
    if (this.pendingWrites.size === 0) {
      return;
    }
    
    try {
      const writes = Object.fromEntries(this.pendingWrites);
      await this.writeToStorage(writes);
      
      this.stats.batchWrites++;
      this.pendingWrites.clear();
      
      if (this.config.enableDebug) {
        console.log(`[OptimizedStorageService] Batch write completed: ${Object.keys(writes).length} keys`);
      }
      
    } catch (error) {
      this.stats.errors++;
      console.error('[OptimizedStorageService] Batch write failed:', error);
      throw error;
    }
  }
  
  /**
   * Storage変更の監視を設定
   */
  setupStorageListener() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
          // 変更されたキーのキャッシュを無効化
          for (const key in changes) {
            if (this.cache.has(key)) {
              this.cache.delete(key);
              this.cacheTimestamps.delete(key);
              
              if (this.config.enableDebug) {
                console.log(`[OptimizedStorageService] Cache invalidated for key: ${key}`);
              }
            }
          }
        }
      });
    }
  }
}

// CommonJS と ES6 modules の両方に対応
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OptimizedStorageService;
} else {
  // 環境に応じてグローバルオブジェクトを選択
  const globalObj = (typeof window !== 'undefined') ? window : self;
  globalObj.OptimizedStorageService = OptimizedStorageService;
}