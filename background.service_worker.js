/**
 * Background Service Worker - リファクタリング版
 * 
 * 【責任範囲】
 * - Chrome Extension のエントリーポイント
 * - 新しいクラス構造への橋渡し
 * - 既存APIとの後方互換性維持
 * 
 * 【AI可読性のポイント】
 * - 複雑なロジックを各専門クラスに委譲
 * - シンプルで理解しやすいエントリーポイント
 * - レガシーコードとの互換性を保ちつつ新構造に移行
 */

// ===========================================
// 新しいクラス構造のインポート
// ===========================================

// 共通ユーティリティのインポート（既存）
importScripts('src/shared/utils/AsyncMutex.js');
importScripts('src/shared/utils/OptimizedStorageService.js');
importScripts('src/shared/errors/UnifiedErrorHandler.js');
importScripts('src/shared/config/AppConfig.js');
importScripts('src/shared/security/InputValidator.js');

// 新しいサービスクラスのインポート
importScripts('src/background/YouTubeLiveChatService.js');
importScripts('src/background/QuestionQueueManager.js');
importScripts('src/background/AutoPostingScheduler.js');
importScripts('src/background/ConfigurationManager.js');
importScripts('src/background/BackgroundServiceManager.js');

// ===========================================
// グローバル変数（後方互換性のため）
// ===========================================

let isRunning = false;
let serviceManager = null;

// レガシー変数（既存コードとの互換性維持）
const queueMutex = new AsyncMutex();
const storageService = new OptimizedStorageService();
const errorHandler = new UnifiedErrorHandler();
const appConfig = new AppConfig();
const inputValidator = new InputValidator();

// 投稿失敗時のリトライカウント（既存機能維持）
const postRetryCounts = new Map();
let cleanupIntervalId = null;

// ===========================================
// システム初期化
// ===========================================

/**
 * サービスマネージャーを初期化
 * 
 * 【AI可読性】システム全体の初期化を一箇所で管理
 */
async function initializeServiceManager() {
  try {
    console.log('[BackgroundWorker] Initializing service manager');
    
    if (serviceManager) {
      console.warn('[BackgroundWorker] Service manager already initialized');
      return true;
    }
    
    serviceManager = new BackgroundServiceManager();
    const success = await serviceManager.initialize();
    
    if (success) {
      console.log('[BackgroundWorker] Service manager initialized successfully');
      
      // 既存の状態変数を同期
      try {
        isRunning = await serviceManager.configManager.getRunningState();
        updateBadge(isRunning ? 'running' : 'idle');
      } catch (error) {
        console.error('[BackgroundWorker] Failed to sync state:', error);
      }
      
      return true;
    } else {
      console.error('[BackgroundWorker] Service manager initialization failed');
      return false;
    }
    
  } catch (error) {
    console.error('[BackgroundWorker] Critical initialization error:', error);
    return false;
  }
}

// ===========================================
// Chrome Extension イベントハンドラー
// ===========================================

/**
 * 拡張機能インストール時の初期化
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[BackgroundWorker] Extension installed/updated');
  
  try {
    // サービスマネージャーを初期化
    await initializeServiceManager();
    
    // レガシー設定の初期化（既存コードとの互換性）
    chrome.storage.local.get(['POST_INTERVAL_SEC', 'MAX_RETRY_ATTEMPTS', 'isRunning'], (result) => {
      const postInterval = result.POST_INTERVAL_SEC || 120;
      const maxRetry = result.MAX_RETRY_ATTEMPTS || 3;
      isRunning = result.isRunning || false;
      
      console.log(`[BackgroundWorker] Legacy settings: interval=${postInterval}s, maxRetry=${maxRetry}, running=${isRunning}`);
      
      if (isRunning) {
        updateBadge('running');
      }
    });
    
  } catch (error) {
    console.error('[BackgroundWorker] Installation initialization failed:', error);
    updateBadge('error');
  }
});

/**
 * 拡張機能起動時の初期化
 */
chrome.runtime.onStartup.addListener(async () => {
  console.log('[BackgroundWorker] Extension starting up');
  await initializeServiceManager();
});

