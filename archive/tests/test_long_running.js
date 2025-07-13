// 長時間稼働テスト用モジュール
// test_long_running.js

/**
 * 長時間稼働テスト用クラス
 * 24時間連続動作での安定性確認
 */
class LongRunningTester {
  constructor() {
    this.testResults = [];
    this.app = null;
    this.testStartTime = null;
    this.checkpointInterval = null;
    this.memoryMonitorInterval = null;
    this.communicationHistory = [];
    this.memorySnapshots = [];
    this.errorLog = [];
    this.targetDurationMinutes = 24 * 60; // 24時間
    this.checkInterval = 5; // 5分間隔でチェック
  }

  /**
   * 長時間稼働テストの初期化
   */
  async initialize() {
    console.log('=== 長時間稼働テスト初期化開始 ===');
    
    try {
      // Chrome Extension環境の確認
      if (!chrome || !chrome.runtime || !chrome.runtime.id) {
        throw new Error('Chrome Extension環境が検出されません');
      }

      // Content Script V2の初期化
      this.app = new ContentScriptApplication();
      await this.app.initialize();

      // 初期メモリスナップショット
      this.takeMemorySnapshot('初期化完了');

      console.log('✓ 長時間稼働テスト初期化完了');
      return true;

    } catch (error) {
      console.error('✗ 長時間稼働テスト初期化失敗:', error.message);
      throw error;
    }
  }

  /**
   * 長時間稼働テストの開始
   */
  async startLongRunningTest(durationMinutes = 24 * 60) {
    console.log(`=== 長時間稼働テスト開始 (${durationMinutes}分 = ${Math.round(durationMinutes/60)}時間) ===`);
    
    try {
      this.targetDurationMinutes = durationMinutes;
      this.testStartTime = Date.now();
      
      // アプリケーション開始
      this.app.start();
      
      this.testResults.push({
        timestamp: new Date().toISOString(),
        test: '長時間稼働テスト開始',
        status: 'success',
        details: `目標稼働時間: ${Math.round(durationMinutes/60)}時間`,
        memoryUsage: this.getCurrentMemoryUsage()
      });

      // 定期チェックポイントの設定
      this.setupCheckpoints();
      
      // メモリ監視の開始
      this.startMemoryMonitoring();
      
      // 定期的なBackground Script通信テスト
      this.startPeriodicCommunicationTest();

      console.log(`長時間稼働テスト開始成功 - 目標時間: ${Math.round(durationMinutes/60)}時間`);
      
      return {
        started: true,
        targetDuration: durationMinutes,
        startTime: new Date(this.testStartTime).toISOString(),
        checkInterval: this.checkInterval
      };

    } catch (error) {
      console.error('✗ 長時間稼働テスト開始エラー:', error.message);
      this.testResults.push({
        timestamp: new Date().toISOString(),
        test: '長時間稼働テスト開始',
        status: 'error',
        details: error.message
      });
      throw error;
    }
  }

  /**
   * チェックポイントの設定
   */
  setupCheckpoints() {
    this.checkpointInterval = setInterval(async () => {
      try {
        await this.performCheckpoint();
        
        // 目標時間に達したかチェック
        const elapsedMinutes = (Date.now() - this.testStartTime) / 60000;
        if (elapsedMinutes >= this.targetDurationMinutes) {
          await this.completeLongRunningTest();
        }
        
      } catch (error) {
        console.error('チェックポイント実行エラー:', error.message);
        this.logError('checkpoint', error);
      }
    }, this.checkInterval * 60000); // 分をミリ秒に変換
  }

