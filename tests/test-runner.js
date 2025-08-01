/**
 * シンプルなテストランナー
 * 
 * 責任範囲:
 * - テストの実行管理
 * - 結果の集計とレポート
 * - モック機能の提供
 * - 非同期テストの対応
 */
class TestRunner {
  constructor() {
    /**
     * テストスイート
     * @type {Array}
     */
    this.testSuites = [];
    
    /**
     * テスト結果
     * @type {Object}
     */
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0,
      failures: []
    };
    
    /**
     * 設定
     * @type {Object}
     */
    this.config = {
      verbose: true,
      timeout: 5000,
      enableConsoleOutput: true
    };
    
    /**
     * モック関数
     * @type {Map}
     */
    this.mocks = new Map();
    
    /**
     * セットアップ・ティアダウン関数
     * @type {Object}
     */
    this.hooks = {
      beforeAll: [],
      afterAll: [],
      beforeEach: [],
      afterEach: []
    };
    
    this.setupGlobalTestAPI();
  }
  
  /**
   * グローバルテストAPIを設定
   */
  setupGlobalTestAPI() {
    // テストスイート定義
    window.describe = (description, fn) => {
      const suite = {
        description,
        tests: [],
        beforeEach: [],
        afterEach: [],
        beforeAll: [],
        afterAll: []
      };
      
      this.testSuites.push(suite);
      
      // テストコンテキストを設定
      const originalIt = window.it;
      const originalBeforeEach = window.beforeEach;
      const originalAfterEach = window.afterEach;
      const originalBeforeAll = window.beforeAll;
      const originalAfterAll = window.afterAll;
      
      window.it = (description, fn) => {
        suite.tests.push({ description, fn, skip: false });
      };
      
      window.it.skip = (description, fn) => {
        suite.tests.push({ description, fn, skip: true });
      };
      
      window.beforeEach = (fn) => {
        suite.beforeEach.push(fn);
      };
      
      window.afterEach = (fn) => {
        suite.afterEach.push(fn);
      };
      
      window.beforeAll = (fn) => {
        suite.beforeAll.push(fn);
      };
      
      window.afterAll = (fn) => {
        suite.afterAll.push(fn);
      };
      
      try {
        fn();
      } finally {
        // 元の関数を復元
        window.it = originalIt;
        window.beforeEach = originalBeforeEach;
        window.afterEach = originalAfterEach;
        window.beforeAll = originalBeforeAll;
        window.afterAll = originalAfterAll;
      }
    };
    
    // アサーション
    window.expect = (actual) => {
      return {
        toBe: (expected) => {
          if (actual !== expected) {
            throw new Error(`Expected ${expected}, but got ${actual}`);
          }
        },
        toEqual: (expected) => {
          if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`Expected ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`);
          }
        },
        toBeTruthy: () => {
          if (!actual) {
            throw new Error(`Expected truthy value, but got ${actual}`);
          }
        },
        toBeFalsy: () => {
          if (actual) {
            throw new Error(`Expected falsy value, but got ${actual}`);
          }
        },
        toBeNull: () => {
          if (actual !== null) {
            throw new Error(`Expected null, but got ${actual}`);
          }
        },
        toBeUndefined: () => {
          if (actual !== undefined) {
            throw new Error(`Expected undefined, but got ${actual}`);
          }
        },
        toContain: (expected) => {
          if (!actual || !actual.includes(expected)) {
            throw new Error(`Expected ${actual} to contain ${expected}`);
          }
        },
        toThrow: (expectedError) => {
          if (typeof actual !== 'function') {
            throw new Error('Expected a function');
          }
          
          try {
            actual();
            throw new Error('Expected function to throw');
          } catch (error) {
            if (expectedError && !error.message.includes(expectedError)) {
              throw new Error(`Expected error to contain "${expectedError}", but got "${error.message}"`);
            }
          }
        },
        toHaveBeenCalled: () => {
          if (!actual._isMock) {
            throw new Error('Expected a mock function');
          }
          if (actual._calls.length === 0) {
            throw new Error('Expected mock function to have been called');
          }
        },
        toHaveBeenCalledWith: (...args) => {
          if (!actual._isMock) {
            throw new Error('Expected a mock function');
          }
          const found = actual._calls.some(call => 
            call.args.length === args.length && 
            call.args.every((arg, i) => arg === args[i])
          );
          if (!found) {
            throw new Error(`Expected mock function to have been called with ${JSON.stringify(args)}`);
          }
        }
      };
    };
    
    // モック関数作成
    window.jest = {
      fn: (implementation) => {
        const mockFn = function(...args) {
          mockFn._calls.push({ args, timestamp: Date.now() });
          if (implementation) {
            return implementation(...args);
          }
        };
        
        mockFn._isMock = true;
        mockFn._calls = [];
        mockFn.mockReset = () => {
          mockFn._calls = [];
        };
        mockFn.mockImplementation = (impl) => {
          implementation = impl;
        };
        
        return mockFn;
      }
    };
  }
  
  /**
   * テストを実行
   * 
   * @returns {Promise<Object>} テスト結果
   */
  async runTests() {
    this.log('🧪 Starting test execution...');
    const startTime = Date.now();
    
    try {
      // beforeAll フックを実行
      for (const hook of this.hooks.beforeAll) {
        await hook();
      }
      
      // 各テストスイートを実行
      for (const suite of this.testSuites) {
        await this.runTestSuite(suite);
      }
      
      // afterAll フックを実行
      for (const hook of this.hooks.afterAll) {
        await hook();
      }
      
    } catch (error) {
      this.log(`❌ Test execution failed: ${error.message}`);
      this.results.failures.push({
        suite: 'Global',
        test: 'Test execution',
        error: error.message,
        stack: error.stack
      });
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    this.generateReport(duration);
    return this.results;
  }
  
  /**
   * テストスイートを実行
   * 
   * @param {Object} suite テストスイート
   */
  async runTestSuite(suite) {
    this.log(`\n📋 ${suite.description}`);
    
    try {
      // beforeAll フックを実行
      for (const hook of suite.beforeAll) {
        await hook();
      }
      
      // 各テストを実行
      for (const test of suite.tests) {
        await this.runTest(suite, test);
      }
      
      // afterAll フックを実行
      for (const hook of suite.afterAll) {
        await hook();
      }
      
    } catch (error) {
      this.log(`❌ Suite failed: ${error.message}`);
      this.results.failures.push({
        suite: suite.description,
        test: 'Suite setup/teardown',
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * 単一テストを実行
   * 
   * @param {Object} suite テストスイート
   * @param {Object} test テスト
   */
  async runTest(suite, test) {
    this.results.total++;
    
    if (test.skip) {
      this.results.skipped++;
      this.log(`  ⏭️  ${test.description} (skipped)`);
      return;
    }
    
    try {
      // beforeEach フックを実行
      for (const hook of suite.beforeEach) {
        await hook();
      }
      
      // タイムアウト設定
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout')), this.config.timeout);
      });
      
      // テスト実行
      await Promise.race([
        Promise.resolve(test.fn()),
        timeout
      ]);
      
      // afterEach フックを実行
      for (const hook of suite.afterEach) {
        await hook();
      }
      
      this.results.passed++;
      this.log(`  ✅ ${test.description}`);
      
    } catch (error) {
      this.results.failed++;
      this.log(`  ❌ ${test.description}`);
      this.log(`     Error: ${error.message}`);
      
      this.results.failures.push({
        suite: suite.description,
        test: test.description,
        error: error.message,
        stack: error.stack
      });
    }
  }
  
  /**
   * テストレポートを生成
   * 
   * @param {number} duration 実行時間
   */
  generateReport(duration) {
    this.log('\n📊 Test Results:');
    this.log(`Total: ${this.results.total}`);
    this.log(`Passed: ${this.results.passed}`);
    this.log(`Failed: ${this.results.failed}`);
    this.log(`Skipped: ${this.results.skipped}`);
    this.log(`Duration: ${duration}ms`);
    
    if (this.results.failures.length > 0) {
      this.log('\n❌ Failures:');
      this.results.failures.forEach((failure, index) => {
        this.log(`${index + 1}. ${failure.suite} > ${failure.test}`);
        this.log(`   ${failure.error}`);
      });
    }
    
    const passRate = this.results.total > 0 ? 
      (this.results.passed / this.results.total * 100).toFixed(1) : 0;
    
    this.log(`\nPass Rate: ${passRate}%`);
    
    if (this.results.failed === 0) {
      this.log('\n🎉 All tests passed!');
    } else {
      this.log(`\n💥 ${this.results.failed} test(s) failed`);
    }
  }
  
  /**
   * ログ出力
   * 
   * @param {string} message メッセージ
   */
  log(message) {
    if (this.config.enableConsoleOutput) {
      console.log(message);
    }
  }
  
  /**
   * モック関数を作成
   * 
   * @param {string} name モック名
   * @param {Function} implementation 実装
   * @returns {Function} モック関数
   */
  createMock(name, implementation) {
    const mockFn = jest.fn(implementation);
    this.mocks.set(name, mockFn);
    return mockFn;
  }
  
  /**
   * すべてのモックをリセット
   */
  resetAllMocks() {
    this.mocks.forEach(mock => mock.mockReset());
  }
  
  /**
   * 設定を更新
   * 
   * @param {Object} config 新しい設定
   */
  updateConfig(config) {
    this.config = { ...this.config, ...config };
  }
}

// Chrome Storage のモック
class MockChromeStorage {
  constructor() {
    this.data = {};
  }
  
  get(keys, callback) {
    const result = {};
    const keyArray = Array.isArray(keys) ? keys : [keys];
    
    keyArray.forEach(key => {
      result[key] = this.data[key];
    });
    
    setTimeout(() => callback(result), 0);
  }
  
  set(items, callback) {
    Object.assign(this.data, items);
    setTimeout(() => callback && callback(), 0);
  }
  
  remove(keys, callback) {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    keyArray.forEach(key => {
      delete this.data[key];
    });
    setTimeout(() => callback && callback(), 0);
  }
  
  clear(callback) {
    this.data = {};
    setTimeout(() => callback && callback(), 0);
  }
}

// テスト環境のセットアップ
function setupTestEnvironment() {
  // Chrome APIs のモック
  if (!window.chrome) {
    window.chrome = {
      storage: {
        local: new MockChromeStorage(),
        onChanged: {
          addListener: jest.fn()
        }
      },
      runtime: {
        lastError: null,
        onMessage: {
          addListener: jest.fn()
        },
        sendMessage: jest.fn()
      },
      alarms: {
        create: jest.fn(),
        clear: jest.fn(),
        clearAll: jest.fn(),
        onAlarm: {
          addListener: jest.fn()
        }
      },
      notifications: {
        create: jest.fn()
      }
    };
  }
  
  // Console methods のモック
  const originalConsole = { ...console };
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  
  return {
    restoreConsole: () => {
      Object.assign(console, originalConsole);
    }
  };
}

// グローバルに公開
window.TestRunner = TestRunner;
window.setupTestEnvironment = setupTestEnvironment;
window.MockChromeStorage = MockChromeStorage;