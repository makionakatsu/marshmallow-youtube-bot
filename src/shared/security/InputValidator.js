/**
 * 入力検証とサニタイゼーション
 * 
 * 責任範囲:
 * - 入力データの検証
 * - XSS防止のためのサニタイゼーション
 * - URL検証とホワイトリスト
 * - APIキーの形式検証
 * - 悪意のあるコンテンツの検出
 */
class InputValidator {
  constructor() {
    /**
     * 許可されたドメインのホワイトリスト
     * @type {string[]}
     */
    this.allowedDomains = [
      'youtube.com',
      'www.youtube.com',
      'youtu.be',
      'm.youtube.com'
    ];
    
    /**
     * YouTube APIキーの形式パターン
     * @type {RegExp}
     */
    this.apiKeyPattern = /^AIza[0-9A-Za-z-_]{35}$/;
    
    /**
     * 危険なパターン
     * @type {RegExp[]}
     */
    this.dangerousPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi,
      /data:text\/html/gi,
      /data:text\/javascript/gi
    ];
    
    /**
     * 統計情報
     * @type {Object}
     */
    this.stats = {
      validationCount: 0,
      sanitizationCount: 0,
      blockedAttempts: 0,
      detectedThreats: 0
    };
  }
  
  /**
   * YouTube URLを検証
   * 
   * @param {string} url 検証対象のURL
   * @returns {Object} 検証結果
   */
  validateYouTubeUrl(url) {
    this.stats.validationCount++;
    
    try {
      // 基本的な形式チェック
      if (!url || typeof url !== 'string') {
        return {
          isValid: false,
          error: 'URL is required and must be a string',
          videoId: null
        };
      }
      
      // URL長さの制限
      if (url.length > 2000) {
        this.stats.blockedAttempts++;
        return {
          isValid: false,
          error: 'URL is too long',
          videoId: null
        };
      }
      
      // 危険なパターンのチェック
      if (this.containsDangerousPattern(url)) {
        this.stats.detectedThreats++;
        this.stats.blockedAttempts++;
        return {
          isValid: false,
          error: 'URL contains potentially dangerous content',
          videoId: null
        };
      }
      
      const urlObj = new URL(url);
      
      // ドメインのホワイトリストチェック
      if (!this.allowedDomains.includes(urlObj.hostname)) {
        this.stats.blockedAttempts++;
        return {
          isValid: false,
          error: `Domain ${urlObj.hostname} is not allowed`,
          videoId: null
        };
      }
      
      // プロトコルチェック
      if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
        this.stats.blockedAttempts++;
        return {
          isValid: false,
          error: 'Invalid protocol. Only HTTP and HTTPS are allowed',
          videoId: null
        };
      }
      
      // Video IDを抽出
      const videoId = this.extractVideoId(urlObj);
      if (!videoId) {
        return {
          isValid: false,
          error: 'Could not extract video ID from URL',
          videoId: null
        };
      }
      
      // Video IDの形式チェック
      if (!this.validateVideoId(videoId)) {
        return {
          isValid: false,
          error: 'Invalid video ID format',
          videoId: null
        };
      }
      
      return {
        isValid: true,
        error: null,
        videoId: videoId,
        sanitizedUrl: urlObj.toString()
      };
      
    } catch (error) {
      this.stats.blockedAttempts++;
      return {
        isValid: false,
        error: 'Invalid URL format',
        videoId: null
      };
    }
  }
  
  /**
   * Video IDを抽出
   * 
   * @param {URL} urlObj URLオブジェクト
   * @returns {string|null} Video ID
   */
  extractVideoId(urlObj) {
    // watch?v=VIDEO_ID または live_chat?v=VIDEO_ID の形式
    const videoIdParam = urlObj.searchParams.get('v');
    if (videoIdParam) {
      return videoIdParam;
    }
    
    // youtu.be ショートURL対応
    if (urlObj.hostname === 'youtu.be') {
      return urlObj.pathname.substring(1);
    }
    
    // youtube.com/live/VIDEO_ID の形式
    const livePathMatch = urlObj.pathname.match(/\/live\/([a-zA-Z0-9_-]+)/);
    if (livePathMatch && livePathMatch[1]) {
      return livePathMatch[1];
    }
    
    // youtube.com/watch/VIDEO_ID の形式
    const watchPathMatch = urlObj.pathname.match(/\/watch\/([a-zA-Z0-9_-]+)/);
    if (watchPathMatch && watchPathMatch[1]) {
      return watchPathMatch[1];
    }
    
    return null;
  }
  
  /**
   * Video IDの形式を検証
   * 
   * @param {string} videoId Video ID
   * @returns {boolean} 有効かどうか
   */
  validateVideoId(videoId) {
    // YouTubeのVideo IDは通常11文字
    if (!videoId || videoId.length !== 11) {
      return false;
    }
    
    // 英数字、ハイフン、アンダースコアのみ許可
    return /^[a-zA-Z0-9_-]+$/.test(videoId);
  }
  
  /**
   * APIキーの形式を検証
   * 
   * @param {string} apiKey APIキー
   * @returns {Object} 検証結果
   */
  validateApiKey(apiKey) {
    this.stats.validationCount++;
    
    if (!apiKey || typeof apiKey !== 'string') {
      return {
        isValid: false,
        error: 'API key is required and must be a string'
      };
    }
    
    // 危険なパターンのチェック
    if (this.containsDangerousPattern(apiKey)) {
      this.stats.detectedThreats++;
      this.stats.blockedAttempts++;
      return {
        isValid: false,
        error: 'API key contains potentially dangerous content'
      };
    }
    
    // 形式チェック
    if (!this.apiKeyPattern.test(apiKey)) {
      return {
        isValid: false,
        error: 'Invalid API key format'
      };
    }
    
    return {
      isValid: true,
      error: null
    };
  }
  
  /**
   * 質問テキストをサニタイズ
   * 
   * @param {string} text 質問テキスト
   * @returns {Object} サニタイズ結果
   */
  sanitizeQuestionText(text) {
    this.stats.sanitizationCount++;
    
    if (!text || typeof text !== 'string') {
      return {
        sanitized: '',
        originalLength: 0,
        sanitizedLength: 0,
        wasModified: false
      };
    }
    
    const original = text;
    let sanitized = text;
    
    // 危険なパターンの除去
    const hadDangerousPattern = this.containsDangerousPattern(sanitized);
    if (hadDangerousPattern) {
      this.stats.detectedThreats++;
      for (const pattern of this.dangerousPatterns) {
        sanitized = sanitized.replace(pattern, '');
      }
    }
    
    // 基本的なHTMLエスケープ
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\\/g, '&#92;');
    
    // 制御文字の除去
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    // 改行を半角スペースに変換
    sanitized = sanitized.replace(/\n/g, ' ');
    
    // 連続する空白を単一の空白に変換
    sanitized = sanitized.replace(/\s+/g, ' ');
    
    // 前後の空白を削除
    sanitized = sanitized.trim();
    
    // 最大長制限
    const maxLength = 200;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
    }
    
    return {
      sanitized: sanitized,
      originalLength: original.length,
      sanitizedLength: sanitized.length,
      wasModified: original !== sanitized,
      hadDangerousContent: hadDangerousPattern
    };
  }
  
  /**
   * NGワードのリストを検証
   * 
   * @param {Array} keywords NGワードリスト
   * @returns {Object} 検証結果
   */
  validateNgKeywords(keywords) {
    this.stats.validationCount++;
    
    if (!Array.isArray(keywords)) {
      return {
        isValid: false,
        error: 'NG keywords must be an array'
      };
    }
    
    const sanitizedKeywords = [];
    const errors = [];
    
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i];
      
      if (typeof keyword !== 'string') {
        errors.push(`Item ${i} is not a string`);
        continue;
      }
      
      if (keyword.length > 100) {
        errors.push(`Item ${i} is too long (max 100 characters)`);
        continue;
      }
      
      // 危険なパターンのチェック
      if (this.containsDangerousPattern(keyword)) {
        this.stats.detectedThreats++;
        errors.push(`Item ${i} contains potentially dangerous content`);
        continue;
      }
      
      sanitizedKeywords.push(keyword.trim());
    }
    
    return {
      isValid: errors.length === 0,
      error: errors.length > 0 ? errors.join(', ') : null,
      sanitizedKeywords: sanitizedKeywords
    };
  }
  
  /**
   * 設定値を検証
   * 
   * @param {string} key 設定キー
   * @param {any} value 設定値
   * @returns {Object} 検証結果
   */
  validateConfigValue(key, value) {
    this.stats.validationCount++;
    
    // 危険なキーの検出
    if (this.containsDangerousPattern(key)) {
      this.stats.detectedThreats++;
      this.stats.blockedAttempts++;
      return {
        isValid: false,
        error: 'Configuration key contains potentially dangerous content'
      };
    }
    
    // 値の検証
    if (typeof value === 'string' && this.containsDangerousPattern(value)) {
      this.stats.detectedThreats++;
      this.stats.blockedAttempts++;
      return {
        isValid: false,
        error: 'Configuration value contains potentially dangerous content'
      };
    }
    
    return {
      isValid: true,
      error: null
    };
  }
  
  /**
   * 危険なパターンが含まれているかチェック
   * 
   * @param {string} text チェック対象のテキスト
   * @returns {boolean} 危険なパターンが含まれているかどうか
   */
  containsDangerousPattern(text) {
    if (!text || typeof text !== 'string') {
      return false;
    }
    
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * 統計情報を取得
   * 
   * @returns {Object} 統計情報
   */
  getStats() {
    return {
      ...this.stats,
      threatDetectionRate: this.stats.validationCount > 0 ? 
        (this.stats.detectedThreats / this.stats.validationCount * 100).toFixed(2) + '%' : '0%'
    };
  }
  
  /**
   * 統計をリセット
   */
  resetStats() {
    this.stats = {
      validationCount: 0,
      sanitizationCount: 0,
      blockedAttempts: 0,
      detectedThreats: 0
    };
  }
  
  /**
   * 許可されたドメインを追加
   * 
   * @param {string} domain ドメイン
   */
  addAllowedDomain(domain) {
    if (domain && typeof domain === 'string' && !this.allowedDomains.includes(domain)) {
      this.allowedDomains.push(domain);
    }
  }
  
  /**
   * 危険なパターンを追加
   * 
   * @param {RegExp} pattern パターン
   */
  addDangerousPattern(pattern) {
    if (pattern instanceof RegExp) {
      this.dangerousPatterns.push(pattern);
    }
  }
}

// CommonJS と ES6 modules の両方に対応
if (typeof module !== 'undefined' && module.exports) {
  module.exports = InputValidator;
} else {
  // 環境に応じてグローバルオブジェクトを選択
  const globalObj = (typeof window !== 'undefined') ? window : self;
  globalObj.InputValidator = InputValidator;
}