/**
 * ストレージ変更の監視（レガシー対応）
 */
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') return;
  
  // isRunning の状態同期
  if (changes.isRunning !== undefined) {
    isRunning = changes.isRunning.newValue;
    console.log(`[BackgroundWorker] isRunning changed to: ${isRunning}`);
    
    if (isRunning) {
      updateBadge('running');
    } else {
      updateBadge('idle');
    }
  }
  
  // サービスマネージャーが初期化されている場合は委譲
  if (serviceManager && serviceManager.isInitialized) {
    // サービスマネージャー内で処理される
  }
});

/**
 * アラームイベントの処理
 */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    // サービスマネージャーが初期化されていない場合は初期化を試行
    if (!serviceManager || !serviceManager.isInitialized) {
      console.log('[BackgroundWorker] Service manager not ready, initializing...');
      const success = await initializeServiceManager();
      if (!success) {
        console.error('[BackgroundWorker] Failed to initialize service manager for alarm');
        return;
      }
    }
    
    // レガシー互換性チェック
    if (!isRunning) {
      console.log('[BackgroundWorker] BOT is stopped. Skipping alarm:', alarm.name);
      return;
    }
    
    // スケジューラーのアラーム処理を委譲
    if (alarm.name === 'postLiveChat' && serviceManager.scheduler) {
      console.log(`[BackgroundWorker] Delegating alarm ${alarm.name} to scheduler`);
      await serviceManager.scheduler._handleScheduledPost();
    } else {
      console.log(`[BackgroundWorker] Unknown alarm: ${alarm.name}`);
    }
    
  } catch (error) {
    console.error('[BackgroundWorker] Alarm handling error:', error);
    updateBadge('error');
  }
});

/**
 * メッセージ処理（新旧システムの橋渡し）
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // サービスマネージャーが利用可能な場合は委譲
  if (serviceManager && serviceManager.isInitialized) {
    // BackgroundServiceManagerのメッセージハンドラーを呼び出し
    serviceManager._handleMessage(request, sender, sendResponse);
    return true;
  }
  
  // フォールバック：レガシー処理
  handleLegacyMessage(request, sender, sendResponse);
  return true;
});

/**
 * 拡張機能停止時のクリーンアップ
 */
chrome.runtime.onSuspend.addListener(async () => {
  console.log('[BackgroundWorker] Extension suspending, performing cleanup...');
  
  try {
    // サービスマネージャーのクリーンアップ
    if (serviceManager) {
      await serviceManager.shutdown();
    }
    
    // レガシークリーンアップ
    stopMemoryCleanup();
    postRetryCounts.clear();
    
  } catch (error) {
    console.error('[BackgroundWorker] Cleanup error:', error);
  }
});

// ===========================================
// レガシー互換性関数（段階的移行のため）
// ===========================================

/**
 * レガシーメッセージ処理（フォールバック）
 */
async function handleLegacyMessage(request, sender, sendResponse) {
  try {
    console.log(`[BackgroundWorker] Handling legacy message: ${request.action}`);
    
    switch (request.action) {
      case 'newMarshmallowMessages':
        // 新しいサービスマネージャーの初期化を試行
        if (!serviceManager) {
          await initializeServiceManager();
        }
        
        if (serviceManager && serviceManager.isInitialized) {
          const result = await serviceManager.handleNewMarshmallowMessages(request.messages || []);
          sendResponse(result);
        } else {
          sendResponse({ error: 'Service manager not available' });
        }
        break;
        
      case 'manualPost':
        if (!serviceManager) {
          await initializeServiceManager();
        }
        
        if (serviceManager && serviceManager.isInitialized) {
          const result = await serviceManager.executeManualPost(request.questionId);
          sendResponse(result);
        } else {
          sendResponse({ error: 'Service manager not available' });
        }
        break;
        
      case 'getSystemStatus':
        if (serviceManager && serviceManager.isInitialized) {
          const status = await serviceManager.getSystemStatus();
          sendResponse(status);
        } else {
          sendResponse({ 
            initialized: false, 
            legacy: true,
            isRunning: isRunning 
          });
        }
        break;
        
      default:
        sendResponse({ error: `Unknown action: ${request.action}` });
    }
    
  } catch (error) {
    console.error('[BackgroundWorker] Legacy message handling error:', error);
    sendResponse({ error: error.message });
  }
}

