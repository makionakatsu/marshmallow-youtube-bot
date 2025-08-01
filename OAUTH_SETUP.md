# 🔐 OAuth認証設定ガイド

## 🚨 現在のエラー
```
エラー 400: invalid_request
Marshmallow 2 YouTube Bot のリクエストは無効です
```

## 📋 OAuth Client ID 新規作成手順

### 1. **Google Cloud Console での設定**

#### Step 1: Google Cloud Console にアクセス
1. https://console.cloud.google.com/ を開く
2. 既存のプロジェクトを選択 または 新規作成

#### Step 2: YouTube Data API v3 を有効化
1. **APIとサービス** → **ライブラリ**
2. **YouTube Data API v3** を検索
3. **有効にする** をクリック

#### Step 3: OAuth2 クライアントIDを作成
1. **APIとサービス** → **認証情報**
2. **+認証情報を作成** → **OAuth クライアント ID**
3. **アプリケーションの種類**: `Chrome 拡張機能`
4. **名前**: `Marshmallow to YouTube Bot`
5. **アプリケーション ID**: Chrome拡張機能のIDを入力

### 2. **Chrome拡張機能ID の取得**

#### 開発者モードで拡張機能IDを確認
1. `chrome://extensions/` を開く
2. **デベロッパーモード** を有効化
3. `Marshmallow to YouTube Bot` のIDをコピー
   - 例: `abcdefghijklmnopqrstuvwxyz123456`

### 3. **OAuth設定の更新**

#### manifest.json の更新
```json
{
  "oauth2": {
    "client_id": "新しいClientID.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/youtube.force-ssl"
    ]
  }
}
```

### 4. **OAuth検証センター要件**

#### 必要なドキュメント
- ✅ **プライバシーポリシー**: 既に作成済み
- ✅ **利用規約**: 既に作成済み
- ✅ **ホームページ**: 既に作成済み

#### スコープの説明
```
https://www.googleapis.com/auth/youtube.force-ssl
→ YouTube Live Chatにメッセージを投稿するために必要
```

### 5. **緊急対応: テストモード**

#### 一時的な回避策
```javascript
// background.service_worker.js で
const TEST_MODE = true; // 一時的にtrueに設定

if (TEST_MODE) {
  console.log('🧪 TEST MODE: OAuth認証をスキップ');
  // テスト用の処理
}
```

### 6. **新しいClient IDの設定例**

#### 正しい設定
```json
{
  "manifest_version": 3,
  "name": "Marshmallow to YouTube Bot",
  "version": "2.0",
  "oauth2": {
    "client_id": "123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/youtube.force-ssl"
    ]
  }
}
```

## 🔧 **即座の対応手順**

### **今すぐ試せる方法:**

1. **拡張機能のリロード**
   ```
   chrome://extensions/ → 拡張機能の「再読み込み」
   ```

2. **OAuth トークンのクリア**
   ```javascript
   // 開発者ツールのコンソールで実行
   chrome.identity.clearAllCachedAuthTokens(() => {
     console.log('OAuth tokens cleared');
   });
   ```

3. **新しいOAuth認証**
   - 拡張機能の設定から再認証

### **根本的な解決:**

1. **新しいGoogle Cloud プロジェクト作成**
2. **YouTube Data API v3 有効化**
3. **新しいOAuth Client ID 作成**
4. **manifest.json 更新**
5. **拡張機能の再読み込み**

## 📞 **サポート情報**

OAuth認証の問題は以下の手順で解決できます：

1. **既存のClient IDが無効** → 新規作成
2. **スコープの問題** → 正しいスコープを設定
3. **拡張機能IDの不一致** → 正しいIDを設定

---

**💡 重要**: OAuth Client IDの作成には時間がかかる場合があります。緊急時はテストモードを活用してください。