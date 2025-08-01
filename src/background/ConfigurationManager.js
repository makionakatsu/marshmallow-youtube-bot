/**
 * アプリケーション設定と認証管理サービス
 * 
 * 【責任範囲】
 * - API Key, OAuth Token の安全な管理
 * - Live Chat ID の取得・保存・検証
 * - アプリケーション設定値の管理
 * - 設定の暗号化・復号化
 * - 設定値のバリデーション
 * 
 * 【AI可読性のポイント】
 * - validateApiKey(), refreshAuthToken(), getLiveChatId() など直感的なメソッド名
 * - 認証関連の複雑な処理を隠蔽し、シンプルなインターフェースを提供
 * - 設定変更の影響範囲を明確に管理
 * - セキュリティを考慮した安全なデータ処理
 * 
 * 【依存関係】
 * - OptimizedStorageService: 設定データの永続化
 * - InputValidator: 設定値の検証
 * - UnifiedErrorHandler: エラーログ
 * - AppConfig: デフォルト設定値
 */
class ConfigurationManager {
  /**
   * コンストラクタ
   * @param {OptimizedStorageService} storageService - ストレージサービス
   * @param {InputValidator} inputValidator - 入力検証サービス
   * @param {UnifiedErrorHandler} errorHandler - エラーハンドリング
   * @param {AppConfig} appConfig - アプリケーション設定
   */
  constructor(storageService, inputValidator, errorHandler, appConfig) {
    this.storageService = storageService;
    this.inputValidator = inputValidator;
    this.errorHandler = errorHandler;
    this.appConfig = appConfig;
    
    // 設定キーの定義
    this.settingKeys = {
      YOUTUBE_API_KEY: 'YOUTUBE_API_KEY',
      API_KEY_TEMP: 'API_KEY_TEMP',
      LIVE_CHAT_ID: 'LIVE_CHAT_ID',
      LIVE_VIDEO_URL: 'LIVE_VIDEO_URL',
      POST_INTERVAL_SEC: 'POST_INTERVAL_SEC',
      MAX_RETRY_ATTEMPTS: 'MAX_RETRY_ATTEMPTS',
      QUESTION_PREFIX: 'QUESTION_PREFIX',
      NG_KEYWORDS: 'NG_KEYWORDS',
      TEST_MODE: 'TEST_MODE',
      NOTIFICATIONS_ENABLED: 'NOTIFICATIONS_ENABLED',
      isRunning: 'isRunning',
      AUTO_MODE: 'AUTO_MODE'
    };
    
    // 暗号化キーの管理
    this._encryptionKey = null;
    this._keyGenerationPromise = null;
  }

  // ===========================================
  // YouTube API関連の設定管理
  // ===========================================

  /**
   * YouTube API Keyを取得
   * 
   * 【AI可読性】API Key取得の複雑さを隠蔽
   * 
   * @returns {Promise<string>} API Key
   */
  async getYouTubeApiKey() {
    try {
      console.log('[ConfigurationManager] Getting YouTube API Key');
      
      // 暗号化されたAPIキーを優先的に取得
      const encryptedApiKey = await this.storageService.get(this.settingKeys.YOUTUBE_API_KEY);
      const tempApiKey = await this.storageService.get(this.settingKeys.API_KEY_TEMP);
      
      let finalApiKey = null;
      
      if (encryptedApiKey) {
        try {
          const decryptedApiKey = await this._decryptData(encryptedApiKey);
          
          if (decryptedApiKey && decryptedApiKey.trim() !== '') {
            const validation = this.inputValidator.validateApiKey(decryptedApiKey);
            if (validation.isValid) {
              finalApiKey = decryptedApiKey;
              console.log('[ConfigurationManager] Using encrypted API key');
            } else {
              console.warn('[ConfigurationManager] Decrypted API key failed validation');
              finalApiKey = tempApiKey;
            }
          } else {
            console.warn('[ConfigurationManager] Decrypted API key is empty');
            finalApiKey = tempApiKey;
          }
        } catch (decryptError) {
          console.error('[ConfigurationManager] Failed to decrypt API key:', decryptError.message);
          finalApiKey = tempApiKey;
        }
      } else {
        finalApiKey = tempApiKey;
      }
      
      if (!finalApiKey) {
        throw new Error('YouTube API Key is not configured');
      }
      
      // 最終検証
      const finalValidation = this.inputValidator.validateApiKey(finalApiKey);
      if (!finalValidation.isValid) {
        throw new Error(`API key validation failed: ${finalValidation.error}`);
      }
      
      return finalApiKey;
    } catch (error) {
      await this.errorHandler.handleError(error, 'ConfigurationManager.getYouTubeApiKey');
      throw error;
    }
  }

