// background.service_worker.js

// 共通ユーティリティのインポート
importScripts('src/shared/utils/AsyncMutex.js');
importScripts('src/shared/utils/OptimizedStorageService.js');
importScripts('src/shared/errors/UnifiedErrorHandler.js');
importScripts('src/shared/config/AppConfig.js');
importScripts('src/shared/security/InputValidator.js');

let isRunning = false;

// 改善された排他制御システム
const queueMutex = new AsyncMutex();
const storageService = new OptimizedStorageService();
const errorHandler = new UnifiedErrorHandler();
const appConfig = new AppConfig();
const inputValidator = new InputValidator();

// デバッグモードの設定
const DEBUG_MODE = false;
const TEST_MODE = false; // OAuth認証を有効化
if (DEBUG_MODE) {
  queueMutex.setDebug(true);
  storageService.updateConfig({ enableDebug: true });
  errorHandler.updateConfig({ enableDebug: true });
}

/**
 * 質問キューへの排他制御付きアクセス（改善版）
 * @param {Function} operation 
 * @returns {Promise}
 */
async function withQueueLock(operation) {
  try {
    return await queueMutex.withLock(operation);
  } catch (error) {
    await errorHandler.handleError(error, 'withQueueLock');
    throw error;
  }
}

// 投稿失敗時のリトライカウントを保持するマップ
const postRetryCounts = new Map();

// メモリリーク対策: 古いリトライカウントを定期的にクリア（改善版）
let cleanupIntervalId = null;

/**
 * メモリクリーンアップを開始
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
        // データにタイムスタンプがない場合は削除
        if (!data.timestamp || data.timestamp < cutoffTime) {
          postRetryCounts.delete(questionId);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`[MemoryCleanup] Cleaned ${cleanedCount} old retry counts from memory`);
      }
      
      // ストレージサービスのキャッシュもクリーンアップ
      if (storageService.cache.size > appConfig.get('performance.maxCacheSize')) {
        storageService.clearCache();
        console.log('[MemoryCleanup] Storage cache cleared due to size limit');
      }
      
    } catch (error) {
      await errorHandler.handleError(error, 'memoryCleanup');
    }
  }, appConfig.get('queue.cleanupInterval'));
}

/**
 * メモリクリーンアップを停止
 */
function stopMemoryCleanup() {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
}

// Extension の停止時にクリーンアップを実行
chrome.runtime.onSuspend.addListener(() => {
  console.log('[Cleanup] Extension suspending, performing cleanup...');
  stopMemoryCleanup();
  queueMutex.queue = []; // キューをクリア
  postRetryCounts.clear(); // リトライカウントをクリア
  storageService.clearCache(); // キャッシュをクリア
});

// クリーンアップを開始
startMemoryCleanup();

// 初期設定の読み込み
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['POST_INTERVAL_SEC', 'MAX_RETRY_ATTEMPTS', 'isRunning'], (result) => {
    if (result.POST_INTERVAL_SEC === undefined) {
      chrome.storage.local.set({ POST_INTERVAL_SEC: 120 });
    }
    if (result.MAX_RETRY_ATTEMPTS === undefined) {
      chrome.storage.local.set({ MAX_RETRY_ATTEMPTS: 3 });
    }
    isRunning = result.isRunning || false;
    if (isRunning) {
      startAlarms();
    }
  });
});

// isRunning とモードの変更を監視
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    if (changes.isRunning !== undefined) {
      isRunning = changes.isRunning.newValue;
      if (isRunning) {
        startAlarms();
      } else {
        stopAlarms();
      }
    }
    
    // モード変更時の処理
    if (changes.AUTO_MODE !== undefined && isRunning) {
      console.log('Mode changed, restarting alarms...');
      stopAlarms();
      startAlarms();
    }
  }
});

function startAlarms() {
  chrome.storage.local.get(['POST_INTERVAL_SEC', 'AUTO_MODE'], (result) => {
    const postInterval = result.POST_INTERVAL_SEC || 120;
    const autoMode = result.AUTO_MODE !== false; // デフォルトは自動モード

    if (autoMode) {
      chrome.alarms.create('postLiveChat', {
        periodInMinutes: postInterval / 60
      });
      console.log('Auto mode: Alarms started.');
    } else {
      console.log('Manual mode: Alarms not started.');
    }
    updateBadge('running');
  });
}

