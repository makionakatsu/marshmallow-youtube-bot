// 重複宣言を防ぐ
const globalObj = (typeof window !== 'undefined') ? window : self;
if (typeof globalObj.VirtualScrollManager !== 'undefined') {
  // 既に定義されている場合は何もしない
} else {
  /**
   * 仮想スクロールマネージャー
   * 
   * 責任範囲:
   * - 大量データの効率的な描画
   * - スクロール位置の管理
   * - 可視領域の計算
   * - DOM要素の再利用
   * - パフォーマンス監視
   */
  class VirtualScrollManager {
  constructor(container, options = {}) {
    /**
     * コンテナ要素
     * @type {HTMLElement}
     */
    this.container = container;
    
    /**
     * 設定オプション
     * @type {Object}
     */
    this.options = {
      itemHeight: options.itemHeight || 50,
      containerHeight: options.containerHeight || 400,
      overscan: options.overscan || 3,
      throttleMs: options.throttleMs || 16,
      enableDebug: options.enableDebug || false,
      ...options
    };
    
    /**
     * データアイテム
     * @type {Array}
     */
    this.items = [];
    
    /**
     * 可視範囲のDOM要素
     * @type {HTMLElement[]}
     */
    this.visibleElements = [];
    
    /**
     * 現在のスクロール位置
     * @type {number}
     */
    this.scrollTop = 0;
    
    /**
     * 可視範囲のインデックス
     * @type {Object}
     */
    this.visibleRange = {
      start: 0,
      end: 0
    };
    
    /**
     * パフォーマンス統計
     * @type {Object}
     */
    this.stats = {
      renderCount: 0,
      lastRenderTime: 0,
      avgRenderTime: 0,
      maxRenderTime: 0,
      totalRenderTime: 0
    };
    
    /**
     * スクロールイベントのスロットル用
     * @type {number|null}
     */
    this.throttleTimer = null;
    
    /**
     * DOM要素のプール
     * @type {HTMLElement[]}
     */
    this.elementPool = [];
    
    /**
     * 仮想スクロールコンテナ
     * @type {HTMLElement}
     */
    this.virtualContainer = null;
    
    /**
     * スペーサー要素
     * @type {Object}
     */
    this.spacers = {
      top: null,
      bottom: null
    };
    
    this.init();
  }
  
  /**
   * 初期化
   */
  init() {
    this.setupVirtualContainer();
    this.setupScrollListener();
    this.setupResizeObserver();
    
    if (this.options.enableDebug) {
      this.setupDebugInfo();
    }
  }
  
  /**
   * 仮想スクロールコンテナをセットアップ
   */
  setupVirtualContainer() {
    // 元のコンテナを仮想スクロールコンテナに変換
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';
    this.container.style.height = `${this.options.containerHeight}px`;
    
    // 仮想コンテナを作成
    this.virtualContainer = document.createElement('div');
    this.virtualContainer.style.position = 'relative';
    this.virtualContainer.style.width = '100%';
    
    // スペーサーを作成
    this.spacers.top = document.createElement('div');
    this.spacers.top.style.height = '0px';
    this.spacers.top.style.width = '100%';
    
    this.spacers.bottom = document.createElement('div');
    this.spacers.bottom.style.height = '0px';
    this.spacers.bottom.style.width = '100%';
    
    // コンテナに追加
    this.container.appendChild(this.spacers.top);
    this.container.appendChild(this.virtualContainer);
    this.container.appendChild(this.spacers.bottom);
  }
  
  /**
   * スクロールリスナーをセットアップ
   */
  setupScrollListener() {
    this.container.addEventListener('scroll', () => {
      if (this.throttleTimer) {
        clearTimeout(this.throttleTimer);
      }
      
      this.throttleTimer = setTimeout(() => {
        this.handleScroll();
      }, this.options.throttleMs);
    });
  }
  
  /**
   * リサイズオブザーバーをセットアップ
   */
  setupResizeObserver() {
    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(() => {
        this.updateVisibleRange();
        this.renderVisibleItems();
      });
      
      resizeObserver.observe(this.container);
    }
  }
  
  /**
   * デバッグ情報をセットアップ
   */
  setupDebugInfo() {
    const debugInfo = document.createElement('div');
    debugInfo.style.position = 'absolute';
    debugInfo.style.top = '0px';
    debugInfo.style.right = '0px';
    debugInfo.style.background = 'rgba(0,0,0,0.8)';
    debugInfo.style.color = 'white';
    debugInfo.style.padding = '4px';
    debugInfo.style.fontSize = '10px';
    debugInfo.style.zIndex = '9999';
    debugInfo.id = 'virtual-scroll-debug';
    
    this.container.appendChild(debugInfo);
    
    // 定期的に更新
    setInterval(() => {
      this.updateDebugInfo();
    }, 100);
  }
  
  /**
   * データアイテムを設定
   * 
   * @param {Array} items データアイテム
   */
  setItems(items) {
    this.items = items || [];
    this.updateVirtualHeight();
    this.updateVisibleRange();
    this.renderVisibleItems();
  }
  
  /**
   * 単一アイテムを追加
   * 
   * @param {Object} item 追加するアイテム
   */
  addItem(item) {
    this.items.push(item);
    this.updateVirtualHeight();
    this.updateVisibleRange();
    this.renderVisibleItems();
  }
  
  /**
   * アイテムを削除
   * 
   * @param {number} index 削除するインデックス
   */
  removeItem(index) {
    if (index >= 0 && index < this.items.length) {
      this.items.splice(index, 1);
      this.updateVirtualHeight();
      this.updateVisibleRange();
      this.renderVisibleItems();
    }
  }
  
  /**
   * アイテムを更新
   * 
   * @param {number} index 更新するインデックス
   * @param {Object} newItem 新しいアイテム
   */
  updateItem(index, newItem) {
    if (index >= 0 && index < this.items.length) {
      this.items[index] = newItem;
      this.renderVisibleItems();
    }
  }
  
  /**
   * 仮想コンテナの高さを更新
   */
  updateVirtualHeight() {
    const totalHeight = this.items.length * this.options.itemHeight;
    this.virtualContainer.style.height = `${totalHeight}px`;
  }
  
  /**
   * スクロール処理
   */
  handleScroll() {
    this.scrollTop = this.container.scrollTop;
    this.updateVisibleRange();
    this.renderVisibleItems();
  }
  
  /**
   * 可視範囲を更新
   */
  updateVisibleRange() {
    const containerHeight = this.container.clientHeight;
    const itemHeight = this.options.itemHeight;
    const overscan = this.options.overscan;
    
    // 可視範囲の計算
    const visibleStart = Math.floor(this.scrollTop / itemHeight);
    const visibleEnd = Math.ceil((this.scrollTop + containerHeight) / itemHeight);
    
    // オーバースキャンを適用
    this.visibleRange.start = Math.max(0, visibleStart - overscan);
    this.visibleRange.end = Math.min(this.items.length, visibleEnd + overscan);
    
    // スペーサーの高さを更新
    this.spacers.top.style.height = `${this.visibleRange.start * itemHeight}px`;
    this.spacers.bottom.style.height = `${(this.items.length - this.visibleRange.end) * itemHeight}px`;
  }
  
  /**
   * 可視アイテムを描画
   */
  renderVisibleItems() {
    const startTime = performance.now();
    
    // 既存の要素をクリア
    this.virtualContainer.innerHTML = '';
    
    // 可視範囲のアイテムを描画
    for (let i = this.visibleRange.start; i < this.visibleRange.end; i++) {
      if (i < this.items.length) {
        const element = this.createItemElement(this.items[i], i);
        this.virtualContainer.appendChild(element);
      }
    }
    
    // パフォーマンス統計を更新
    const renderTime = performance.now() - startTime;
    this.updateRenderStats(renderTime);
    
    if (this.options.enableDebug) {
      console.log(`[VirtualScroll] Rendered ${this.visibleRange.end - this.visibleRange.start} items in ${renderTime.toFixed(2)}ms`);
    }
  }
  
  /**
   * アイテム要素を作成
   * 
   * @param {Object} item アイテムデータ
   * @param {number} index インデックス
   * @returns {HTMLElement} 作成された要素
   */
  createItemElement(item, index) {
    // 要素プールから再利用
    let element = this.elementPool.pop();
    if (!element) {
      element = document.createElement('div');
      element.className = 'virtual-scroll-item';
    }
    
    // 位置を設定
    element.style.position = 'absolute';
    element.style.top = `${index * this.options.itemHeight}px`;
    element.style.width = '100%';
    element.style.height = `${this.options.itemHeight}px`;
    element.style.boxSizing = 'border-box';
    
    // データ属性を設定
    element.dataset.index = index;
    element.dataset.itemId = item.id || index;
    
    // コンテンツを設定
    this.renderItemContent(element, item, index);
    
    return element;
  }
  
  /**
   * アイテムコンテンツを描画（オーバーライド可能）
   * 
   * @param {HTMLElement} element 要素
   * @param {Object} item アイテムデータ
   * @param {number} index インデックス
   */
  renderItemContent(element, item, index) {
    // デフォルト実装
    element.innerHTML = `
      <div style="padding: 8px; border-bottom: 1px solid #eee;">
        <div style="font-weight: bold;">${item.title || `Item ${index}`}</div>
        <div style="color: #666; font-size: 0.9em;">${item.description || item.text || ''}</div>
      </div>
    `;
  }
  
  /**
   * 描画統計を更新
   * 
   * @param {number} renderTime 描画時間
   */
  updateRenderStats(renderTime) {
    this.stats.renderCount++;
    this.stats.lastRenderTime = renderTime;
    this.stats.totalRenderTime += renderTime;
    this.stats.avgRenderTime = this.stats.totalRenderTime / this.stats.renderCount;
    this.stats.maxRenderTime = Math.max(this.stats.maxRenderTime, renderTime);
  }
  
  /**
   * デバッグ情報を更新
   */
  updateDebugInfo() {
    const debugElement = document.getElementById('virtual-scroll-debug');
    if (debugElement) {
      debugElement.innerHTML = `
        Items: ${this.items.length}<br>
        Visible: ${this.visibleRange.start}-${this.visibleRange.end}<br>
        Renders: ${this.stats.renderCount}<br>
        Avg: ${this.stats.avgRenderTime.toFixed(2)}ms<br>
        Max: ${this.stats.maxRenderTime.toFixed(2)}ms
      `;
    }
  }
  
  /**
   * 特定のインデックスにスクロール
   * 
   * @param {number} index スクロール先のインデックス
   * @param {string} behavior スクロールの動作
   */
  scrollToIndex(index, behavior = 'smooth') {
    const targetScrollTop = index * this.options.itemHeight;
    
    this.container.scrollTo({
      top: targetScrollTop,
      behavior: behavior
    });
  }
  
  /**
   * 特定のアイテムを検索
   * 
   * @param {Function} predicate 検索条件
   * @returns {number} 見つかったインデックス
   */
  findItem(predicate) {
    return this.items.findIndex(predicate);
  }
  
  /**
   * 統計情報を取得
   * 
   * @returns {Object} 統計情報
   */
  getStats() {
    return {
      ...this.stats,
      itemCount: this.items.length,
      visibleCount: this.visibleRange.end - this.visibleRange.start,
      visibleRange: { ...this.visibleRange }
    };
  }
  
  /**
   * 設定を更新
   * 
   * @param {Object} newOptions 新しい設定
   */
  updateOptions(newOptions) {
    this.options = { ...this.options, ...newOptions };
    this.updateVirtualHeight();
    this.updateVisibleRange();
    this.renderVisibleItems();
  }
  
  /**
   * リソースを解放
   */
  destroy() {
    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
    }
    
    this.container.removeEventListener('scroll', this.handleScroll);
    this.container.innerHTML = '';
    this.items = [];
    this.visibleElements = [];
    this.elementPool = [];
  }

  // CommonJS と ES6 modules の両方に対応
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = VirtualScrollManager;
  } else {
    globalObj.VirtualScrollManager = VirtualScrollManager;
  }
}