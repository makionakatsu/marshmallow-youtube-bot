// background.service_worker.js

let isRunning = false;

// 投稿失敗時のリトライカウントを保持するマップ
const postRetryCounts = new Map();

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
    handleNewMarshmallowMessages(request).then(sendResponse).catch(error => {
      console.error('Error handling new marshmallow messages:', error);
      sendResponse({ error: error.message });
    });
    return true; // 非同期処理のためにメッセージチャンネルを開いておく
  } else if (request.action === 'getLiveVideoInfo') {
    console.log('Received getLiveVideoInfo request for video ID:', request.videoId);
    getLiveVideoInfo(request.videoId, request.apiKey).then(response => {
      console.log('Returning video info:', response);
      sendResponse(response);
    }).catch(error => {
      console.error('Error getting video info:', error);
      sendResponse({ error: error.message });
    });
    return true; // 非同期処理のためにメッセージチャンネルを開いておく
  } else if (request.action === 'manualPost') {
    console.log('Manual post requested');
    postQuestionToLiveChat().then((result) => {
      console.log('Manual post completed successfully:', result);
      sendResponse({ success: true, message: result || 'Posted successfully' });
    }).catch(error => {
      console.error('Manual post failed:', error);
      sendResponse({ success: false, error: error.message || 'Unknown error' });
    });
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
  }
});

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
 * 質問キューを chrome.storage.local から取得する
 * @returns {Promise<Array>}
 */
async function getQuestionQueue() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('questionQueue', (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error while getting question queue:', chrome.runtime.lastError);
        reject(new Error(`Storage error: ${chrome.runtime.lastError.message}`));
      } else {
        resolve(data.questionQueue || []);
      }
    });
  });
}

/**
 * 質問キューを chrome.storage.local に保存する
 * @param {Array} queue
 * @returns {Promise<void>}
 */