function stopAlarms() {
  chrome.alarms.clearAll();
  console.log('Alarms stopped.');
  updateBadge('idle');
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (!isRunning) {
    console.log('BOT is stopped. Skipping alarm:', alarm.name);
    return;
  }

  if (alarm.name === 'postLiveChat') {
    postQuestionToLiveChat();
  }
});

// content_script からのメッセージを受信
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'newMarshmallowMessages') {
    handleNewMarshmallowMessages(request).then(sendResponse).catch(async error => {
      await errorHandler.handleError(error, 'handleNewMarshmallowMessages');
      sendResponse({ error: error.message });
    });
    return true; // 非同期処理のためにメッセージチャンネルを開いておく
  } else if (request.action === 'getLiveVideoInfo') {
    console.log('Received getLiveVideoInfo request for video ID:', request.videoId);
    
    (async () => {
      try {
        // APIキーを内部で取得する
        const apiKey = await getYoutubeApiKey();
        const response = await getLiveVideoInfo(request.videoId, apiKey);
        console.log('Returning video info:', response);
        sendResponse(response);
      } catch (error) {
        await errorHandler.handleError(error, 'getLiveVideoInfo');
        sendResponse({ error: error.message });
      }
    })();
    
    return true; // 非同期処理のためにメッセージチャンネルを開いておく
  } else if (request.action === 'manualPost') {
    console.log('Manual post requested for question ID:', request.questionId);
    
    (async () => {
      try {
        if (request.questionId) {
          // 特定の質問を手動送信
          const result = await postSpecificQuestion(request.questionId);
          sendResponse({ success: true, message: result || 'Posted successfully' });
        } else {
          // 次の質問を自動送信
          const result = await postQuestionToLiveChat();
          sendResponse({ success: true, message: result || 'Posted successfully' });
        }
      } catch (error) {
        await errorHandler.handleError(error, 'manualPost');
        sendResponse({ success: false, error: error.message || 'Unknown error' });
      }
    })();
    
    return true; // 非同期処理のためにメッセージチャンネルを開いておく
  } else if (request.action === 'testApiKeyDecryption') {
    console.log('🔍 API Key decryption test requested');
    
    (async () => {
      try {
        console.log('🔍 Step 1: Getting API key from storage...');
        const apiKey = await getYoutubeApiKey();
        console.log('🔍 Step 2: API key retrieved, length:', apiKey ? apiKey.length : 0);
        
        const result = {
          success: true,
          hasApiKey: !!apiKey,
          apiKeyLength: apiKey ? apiKey.length : 0,
          apiKeyPrefix: apiKey ? apiKey.substring(0, 5) + '...' : 'none'
        };
        console.log('🔍 Step 3: Test result:', result);
        sendResponse(result);
      } catch (error) {
        console.error('🔍 API Key decryption test failed:', error);
        const errorResult = { 
          success: false, 
          error: error.message || 'Unknown error',
          hasApiKey: false,
          apiKeyLength: 0,
          apiKeyPrefix: 'error'
        };
        console.log('🔍 Error result:', errorResult);
        sendResponse(errorResult);
      }
    })();
    
    return true;
  } else if (request.action === 'setQuestionAsNext') {
    console.log('Setting question as next:', request.questionId);
    
    (async () => {
      try {
        await withQueueLock(async () => {
          const queue = await getQuestionQueue();
          
          // 既存のnextステータスをpendingに戻す
          queue.forEach(q => {
            if (q.status === 'next') {
              q.status = 'pending';
            }
          });
          
          // 指定された質問をnextに設定
          const targetQuestion = queue.find(q => q.id === request.questionId);
          if (targetQuestion && targetQuestion.status === 'pending') {
            targetQuestion.status = 'next';
            await saveQuestionQueue(queue);
            sendResponse({ success: true, message: 'Question set as next' });
          } else {
            sendResponse({ success: false, error: 'Question not found or not pending' });
          }
        });
      } catch (error) {
        console.error('Failed to set question as next:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    return true;
  }
});

/**
 * エラーメッセージをユーザーフレンドリーに変換
 * @param {Error} error 
 * @returns {string}
 */
function getUserFriendlyErrorMessage(error) {
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
  if (errorMessage.includes('Live Chat ID is not set')) {
    return 'ライブチャットIDが設定されていません。YouTube配信URLを設定してください。';
  }
  if (errorMessage.includes('YouTube Data API Key is not set')) {
    return 'YouTube APIキーが設定されていません。設定画面でAPIキーを入力してください。';
  }
  if (errorMessage.includes('OAuth2 token not available')) {
    return 'YouTube認証が完了していません。設定画面でOAuth認証を行ってください。';
  }
  if (errorMessage.includes('Question contains NG word')) {
    return '質問にNGワードが含まれているためスキップしました。';
  }
  if (errorMessage.includes('No pending questions')) {
    return '送信待ちの質問がありません。';
  }
  
  // デフォルトメッセージ
  return `エラーが発生しました: ${errorMessage.substring(0, 100)}`;
}

/**
 * 新しいマシュマロメッセージを処理する
 * @param {Object} request
 * @returns {Promise<boolean>}
 */
async function handleNewMarshmallowMessages(request) {
  const { messages, isLoggedIn } = request;

  // 接続状況を保存
  const connectionStatus = isLoggedIn ? 'connected' : 'logged_out';
  chrome.storage.local.set({ MARSHMALLOW_CONNECTION_STATUS: connectionStatus });

  if (!isLoggedIn) {
    console.warn('Marshmallow is not logged in.');
    updateBadge('error');
    sendNotification(
      'マシュマロログインが必要です',
      'マシュマロにログインしてください'
    );
    return false;
  }

  let currentQueue = await getQuestionQueue();
  let addedCount = 0;

  for (const msg of messages) {
    const exists = currentQueue.some(q => q.id === msg.id);
    if (!exists) {
      currentQueue.push({
        id: msg.id,
        text: msg.text,
        received_at: msg.received_at,
        status: 'pending',
        sent_at: null
      });
      addedCount++;
    }
  }

  currentQueue.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());

  if (addedCount > 0) {
    await saveQuestionQueue(currentQueue);
    console.log(`${addedCount} new messages added to queue.`);
  } else {
    console.log('No new messages.');
  }
  updateBadge('running'); // 正常にメッセージを受信したら running 状態に戻す
  return true;
}

/**
 * 質問キューを取得する（改善版）
 * @returns {Promise<Array>}
 */
async function getQuestionQueue() {
  try {
    const queue = await storageService.get('questionQueue', []);
    
    // データの整合性チェック
    if (!Array.isArray(queue)) {
      console.warn('[getQuestionQueue] Invalid queue data format, resetting to empty array');
      await storageService.set('questionQueue', []);
      return [];
    }
    
    return queue;
  } catch (error) {
    await errorHandler.handleError(error, 'getQuestionQueue');
    return []; // エラー時は空の配列を返す
  }
}

/**
 * 質問キューを保存する（改善版）
 * @param {Array} queue
 * @returns {Promise<void>}
 */
async function saveQuestionQueue(queue) {
  try {
    // データの検証
    if (!Array.isArray(queue)) {
      throw new Error('Queue must be an array');
    }
    
    // 最大サイズのチェック
    const maxSize = appConfig.get('queue.maxSize');
    if (queue.length > maxSize) {
      console.warn(`[saveQuestionQueue] Queue size (${queue.length}) exceeds limit (${maxSize}), truncating...`);
      queue = queue.slice(0, maxSize);
    }
    
    await storageService.set('questionQueue', queue);
    
    if (DEBUG_MODE) {
      console.log(`[saveQuestionQueue] Saved queue with ${queue.length} items`);
    }
    
  } catch (error) {
    await errorHandler.handleError(error, 'saveQuestionQueue');
    throw error;
  }
}

/**
 * 特定の質問IDの質問を投稿する
 * @param {string} questionId
 * @returns {Promise<Object>}
 */
async function postSpecificQuestion(questionId) {
  console.log('Posting specific question to Live Chat:', questionId);
  updateBadge('running');

  try {
    let currentQueue = await getQuestionQueue();
    const questionToPost = currentQueue.find(q => q.id === questionId);

    if (!questionToPost) {
      throw new Error('Question not found in queue: ' + questionId);
    }

    if (questionToPost.status === 'sent') {
      throw new Error('Question already sent: ' + questionId);
    }

    // ステータスをnextに変更（投稿処理は行わない）
    questionToPost.status = 'next';
    await saveQuestionQueue(currentQueue);

    // 共通の投稿ロジックを使用
    return await performActualPost(questionToPost, currentQueue);
  } catch (error) {
    await errorHandler.handleError(error, 'postSpecificQuestion');
    updateBadge('error');
    throw error;
  }
}

async function postQuestionToLiveChat() {
  console.log('Posting question to Live Chat...');
  updateBadge('running'); // 投稿中は running 状態を維持

  try {
    console.log('Step 1: Getting question queue...');
    let currentQueue;
    try {
      currentQueue = await getQuestionQueue();
      console.log(`Queue size: ${currentQueue.length}`);
    } catch (storageError) {
      console.error('Failed to get question queue from storage:', storageError);
      updateBadge('error');
      sendNotification(chrome.i18n.getMessage('postingErrorTitle'), 'Storage error: ' + storageError.message);
      throw new Error('Failed to get question queue: ' + storageError.message);
    }
    
    // 既にnextステータスの質問があるかチェック
    let questionToPost = currentQueue.find(q => q.status === 'next');
    
    if (!questionToPost) {
      // nextステータスの質問がない場合、pending状態のうち最も古いものを選択してnextに変更
      const pendingQuestions = currentQueue.filter(q => q.status === 'pending');
      if (pendingQuestions.length === 0) {
        console.log('⚠️ No pending questions to post.');
        console.log('⚠️ Queue contents:', currentQueue.map(q => ({ id: q.id, status: q.status, text: q.text.substring(0, 30) + '...' })));
        updateBadge('idle');
        throw new Error('No pending questions to post. Queue has ' + currentQueue.length + ' total questions.');
      }

      // 最も古いpending質問を取得（received_atで昇順ソート）
      pendingQuestions.sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime());
      questionToPost = pendingQuestions[0];
      
      // ステータスをnextに変更
      questionToPost.status = 'next';
      await saveQuestionQueue(currentQueue);
    }

    // 共通の投稿ロジックを使用
    return await performActualPost(questionToPost, currentQueue);
  } catch (error) {
    await errorHandler.handleError(error, 'postQuestionToLiveChat');
    updateBadge('error');
    const userMessage = getUserFriendlyErrorMessage(error);
    sendNotification('投稿エラー', userMessage);
    throw error;
  }
}

