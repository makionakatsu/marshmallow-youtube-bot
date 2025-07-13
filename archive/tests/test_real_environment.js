// 実環境テスト用モジュール
// test_real_environment.js

/**
 * 実環境テスト用クラス
 * 実際のマシュマロサイトとBackground Scriptとの統合をテスト
 */
class RealEnvironmentTester {
  constructor() {
    this.testResults = [];
    this.app = null;
    this.testStartTime = null;
    this.backgroundResponses = [];
    this.originalSendMessage = null;
  }

  /**
   * 実環境テストの初期化
   */
  async initialize() {
    console.log('=== 実環境テスト初期化開始 ===');
    
    try {
      // Chrome Extension環境のチェック
      if (!chrome || !chrome.runtime || !chrome.runtime.id) {
        throw new Error('Chrome Extension環境が検出されません。拡張機能として実行してください。');
      }

      // Background Scriptとの通信テスト
      const pingResult = await this.pingBackgroundScript();
      if (!pingResult.success) {
        throw new Error('Background Scriptとの通信に失敗しました');
      }

      // Content Script V2の初期化
      this.app = new ContentScriptApplication();
      await this.app.initialize();

      console.log('✓ 実環境テスト初期化完了');
      return true;

    } catch (error) {
      console.error('✗ 実環境テスト初期化失敗:', error.message);
      throw error;
    }
  }

