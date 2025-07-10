### 質問投稿BOT (Chrome 拡張版) - 開発タスクリスト

#### 1. プロジェクト初期設定とマニフェスト (`manifest.json`)
*   **1.1. プロジェクトディレクトリの作成**
    *   `marshmallow2youtube-chrome-extension/` ディレクトリを作成 (※このタスクは完了済み。`marshmallow2youtube` ディレクトリ内で完結)
*   **1.2. `manifest.json` の作成と基本設定**
    *   `manifest_version: 3` の設定
    *   `name`, `version`, `description` の設定
    *   `permissions` の設定 (`storage`, `alarms`, `identity`, `notifications`)
    *   `host_permissions` の設定 (`https://marshmallow-qa.com/*`, `https://www.googleapis.com/*`)
    *   `content_scripts` の設定 (`content_script.js` を `https://marshmallow-qa.com/messages*` に注入)
    *   `background` (Service Worker) の設定 (`background.service_worker.js`)
    *   `action` (Popup) の設定 (`popup.html`)
*   **1.3. OAuth2 クライアントID の設定**
    *   `oauth2` セクションに `client_id` (Google Cloud Consoleで取得したChromeアプリタイプ) を設定
    *   `scopes` に `https://www.googleapis.com/auth/youtube.force-ssl` を設定
*   **1.4. `declarativeNetRequest` ルールセットの削除**
    *   `declarativeNetRequest` パーミッションと `rules.json` の設定を削除 (※このタスクは完了済み)

#### 2. バックグラウンド Service Worker (`background.service_worker.js`)
*   **2.1. 起動/停止状態 (`isRunning`) の管理**
    *   `chrome.storage.local` から `isRunning` フラグを読み込むロジックの実装
    *   `isRunning` が `false` の場合はポーリング・投稿処理をスキップする制御
*   **2.2. マシュマロ受信箱ポーリング (`FR-1` の受信側)**
    *   `content_script.js` からのメッセージを受信し、質問キューに保存するロジックを実装
*   **2.3. 質問キューの管理 (`FR-2`)**
    *   `chrome.storage.local` に質問キュー (`id`, `text`, `received_at`, `status`) を保存するロジック
    *   新着メッセージをキューに `status=pending` で追加するロジック
*   **2.4. YouTube Live Chat 投稿 (`FR-3`)**
    *   `chrome.alarms` を使用して `POST_INTERVAL_SEC` ごとに投稿処理をトリガー
    *   キューから最も古い `status=pending` の質問を取得するロジック
    *   YouTube Data API v3 `liveChatMessages.insert` を呼び出すロジック
*   **2.5. 投稿内容の整形 (`FR-4`)**
    *   質問本文を200字で切り捨て、末尾に `…` を付与するロジック (※現在は切り捨てなし)
    *   投稿フォーマット `Q: ` + 本文 の適用
    *   改行を半角スペースに変換するロジック
*   **2.6. NGワードフィルタリング (`FR-5`)**
    *   NGワードリスト (JSON) を読み込むロジック
    *   質問本文がNGワードに一致するかチェックするロジック
    *   NGワードに一致した場合、質問の `status` を `skipped` に更新
*   **2.7. 投稿結果の反映とエラーハンドリング (`FR-6`)**
    *   投稿成功時、質問の `status` を `sent` に更新し、`sent_at` タイムスタンプを付与
    *   投稿失敗時のリトライロジック (3回まで)
    *   3回連続失敗時、`chrome.notifications` でブラウザ通知
    *   エラー発生時、`chrome.action.setBadgeText` でアイコンバッジを赤 (`❌`) に設定
*   **2.8. OAuth2 トークンの取得と自動リフレッシュ (`FR-8`)**
    *   `chrome.identity.getAuthToken` を使用してYouTube APIアクセス用のトークンを取得
    *   トークンの自動リフレッシュ処理の実装
*   **2.9. マシュマロログイン状態の監視と通知 (`FR-0`)**
    *   `content_script` からのメッセージ（ログイン状態）を受信し、処理を制御
    *   未ログイン時に `chrome.action.setBadgeText` で赤バッジ (`❌`) を表示
    *   未ログイン時に `chrome.notifications` で「マシュマロにログインしてください」という通知を送信

#### 3. ポップアップUI (`popup.html`, `popup.js`)
*   **3.1. UI の作成**
    *   `popup.html` に START/STOP ボタンと状態表示要素を配置 (※モダンデザインに更新済み)
    *   YouTube Live URL入力欄とサムネイル表示を追加
    *   YouTube Data APIキー入力欄と表示トグルを追加