/**
 * 実際の投稿処理を行う共通関数
 * @param {Object} questionToPost
 * @param {Array} currentQueue
 * @returns {Promise<Object>}
 */
async function performActualPost(questionToPost, currentQueue) {
  console.log('Step 2: Processing question:', questionToPost.text.substring(0, 50) + '...');

  // FR-4: 投稿内容の整形
  const formattedText = await formatQuestionText(questionToPost.text);

  // FR-9, 7.1: 入力サニタイズ (XSS防止) - 改善版
  const sanitizeResult = inputValidator.sanitizeQuestionText(formattedText);
  const sanitizedText = sanitizeResult.sanitized;
  
  // サニタイズの結果をログに記録
  if (sanitizeResult.hadDangerousContent) {
    console.warn('[Security] Dangerous content detected and removed from question');
    await errorHandler.handleError(new Error('Dangerous content in question text'), 'sanitizeQuestion');
  }
  
  if (sanitizeResult.wasModified) {
    console.log(`[Security] Question text was sanitized: ${sanitizeResult.originalLength} -> ${sanitizeResult.sanitizedLength} chars`);
  }

  // FR-5: NGワードフィルタリング
  console.log('Step 3: Checking NG keywords...');
  const ngKeywords = await getNgKeywords(); // NGワードリストを取得
  const isNg = ngKeywords.some(keyword => sanitizedText.includes(keyword)); // サニタイズ後のテキストでチェック

  if (isNg) {
    console.log('Question contains NG word. Skipping.');
    questionToPost.status = 'skipped';
    questionToPost.skipped_reason = 'NG word detected';
    await saveQuestionQueue(currentQueue);
    updateBadge('idle');
    throw new Error('Question contains NG word');
  }

  // YouTube Data API v3 liveChatMessages.insert を呼び出すロジック
    console.log('Step 4: Getting Live Chat ID...');
    let liveChatId;
    try {
      liveChatId = await getLiveChatId();
      console.log(`Live Chat ID: ${liveChatId ? liveChatId.substring(0, 10) + '...' : 'not set'}`);
    } catch (error) {
      console.error('Failed to get Live Chat ID:', error);
      updateBadge('error');
      const userMessage = getUserFriendlyErrorMessage(error);
      sendNotification('投稿エラー', userMessage);
      throw new Error('Failed to get Live Chat ID: ' + error.message);
    }

    if (!liveChatId) {
      console.error('Live Chat ID is not set. Cannot post.');
      updateBadge('error');
      const error = new Error('Live Chat ID is not set');
      const userMessage = getUserFriendlyErrorMessage(error);
      sendNotification('投稿エラー', userMessage);
      throw error;
    }

    console.log('Step 5: Getting YouTube API Key...');
    let API_KEY;
    try {
      API_KEY = await getYoutubeApiKey();
      console.log(`API Key: ${API_KEY ? 'set (' + API_KEY.substring(0, 10) + '...)' : 'not set'}`);
    } catch (error) {
      console.error('Failed to get YouTube API Key:', error);
      updateBadge('error');
      const userMessage = getUserFriendlyErrorMessage(error);
      sendNotification('投稿エラー', userMessage);
      throw new Error('Failed to get YouTube API Key: ' + error.message);
    }

    if (!API_KEY) {
      console.error('YouTube Data API Key is not set. Cannot post.');
      updateBadge('error');
      const error = new Error('YouTube Data API Key is not set');
      const userMessage = getUserFriendlyErrorMessage(error);
      sendNotification('投稿エラー', userMessage);
      throw error;
    }

    // テストモードの場合はOAuth認証をスキップ
    const testMode = await new Promise(resolve => {
      chrome.storage.local.get('TEST_MODE', (data) => {
        resolve(data.TEST_MODE || false);
      });
    });

    let accessToken = null;
    
    if (testMode) {
      console.log('🧪 TEST MODE: Skipping OAuth token acquisition');
      accessToken = 'test-token-dummy';
    } else {
      console.log('Step 6: Getting OAuth token...');
      try {
        accessToken = await getAuthToken();
        if (DEBUG_MODE) {
          console.log(`Access Token: ${accessToken ? 'obtained (***...)' : 'not available'}`);
        }
      } catch (error) {
        console.error('Failed to get OAuth token:', error);
        updateBadge('error');
        const userMessage = getUserFriendlyErrorMessage(error);
        sendNotification('投稿エラー', userMessage);
        throw new Error('Failed to get OAuth token: ' + error.message);
      }

      if (!accessToken) {
        console.error('OAuth2 token not available. Cannot post.');
        updateBadge('error');
        const error = new Error('OAuth2 token not available');
        const userMessage = getUserFriendlyErrorMessage(error);
        sendNotification('投稿エラー', userMessage);
        throw error;
      }
    }

    console.log(`Step 7: Attempting to post to Live Chat ID: ${liveChatId}`);
    if (DEBUG_MODE) {
      console.log(`Using Access Token: ***...`);
    }
    console.log(`Message: ${sanitizedText}`); // サニタイズ後のテキストをログに出力

    if (testMode) {
      console.log('🧪 TEST MODE: Skipping actual post to YouTube Live Chat');
      questionToPost.status = 'sent';
      questionToPost.sent_at = new Date().toISOString();
      await saveQuestionQueue(currentQueue);
      updateBadge('idle');
      return 'Test mode: Post simulated successfully';
    }

    try {
      const response = await fetch(`https://www.googleapis.com/youtube/v3/liveChat/messages?part=snippet`, {
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
              messageText: sanitizedText // サニタイズ後のテキストを送信
            }
          }
        })
      });

      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
        }
        
        console.error('YouTube API Error:', { status: response.status, errorData });
        
        // ステータス別のエラーハンドリング
        switch (response.status) {
          case 401:
            // 認証エラー：トークンが無効
            console.warn('Authentication failed. Token may be expired.');
            throw new Error('AUTHENTICATION_FAILED');
          case 403:
            // 権限エラー：APIキーまたはスコープの問題
            console.warn('Permission denied. Check API key and OAuth scopes.');
            throw new Error('PERMISSION_DENIED');
          case 429:
            // レート制限：指数バックオフで再試行
            const retryAfter = response.headers.get('Retry-After') || 60;
            console.warn(`Rate limited. Retry after ${retryAfter} seconds.`);
            throw new Error(`RATE_LIMITED:${retryAfter}`);
          case 400:
            // リクエストエラー：データの問題
            const message = errorData.error?.message || 'Invalid request';
            throw new Error(`BAD_REQUEST: ${message}`);
          default:
            const errorMessage = errorData.error?.message || `HTTP ${response.status}`;
            throw new Error(`YouTube API Error: ${response.status} - ${errorMessage}`);
        }
      }

      console.log(`Successfully posted: ${sanitizedText}`);
      questionToPost.status = 'sent';
      questionToPost.sent_at = new Date().toISOString();
      await saveQuestionQueue(currentQueue);
      postRetryCounts.delete(questionToPost.id); // 成功したらリトライカウントをリセット
      updateBadge('idle');
      return { success: true, message: 'Question posted successfully' };

    } catch (apiError) {
      console.error('API call failed:', apiError);
      // 失敗時のリトライロジック
      const maxRetryAttempts = await new Promise((resolve) => {
        chrome.storage.local.get('MAX_RETRY_ATTEMPTS', (data) => {
          resolve(data.MAX_RETRY_ATTEMPTS || 3);
        });
      });

      const currentRetry = (postRetryCounts.get(questionToPost.id)?.count || 0) + 1;
      postRetryCounts.set(questionToPost.id, { 
        count: currentRetry, 
        timestamp: Date.now() 
      });

      if (currentRetry <= maxRetryAttempts) {
        console.warn(`Failed to post: ${sanitizedText}. Retrying (${currentRetry}/${maxRetryAttempts})...`);
        updateBadge('error'); // エラー状態をバッジに表示
        // status は pending のままなので、次のアラームで再試行される
        throw new Error(`Post failed (attempt ${currentRetry}/${maxRetryAttempts}): ${apiError.message}`);
      } else {
        console.error(`Failed to post after ${maxRetryAttempts} attempts: ${sanitizedText}. Skipping.`);
        questionToPost.status = 'skipped'; // リトライ回数を超えたらスキップ
        await saveQuestionQueue(currentQueue);
        postRetryCounts.delete(questionToPost.id); // リトライカウントをリセット
        updateBadge('error');
        sendNotification('投稿失敗', `${maxRetryAttempts}回のリトライ後、投稿に失敗しました: ${sanitizedText.substring(0, 50)}...`);
        throw new Error(`Post failed after ${maxRetryAttempts} attempts: ${apiError.message}`);
      }
    }
}

