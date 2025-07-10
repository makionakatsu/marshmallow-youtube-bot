# 質問投稿BOT ― **Chrome 拡張版** 要件定義書  
Version 1.3 (2025-07-10)  
作成者: ChatGPT (o3)

> **更新履歴 (1.3)**  
> * マシュマロ未ログイン時のアナウンス要件を追加  
> 
> **更新履歴 (1.2)**  
> * CORS 対応ルール（declarativeNetRequest）を具体化  
> * Service Worker の START / STOP 状態永続化を明記  
> * OAuth クライアント ID 種別（Chrome アプリ）を追記  

---

## 1. 目的  
ブラウザ拡張のみで完結し、匿名質問サービス **「マシュマロ」** に蓄積された質問を取得して  
YouTube Live Chat へ **2 分間隔（変更可）** で自動投稿する BOT を実装する。  
利用者は **自分のブラウザでマシュマロにログイン** しておくだけで運用でき、他チャンネルの  
Live Chat にも配信者許諾のもと投稿できる。クラウド費用は **¥0**。

---

## 2. スコープ  

| 区分 | 対象 | 非対象 |
|------|------|--------|
| 入力 | マシュマロ受信箱（DOM 解析） | Google Form など |
| 出力 | YouTube Live Chat への投稿 | Twitch 等 |
| 運用 | PC 上の Chrome 拡張 ON/OFF | サーバー常時稼働 |
| 監視 | 拡張アイコンバッジ・ブラウザ通知 | 外部モニタリング |

---

## 3. 定義・略語  

| 用語 | 説明 |
|------|------|
| **POLL_INTERVAL_SEC** | 受信箱ポーリング間隔 (既定 30 s) |
| **POST_INTERVAL_SEC** | チャット投稿間隔 (既定 120 s) |
| **liveChatId** | 投稿先 Live 配信の Chat ID |
| **isRunning** | START/STOP 状態フラグ (chrome.storage.local) |
| **status** | `pending` / `sent` / `skipped` |

---

## 4. 運用フロー  

1. **事前** 利用者はブラウザでマシュマロ受信箱に手動ログインしておく（セッション Cookie 保存）。  
2. **START**  
   * 拡張ポップアップで START → `isRunning=true` 保存・alarms セット。  
   * 受信箱タブが開いていなければ自動でピン留めタブを生成。  
3. **稼働**  
   * content script が受信箱 DOM を 30 s ごとに走査し新着質問を background へ送信。  
   * background が 120 s ごとに先頭 `pending` を YouTube Live Chat へ投稿。  
4. **STOP**  
   * ポップアップ STOP → `isRunning=false`・alarms clear・受信箱タブを閉じる（任意）。

---

## 5. 機能要件（FR）  

| # | 要件 |
|---|------|
| **FR-0** | 拡張は **ログイン済み受信箱タブ** が存在する場合のみ動作。未ログイン検出時は赤バッジと「マシュマロにログインしてください」という通知で警告。 |
| **FR-1** | content script が `MutationObserver` + interval で新着質問 (`id`, `text`, `receivedAt`) を検出し background に `chrome.runtime.sendMessage`。 |
| **FR-2** | background は `chrome.storage.local` キューに `status=pending` で保存。 |
| **FR-3** | **POST_INTERVAL_SEC** ごとに最古 `pending` を YouTube Live Chat へ投稿。 |
| **FR-4** | 本文が 200 字超の場合でも切り捨ては行わない。 |
| **FR-5** | NG ワード JSON と照合し一致した質問は `status=skipped`。 |
| **FR-6** | 投稿成功 → `status=sent`・タイムスタンプ付与。失敗 3 回連続 → バッジ `❌` + 通知。 |
| **FR-7** | オプション UI で liveChatId・各インターバル・NG JSON を編集可。変更は即時反映。 |
| **FR-8** | OAuth2 (`chrome.identity`) で `youtube.force-ssl` トークンを取得し自動リフレッシュ。 |

---

## 6. 非機能要件（NFR）  

| 項目 | 要件 |
|------|------|
| 性能 | 1 回ポーリング CPU ≤ 5 %、RAM ≤ 200 MB |
| 可用性 | ブラウザ稼働時の連続稼働率 ≥ 99 % |
| コスト | ランタイム費用 0 円 |
| UX | バッジ: `●` idle / `▶` running / `❌` error |
| I18N | UI 日/英 切替 |

---

## 7. アーキテクチャ & 主ファイル  manifest.json
├─ background.service_worker.js   // alarms・投稿処理・状態管理
├─ content_script.js              // 受信箱 DOM 監視
├─ popup.html / popup.js          // START / STOP
├─ options.html / options.js      // 各種設定
└─ ng_sample.json                 // NG ワード例### 7.1 manifest.json（抜粋）

```json
{
  "manifest_version": 3,
  "name": "Marshmallow → YouTube Live BOT",
  "permissions": ["storage", "alarms", "identity", "notifications"],
  "host_permissions": [
    "https://marshmallow-qa.com/*",
    "https://www.googleapis.com/*"
  ],
  "content_scripts": [{
    "matches": ["https://marshmallow-qa.com/messages*"],
    "js": ["content_script.js"],
    "run_at": "document_idle"
  }],
  "oauth2": {
    "client_id": "<CHROME_APP_CLIENT_ID>",
    "scopes": ["https://www.googleapis.com/auth/youtube.force-ssl"]
  },
  "background": { "service_worker": "background.service_worker.js" },
  "action": { "default_popup": "popup.html" }
}
```
※ OAuth クライアント ID は Google Cloud Console → 「Chrome アプリ」タイプ で発行。

⸻

## 8. コンフィギュレーション（options.html）

| Key | 既定 | 説明 |
|-----|--------|------|
| POLL_INTERVAL_SEC | 30 | 5 – 60 の範囲で設定 |
| POST_INTERVAL_SEC | 120 | 30 – 300 の範囲 |
| liveChatId | ― | 対象配信の Chat ID |
| NG_JSON | ― | NG ワード JSON をアップロード |

## 9. セキュリティ要求
1.OAuth スコープは youtube.force-ssl のみ。
2.トークンは chrome.identity により暗号化保管。
3.DOM 取得テキストを < > & エスケープして XSS 防止。
4.配信者の許諾を得ており、投稿はレート制限 (11 msg/30 s) を遵守。

⸻

## 10. 前提・制約
1.利用者は配信前にマシュマロ受信箱へ手動ログインし、タブを閉じない。
2.投稿アカウントが対象チャットに書き込み可能（登録者・メンバー条件を満たす）。
3.マシュマロ DOM 構造変更時は拡張アップデートが必要。
4.Chrome が配信中ずっと起動していること。

⸻

## 11. 今後の拡張（参考案）
•videos.list API で liveChatId をワンクリック取得
•Twitch / Discord 並列投稿
•ChatGPT による質問要約・分類

⸻

本書は手動ログイン前提 & DOM 直読み方式に基づき、実装コストと保守コストを最小化した最新版要件定義です。