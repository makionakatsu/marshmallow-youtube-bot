/**
 * YouTube Live Chat投稿管理サービス
 * 
 * 【責任範囲】
 * - YouTube Live Chat APIとの通信制御
 * - 投稿メッセージの送信処理
 * - OAuth認証トークンの管理
 * - YouTube APIエラーハンドリング
 * - レート制限とリトライロジック
 * 
 * 【AI可読性のポイント】
 * - postMessage(), authenticateUser() など直感的なメソッド名
 * - YouTube API特有の処理を集約し、他のサービスから隠蔽
 * - エラー処理を統一し、ユーザーフレンドリーなメッセージを提供
 * 
 * 【依存関係】
 * - ConfigurationManager: API Key, Live Chat ID の取得
 * - UnifiedErrorHandler: エラーログとユーザー通知
 * - InputValidator: 投稿内容のサニタイズ
 */
class YouTubeLiveChatService {
  /**
   * コンストラクタ
   * @param {ConfigurationManager} configManager - 設定管理サービス
   * @param {UnifiedErrorHandler} errorHandler - エラーハンドリングサービス
   * @param {InputValidator} inputValidator - 入力検証サービス
   */
  constructor(configManager, errorHandler, inputValidator) {
    this.configManager = configManager;
    this.errorHandler = errorHandler;
    this.inputValidator = inputValidator;
    
    // リトライ管理
    this.retryAttempts = new Map();
    this.maxRetryAttempts = 3;
    
    // レート制限管理
    this.lastRequestTime = 0;
    this.minRequestInterval = 1000; // 1秒間隔
  }

  /**
   * YouTube Live Chatにメッセージを投稿
   * 
   * 【AI可読性】メイン機能を表現する直感的なメソッド名
   * 
   * @param {string} messageText - 投稿するメッセージ
   * @param {string} questionId - 質問ID（リトライ管理用）
   * @returns {Promise<{success: boolean, message: string}>} 投稿結果
   */
  async postMessage(messageText, questionId) {
    try {
      console.log(`[YouTubeLiveChatService] 📝 Starting post for question: ${questionId}`);
      console.log(`[YouTubeLiveChatService] 📝 Original message: "${messageText}"`);
      
      // 入力検証とサニタイズ
      const sanitizeResult = this.inputValidator.sanitizeQuestionText(messageText);
      const sanitizedText = sanitizeResult.sanitized;
      console.log(`[YouTubeLiveChatService] 📝 Sanitized message: "${sanitizedText}"`);
      
      if (sanitizeResult.hadDangerousContent) {
        console.warn('[Security] Dangerous content detected and removed');
        await this.errorHandler.handleError(
          new Error('Dangerous content in message'), 
          'YouTubeLiveChatService.postMessage'
        );
      }

      // レート制限チェック
      console.log('[YouTubeLiveChatService] ⏱️ Checking rate limit...');
      await this._enforceRateLimit();

      // 必要な認証情報を取得
      console.log('[YouTubeLiveChatService] 🔐 Getting authentication data...');
      const { liveChatId, accessToken } = await this._getAuthenticationData();
      console.log(`[YouTubeLiveChatService] 🔐 Live Chat ID: ${liveChatId ? 'SET' : 'NOT SET'}`);
      console.log(`[YouTubeLiveChatService] 🔐 Access Token: ${accessToken ? 'SET' : 'NOT SET'}`);

      // テストモードチェック
      const testMode = await this.configManager.getTestMode();
      console.log(`[YouTubeLiveChatService] 🧪 Test Mode: ${testMode ? 'ON' : 'OFF'}`);
      if (testMode) {
        console.log('🧪 TEST MODE: Skipping actual post to YouTube Live Chat');
        console.log(`🧪 Message would be: ${sanitizedText}`);
        return { success: true, message: 'Test mode - message not actually sent' };
      }

      // YouTube API呼び出し
      console.log('[YouTubeLiveChatService] 🚀 Calling YouTube API...');
      const result = await this._callYouTubeAPI(liveChatId, sanitizedText, accessToken);
      console.log('[YouTubeLiveChatService] 🚀 YouTube API call successful');
      
      // 成功時の処理
      this.retryAttempts.delete(questionId);
      console.log(`[YouTubeLiveChatService] ✅ Successfully posted: "${sanitizedText}"`);
      
      return { success: true, message: 'Message posted successfully' };

    } catch (error) {
      console.error(`[YouTubeLiveChatService] ❌ Post failed for question ${questionId}:`, error);
      return await this._handlePostError(error, questionId, messageText);
    }
  }