/**
 * 質問テキストをYouTube Live Chat用に整形する
 * @param {string} text
 * @returns {string}
 */
function formatQuestionText(text) {
  let formattedText = text.replace(/\n/g, ' '); // 改行を半角スペースへ変換
  // 質問接頭辞を設定から取得
  return new Promise((resolve) => {
    chrome.storage.local.get('QUESTION_PREFIX', (data) => {
      const prefix = data.QUESTION_PREFIX || 'Q: ';
      resolve(`${prefix}${formattedText}`);
    });
  });
}

/**
 * テキストをYouTube Live Chat用にサニタイズする (XSS防止)
 * Service WorkerでDOM APIが使えないため、手動でエスケープする
 * @param {string} text
 * @returns {string}
 */
function sanitizeTextForYouTube(text) {
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#039;');
}

/**
 * NGワードリストを chrome.storage.local から取得する
 * @returns {Promise<Array>}
 */
async function getNgKeywords() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('NG_KEYWORDS', (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error while getting NG keywords:', chrome.runtime.lastError);
        reject(new Error(`Storage error: ${chrome.runtime.lastError.message}`));
      } else {
        resolve(data.NG_KEYWORDS || []);
      }
    });
  });
}

/**
 * liveChatId を chrome.storage.local から取得する
 * @returns {Promise<string>}
 */
