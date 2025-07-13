// パフォーマンステスト用モジュール
// test_performance.js

/**
 * パフォーマンステスト用クラス
 */
class PerformanceTester {
  constructor() {
    this.testResults = [];
    this.benchmarks = {
      initialization: [],
      messageExtraction: [],
      domWatching: [],
      memoryUsage: []
    };
  }

  /**
   * パフォーマンス測定ユーティリティ
   */
  measureTime(fn, label) {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    const duration = end - start;
    
    console.log(`${label}: ${duration.toFixed(2)}ms`);
    return { result, duration };
  }

  async measureTimeAsync(fn, label) {
    const start = performance.now();
    const result = await fn();
    const end = performance.now();
    const duration = end - start;
    
    console.log(`${label}: ${duration.toFixed(2)}ms`);
    return { result, duration };
  }

  /**
   * メモリ使用量の測定
   */
  measureMemory(label) {
    if (performance.memory) {
      const memory = {
        used: performance.memory.usedJSHeapSize,
        total: performance.memory.totalJSHeapSize,
        limit: performance.memory.jsHeapSizeLimit
      };
      
      console.log(`${label} - Memory:`, {
        used: `${Math.round(memory.used / 1024 / 1024)}MB`,
        total: `${Math.round(memory.total / 1024 / 1024)}MB`,
        limit: `${Math.round(memory.limit / 1024 / 1024)}MB`
      });
      
      return memory;
    } else {
      console.log(`${label} - Memory: measurement not available`);
      return null;
    }
  }

  /**
   * Chrome環境のセットアップ
   */
  setupMockChrome() {
    if (!window.chrome) {
      window.chrome = {
        runtime: {
          id: 'performance-test-extension-id',
          lastError: null,
          sendMessage: (message, callback) => {
            // 模擬レスポンス時間
            setTimeout(() => {
              callback({
                success: true,
                data: `Mock response for ${message.action}`
              });
            }, Math.random() * 50); // 0-50msのランダムレスポンス時間
          }
        },
        storage: {
          local: {
            get: (keys, callback) => {
              setTimeout(() => {
                callback({
                  pollingInterval: 30000,
                  youtubeApiKey: 'mock-api-key'
                });
              }, Math.random() * 20); // 0-20msのランダムレスポンス時間
            },
            set: (data, callback) => {
              setTimeout(callback, Math.random() * 10);
            }
          },
          onChanged: {
            addListener: () => {}
          }
        }
      };
    }
  }

  /**
   * 大量の模擬DOM要素を作成
   */
  createMockMarshmallowDOM(messageCount = 100) {
    // 既存の要素をクリーンアップ
    const existingInbox = document.getElementById('inbox-count');
    const existingMessages = document.getElementById('messages');
    if (existingInbox) existingInbox.remove();
    if (existingMessages) existingMessages.remove();

    // 受信箱要素を作成
    const inboxCount = document.createElement('div');
    inboxCount.id = 'inbox-count';
    inboxCount.textContent = `受信箱 (${messageCount})`;
    document.body.appendChild(inboxCount);

    // メッセージリストを作成
    const messagesList = document.createElement('ul');
    messagesList.id = 'messages';
    
    for (let i = 0; i < messageCount; i++) {
      const messageElement = document.createElement('li');
      messageElement.className = 'message';
      messageElement.id = `message_performance-test-${i}`;
      
      const messageContent = document.createElement('div');
      messageContent.setAttribute('data-outview-target', 'searchable');
      
      const messageLink = document.createElement('a');
      messageLink.setAttribute('data-obscene-word-target', 'content');
      messageLink.textContent = `パフォーマンステスト用質問 ${i + 1}: これは${i + 1}番目のテスト質問です。長いテキストでのパフォーマンスを確認します。`;
      
      const timeElement = document.createElement('time');
      const testTime = new Date(Date.now() - (i * 60000)); // 1分間隔で古くなる
      timeElement.setAttribute('datetime', testTime.toISOString());
      timeElement.textContent = testTime.toLocaleString();
      
      messageContent.appendChild(messageLink);
      messageElement.appendChild(messageContent);
      messageElement.appendChild(timeElement);
      messagesList.appendChild(messageElement);
    }
    
    document.body.appendChild(messagesList);
    console.log(`Created ${messageCount} mock messages for performance testing`);
  }

