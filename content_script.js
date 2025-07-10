// content_script.js

console.log('Marshmallow content script loaded.');

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

  messageElements.forEach(el => {
    // メッセージIDの抽出 (id="message_UUID" から UUID を取得)
    const id = el.id ? el.id.replace('message_', '') : null;
    // 質問本文の抽出
    const textElement = el.querySelector('div[data-outview-target="searchable"] a[data-obscene-word-target="content"]');
    const text = textElement ? textElement.textContent : '';
    // 受信日時の抽出 (正確な datetime 属性が見当たらないため、現在の時刻を使用)
    const receivedAt = new Date().toISOString();

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
  chrome.runtime.sendMessage({
    action: 'newMarshmallowMessages',
    messages: messages,
    isLoggedIn: isLoggedIn
  });
}

let lastSentMessages = [];
let lastLoginStatus = checkLoginStatus();

// 定期的にメッセージを抽出し、変更があれば送信
function pollAndSendMessages() {
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
}

// MutationObserver の設定
let observer = null;
const targetNode = document.querySelector('ul#messages');

if (targetNode) {
  observer = new MutationObserver((mutationsList, observer) => {
    // DOMの変更があった場合にポーリング関数を呼び出す
    pollAndSendMessages();
  });
  
  observer.observe(targetNode, { childList: true, subtree: true });
  console.log('MutationObserver started on inbox container.');
} else {
  console.warn('Target node for MutationObserver not found. Falling back to setInterval.');
}

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
    if (!observer && targetNode) {
      observer = new MutationObserver((mutationsList, observer) => {
        pollAndSendMessages();
      });
      observer.observe(targetNode, { childList: true, subtree: true });
      console.log('MutationObserver restarted due to page being visible.');
    }
  }
});

// POLL_INTERVAL_SEC ごとにポーリング関数を呼び出す (MutationObserverの補助として)
let pollInterval = 30; // デフォルト値
chrome.storage.local.get('POLL_INTERVAL_SEC', (data) => {
  if (data.POLL_INTERVAL_SEC) {
    pollInterval = data.POLL_INTERVAL_SEC;
  }
  setInterval(pollAndSendMessages, pollInterval * 1000);
  console.log(`Polling every ${pollInterval} seconds.`);
});

// 初回実行
pollAndSendMessages();