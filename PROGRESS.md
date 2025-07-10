# プロジェクト進捗状況 (Marshmallow → YouTube Live BOT)

**最終更新日:** 2025年7月10日

## 概要
Chrome拡張機能「Marshmallow → YouTube Live BOT」の開発進捗を管理します。

## 現在のステータス
主要なコンポーネントの骨格は実装済みで、DOMセレクタの特定、XSS対策、ポーリングの整理、ポップアップUIのモダン化、そしてポップアップからのURL設定機能の追加といった重要な修正が完了しました。単体テストも成功し、現在は結合テストとデバッグのフェーズです。

## 完了したタスク (確認済み)
*   プロジェクトディレクトリの作成
*   `manifest.json` の基本設定（`manifest_version`, `name`, `version`, `description`, `permissions`, `host_permissions`, `background`, `action`）
*   `background.service_worker.js` の主要ロジック（isRunning管理、アラーム、メッセージ受信、キュー管理、YouTube投稿、NGワードフィルタリング、OAuth2トークン取得、バッジ更新、通知）
*   `popup.html` / `popup.js` のUIとロジック、国際化対応
*   `options.html` / `options.js` の設定保存・読み込み、NGワードJSONアップロード、国際化対応
*   国際化ファイル (`_locales/en/messages.json`, `_locales/ja/messages.json`) の作成とUI文字列の定義
*   `content_script.js` のDOMセレクタの修正（提供されたHTMLに基づき、メッセージの抽出とログイン状態の判定セレクタを更新）
*   `manifest.json` の修正（`declarativeNetRequest` の削除と `client_id` の設定）
*   `background.service_worker.js` の `sanitizeTextForYouTube` 関数の修正（Service Workerで動作するXSS対策に修正）
*   `background.service_worker.js` のポーリングに関する修正（`pollMarshmallow` アラームの削除）
*   `background.service_worker.js` の `sanitizeTextForYouTube` 関数と質問整形ロジックの単体テスト
*   `background.service_worker.js` の質問整形ロジックから200字切り捨て機能を削除
*   ポップアップUIのモダン化（`popup.html`, `popup.js`, `messages.json` の更新）
*   ポップアップUIからのYouTube Live URL設定機能の追加（`popup.html`, `popup.js`, `messages.json` の更新）
*   ポップアップUIにYouTube Liveのサムネイルとタイトル表示機能を追加（`popup.html`, `popup.js`, `background.service_worker.js`, `messages.json` の更新）
*   ポップアップUIのサイズとボタンの整理（`popup.html` の更新）
*   ポップアップUIからのYouTube Data APIキー設定機能の追加（`popup.html`, `popup.js`, `background.service_worker.js`, `messages.json` の更新）
*   ポップアップUIのYouTube URL解析機能の改善（`popup.js` の更新）

## 未完了のタスク
*   なし

## 懸念事項 / 要確認事項
*   `content_script.js` の `received_at` は、提供されたHTMLに正確なタイムスタンプ情報がないため、暫定的にメッセージ抽出時の現在時刻を使用している。より正確なタイムスタンプが必要な場合は、別途検討が必要。

## 次のステップ
1.  **YouTube Data APIキーの設定**
2.  **結合テストとデバッグを実施。**
3.  パフォーマンス測定。
