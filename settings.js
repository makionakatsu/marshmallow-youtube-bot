// settings.js
console.log('Settings page loaded.');

document.addEventListener('DOMContentLoaded', async () => {
  // UI要素の取得
  const backButton = document.getElementById('backButton');
  const youtubeApiKeyInput = document.getElementById('youtubeApiKeyInput');
  const toggleApiKeyVisibilityButton = document.getElementById('toggleApiKeyVisibility');
  const saveApiKeyButton = document.getElementById('saveApiKeyButton');
  const apiKeyStatusMessage = document.getElementById('apiKeyStatusMessage');
  
  const postIntervalInput = document.getElementById('postIntervalInput');
  const maxRetryInput = document.getElementById('maxRetryInput');
  const questionPrefixInput = document.getElementById('questionPrefixInput');
  
  const ngWordsTextarea = document.getElementById('ngWordsTextarea');
  const saveNgWordsButton = document.getElementById('saveNgWordsButton');
  const ngWordsStatusMessage = document.getElementById('ngWordsStatusMessage');
  
  const testModeCheckbox = document.getElementById('testModeCheckbox');
  const notificationsCheckbox = document.getElementById('notificationsCheckbox');
  const saveOtherSettingsButton = document.getElementById('saveOtherSettingsButton');
  const otherSettingsStatusMessage = document.getElementById('otherSettingsStatusMessage');

  // 初期値の読み込み
  chrome.storage.local.get([
    'YOUTUBE_API_KEY',
    'POST_INTERVAL_SEC', 
    'MAX_RETRY_ATTEMPTS',
    'QUESTION_PREFIX',
    'NG_KEYWORDS',
    'TEST_MODE',
    'NOTIFICATIONS_ENABLED'
  ], async (data) => {
    // APIキーの表示
    if (data.YOUTUBE_API_KEY) {
      try {
        const decryptedKey = await simpleDecrypt(data.YOUTUBE_API_KEY);
        youtubeApiKeyInput.value = decryptedKey;
      } catch (error) {
        console.error('Failed to decrypt API key:', error);
      }
    }
    
    // 投稿設定
    postIntervalInput.value = data.POST_INTERVAL_SEC || 120;
    maxRetryInput.value = data.MAX_RETRY_ATTEMPTS || 3;
    questionPrefixInput.value = data.QUESTION_PREFIX || '【質問】';
    
    // NGワード
    if (data.NG_KEYWORDS && Array.isArray(data.NG_KEYWORDS)) {
      ngWordsTextarea.value = data.NG_KEYWORDS.join('\n');
    }
    
    // その他の設定
    testModeCheckbox.checked = data.TEST_MODE || false;
    notificationsCheckbox.checked = data.NOTIFICATIONS_ENABLED !== false; // デフォルトは有効
  });

  // 戻るボタン
  backButton.addEventListener('click', () => {
    window.close();
  });

  // APIキー表示切り替え
  toggleApiKeyVisibilityButton.addEventListener('click', () => {
    if (youtubeApiKeyInput.type === 'password') {
      youtubeApiKeyInput.type = 'text';
      toggleApiKeyVisibilityButton.textContent = 'Hide';
    } else {
      youtubeApiKeyInput.type = 'password';
      toggleApiKeyVisibilityButton.textContent = 'Show';
    }
  });

  // APIキー保存
  saveApiKeyButton.addEventListener('click', async () => {
    const apiKey = youtubeApiKeyInput.value.trim();
    if (apiKey) {
      try {
        const encryptedApiKey = await simpleEncrypt(apiKey);
        await chrome.storage.local.set({ 
          YOUTUBE_API_KEY: encryptedApiKey, 
          API_KEY_TEMP: apiKey 
        });
        showStatusMessage(apiKeyStatusMessage, 'APIキーを保存しました', 'success');
      } catch (error) {
        console.error('Encryption failed, saving as fallback:', error);
        await chrome.storage.local.set({ API_KEY_TEMP: apiKey });
        showStatusMessage(apiKeyStatusMessage, 'APIキーを保存しました（フォールバックモード）', 'warning');
      }
    } else {
      await chrome.storage.local.remove(['YOUTUBE_API_KEY', 'API_KEY_TEMP']);
      showStatusMessage(apiKeyStatusMessage, 'APIキーを削除しました', 'error');
    }
  });

  // NGワード保存
  saveNgWordsButton.addEventListener('click', async () => {
    const ngWordsText = ngWordsTextarea.value.trim();
    let ngWords = [];
    
    if (ngWordsText) {
      ngWords = ngWordsText.split('\n')
        .map(word => word.trim())
        .filter(word => word.length > 0);
    }
    
    await chrome.storage.local.set({ NG_KEYWORDS: ngWords });
    showStatusMessage(ngWordsStatusMessage, `NGワードを保存しました（${ngWords.length}件）`, 'success');
  });

  // その他の設定保存
  saveOtherSettingsButton.addEventListener('click', async () => {
    const postInterval = parseInt(postIntervalInput.value) || 120;
    const maxRetry = parseInt(maxRetryInput.value) || 3;
    const questionPrefix = questionPrefixInput.value || '【質問】';
    const testMode = testModeCheckbox.checked;
    const notificationsEnabled = notificationsCheckbox.checked;
    
    // バリデーション
    if (postInterval < 30) {
      showStatusMessage(otherSettingsStatusMessage, '投稿間隔は30秒以上にしてください', 'error');
      return;
    }
    
    if (maxRetry < 1 || maxRetry > 10) {
      showStatusMessage(otherSettingsStatusMessage, 'リトライ回数は1-10回の範囲で設定してください', 'error');
      return;
    }
    
    await chrome.storage.local.set({
      POST_INTERVAL_SEC: postInterval,
      MAX_RETRY_ATTEMPTS: maxRetry,
      QUESTION_PREFIX: questionPrefix,
      TEST_MODE: testMode,
      NOTIFICATIONS_ENABLED: notificationsEnabled
    });
    
    showStatusMessage(otherSettingsStatusMessage, '設定を保存しました', 'success');
  });

  // ステータスメッセージ表示関数
  function showStatusMessage(element, message, type) {
    element.textContent = message;
    element.className = 'status-message';
    if (type === 'success') element.classList.add('success');
    else if (type === 'error') element.classList.add('error');
    else if (type === 'warning') element.classList.add('warning');
    
    setTimeout(() => {
      element.textContent = '';
      element.className = 'status-message';
    }, 3000);
  }

  // 暗号化関数（popup.jsから複製）
  async function generateEncryptionKey() {
    try {
      const deviceInfo = 'marshmallow-youtube-bot-v1';
      
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
      
      return key;
    } catch (error) {
      console.error('Failed to generate encryption key:', error);
      throw new Error('Key generation failed: ' + error.message);
    }
  }

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
      
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      return '';
    }
  }

  async function simpleDecrypt(encryptedText) {
    try {
      if (!encryptedText || encryptedText.trim() === '') {
        return '';
      }

      if (!crypto || !crypto.subtle) {
        console.error('Web Crypto API is not available');
        return '';
      }

      const key = await generateEncryptionKey();
      let combined;
      
      try {
        combined = new Uint8Array(
          atob(encryptedText).split('').map(char => char.charCodeAt(0))
        );
      } catch (base64Error) {
        console.error('Failed to decode base64:', base64Error);
        return '';
      }
      
      if (combined.length < 12) {
        console.error('Encrypted data too short:', combined.length);
        return '';
      }
      
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encrypted
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '';
    }
  }
});