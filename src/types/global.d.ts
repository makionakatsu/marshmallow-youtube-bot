/**
 * グローバル型定義
 */

// アプリケーション全体で使用される型定義
declare global {
  interface Window {
    VirtualScrollManager?: any;
    AsyncMutex?: any;
    OptimizedStorageService?: any;
    UnifiedErrorHandler?: any;
    InputValidator?: any;
    AppConfig?: any;
    TestRunner?: any;
    setupTestEnvironment?: any;
    MockChromeStorage?: any;
  }
  
  // YouTube API 関連の型定義
  interface YouTubeVideo {
    id: string;
    title: string;
    thumbnailUrl: string;
    isLive: boolean;
    liveChatId?: string;
    channelId?: string;
    channelTitle?: string;
    publishedAt?: string;
    duration?: string;
    viewCount?: number;
    likeCount?: number;
    description?: string;
  }
  
  interface YouTubeLiveChatMessage {
    id: string;
    authorDisplayName: string;
    authorChannelId: string;
    messageText: string;
    publishedAt: string;
    type: 'textMessage' | 'fanFundingEvent' | 'newSponsorEvent' | 'memberMilestoneEvent' | 'membershipGiftingEvent' | 'giftMembershipReceivedEvent' | 'messageDeletedEvent' | 'messageRetractedEvent' | 'userBannedEvent' | 'superChatEvent' | 'superStickerEvent';
    authorIsChatOwner: boolean;
    authorIsChatModerator: boolean;
    authorIsChatSponsor: boolean;
    authorChannelUrl?: string;
    profileImageUrl?: string;
  }
  
  // マシュマロ関連の型定義
  interface MarshmallowQuestion {
    id: string;
    text: string;
    received_at: string;
    status: 'pending' | 'next' | 'sent' | 'skipped';
    sent_at?: string;
    skipped_reason?: string;
    priority?: number;
    metadata?: {
      source?: string;
      category?: string;
      tags?: string[];
    };
  }
  
  interface MarshmallowApiResponse {
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
  }
  
  // Chrome Extension 関連の型定義
  interface ChromeMessage {
    action: string;
    data?: any;
    [key: string]: any;
  }
  
  interface ChromeMessageResponse {
    success: boolean;
    data?: any;
    error?: string;
    message?: string;
  }
  
  // 設定関連の型定義
  interface AppSettings {
    YOUTUBE_API_KEY?: string;
    LIVE_CHAT_ID?: string;
    LIVE_VIDEO_INFO?: YouTubeVideo;
    POLLING_INTERVAL?: number;
    MAX_RETRY_COUNT?: number;
    DEBUG_MODE?: boolean;
    TEST_MODE?: boolean;
    AUTO_MODE?: boolean;
    MARSHMALLOW_CONNECTION_STATUS?: 'connected' | 'disconnected' | 'logged_out';
    questionQueue?: MarshmallowQuestion[];
    isRunning?: boolean;
    isMinimized?: boolean;
  }
  
  // エラー関連の型定義
  interface ErrorInfo {
    errorType: string;
    message: string;
    context: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    isRetryable: boolean;
    userMessage: string;
    recoveryAction?: string;
    timestamp: string;
    stack?: string;
  }
  
  interface ErrorStats {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByContext: Record<string, number>;
    errorRate: string;
    lastError?: ErrorInfo;
  }
  
  // バリデーション関連の型定義
  interface ValidationResult {
    isValid: boolean;
    error?: string;
    sanitized?: any;
    value?: any;
  }
  
  interface ValidationRule {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'url' | 'email' | 'custom';
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    validator?: (value: any) => boolean;
    sanitizer?: (value: any) => any;
    defaultValue?: any;
  }
  
  // 仮想スクロール関連の型定義
  interface VirtualScrollItem {
    id: string;
    [key: string]: any;
  }
  
  interface VirtualScrollOptions {
    itemHeight?: number;
    containerHeight?: number;
    overscan?: number;
    throttleMs?: number;
    enableDebug?: boolean;
  }
  
  interface VirtualScrollStats {
    renderCount: number;
    lastRenderTime: number;
    avgRenderTime: number;
    maxRenderTime: number;
    itemCount: number;
    visibleCount: number;
    visibleRange: {
      start: number;
      end: number;
    };
  }
  
  // テスト関連の型定義
  interface TestSuite {
    description: string;
    tests: TestCase[];
    beforeEach: Function[];
    afterEach: Function[];
    beforeAll: Function[];
    afterAll: Function[];
  }
  
  interface TestCase {
    description: string;
    fn: Function;
    skip: boolean;
  }
  
  interface TestResults {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    failures: TestFailure[];
  }
  
  interface TestFailure {
    suite: string;
    test: string;
    error: string;
    stack?: string;
  }
  
  // ストレージ関連の型定義
  interface StorageStats {
    reads: number;
    writes: number;
    cacheHits: number;
    cacheMisses: number;
    cacheSize: number;
    batchWrites: number;
    cacheHitRate: string;
  }
  
  interface StorageConfig {
    batchDelay: number;
    cacheTimeout: number;
    maxCacheSize: number;
    enableDebug: boolean;
  }
  
  // Mutex 関連の型定義
  interface MutexStats {
    acquireCount: number;
    releaseCount: number;
    maxQueueSize: number;
    averageWaitTime: number;
    totalWaitTime: number;
  }
  
  // 設定管理関連の型定義
  interface ConfigEnvironment {
    development: Partial<AppSettings>;
    production: Partial<AppSettings>;
    test: Partial<AppSettings>;
  }
  
  // API 関連の型定義
  interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    code?: number;
  }
  
  interface ApiError {
    name: string;
    message: string;
    code?: number;
    details?: any;
  }
  
  // ユーティリティ型定義
  type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
  };
  
  type DeepRequired<T> = {
    [P in keyof T]-?: T[P] extends object ? DeepRequired<T[P]> : T[P];
  };
  
  type Prettify<T> = {
    [K in keyof T]: T[K];
  } & {};
  
  type Awaited<T> = T extends PromiseLike<infer U> ? U : T;
  
  // 関数型定義
  type AsyncCallback<T = void> = () => Promise<T>;
  type ErrorCallback = (error: Error) => void;
  type ChangeCallback<T = any> = (newValue: T, oldValue: T) => void;
  type EventCallback<T = any> = (event: T) => void;
  
  // 定数型定義
  type LogLevel = 'debug' | 'info' | 'warn' | 'error';
  type Environment = 'development' | 'production' | 'test';
  type QuestionStatus = 'pending' | 'next' | 'sent' | 'skipped';
  type ConnectionStatus = 'connected' | 'disconnected' | 'logged_out';
  type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
}

// ES modules でのエクスポート
export {};