  /**
   * アプリケーション初期化パフォーマンステスト
   */
  async testInitializationPerformance() {
    console.log('=== 初期化パフォーマンステスト開始 ===');
    
    try {
      this.setupMockChrome();
      
      const iterations = 10;
      const initTimes = [];
      
      for (let i = 0; i < iterations; i++) {
        const { duration } = await this.measureTimeAsync(async () => {
          const app = new ContentScriptApplication();
          await app.initialize();
          app.shutdown(); // クリーンアップ
          return app;
        }, `初期化テスト ${i + 1}`);
        
        initTimes.push(duration);
      }
      
      const avgTime = initTimes.reduce((a, b) => a + b, 0) / initTimes.length;
      const minTime = Math.min(...initTimes);
      const maxTime = Math.max(...initTimes);
      
      this.benchmarks.initialization = {
        average: avgTime,
        min: minTime,
        max: maxTime,
        iterations: iterations
      };
      
      console.log(`初期化パフォーマンス - 平均: ${avgTime.toFixed(2)}ms, 最小: ${minTime.toFixed(2)}ms, 最大: ${maxTime.toFixed(2)}ms`);
      
      // 100ms以下を良好とする
      if (avgTime < 100) {
        this.testResults.push({
          test: '初期化パフォーマンス',
          status: 'success',
          details: `Average: ${avgTime.toFixed(2)}ms (excellent)`
        });
      } else if (avgTime < 200) {
        this.testResults.push({
          test: '初期化パフォーマンス',
          status: 'success',
          details: `Average: ${avgTime.toFixed(2)}ms (good)`
        });
      } else {
        this.testResults.push({
          test: '初期化パフォーマンス',
          status: 'error',
          details: `Average: ${avgTime.toFixed(2)}ms (slow)`
        });
      }
      
    } catch (error) {
      console.error('初期化パフォーマンステストエラー:', error.message);
      this.testResults.push({
        test: '初期化パフォーマンス',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * メッセージ抽出パフォーマンステスト
   */
  async testMessageExtractionPerformance() {
    console.log('=== メッセージ抽出パフォーマンステスト開始 ===');
    
    try {
      const messageCounts = [10, 50, 100, 200];
      const extractionResults = [];
      
      for (const count of messageCounts) {
        this.createMockMarshmallowDOM(count);
        const pageInteractor = new MarshmallowPageInteractor();
        
        const iterations = 5;
        const extractionTimes = [];
        
        for (let i = 0; i < iterations; i++) {
          const { result, duration } = this.measureTime(() => {
            return pageInteractor.extractNewMessages();
          }, `メッセージ抽出 (${count}件) - 試行 ${i + 1}`);
          
          extractionTimes.push(duration);
          
          // 抽出結果の検証
          if (result.length !== count) {
            console.warn(`期待値と異なる結果: 期待=${count}, 実際=${result.length}`);
          }
        }
        
        const avgTime = extractionTimes.reduce((a, b) => a + b, 0) / extractionTimes.length;
        const throughput = count / (avgTime / 1000); // messages per second
        
        extractionResults.push({
          messageCount: count,
          averageTime: avgTime,
          throughput: throughput
        });
        
        console.log(`${count}件メッセージ抽出 - 平均: ${avgTime.toFixed(2)}ms, スループット: ${throughput.toFixed(0)} msg/sec`);
      }
      
      this.benchmarks.messageExtraction = extractionResults;
      
      // 100件のメッセージを50ms以下で処理できれば良好
      const result100 = extractionResults.find(r => r.messageCount === 100);
      if (result100 && result100.averageTime < 50) {
        this.testResults.push({
          test: 'メッセージ抽出パフォーマンス',
          status: 'success',
          details: `100 messages in ${result100.averageTime.toFixed(2)}ms (excellent)`
        });
      } else if (result100 && result100.averageTime < 100) {
        this.testResults.push({
          test: 'メッセージ抽出パフォーマンス',
          status: 'success',
          details: `100 messages in ${result100.averageTime.toFixed(2)}ms (good)`
        });
      } else {
        this.testResults.push({
          test: 'メッセージ抽出パフォーマンス',
          status: 'error',
          details: `100 messages in ${result100 ? result100.averageTime.toFixed(2) : 'N/A'}ms (slow)`
        });
      }
      
    } catch (error) {
      console.error('メッセージ抽出パフォーマンステストエラー:', error.message);
      this.testResults.push({
        test: 'メッセージ抽出パフォーマンス',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * DOM監視パフォーマンステスト
   */
  async testDOMWatchingPerformance() {
    console.log('=== DOM監視パフォーマンステスト開始 ===');
    
    try {
      this.createMockMarshmallowDOM(50);
      
      let changeCount = 0;
      const changeDetectionTimes = [];
      
      const domWatcher = new DOMWatcher((mutations) => {
        const detectionTime = performance.now();
        changeCount++;
        changeDetectionTimes.push(detectionTime);
        console.log(`DOM変更検出 #${changeCount}: ${mutations.length}件の変更`);
      });
      
      domWatcher.startWatching();
      
      // DOM変更を複数回実行
      const changeStartTime = performance.now();
      const messagesList = document.getElementById('messages');
      
      for (let i = 0; i < 20; i++) {
        const newMessage = document.createElement('li');
        newMessage.className = 'message';
        newMessage.id = `message_perf-change-${i}`;
        newMessage.innerHTML = `
          <div data-outview-target="searchable">
            <a data-obscene-word-target="content">パフォーマンステスト変更 ${i + 1}</a>
          </div>
          <time datetime="${new Date().toISOString()}">${new Date().toLocaleString()}</time>
        `;
        messagesList.appendChild(newMessage);
        
        // 各変更の間に少し待機
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // 変更検出の完了を待つ
      await new Promise(resolve => setTimeout(resolve, 500));
      
      domWatcher.stopWatching();
      
      // パフォーマンス解析
      if (changeDetectionTimes.length > 0) {
        const responseTimes = changeDetectionTimes.map((time, index) => {
          if (index === 0) return 0;
          return time - changeDetectionTimes[index - 1];
        }).slice(1); // 最初の要素を除外
        
        const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        
        this.benchmarks.domWatching = {
          changesDetected: changeCount,
          averageResponseTime: avgResponseTime,
          totalTime: changeDetectionTimes[changeDetectionTimes.length - 1] - changeStartTime
        };
        
        console.log(`DOM監視パフォーマンス - 検出数: ${changeCount}, 平均応答時間: ${avgResponseTime.toFixed(2)}ms`);
        
        if (avgResponseTime < 50) {
          this.testResults.push({
            test: 'DOM監視パフォーマンス',
            status: 'success',
            details: `Average response: ${avgResponseTime.toFixed(2)}ms (excellent)`
          });
        } else if (avgResponseTime < 100) {
          this.testResults.push({
            test: 'DOM監視パフォーマンス',
            status: 'success',
            details: `Average response: ${avgResponseTime.toFixed(2)}ms (good)`
          });
        } else {
          this.testResults.push({
            test: 'DOM監視パフォーマンス',
            status: 'error',
            details: `Average response: ${avgResponseTime.toFixed(2)}ms (slow)`
          });
        }
      } else {
        this.testResults.push({
          test: 'DOM監視パフォーマンス',
          status: 'error',
          details: 'No DOM changes detected'
        });
      }
      
    } catch (error) {
      console.error('DOM監視パフォーマンステストエラー:', error.message);
      this.testResults.push({
        test: 'DOM監視パフォーマンス',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * メモリ使用量テスト
   */
  async testMemoryUsage() {
    console.log('=== メモリ使用量テスト開始 ===');
    
    try {
      const initialMemory = this.measureMemory('テスト開始');
      
      if (!initialMemory) {
        this.testResults.push({
          test: 'メモリ使用量',
          status: 'error',
          details: 'Memory measurement not available'
        });
        return;
      }
      
      this.setupMockChrome();
      this.createMockMarshmallowDOM(200);
      
      // 複数のアプリケーションインスタンスを作成してメモリ使用量を監視
      const apps = [];
      const memoryMeasurements = [initialMemory];
      
      for (let i = 0; i < 5; i++) {
        const app = new ContentScriptApplication();
        await app.initialize();
        app.start();
        apps.push(app);
        
        const memory = this.measureMemory(`アプリ ${i + 1} 作成後`);
        if (memory) memoryMeasurements.push(memory);
        
        // 少し待機
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // アプリケーションを順次シャットダウン
      for (let i = 0; i < apps.length; i++) {
        apps[i].shutdown();
        
        const memory = this.measureMemory(`アプリ ${i + 1} シャットダウン後`);
        if (memory) memoryMeasurements.push(memory);
      }
      
      // ガベージコレクション強制実行
      if (window.gc) {
        window.gc();
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      const finalMemory = this.measureMemory('テスト終了');
      
      // メモリ使用量の解析
      const memoryIncrease = finalMemory.used - initialMemory.used;
      const maxMemory = Math.max(...memoryMeasurements.map(m => m.used));
      const memoryEfficiency = ((maxMemory - finalMemory.used) / maxMemory) * 100;
      
      this.benchmarks.memoryUsage = {
        initial: initialMemory.used,
        final: finalMemory.used,
        increase: memoryIncrease,
        max: maxMemory,
        efficiency: memoryEfficiency
      };
      
      console.log(`メモリ使用量 - 増加: ${Math.round(memoryIncrease/1024)}KB, 効率: ${memoryEfficiency.toFixed(1)}%`);
      
      // 1MB以下の増加かつ80%以上の効率を良好とする
      if (memoryIncrease < 1048576 && memoryEfficiency > 80) {
        this.testResults.push({
          test: 'メモリ使用量',
          status: 'success',
          details: `Increase: ${Math.round(memoryIncrease/1024)}KB, Efficiency: ${memoryEfficiency.toFixed(1)}% (excellent)`
        });
      } else if (memoryIncrease < 2097152 && memoryEfficiency > 60) {
        this.testResults.push({
          test: 'メモリ使用量',
          status: 'success',
          details: `Increase: ${Math.round(memoryIncrease/1024)}KB, Efficiency: ${memoryEfficiency.toFixed(1)}% (good)`
        });
      } else {
        this.testResults.push({
          test: 'メモリ使用量',
          status: 'error',
          details: `Increase: ${Math.round(memoryIncrease/1024)}KB, Efficiency: ${memoryEfficiency.toFixed(1)}% (poor)`
        });
      }
      
    } catch (error) {
      console.error('メモリ使用量テストエラー:', error.message);
      this.testResults.push({
        test: 'メモリ使用量',
        status: 'error',
        details: error.message
      });
    }
  }

  /**
   * 全パフォーマンステスト実行
   */
  async runAllPerformanceTests() {
    console.log('=== パフォーマンステスト開始 ===');
    
    this.testResults = [];
    this.benchmarks = {
      initialization: [],
      messageExtraction: [],
      domWatching: [],
      memoryUsage: []
    };
    
    await this.testInitializationPerformance();
    await this.testMessageExtractionPerformance();
    await this.testDOMWatchingPerformance();
    await this.testMemoryUsage();
    
    console.log('=== パフォーマンステスト完了 ===');
    return {
      results: this.testResults,
      benchmarks: this.benchmarks
    };
  }

  /**
   * テスト結果の表示
   */
  displayResults() {
    console.log('\n=== パフォーマンステスト結果サマリー ===');
    let successCount = 0;
    let totalCount = this.testResults.length;
    
    this.testResults.forEach(result => {
      const status = result.status === 'success' ? '✓' : '✗';
      console.log(`${status} ${result.test}: ${result.details}`);
      if (result.status === 'success') successCount++;
    });
    
    console.log(`\n成功: ${successCount}/${totalCount} (${Math.round(successCount/totalCount*100)}%)`);
    
    // ベンチマーク結果の詳細表示
    console.log('\n=== ベンチマーク詳細 ===');
    console.log('初期化:', this.benchmarks.initialization);
    console.log('メッセージ抽出:', this.benchmarks.messageExtraction);
    console.log('DOM監視:', this.benchmarks.domWatching);
    console.log('メモリ使用量:', this.benchmarks.memoryUsage);
    
    return {
      total: totalCount,
      success: successCount,
      successRate: Math.round(successCount/totalCount*100),
      benchmarks: this.benchmarks
    };
  }
}

// テスト実行用の関数
async function runPerformanceTests() {
  const tester = new PerformanceTester();
  const results = await tester.runAllPerformanceTests();
  const summary = tester.displayResults();
  
  return {
    ...results,
    summary
  };
}

// ブラウザ環境での使用
if (typeof window !== 'undefined') {
  window.PerformanceTester = PerformanceTester;
  window.runPerformanceTests = runPerformanceTests;
}