async function getLiveChatId() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('LIVE_CHAT_ID', (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error while getting live chat ID:', chrome.runtime.lastError);
        reject(new Error(`Storage error: ${chrome.runtime.lastError.message}`));
      } else {
        resolve(data.LIVE_CHAT_ID || '');
      }
    });
  });
}

/**
 * YouTube API Key を安全に取得する（改善版）
 * @returns {Promise<string>}
 */
async function getYoutubeApiKey() {
  try {
    // 改善されたストレージサービスを使用
    const data = await storageService.getMultiple(['YOUTUBE_API_KEY', 'API_KEY_TEMP']);
    
    const encryptedApiKey = data.get('YOUTUBE_API_KEY') || '';
    const tempApiKey = data.get('API_KEY_TEMP') || '';
    
    let finalApiKey = null;
    
    if (encryptedApiKey) {
      if (DEBUG_MODE) {
        console.log('🔑 Attempting to decrypt stored API key...');
      }
      
      try {
        const decryptedApiKey = await simpleDecrypt(encryptedApiKey);
        
        if (!decryptedApiKey || decryptedApiKey.trim() === '') {
          if (DEBUG_MODE) {
            console.warn('🔑 Decrypted API key is empty, trying fallback...');
          }
          finalApiKey = tempApiKey;
        } else {
          // APIキーの形式を検証
          const validation = inputValidator.validateApiKey(decryptedApiKey);
          if (validation.isValid) {
            finalApiKey = decryptedApiKey;
            if (DEBUG_MODE) {
              console.log('🔑 API key decryption and validation successful');
            }
          } else {
            console.error('🔑 Decrypted API key failed validation:', validation.error);
            finalApiKey = tempApiKey;
          }
        }
      } catch (decryptError) {
        console.error('🔑 Failed to decrypt API key:', decryptError.message);
        finalApiKey = tempApiKey;
      }
    } else {
      finalApiKey = tempApiKey;
    }
    
    if (!finalApiKey) {
      throw new Error('No API key found in storage');
    }
    
    // 最終的なAPIキーの検証
    const finalValidation = inputValidator.validateApiKey(finalApiKey);
    if (!finalValidation.isValid) {
      throw new Error(`API key validation failed: ${finalValidation.error}`);
    }
    
    return finalApiKey;
    
  } catch (error) {
    await errorHandler.handleError(error, 'getYoutubeApiKey');
    throw error;
  }
}

