/**
 * アプリケーション設定管理
 * 
 * 責任範囲:
 * - アプリケーション全体の設定の統一管理
 * - デフォルト値の定義
 * - 設定の検証とバリデーション
 * - 設定の型定義と制約
 * - 設定の階層管理
 */
class AppConfig {
  constructor() {
    /**
     * デフォルト設定
     * @type {Object}
     */
    this.defaults = {
      // YouTube API設定
      youtube: {
        apiKey: '',
        maxRetryAttempts: 3,
        retryDelay: 1000,
        timeout: 30000,
        rateLimit: {
          requestsPerMinute: 100,
          requestsPerHour: 10000
        }
      },
      
      // 投稿設定
      posting: {
        intervalSeconds: 120,
        autoMode: true,
        testMode: false,
        questionPrefix: '【質問】',
        maxMessageLength: 200,
        enableNgFilter: true
      },
      
      // キュー設定
      queue: {
        maxSize: 10000,
        cleanupInterval: 60 * 60 * 1000, // 1時間
        sortBy: 'received_at',
        sortOrder: 'asc'
      },
      
      // セキュリティ設定
      security: {
        enableEncryption: true,
        keyRotationInterval: 30 * 24 * 60 * 60 * 1000, // 30日
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000, // 15分
        enableAuditLog: true
      },
      
      // UI設定
      ui: {
        theme: 'light',
        enableMinimizeMode: true,
        enableNotifications: true,
        notificationTimeout: 5000,
        enableDebugMode: false
      },
      
      // パフォーマンス設定
      performance: {
        cacheTimeout: 5 * 60 * 1000, // 5分
        batchDelay: 100,
        maxCacheSize: 1000,
        enableVirtualScroll: true,
        virtualScrollItemHeight: 50
      },
      
      // エラー処理設定
      errorHandling: {
        enableRecovery: true,
        maxRecoveryAttempts: 3,
        recoveryDelay: 1000,
        enableErrorReporting: true,
        logLevel: 'error'
      },
      
      // 開発・デバッグ設定
      development: {
        enableDebugLogs: false,
        enablePerformanceMonitoring: false,
        enableSecurityAudit: false,
        mockMode: false
      },
      
      // NGワード設定
      ngKeywords: [],
      
      // 接続設定
      connection: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      }
    };
    
    /**
     * 設定の検証ルール
     * @type {Object}
     */
    this.validationRules = {
      'youtube.apiKey': {
        type: 'string',
        pattern: /^AIza[0-9A-Za-z-_]{35}$/,
        required: true,
        encrypted: true
      },
      'youtube.maxRetryAttempts': {
        type: 'number',
        min: 0,
        max: 10
      },
      'youtube.retryDelay': {
        type: 'number',
        min: 100,
        max: 10000
      },
      'posting.intervalSeconds': {
        type: 'number',
        min: 30,
        max: 3600
      },
      'posting.autoMode': {
        type: 'boolean'
      },
      'posting.testMode': {
        type: 'boolean'
      },
      'posting.questionPrefix': {
        type: 'string',
        maxLength: 50
      },
      'posting.maxMessageLength': {
        type: 'number',
        min: 50,
        max: 500
      },
      'queue.maxSize': {
        type: 'number',
        min: 100,
        max: 100000
      },
      'security.enableEncryption': {
        type: 'boolean'
      },
      'security.maxLoginAttempts': {
        type: 'number',
        min: 1,
        max: 20
      },
      'ui.theme': {
        type: 'string',
        enum: ['light', 'dark', 'auto']
      },
      'ui.enableNotifications': {
        type: 'boolean'
      },
      'performance.cacheTimeout': {
        type: 'number',
        min: 1000,
        max: 60 * 60 * 1000
      },
      'performance.batchDelay': {
        type: 'number',
        min: 10,
        max: 1000
      },
      'ngKeywords': {
        type: 'array',
        itemType: 'string'
      }
    };
    