async function saveQuestionQueue(queue) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ questionQueue: queue }, () => {
      if (chrome.runtime.lastError) {
        console.error('Storage error while saving question queue:', chrome.runtime.lastError);
        reject(new Error(`Storage error: ${chrome.runtime.lastError.message}`));
      } else {
        resolve();
      }
    });
  });
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
    
    const questionToPost = currentQueue.find(q => q.status === 'pending');

    if (!questionToPost) {
      console.log('⚠️ No pending questions to post.');
      console.log('⚠️ Queue contents:', currentQueue.map(q => ({ id: q.id, status: q.status, text: q.text.substring(0, 30) + '...' })));
      updateBadge('idle'); // 投稿するものがない場合はアイドル状態に戻す
      throw new Error('No pending questions to post. Queue has ' + currentQueue.length + ' total questions.');
    }

    console.log('Step 2: Processing question:', questionToPost.text.substring(0, 50) + '...');

    // FR-4: 投稿内容の整形
    const formattedText = await formatQuestionText(questionToPost.text);

    // FR-9, 7.1: 入力サニタイズ (XSS防止)
    const sanitizedText = sanitizeTextForYouTube(formattedText);

    // FR-5: NGワードフィルタリング
    console.log('Step 3: Checking NG keywords...');
    const ngKeywords = await getNgKeywords(); // NGワードリストを取得
    const isNg = ngKeywords.some(keyword => sanitizedText.includes(keyword)); // サニタイズ後のテキストでチェック

    if (isNg) {
      console.log('Question contains NG word. Skipping.');
      questionToPost.status = 'skipped';
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
      sendNotification('投稿エラー', 'ライブチャットIDの取得に失敗しました: ' + error.message);
      throw new Error('Failed to get Live Chat ID: ' + error.message);
    }

    if (!liveChatId) {
      console.error('Live Chat ID is not set. Cannot post.');
      updateBadge('error');
      sendNotification('投稿エラー', 'ライブチャットIDが設定されていません');
      throw new Error('Live Chat ID is not set');
    }

    console.log('Step 5: Getting YouTube API Key...');
    let API_KEY;
    try {
      API_KEY = await getYoutubeApiKey();
      console.log(`API Key: ${API_KEY ? 'set (' + API_KEY.substring(0, 10) + '...)' : 'not set'}`);
    } catch (error) {
      console.error('Failed to get YouTube API Key:', error);
      updateBadge('error');
      sendNotification('投稿エラー', 'YouTube APIキーの取得に失敗しました: ' + error.message);
      throw new Error('Failed to get YouTube API Key: ' + error.message);
    }

    if (!API_KEY) {
      console.error('YouTube Data API Key is not set. Cannot post.');
      updateBadge('error');
      sendNotification('投稿エラー', 'YouTube Data APIキーが必要です');
      throw new Error('YouTube Data API Key is not set');
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
        console.log(`Access Token: ${accessToken ? 'obtained (' + accessToken.substring(0, 10) + '...)' : 'not available'}`);
      } catch (error) {
        console.error('Failed to get OAuth token:', error);
        updateBadge('error');
        sendNotification('投稿エラー', 'OAuthトークンの取得に失敗しました: ' + error.message);
        throw new Error('Failed to get OAuth token: ' + error.message);
      }

      if (!accessToken) {
        console.error('OAuth2 token not available. Cannot post.');
        updateBadge('error');
        sendNotification('投稿エラー', 'OAuthトークンが利用できません');
        throw new Error('OAuth2 token not available');
      }
    }

    console.log(`Step 7: Attempting to post to Live Chat ID: ${liveChatId}`);
    console.log(`Using Access Token: ${accessToken.substring(0, 10)}...`);
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
            type: 'textMessage',
            textMessageDetails: {
              messageText: sanitizedText // サニタイズ後のテキストを送信
            }
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('YouTube API Error:', errorData);
        throw new Error(`YouTube API Error: ${response.status} - ${errorData.error.message}`);
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

      const currentRetry = (postRetryCounts.get(questionToPost.id) || 0) + 1;
      postRetryCounts.set(questionToPost.id, currentRetry);

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

  } catch (error) {
    console.error('Error posting to Live Chat:', error);
    updateBadge('error');
    sendNotification('投稿エラー', '予期しないエラーが発生しました');
    throw error; // エラーを再スローして呼び出し元で処理できるようにする
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
 * YouTube API Key を chrome.storage.local から取得する
 * @returns {Promise<string>}
 */
async function getYoutubeApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('YOUTUBE_API_KEY', (data) => {
      if (chrome.runtime.lastError) {
        console.error('Storage error while getting YouTube API key:', chrome.runtime.lastError);
        reject(new Error(`Storage error: ${chrome.runtime.lastError.message}`));
      } else {
        // フォールバック付きのAPIキー取得
        const encryptedApiKey = data.YOUTUBE_API_KEY || '';
        const tempApiKey = data.API_KEY_TEMP || '';
        
        if (encryptedApiKey) {
          console.log('🔑 Attempting to decrypt stored API key...');
          simpleDecrypt(encryptedApiKey).then(decryptedApiKey => {
            if (!decryptedApiKey || decryptedApiKey.trim() === '') {
              console.warn('🔑 Decrypted API key is empty, trying fallback...');
              if (tempApiKey) {
                console.log('🔑 Using fallback API key');
                resolve(tempApiKey);
              } else {
                reject(new Error('API key decryption failed and no fallback available'));
              }
            } else {
              console.log('🔑 API key decryption successful');
              resolve(decryptedApiKey);
            }
          }).catch(error => {
            console.error('🔑 Failed to decrypt API key:', error);
            if (tempApiKey) {
              console.log('🔑 Using fallback API key due to decryption error');
              resolve(tempApiKey);
            } else {
              reject(new Error('API key decryption failed: ' + error.message));
            }
          });
        } else if (tempApiKey) {
          console.log('🔑 Using temporary API key (no encrypted version found)');
          resolve(tempApiKey);
        } else {
          console.error('🔑 No API key found in storage');
          reject(new Error('No API key found in storage'));
        }
      }
    });
  });
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
        reject(chrome.runtime.lastError);
      } else {
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
