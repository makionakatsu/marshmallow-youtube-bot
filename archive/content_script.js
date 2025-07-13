// content_script.js

// Extension context の有効性をグローバルにチェック
let extensionContextValid = true;
let gracefulShutdownInitiated = false;

function isExtensionContextValid() {
  try {
    // より厳密なチェック
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      return false;
    }
    // runtime.id が存在するかチェック
    if (!chrome.runtime.id) {
      return false;
    }
    return true;
  } catch (error) {
    console.warn('Extension context check failed:', error.message);
    return false;
  }
}

// コンテキストが無効化された際の処理
function handleContextInvalidation() {
  if (gracefulShutdownInitiated) {
    return; // 既にシャットダウン処理中
  }
  
  gracefulShutdownInitiated = true;
  extensionContextValid = false;
  console.warn('Extension context invalidated. Initiating graceful shutdown.');
  
  // タイマーやObserverを停止
  try {
    if (window.marshmallowPollingInterval) {
      clearInterval(window.marshmallowPollingInterval);
      window.marshmallowPollingInterval = null;
    }
    if (window.marshmallowObserver) {
      window.marshmallowObserver.disconnect();
      window.marshmallowObserver = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  } catch (error) {
    console.warn('Error during graceful shutdown:', error.message);
  }
  
  // 全てのグローバル変数をクリア
  lastSentMessages = [];
  lastLoginStatus = false;
  
  console.log('Content script shutdown complete.');
}

// 初期チェック - 無効な場合は即座に終了
const initialContextValid = isExtensionContextValid();
if (!initialContextValid) {
  console.warn('Extension context is invalid at startup. Aborting content script.');
  handleContextInvalidation();
  // 以下のすべての処理をスキップ
} else {
  console.log('Marshmallow content script loaded.');
}

// マシュマロのログイン状態をチェックする関数
function checkLoginStatus() {
  // #inbox-count 要素の存在でログイン状態と受信箱ページにいることを判断
  const isLoggedIn = document.querySelector('#inbox-count') !== null;
  return isLoggedIn;
}

// マシュマロ受信箱から質問を抽出する関数
function extractMessages() {
  const messages = [];
  // 各メッセージのコンテナ要素
  const messageElements = document.querySelectorAll('ul#messages > li.message');

  messageElements.forEach((el, index) => {
    // メッセージIDの抽出 (id="message_UUID" から UUID を取得)
    const id = el.id ? el.id.replace('message_', '') : null;
    // 質問本文の抽出
    const textElement = el.querySelector('div[data-outview-target="searchable"] a[data-obscene-word-target="content"]');
    const text = textElement ? textElement.textContent : '';
    
    // 受信日時の抽出を試行
    let receivedAt = null;
    
    // 複数の可能な日時要素をチェック
    const timeSelectors = [
      'time',
      '[datetime]',
      '.time',
      '.date',
      '.timestamp',
      '[data-time]',
      'span[title*="日"]',
      'span[title*="時"]'
    ];
    
    for (const selector of timeSelectors) {
      const timeElement = el.querySelector(selector);
      if (timeElement) {
        // datetime 属性をチェック
        const datetimeAttr = timeElement.getAttribute('datetime');
        if (datetimeAttr) {
          receivedAt = new Date(datetimeAttr).toISOString();
          break;
        }
        
        // title 属性をチェック
        const titleAttr = timeElement.getAttribute('title');
        if (titleAttr) {
          const parsedDate = new Date(titleAttr);
          if (!isNaN(parsedDate.getTime())) {
            receivedAt = parsedDate.toISOString();
            break;
          }
        }
        
        // テキストコンテンツをチェック
        const timeText = timeElement.textContent.trim();
        if (timeText) {
          const parsedDate = new Date(timeText);
          if (!isNaN(parsedDate.getTime())) {
            receivedAt = parsedDate.toISOString();
            break;
          }
        }
      }
    }
    
    // 日時が取得できない場合は、DOM内の順序を基にした疑似時刻を使用
    if (!receivedAt) {
      // マシュマロのDOM順序を確認：
      // 通常、最新のメッセージが上に表示されるため、indexが小さいほど新しい
      // そのため、indexが大きいほど古い時刻を設定
      const baseTime = new Date();
      // index 0 = 最新、index n = 最古として時刻を設定
      baseTime.setMinutes(baseTime.getMinutes() - (index * 10)); // 10分間隔で設定
      receivedAt = baseTime.toISOString();
      console.log(`No timestamp found for message ${id} (index: ${index}). Using pseudo-timestamp: ${receivedAt}`);
    }

    if (id && text) {
      messages.push({
        id: id,
        text: text.trim(),
        received_at: receivedAt
      });
    }
  });
  return messages;
}

// background.service_worker.js にメッセージを送信する関数
function sendMessagesToBackground(messages, isLoggedIn) {
  // 早期リターン: シャットダウン済みまたはコンテキスト無効
  if (gracefulShutdownInitiated || !extensionContextValid) {
    console.warn('Extension context invalidated or shutdown initiated. Skipping message send.');
    return;
  }

  // Extension context が有効かチェック
  if (!isExtensionContextValid()) {
    console.warn('Extension context is invalidated. Initiating shutdown.');
    handleContextInvalidation();
    return;
  }

  try {
    chrome.runtime.sendMessage({
      action: 'newMarshmallowMessages',
      messages: messages,
      isLoggedIn: isLoggedIn
    }, (response) => {
      // 応答チェック（エラーハンドリング）
      if (chrome.runtime.lastError) {
        console.warn('Message send failed:', chrome.runtime.lastError.message);
        if (chrome.runtime.lastError.message.includes('context invalidated') || 
            chrome.runtime.lastError.message.includes('Extension context invalidated')) {
          console.log('Extension context invalidated during message send. Initiating shutdown.');
          handleContextInvalidation();
        }
      }
    });
  } catch (error) {
    console.warn('Failed to send message to background:', error.message);
    if (error.message.includes('Extension context invalidated')) {
      handleContextInvalidation();
    }
  }
}

// メイン処理は extension context が有効な場合のみ実行
if (initialContextValid) {

let lastSentMessages = [];
let lastLoginStatus = checkLoginStatus();

// 定期的にメッセージを抽出し、変更があれば送信
function pollAndSendMessages() {
  try {
    // 早期リターン: シャットダウン済みまたはコンテキスト無効
    if (gracefulShutdownInitiated || !extensionContextValid) {
      console.warn('Extension context invalidated or shutdown initiated. Stopping polling.');
      return;
    }

    // Extension context が無効化されている場合は処理を停止
    if (!isExtensionContextValid()) {
      console.warn('Extension context invalidated during polling. Initiating shutdown.');
      handleContextInvalidation();
      return;
    }

    const currentLoginStatus = checkLoginStatus();
    if (currentLoginStatus !== lastLoginStatus) {
      // ログイン状態が変化した場合
      sendMessagesToBackground([], currentLoginStatus); // ログイン状態のみを通知
      lastLoginStatus = currentLoginStatus;
    }

    if (currentLoginStatus) {
      const currentMessages = extractMessages();
      // 新しいメッセージがあるか、またはメッセージが減った場合（削除など）に送信
      // IDのみを比較して、メッセージの内容変更は無視する
      const currentMessageIds = currentMessages.map(msg => msg.id);
      const lastSentMessageIds = lastSentMessages.map(msg => msg.id);

      // 新しいメッセージが追加されたか、既存のメッセージが削除されたかをチェック
      const newMessagesAdded = currentMessageIds.some(id => !lastSentMessageIds.includes(id));
      const oldMessagesRemoved = lastSentMessageIds.some(id => !currentMessageIds.includes(id));

      if (newMessagesAdded || oldMessagesRemoved) {
        sendMessagesToBackground(currentMessages, currentLoginStatus);
        lastSentMessages = currentMessages;
      }
    }
  } catch (error) {
    console.warn('Polling function error:', error.message);
    if (error.message.includes('Extension context invalidated')) {
      handleContextInvalidation();
    }
  }
}

// MutationObserver の設定
let observer = null;

function setupMutationObserver() {
  // 複数の可能な要素をチェック
  const possibleTargets = [
    'ul#messages',           // 元の想定
    '#messages',             // ID直接
    '.messages',             // クラス
    '[data-messages]',       // data属性
    'main',                  // メインコンテンツ
    '.inbox-container',      // 受信箱コンテナ
    '.message-list'          // メッセージリスト
  ];

  let targetNode = null;
  
  for (const selector of possibleTargets) {
    targetNode = document.querySelector(selector);
    if (targetNode) {
      console.log(`Found target node with selector: ${selector}`);
      break;
    }
  }

  if (targetNode) {
    observer = new MutationObserver((mutationsList, observer) => {
      try {
        // 早期リターン: シャットダウン済みまたはコンテキスト無効
        if (gracefulShutdownInitiated || !extensionContextValid) {
          return;
        }
        
        // Extension context が無効化されている場合は処理を停止
        if (!isExtensionContextValid()) {
          console.warn('Extension context invalidated in MutationObserver. Initiating shutdown.');
          handleContextInvalidation();
          return;
        }
        
        // DOMの変更があった場合にポーリング関数を呼び出す
        pollAndSendMessages();
      } catch (error) {
        console.warn('MutationObserver callback error:', error.message);
        if (error.message.includes('Extension context invalidated')) {
          handleContextInvalidation();
        }
      }
    });
    
    observer.observe(targetNode, { childList: true, subtree: true });
    console.log('MutationObserver started on target node.');
  } else {
    console.warn('Target node for MutationObserver not found. Available elements:');
    console.log('Available IDs:', Array.from(document.querySelectorAll('[id]')).map(el => el.id));
    console.log('Available classes:', Array.from(document.querySelectorAll('[class]')).map(el => el.className));
    console.warn('Falling back to setInterval polling.');
  }
  
  return targetNode;
}

const targetNode = setupMutationObserver();

// ページがアンロードされる際にMutationObserverを停止
window.addEventListener('beforeunload', () => {
  if (observer) {
    observer.disconnect();
    observer = null;
    console.log('MutationObserver disconnected due to page unload.');
  }
});

// ページが隠れた際にMutationObserverを停止
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (observer) {
      observer.disconnect();
      observer = null;
      console.log('MutationObserver disconnected due to page being hidden.');
    }
  } else {
    // ページが再び表示された際にMutationObserverを再開
    if (!observer && targetNode && !gracefulShutdownInitiated && extensionContextValid) {
      // Extension context が有効かチェック
      if (!isExtensionContextValid()) {
        console.warn('Extension context invalid during MutationObserver restart. Aborting.');
        handleContextInvalidation();
        return;
      }
      
      observer = new MutationObserver((mutationsList, observer) => {
        try {
          // 早期リターン: シャットダウン済みまたはコンテキスト無効
          if (gracefulShutdownInitiated || !extensionContextValid) {
            return;
          }
          
          // Extension context が無効化されている場合は処理を停止
          if (!isExtensionContextValid()) {
            console.warn('Extension context invalidated in restarted MutationObserver. Initiating shutdown.');
            handleContextInvalidation();
            return;
          }
          
          pollAndSendMessages();
        } catch (error) {
          console.warn('MutationObserver restart callback error:', error.message);
          if (error.message.includes('Extension context invalidated')) {
            handleContextInvalidation();
          }
        }
      });
      observer.observe(targetNode, { childList: true, subtree: true });
      console.log('MutationObserver restarted due to page being visible.');
    }
  }
});

