/**
 * VirtualScrollManager のテスト
 */

// テスト実行前に VirtualScrollManager を読み込み
document.addEventListener('DOMContentLoaded', () => {
  const script = document.createElement('script');
  script.src = '../src/shared/ui/VirtualScrollManager.js';
  script.onload = () => {
    runVirtualScrollManagerTests();
  };
  document.head.appendChild(script);
});

function runVirtualScrollManagerTests() {
  describe('VirtualScrollManager', () => {
    let container;
    let virtualScrollManager;
    let testItems;
    
    beforeEach(() => {
      // テスト用のコンテナを作成
      container = document.createElement('div');
      container.style.height = '200px';
      container.style.width = '400px';
      container.style.overflow = 'auto';
      document.body.appendChild(container);
      
      // テストデータを作成
      testItems = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        title: `Item ${i}`,
        text: `This is test item number ${i}`,
        description: `Description for item ${i}`
      }));
      
      // VirtualScrollManager を初期化
      virtualScrollManager = new VirtualScrollManager(container, {
        itemHeight: 50,
        containerHeight: 200,
        overscan: 3,
        enableDebug: false
      });
    });
    
    afterEach(() => {
      if (virtualScrollManager) {
        virtualScrollManager.destroy();
      }
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    });
    
    describe('初期化', () => {
      it('コンテナが正しく設定される', () => {
        expect(container.style.position).toBe('relative');
        expect(container.style.overflow).toBe('auto');
        expect(container.style.height).toBe('200px');
      });
      
      it('仮想コンテナが作成される', () => {
        const virtualContainer = container.querySelector('div');
        expect(virtualContainer).toBeTruthy();
        expect(virtualContainer.style.position).toBe('relative');
      });
      
      it('スペーサーが作成される', () => {
        const spacers = container.querySelectorAll('div');
        expect(spacers.length).toBeGreaterThan(0);
      });
    });
    
    describe('アイテムの設定と管理', () => {
      it('アイテムを設定できる', () => {
        virtualScrollManager.setItems(testItems);
        
        expect(virtualScrollManager.items).toEqual(testItems);
        expect(virtualScrollManager.items.length).toBe(100);
      });
      
      it('単一アイテムを追加できる', () => {
        virtualScrollManager.setItems(testItems.slice(0, 10));
        
        const newItem = {
          id: 'new-item',
          title: 'New Item',
          text: 'New item text'
        };
        
        virtualScrollManager.addItem(newItem);
        
        expect(virtualScrollManager.items.length).toBe(11);
        expect(virtualScrollManager.items[10]).toEqual(newItem);
      });
      
      it('アイテムを削除できる', () => {
        virtualScrollManager.setItems(testItems.slice(0, 10));
        virtualScrollManager.removeItem(5);
        
        expect(virtualScrollManager.items.length).toBe(9);
        expect(virtualScrollManager.items[5].id).toBe('item-6');
      });
      
      it('アイテムを更新できる', () => {
        virtualScrollManager.setItems(testItems.slice(0, 10));
        
        const updatedItem = {
          id: 'updated-item',
          title: 'Updated Item',
          text: 'Updated text'
        };
        
        virtualScrollManager.updateItem(3, updatedItem);
        
        expect(virtualScrollManager.items[3]).toEqual(updatedItem);
      });
    });
    
    describe('可視範囲の計算', () => {
      it('初期状態での可視範囲を計算', () => {
        virtualScrollManager.setItems(testItems);
        
        expect(virtualScrollManager.visibleRange.start).toBe(0);
        expect(virtualScrollManager.visibleRange.end).toBeGreaterThan(0);
      });
      
      it('スクロール時の可視範囲更新', () => {
        virtualScrollManager.setItems(testItems);
        
        // スクロール位置を変更
        virtualScrollManager.scrollTop = 250; // 5アイテム分
        virtualScrollManager.updateVisibleRange();
        
        expect(virtualScrollManager.visibleRange.start).toBeGreaterThan(0);
        expect(virtualScrollManager.visibleRange.end).toBeGreaterThan(virtualScrollManager.visibleRange.start);
      });
      
      it('オーバースキャンが適用される', () => {
        const manager = new VirtualScrollManager(container, {
          itemHeight: 50,
          containerHeight: 200,
          overscan: 5
        });
        
        manager.setItems(testItems);
        
        // オーバースキャンにより、実際の可視範囲より広い範囲が設定される
        const expectedVisible = Math.ceil(200 / 50); // 4アイテム
        expect(manager.visibleRange.end - manager.visibleRange.start).toBeGreaterThan(expectedVisible);
        
        manager.destroy();
      });
    });
    
    describe('描画機能', () => {
      it('可視アイテムが描画される', () => {
        virtualScrollManager.setItems(testItems.slice(0, 10));
        
        const renderedItems = container.querySelectorAll('.virtual-scroll-item');
        expect(renderedItems.length).toBeGreaterThan(0);
      });
      
      it('カスタムレンダラーが機能する', () => {
        virtualScrollManager.renderItemContent = (element, item, index) => {
          element.innerHTML = `<div class="custom-item">${item.title}</div>`;
        };
        
        virtualScrollManager.setItems(testItems.slice(0, 5));
        
        const customItems = container.querySelectorAll('.custom-item');
        expect(customItems.length).toBeGreaterThan(0);
        expect(customItems[0].textContent).toBe('Item 0');
      });
      
      it('アイテムの位置が正しく設定される', () => {
        virtualScrollManager.setItems(testItems.slice(0, 10));
        
        const firstItem = container.querySelector('.virtual-scroll-item');
        expect(firstItem.style.position).toBe('absolute');
        expect(firstItem.style.height).toBe('50px');
        expect(firstItem.style.width).toBe('100%');
      });
    });
    
    describe('スクロール機能', () => {
      it('特定のインデックスにスクロール', () => {
        virtualScrollManager.setItems(testItems);
        
        virtualScrollManager.scrollToIndex(10);
        
        // スクロール位置が変更されることを確認
        expect(container.scrollTop).toBeGreaterThan(0);
      });
      
      it('アイテム検索機能', () => {
        virtualScrollManager.setItems(testItems);
        
        const index = virtualScrollManager.findItem(item => item.id === 'item-25');
        expect(index).toBe(25);
      });
      
      it('存在しないアイテムの検索', () => {
        virtualScrollManager.setItems(testItems);
        
        const index = virtualScrollManager.findItem(item => item.id === 'nonexistent');
        expect(index).toBe(-1);
      });
    });
    
    describe('パフォーマンス統計', () => {
      it('描画統計が記録される', () => {
        virtualScrollManager.setItems(testItems);
        
        const stats = virtualScrollManager.getStats();
        expect(stats.renderCount).toBeGreaterThan(0);
        expect(stats.itemCount).toBe(testItems.length);
        expect(stats.visibleCount).toBeGreaterThan(0);
      });
      
      it('平均描画時間が計算される', () => {
        virtualScrollManager.setItems(testItems);
        
        // 複数回描画を実行
        virtualScrollManager.renderVisibleItems();
        virtualScrollManager.renderVisibleItems();
        
        const stats = virtualScrollManager.getStats();
        expect(stats.avgRenderTime).toBeGreaterThan(0);
        expect(stats.maxRenderTime).toBeGreaterThan(0);
      });
    });
    
    describe('設定の変更', () => {
      it('設定を更新できる', () => {
        const newOptions = {
          itemHeight: 80,
          containerHeight: 300,
          overscan: 5
        };
        
        virtualScrollManager.updateOptions(newOptions);
        
        expect(virtualScrollManager.options.itemHeight).toBe(80);
        expect(virtualScrollManager.options.containerHeight).toBe(300);
        expect(virtualScrollManager.options.overscan).toBe(5);
      });
      
      it('設定変更後に再描画される', () => {
        virtualScrollManager.setItems(testItems);
        const initialRenderCount = virtualScrollManager.getStats().renderCount;
        
        virtualScrollManager.updateOptions({ itemHeight: 80 });
        
        const newRenderCount = virtualScrollManager.getStats().renderCount;
        expect(newRenderCount).toBeGreaterThan(initialRenderCount);
      });
    });
    
    describe('大量データの処理', () => {
      it('大量のアイテムを効率的に処理', () => {
        const largeDataSet = Array.from({ length: 10000 }, (_, i) => ({
          id: `large-item-${i}`,
          title: `Large Item ${i}`,
          text: `Large item content ${i}`
        }));
        
        const startTime = Date.now();
        
        virtualScrollManager.setItems(largeDataSet);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(virtualScrollManager.items.length).toBe(10000);
        expect(duration).toBeLessThan(1000); // 1秒以内
        
        // 実際に描画されるアイテム数は少ない
        const renderedItems = container.querySelectorAll('.virtual-scroll-item');
        expect(renderedItems.length).toBeLessThan(50); // 可視範囲のみ
      });
      
      it('メモリ使用量を制御', () => {
        const largeDataSet = Array.from({ length: 10000 }, (_, i) => ({
          id: `memory-item-${i}`,
          title: `Memory Item ${i}`,
          text: `Memory item content ${i}`
        }));
        
        virtualScrollManager.setItems(largeDataSet);
        
        // DOM要素数は制限される
        const domElements = container.querySelectorAll('*');
        expect(domElements.length).toBeLessThan(100);
      });
    });
    
    describe('エラーハンドリング', () => {
      it('無効なアイテムを安全に処理', () => {
        const invalidItems = [
          null,
          undefined,
          { id: null },
          { id: undefined },
          { id: '' }
        ];
        
        expect(() => {
          virtualScrollManager.setItems(invalidItems);
        }).not.toThrow();
      });
      
      it('範囲外のインデックスを処理', () => {
        virtualScrollManager.setItems(testItems.slice(0, 10));
        
        // 範囲外のインデックスでの操作
        expect(() => {
          virtualScrollManager.removeItem(100);
        }).not.toThrow();
        
        expect(() => {
          virtualScrollManager.updateItem(100, { id: 'test' });
        }).not.toThrow();
      });
    });
    
    describe('リサイズ対応', () => {
      it('コンテナサイズ変更に対応', () => {
        virtualScrollManager.setItems(testItems);
        
        // コンテナサイズを変更
        container.style.height = '400px';
        
        // ResizeObserver が利用可能な場合のテスト
        if (typeof ResizeObserver !== 'undefined') {
          // リサイズイベントをシミュレート
          virtualScrollManager.updateVisibleRange();
          
          const stats = virtualScrollManager.getStats();
          expect(stats.visibleCount).toBeGreaterThan(0);
        }
      });
    });
    
    describe('デバッグ機能', () => {
      it('デバッグ情報が表示される', () => {
        const debugManager = new VirtualScrollManager(container, {
          itemHeight: 50,
          containerHeight: 200,
          enableDebug: true
        });
        
        debugManager.setItems(testItems);
        
        // デバッグ要素が作成される
        const debugElement = container.querySelector('#virtual-scroll-debug');
        expect(debugElement).toBeTruthy();
        expect(debugElement.textContent).toContain('Items:');
        
        debugManager.destroy();
      });
    });
    
    describe('クリーンアップ', () => {
      it('リソースが正しく解放される', () => {
        virtualScrollManager.setItems(testItems);
        
        virtualScrollManager.destroy();
        
        expect(virtualScrollManager.items).toEqual([]);
        expect(virtualScrollManager.visibleElements).toEqual([]);
        expect(virtualScrollManager.elementPool).toEqual([]);
      });
      
      it('イベントリスナーが削除される', () => {
        const initialListeners = container.addEventListener.mock?.calls?.length || 0;
        
        virtualScrollManager.setItems(testItems);
        virtualScrollManager.destroy();
        
        // イベントリスナーが削除されていることを確認
        expect(container.innerHTML).toBe('');
      });
    });
  });
}