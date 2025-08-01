/**
 * AsyncMutex のテスト
 */

// テスト実行前に AsyncMutex を読み込み
document.addEventListener('DOMContentLoaded', () => {
  const script = document.createElement('script');
  script.src = '../src/shared/utils/AsyncMutex.js';
  script.onload = () => {
    runAsyncMutexTests();
  };
  document.head.appendChild(script);
});

function runAsyncMutexTests() {
  describe('AsyncMutex', () => {
    let mutex;
    
    beforeEach(() => {
      mutex = new AsyncMutex();
    });
    
    describe('基本的な機能', () => {
      it('ロックを取得できる', async () => {
        await mutex.acquire();
        expect(mutex.isLocked()).toBeTruthy();
        mutex.release();
      });
      
      it('ロックを解放できる', async () => {
        await mutex.acquire();
        mutex.release();
        expect(mutex.isLocked()).toBeFalsy();
      });
      
      it('ロックされていない状態で解放するとエラーが発生する', () => {
        expect(() => mutex.release()).toThrow();
      });
    });
    
    describe('排他制御', () => {
      it('複数のタスクが順番に実行される', async () => {
        const results = [];
        const tasks = [];
        
        for (let i = 0; i < 3; i++) {
          tasks.push((async () => {
            await mutex.acquire();
            results.push(`start-${i}`);
            await new Promise(resolve => setTimeout(resolve, 10));
            results.push(`end-${i}`);
            mutex.release();
          })());
        }
        
        await Promise.all(tasks);
        
        // 結果が正しい順序で実行されていることを確認
        expect(results).toEqual([
          'start-0', 'end-0',
          'start-1', 'end-1',
          'start-2', 'end-2'
        ]);
      });
      
      it('withLock メソッドが正しく動作する', async () => {
        const results = [];
        
        const task1 = mutex.withLock(async () => {
          results.push('task1-start');
          await new Promise(resolve => setTimeout(resolve, 10));
          results.push('task1-end');
        });
        
        const task2 = mutex.withLock(async () => {
          results.push('task2-start');
          await new Promise(resolve => setTimeout(resolve, 10));
          results.push('task2-end');
        });
        
        await Promise.all([task1, task2]);
        
        expect(results).toEqual([
          'task1-start', 'task1-end',
          'task2-start', 'task2-end'
        ]);
      });
      
      it('withLock でエラーが発生してもロックが解放される', async () => {
        try {
          await mutex.withLock(async () => {
            throw new Error('Test error');
          });
        } catch (error) {
          expect(error.message).toBe('Test error');
        }
        
        // ロックが解放されていることを確認
        expect(mutex.isLocked()).toBeFalsy();
      });
    });
    
    describe('統計情報', () => {
      it('統計情報が正しく更新される', async () => {
        await mutex.acquire();
        mutex.release();
        
        const stats = mutex.getStats();
        expect(stats.acquireCount).toBe(1);
        expect(stats.releaseCount).toBe(1);
      });
      
      it('キューサイズが正しく記録される', async () => {
        const task1 = mutex.acquire();
        const task2 = mutex.acquire();
        const task3 = mutex.acquire();
        
        // 最初のタスクが実行される
        await task1;
        
        // 2つのタスクがキューで待機
        expect(mutex.getQueueSize()).toBe(2);
        
        mutex.release();
        await task2;
        
        expect(mutex.getQueueSize()).toBe(1);
        
        mutex.release();
        await task3;
        
        expect(mutex.getQueueSize()).toBe(0);
        
        mutex.release();
        
        const stats = mutex.getStats();
        expect(stats.maxQueueSize).toBe(2);
      });
    });
    
    describe('デバッグ機能', () => {
      it('デバッグモードを有効にできる', () => {
        mutex.setDebug(true);
        expect(mutex.debug).toBeTruthy();
      });
      
      it('統計情報をリセットできる', () => {
        if (typeof process === 'undefined') {
          // ブラウザ環境でのテスト
          process = { env: { NODE_ENV: 'test' } };
        }
        
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'test';
        
        try {
          mutex.reset();
          const stats = mutex.getStats();
          expect(stats.acquireCount).toBe(0);
          expect(stats.releaseCount).toBe(0);
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });
    });
    
    describe('エラーハンドリング', () => {
      it('本番環境では reset() が無効', () => {
        if (typeof process === 'undefined') {
          process = { env: { NODE_ENV: 'production' } };
        }
        
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        
        try {
          expect(() => mutex.reset()).toThrow();
        } finally {
          process.env.NODE_ENV = originalEnv;
        }
      });
    });
    
    describe('パフォーマンス', () => {
      it('大量の同時アクセスでも正常に動作する', async () => {
        const taskCount = 100;
        const results = [];
        const tasks = [];
        
        for (let i = 0; i < taskCount; i++) {
          tasks.push(mutex.withLock(async () => {
            results.push(i);
          }));
        }
        
        await Promise.all(tasks);
        
        // 結果が正しい順序で追加されていることを確認
        expect(results).toHaveLength(taskCount);
        
        // 重複がないことを確認
        const uniqueResults = [...new Set(results)];
        expect(uniqueResults).toHaveLength(taskCount);
      });
      
      it('長時間の処理でも正常に動作する', async () => {
        const startTime = Date.now();
        
        await mutex.withLock(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(duration).toBeGreaterThan(90); // 最低でも100ms近く
      });
    });
  });
}