# TypeScript Migration Guide

## 概要

このドキュメントは Marshmallow2YouTube プロジェクトの TypeScript 移行計画を説明します。

## 移行戦略

### 段階的移行アプローチ

1. **Phase 1: 基盤整備** ✅
   - TypeScript 設定ファイルの作成
   - 型定義ファイルの整備
   - 開発環境の構築

2. **Phase 2: 共有ユーティリティの移行**
   - `src/shared/utils/` 配下のファイル
   - `src/shared/config/` 配下のファイル
   - `src/shared/errors/` 配下のファイル
   - `src/shared/security/` 配下のファイル
   - `src/shared/ui/` 配下のファイル

3. **Phase 3: メインファイルの移行**
   - `background.service_worker.js` → `background.service_worker.ts`
   - `popup.js` → `popup.ts`

4. **Phase 4: 設定とマニフェストの最適化**
   - `manifest.json` の TypeScript 対応
   - ビルドプロセスの最適化

## 設定ファイル

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ES2020",
    "moduleResolution": "node",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "baseUrl": "./",
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["./src/shared/*"],
      "@utils/*": ["./src/shared/utils/*"],
      "@config/*": ["./src/shared/config/*"],
      "@errors/*": ["./src/shared/errors/*"],
      "@security/*": ["./src/shared/security/*"],
      "@ui/*": ["./src/shared/ui/*"]
    }
  }
}
```

### package.json

主要な依存関係:
- `typescript`: TypeScript コンパイラ
- `@types/chrome`: Chrome Extension API の型定義
- `@typescript-eslint/eslint-plugin`: TypeScript 用 ESLint プラグイン
- `@typescript-eslint/parser`: TypeScript パーサー

## 型定義

### Chrome Extension API (`src/types/chrome.d.ts`)

Chrome Extension API の完全な型定義を提供:
- `chrome.storage`
- `chrome.runtime`
- `chrome.action`
- `chrome.tabs`
- `chrome.notifications`
- `chrome.alarms`

### グローバル型定義 (`src/types/global.d.ts`)

アプリケーション全体で使用される型定義:
- `YouTubeVideo`
- `MarshmallowQuestion`
- `AppSettings`
- `ErrorInfo`
- `ValidationResult`
- `VirtualScrollItem`

## 移行手順

### Step 1: 開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# TypeScript の型チェック
npm run type-check

# ESLint による静的解析
npm run lint
```

### Step 2: 型チェックの実行

```bash
# 型エラーの確認
npm run build

# ウォッチモードでの開発
npm run dev
```

### Step 3: 段階的な移行

1. **ファイル名の変更**
   ```bash
   mv src/shared/utils/AsyncMutex.js src/shared/utils/AsyncMutex.ts
   ```

2. **型注釈の追加**
   ```typescript
   // Before (JavaScript)
   class AsyncMutex {
     constructor() {
       this.locked = false;
       this.queue = [];
     }
   }

   // After (TypeScript)
   class AsyncMutex {
     private locked: boolean = false;
     private queue: Array<() => void> = [];

     constructor() {
       this.locked = false;
       this.queue = [];
     }
   }
   ```

3. **インターフェースの定義**
   ```typescript
   interface MutexOptions {
     debug?: boolean;
     timeout?: number;
   }

   interface MutexStats {
     acquireCount: number;
     releaseCount: number;
     maxQueueSize: number;
   }
   ```

### Step 4: エラーの修正

一般的なエラーと修正方法:

1. **型エラー**
   ```typescript
   // エラー: Property 'foo' does not exist on type 'object'
   const obj: object = {};
   obj.foo = 'bar'; // ❌

   // 修正
   const obj: { foo?: string } = {};
   obj.foo = 'bar'; // ✅
   ```

2. **null/undefined チェック**
   ```typescript
   // エラー: Object is possibly 'undefined'
   const element = document.getElementById('myId');
   element.addEventListener('click', handler); // ❌

   // 修正
   const element = document.getElementById('myId');
   element?.addEventListener('click', handler); // ✅
   ```

3. **Promise の型指定**
   ```typescript
   // エラー: Promise<unknown>
   async function fetchData() {
     return await fetch('/api/data');
   }

   // 修正
   async function fetchData(): Promise<Response> {
     return await fetch('/api/data');
   }
   ```

## 利点

### 1. 型安全性
- コンパイル時にエラーを検出
- IDE での強力なオートコンプリート
- リファクタリングの安全性向上

### 2. 開発効率
- 型推論による開発速度向上
- ドキュメントとしての型定義
- チーム開発での品質向上

### 3. 保守性
- 大規模なコードベースでの変更追跡
- 型制約による設計の明確化
- 長期的な保守性の向上

## 注意事項

### 1. 既存機能への影響

- TypeScript 移行中も JavaScript ファイルは動作する
- 段階的移行により機能停止のリスクを最小化
- 型チェックは開発時のみ実行

### 2. Chrome Extension の制約

- Manifest V3 の制約に準拠
- Service Worker での動作保証
- CSP (Content Security Policy) への対応

### 3. パフォーマンス

- TypeScript コンパイル時間の考慮
- バンドルサイズの最適化
- 実行時パフォーマンスへの影響なし

## チェックリスト

### 準備段階
- [x] TypeScript 設定ファイルの作成
- [x] 型定義ファイルの整備
- [x] ESLint 設定の構成
- [x] package.json の更新

### 移行段階
- [ ] AsyncMutex の移行
- [ ] OptimizedStorageService の移行
- [ ] UnifiedErrorHandler の移行
- [ ] InputValidator の移行
- [ ] VirtualScrollManager の移行
- [ ] AppConfig の移行
- [ ] background.service_worker の移行
- [ ] popup.js の移行

### 検証段階
- [ ] 型チェックの実行
- [ ] ESLint チェックの実行
- [ ] 全機能の動作確認
- [ ] テストの実行

## トラブルシューティング

### よくある問題と解決方法

1. **Chrome API の型エラー**
   ```bash
   # 型定義の更新
   npm install --save-dev @types/chrome@latest
   ```

2. **モジュール解決エラー**
   ```typescript
   // tsconfig.json のパス設定を確認
   "baseUrl": "./",
   "paths": {
     "@/*": ["./src/*"]
   }
   ```

3. **ESLint エラー**
   ```bash
   # 自動修正
   npm run lint -- --fix
   ```

## リソース

- [TypeScript 公式ドキュメント](https://www.typescriptlang.org/docs/)
- [Chrome Extension API 型定義](https://www.npmjs.com/package/@types/chrome)
- [ESLint TypeScript ルール](https://typescript-eslint.io/rules/)
- [Manifest V3 ドキュメント](https://developer.chrome.com/docs/extensions/mv3/)

---

このガイドに従って段階的に TypeScript 移行を進めることで、安全かつ効率的に型安全なコードベースを構築できます。