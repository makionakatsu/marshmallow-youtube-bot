// Background Script 通信テスト用モジュール
// test_background_communication.js

/**
 * Background Script通信のテスト用クラス
 */
class BackgroundCommunicationTester {
  constructor() {
    this.testResults = [];
    this.mockResponses = new Map();
  }

  /**
   * Chrome runtime API のモック設定
   */
  setupMockChrome() {
    if (typeof chrome === 'undefined') {
      // Chrome API が存在しない場合のモック作成
      window.chrome = {
        runtime: {
          id: 'mock-extension-id',
          lastError: null,
          sendMessage: this.mockSendMessage.bind(this),
          onMessage: {
            addListener: (callback) => {
              console.log('Mock: onMessage listener added');
            }
          }
        },
        storage: {
          local: {
            get: (keys, callback) => {
              // 模擬設定データ
              const mockData = {
                pollingInterval: 30000,
                youtubeApiKey: 'mock-api-key',
                youtubeLiveUrl: 'https://www.youtube.com/watch?v=mock-video-id'
              };
              callback(mockData);
            },
            set: (data, callback) => {
              console.log('Mock: Storage set:', data);
              if (callback) callback();
            }
          },
          onChanged: {
            addListener: (callback) => {
              console.log('Mock: Storage change listener added');
            }
          }
        }
      };
      console.log('Chrome API mock created');
    }
  }

  /**
   * モック送信メッセージ設定
   */
  setMockResponse(action, response) {
    this.mockResponses.set(action, response);
  }

  /**
   * chrome.runtime.sendMessage のモック実装
   */
  mockSendMessage(message, callback) {
    console.log('Mock sendMessage called:', message);
    
    // 遅延をシミュレート
    setTimeout(() => {
      const response = this.mockResponses.get(message.action) || {
        success: true,
        data: `Mock response for ${message.action}`
      };
      
      if (callback) {
        callback(response);
      }
    }, 100);
  }

  /**
   * Extension Context無効化のシミュレート
   */
  simulateContextInvalidation() {
    chrome.runtime.id = undefined;
    chrome.runtime.lastError = {
      message: 'Extension context invalidated'
    };
    console.log('Extension context invalidation simulated');
  }

  /**
   * Extension Context復旧のシミュレート
   */
  restoreContext() {
    chrome.runtime.id = 'mock-extension-id';
    chrome.runtime.lastError = null;
    console.log('Extension context restored');
  }

