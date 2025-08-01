# 🚨 OAuth認証 緊急修復ガイド

## 現在の状況
- OAuth認証が失敗している
- YouTube Live Chatにコメント投稿ができない
- manifest.jsonのclient_idがプレースホルダー状態

## 🔧 即座に実行する手順

### Step 1: Chrome拡張機能IDの確認
1. `chrome://extensions/` を開く
2. **デベロッパーモード**を有効化
3. `Marshmallow to YouTube Bot`のIDをコピー
   ```
   例: abcdefghijklmnopqrstuvwxyz123456
   ```

### Step 2: Google Cloud Consoleでの設定
1. https://console.cloud.google.com/ を開く
2. **既存のプロジェクトを選択** または **新規作成**

#### 🔴 重要: YouTube Data API v3の有効化
1. **APIとサービス** → **ライブラリ**
2. **YouTube Data API v3** を検索
3. **有効にする** をクリック

#### 🔴 OAuth Client IDの作成
1. **APIとサービス** → **認証情報**
2. **+認証情報を作成** → **OAuth クライアント ID**
3. **アプリケーションの種類**: `Chrome 拡張機能`
4. **名前**: `Marshmallow to YouTube Bot`
5. **アプリケーション ID**: Step 1で取得したIDを入力

### Step 3: 生成されたClient IDの取得
作成後、以下のような形式のClient IDが生成されます：
```
123456789012-abcdefghijklmnopqrstuvwxyz123456.apps.googleusercontent.com
```

### Step 4: manifest.jsonの更新
```json
{
  "oauth2": {
    "client_id": "【ここに実際のClient IDを貼り付け】",
    "scopes": [
      "https://www.googleapis.com/auth/youtube.force-ssl"
    ]
  }
}
```

### Step 5: 拡張機能の再読み込み
1. `chrome://extensions/` で拡張機能を再読み込み
2. 既存のOAuthトークンをクリア（必要に応じて）

## 🧪 テスト手順

### 1. 基本接続テスト
```javascript
// 拡張機能のコンソールで実行
chrome.identity.getAuthToken({interactive: true}, function(token) {
  console.log('OAuth Token:', token);
  if (chrome.runtime.lastError) {
    console.error('OAuth Error:', chrome.runtime.lastError.message);
  }
});
```

### 2. YouTube API接続テスト
```javascript
// YouTube APIの接続確認
fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
  headers: {
    'Authorization': 'Bearer ' + token
  }
}).then(response => response.json()).then(data => {
  console.log('YouTube API Response:', data);
});
```

## ⚠️ よくある問題と解決法

### 問題1: "Error 400: invalid_request"
**原因**: Client IDとChrome拡張機能IDの不一致
**解決**: Google Cloud ConsoleでアプリケーションIDを正しく設定

### 問題2: "Error 403: access_denied"
**原因**: YouTubeスコープの問題
**解決**: スコープが`https://www.googleapis.com/auth/youtube.force-ssl`であることを確認

### 問題3: "API が有効ではありません"
**原因**: YouTube Data API v3が有効化されていない
**解決**: Google Cloud ConsoleでAPIを有効化

## 🔄 完全リセット手順（最終手段）

1. **OAuth認証の完全リセット**
   ```javascript
   chrome.identity.clearAllCachedAuthTokens(() => {
     console.log('All OAuth tokens cleared');
   });
   ```

2. **拡張機能データの完全削除**
   - `chrome://extensions/` → 詳細 → 拡張機能データをクリア

3. **新しいGoogle Cloud プロジェクト作成**
   - 完全に新しいプロジェクトで最初から設定

## 📞 緊急時の代替案

### Option A: TEST_MODE継続
現在のTEST_MODEを継続して、マシュマロ接続のみテスト

### Option B: 別の認証方法
YouTube APIの代わりに、別の投稿方法を検討

---

**⏰ 作業時間**: 15-30分程度で解決可能
**🎯 成功指標**: 拡張機能からYouTube Live Chatに投稿できること