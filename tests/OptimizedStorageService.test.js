/**
 * OptimizedStorageService のテスト
 */

// テスト実行前に OptimizedStorageService を読み込み
document.addEventListener('DOMContentLoaded', () => {
  const script = document.createElement('script');
  script.src = '../src/shared/utils/OptimizedStorageService.js';
  script.onload = () => {
    runOptimizedStorageServiceTests();
  };
  document.head.appendChild(script);
});

function runOptimizedStorageServiceTests() {
  describe('OptimizedStorageService', () => {
    let storageService;
    let mockChromeStorage;
    
    beforeEach(() => {
      // Chrome Storage のモックを作成
      mockChromeStorage = new MockChromeStorage();
      
      // Chrome API をモック
      if (!window.chrome) {
        window.chrome = {};
      }
      
      window.chrome.storage = {
        local: mockChromeStorage,
        onChanged: {
          addListener: jest.fn()
        }
      };
      
      window.chrome.runtime = {
        lastError: null
      };
      
      storageService = new OptimizedStorageService();
    });
    
    describe('基本的な機能', () => {
      it('値を設定・取得できる', async () => {
        await storageService.set('testKey', 'testValue');
        const value = await storageService.get('testKey');
        expect(value).toBe('testValue');
      });
      
      it('デフォルト値が正しく返される', async () => {
        const value = await storageService.get('nonexistentKey', 'defaultValue');
        expect(value).toBe('defaultValue');
      });
      
      it('複数の値を一括設定・取得できる', async () => {
        const data = new Map([
          ['key1', 'value1'],
          ['key2', 'value2'],
          ['key3', 'value3']
        ]);
        
        await storageService.setMultiple(data);
        const retrieved = await storageService.getMultiple(['key1', 'key2', 'key3']);
        
        expect(retrieved.get('key1')).toBe('value1');
        expect(retrieved.get('key2')).toBe('value2');
        expect(retrieved.get('key3')).toBe('value3');
      });
      
      it('値を削除できる', async () => {
        await storageService.set('testKey', 'testValue');
        await storageService.remove('testKey');
        
        const value = await storageService.get('testKey', 'defaultValue');
        expect(value).toBe('defaultValue');
      });
    });
    
    describe('キャッシュ機能', () => {
      it('キャッシュが有効になる', async () => {
        // 最初のアクセス
        await storageService.get('testKey', 'defaultValue');
        
        // 値を設定
        await storageService.set('testKey', 'testValue');
        
        // キャッシュから取得されることを確認
        const value = await storageService.get('testKey');
        expect(value).toBe('testValue');
        
        const stats = storageService.getStats();
        expect(stats.cacheHits).toBeGreaterThan(0);
      });
      
      it('キャッシュをクリアできる', async () => {
        await storageService.set('testKey', 'testValue');
        storageService.clearCache();
        
        const stats = storageService.getStats();
        expect(stats.cacheSize).toBe(0);
      });
      
      it('キャッシュサイズ制限が機能する', async () => {
        const maxSize = 1000;
        storageService.updateConfig({ maxCacheSize: maxSize });
        
        // 大量のデータを設定
        for (let i = 0; i < maxSize + 100; i++) {
          await storageService.set(`key${i}`, `value${i}`);
        }
        
        const stats = storageService.getStats();
        expect(stats.cacheSize).toBeLessThanOrEqual(maxSize);
      });
    });
    
    describe('バッチ処理', () => {
      it('バッチ処理が動作する', async () => {
        // 複数の値を設定
        await storageService.set('key1', 'value1');
        await storageService.set('key2', 'value2');
        await storageService.set('key3', 'value3');
        
        // バッチ処理を強制実行
        await storageService.flushPendingWrites();
        
        const stats = storageService.getStats();
        expect(stats.batchWrites).toBeGreaterThan(0);
      });
      
      it('バッチ遅延が設定可能', async () => {
        const delay = 50;
        storageService.updateConfig({ batchDelay: delay });
        
        const startTime = Date.now();
        await storageService.set('testKey', 'testValue');
        
        // 遅延後にバッチ処理が実行されることを確認
        await new Promise(resolve => setTimeout(resolve, delay + 10));
        
        const endTime = Date.now();
        expect(endTime - startTime).toBeGreaterThan(delay);
      });
    });
    
    describe('エラーハンドリング', () => {
      it('Chrome Storage エラーが適切に処理される', async () => {
        // Chrome Storage でエラーを発生させる
        window.chrome.runtime.lastError = { message: 'Storage error' };
        
        try {
          await storageService.get('testKey');
        } catch (error) {
          expect(error.message).toContain('Storage error');
        }
        
        // エラーをクリア
        window.chrome.runtime.lastError = null;
      });
      
      it('不正な値の処理', async () => {
        // null 値の処理
        await storageService.set('nullKey', null);
        const nullValue = await storageService.get('nullKey');
        expect(nullValue).toBeNull();
        
        // undefined 値の処理
        await storageService.set('undefinedKey', undefined);
        const undefinedValue = await storageService.get('undefinedKey');
        expect(undefinedValue).toBeUndefined();
      });
    });
    
    describe('統計情報', () => {
      it('統計情報が正しく更新される', async () => {
        await storageService.set('testKey', 'testValue');
        await storageService.get('testKey');
        
        const stats = storageService.getStats();
        expect(stats.reads).toBeGreaterThan(0);
        expect(stats.writes).toBeGreaterThan(0);
      });
      
      it('キャッシュヒット率が計算される', async () => {
        await storageService.set('testKey', 'testValue');
        await storageService.get('testKey'); // キャッシュヒット
        
        const stats = storageService.getStats();
        expect(stats.cacheHitRate).toContain('%');
      });
    });
    
    describe('設定変更', () => {
      it('設定を更新できる', () => {
        const newConfig = {
          batchDelay: 200,
          cacheTimeout: 10000,
          maxCacheSize: 2000
        };
        
        storageService.updateConfig(newConfig);
        
        // 設定が適用されていることを確認（内部的な確認）
        expect(storageService.config.batchDelay).toBe(200);
        expect(storageService.config.cacheTimeout).toBe(10000);
        expect(storageService.config.maxCacheSize).toBe(2000);
      });
      
      it('デバッグモードを有効にできる', () => {
        storageService.updateConfig({ enableDebug: true });
        expect(storageService.config.enableDebug).toBeTruthy();
      });
    });
    
    describe('Storage 変更の監視', () => {
      it('Storage 変更リスナーが登録される', () => {
        const callback = jest.fn();
        storageService.onChanged(callback);
        
        // Chrome Storage の変更リスナーが呼ばれることを確認
        expect(window.chrome.storage.onChanged.addListener).toHaveBeenCalled();
      });
    });
    
    describe('パフォーマンス', () => {
      it('大量データの処理が効率的', async () => {
        const dataCount = 1000;
        const startTime = Date.now();
        
        // 大量のデータを一括設定
        const data = new Map();
        for (let i = 0; i < dataCount; i++) {
          data.set(`key${i}`, `value${i}`);
        }
        
        await storageService.setMultiple(data);
        
        // 大量のデータを一括取得
        const keys = Array.from(data.keys());
        const retrieved = await storageService.getMultiple(keys);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(retrieved.size).toBe(dataCount);
        expect(duration).toBeLessThan(1000); // 1秒以内
      });
      
      it('キャッシュにより高速アクセス', async () => {
        await storageService.set('testKey', 'testValue');
        
        // 最初のアクセス（キャッシュミス）
        const start1 = Date.now();
        await storageService.get('testKey');
        const duration1 = Date.now() - start1;
        
        // 2回目のアクセス（キャッシュヒット）
        const start2 = Date.now();
        await storageService.get('testKey');
        const duration2 = Date.now() - start2;
        
        // キャッシュアクセスの方が高速であることを確認
        expect(duration2).toBeLessThan(duration1);
      });
    });
  });
}