// POLL_INTERVAL_SEC ごとにポーリング関数を呼び出す (MutationObserverの補助として)
let pollInterval = 30; // デフォルト値

// Extension context チェック付きでストレージアクセス
if (isExtensionContextValid() && chrome.storage && chrome.storage.local) {
  try {
    chrome.storage.local.get('POLL_INTERVAL_SEC', (data) => {
      // 再度extension contextをチェック（コールバック実行時に無効化されている可能性）
      if (!isExtensionContextValid()) {
        console.warn('Extension context invalidated during storage access. Aborting.');
        handleContextInvalidation();
        return;
      }
      
      if (chrome.runtime.lastError) {
        console.warn('Storage access failed:', chrome.runtime.lastError.message);
        if (chrome.runtime.lastError.message.includes('context invalidated')) {
          handleContextInvalidation();
          return;
        }
        // フォールバック: デフォルト値を使用
        window.marshmallowPollingInterval = setInterval(pollAndSendMessages, pollInterval * 1000);
        console.log(`Using default polling interval: ${pollInterval} seconds.`);
        return;
      }
      
      if (data.POLL_INTERVAL_SEC) {
        pollInterval = data.POLL_INTERVAL_SEC;
      }
      window.marshmallowPollingInterval = setInterval(pollAndSendMessages, pollInterval * 1000);
      console.log(`Polling every ${pollInterval} seconds.`);
    });
  } catch (error) {
    console.warn('Failed to access storage:', error.message);
    if (error.message.includes('Extension context invalidated')) {
      handleContextInvalidation();
      return;
    }
    // フォールバック: デフォルト値を使用
    window.marshmallowPollingInterval = setInterval(pollAndSendMessages, pollInterval * 1000);
    console.log(`Using default polling interval: ${pollInterval} seconds.`);
  }
} else {
  console.warn('Extension context invalid or Chrome storage API not available. Using default polling interval.');
  window.marshmallowPollingInterval = setInterval(pollAndSendMessages, pollInterval * 1000);
  console.log(`Using default polling interval: ${pollInterval} seconds.`);
}

// 初回実行（エラーハンドリング付き）
try {
  // Extension context が有効な場合のみ初回実行
  if (isExtensionContextValid() && !gracefulShutdownInitiated && extensionContextValid) {
    pollAndSendMessages();
  } else {
    console.warn('Extension context invalid at initial execution. Aborting.');
    handleContextInvalidation();
  }
} catch (error) {
  console.warn('Initial polling failed:', error.message);
  if (error.message.includes('Extension context invalidated')) {
    handleContextInvalidation();
  }
}

} // End of initialContextValid check