  /**
   * チェックポイントの実行
   */
  async performCheckpoint() {
    const elapsedMinutes = Math.round((Date.now() - this.testStartTime) / 60000);
    const elapsedHours = Math.round(elapsedMinutes / 60 * 10) / 10; // 小数点1桁
    
    console.log(`[${elapsedHours}時間経過] チェックポイント実行中...`);

    try {
      // 1. アプリケーション状態チェック
      const appStatus = this.checkApplicationStatus();
      
      // 2. メモリ使用量チェック
      const memoryStatus = this.takeMemorySnapshot(`${elapsedHours}時間経過`);
      
      // 3. Background Script通信テスト
      const communicationStatus = await this.testBackgroundCommunication();
      
      // 4. DOM要素の状態確認
      const domStatus = this.checkDOMIntegrity();
      
      // 5. チェックポイント結果の記録
      this.testResults.push({
        timestamp: new Date().toISOString(),
        test: `チェックポイント ${elapsedHours}時間`,
        status: this.evaluateCheckpointStatus(appStatus, memoryStatus, communicationStatus, domStatus),
        details: {
          elapsed: `${elapsedHours}時間`,
          app: appStatus,
          memory: memoryStatus,
          communication: communicationStatus,
          dom: domStatus
        },
        memoryUsage: memoryStatus.current
      });

      console.log(`✓ チェックポイント完了 [${elapsedHours}時間経過]`);

    } catch (error) {
      console.error(`✗ チェックポイント失敗 [${elapsedHours}時間経過]:`, error.message);
      this.logError('checkpoint_execution', error);
      
      this.testResults.push({
        timestamp: new Date().toISOString(),
        test: `チェックポイント ${elapsedHours}時間`,
        status: 'error',
        details: `チェックポイント実行エラー: ${error.message}`
      });
    }
  }

  /**
   * アプリケーション状態のチェック
   */
  checkApplicationStatus() {
    return {
      isInitialized: this.app.isInitialized,
      isRunning: this.app.isRunning,
      contextAlive: this.app.contextManager.isAlive(),
      domWatcherActive: this.app.domWatcher.isWatching,
      pollingManagerActive: this.app.pollingManager.isPolling
    };
  }

  /**
   * メモリスナップショットの取得
   */
  takeMemorySnapshot(label) {
    const snapshot = {
      timestamp: new Date().toISOString(),
      label,
      memory: this.getCurrentMemoryUsage()
    };

    this.memorySnapshots.push(snapshot);

    // メモリリークの検出
    const memoryLeak = this.detectMemoryLeak();
    
    return {
      current: snapshot.memory,
      leak: memoryLeak,
      totalSnapshots: this.memorySnapshots.length
    };
  }

  /**
   * 現在のメモリ使用量取得
   */
  getCurrentMemoryUsage() {
    if (performance.memory) {
      return {
        used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
        total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
        limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
      };
    }
    return null;
  }

  /**
   * メモリリークの検出
   */
  detectMemoryLeak() {
    if (this.memorySnapshots.length < 2) return null;

    const recent = this.memorySnapshots.slice(-5); // 最新5個
    const first = recent[0];
    const last = recent[recent.length - 1];

    if (!first.memory || !last.memory) return null;

    const increase = last.memory.used - first.memory.used;
    const increaseRate = increase / (recent.length - 1); // スナップショットあたりの増加量

    return {
      increase,
      increaseRate,
      status: increaseRate > 5 ? 'warning' : increaseRate > 10 ? 'error' : 'normal' // 5MB/チェック以上で警告
    };
  }

  /**
   * メモリ監視の開始
   */
  startMemoryMonitoring() {
    this.memoryMonitorInterval = setInterval(() => {
      this.takeMemorySnapshot('定期監視');
    }, 15 * 60000); // 15分間隔
  }

  /**
   * Background Script通信テスト
   */
  async testBackgroundCommunication() {
    try {
      const testMessage = {
        action: 'newMarshmallowMessages',
        messages: [{
          id: `long-running-test-${Date.now()}`,
          text: `長時間稼働テスト ${new Date().toLocaleTimeString()}: システム健康チェック`,
          received_at: new Date().toISOString()
        }],
        isLoggedIn: true
      };

      const startTime = Date.now();
      const response = await this.app.communicator.sendMessageSafely(testMessage);
      const responseTime = Date.now() - startTime;

      this.communicationHistory.push({
        timestamp: new Date().toISOString(),
        responseTime,
        success: true,
        response
      });

      return {
        success: true,
        responseTime,
        totalCommunications: this.communicationHistory.length
      };

    } catch (error) {
      this.communicationHistory.push({
        timestamp: new Date().toISOString(),
        success: false,
        error: error.message
      });

      return {
        success: false,
        error: error.message,
        totalCommunications: this.communicationHistory.length
      };
    }
  }

