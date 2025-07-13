// エラーシナリオテスト用モジュール
// test_error_scenarios.js

/**
 * エラーシナリオのテスト用クラス
 */
class ErrorScenarioTester {
  constructor() {
    this.testResults = [];
    this.originalChrome = null;
  }

  /**
   * Chrome API の保存と復旧
   */
  backupChrome() {
    this.originalChrome = window.chrome ? { ...window.chrome } : null;
  }

  restoreChrome() {
    if (this.originalChrome) {
      window.chrome = this.originalChrome;
    } else {
      delete window.chrome;
    }
  }

  /**
   * Extension Context無効化シナリオ1: chrome.runtime.id が undefined
   */
  async testExtensionContextInvalidation_RuntimeId() {
    console.log('=== Extension Context無効化テスト (runtime.id) 開始 ===');
    
    try {
      const contextManager = new ExtensionContextManager();
      
      // 正常状態の確認
      let isAlive = contextManager.isAlive();
      console.log('初期状態 isAlive():', isAlive);
      
      // chrome.runtime.id を無効化
      if (window.chrome && window.chrome.runtime) {
        delete window.chrome.runtime.id;
      }
      
      // 無効化後の確認
      isAlive = contextManager.isAlive();
      console.log('runtime.id削除後 isAlive():', isAlive);
      
      if (!isAlive) {
        console.log('✓ Extension Context無効化を正しく検出');
        this.testResults.push({
          test: 'Extension Context無効化 (runtime.id)',
          status: 'success',
          details: 'Correctly detected context invalidation'
        });
      } else {
        console.log('✗ Extension Context無効化を検出できず');
        this.testResults.push({
          test: 'Extension Context無効化 (runtime.id)',
          status: 'error',
          details: 'Failed to detect context invalidation'
        });
      }
      
    } catch (error) {
      console.error('✗ Extension Context無効化テストエラー:', error.message);
      this.testResults.push({
        test: 'Extension Context無効化 (runtime.id)',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * Extension Context無効化シナリオ2: chrome 全体が undefined
   */
  async testExtensionContextInvalidation_ChromeUndefined() {
    console.log('=== Extension Context無効化テスト (chrome undefined) 開始 ===');
    
    try {
      const contextManager = new ExtensionContextManager();
      
      // chrome を完全に削除
      delete window.chrome;
      
      // 無効化後の確認
      const isAlive = contextManager.isAlive();
      console.log('chrome削除後 isAlive():', isAlive);
      
      if (!isAlive) {
        console.log('✓ Chrome削除を正しく検出');
        this.testResults.push({
          test: 'Extension Context無効化 (chrome undefined)',
          status: 'success',
          details: 'Correctly detected chrome deletion'
        });
      } else {
        console.log('✗ Chrome削除を検出できず');
        this.testResults.push({
          test: 'Extension Context無効化 (chrome undefined)',
          status: 'error',
          details: 'Failed to detect chrome deletion'
        });
      }
      
    } catch (error) {
      console.error('✗ Chrome削除テストエラー:', error.message);
      this.testResults.push({
        test: 'Extension Context無効化 (chrome undefined)',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * シャットダウンプロセステスト
   */
  async testGracefulShutdown() {
    console.log('=== グレースフルシャットダウンテスト開始 ===');
    
    try {
      // Chrome環境の復旧
      this.restoreChrome();
      if (!window.chrome) {
        window.chrome = {
          runtime: { id: 'test-extension-id', sendMessage: () => {} },
          storage: { local: { get: () => {}, set: () => {} } }
        };
      }
      
      const app = new ContentScriptApplication();
      await app.initialize();
      app.start();
      
      console.log('アプリケーション開始完了');
      console.log('初期化状態:', app.isInitialized);
      console.log('実行状態:', app.isRunning);
      
      // シャットダウン実行
      const shutdownObserved = [];
      const originalConsoleLog = console.log;
      console.log = function(...args) {
        const message = args.join(' ');
        if (message.includes('shutdown') || message.includes('stopped')) {
          shutdownObserved.push(message);
        }
        originalConsoleLog.apply(console, args);
      };
      
      // Context Manager からシャットダウンを開始
      app.contextManager.initiateShutdown();
      
      // 少し待ってから状態確認
      setTimeout(() => {
        console.log = originalConsoleLog;
        console.log('シャットダウン完了後の状態:');
        console.log('初期化状態:', app.isInitialized);
        console.log('実行状態:', app.isRunning);
        console.log('観測されたシャットダウンメッセージ:', shutdownObserved.length);
        
        if (shutdownObserved.length > 0 && !app.isRunning) {
          console.log('✓ グレースフルシャットダウン成功');
          this.testResults.push({
            test: 'グレースフルシャットダウン',
            status: 'success',
            details: `${shutdownObserved.length} components shut down correctly`
          });
        } else {
          console.log('✗ グレースフルシャットダウン失敗');
          this.testResults.push({
            test: 'グレースフルシャットダウン',
            status: 'error',
            details: 'Shutdown process did not complete properly'
          });
        }
      }, 1000);
      
    } catch (error) {
      console.error('✗ グレースフルシャットダウンテストエラー:', error.message);
      this.testResults.push({
        test: 'グレースフルシャットダウン',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * DOM要素不在エラーテスト
   */
  async testMissingDOMElements() {
    console.log('=== DOM要素不在エラーテスト開始 ===');
    
    try {
      const pageInteractor = new MarshmallowPageInteractor();
      
      // 既存のマシュマロ要素を一時的に削除
      const inboxElement = document.getElementById('inbox-count');
      const messagesElement = document.getElementById('messages');
      
      if (inboxElement) inboxElement.remove();
      if (messagesElement) messagesElement.remove();
      
      // ログイン状態チェック（要素なし）
      const loginStatus = pageInteractor.getUserLoginStatus();
      console.log('要素なし時のログイン状態:', loginStatus);
      
      // メッセージ抽出（要素なし）
      const messages = pageInteractor.extractNewMessages();
      console.log('要素なし時のメッセージ数:', messages.length);
      
      if (loginStatus === false && messages.length === 0) {
        console.log('✓ DOM要素不在時の適切な処理');
        this.testResults.push({
          test: 'DOM要素不在エラー',
          status: 'success',
          details: 'Correctly handled missing DOM elements'
        });
      } else {
        console.log('✗ DOM要素不在時の処理に問題');
        this.testResults.push({
          test: 'DOM要素不在エラー',
          status: 'error',
          details: 'Unexpected behavior with missing DOM elements'
        });
      }
      
    } catch (error) {
      console.error('✗ DOM要素不在エラーテストエラー:', error.message);
      this.testResults.push({
        test: 'DOM要素不在エラー',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * ネットワークエラーシミュレーション
   */
  async testNetworkErrors() {
    console.log('=== ネットワークエラーテスト開始 ===');
    
    try {
      // Chrome環境の復旧
      this.restoreChrome();
      if (!window.chrome) {
        window.chrome = {
          runtime: {
            id: 'test-extension-id',
            lastError: null,
            sendMessage: (message, callback) => {
              // ネットワークエラーをシミュレート
              setTimeout(() => {
                window.chrome.runtime.lastError = {
                  message: 'Network error: Could not establish connection'
                };
                callback(null);
              }, 100);
            }
          }
        };
      }
      
      const contextManager = new ExtensionContextManager();
      const communicator = new BackgroundCommunicator(contextManager);
      
      try {
        await communicator.sendMessageSafely({
          action: 'test-network-error',
          data: 'This should fail with network error'
        });
        
        console.log('✗ ネットワークエラーが発生しなかった');
        this.testResults.push({
          test: 'ネットワークエラー',
          status: 'error',
          details: 'Expected network error did not occur'
        });
        
      } catch (error) {
        console.log('✓ ネットワークエラーを適切に処理:', error.message);
        this.testResults.push({
          test: 'ネットワークエラー',
          status: 'success',
          details: `Correctly handled network error: ${error.message}`
        });
      }
      
    } catch (error) {
      console.error('✗ ネットワークエラーテストエラー:', error.message);
      this.testResults.push({
        test: 'ネットワークエラー',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * メモリリークテスト
   */
  async testMemoryLeaks() {
    console.log('=== メモリリークテスト開始 ===');
    
    try {
      // Chrome環境の復旧
      this.restoreChrome();
      if (!window.chrome) {
        window.chrome = {
          runtime: { id: 'test-extension-id', sendMessage: () => {} },
          storage: { local: { get: () => {}, set: () => {} } }
        };
      }
      
      const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      console.log('初期メモリ使用量:', initialMemory);
      
      // 複数回のアプリケーション作成と破棄
      for (let i = 0; i < 5; i++) {
        const app = new ContentScriptApplication();
        await app.initialize();
        app.start();
        
        // DOM要素の追加と削除をシミュレート
        const mockElement = document.createElement('div');
        mockElement.id = `test-element-${i}`;
        document.body.appendChild(mockElement);
        
        app.shutdown();
        mockElement.remove();
      }
      
      // ガベージコレクションを強制実行（可能な場合）
      if (window.gc) {
        window.gc();
      }
      
      const finalMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      console.log('最終メモリ使用量:', finalMemory);
      
      const memoryIncrease = finalMemory - initialMemory;
      console.log('メモリ増加量:', memoryIncrease);
      
      // 1MB以下の増加は許容範囲とする
      if (memoryIncrease < 1048576) {
        console.log('✓ メモリリーク検出されず');
        this.testResults.push({
          test: 'メモリリーク',
          status: 'success',
          details: `Memory increase: ${Math.round(memoryIncrease/1024)}KB (acceptable)`
        });
      } else {
        console.log('✗ 潜在的なメモリリーク検出');
        this.testResults.push({
          test: 'メモリリーク',
          status: 'error',
          details: `Memory increase: ${Math.round(memoryIncrease/1024)}KB (excessive)`
        });
      }
      
    } catch (error) {
      console.error('✗ メモリリークテストエラー:', error.message);
      this.testResults.push({
        test: 'メモリリーク',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * 全エラーシナリオテスト実行
   */
  async runAllErrorScenarioTests() {
    console.log('=== エラーシナリオテスト開始 ===');
    
    this.backupChrome();
    this.testResults = [];
    
    await this.testExtensionContextInvalidation_RuntimeId();
    await this.testExtensionContextInvalidation_ChromeUndefined();
    await this.testGracefulShutdown();
    await this.testMissingDOMElements();
    await this.testNetworkErrors();
    await this.testMemoryLeaks();
    
    this.restoreChrome();
    
    console.log('=== エラーシナリオテスト完了 ===');
    return this.testResults;
  }

  /**
   * テスト結果の表示
   */
  displayResults() {
    console.log('\n=== エラーシナリオテスト結果サマリー ===');
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
async function runErrorScenarioTests() {
  const tester = new ErrorScenarioTester();
  const results = await tester.runAllErrorScenarioTests();
  const summary = tester.displayResults();
  
  return {
    results,
    summary
  };
}

// ブラウザ環境での使用
if (typeof window !== 'undefined') {
  window.ErrorScenarioTester = ErrorScenarioTester;
  window.runErrorScenarioTests = runErrorScenarioTests;
}