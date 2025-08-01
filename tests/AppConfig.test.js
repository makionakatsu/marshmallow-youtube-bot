/**
 * AppConfig のテスト
 */

// テスト実行前に AppConfig を読み込み
document.addEventListener('DOMContentLoaded', () => {
  const script = document.createElement('script');
  script.src = '../src/shared/config/AppConfig.js';
  script.onload = () => {
    runAppConfigTests();
  };
  document.head.appendChild(script);
});

function runAppConfigTests() {
  describe('AppConfig', () => {
    let appConfig;
    
    beforeEach(() => {
      appConfig = new AppConfig();
    });
    
    describe('基本的な設定管理', () => {
      it('デフォルト設定が正しく設定される', () => {
        expect(appConfig.get('POLLING_INTERVAL')).toBe(30000);
        expect(appConfig.get('MAX_RETRY_COUNT')).toBe(3);
        expect(appConfig.get('DEBUG_MODE')).toBe(false);
        expect(appConfig.get('TEST_MODE')).toBe(false);
      });
      
      it('設定値を取得できる', () => {
        const value = appConfig.get('POLLING_INTERVAL');
        expect(value).toBe(30000);
      });
      
      it('存在しない設定のデフォルト値を取得', () => {
        const value = appConfig.get('NONEXISTENT_KEY', 'default_value');
        expect(value).toBe('default_value');
      });
      
      it('設定値を更新できる', () => {
        appConfig.set('POLLING_INTERVAL', 60000);
        expect(appConfig.get('POLLING_INTERVAL')).toBe(60000);
      });
      
      it('複数の設定値を一括更新', () => {
        const updates = {
          POLLING_INTERVAL: 45000,
          MAX_RETRY_COUNT: 5,
          DEBUG_MODE: true
        };
        
        appConfig.setMultiple(updates);
        
        expect(appConfig.get('POLLING_INTERVAL')).toBe(45000);
        expect(appConfig.get('MAX_RETRY_COUNT')).toBe(5);
        expect(appConfig.get('DEBUG_MODE')).toBe(true);
      });
    });
    
    describe('バリデーション機能', () => {
      it('数値設定のバリデーション', () => {
        // 有効な値
        expect(() => appConfig.set('POLLING_INTERVAL', 60000)).not.toThrow();
        
        // 無効な値（範囲外）
        expect(() => appConfig.set('POLLING_INTERVAL', 500)).toThrow();
        expect(() => appConfig.set('POLLING_INTERVAL', 3600000)).toThrow();
        
        // 無効な型
        expect(() => appConfig.set('POLLING_INTERVAL', 'invalid')).toThrow();
      });
      
      it('真偽値設定のバリデーション', () => {
        // 有効な値
        expect(() => appConfig.set('DEBUG_MODE', true)).not.toThrow();
        expect(() => appConfig.set('DEBUG_MODE', false)).not.toThrow();
        
        // 無効な値
        expect(() => appConfig.set('DEBUG_MODE', 'true')).toThrow();
        expect(() => appConfig.set('DEBUG_MODE', 1)).toThrow();
      });
      
      it('文字列設定のバリデーション', () => {
        // 有効な値
        expect(() => appConfig.set('API_BASE_URL', 'https://api.example.com')).not.toThrow();
        
        // 無効な値（空文字）
        expect(() => appConfig.set('API_BASE_URL', '')).toThrow();
        
        // 無効な値（長すぎる）
        const longString = 'a'.repeat(10001);
        expect(() => appConfig.set('API_BASE_URL', longString)).toThrow();
      });
      
      it('配列設定のバリデーション', () => {
        // 有効な値
        expect(() => appConfig.set('ALLOWED_DOMAINS', ['youtube.com', 'youtu.be'])).not.toThrow();
        
        // 無効な値（配列でない）
        expect(() => appConfig.set('ALLOWED_DOMAINS', 'youtube.com')).toThrow();
        
        // 無効な値（空配列）
        expect(() => appConfig.set('ALLOWED_DOMAINS', [])).toThrow();
      });
    });
    
    describe('環境別設定', () => {
      it('開発環境設定を適用', () => {
        appConfig.setEnvironment('development');
        
        expect(appConfig.get('DEBUG_MODE')).toBe(true);
        expect(appConfig.get('POLLING_INTERVAL')).toBe(10000);
      });
      
      it('本番環境設定を適用', () => {
        appConfig.setEnvironment('production');
        
        expect(appConfig.get('DEBUG_MODE')).toBe(false);
        expect(appConfig.get('POLLING_INTERVAL')).toBe(30000);
      });
      
      it('テスト環境設定を適用', () => {
        appConfig.setEnvironment('test');
        
        expect(appConfig.get('TEST_MODE')).toBe(true);
        expect(appConfig.get('POLLING_INTERVAL')).toBe(1000);
      });
      
      it('無効な環境を指定した場合のエラー', () => {
        expect(() => appConfig.setEnvironment('invalid')).toThrow();
      });
    });
    
    describe('設定の永続化', () => {
      it('設定をストレージに保存', async () => {
        const mockStorage = {
          set: jest.fn().mockResolvedValue(),
          get: jest.fn().mockResolvedValue({ APP_CONFIG: {} })
        };
        
        window.chrome = { storage: { local: mockStorage } };
        
        appConfig.set('POLLING_INTERVAL', 60000);
        await appConfig.save();
        
        expect(mockStorage.set).toHaveBeenCalledWith({
          APP_CONFIG: expect.objectContaining({
            POLLING_INTERVAL: 60000
          })
        });
      });
      
      it('設定をストレージから読み込み', async () => {
        const savedConfig = {
          POLLING_INTERVAL: 45000,
          MAX_RETRY_COUNT: 5,
          DEBUG_MODE: true
        };
        
        const mockStorage = {
          get: jest.fn().mockResolvedValue({ APP_CONFIG: savedConfig })
        };
        
        window.chrome = { storage: { local: mockStorage } };
        
        await appConfig.load();
        
        expect(appConfig.get('POLLING_INTERVAL')).toBe(45000);
        expect(appConfig.get('MAX_RETRY_COUNT')).toBe(5);
        expect(appConfig.get('DEBUG_MODE')).toBe(true);
      });
      
      it('自動保存機能', async () => {
        const mockStorage = {
          set: jest.fn().mockResolvedValue(),
          get: jest.fn().mockResolvedValue({ APP_CONFIG: {} })
        };
        
        window.chrome = { storage: { local: mockStorage } };
        
        appConfig.enableAutoSave(true);
        appConfig.set('POLLING_INTERVAL', 60000);
        
        // 自動保存が動作するまで待機
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(mockStorage.set).toHaveBeenCalled();
      });
    });
    
    describe('設定変更の監視', () => {
      it('設定変更時にコールバックが呼ばれる', () => {
        const callback = jest.fn();
        
        appConfig.onChange('POLLING_INTERVAL', callback);
        appConfig.set('POLLING_INTERVAL', 60000);
        
        expect(callback).toHaveBeenCalledWith(60000, 30000);
      });
      
      it('複数のコールバックを登録', () => {
        const callback1 = jest.fn();
        const callback2 = jest.fn();
        
        appConfig.onChange('DEBUG_MODE', callback1);
        appConfig.onChange('DEBUG_MODE', callback2);
        
        appConfig.set('DEBUG_MODE', true);
        
        expect(callback1).toHaveBeenCalledWith(true, false);
        expect(callback2).toHaveBeenCalledWith(true, false);
      });
      
      it('コールバックの登録解除', () => {
        const callback = jest.fn();
        
        const unsubscribe = appConfig.onChange('POLLING_INTERVAL', callback);
        unsubscribe();
        
        appConfig.set('POLLING_INTERVAL', 60000);
        
        expect(callback).not.toHaveBeenCalled();
      });
    });
    
    describe('設定の検証とエラーハンドリング', () => {
      it('無効なキーでの設定取得', () => {
        expect(() => appConfig.get('')).toThrow();
        expect(() => appConfig.get(null)).toThrow();
        expect(() => appConfig.get(undefined)).toThrow();
      });
      
      it('無効なキーでの設定更新', () => {
        expect(() => appConfig.set('', 'value')).toThrow();
        expect(() => appConfig.set(null, 'value')).toThrow();
        expect(() => appConfig.set(undefined, 'value')).toThrow();
      });
      
      it('読み取り専用設定の更新エラー', () => {
        expect(() => appConfig.set('APP_VERSION', '2.0.0')).toThrow();
        expect(() => appConfig.set('APP_NAME', 'New Name')).toThrow();
      });
      
      it('循環参照を含む設定値', () => {
        const circularObj = {};
        circularObj.self = circularObj;
        
        expect(() => appConfig.set('CUSTOM_CONFIG', circularObj)).toThrow();
      });
    });
    
    describe('設定のリセット', () => {
      it('単一設定のリセット', () => {
        appConfig.set('POLLING_INTERVAL', 60000);
        appConfig.reset('POLLING_INTERVAL');
        
        expect(appConfig.get('POLLING_INTERVAL')).toBe(30000); // デフォルト値
      });
      
      it('全設定のリセット', () => {
        appConfig.set('POLLING_INTERVAL', 60000);
        appConfig.set('MAX_RETRY_COUNT', 5);
        appConfig.set('DEBUG_MODE', true);
        
        appConfig.resetAll();
        
        expect(appConfig.get('POLLING_INTERVAL')).toBe(30000);
        expect(appConfig.get('MAX_RETRY_COUNT')).toBe(3);
        expect(appConfig.get('DEBUG_MODE')).toBe(false);
      });
    });
    
    describe('設定の一括操作', () => {
      it('設定のエクスポート', () => {
        appConfig.set('POLLING_INTERVAL', 60000);
        appConfig.set('DEBUG_MODE', true);
        
        const exported = appConfig.export();
        
        expect(exported.POLLING_INTERVAL).toBe(60000);
        expect(exported.DEBUG_MODE).toBe(true);
      });
      
      it('設定のインポート', () => {
        const importData = {
          POLLING_INTERVAL: 45000,
          MAX_RETRY_COUNT: 7,
          DEBUG_MODE: true
        };
        
        appConfig.import(importData);
        
        expect(appConfig.get('POLLING_INTERVAL')).toBe(45000);
        expect(appConfig.get('MAX_RETRY_COUNT')).toBe(7);
        expect(appConfig.get('DEBUG_MODE')).toBe(true);
      });
      
      it('無効な設定のインポート', () => {
        const invalidData = {
          POLLING_INTERVAL: 'invalid',
          NONEXISTENT_KEY: 'value'
        };
        
        expect(() => appConfig.import(invalidData)).toThrow();
      });
    });
    
    describe('設定の検索と一覧', () => {
      it('設定キーの一覧取得', () => {
        const keys = appConfig.getKeys();
        
        expect(keys).toContain('POLLING_INTERVAL');
        expect(keys).toContain('MAX_RETRY_COUNT');
        expect(keys).toContain('DEBUG_MODE');
      });
      
      it('設定値の一覧取得', () => {
        const values = appConfig.getAll();
        
        expect(values.POLLING_INTERVAL).toBe(30000);
        expect(values.MAX_RETRY_COUNT).toBe(3);
        expect(values.DEBUG_MODE).toBe(false);
      });
      
      it('設定のフィルタリング', () => {
        const debugSettings = appConfig.getByPattern(/DEBUG/);
        
        expect(debugSettings).toHaveProperty('DEBUG_MODE');
        expect(Object.keys(debugSettings)).toHaveLength(1);
      });
    });
    
    describe('設定の型安全性', () => {
      it('型チェック機能', () => {
        expect(appConfig.getType('POLLING_INTERVAL')).toBe('number');
        expect(appConfig.getType('DEBUG_MODE')).toBe('boolean');
        expect(appConfig.getType('API_BASE_URL')).toBe('string');
      });
      
      it('型変換機能', () => {
        // 文字列から数値への変換
        appConfig.set('POLLING_INTERVAL', '60000', { convertType: true });
        expect(appConfig.get('POLLING_INTERVAL')).toBe(60000);
        
        // 数値から真偽値への変換
        appConfig.set('DEBUG_MODE', 1, { convertType: true });
        expect(appConfig.get('DEBUG_MODE')).toBe(true);
      });
    });
    
    describe('パフォーマンス', () => {
      it('大量の設定変更を効率的に処理', () => {
        const startTime = Date.now();
        
        for (let i = 0; i < 1000; i++) {
          appConfig.set(`TEMP_SETTING_${i}`, i);
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(duration).toBeLessThan(1000); // 1秒以内
      });
      
      it('設定取得の高速化', () => {
        const startTime = Date.now();
        
        for (let i = 0; i < 10000; i++) {
          appConfig.get('POLLING_INTERVAL');
        }
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(duration).toBeLessThan(100); // 100ms以内
      });
    });
    
    describe('デバッグ機能', () => {
      it('設定変更ログの記録', () => {
        appConfig.enableDebug(true);
        
        appConfig.set('POLLING_INTERVAL', 60000);
        appConfig.set('DEBUG_MODE', true);
        
        const logs = appConfig.getDebugLogs();
        
        expect(logs).toHaveLength(2);
        expect(logs[0]).toContain('POLLING_INTERVAL');
        expect(logs[1]).toContain('DEBUG_MODE');
      });
      
      it('設定統計情報の取得', () => {
        appConfig.set('POLLING_INTERVAL', 60000);
        appConfig.set('DEBUG_MODE', true);
        
        const stats = appConfig.getStats();
        
        expect(stats.totalSettings).toBeGreaterThan(0);
        expect(stats.changedSettings).toBeGreaterThan(0);
      });
    });
  });
}