    /**
     * 設定の説明
     * @type {Object}
     */
    this.descriptions = {
      'youtube.apiKey': 'YouTube Data API v3 のAPIキー',
      'youtube.maxRetryAttempts': '投稿失敗時の最大リトライ回数',
      'youtube.retryDelay': 'リトライ間隔（ミリ秒）',
      'posting.intervalSeconds': '自動投稿の間隔（秒）',
      'posting.autoMode': '自動投稿モードの有効/無効',
      'posting.testMode': 'テストモードの有効/無効',
      'posting.questionPrefix': '質問の前に付けるプレフィックス',
      'posting.maxMessageLength': '投稿メッセージの最大長',
      'queue.maxSize': '質問キューの最大サイズ',
      'security.enableEncryption': '暗号化の有効/無効',
      'security.maxLoginAttempts': '最大ログイン試行回数',
      'ui.theme': 'UIテーマ (light/dark/auto)',
      'ui.enableNotifications': '通知の有効/無効',
      'performance.cacheTimeout': 'キャッシュの有効期限（ミリ秒）',
      'performance.batchDelay': 'バッチ処理の遅延時間（ミリ秒）',
      'ngKeywords': 'NGワードのリスト'
    };
  }
  
  /**
   * 設定値を取得
   * 
   * @param {string} key 設定キー（ドット記法対応）
   * @param {any} defaultValue デフォルト値
   * @returns {any} 設定値
   */
  get(key, defaultValue = undefined) {
    const value = this.getNestedValue(this.defaults, key);
    return value !== undefined ? value : defaultValue;
  }
  
  /**
   * 設定値を設定
   * 
   * @param {string} key 設定キー
   * @param {any} value 設定値
   * @throws {Error} 検証エラー
   */
  set(key, value) {
    const validation = this.validate(key, value);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration value for ${key}: ${validation.message}`);
    }
    
    this.setNestedValue(this.defaults, key, value);
  }
  
  /**
   * 設定値を検証
   * 
   * @param {string} key 設定キー
   * @param {any} value 設定値
   * @returns {Object} 検証結果
   */
  validate(key, value) {
    const rule = this.validationRules[key];
    if (!rule) {
      return { isValid: true, message: 'No validation rule found' };
    }
    
    // 必須チェック
    if (rule.required && (value === undefined || value === null || value === '')) {
      return { isValid: false, message: 'Value is required' };
    }
    
    // 型チェック
    if (value !== undefined && value !== null) {
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (rule.type !== actualType) {
        return { isValid: false, message: `Expected ${rule.type}, got ${actualType}` };
      }
    }
    
    // 文字列の検証
    if (rule.type === 'string' && typeof value === 'string') {
      // パターンチェック
      if (rule.pattern && !rule.pattern.test(value)) {
        return { isValid: false, message: 'Value does not match required pattern' };
      }
      
      // 長さチェック
      if (rule.minLength && value.length < rule.minLength) {
        return { isValid: false, message: `Value is too short (minimum ${rule.minLength})` };
      }
      
      if (rule.maxLength && value.length > rule.maxLength) {
        return { isValid: false, message: `Value is too long (maximum ${rule.maxLength})` };
      }
      
      // 列挙値チェック
      if (rule.enum && !rule.enum.includes(value)) {
        return { isValid: false, message: `Value must be one of: ${rule.enum.join(', ')}` };
      }
    }
    
    // 数値の検証
    if (rule.type === 'number' && typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        return { isValid: false, message: `Value is too small (minimum ${rule.min})` };
      }
      
      if (rule.max !== undefined && value > rule.max) {
        return { isValid: false, message: `Value is too large (maximum ${rule.max})` };
      }
    }
    
    // 配列の検証
    if (rule.type === 'array' && Array.isArray(value)) {
      if (rule.itemType) {
        for (const item of value) {
          const itemType = typeof item;
          if (itemType !== rule.itemType) {
            return { isValid: false, message: `Array item type mismatch: expected ${rule.itemType}, got ${itemType}` };
          }
        }
      }
    }
    
    return { isValid: true, message: 'Valid' };
  }
  
  /**
   * 設定が暗号化対象かチェック
   * 
   * @param {string} key 設定キー
   * @returns {boolean} 暗号化対象かどうか
   */
  isEncrypted(key) {
    const rule = this.validationRules[key];
    return rule && rule.encrypted === true;
  }
  
  /**
   * 設定が必須かチェック
   * 
   * @param {string} key 設定キー
   * @returns {boolean} 必須かどうか
   */
  isRequired(key) {
    const rule = this.validationRules[key];
    return rule && rule.required === true;
  }
  
  /**
   * 設定の説明を取得
   * 
   * @param {string} key 設定キー
   * @returns {string} 説明
   */
  getDescription(key) {
    return this.descriptions[key] || '';
  }
  
  /**
   * 全設定を取得
   * 
   * @returns {Object} 全設定
   */
  getAll() {
    return JSON.parse(JSON.stringify(this.defaults));
  }
  
  /**
   * 設定をリセット
   * 
   * @param {string} key 設定キー（未指定の場合は全て）
   */
  reset(key = null) {
    if (key) {
      const defaultValue = this.getNestedValue(this.getOriginalDefaults(), key);
      this.setNestedValue(this.defaults, key, defaultValue);
    } else {
      this.defaults = this.getOriginalDefaults();
    }
  }
  
  /**
   * 設定をマージ
   * 
   * @param {Object} config マージする設定
   * @throws {Error} 検証エラー
   */
  merge(config) {
    const errors = [];
    
    // フラットな設定を展開
    const flatConfig = this.flattenObject(config);
    
    // 各設定を検証
    for (const [key, value] of Object.entries(flatConfig)) {
      const validation = this.validate(key, value);
      if (!validation.isValid) {
        errors.push(`${key}: ${validation.message}`);
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
    
    // 設定をマージ
    this.defaults = this.mergeDeep(this.defaults, config);
  }
  
  /**
   * 設定をエクスポート
   * 
   * @param {boolean} includeEncrypted 暗号化された設定を含むか
   * @returns {Object} エクスポートされた設定
   */
  export(includeEncrypted = false) {
    const exported = this.getAll();
    
    if (!includeEncrypted) {
      // 暗号化設定を除外
      const flat = this.flattenObject(exported);
      for (const key in flat) {
        if (this.isEncrypted(key)) {
          delete flat[key];
        }
      }
      return this.unflattenObject(flat);
    }
    
    return exported;
  }
  
  /**
   * 設定をインポート
   * 
   * @param {Object} config インポートする設定
   * @throws {Error} 検証エラー
   */
  import(config) {
    this.merge(config);
  }
  
  /**
   * 設定スキーマを取得
   * 
   * @returns {Object} スキーマ
   */
  getSchema() {
    return {
      defaults: this.getOriginalDefaults(),
      validationRules: this.validationRules,
      descriptions: this.descriptions
    };
  }
  
  // === Private Methods ===
  
  /**
   * ネストされた値を取得
   * 
   * @param {Object} obj オブジェクト
   * @param {string} path パス（ドット記法）
   * @returns {any} 値
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }
  
  /**
   * ネストされた値を設定
   * 
   * @param {Object} obj オブジェクト
   * @param {string} path パス（ドット記法）
   * @param {any} value 値
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    const target = keys.reduce((current, key) => {
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }
  
  /**
   * オブジェクトをフラット化
   * 
   * @param {Object} obj オブジェクト
   * @param {string} prefix プレフィックス
   * @returns {Object} フラット化されたオブジェクト
   */
  flattenObject(obj, prefix = '') {
    const flattened = {};
    
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          Object.assign(flattened, this.flattenObject(obj[key], newKey));
        } else {
          flattened[newKey] = obj[key];
        }
      }
    }
    
    return flattened;
  }
  
  /**
   * フラット化されたオブジェクトを展開
   * 
   * @param {Object} flat フラット化されたオブジェクト
   * @returns {Object} 展開されたオブジェクト
   */
  unflattenObject(flat) {
    const unflattened = {};
    
    for (const key in flat) {
      if (flat.hasOwnProperty(key)) {
        this.setNestedValue(unflattened, key, flat[key]);
      }
    }
    
    return unflattened;
  }
  
  /**
   * オブジェクトをディープマージ
   * 
   * @param {Object} target ターゲット
   * @param {Object} source ソース
   * @returns {Object} マージされたオブジェクト
   */
  mergeDeep(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.mergeDeep(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }
  
  /**
   * 元のデフォルト設定を取得
   * 
   * @returns {Object} 元のデフォルト設定
   */
  getOriginalDefaults() {
    // 元のデフォルト設定を再構築
    return JSON.parse(JSON.stringify({
      youtube: {
        apiKey: '',
        maxRetryAttempts: 3,
        retryDelay: 1000,
        timeout: 30000,
        rateLimit: {
          requestsPerMinute: 100,
          requestsPerHour: 10000
        }
      },
      posting: {
        intervalSeconds: 120,
        autoMode: true,
        testMode: false,
        questionPrefix: '【質問】',
        maxMessageLength: 200,
        enableNgFilter: true
      },
      queue: {
        maxSize: 10000,
        cleanupInterval: 60 * 60 * 1000,
        sortBy: 'received_at',
        sortOrder: 'asc'
      },
      security: {
        enableEncryption: true,
        keyRotationInterval: 30 * 24 * 60 * 60 * 1000,
        maxLoginAttempts: 5,
        lockoutDuration: 15 * 60 * 1000,
        enableAuditLog: true
      },
      ui: {
        theme: 'light',
        enableMinimizeMode: true,
        enableNotifications: true,
        notificationTimeout: 5000,
        enableDebugMode: false
      },
      performance: {
        cacheTimeout: 5 * 60 * 1000,
        batchDelay: 100,
        maxCacheSize: 1000,
        enableVirtualScroll: true,
        virtualScrollItemHeight: 50
      },
      errorHandling: {
        enableRecovery: true,
        maxRecoveryAttempts: 3,
        recoveryDelay: 1000,
        enableErrorReporting: true,
        logLevel: 'error'
      },
      development: {
        enableDebugLogs: false,
        enablePerformanceMonitoring: false,
        enableSecurityAudit: false,
        mockMode: false
      },
      ngKeywords: [],
      connection: {
        timeout: 30000,
        retryAttempts: 3,
        retryDelay: 1000
      }
    }));
  }
}

// CommonJS と ES6 modules の両方に対応
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AppConfig;
} else if (typeof window !== 'undefined') {
  window.AppConfig = AppConfig;
}