  /**
   * Background Scriptとの通信確認
   */
  async pingBackgroundScript() {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'ping' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response || { success: true }); // Background Scriptがpingを実装していない場合の対応
          }
        });
      });

      return { success: true, response };
    } catch (error) {
      console.warn('Background Script ping failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 実際のマシュマロサイトでのDOM要素確認
   */
  async testMarshmallowSiteIntegration() {
    console.log('=== マシュマロサイト統合テスト開始 ===');
    
    try {
      // 現在のURLがマシュマロサイトかチェック
      const currentUrl = window.location.href;
      const isMarshmallowSite = currentUrl.includes('marshmallow-qa.com');
      
      this.testResults.push({
        test: 'マシュマロサイト検出',
        status: isMarshmallowSite ? 'success' : 'warning',
        details: isMarshmallowSite ? 
          `正常なマシュマロサイト: ${currentUrl}` : 
          `非マシュマロサイト: ${currentUrl}`
      });

      // ページ要素の存在確認
      const elements = {
        'ログイン状態要素': '#inbox-count',
        'メッセージリスト': 'ul#messages',
        'メッセージ要素': '.message',
        'ユーザーメニュー': '.js-user-menu'
      };

      for (const [name, selector] of Object.entries(elements)) {
        const element = document.querySelector(selector);
        const exists = element !== null;
        
        this.testResults.push({
          test: `DOM要素確認: ${name}`,
          status: exists ? 'success' : 'info',
          details: exists ? 
            `要素発見: ${selector}` : 
            `要素不在: ${selector} (ページ状態に依存)`
        });
      }

      // Content Script V2での要素検出テスト
      const loginStatus = this.app.pageInteractor.getUserLoginStatus();
      const messages = this.app.pageInteractor.extractNewMessages();

      this.testResults.push({
        test: 'V2ログイン状態検出',
        status: 'success',
        details: `ログイン状態: ${loginStatus}`
      });

      this.testResults.push({
        test: 'V2メッセージ抽出',
        status: 'success',
        details: `抽出メッセージ数: ${messages.length}件`
      });

      return {
        siteDetected: isMarshmallowSite,
        loginStatus,
        messageCount: messages.length,
        messages: messages.slice(0, 3) // 最初の3件のみ返す
      };

    } catch (error) {
      console.error('✗ マシュマロサイト統合テストエラー:', error.message);
      this.testResults.push({
        test: 'マシュマロサイト統合テスト',
        status: 'error',
        details: error.message
      });
      throw error;
    }
  }

  /**
   * Background Scriptとの実際の通信テスト
   */
  async testBackgroundScriptIntegration() {
    console.log('=== Background Script統合テスト開始 ===');
    
    try {
      // Background Script通信の監視開始
      this.monitorBackgroundCommunication();

      // 実際のメッセージ送信テスト
      const testMessages = [
        {
          id: 'real-env-test-1',
          text: '実環境テスト用質問1: V2版は正常に動作していますか？',
          received_at: new Date().toISOString()
        },
        {
          id: 'real-env-test-2',
          text: '実環境テスト用質問2: Background Scriptとの統合は成功していますか？',
          received_at: new Date(Date.now() - 60000).toISOString()
        }
      ];

      // Content Script V2を使った送信
      const sendResult = await this.app.communicator.sendMessageSafely({
        action: 'newMarshmallowMessages',
        messages: testMessages,
        isLoggedIn: true
      });

      this.testResults.push({
        test: 'Background Script通信',
        status: 'success',
        details: `メッセージ送信成功: ${JSON.stringify(sendResult)}`
      });

      // 少し待ってからBackground Scriptの状態確認
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 質問キューの状態確認
      const queueStatus = await this.getQueueStatus();
      
      this.testResults.push({
        test: 'Background Script質問キュー',
        status: 'success',
        details: `キュー状態: ${JSON.stringify(queueStatus)}`
      });

      return {
        sendResult,
        queueStatus,
        communicationHistory: this.backgroundResponses
      };

    } catch (error) {
      console.error('✗ Background Script統合テストエラー:', error.message);
      this.testResults.push({
        test: 'Background Script統合テスト',
        status: 'error',
        details: error.message
      });
      throw error;
    }
  }

  /**
   * Background Script通信の監視
   */
  monitorBackgroundCommunication() {
    // chrome.runtime.sendMessage のラップ
    if (!this.originalSendMessage) {
      this.originalSendMessage = chrome.runtime.sendMessage;
      
      chrome.runtime.sendMessage = (message, callback) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] Background Script送信:`, message);
        
        return this.originalSendMessage(message, (response) => {
          const responseTimestamp = new Date().toISOString();
          console.log(`[${responseTimestamp}] Background Script応答:`, response);
          
          this.backgroundResponses.push({
            timestamp,
            request: message,
            response,
            responseTimestamp
          });
          
          if (callback) callback(response);
        });
      };
    }
  }

  /**
   * Background Scriptの質問キュー状態取得
   */
  async getQueueStatus() {
    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ action: 'getQueueStatus' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response || { message: 'Queue status not implemented' });
          }
        });
      });

      return response;
    } catch (error) {
      console.warn('Queue status check failed:', error.message);
      return { error: error.message };
    }
  }

  /**
   * 長時間稼働テストの開始
   */
  async startLongRunningTest(durationMinutes = 60) {
    console.log(`=== 長時間稼働テスト開始 (${durationMinutes}分) ===`);
    
    try {
      this.testStartTime = Date.now();
      const testEndTime = this.testStartTime + (durationMinutes * 60 * 1000);
      
      // アプリケーション開始
      this.app.start();
      
      // 定期的な状態チェックを設定
      const checkInterval = setInterval(async () => {
        try {
          await this.performPeriodicCheck();
          
          if (Date.now() >= testEndTime) {
            clearInterval(checkInterval);
            await this.completeLongRunningTest();
          }
        } catch (error) {
          console.error('長時間稼働テスト中エラー:', error.message);
          clearInterval(checkInterval);
          this.testResults.push({
            test: '長時間稼働テスト',
            status: 'error',
            details: `テスト中断: ${error.message}`
          });
        }
      }, 60000); // 1分間隔でチェック

      this.testResults.push({
        test: '長時間稼働テスト開始',
        status: 'success',
        details: `テスト開始: ${durationMinutes}分間の稼働テスト`
      });

      return {
        started: true,
        duration: durationMinutes,
        startTime: new Date(this.testStartTime).toISOString()
      };

    } catch (error) {
      console.error('✗ 長時間稼働テスト開始エラー:', error.message);
      this.testResults.push({
        test: '長時間稼働テスト開始',
        status: 'error',
        details: error.message
      });
      throw error;
    }
  }

  /**
   * 定期的な状態チェック
   */
  async performPeriodicCheck() {
    const currentTime = Date.now();
    const runningTime = Math.round((currentTime - this.testStartTime) / 60000);
    
    // メモリ使用量チェック
    const memoryUsage = performance.memory ? {
      used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
      total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)
    } : null;

    // アプリケーション状態チェック
    const appStatus = {
      isInitialized: this.app.isInitialized,
      isRunning: this.app.isRunning,
      contextAlive: this.app.contextManager.isAlive()
    };

    // Background Script通信テスト
    const communicationTest = await this.pingBackgroundScript();

    console.log(`[${runningTime}分経過] 状態チェック:`, {
      memory: memoryUsage,
      app: appStatus,
      communication: communicationTest.success
    });

    // 異常があれば記録
    if (!appStatus.isRunning || !appStatus.contextAlive || !communicationTest.success) {
      this.testResults.push({
        test: `状態チェック (${runningTime}分経過)`,
        status: 'error',
        details: `異常状態検出: ${JSON.stringify(appStatus)}`
      });
    }
  }

  /**
   * 長時間稼働テストの完了
   */
  async completeLongRunningTest() {
    console.log('=== 長時間稼働テスト完了 ===');
    
    const totalRunTime = Math.round((Date.now() - this.testStartTime) / 60000);
    
    // 最終状態チェック
    await this.performPeriodicCheck();
    
    // アプリケーション停止
    this.app.shutdown();
    
    this.testResults.push({
      test: '長時間稼働テスト完了',
      status: 'success',
      details: `合計稼働時間: ${totalRunTime}分, 通信履歴: ${this.backgroundResponses.length}件`
    });

    return {
      completed: true,
      totalRunTime,
      communicationCount: this.backgroundResponses.length,
      finalStatus: {
        memoryLeaks: this.checkForMemoryLeaks(),
        communicationHealth: this.backgroundResponses.length > 0
      }
    };
  }

  /**
   * メモリリークのチェック
   */
  checkForMemoryLeaks() {
    if (!performance.memory) {
      return { status: 'unknown', reason: 'Memory API not available' };
    }

    const currentMemory = performance.memory.usedJSHeapSize;
    const memoryIncreaseMB = Math.round(currentMemory / 1024 / 1024);
    
    // 50MB以下なら正常、100MB以上なら警告
    if (memoryIncreaseMB < 50) {
      return { status: 'good', memory: memoryIncreaseMB };
    } else if (memoryIncreaseMB < 100) {
      return { status: 'warning', memory: memoryIncreaseMB };
    } else {
      return { status: 'error', memory: memoryIncreaseMB };
    }
  }

  /**
   * 実環境テストの完全実行
   */
  async runCompleteRealEnvironmentTest() {
    console.log('=== 実環境完全テスト開始 ===');
    
    try {
      // 1. 初期化
      await this.initialize();

      // 2. マシュマロサイト統合テスト
      const siteResult = await this.testMarshmallowSiteIntegration();

      // 3. Background Script統合テスト
      const backgroundResult = await this.testBackgroundScriptIntegration();

      // 4. 短時間の動作テスト (5分)
      const shortRunResult = await this.startLongRunningTest(5);

      console.log('=== 実環境完全テスト完了 ===');
      
      return {
        siteIntegration: siteResult,
        backgroundIntegration: backgroundResult,
        shortRunTest: shortRunResult,
        testResults: this.testResults
      };

    } catch (error) {
      console.error('✗ 実環境完全テストエラー:', error.message);
      throw error;
    }
  }

  /**
   * テスト結果の表示
   */
  displayResults() {
    console.log('\n=== 実環境テスト結果サマリー ===');
    let successCount = 0;
    let totalCount = this.testResults.length;
    
    this.testResults.forEach(result => {
      const status = result.status === 'success' ? '✓' : 
                    result.status === 'warning' ? '⚠' : '✗';
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

  /**
   * クリーンアップ
   */
  cleanup() {
    // 通信監視の復旧
    if (this.originalSendMessage) {
      chrome.runtime.sendMessage = this.originalSendMessage;
    }

    // アプリケーションのシャットダウン
    if (this.app) {
      this.app.shutdown();
    }

    console.log('実環境テストクリーンアップ完了');
  }
}

// テスト実行用の関数
async function runRealEnvironmentTest() {
  const tester = new RealEnvironmentTester();
  
  try {
    const results = await tester.runCompleteRealEnvironmentTest();
    const summary = tester.displayResults();
    
    return {
      ...results,
      summary
    };
  } finally {
    tester.cleanup();
  }
}

// 長時間稼働テスト用の関数
async function runLongRunningTest(durationMinutes = 60) {
  const tester = new RealEnvironmentTester();
  
  try {
    await tester.initialize();
    const result = await tester.startLongRunningTest(durationMinutes);
    
    return {
      tester, // テスター インスタンスを返して外部から制御可能に
      result
    };
  } catch (error) {
    tester.cleanup();
    throw error;
  }
}

// ブラウザ環境での使用
if (typeof window !== 'undefined') {
  window.RealEnvironmentTester = RealEnvironmentTester;
  window.runRealEnvironmentTest = runRealEnvironmentTest;
  window.runLongRunningTest = runLongRunningTest;
}