function updateBadge(status) {
  let text = '';
  let color = '';
  switch (status) {
    case 'idle':
      text = '●';
      color = '#888888';
      break;
    case 'running':
      text = '▶';
      color = '#00FF00';
      break;
    case 'error':
      text = '❌';
      color = '#FF0000';
      break;
  }
  chrome.action.setBadgeText({ text: text });
  chrome.action.setBadgeBackgroundColor({ color: color });
}

// OAuth2 トークン取得の例 (FR-8)
async function getAuthToken() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        console.error('OAuth Error Details:', {
          message: chrome.runtime.lastError.message,
          error: chrome.runtime.lastError
        });
        reject(new Error(`OAuth failed: ${chrome.runtime.lastError.message}`));
      } else if (!token) {
        console.error('OAuth token is null or undefined');
        reject(new Error('OAuth token is null'));
      } else {
        console.log('OAuth token obtained successfully');
        resolve(token);
      }
    });
  });
}

/**
 * YouTube動画情報を取得する
 * @param {string} videoId
 * @param {string} apiKey
 * @returns {Promise<Object>}
 */
async function getLiveVideoInfo(videoId, apiKey) {
  if (!videoId || !apiKey) {
    throw new Error('Video ID and API key are required');
  }

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${videoId}&key=${apiKey}`);
    
    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      throw new Error('Video not found');
    }

    const video = data.items[0];
    const snippet = video.snippet;
    const liveStreamingDetails = video.liveStreamingDetails;

    // サムネイルURLを取得（高解像度を優先）
    const thumbnailUrl = snippet.thumbnails.high?.url || 
                        snippet.thumbnails.medium?.url || 
                        snippet.thumbnails.default?.url;

    let liveChatId = null;
    if (liveStreamingDetails && liveStreamingDetails.activeLiveChatId) {
      liveChatId = liveStreamingDetails.activeLiveChatId;
    }

    return {
      thumbnailUrl: thumbnailUrl,
      title: snippet.title,
      liveChatId: liveChatId,
      isLive: !!liveStreamingDetails
    };
  } catch (error) {
    console.error('Error fetching video info:', error);
    throw error;
  }
}

/**
 * ブラウザ通知を送信する
 * @param {string} title
 * @param {string} message
 */
function sendNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png', // アイコンパスは適宜変更
    title: title,
    message: message,
    priority: 2
  });
}

// Web Crypto API を使用した強力な暗号化
async function generateEncryptionKey() {
  try {
    // 統一されたデバイス情報（ポップアップと背景で同じ）
    const deviceInfo = 'marshmallow-youtube-bot-v1';
    console.log('🔑 Generating background encryption key with device info length:', deviceInfo.length);
    
    // Web Crypto API の利用可能性チェック
    if (!crypto || !crypto.subtle) {
      throw new Error('Web Crypto API is not available');
    }
    
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(deviceInfo),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new TextEncoder().encode('MarshmallowYouTubeBot2024'),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    console.log('🔑 Background encryption key generated successfully');
    return key;
  } catch (error) {
    console.error('🔑 Failed to generate background encryption key:', error);
    throw new Error('Background key generation failed: ' + error.message);
  }
}

// AES-GCM暗号化
async function simpleEncrypt(text) {
  try {
    const key = await generateEncryptionKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(text);
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encodedText
    );
    
    // IV + 暗号化データを結合してBase64エンコード
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption failed:', error);
    return '';
  }
}

// AES-GCM復号化
async function simpleDecrypt(encryptedText) {
  try {
    // 入力値の検証
    if (!encryptedText || encryptedText.trim() === '') {
      console.error('🔓 Encrypted text is empty or null');
      throw new Error('Encrypted text is empty or null');
    }

    // Web Crypto API の利用可能性チェック
    if (!crypto || !crypto.subtle) {
      console.error('🔓 Web Crypto API is not available');
      throw new Error('Web Crypto API is not available');
    }

    const key = await generateEncryptionKey();
    let combined;
    
    try {
      combined = new Uint8Array(
        atob(encryptedText).split('').map(char => char.charCodeAt(0))
      );
    } catch (base64Error) {
      console.error('🔓 Failed to decode base64:', base64Error);
      throw new Error('Invalid base64 format: ' + base64Error.message);
    }
    
    // データサイズの検証
    if (combined.length < 12) {
      console.error('🔓 Encrypted data too short:', combined.length);
      throw new Error('Encrypted data too short: ' + combined.length);
    }
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    let decrypted;
    try {
      decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );
    } catch (cryptoError) {
      console.error('🔓 Crypto decryption failed - Full error details:', {
        name: cryptoError.name,
        message: cryptoError.message,
        code: cryptoError.code,
        toString: cryptoError.toString(),
        constructor: cryptoError.constructor.name
      });
      
      // DOMExceptionの詳細情報
      if (cryptoError instanceof DOMException) {
        console.error('🔓 DOMException details:', {
          code: cryptoError.code,
          name: cryptoError.name,
          message: cryptoError.message,
          INVALID_ACCESS_ERR: cryptoError.INVALID_ACCESS_ERR,
          NOT_SUPPORTED_ERR: cryptoError.NOT_SUPPORTED_ERR
        });
      }
      
      // より具体的なエラーメッセージ
      if (cryptoError.name === 'OperationError') {
        throw new Error('Decryption failed: Invalid key or corrupted data');
      } else if (cryptoError.name === 'InvalidAccessError') {
        throw new Error('Decryption failed: Invalid access to crypto operation');
      } else {
        throw new Error('Crypto decryption failed: ' + cryptoError.name + ' - ' + cryptoError.message);
      }
    }
    
    const result = new TextDecoder().decode(decrypted);
    
    // 復号化結果の検証
    if (!result || result.trim() === '') {
      console.error('🔓 Decrypted result is empty');
      throw new Error('Decrypted result is empty');
    }
    
    console.log('🔓 Decryption successful, result length:', result.length);
    return result;
  } catch (error) {
    console.error('🔓 Decryption failed:', error);
    throw error; // エラーを再スローして上位で処理できるようにする
  }
}
