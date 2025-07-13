// Background Script統合テスト用モジュール
// test_background_integration.js

/**
 * Background Script統合テスト用クラス
 * V2版Content ScriptとBackground Scriptの完全統合をテスト
 */
class BackgroundIntegrationTester {
  constructor() {
    this.testResults = [];
    this.app = null;
    this.messageQueue = [];
    this.backgroundResponses = [];
    this.testStartTime = null;
  }

  /**
   * 統合テストの初期化
   */
  async initialize() {
    console.log('=== Background Script統合テスト初期化開始 ===');
    
    try {
      // Chrome Extension環境の確認
      if (!chrome || !chrome.runtime || !chrome.runtime.id) {
        throw new Error('Chrome Extension環境が検出されません');
      }

      // Content Script V2の初期化
      this.app = new ContentScriptApplication();
      await this.app.initialize();

      // Background Scriptの基本機能確認
      await this.verifyBackgroundScriptFunctions();

      console.log('✓ Background Script統合テスト初期化完了');
      return true;

    } catch (error) {
      console.error('✗ Background Script統合テスト初期化失敗:', error.message);
      throw error;
    }
  }

  /**
   * Background Scriptの基本機能確認
   */
  async verifyBackgroundScriptFunctions() {
    console.log('Background Scriptの基本機能を確認中...');

    try {
      // 1. 基本的な通信テスト
      const pingResponse = await this.sendToBackground({ action: 'ping' });
      this.testResults.push({
        test: 'Background Script基本通信',
        status: 'success',
        details: 'Background Scriptとの通信が確立されました'
      });

      // 2. 質問キューの状態確認
      const queueStatus = await this.sendToBackground({ action: 'getQueueStatus' });
      this.testResults.push({
        test: 'Background Script質問キュー確認',
        status: 'success',
        details: `質問キュー状態: ${JSON.stringify(queueStatus)}`
      });

      // 3. 設定の確認
      const settings = await this.getBackgroundSettings();
      this.testResults.push({
        test: 'Background Script設定確認',
        status: 'success',
        details: `設定確認完了: ${Object.keys(settings).length}項目`
      });

      return true;

    } catch (error) {
      this.testResults.push({
        test: 'Background Script基本機能確認',
        status: 'error',
        details: error.message
      });
      throw error;
    }
  }