*   **3.2. START/STOP ボタンの機能実装**
    *   START ボタンクリック時、`chrome.storage.local` の `isRunning` を `true` に設定
    *   STOP ボタンクリック時、`chrome.storage.local` の `isRunning` を `false` に設定
    *   `chrome.alarms.clear()` を呼び出してアラームを停止
*   **3.3. 状態表示 (`UX`)**
    *   `chrome.action.setBadgeText` を使用して、拡張機能の稼働状態 (`●` idle / `▶` running / `❌` error) をアイコンバッジで表示
    *   ポップアップ内に現在の状態（稼働中/停止中、キューの数など）を表示

#### 4. オプションUI (`options.html`, `options.js`)
*   **4.1. UI の作成 (`FR-7`)**
    *   `options.html` に `POLL_INTERVAL_SEC`, `POST_INTERVAL_SEC` の入力フォームを配置
    *   NGワードJSONファイルをアップロードするためのファイル選択UIを配置
    *   (※ `liveChatId` と APIキー入力はポップアップに移動)
*   **4.2. 設定の保存と読み込み**
    *   入力された設定値を `chrome.storage.local` に保存するロジック
    *   拡張機能起動時、保存された設定値をUIに読み込むロジック
*   **4.3. 設定変更の即時反映**
    *   設定値変更時、Service Workerにメッセージを送り、アラームの再設定などを行うロジック
*   **4.4. NGワードJSONファイルの処理**
    *   アップロードされたJSONファイルをパースし、NGワードリストとして保存するロジック

#### 5. コンテンツスクリプト (`content_script.js`)
*   **5.1. マシュマロ受信箱のDOM監視と質問取得 (`FR-1`)**
    *   `MutationObserver` を使用してDOMの変更を監視
    *   `POLL_INTERVAL_SEC` ごとにDOMを走査し、新着質問 (`id`, `text`, `receivedAt`) を抽出
    *   マシュマロのログイン状態を判定するロジックを実装
*   **5.2. `background.service_worker.js` へのメッセージ送信 (`FR-1`)**
    *   取得した質問データとログイン状態を `chrome.runtime.sendMessage` で `background.service_worker.js` へ送信

#### 6. 国際化 (I18N)
*   **6.1. `_locales` ディレクトリの作成**
    *   `_locales/en/messages.json` と `_locales/ja/messages.json` を作成
*   **6.2. UI文字列の定義と適用**
    *   UIに表示される全ての文字列を `messages.json` に定義
    *   HTML/JavaScript から `chrome.i18n.getMessage()` を使用して文字列を読み込む
*   **6.3. 新しい通知メッセージの追加**
    *   「マシュマロにログインしてください」というメッセージを `messages.json` に追加

#### 7. セキュリティと品質
*   **7.1. 入力サニタイズ (`FR-9`, `9.3`)**
    *   YouTube Live Chat に投稿する前に、質問本文のXSS対策（`<`, `>`, `&` などのエスケープ）を実装
*   **7.2. 性能監視と最適化 (`NFR`)**
    *   開発中にCPU/RAM使用率を監視し、要件 (`CPU ≤ 5 %`, `RAM ≤ 200 MB`) を満たすよう最適化
*   **7.3. 倫理的利用の確認**
    *   拡張機能の利用が配信者の許諾を得ているか、スパム行為にならないかを確認する注意喚起をREADME等に記載

#### 8. テストとデバッグ
*   **8.1. 単体テスト**
    *   各機能モジュール（テキスト整形、NGワードフィルタリングなど）の単体テスト
*   **8.2. 結合テスト**
    *   マシュマロからの取得、キューへの保存、YouTubeへの投稿の一連の流れのテスト
    *   START/STOP機能のテスト
    *   オプション設定の反映テスト
*   **8.3. エラーシナリオテスト**
    *   YouTube APIレート制限、マシュマロ取得失敗、認証失効などのエラーハンドリングテスト
    *   **マシュマロ未ログイン時の通知テスト**
*   **8.4. パフォーマンス測定**
    *   実際の環境でCPU/RAM使用率を測定し、NFRを満たしているか確認

#### 9. ドキュメンテーション
*   **9.1. README.md の作成**
    *   拡張機能の概要、インストール方法、使用方法、設定方法、注意点などを記載
*   **9.2. 開発者向けドキュメント**
    *   コード構造、主要な関数、デバッグ方法など、開発者が理解しやすいドキュメントを作成（必要に応じて）

---

これらのタスクは、開発の進行状況や依存関係に応じて順序を調整してください。