// ===========================================
// ユーティリティ関数（既存機能維持）
// ===========================================

/**
 * バッジ更新（既存機能維持）
 */
function updateBadge(status) {
  try {
    const badgeConfig = {
      'idle': { text: '', color: '#4CAF50' },
      'running': { text: '⚡', color: '#2196F3' },
      'error': { text: '!', color: '#F44336' },
      'paused': { text: '⏸', color: '#FF9800' }
    };
    
    const config = badgeConfig[status] || badgeConfig['idle'];
    
    chrome.action.setBadgeText({ text: config.text });
    chrome.action.setBadgeBackgroundColor({ color: config.color });
    
  } catch (error) {
    console.error('[BackgroundWorker] Badge update error:', error);
  }
}

/**
 * メモリクリーンアップ開始（レガシー機能維持）
 */
function startMemoryCleanup() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
  }
  
  cleanupIntervalId = setInterval(async () => {
    try {
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24時間前
      let cleanedCount = 0;
      
      for (const [questionId, data] of postRetryCounts.entries()) {
        if (!data.timestamp || data.timestamp < cutoffTime) {
          postRetryCounts.delete(questionId);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`[BackgroundWorker] Cleaned ${cleanedCount} old retry counts`);
      }
      
    } catch (error) {
      console.error('[BackgroundWorker] Memory cleanup error:', error);
    }
  }, 60 * 60 * 1000); // 1時間ごと
}

/**
 * メモリクリーンアップ停止（レガシー機能維持）
 */
function stopMemoryCleanup() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

// ===========================================
// レガシー関数のエクスポート（既存コードとの互換性）
// ===========================================

// 既存の暗号化関数を維持
async function generateEncryptionKey() {
  try {
    console.log('[BackgroundWorker] 🔑 Generating background encryption key with device info');
    
    const deviceInfo = [
      navigator.userAgent,
      navigator.language,
      '1920x1080', // Service Worker では screen が利用できないため固定値
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || 4,
      Date.now().toString() // 追加のエントロピー
    ].join('|');
    
    console.log(`[BackgroundWorker] 🔑 Device info length: ${deviceInfo.length}`);
    
    const encoder = new TextEncoder();
    const data = encoder.encode(deviceInfo);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
    
    console.log('[BackgroundWorker] 🔑 Background encryption key generated successfully');
    return hashHex.substring(0, 32);
  } catch (error) {
    console.error('[BackgroundWorker] 🔑 Key generation failed:', error);
    return 'fallback-key-' + Date.now().toString();
  }
}

async function simpleEncrypt(text) {
  try {
    const key = await generateEncryptionKey();
    const encoded = btoa(text + '|' + key.substring(0, 8));
    console.log('[BackgroundWorker] 🔒 Encryption successful');
    return encoded;
  } catch (error) {
    console.error('[BackgroundWorker] 🔒 Encryption failed:', error);
    return btoa(text);
  }
}

async function simpleDecrypt(encryptedText) {
  try {
    const decoded = atob(encryptedText);
    const parts = decoded.split('|');
    if (parts.length >= 2) {
      const result = parts.slice(0, -1).join('|');
      console.log('[BackgroundWorker] 🔓 Decryption successful');
      return result;
    } else {
      return decoded;
    }
  } catch (error) {
    console.error('[BackgroundWorker] 🔓 Decryption failed:', error);
    return '';
  }
}

// ===========================================
// 自動初期化
// ===========================================

// サービスマネージャーの自動初期化
(async () => {
  try {
    console.log('[BackgroundWorker] Auto-initializing service manager');
    await initializeServiceManager();
    startMemoryCleanup();
  } catch (error) {
    console.error('[BackgroundWorker] Auto-initialization failed:', error);
  }
})();

// ===========================================
// 開発者向けデバッグ機能
// ===========================================

// デバッグ用グローバル関数
if (typeof window !== 'undefined') {
  window.debugBackgroundWorker = {
    serviceManager: () => serviceManager,
    isRunning: () => isRunning,
    postRetryCounts: () => postRetryCounts,
    reinitialize: () => initializeServiceManager()
  };
}

console.log('[BackgroundWorker] 🚀 Background Service Worker loaded with new architecture');