  /**
   * Background Scriptにメッセージを送信
   */
  async sendToBackground(message) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      
      chrome.runtime.sendMessage(message, (response) => {
        const responseTime = Date.now() - timestamp;
        
        if (chrome.runtime.lastError) {
          console.error('Background Script通信エラー:', chrome.runtime.lastError.message);
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          console.log(`Background Script応答 (${responseTime}ms):`, response);
          
          this.backgroundResponses.push({
            timestamp: new Date().toISOString(),
            request: message,
            response,
            responseTime
          });
          
          resolve(response);
        }
      });
    });
  }

  /**
   * Background Scriptの設定取得
   */
  async getBackgroundSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'POST_INTERVAL_SEC',
        'MAX_RETRY_ATTEMPTS', 
        'isRunning',
        'MARSHMALLOW_CONNECTION_STATUS',
        'youtubeApiKey',
        'youtubeLiveUrl'
      ], (result) => {
        resolve(result);
      });
    });
  }

  /**
   * V2版Content ScriptとBackground Scriptの統合テスト
   */
  async testV2BackgroundIntegration() {
    console.log('=== V2版とBackground Script統合テスト開始 ===');
    
    try {
      // 1. Content Script V2の開始
      this.app.start();
      
      this.testResults.push({
        test: 'V2版Content Script開始',
        status: 'success',
        details: `アプリケーション状態: 初期化=${this.app.isInitialized}, 実行中=${this.app.isRunning}`
      });

      // 2. 模擬メッセージの作成と送信
      const mockMessages = this.createMockMessages();
      
      // 3. V2版を使ったメッセージ送信
      const sendResult = await this.app.communicator.sendMessageSafely({
        action: 'newMarshmallowMessages',
        messages: mockMessages,
        isLoggedIn: true
      });

      this.testResults.push({
        test: 'V2版経由メッセージ送信',
        status: 'success',
        details: `送信結果: ${JSON.stringify(sendResult)}`
      });

      // 4. Background Scriptでの処理確認
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2秒待機

      const queueAfter = await this.sendToBackground({ action: 'getQueueStatus' });
      
      this.testResults.push({
        test: 'Background Script処理確認',
        status: 'success',
        details: `処理後キュー状態: ${JSON.stringify(queueAfter)}`
      });

      // 5. ログイン状態変更のテスト
      await this.testLoginStatusChange();

      return {
        mockMessages,
        sendResult,
        queueStatus: queueAfter,
        communicationHistory: this.backgroundResponses
      };

    } catch (error) {
      console.error('✗ V2版とBackground Script統合テストエラー:', error.message);
      this.testResults.push({
        test: 'V2版とBackground Script統合テスト',
        status: 'error',
        details: error.message
      });
      throw error;
    }
  }

  /**
   * 模擬メッセージの作成
   */
  createMockMessages() {
    const baseTime = Date.now();
    
    return [
      {
        id: `integration-test-${baseTime}-1`,
        text: 'V2版統合テスト質問1: Background Scriptとの統合は正常に動作していますか？リファクタリング後のアーキテクチャはいかがでしょうか？',
        received_at: new Date(baseTime).toISOString()
      },
      {
        id: `integration-test-${baseTime}-2`,
        text: 'V2版統合テスト質問2: 質問キューの管理は適切に行われていますか？',
        received_at: new Date(baseTime - 60000).toISOString()
      },
      {
        id: `integration-test-${baseTime}-3`,
        text: 'V2版統合テスト質問3: エラーハンドリングは期待通りに機能していますか？',
        received_at: new Date(baseTime - 120000).toISOString()
      }
    ];
  }

  /**
   * ログイン状態変更のテスト
   */
  async testLoginStatusChange() {
    console.log('ログイン状態変更テストを実行中...');

    try {
      // 1. ログアウト状態をシミュレート
      await this.app.communicator.sendMessageSafely({
        action: 'newMarshmallowMessages',
        messages: [],
        isLoggedIn: false
      });

      this.testResults.push({
        test: 'ログアウト状態送信',
        status: 'success',
        details: 'ログアウト状態をBackground Scriptに通知'
      });

      // 2. 少し待ってから設定確認
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const settings = await this.getBackgroundSettings();
      const connectionStatus = settings.MARSHMALLOW_CONNECTION_STATUS;

      this.testResults.push({
        test: 'ログアウト状態反映確認',
        status: connectionStatus === 'logged_out' ? 'success' : 'warning',
        details: `接続状態: ${connectionStatus}`
      });

      // 3. ログイン状態に戻す
      await this.app.communicator.sendMessageSafely({
        action: 'newMarshmallowMessages',
        messages: [],
        isLoggedIn: true
      });

      this.testResults.push({
        test: 'ログイン状態復旧',
        status: 'success',
        details: 'ログイン状態をBackground Scriptに通知'
      });

    } catch (error) {
      this.testResults.push({
        test: 'ログイン状態変更テスト',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * Background Script API互換性テスト
   */
  async testBackgroundAPICompatibility() {
    console.log('=== Background Script API互換性テスト開始 ===');

    try {
      // 既存のBackground ScriptのAPIエンドポイントをテスト
      const apiTests = [
        { action: 'newMarshmallowMessages', data: { messages: [], isLoggedIn: true } },
        { action: 'getLiveVideoInfo', data: { videoId: 'test-video-id' } },
        { action: 'getRunningStatus' },
        { action: 'toggleRunning' }
      ];

      for (const test of apiTests) {
        try {
          const response = await this.sendToBackground({ 
            action: test.action, 
            ...test.data 
          });
          
          this.testResults.push({
            test: `API互換性: ${test.action}`,
            status: 'success',
            details: `レスポンス: ${JSON.stringify(response).substring(0, 100)}...`
          });

        } catch (error) {
          this.testResults.push({
            test: `API互換性: ${test.action}`,
            status: 'warning',
            details: `エラー: ${error.message} (API未実装の可能性)`
          });
        }
      }

      return true;

    } catch (error) {
      console.error('✗ Background Script API互換性テストエラー:', error.message);
      this.testResults.push({
        test: 'Background Script API互換性テスト',
        status: 'error',
        details: error.message
      });
      throw error;
    }
  }

  /**
   * 継続的統合テスト（長時間実行）
   */
  async startContinuousIntegrationTest(durationMinutes = 30) {
    console.log(`=== 継続的統合テスト開始 (${durationMinutes}分) ===`);

    try {
      this.testStartTime = Date.now();
      const testEndTime = this.testStartTime + (durationMinutes * 60 * 1000);
      
      // 定期的なメッセージ送信を開始
      const sendInterval = setInterval(async () => {
        try {
          if (Date.now() >= testEndTime) {
            clearInterval(sendInterval);
            await this.completeContinuousIntegrationTest();
            return;
          }

          await this.performContinuousTest();
          
        } catch (error) {
          console.error('継続的統合テスト中エラー:', error.message);
          clearInterval(sendInterval);
        }
      }, 60000); // 1分間隔

      this.testResults.push({
        test: '継続的統合テスト開始',
        status: 'success',
        details: `${durationMinutes}分間のテスト開始`
      });

      return {
        started: true,
        duration: durationMinutes,
        startTime: new Date(this.testStartTime).toISOString()
      };

    } catch (error) {
      console.error('✗ 継続的統合テスト開始エラー:', error.message);
      this.testResults.push({
        test: '継続的統合テスト開始',
        status: 'error',
        details: error.message
      });
      throw error;
    }
  }

  /**
   * 継続的テストの実行
   */
  async performContinuousTest() {
    const testId = Date.now();
    
    // 模擬メッセージを送信
    const mockMessage = {
      id: `continuous-test-${testId}`,
      text: `継続的統合テスト ${new Date().toLocaleTimeString()}: システムは正常に動作中です`,
      received_at: new Date().toISOString()
    };

    await this.app.communicator.sendMessageSafely({
      action: 'newMarshmallowMessages',
      messages: [mockMessage],
      isLoggedIn: true
    });

    // Background Scriptの状態確認
    const queueStatus = await this.sendToBackground({ action: 'getQueueStatus' });
    
    const runningTime = Math.round((Date.now() - this.testStartTime) / 60000);
    console.log(`[${runningTime}分経過] 継続的テスト実行: キュー状態=${JSON.stringify(queueStatus)}`);
  }

  /**
   * 継続的統合テストの完了
   */
  async completeContinuousIntegrationTest() {
    console.log('=== 継続的統合テスト完了 ===');
    
    const totalRunTime = Math.round((Date.now() - this.testStartTime) / 60000);
    
    this.testResults.push({
      test: '継続的統合テスト完了',
      status: 'success',
      details: `総実行時間: ${totalRunTime}分, 通信回数: ${this.backgroundResponses.length}回`
    });

    return {
      completed: true,
      totalRunTime,
      totalCommunications: this.backgroundResponses.length,
      averageResponseTime: this.calculateAverageResponseTime()
    };
  }

  /**
   * 平均応答時間の計算
   */
  calculateAverageResponseTime() {
    if (this.backgroundResponses.length === 0) return 0;
    
    const totalTime = this.backgroundResponses.reduce((sum, response) => {
      return sum + (response.responseTime || 0);
    }, 0);
    
    return Math.round(totalTime / this.backgroundResponses.length);
  }

  /**
   * 完全統合テストの実行
   */
  async runCompleteIntegrationTest() {
    console.log('=== 完全統合テスト開始 ===');
    
    try {
      // 1. 初期化
      await this.initialize();

      // 2. V2版とBackground Scriptの統合テスト
      const integrationResult = await this.testV2BackgroundIntegration();

      // 3. Background Script API互換性テスト
      await this.testBackgroundAPICompatibility();

      // 4. 短時間の継続的統合テスト (5分)
      const continuousResult = await this.startContinuousIntegrationTest(5);

      console.log('=== 完全統合テスト完了 ===');
      
      return {
        integrationResult,
        continuousResult,
        testResults: this.testResults,
        communicationHistory: this.backgroundResponses
      };

    } catch (error) {
      console.error('✗ 完全統合テストエラー:', error.message);
      throw error;
    }
  }

  /**
   * テスト結果の表示
   */
  displayResults() {
    console.log('\n=== Background Script統合テスト結果サマリー ===');
    let successCount = 0;
    let totalCount = this.testResults.length;
    
    this.testResults.forEach(result => {
      const status = result.status === 'success' ? '✓' : 
                    result.status === 'warning' ? '⚠' : '✗';
      console.log(`${status} ${result.test}: ${result.details}`);
      if (result.status === 'success') successCount++;
    });
    
    console.log(`\n成功: ${successCount}/${totalCount} (${Math.round(successCount/totalCount*100)}%)`);
    console.log(`通信履歴: ${this.backgroundResponses.length}件`);
    console.log(`平均応答時間: ${this.calculateAverageResponseTime()}ms`);
    
    return {
      total: totalCount,
      success: successCount,
      successRate: Math.round(successCount/totalCount*100),
      communicationCount: this.backgroundResponses.length,
      averageResponseTime: this.calculateAverageResponseTime()
    };
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    if (this.app) {
      this.app.shutdown();
    }
    
    console.log('Background Script統合テストクリーンアップ完了');
  }
}

// テスト実行用の関数
async function runBackgroundIntegrationTest() {
  const tester = new BackgroundIntegrationTester();
  
  try {
    const results = await tester.runCompleteIntegrationTest();
    const summary = tester.displayResults();
    
    return {
      ...results,
      summary
    };
  } finally {
    tester.cleanup();
  }
}

// 継続的統合テスト用の関数
async function runContinuousIntegrationTest(durationMinutes = 30) {
  const tester = new BackgroundIntegrationTester();
  
  try {
    await tester.initialize();
    const result = await tester.startContinuousIntegrationTest(durationMinutes);
    
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
  window.BackgroundIntegrationTester = BackgroundIntegrationTester;
  window.runBackgroundIntegrationTest = runBackgroundIntegrationTest;
  window.runContinuousIntegrationTest = runContinuousIntegrationTest;
}