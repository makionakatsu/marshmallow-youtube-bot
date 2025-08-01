# 🚨 OAuth Error 400: invalid_request デバッグガイド

## 🔍 OAuth 400エラーの主要原因

### 1. **Google Cloud Console設定の確認項目**

#### ✅ **必須チェック項目**:

| 項目 | 現在の設定 | 正しい設定 |
|---|---|---|
| **アプリケーションの種類** | ? | `Chrome 拡張機能` |
| **アプリケーション ID** | ? | `emldkanlfkhceephbhcndcfoadacolpe` |
| **承認済みドメイン** | ? | 設定不要（Chrome拡張機能） |

#### 🔴 **よくある設定ミス**:
1. **アプリケーションの種類**が「ウェブアプリケーション」になっている
2. **アプリケーション ID**が間違っている
3. **リダイレクトURI**が設定されている（Chrome拡張機能では不要）

### 2. **Chrome拡張機能側の設定確認**

#### ✅ **manifest.json**:
```json
{
  "oauth2": {
    "client_id": "1038995061271-avf143c6lpef1hc5iirkj7cih82b7ea1.apps.googleusercontent.com",
    "scopes": [
      "https://www.googleapis.com/auth/youtube.force-ssl"
    ]
  }
}
```

#### ✅ **permissions**:
```json
{
  "permissions": [
    "identity"
  ]
}
```

### 3. **YouTube Data API v3 設定確認**

#### 🔴 **必須確認項目**:
1. **API有効化**: YouTube Data API v3が有効になっているか
2. **クォータ**: API使用制限に達していないか
3. **制限設定**: APIキーやOAuth設定に制限がかかっていないか

### 4. **実際のエラー詳細取得方法**

#### **Chrome拡張機能のデバッグ**:
1. `chrome://extensions/` → **デベロッパーモード**
2. `Marshmallow to YouTube Bot` → **background page**
3. **Console**タブでエラー詳細を確認

#### **手動OAuth テスト**:
```javascript
// Background Pageのコンソールで実行
chrome.identity.getAuthToken({interactive: true}, function(token) {
  if (chrome.runtime.lastError) {
    console.error('OAuth Error Details:', chrome.runtime.lastError);
    console.error('Error Message:', chrome.runtime.lastError.message);
  } else {
    console.log('OAuth Success! Token:', token ? token.substring(0, 20) + '...' : 'null');
  }
});
```

### 5. **Google Cloud Console での確認手順**

#### **Step 1: プロジェクト設定確認**
1. https://console.cloud.google.com/
2. **正しいプロジェクト**が選択されているか確認

#### **Step 2: OAuth 同意画面設定**
1. **APIとサービス** → **OAuth 同意画面**
2. **テストユーザー**が追加されているか確認
3. **公開ステータス**が「テスト」または「本番環境」か確認

#### **Step 3: 認証情報の詳細確認**
```
認証情報タイプ: OAuth 2.0 クライアント ID
アプリケーションの種類: Chrome 拡張機能
名前: Marshmallow to YouTube Bot
アプリケーション ID: emldkanlfkhceephbhcndcfoadacolpe
```

### 6. **エラーの種類別対処法**

#### **Error 400: invalid_request**
- **原因**: 基本的な設定ミス
- **対処**: アプリケーションタイプとIDを再確認

#### **Error 400: invalid_client**
- **原因**: Client IDが無効
- **対処**: 新しいOAuth Client IDを作成

#### **Error 400: unauthorized_client**
- **原因**: Chrome拡張機能として認識されていない
- **対処**: アプリケーションタイプを「Chrome拡張機能」に変更

#### **Error 403: access_denied**
- **原因**: OAuth同意画面の設定問題
- **対処**: テストユーザーの追加、スコープの確認

### 7. **完全リセット手順**

#### **Step 1: OAuth認証の完全クリア**
```javascript
// Background Pageで実行
chrome.identity.clearAllCachedAuthTokens(() => {
  console.log('All OAuth tokens cleared');
});
```

#### **Step 2: 新しいOAuth Client ID作成**
1. 既存のClient IDを**削除**
2. **新しいOAuth Client ID**を作成
3. **アプリケーションの種類**: `Chrome 拡張機能`
4. **アプリケーション ID**: `emldkanlfkhceephbhcndcfoadacolpe`

#### **Step 3: manifest.json 更新**
新しいClient IDでmanifest.jsonを更新

### 8. **トラブルシューティング チェックリスト**

#### ✅ **Google Cloud Console**:
- [ ] YouTube Data API v3 が有効
- [ ] OAuth Client ID が「Chrome拡張機能」タイプ
- [ ] アプリケーション ID が正確
- [ ] OAuth同意画面が設定済み
- [ ] テストユーザーが追加済み

#### ✅ **Chrome拡張機能**:
- [ ] manifest.json の Client ID が正確
- [ ] identity 権限が設定済み
- [ ] 拡張機能が再読み込み済み
- [ ] OAuth トークンがクリア済み

### 9. **即座に試せる診断コマンド**

```javascript
// Background Pageで実行
console.log('=== OAuth診断開始 ===');
console.log('Manifest Client ID:', chrome.runtime.getManifest().oauth2.client_id);
console.log('Extension ID:', chrome.runtime.id);

chrome.identity.getAuthToken({interactive: false}, function(token) {
  console.log('Cached Token:', token ? 'あり' : 'なし');
  if (chrome.runtime.lastError) {
    console.log('Cached Token Error:', chrome.runtime.lastError.message);
  }
});
```

---

**🎯 次のアクション**: Google Cloud Consoleで上記設定を順番に確認してください。