  /**
   * 基本通信テスト
   */
  async testBasicCommunication() {
    console.log('=== 基本通信テスト開始 ===');
    
    try {
      const contextManager = new ExtensionContextManager();
      const communicator = new BackgroundCommunicator(contextManager);
      
      // 正常な通信テスト
      this.setMockResponse('test', {
        success: true,
        message: 'Test communication successful'
      });
      
      const response = await communicator.sendMessageSafely({
        action: 'test',
        data: 'Hello from content script'
      });
      
      console.log('✓ 基本通信成功:', response);
      this.testResults.push({
        test: '基本通信',
        status: 'success',
        details: response
      });
      
    } catch (error) {
      console.error('✗ 基本通信エラー:', error.message);
      this.testResults.push({
        test: '基本通信',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * エラーハンドリングテスト
   */
  async testErrorHandling() {
    console.log('=== エラーハンドリングテスト開始 ===');
    
    try {
      const contextManager = new ExtensionContextManager();
      const communicator = new BackgroundCommunicator(contextManager);
      
      // Extension Context無効化テスト
      this.simulateContextInvalidation();
      
      try {
        await communicator.sendMessageSafely({
          action: 'test-error',
          data: 'This should fail'
        });
        
        console.log('✗ エラーが発生しなかった（予期しない結果）');
        this.testResults.push({
          test: 'エラーハンドリング',
          status: 'error',
          details: 'Expected error did not occur'
        });
        
      } catch (error) {
        console.log('✓ 期待通りエラーが発生:', error.message);
        this.testResults.push({
          test: 'エラーハンドリング',
          status: 'success',
          details: `Expected error: ${error.message}`
        });
      }
      
      // Context復旧
      this.restoreContext();
      
    } catch (error) {
      console.error('✗ エラーハンドリングテストエラー:', error.message);
      this.testResults.push({
        test: 'エラーハンドリング',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * リトライ機能テスト
   */
  async testRetryMechanism() {
    console.log('=== リトライ機能テスト開始 ===');
    
    try {
      const contextManager = new ExtensionContextManager();
      const communicator = new BackgroundCommunicator(contextManager);
      
      let attemptCount = 0;
      
      // リトライが必要な応答をモック
      const originalMockSendMessage = this.mockSendMessage;
      this.mockSendMessage = (message, callback) => {
        attemptCount++;
        console.log(`Mock sendMessage attempt ${attemptCount}`);
        
        if (attemptCount < 3) {
          // 最初の2回は失敗
          chrome.runtime.lastError = {
            message: 'Network error (simulated)'
          };
          callback(null);
        } else {
          // 3回目は成功
          chrome.runtime.lastError = null;
          callback({
            success: true,
            message: 'Success after retry'
          });
        }
      };
      
      const response = await communicator.sendMessageSafely({
        action: 'retry-test',
        data: 'Test retry mechanism'
      });
      
      console.log(`✓ リトライ成功 (${attemptCount}回の試行):`, response);
      this.testResults.push({
        test: 'リトライ機能',
        status: 'success',
        details: `Success after ${attemptCount} attempts`
      });
      
      // モックを元に戻す
      this.mockSendMessage = originalMockSendMessage;
      
    } catch (error) {
      console.error('✗ リトライ機能テストエラー:', error.message);
      this.testResults.push({
        test: 'リトライ機能',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * マシュマロメッセージ送信テスト
   */
  async testMarshmallowMessageSending() {
    console.log('=== マシュマロメッセージ送信テスト開始 ===');
    
    try {
      const contextManager = new ExtensionContextManager();
      const communicator = new BackgroundCommunicator(contextManager);
      
      // マシュマロメッセージの模擬データ
      const mockMessages = [
        {
          id: 'test-uuid-1',
          text: 'これはテスト質問1です。',
          received_at: '2025-01-13T10:00:00Z'
        },
        {
          id: 'test-uuid-2',
          text: 'これはテスト質問2です。',
          received_at: '2025-01-13T09:30:00Z'
        }
      ];
      
      this.setMockResponse('newMarshmallowMessages', {
        success: true,
        processed: mockMessages.length,
        queued: mockMessages.length
      });
      
      const response = await communicator.sendMessageSafely({
        action: 'newMarshmallowMessages',
        messages: mockMessages,
        isLoggedIn: true
      });
      
      console.log('✓ マシュマロメッセージ送信成功:', response);
      this.testResults.push({
        test: 'マシュマロメッセージ送信',
        status: 'success',
        details: response
      });
      
    } catch (error) {
      console.error('✗ マシュマロメッセージ送信エラー:', error.message);
      this.testResults.push({
        test: 'マシュマロメッセージ送信',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * 全テスト実行
   */
  async runAllTests() {
    console.log('=== Background Script通信テスト開始 ===');
    
    this.setupMockChrome();
    this.testResults = [];
    
    await this.testBasicCommunication();
    await this.testErrorHandling();
    await this.testRetryMechanism();
    await this.testMarshmallowMessageSending();
    
    console.log('=== Background Script通信テスト完了 ===');
    return this.testResults;
  }

  /**
   * テスト結果の表示
   */
  displayResults() {
    console.log('\n=== テスト結果サマリー ===');
    let successCount = 0;
    let totalCount = this.testResults.length;
    
    this.testResults.forEach(result => {
      const status = result.status === 'success' ? '✓' : '✗';
      console.log(`${status} ${result.test}: ${result.details}`);
      if (result.status === 'success') successCount++;
    });
    
    console.log(`\n成功: ${successCount}/${totalCount} (${Math.round(successCount/totalCount*100)}%)`);
    
    return {
      total: totalCount,
      success: successCount,
      successRate: Math.round(successCount/totalCount*100)
    };
  }
}

// テスト実行用の関数
async function runBackgroundCommunicationTests() {
  const tester = new BackgroundCommunicationTester();
  const results = await tester.runAllTests();
  const summary = tester.displayResults();
  
  return {
    results,
    summary
  };
}

// ブラウザ環境での使用
if (typeof window !== 'undefined') {
  window.BackgroundCommunicationTester = BackgroundCommunicationTester;
  window.runBackgroundCommunicationTests = runBackgroundCommunicationTests;
}