  /**
   * 定期的なBackground Script通信テストの開始
   */
  startPeriodicCommunicationTest() {
    setInterval(async () => {
      try {
        await this.testBackgroundCommunication();
      } catch (error) {
        this.logError('periodic_communication', error);
      }
    }, 10 * 60000); // 10分間隔
  }

  /**
   * DOM要素の整合性チェック
   */
  checkDOMIntegrity() {
    try {
      const loginStatus = this.app.pageInteractor.getUserLoginStatus();
      const messageCount = this.app.pageInteractor.extractNewMessages().length;
      
      return {
        loginDetected: loginStatus,
        messageCount,
        domAccessible: true
      };

    } catch (error) {
      return {
        domAccessible: false,
        error: error.message
      };
    }
  }

  /**
   * チェックポイントステータスの評価
   */
  evaluateCheckpointStatus(appStatus, memoryStatus, communicationStatus, domStatus) {
    // 必須条件のチェック
    if (!appStatus.isRunning || !appStatus.contextAlive) {
      return 'error';
    }

    if (!communicationStatus.success) {
      return 'error';
    }

    // 警告条件のチェック
    if (memoryStatus.leak && memoryStatus.leak.status === 'error') {
      return 'warning';
    }

    if (communicationStatus.responseTime > 5000) { // 5秒以上
      return 'warning';
    }

    return 'success';
  }

  /**
   * エラーログの記録
   */
  logError(category, error) {
    this.errorLog.push({
      timestamp: new Date().toISOString(),
      category,
      message: error.message,
      stack: error.stack
    });

    console.error(`[${category}] ${error.message}`);
  }

  /**
   * 長時間稼働テストの完了
   */
  async completeLongRunningTest() {
    console.log('=== 長時間稼働テスト完了 ===');
    
    try {
      const totalRunTime = Math.round((Date.now() - this.testStartTime) / 60000);
      const totalRunHours = Math.round(totalRunTime / 60 * 10) / 10;

      // 最終チェック
      await this.performFinalCheck();

      // インターバルのクリーンアップ
      if (this.checkpointInterval) {
        clearInterval(this.checkpointInterval);
      }
      if (this.memoryMonitorInterval) {
        clearInterval(this.memoryMonitorInterval);
      }

      // アプリケーションのシャットダウン
      this.app.shutdown();

      // 最終結果の記録
      this.testResults.push({
        timestamp: new Date().toISOString(),
        test: '長時間稼働テスト完了',
        status: 'success',
        details: {
          totalRunTime: `${totalRunHours}時間`,
          checkpoints: this.testResults.filter(r => r.test.includes('チェックポイント')).length,
          communications: this.communicationHistory.length,
          errors: this.errorLog.length,
          memorySnapshots: this.memorySnapshots.length
        }
      });

      console.log(`長時間稼働テスト完了 - 総稼働時間: ${totalRunHours}時間`);

      return {
        completed: true,
        totalRunTime: totalRunHours,
        summary: this.generateTestSummary()
      };

    } catch (error) {
      console.error('✗ 長時間稼働テスト完了処理エラー:', error.message);
      this.logError('completion', error);
      throw error;
    }
  }

  /**
   * 最終チェックの実行
   */
  async performFinalCheck() {
    console.log('最終チェック実行中...');

    const finalMemory = this.takeMemorySnapshot('最終チェック');
    const finalCommunication = await this.testBackgroundCommunication();
    const finalAppStatus = this.checkApplicationStatus();

    this.testResults.push({
      timestamp: new Date().toISOString(),
      test: '最終チェック',
      status: 'success',
      details: {
        memory: finalMemory,
        communication: finalCommunication,
        app: finalAppStatus
      }
    });
  }

