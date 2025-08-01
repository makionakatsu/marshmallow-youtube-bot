/**
 * UnifiedErrorHandler のテスト
 */

// テスト実行前に UnifiedErrorHandler を読み込み
document.addEventListener('DOMContentLoaded', () => {
  const script = document.createElement('script');
  script.src = '../src/shared/errors/UnifiedErrorHandler.js';
  script.onload = () => {
    runUnifiedErrorHandlerTests();
  };
  document.head.appendChild(script);
});

function runUnifiedErrorHandlerTests() {
  describe('UnifiedErrorHandler', () => {
    let errorHandler;
    
    beforeEach(() => {
      errorHandler = new UnifiedErrorHandler();
    });
    
    describe('基本的なエラーハンドリング', () => {
      it('エラーを正しく分析できる', async () => {
        const error = new Error('Test error');
        error.name = 'TestError';
        
        const result = await errorHandler.handleError(error, 'test-context');
        
        expect(result.errorType).toBe('TestError');
        expect(result.message).toBe('Test error');
        expect(result.context).toBe('test-context');
      });
      
      it('API エラーを正しく分類できる', async () => {
        const error = new Error('API quota exceeded');
        error.name = 'QuotaError';
        
        const result = await errorHandler.handleError(error, 'api');
        
        expect(result.errorType).toBe('QuotaError');
        expect(result.severity).toBe('high');
        expect(result.isRetryable).toBe(true);
      });
      
      it('ネットワークエラーを正しく処理できる', async () => {
        const error = new Error('Network error');
        error.name = 'NetworkError';
        
        const result = await errorHandler.handleError(error, 'network');
        
        expect(result.errorType).toBe('NetworkError');
        expect(result.isRetryable).toBe(true);
      });
      
      it('認証エラーを正しく処理できる', async () => {
        const error = new Error('Authentication failed');
        error.name = 'AuthenticationError';
        
        const result = await errorHandler.handleError(error, 'auth');
        
        expect(result.errorType).toBe('AuthenticationError');
        expect(result.severity).toBe('high');
        expect(result.isRetryable).toBe(false);
      });
    });
    
    describe('リトライ機能', () => {
      it('リトライ可能なエラーでリトライを実行', async () => {
        const mockOperation = jest.fn()
          .mockRejectedValueOnce(new Error('Temporary error'))
          .mockResolvedValueOnce('success');
        
        const result = await errorHandler.handleErrorWithRetry(
          mockOperation, 
          'test-context', 
          { maxRetries: 3 }
        );
        
        expect(result).toBe('success');
        expect(mockOperation).toHaveBeenCalledTimes(2);
      });
      
      it('最大リトライ回数を超えた場合は失敗', async () => {
        const mockOperation = jest.fn()
          .mockRejectedValue(new Error('Persistent error'));
        
        try {
          await errorHandler.handleErrorWithRetry(
            mockOperation, 
            'test-context', 
            { maxRetries: 2 }
          );
        } catch (error) {
          expect(error.message).toBe('Persistent error');
          expect(mockOperation).toHaveBeenCalledTimes(3); // 初回 + 2回のリトライ
        }
      });
      
      it('指数バックオフでリトライ間隔を調整', async () => {
        const mockOperation = jest.fn()
          .mockRejectedValueOnce(new Error('Error 1'))
          .mockRejectedValueOnce(new Error('Error 2'))
          .mockResolvedValueOnce('success');
        
        const startTime = Date.now();
        
        const result = await errorHandler.handleErrorWithRetry(
          mockOperation, 
          'test-context', 
          { maxRetries: 3, baseDelay: 10 }
        );
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(result).toBe('success');
        expect(duration).toBeGreaterThan(30); // 最低でも10 + 20 = 30ms
      });
    });
    
    describe('エラー分類', () => {
      it('YouTube API エラーを分類できる', () => {
        const error = new Error('The request cannot be completed because you have exceeded your quota.');
        error.name = 'QuotaExceededError';
        
        const errorInfo = errorHandler.analyzeError(error, 'youtube-api');
        
        expect(errorInfo.errorType).toBe('QuotaExceededError');
        expect(errorInfo.severity).toBe('high');
        expect(errorInfo.isRetryable).toBe(true);
      });
      
      it('Chrome Storage エラーを分類できる', () => {
        const error = new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
        error.name = 'StorageQuotaError';
        
        const errorInfo = errorHandler.analyzeError(error, 'chrome-storage');
        
        expect(errorInfo.errorType).toBe('StorageQuotaError');
        expect(errorInfo.severity).toBe('medium');
        expect(errorInfo.isRetryable).toBe(false);
      });
      
      it('不明なエラーを汎用的に処理', () => {
        const error = new Error('Unknown error');
        
        const errorInfo = errorHandler.analyzeError(error, 'unknown');
        
        expect(errorInfo.errorType).toBe('UnknownError');
        expect(errorInfo.severity).toBe('medium');
        expect(errorInfo.isRetryable).toBe(false);
      });
    });
    
    describe('自動復旧機能', () => {
      it('API キー無効時の復旧ストラテジー', async () => {
        const error = new Error('Invalid API key');
        error.name = 'InvalidApiKeyError';
        
        // Chrome Storage のモック
        const mockStorage = {
          get: jest.fn().mockResolvedValue({ YOUTUBE_API_KEY: 'invalid-key' }),
          set: jest.fn().mockResolvedValue(),
          remove: jest.fn().mockResolvedValue()
        };
        
        window.chrome = { storage: { local: mockStorage } };
        
        const result = await errorHandler.handleError(error, 'api');
        
        expect(result.recoveryAction).toBe('clear_api_key');
        expect(result.userMessage).toContain('API');
      });
      
      it('ストレージ容量不足時の復旧ストラテジー', async () => {
        const error = new Error('Storage quota exceeded');
        error.name = 'StorageQuotaError';
        
        const result = await errorHandler.handleError(error, 'storage');
        
        expect(result.recoveryAction).toBe('clear_old_data');
        expect(result.userMessage).toContain('容量');
      });
    });
    
    describe('統計情報', () => {
      it('エラー統計が正しく記録される', async () => {
        const error1 = new Error('Error 1');
        error1.name = 'TestError1';
        
        const error2 = new Error('Error 2');
        error2.name = 'TestError2';
        
        await errorHandler.handleError(error1, 'test');
        await errorHandler.handleError(error2, 'test');
        
        const stats = errorHandler.getStats();
        expect(stats.totalErrors).toBe(2);
        expect(stats.errorsByType.TestError1).toBe(1);
        expect(stats.errorsByType.TestError2).toBe(1);
      });
      
      it('エラー率が計算される', async () => {
        const error = new Error('Test error');
        
        await errorHandler.handleError(error, 'test');
        
        const stats = errorHandler.getStats();
        expect(stats.errorRate).toContain('%');
      });
    });
    
    describe('設定変更', () => {
      it('設定を更新できる', () => {
        const newConfig = {
          maxRetries: 5,
          baseDelay: 200,
          enableDebug: true
        };
        
        errorHandler.updateConfig(newConfig);
        
        expect(errorHandler.config.maxRetries).toBe(5);
        expect(errorHandler.config.baseDelay).toBe(200);
        expect(errorHandler.config.enableDebug).toBe(true);
      });
      
      it('デバッグモードを有効にできる', () => {
        errorHandler.updateConfig({ enableDebug: true });
        expect(errorHandler.config.enableDebug).toBeTruthy();
      });
    });
    
    describe('コンテキスト別処理', () => {
      it('YouTube API コンテキストでの特別な処理', async () => {
        const error = new Error('Quota exceeded');
        error.name = 'QuotaError';
        
        const result = await errorHandler.handleError(error, 'youtube-api');
        
        expect(result.context).toBe('youtube-api');
        expect(result.userMessage).toContain('YouTube');
      });
      
      it('マシュマロ API コンテキストでの特別な処理', async () => {
        const error = new Error('Connection failed');
        error.name = 'ConnectionError';
        
        const result = await errorHandler.handleError(error, 'marshmallow-api');
        
        expect(result.context).toBe('marshmallow-api');
        expect(result.userMessage).toContain('マシュマロ');
      });
    });
    
    describe('エラー通知', () => {
      it('重大なエラーで通知が送信される', async () => {
        const mockNotifications = {
          create: jest.fn()
        };
        
        window.chrome = { notifications: mockNotifications };
        
        const error = new Error('Critical error');
        error.name = 'CriticalError';
        
        await errorHandler.handleError(error, 'critical', { notify: true });
        
        expect(mockNotifications.create).toHaveBeenCalled();
      });
      
      it('通知無効時は通知が送信されない', async () => {
        const mockNotifications = {
          create: jest.fn()
        };
        
        window.chrome = { notifications: mockNotifications };
        
        const error = new Error('Error');
        
        await errorHandler.handleError(error, 'test', { notify: false });
        
        expect(mockNotifications.create).not.toHaveBeenCalled();
      });
    });
    
    describe('パフォーマンス', () => {
      it('大量のエラーを効率的に処理', async () => {
        const errors = Array.from({ length: 100 }, (_, i) => {
          const error = new Error(`Error ${i}`);
          error.name = 'BulkError';
          return error;
        });
        
        const startTime = Date.now();
        
        const results = await Promise.all(
          errors.map(error => errorHandler.handleError(error, 'bulk-test'))
        );
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(results).toHaveLength(100);
        expect(duration).toBeLessThan(1000); // 1秒以内
      });
      
      it('メモリリークなしでエラー処理', async () => {
        const initialStats = errorHandler.getStats();
        
        // 大量のエラーを処理
        for (let i = 0; i < 1000; i++) {
          const error = new Error(`Error ${i}`);
          await errorHandler.handleError(error, 'memory-test');
        }
        
        const finalStats = errorHandler.getStats();
        
        expect(finalStats.totalErrors).toBe(initialStats.totalErrors + 1000);
      });
    });
  });
}