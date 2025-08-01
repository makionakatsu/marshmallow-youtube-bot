// popup.js

// 仮想スクロールマネージャーを動的に読み込み
let VirtualScrollManager = null;

// 既に読み込まれているかチェック
if (typeof window.VirtualScrollManager !== 'undefined') {
  VirtualScrollManager = window.VirtualScrollManager;
} else {
  try {
    const script = document.createElement('script');
    script.src = 'src/shared/ui/VirtualScrollManager.js';
    script.onload = () => {
      VirtualScrollManager = window.VirtualScrollManager;
    };
    script.onerror = () => {
      console.warn('VirtualScrollManager failed to load, falling back to regular scrolling');
    };
    document.head.appendChild(script);
  } catch (error) {
    console.warn('VirtualScrollManager not loaded, falling back to regular scrolling');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const startButton = document.getElementById('startButton');
  const stopButton = document.getElementById('stopButton');
  const statusDiv = document.getElementById('status');
  const statusTextSpan = document.getElementById('statusText');
  const statusIconSpan = statusDiv.querySelector('.status-icon');
  const liveUrlInput = document.getElementById('liveUrlInput');
  const setLiveUrlButton = document.getElementById('setLiveUrlButton');
  const urlStatusMessageDiv = document.getElementById('urlStatusMessage');
  const livePreviewDiv = document.getElementById('livePreview');
  const liveThumbnailImg = document.getElementById('liveThumbnail');
  const liveTitleP = document.getElementById('liveTitle');
  const minimizeButton = document.getElementById('minimizeButton');
  const settingsButton = document.getElementById('settingsButton');
  
  // テスト機能の要素
  const testSection = document.querySelector('.test-section');
  const addDummyButton = document.getElementById('addDummyButton');
  const manualPostButton = document.getElementById('manualPostButton');
  const showQueueButton = document.getElementById('showQueueButton');
  const clearQueueButton = document.getElementById('clearQueueButton');
  const testApiKeyButton = document.getElementById('testApiKeyButton');
  const queueDisplay = document.getElementById('queueDisplay');
  const modeToggleButton = document.getElementById('modeToggleButton');
  const marshmallowStatus = document.getElementById('marshmallowStatus');
  
  // 仮想スクロールマネージャーの初期化
  let virtualScrollManager = null;
  let isVirtualScrollEnabled = false;

  // 日本語テキストを設定
  document.title = 'Marshmallow to YouTube Bot';
  startButton.textContent = '開始';
  stopButton.textContent = '停止';
  statusTextSpan.textContent = '読込中';

  // 最小化状態の管理
  let isMinimized = false;
  chrome.storage.local.get(['isMinimized', 'TEST_MODE', 'AUTO_MODE'], (data) => {
    isMinimized = data.isMinimized || false;
    if (isMinimized) {
      document.body.classList.add('minimized');
      minimizeButton.textContent = '+';
    }
    
    // テストセクションの表示制御
    if (data.TEST_MODE) {
      testSection.style.display = 'block';
    } else {
      testSection.style.display = 'none';
    }
    
    // テストモードでない場合は、ダミー質問追加ボタンを無効化
    if (!data.TEST_MODE) {
      addDummyButton.disabled = true;
      addDummyButton.textContent = 'ダミー質問追加 (テストモードのみ)';
    }
    
    // モード表示の更新
    const autoMode = data.AUTO_MODE !== false; // デフォルトは自動モード
    updateModeDisplay(autoMode);
  });

  // 初期状態の表示
  chrome.storage.local.get(['isRunning', 'LIVE_CHAT_ID', 'LIVE_VIDEO_INFO', 'YOUTUBE_API_KEY', 'MARSHMALLOW_CONNECTION_STATUS'], (data) => {
    updateStatusUI(data.isRunning);
    // LIVE_CHAT_ID と API_KEY が設定されていれば、STARTボタンを有効にする
    updateStartButtonState(data.LIVE_CHAT_ID, data.YOUTUBE_API_KEY);

    // 保存されているライブ情報があれば表示
    if (data.LIVE_VIDEO_INFO) {
      displayLiveInfo(data.LIVE_VIDEO_INFO.thumbnailUrl, data.LIVE_VIDEO_INFO.title, data.LIVE_VIDEO_INFO.isLive);
    }
    
    // マシュマロ接続状況を表示
    updateMarshmallowStatus(data.MARSHMALLOW_CONNECTION_STATUS || 'disconnected');
  });

  // storage の変更を監視してUIを更新
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.isRunning !== undefined) {
        updateStatusUI(changes.isRunning.newValue);
      }
      if (changes.LIVE_CHAT_ID !== undefined || changes.YOUTUBE_API_KEY !== undefined) {
        // LIVE_CHAT_ID と API_KEY の両方が設定されたらSTARTボタンを有効にする
        chrome.storage.local.get(['LIVE_CHAT_ID', 'YOUTUBE_API_KEY'], (data) => {
          updateStartButtonState(data.LIVE_CHAT_ID, data.YOUTUBE_API_KEY);
        });
      }
      if (changes.LIVE_VIDEO_INFO !== undefined) {
        if (changes.LIVE_VIDEO_INFO.newValue) {
          displayLiveInfo(changes.LIVE_VIDEO_INFO.newValue.thumbnailUrl, changes.LIVE_VIDEO_INFO.newValue.title, changes.LIVE_VIDEO_INFO.newValue.isLive);
        } else {
          hideLiveInfo();
        }
      }
      if (changes.MARSHMALLOW_CONNECTION_STATUS !== undefined) {
        updateMarshmallowStatus(changes.MARSHMALLOW_CONNECTION_STATUS.newValue);
      }
    }
  });

  startButton.addEventListener('click', () => {
    chrome.storage.local.set({ isRunning: true });
    
    // アラームを作成して自動投稿を開始
    chrome.storage.local.get(['POST_INTERVAL_SEC'], (result) => {
      const postInterval = result.POST_INTERVAL_SEC || 120;
      chrome.alarms.create('postLiveChat', {
        periodInMinutes: postInterval / 60
      });
      console.log('Auto posting started with interval:', postInterval, 'seconds');
    });
  });

  stopButton.addEventListener('click', () => {
    chrome.storage.local.set({ isRunning: false });
    
    // アラームを削除して自動投稿を停止
    chrome.alarms.clear('postLiveChat');
    console.log('Auto posting stopped');
  });

  modeToggleButton.addEventListener('click', () => {
    chrome.storage.local.get('AUTO_MODE', (data) => {
      const currentAutoMode = data.AUTO_MODE !== false; // デフォルトは自動モード
      const newAutoMode = !currentAutoMode;
      chrome.storage.local.set({ AUTO_MODE: newAutoMode });
      updateModeDisplay(newAutoMode);
    });
  });

  settingsButton.addEventListener('click', () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL('settings.html')
    });
  });

  setLiveUrlButton.addEventListener('click', async () => {
    const url = liveUrlInput.value.trim();
    if (!url) {
      showUrlStatusMessage('URLを入力してください', 'red');
      hideLiveInfo();
      return;
    }

    const videoId = extractVideoIdFromUrl(url);
    if (videoId) {
      // APIキーが設定されているか確認してから情報を取得
      // background.service_workerにAPIキーの取得も任せる
      try {
        // サムネイルとタイトル、liveChatIdを取得するリクエストをbackgroundに送信
        const response = await chrome.runtime.sendMessage({ action: 'getLiveVideoInfo', videoId: videoId, apiKey: 'REQUEST_FROM_BACKGROUND' });
        console.log('Response from background for getLiveVideoInfo:', response);
        
        if (response && response.error) {
          showUrlStatusMessage('動画情報の取得に失敗しました: ' + response.error, 'red');
          hideLiveInfo();
          await chrome.storage.local.remove('LIVE_CHAT_ID');
          await chrome.storage.local.remove('LIVE_VIDEO_INFO');
          return;
        }

        if (response && response.thumbnailUrl && response.title) {
          // liveChatIdが取得できた場合のみ保存
          if (response.liveChatId) {
            await chrome.storage.local.set({ LIVE_CHAT_ID: response.liveChatId });
            showUrlStatusMessage('ライブチャットIDを設定しました: ' + response.liveChatId, 'green');
          } else {
            showUrlStatusMessage('この動画はライブ配信ではありません', 'orange');
            await chrome.storage.local.remove('LIVE_CHAT_ID');
          }

          await chrome.storage.local.set({ LIVE_VIDEO_INFO: { thumbnailUrl: response.thumbnailUrl, title: response.title, isLive: response.isLive } });
          displayLiveInfo(response.thumbnailUrl, response.title, response.isLive);
        } else {
          showUrlStatusMessage('動画情報の取得に失敗しました', 'orange');
          hideLiveInfo();
          await chrome.storage.local.remove('LIVE_CHAT_ID');
          await chrome.storage.local.remove('LIVE_VIDEO_INFO');
        }
      } catch (error) {
        console.error('Error getting live video info:', error);
        showUrlStatusMessage('動画情報の取得に失敗しました: ' + error.message, 'red');
        hideLiveInfo();
        await chrome.storage.local.remove('LIVE_CHAT_ID');
        await chrome.storage.local.remove('LIVE_VIDEO_INFO');
      }

    } else {
      showUrlStatusMessage('無効なURLです', 'red');
      hideLiveInfo();
      await chrome.storage.local.remove('LIVE_CHAT_ID');
      await chrome.storage.local.remove('LIVE_VIDEO_INFO');
    }
  });


  minimizeButton.addEventListener('click', () => {
    isMinimized = !isMinimized;
    if (isMinimized) {
      document.body.classList.add('minimized');
      minimizeButton.textContent = '+';
    } else {
      document.body.classList.remove('minimized');
      minimizeButton.textContent = '−';
    }
    // 最小化状態を保存
    chrome.storage.local.set({ isMinimized: isMinimized });
  });

  // テスト機能のイベントリスナー
  addDummyButton.addEventListener('click', async () => {
    console.log('Adding dummy questions...');
    await addDummyQuestions();
    await displayQuestionQueue(); // 追加後にキューを表示
    showStatusMessage('ダミー質問を追加しました', 'green');
  });

  manualPostButton.addEventListener('click', async () => {
    try {
      console.log('📤 Manual post button clicked');
      manualPostButton.disabled = true;
      manualPostButton.textContent = '投稿中...';
      
      // 事前チェック: キューの状態を確認
      const queue = await getQuestionQueue();
      console.log('📤 Current queue before manual post:', queue.length, 'questions');
      const pendingQuestions = queue.filter(q => q.status === 'pending');
      console.log('📤 Pending questions:', pendingQuestions.length);
      
      if (pendingQuestions.length === 0) {
        showStatusMessage('投稿する質問がありません。先にダミー質問を追加してください。', 'orange');
        return;
      }
      
      const response = await chrome.runtime.sendMessage({ action: 'manualPost' });
      console.log('📤 Manual post response:', response);
      
      if (response && response.success) {
        showStatusMessage('手動投稿を実行しました: ' + (response.message || ''), 'green');
        await displayQuestionQueue(); // 投稿後にキューを更新
      } else {
        const errorMessage = response?.error || 'Unknown error occurred';
        showStatusMessage('手動投稿に失敗しました: ' + errorMessage, 'red');
        console.error('📤 Manual post failed:', errorMessage);
      }
    } catch (error) {
      console.error('📤 Error during manual post:', error);
      showStatusMessage('手動投稿でエラーが発生しました: ' + error.message, 'red');
    } finally {
      manualPostButton.disabled = false;
      manualPostButton.textContent = '手動投稿';
    }
  });

  showQueueButton.addEventListener('click', async () => {
    await displayQuestionQueue();
  });

  clearQueueButton.addEventListener('click', async () => {
    await chrome.storage.local.remove('questionQueue');
    queueDisplay.innerHTML = '';
    showStatusMessage('キューを削除しました', 'green');
  });

  testApiKeyButton.addEventListener('click', async () => {
    console.log('Testing API Key...');
    testApiKeyButton.disabled = true;
    testApiKeyButton.textContent = '診断中...';
    
    try {
      const response = await chrome.runtime.sendMessage({ action: 'testApiKeyDecryption' });
      console.log('API Key test response:', response);
      
      if (!response) {
        showStatusMessage('バックグラウンドスクリプトからの応答がありません', 'red');
        return;
      }
      
      if (response.success) {
        if (response.hasApiKey) {
          showStatusMessage(`APIキー OK (長さ: ${response.apiKeyLength}, プレフィックス: ${response.apiKeyPrefix})`, 'green');
        } else {
          showStatusMessage('APIキーが設定されていません', 'red');
        }
      } else {
        showStatusMessage('APIキー復号化エラー: ' + (response.error || '不明なエラー'), 'red');
      }
    } catch (error) {
      console.error('API Key test failed:', error);
      showStatusMessage('APIキーテストでエラーが発生しました: ' + error.message, 'red');
    } finally {
      testApiKeyButton.disabled = false;
      testApiKeyButton.textContent = 'APIキー診断';
    }
  });

  function updateStatusUI(running) {
    if (running) {
      startButton.disabled = true;
      stopButton.disabled = false;
      
      // 手動モードか自動モードかをチェック
      chrome.storage.local.get('AUTO_MODE', (data) => {
        const autoMode = data.AUTO_MODE !== false;
        if (autoMode) {
          // 自動モード: バッジテキストに基づいてステータスを更新
          chrome.action.getBadgeText({}, (text) => {
            updateStatusFromBadge(text);
          });
        } else {
          // 手動モード: 待機状態として表示
          statusTextSpan.textContent = '手動モード (待機中)';
          statusDiv.className = 'status status-running';
          statusIconSpan.textContent = '●';
        }
      });
    } else {
      // LIVE_CHAT_ID と API_KEY が設定されていれば、STARTボタンを有効にする
      chrome.storage.local.get(['LIVE_CHAT_ID', 'YOUTUBE_API_KEY'], (data) => {
        updateStartButtonState(data.LIVE_CHAT_ID, data.YOUTUBE_API_KEY);
      });
      stopButton.disabled = true;
      statusTextSpan.textContent = '停止中';
      statusDiv.className = 'status status-stopped';
      statusIconSpan.textContent = '●';
    }
  }

  function updateStartButtonState(liveChatId, youtubeApiKey) {
    startButton.disabled = !(liveChatId && youtubeApiKey);
  }

  function updateStatusFromBadge(badgeText) {
    statusDiv.classList.remove('status-running', 'status-stopped', 'status-error');
    switch (badgeText) {
      case '▶':
        statusTextSpan.textContent = '実行中';
        statusDiv.classList.add('status-running');
        statusIconSpan.textContent = '●';
        break;
      case '●':
        statusTextSpan.textContent = 'アイドル';
        statusDiv.classList.add('status-stopped');
        statusIconSpan.textContent = '●';
        break;
      case '❌':
        statusTextSpan.textContent = 'エラー';
        statusDiv.classList.add('status-error');
        statusIconSpan.textContent = '●';
        break;
      default:
        statusTextSpan.textContent = '読込中';
        statusDiv.classList.add('status-loading');
        statusIconSpan.textContent = '●';
        break;
    }
  }

  function extractVideoIdFromUrl(url) {
    try {
      // 新しい InputValidator を使用（簡易版）
      const validator = {
        validateYouTubeUrl: function(url) {
          // 基本的な検証
          if (!url || typeof url !== 'string') {
            return { isValid: false, error: 'URL is required', videoId: null };
          }
          
          if (url.length > 2000) {
            return { isValid: false, error: 'URL is too long', videoId: null };
          }
          
          const urlObj = new URL(url);
          
          // ドメインチェック
          const allowedDomains = ['youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com'];
          if (!allowedDomains.includes(urlObj.hostname)) {
            return { isValid: false, error: 'Invalid domain', videoId: null };
          }
          
          // プロトコルチェック
          if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
            return { isValid: false, error: 'Invalid protocol', videoId: null };
          }
          
          // Video ID抽出
          let videoId = null;
          
          // watch?v=VIDEO_ID または live_chat?v=VIDEO_ID の形式
          const videoIdParam = urlObj.searchParams.get('v');
          if (videoIdParam) {
            videoId = videoIdParam;
          } else if (urlObj.hostname === 'youtu.be') {
            // youtu.be ショートURL対応
            videoId = urlObj.pathname.substring(1);
          } else {
            // youtube.com/live/VIDEO_ID の形式
            const livePathMatch = urlObj.pathname.match(/\/live\/([a-zA-Z0-9_-]+)/);
            if (livePathMatch && livePathMatch[1]) {
              videoId = livePathMatch[1];
            }
          }
          
          if (!videoId) {
            return { isValid: false, error: 'Could not extract video ID', videoId: null };
          }
          
          // Video ID検証
          if (videoId.length !== 11 || !/^[a-zA-Z0-9_-]+$/.test(videoId)) {
            return { isValid: false, error: 'Invalid video ID format', videoId: null };
          }
          
          return { isValid: true, error: null, videoId: videoId };
        }
      };
      
      const result = validator.validateYouTubeUrl(url);
      if (!result.isValid) {
        console.error('URL validation failed:', result.error);
        return null;
      }
      
      return result.videoId;
      
    } catch (e) {
      console.error('Invalid URL format:', e);
      return null;
    }
  }

  function displayLiveInfo(thumbnailUrl, title, isLive) {
    liveThumbnailImg.src = thumbnailUrl;
    liveThumbnailImg.alt = title;
    liveTitleP.textContent = title + (isLive ? ' (LIVE)' : ' (NOT LIVE)');
    livePreviewDiv.style.display = 'block';
  }

  function hideLiveInfo() {
    livePreviewDiv.style.display = 'none';
    liveThumbnailImg.src = '';
    liveThumbnailImg.alt = '';
    liveTitleP.textContent = '';
  }

  function showUrlStatusMessage(message, type) {
    urlStatusMessageDiv.textContent = message;
    urlStatusMessageDiv.className = 'status-message';
    if (type === 'green') urlStatusMessageDiv.classList.add('success');
    else if (type === 'red') urlStatusMessageDiv.classList.add('error');
    else if (type === 'orange') urlStatusMessageDiv.classList.add('warning');
    
    setTimeout(() => {
      urlStatusMessageDiv.textContent = '';
      urlStatusMessageDiv.className = 'status-message';
    }, 5000);
  }



  // テスト機能の実装
  async function addDummyQuestions() {
    const dummyQuestions = [
      {
        id: 'dummy-' + Date.now() + '-1',
        text: 'これはテスト質問1です。配信の感想を教えてください。',
        received_at: new Date().toISOString(),
        status: 'pending',
        sent_at: null
      },
      {
        id: 'dummy-' + Date.now() + '-2',
        text: 'テスト質問2: 今日の配信の内容はどうでしたか？',
        received_at: new Date().toISOString(),
        status: 'pending',
        sent_at: null
      },
      {
        id: 'dummy-' + Date.now() + '-3',
        text: 'ダミー質問3: 次回の配信予定はありますか？',
        received_at: new Date().toISOString(),
        status: 'pending',
        sent_at: null
      }
    ];

    const currentQueue = await getQuestionQueue();
    const newQueue = [...currentQueue, ...dummyQuestions];
    await saveQuestionQueue(newQueue);
  }

  async function displayQuestionQueue() {
    const queue = await getQuestionQueue();
    if (queue.length === 0) {
      queueDisplay.innerHTML = '<div style="text-align: center; color: #666; padding: 20px;">キューは空です</div>';
      return;
    }
    
    // 既存の質問で正確な時刻がない場合（すべて同じ時刻など）の修正
    let needsTimeFixing = false;
    const times = queue.map(q => new Date(q.received_at).getTime());
    const uniqueTimes = new Set(times);
    
    // ほとんどの質問が同じ時刻の場合は時刻修正が必要
    if (uniqueTimes.size < queue.length * 0.5) {
      needsTimeFixing = true;
      console.log('Detected identical timestamps, fixing queue order...');
      
      // IDでソートしてから時刻を再設定
      queue.sort((a, b) => a.id.localeCompare(b.id));
      const baseTime = new Date();
      queue.forEach((q, index) => {
        baseTime.setMinutes(baseTime.getMinutes() - (queue.length - index) * 5);
        q.received_at = baseTime.toISOString();
      });
      
      await saveQuestionQueue(queue);
    }

    // キューを受信日時順でソート（古いものが上に）
    // 同じ時刻の場合はIDで安定ソート
    queue.sort((a, b) => {
      const timeA = new Date(a.received_at).getTime();
      const timeB = new Date(b.received_at).getTime();
      if (timeA === timeB) {
        return a.id.localeCompare(b.id); // IDで安定ソート
      }
      return timeA - timeB;
    });

    // 仮想スクロールを使用するかどうかの判定
    const useVirtualScroll = VirtualScrollManager && queue.length > 50;
    
    if (useVirtualScroll && !isVirtualScrollEnabled) {
      // 仮想スクロールを初期化
      initVirtualScroll();
    } else if (!useVirtualScroll && isVirtualScrollEnabled) {
      // 仮想スクロールを無効化
      disableVirtualScroll();
    }
    
    if (isVirtualScrollEnabled) {
      // 仮想スクロールでの描画
      renderWithVirtualScroll(queue);
    } else {
      // 通常の描画
      renderWithNormalScroll(queue);
    }
  }
  
  function initVirtualScroll() {
    if (!VirtualScrollManager) return;
    
    try {
      virtualScrollManager = new VirtualScrollManager(queueDisplay, {
        itemHeight: 80,
        containerHeight: 200,
        overscan: 5,
        enableDebug: false
      });
      
      // カスタムレンダラーを設定
      virtualScrollManager.renderItemContent = (element, item, index) => {
        const statusText = getStatusDisplayText(item.status);
        const statusIcon = getStatusIcon(item.status);
        const isNext = item.status === 'next';
        const canManualSend = item.status === 'pending' || item.status === 'next';
        const canSetNext = item.status === 'pending';
        
        element.className = `queue-item status-${item.status} ${isNext ? 'next-item' : ''} ${canSetNext ? 'clickable' : ''}`;
        element.setAttribute('data-question-id', item.id);
        
        if (canSetNext) {
          element.setAttribute('title', 'クリックしてNEXTに設定');
        }
        
        element.innerHTML = `
          <div class="queue-item-header">
            <span class="queue-status-icon">${statusIcon}</span>
            <span class="queue-status-text">${statusText}</span>
            ${isNext ? '<span class="next-badge">NEXT</span>' : ''}
            <div class="queue-actions">
              ${canManualSend ? `<button class="manual-send-btn" data-question-id="${item.id}" title="手動送信">✈️</button>` : ''}
              <button class="delete-btn" data-question-id="${item.id}" title="削除">🗑️</button>
            </div>
          </div>
          <div class="queue-text">${item.text}</div>
          <div class="queue-meta">
            受信: ${new Date(item.received_at).toLocaleString()}
            ${item.sent_at ? ` | 送信: ${new Date(item.sent_at).toLocaleString()}` : ''}
            ${item.skipped_reason ? ` | スキップ理由: ${item.skipped_reason}` : ''}
          </div>
        `;
        
        // イベントリスナーを追加
        attachQueueItemEvents(element, item);
      };
      
      isVirtualScrollEnabled = true;
      console.log('Virtual scroll enabled for queue display');
      
    } catch (error) {
      console.error('Failed to initialize virtual scroll:', error);
      isVirtualScrollEnabled = false;
    }
  }
  
  function disableVirtualScroll() {
    if (virtualScrollManager) {
      virtualScrollManager.destroy();
      virtualScrollManager = null;
    }
    isVirtualScrollEnabled = false;
    console.log('Virtual scroll disabled');
  }
  
  function renderWithVirtualScroll(queue) {
    if (virtualScrollManager) {
      virtualScrollManager.setItems(queue);
    }
  }
  
  function renderWithNormalScroll(queue) {
    queueDisplay.innerHTML = queue.map((q, index) => {
      const statusText = getStatusDisplayText(q.status);
      const statusIcon = getStatusIcon(q.status);
      const isNext = q.status === 'next';
      const canManualSend = q.status === 'pending' || q.status === 'next';
      const canSetNext = q.status === 'pending';
      
      return `
        <div class="queue-item status-${q.status} ${isNext ? 'next-item' : ''} ${canSetNext ? 'clickable' : ''}" 
             data-question-id="${q.id}" 
             ${canSetNext ? 'title="クリックしてNEXTに設定"' : ''}>
          <div class="queue-item-header">
            <span class="queue-status-icon">${statusIcon}</span>
            <span class="queue-status-text">${statusText}</span>
            ${isNext ? '<span class="next-badge">NEXT</span>' : ''}
            <div class="queue-actions">
              ${canManualSend ? `<button class="manual-send-btn" data-question-id="${q.id}" title="手動送信">✈️</button>` : ''}
              <button class="delete-btn" data-question-id="${q.id}" title="削除">🗑️</button>
            </div>
          </div>
          <div class="queue-text">${q.text}</div>
          <div class="queue-meta">
            受信: ${new Date(q.received_at).toLocaleString()}
            ${q.sent_at ? ` | 送信: ${new Date(q.sent_at).toLocaleString()}` : ''}
            ${q.skipped_reason ? ` | スキップ理由: ${q.skipped_reason}` : ''}
          </div>
        </div>
      `;
    }).join('');
    
    // イベントリスナーを一括追加
    const queueItems = queueDisplay.querySelectorAll('.queue-item');
    queueItems.forEach(item => {
      const questionId = item.getAttribute('data-question-id');
      const question = queue.find(q => q.id === questionId);
      if (question) {
        attachQueueItemEvents(item, question);
      }
    });
  }
  
  function attachQueueItemEvents(element, item) {
    // 削除ボタンのイベント
    const deleteBtn = element.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        await deleteQuestion(item.id);
      });
    }

    // 手動送信ボタンのイベント
    const manualSendBtn = element.querySelector('.manual-send-btn');
    if (manualSendBtn) {
      manualSendBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        await manualSendQuestion(item.id);
      });
    }

    // アイテムクリックイベント
    if (item.status === 'pending') {
      element.addEventListener('click', async (event) => {
        // ボタンクリックの場合は処理しない
        if (event.target.classList.contains('manual-send-btn') || 
            event.target.classList.contains('delete-btn')) {
          return;
        }
        
        await setQuestionAsNext(item.id);
      });
    }
  }

  async function getQuestionQueue() {
    return new Promise((resolve) => {
      chrome.storage.local.get('questionQueue', (data) => {
        resolve(data.questionQueue || []);
      });
    });
  }

  async function saveQuestionQueue(queue) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ questionQueue: queue }, () => {
        resolve();
      });
    });
  }

  function getStatusDisplayText(status) {
    switch (status) {
      case 'pending': return '待機中';
      case 'next': return '送信中';
      case 'sent': return '送信済み';
      case 'skipped': return 'スキップ';
      default: return status;
    }
  }

  function getStatusIcon(status) {
    switch (status) {
      case 'pending': return '⏳';
      case 'next': return '🚀';
      case 'sent': return '✅';
      case 'skipped': return '⏭️';
      default: return '❓';
    }
  }

  async function manualSendQuestion(questionId) {
    try {
      const response = await chrome.runtime.sendMessage({ 
        action: 'manualPost', 
        questionId: questionId 
      });
      
      if (response.success) {
        alert('質問を送信しました: ' + response.message);
        await displayQuestionQueue(); // キューを更新
      } else {
        alert('送信に失敗しました: ' + response.error);
      }
    } catch (error) {
      console.error('Manual send failed:', error);
      alert('送信に失敗しました: ' + error.message);
    }
  }

  async function setQuestionAsNext(questionId) {
    try {
      console.log('Setting question as next:', questionId);
      const response = await chrome.runtime.sendMessage({ 
        action: 'setQuestionAsNext', 
        questionId: questionId 
      });
      
      if (response.success) {
        await displayQuestionQueue(); // キューを更新
        console.log('Question set as next:', questionId);
      } else {
        console.warn('Failed to set question as next:', response.error);
      }
    } catch (error) {
      console.error('Failed to set question as next:', error);
    }
  }

  async function deleteQuestion(questionId) {
    console.log('Deleting question:', questionId);
    try {
      const queue = await getQuestionQueue();
      const newQueue = queue.filter(q => q.id !== questionId);
      await saveQuestionQueue(newQueue);
      await displayQuestionQueue();
      showStatusMessage('質問を削除しました', 'green');
    } catch (error) {
      console.error('Failed to delete question:', error);
      showStatusMessage('削除に失敗しました: ' + error.message, 'red');
    }
  }

  function showStatusMessage(message, type) {
    // 既存のステータスメッセージ関数を使用
    showUrlStatusMessage(message, type);
  }

  function updateModeDisplay(autoMode) {
    if (autoMode) {
      modeToggleButton.textContent = '自動';
      modeToggleButton.classList.remove('btn-primary');
      modeToggleButton.classList.add('btn-ghost');
    } else {
      modeToggleButton.textContent = '手動';
      modeToggleButton.classList.remove('btn-ghost');
      modeToggleButton.classList.add('btn-primary');
    }
  }

  function updateMarshmallowStatus(status) {
    switch (status) {
      case 'connected':
        marshmallowStatus.textContent = 'マシュマロ: 接続済み';
        marshmallowStatus.style.color = '#22c55e';
        break;
      case 'logged_out':
        marshmallowStatus.textContent = 'マシュマロ: ログアウト';
        marshmallowStatus.style.color = '#f59e0b';
        break;
      case 'disconnected':
      default:
        marshmallowStatus.textContent = 'マシュマロ: 未接続';
        marshmallowStatus.style.color = '#ef4444';
        break;
    }
  }
});