  /**
   * テストサマリーの生成
   */
  generateTestSummary() {
    const successfulCheckpoints = this.testResults.filter(r => 
      r.test.includes('チェックポイント') && r.status === 'success'
    ).length;
    
    const totalCheckpoints = this.testResults.filter(r => 
      r.test.includes('チェックポイント')
    ).length;

    const successfulCommunications = this.communicationHistory.filter(c => c.success).length;
    const averageResponseTime = this.calculateAverageResponseTime();

    const memoryIncrease = this.calculateTotalMemoryIncrease();

    return {
      checkpoints: {
        total: totalCheckpoints,
        successful: successfulCheckpoints,
        successRate: totalCheckpoints > 0 ? Math.round(successfulCheckpoints / totalCheckpoints * 100) : 0
      },
      communications: {
        total: this.communicationHistory.length,
        successful: successfulCommunications,
        successRate: this.communicationHistory.length > 0 ? 
          Math.round(successfulCommunications / this.communicationHistory.length * 100) : 0,
        averageResponseTime
      },
      memory: memoryIncrease,
      errors: {
        total: this.errorLog.length,
        categories: this.groupErrorsByCategory()
      }
    };
  }

  /**
   * 平均応答時間の計算
   */
  calculateAverageResponseTime() {
    const successfulComms = this.communicationHistory.filter(c => c.success && c.responseTime);
    if (successfulComms.length === 0) return 0;

    const totalTime = successfulComms.reduce((sum, comm) => sum + comm.responseTime, 0);
    return Math.round(totalTime / successfulComms.length);
  }

  /**
   * 総メモリ増加量の計算
   */
  calculateTotalMemoryIncrease() {
    if (this.memorySnapshots.length < 2) return null;

    const first = this.memorySnapshots[0];
    const last = this.memorySnapshots[this.memorySnapshots.length - 1];

    if (!first.memory || !last.memory) return null;

    const increase = last.memory.used - first.memory.used;
    
    return {
      initial: first.memory.used,
      final: last.memory.used,
      increase,
      status: increase < 50 ? 'good' : increase < 100 ? 'warning' : 'error' // 50MB未満で良好
    };
  }

  /**
   * エラーをカテゴリ別にグループ化
   */
  groupErrorsByCategory() {
    const grouped = {};
    this.errorLog.forEach(error => {
      grouped[error.category] = (grouped[error.category] || 0) + 1;
    });
    return grouped;
  }

  /**
   * テスト結果の表示
   */
  displayResults() {
    console.log('\n=== 長時間稼働テスト結果サマリー ===');
    
    const summary = this.generateTestSummary();
    
    console.log(`チェックポイント: ${summary.checkpoints.successful}/${summary.checkpoints.total} (${summary.checkpoints.successRate}%)`);
    console.log(`通信テスト: ${summary.communications.successful}/${summary.communications.total} (${summary.communications.successRate}%)`);
    console.log(`平均応答時間: ${summary.communications.averageResponseTime}ms`);
    
    if (summary.memory) {
      console.log(`メモリ増加: ${summary.memory.increase}MB (${summary.memory.status})`);
    }
    
    console.log(`エラー発生: ${summary.errors.total}件`);
    
    return summary;
  }

  /**
   * 詳細レポートのエクスポート
   */
  exportDetailedReport() {
    const report = {
      testInfo: {
        startTime: new Date(this.testStartTime).toISOString(),
        endTime: new Date().toISOString(),
        targetDuration: this.targetDurationMinutes,
        actualDuration: Math.round((Date.now() - this.testStartTime) / 60000)
      },
      summary: this.generateTestSummary(),
      testResults: this.testResults,
      memorySnapshots: this.memorySnapshots,
      communicationHistory: this.communicationHistory,
      errorLog: this.errorLog
    };

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `long-running-test-report-${timestamp}.json`;
    a.click();
    URL.revokeObjectURL(url);

    console.log('詳細レポートをエクスポートしました');
    return report;
  }

  /**
   * クリーンアップ
   */
  cleanup() {
    if (this.checkpointInterval) {
      clearInterval(this.checkpointInterval);
    }
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
    }
    if (this.app) {
      this.app.shutdown();
    }
    
    console.log('長時間稼働テストクリーンアップ完了');
  }
}

// テスト実行用の関数
async function runLongRunningTest(durationMinutes = 24 * 60) {
  const tester = new LongRunningTester();
  
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

// 短時間テスト用の関数
async function runStabilityTest(durationMinutes = 60) {
  return runLongRunningTest(durationMinutes);
}

// ブラウザ環境での使用
if (typeof window !== 'undefined') {
  window.LongRunningTester = LongRunningTester;
  window.runLongRunningTest = runLongRunningTest;
  window.runStabilityTest = runStabilityTest;
}