  /**
   * OAuth認証を実行
   * 
   * 【AI可読性】認証処理を抽象化した分かりやすいメソッド名
   * 
   * @param {boolean} interactive - インタラクティブ認証を行うか
   * @returns {Promise<string>} アクセストークン
   */
  async authenticateUser(interactive = true) {
    try {
      console.log('[YouTubeLiveChatService] Starting OAuth authentication');
      
      return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive }, (token) => {
          if (chrome.runtime.lastError) {
            console.error('OAuth Error:', chrome.runtime.lastError.message);
            reject(new Error(`OAuth failed: ${chrome.runtime.lastError.message}`));
          } else if (!token) {
            console.error('OAuth token is null or undefined');
            reject(new Error('OAuth token is null'));
          } else {
            console.log('[YouTubeLiveChatService] OAuth authentication successful');
            resolve(token);
          }
        });
      });
    } catch (error) {
      await this.errorHandler.handleError(error, 'YouTubeLiveChatService.authenticateUser');
      throw error;
    }
  }

  /**
   * 認証トークンをクリア（ログアウト）
   * 
   * 【AI可読性】認証関連の操作を直感的に表現
   */
  async clearAuthentication() {
    try {
      return new Promise((resolve) => {
        chrome.identity.clearAllCachedAuthTokens(() => {
          console.log('[YouTubeLiveChatService] Authentication tokens cleared');
          resolve();
        });
      });
    } catch (error) {
      await this.errorHandler.handleError(error, 'YouTubeLiveChatService.clearAuthentication');
      throw error;
    }
  }

  /**
   * YouTube動画情報を取得
   * 
   * 【責任範囲】YouTube Data APIを使用した動画情報取得
   * 
   * @param {string} videoId - YouTube動画ID
   * @returns {Promise<Object>} 動画情報
   */
  async getVideoInfo(videoId) {
    try {
      console.log(`[YouTubeLiveChatService] Getting video info for: ${videoId}`);
      
      const apiKey = await this.configManager.getYouTubeApiKey();
      if (!apiKey) {
        throw new Error('YouTube API Key is not configured');
      }

      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails,snippet&id=${videoId}&key=${apiKey}`
      );

      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        throw new Error('Video not found');
      }

      const videoInfo = data.items[0];
      const liveChatId = videoInfo.liveStreamingDetails?.activeLiveChatId;

      return {
        title: videoInfo.snippet.title,
        liveChatId: liveChatId,
        isLive: !!liveChatId,
        thumbnailUrl: videoInfo.snippet.thumbnails?.medium?.url
      };

    } catch (error) {
      await this.errorHandler.handleError(error, 'YouTubeLiveChatService.getVideoInfo');
      throw error;
    }
  }

  // ===========================================
  // プライベートメソッド（内部実装の詳細）
  // ===========================================

  /**
   * レート制限を適用
   * @private
   */
  async _enforceRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`[YouTubeLiveChatService] Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * 認証データを取得
   * @private
   */
  async _getAuthenticationData() {
    const [liveChatId, accessToken] = await Promise.all([
      this.configManager.getLiveChatId(),
      this.authenticateUser(true)
    ]);

    if (!liveChatId) {
      throw new Error('Live Chat ID is not configured');
    }

    if (!accessToken) {
      throw new Error('OAuth authentication failed');
    }

    return { liveChatId, accessToken };
  }

  /**
   * YouTube API呼び出し
   * @private
   */
  async _callYouTubeAPI(liveChatId, messageText, accessToken) {
    const response = await fetch(
      'https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          snippet: {
            liveChatId: liveChatId,
            type: 'textMessageEvent',
            textMessageDetails: {
              messageText: messageText
            }
          }
        })
      }
    );

    if (!response.ok) {
      await this._handleAPIError(response);
    }

    return await response.json();
  }

  /**
   * API エラー処理
   * @private
   */
  async _handleAPIError(response) {
    let errorData = {};
    try {
      errorData = await response.json();
    } catch (parseError) {
      console.warn('Failed to parse API error response:', parseError);
    }

    const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
    
    // ステータス別のエラーハンドリング
    switch (response.status) {
      case 401:
        throw new Error('AUTHENTICATION_FAILED: OAuth token expired or invalid');
      case 403:
        throw new Error('PERMISSION_DENIED: Insufficient API permissions');
      case 429:
        const retryAfter = response.headers.get('Retry-After') || 60;
        throw new Error(`RATE_LIMITED:${retryAfter}`);
      case 400:
        throw new Error(`BAD_REQUEST: ${errorMessage}`);
      default:
        throw new Error(`YouTube API Error: ${response.status} - ${errorMessage}`);
    }
  }

  /**
   * 投稿エラーの処理とリトライロジック
   * @private
   */
  async _handlePostError(error, questionId, originalMessage) {
    console.error('[YouTubeLiveChatService] Post error:', error.message);
    
    // リトライカウントを取得・更新
    const currentRetry = (this.retryAttempts.get(questionId)?.count || 0) + 1;
    this.retryAttempts.set(questionId, { 
      count: currentRetry, 
      timestamp: Date.now() 
    });

    // リトライ制限チェック
    if (currentRetry <= this.maxRetryAttempts) {
      console.warn(`[YouTubeLiveChatService] Retry ${currentRetry}/${this.maxRetryAttempts} for question: ${questionId}`);
      
      // 指数バックオフでリトライ
      const backoffDelay = Math.pow(2, currentRetry - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
      
      return await this.postMessage(originalMessage, questionId);
    }

    // リトライ回数超過
    this.retryAttempts.delete(questionId);
    await this.errorHandler.handleError(error, 'YouTubeLiveChatService.postMessage');
    
    return {
      success: false,
      error: this._getUserFriendlyErrorMessage(error)
    };
  }

  /**
   * ユーザーフレンドリーなエラーメッセージに変換
   * @private
   */
  _getUserFriendlyErrorMessage(error) {
    const errorMessage = error.message || error.toString();
    
    if (errorMessage.includes('AUTHENTICATION_FAILED')) {
      return 'YouTube認証が失敗しました。設定画面でOAuth認証を再度行ってください。';
    }
    if (errorMessage.includes('PERMISSION_DENIED')) {
      return 'YouTube APIの権限が不足しています。APIキーとOAuth設定を確認してください。';
    }
    if (errorMessage.includes('RATE_LIMITED')) {
      const seconds = errorMessage.split(':')[1] || '60';
      return `YouTube APIの制限に達しました。${seconds}秒後に再試行してください。`;
    }
    if (errorMessage.includes('BAD_REQUEST')) {
      return 'リクエストが無効です。ライブ配信が終了している可能性があります。';
    }
    if (errorMessage.includes('Live Chat ID is not configured')) {
      return 'ライブチャットIDが設定されていません。YouTube配信URLを設定してください。';
    }
    if (errorMessage.includes('OAuth authentication failed')) {
      return 'YouTube認証が完了していません。設定画面でOAuth認証を行ってください。';
    }
    
    return `YouTube投稿エラー: ${errorMessage.substring(0, 100)}`;
  }
}

// モジュールとして利用可能にする
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YouTubeLiveChatService;
} else if (typeof window !== 'undefined') {
  window.YouTubeLiveChatService = YouTubeLiveChatService;
}