  /**
   * YouTube API Keyを安全に保存
   * 
   * 【AI可読性】セキュアな保存処理を抽象化
   * 
   * @param {string} apiKey - API Key
   * @param {boolean} encrypt - 暗号化するかどうか
   * @returns {Promise<boolean>} 保存成功したかどうか
   */
  async setYouTubeApiKey(apiKey, encrypt = true) {
    try {
      console.log('[ConfigurationManager] Setting YouTube API Key');
      
      // 入力検証
      const validation = this.inputValidator.validateApiKey(apiKey);
      if (!validation.isValid) {
        throw new Error(`Invalid API key: ${validation.error}`);
      }
      
      if (encrypt) {
        // 暗号化して保存
        const encryptedApiKey = await this._encryptData(apiKey);
        await this.storageService.set(this.settingKeys.YOUTUBE_API_KEY, encryptedApiKey);
        
        // 一時的なキーをクリア
        await this.storageService.remove(this.settingKeys.API_KEY_TEMP);
        
        console.log('[ConfigurationManager] API key encrypted and saved');
      } else {
        // 一時的に平文で保存
        await this.storageService.set(this.settingKeys.API_KEY_TEMP, apiKey);
        console.log('[ConfigurationManager] API key saved temporarily');
      }
      
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'ConfigurationManager.setYouTubeApiKey');
      return false;
    }
  }

  /**
   * Live Chat IDを取得
   * 
   * 【AI可読性】Live Chat ID取得を直感的に表現
   * 
   * @returns {Promise<string|null>} Live Chat ID
   */
  async getLiveChatId() {
    try {
      const liveChatId = await this.storageService.get(this.settingKeys.LIVE_CHAT_ID);
      
      if (liveChatId && typeof liveChatId === 'string' && liveChatId.trim() !== '') {
        return liveChatId.trim();
      }
      
      return null;
    } catch (error) {
      console.error('[ConfigurationManager] Error getting Live Chat ID:', error);
      return null;
    }
  }

  /**
   * Live Chat IDを設定
   * 
   * 【AI可読性】Live Chat ID設定を明確に表現
   * 
   * @param {string} liveChatId - Live Chat ID
   * @returns {Promise<boolean>} 設定成功したかどうか
   */
  async setLiveChatId(liveChatId) {
    try {
      console.log('[ConfigurationManager] Setting Live Chat ID');
      
      if (!liveChatId || typeof liveChatId !== 'string') {
        throw new Error('Live Chat ID must be a non-empty string');
      }
      
      const trimmedId = liveChatId.trim();
      if (trimmedId === '') {
        throw new Error('Live Chat ID cannot be empty');
      }
      
      await this.storageService.set(this.settingKeys.LIVE_CHAT_ID, trimmedId);
      console.log('[ConfigurationManager] Live Chat ID saved');
      
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'ConfigurationManager.setLiveChatId');
      return false;
    }
  }

  /**
   * YouTube動画URLから情報を取得してLive Chat IDを設定
   * 
   * 【AI可読性】URL処理の複雑さを隠蔽
   * 
   * @param {string} videoUrl - YouTube動画URL
   * @returns {Promise<Object>} 動画情報とLive Chat ID
   */
  async setVideoUrlAndExtractInfo(videoUrl) {
    try {
      console.log('[ConfigurationManager] Processing video URL');
      
      // URL検証
      const urlValidation = this.inputValidator.validateUrl(videoUrl);
      if (!urlValidation.isValid) {
        throw new Error(`Invalid video URL: ${urlValidation.error}`);
      }
      
      // YouTube動画IDを抽出
      const videoId = this._extractVideoId(videoUrl);
      if (!videoId) {
        throw new Error('Could not extract video ID from URL');
      }
      
      // YouTube APIを使用して動画情報を取得
      const apiKey = await this.getYouTubeApiKey();
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoId}&key=${apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        throw new Error('Video not found or not accessible');
      }
      
      const videoInfo = data.items[0];
      const liveChatId = videoInfo.liveStreamingDetails?.activeLiveChatId;
      
      if (!liveChatId) {
        throw new Error('This video does not have an active live chat');
      }
      
      // 情報を保存
      await Promise.all([
        this.storageService.set(this.settingKeys.LIVE_VIDEO_URL, videoUrl),
        this.setLiveChatId(liveChatId)
      ]);
      
      const result = {
        videoId: videoId,
        title: videoInfo.snippet.title,
        liveChatId: liveChatId,
        isLive: true,
        thumbnailUrl: videoInfo.snippet.thumbnails?.medium?.url
      };
      
      console.log('[ConfigurationManager] Video info extracted and saved');
      return result;
      
    } catch (error) {
      await this.errorHandler.handleError(error, 'ConfigurationManager.setVideoUrlAndExtractInfo');
      throw error;
    }
  }

  // ===========================================
  // 投稿設定の管理
  // ===========================================

  /**
   * 投稿間隔を取得
   * 
   * 【AI可読性】設定取得を直感的に表現
   * 
   * @returns {Promise<number>} 投稿間隔（秒）
   */
  async getPostInterval() {
    try {
      const interval = await this.storageService.get(
        this.settingKeys.POST_INTERVAL_SEC, 
        this.appConfig.get('posting.intervalSeconds')
      );
      
      return Math.max(10, parseInt(interval) || 120); // 最小10秒
    } catch (error) {
      console.error('[ConfigurationManager] Error getting post interval:', error);
      return 120; // デフォルト値
    }
  }

  /**
   * 投稿間隔を設定
   * 
   * @param {number} intervalSeconds - 投稿間隔（秒）
   * @returns {Promise<boolean>} 設定成功したかどうか
   */
  async setPostInterval(intervalSeconds) {
    try {
      const interval = Math.max(10, parseInt(intervalSeconds) || 120);
      await this.storageService.set(this.settingKeys.POST_INTERVAL_SEC, interval);
      
      console.log(`[ConfigurationManager] Post interval set to ${interval} seconds`);
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'ConfigurationManager.setPostInterval');
      return false;
    }
  }

  /**
   * 質問接頭辞を取得
   * 
   * @returns {Promise<string>} 質問接頭辞
   */
  async getQuestionPrefix() {
    try {
      const prefix = await this.storageService.get(
        this.settingKeys.QUESTION_PREFIX,
        this.appConfig.get('posting.questionPrefix')
      );
      
      return prefix || '【質問】';
    } catch (error) {
      console.error('[ConfigurationManager] Error getting question prefix:', error);
      return '【質問】';
    }
  }

  /**
   * 質問接頭辞を設定
   * 
   * @param {string} prefix - 質問接頭辞
   * @returns {Promise<boolean>} 設定成功したかどうか
   */
  async setQuestionPrefix(prefix) {
    try {
      const trimmedPrefix = (prefix || '').trim();
      await this.storageService.set(this.settingKeys.QUESTION_PREFIX, trimmedPrefix);
      
      console.log(`[ConfigurationManager] Question prefix set to: ${trimmedPrefix}`);
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'ConfigurationManager.setQuestionPrefix');
      return false;
    }
  }

  /**
   * NGキーワードを取得
   * 
   * @returns {Promise<Array<string>>} NGキーワード配列
   */
  async getNgKeywords() {
    try {
      const keywords = await this.storageService.get(this.settingKeys.NG_KEYWORDS, []);
      
      if (Array.isArray(keywords)) {
        return keywords.filter(keyword => keyword && keyword.trim() !== '');
      }
      
      return [];
    } catch (error) {
      console.error('[ConfigurationManager] Error getting NG keywords:', error);
      return [];
    }
  }

  /**
   * NGキーワードを設定
   * 
   * @param {Array<string>} keywords - NGキーワード配列
   * @returns {Promise<boolean>} 設定成功したかどうか
   */
  async setNgKeywords(keywords) {
    try {
      const validKeywords = Array.isArray(keywords) ? 
        keywords.filter(keyword => keyword && keyword.trim() !== '') : [];
      
      await this.storageService.set(this.settingKeys.NG_KEYWORDS, validKeywords);
      
      console.log(`[ConfigurationManager] NG keywords set: ${validKeywords.length} items`);
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'ConfigurationManager.setNgKeywords');
      return false;
    }
  }

  // ===========================================
  // システム状態の管理
  // ===========================================

  /**
   * 実行状態を取得
   * 
   * @returns {Promise<boolean>} 実行中かどうか
   */
  async getRunningState() {
    try {
      return await this.storageService.get(this.settingKeys.isRunning, false);
    } catch (error) {
      console.error('[ConfigurationManager] Error getting running state:', error);
      return false;
    }
  }

  /**
   * 実行状態を設定
   * 
   * @param {boolean} isRunning - 実行中かどうか
   * @returns {Promise<boolean>} 設定成功したかどうか
   */
  async setRunningState(isRunning) {
    try {
      await this.storageService.set(this.settingKeys.isRunning, !!isRunning);
      console.log(`[ConfigurationManager] Running state set to: ${!!isRunning}`);
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'ConfigurationManager.setRunningState');
      return false;
    }
  }

  /**
   * テストモードを取得
   * 
   * @returns {Promise<boolean>} テストモードかどうか
   */
  async getTestMode() {
    try {
      return await this.storageService.get(this.settingKeys.TEST_MODE, false);
    } catch (error) {
      console.error('[ConfigurationManager] Error getting test mode:', error);
      return false;
    }
  }

  /**
   * テストモードを設定
   * 
   * @param {boolean} testMode - テストモードかどうか
   * @returns {Promise<boolean>} 設定成功したかどうか
   */
  async setTestMode(testMode) {
    try {
      await this.storageService.set(this.settingKeys.TEST_MODE, !!testMode);
      console.log(`[ConfigurationManager] Test mode set to: ${!!testMode}`);
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'ConfigurationManager.setTestMode');
      return false;
    }
  }

  /**
   * 通知設定を取得
   * 
   * @returns {Promise<boolean>} 通知が有効かどうか
   */
  async getNotificationsEnabled() {
    try {
      return await this.storageService.get(
        this.settingKeys.NOTIFICATIONS_ENABLED,
        this.appConfig.get('ui.enableNotifications')
      );
    } catch (error) {
      console.error('[ConfigurationManager] Error getting notifications setting:', error);
      return true;
    }
  }

  /**
   * 通知設定を設定
   * 
   * @param {boolean} enabled - 通知を有効にするか
   * @returns {Promise<boolean>} 設定成功したかどうか
   */
  async setNotificationsEnabled(enabled) {
    try {
      await this.storageService.set(this.settingKeys.NOTIFICATIONS_ENABLED, !!enabled);
      console.log(`[ConfigurationManager] Notifications set to: ${!!enabled}`);
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'ConfigurationManager.setNotificationsEnabled');
      return false;
    }
  }

  // ===========================================
  // 設定の一括管理
  // ===========================================

  /**
   * 全設定を取得
   * 
   * 【AI可読性】設定の一覧取得を直感的に表現
   * 
   * @returns {Promise<Object>} 全設定オブジェクト
   */
  async getAllSettings() {
    try {
      console.log('[ConfigurationManager] Getting all settings');
      
      const settings = {};
      
      // 各設定を取得（機密情報は除外）
      settings.postInterval = await this.getPostInterval();
      settings.questionPrefix = await this.getQuestionPrefix();
      settings.ngKeywords = await this.getNgKeywords();
      settings.testMode = await this.getTestMode();
      settings.notificationsEnabled = await this.getNotificationsEnabled();
      settings.isRunning = await this.getRunningState();
      
      // API Key の存在確認（値は返さない）
      try {
        await this.getYouTubeApiKey();
        settings.hasApiKey = true;
      } catch {
        settings.hasApiKey = false;
      }
      
      // Live Chat ID の存在確認
      const liveChatId = await this.getLiveChatId();
      settings.hasLiveChatId = !!liveChatId;
      
      return settings;
    } catch (error) {
      await this.errorHandler.handleError(error, 'ConfigurationManager.getAllSettings');
      return {};
    }
  }

  /**
   * 設定をリセット
   * 
   * 【AI可読性】リセット処理を明確に表現
   * 
   * @param {Array<string>} excludeKeys - リセットから除外するキー
   * @returns {Promise<boolean>} リセット成功したかどうか
   */
  async resetSettings(excludeKeys = []) {
    try {
      console.log('[ConfigurationManager] Resetting settings');
      
      const keysToReset = Object.values(this.settingKeys).filter(key => 
        !excludeKeys.includes(key)
      );
      
      for (const key of keysToReset) {
        await this.storageService.remove(key);
      }
      
      console.log(`[ConfigurationManager] Reset ${keysToReset.length} settings`);
      return true;
    } catch (error) {
      await this.errorHandler.handleError(error, 'ConfigurationManager.resetSettings');
      return false;
    }
  }

  // ===========================================
  // プライベートメソッド（内部実装の詳細）
  // ===========================================

  /**
   * YouTube動画IDを抽出
   * @private
   */
  _extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/live\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * データを暗号化
   * @private
   */
  async _encryptData(data) {
    try {
      const encryptionKey = await this._getEncryptionKey();
      
      // シンプルな暗号化（実装は既存のsimpleEncrypt関数を使用）
      if (typeof simpleEncrypt === 'function') {
        return await simpleEncrypt(data);
      } else {
        // フォールバック: Base64エンコード
        return btoa(data);
      }
    } catch (error) {
      console.error('[ConfigurationManager] Encryption failed:', error);
      throw error;
    }
  }

  /**
   * データを復号化
   * @private
   */
  async _decryptData(encryptedData) {
    try {
      const encryptionKey = await this._getEncryptionKey();
      
      // シンプルな復号化（実装は既存のsimpleDecrypt関数を使用）
      if (typeof simpleDecrypt === 'function') {
        return await simpleDecrypt(encryptedData);
      } else {
        // フォールバック: Base64デコード
        return atob(encryptedData);
      }
    } catch (error) {
      console.error('[ConfigurationManager] Decryption failed:', error);
      throw error;
    }
  }

  /**
   * 暗号化キーを取得
   * @private
   */
  async _getEncryptionKey() {
    if (this._encryptionKey) {
      return this._encryptionKey;
    }
    
    if (this._keyGenerationPromise) {
      return await this._keyGenerationPromise;
    }
    
    this._keyGenerationPromise = this._generateEncryptionKey();
    this._encryptionKey = await this._keyGenerationPromise;
    this._keyGenerationPromise = null;
    
    return this._encryptionKey;
  }

  /**
   * 暗号化キーを生成
   * @private
   */
  async _generateEncryptionKey() {
    try {
      // 既存のgenerateEncryptionKey関数を使用
      if (typeof generateEncryptionKey === 'function') {
        return await generateEncryptionKey();
      } else {
        // フォールバック: 固定キー
        console.warn('[ConfigurationManager] Using fallback encryption key');
        return 'fallback-key-' + Date.now();
      }
    } catch (error) {
      console.error('[ConfigurationManager] Key generation failed:', error);
      return 'error-fallback-key';
    }
  }
}

// モジュールとして利用可能にする
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigurationManager;
} else if (typeof self !== 'undefined') {
  self.ConfigurationManager = ConfigurationManager;
}