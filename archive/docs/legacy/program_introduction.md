
# Chrome拡張機能「Marshmallow to YouTube Bot」仕様・紹介資料

## 1. プログラム概要

*   **コンセプト:** 匿名質問サービス「マシュマロ」に届いた質問を、YouTube Liveのチャットに自動で投稿するためのChrome拡張機能。
*   **目的:** 配信者がマシュマロの質問を手動でコピー＆ペーストする手間を省き、配信のインタラクションを円滑にすること。
*   **特徴:**
    *   **ブラウザ完結:** サーバーや専門知識が不要で、Chrome拡張機能として手軽に導入・運用可能。
    *   **コストゼロ:** クラウドサービスを利用しないため、運用コストは一切かからない。
    *   **安全性:** GoogleのOAuth2認証を利用し、安全にYouTubeアカウントと連携。APIキーなどの重要な情報は暗号化して保存される。

## 2. 想定使用者

*   **メインターゲット:** マシュマロで質問を募集し、それを使ってYouTubeでライブ配信を行う配信者（VTuber、ゲーム実況者など）。
*   **サブターゲット:**
    *   配信のモデレーターなど、配信者本人に代わって投稿作業を行う担当者。
    *   コストをかけずに配信を効率化・自動化したい個人・小規模な配信者。
    *   配信の流れに応じて、質問の投稿タイミングを柔軟にコントロールしたい配信者。

## 3. 利活用方法・メリット

*   **配信準備・運用負荷の大幅な軽減:**
    *   配信中にマシュマロの画面を開き、質問を一つずつコピペする作業が不要になる。
    *   「自動モード」を使えば、設定した間隔で自動的に質問が投稿され続けるため、配信者はトークに集中できる。
*   **配信の活性化と円滑な進行:**
    *   質問が途切れることなく供給されるため、配信の「無言」時間を減らし、視聴者との対話を活発に保つことができる。
    *   「手動モード」を使えば、トークの流れや盛り上がりに合わせて、任意のタイミングで質問を投稿できる。
*   **常時質問受付による計画的な配信作り:**
    *   マシュマロは24時間365日、質問を受け付けることができます。本拡張機能を使えば、配信時間外に届いた質問も自動でキューにストックしておくことが可能です。
    *   これにより、配信者は事前にトークの「ネタ」を十分に確保でき、場当たり的ではない、計画的で質の高い配信作りが可能になります。
*   **柔軟なカスタマイズ性:**
    *   **投稿間隔:** 30秒から任意の間隔で設定でき、配信のペースに合わせられる。
    *   **NGワード:** 不適切な単語や、配信で触れたくない話題を含む質問を自動的に除外（スキップ）できる。
    *   **質問フォーマット:** 「Q:」などの接頭辞を自由に変更し、チャット欄での見栄えをカスタマイズできる。
*   **安心の運用支援機能:**
    *   **キュー管理:** 投稿待ちの質問、投稿済みの質問、スキップされた質問を一覧で確認できる。不要な質問は個別に削除も可能。
    *   **ステータス表示:** 拡張機能のアイコンバッジやポップアップUIで、現在の動作状況（待機中、実行中、エラー）が一目でわかる。
    *   **エラー通知:** 投稿に失敗した場合や、マシュマロにログインできていない場合に、ブラウザ通知で知らせてくれる。

## 4. 機能仕様詳細

*   **投稿モード**
    *   **自動モード:** 設定された時間間隔（デフォルト120秒）で、キューにある最も古い質問を自動で投稿し続ける。
    *   **手動モード:** 自動投稿は行われず、ユーザーがポップアップの「手動投稿」ボタンを押した時にのみ投稿する。
*   **マシュマロ連携**
    *   **質問自動取得:** マシュマロの受信箱ページを開いておくと、ページの変更を監視（DOM監視）し、新着質問を自動で検知してキューに追加する。
    *   **ログイン状態検知:** マシュマロにログインしているかどうかを自動で判別し、未接続の場合は通知やバッジで警告する。
*   **YouTube連携**
    *   **URL設定:** ポップアップ画面に配信中のYouTube LiveのURLを貼り付けるだけで、投稿先となるチャットを自動で設定する。
    *   **情報表示:** 設定したYouTube Liveのサムネイルとタイトルがポップアップに表示され、投稿先を間違えるのを防ぐ。
*   **キュー管理**
    *   質問は `pending` (投稿待ち)、`sent` (投稿済み)、`skipped` (スキップ済み) の3つのステータスで管理される。
    *   ポップアップから現在のキューの内容を確認・全件削除・個別削除が可能。
*   **設定項目**
    *   **YouTube Data APIキー:** ユーザーが自身のGoogle Cloud Consoleで取得したAPIキーを設定。
    *   **自動投稿間隔:** 30秒〜300秒の範囲で設定可能。
    *   **最大リトライ回数:** 投稿失敗時に自動で再試行する回数（1〜10回）。
    *   **質問接頭辞:** 投稿される質問の前に付加される文字列。
    *   **NGワード:** 1行に1つずつ、またはJSONファイルをアップロードして設定。
*   **セキュリティ**
    *   **XSS対策:** 投稿する質問本文に含まれるHTMLタグ (`<`, `>`, `&`) を自動でエスケープし、クロスサイトスクリプティングを防ぐ。
    *   **APIキー暗号化:** 設定されたYouTube Data APIキーは、Web Crypto API (AES-GCM) を用いて暗号化された上で `chrome.storage.local` に保存されるため、安全性が高い。
    *   **OAuth2認証:** YouTubeへの投稿は、`chrome.identity` APIを介した安全な認証プロセス（OAuth2）で行われ、パスワードなどを拡張機能に保存する必要はない。スコープも `youtube.force-ssl` のみに限定されている。

## 5. 使用時の注意点・制約事項

*   **事前準備:**
    *   使用者は事前に **Google Cloud Console** で「YouTube Data API v3」を有効にし、**APIキー**と**OAuthクライアントID（Chromeアプリタイプ）**を取得・設定する必要がある。
    *   使用するYouTubeアカウントが、対象のライブ配信でチャット投稿可能であること（チャンネル登録者限定やメンバー限定などの条件を満たしている必要がある）。
*   **実行環境:**
    *   本拡張機能の動作中は、**Chromeブラウザを常に起動**しておく必要がある。
    *   **マシュマロの受信箱ページ (`https://marshmallow-qa.com/messages`) を開いてログインした状態**にしておく必要がある。
*   **外部サービスの仕様変更:**
    *   マシュマロのウェブサイトのHTML構造が変更された場合、質問を正しく取得できなくなる可能性がある。その際は拡張機能のアップデートが必要になる。
*   **倫理的利用:**
    *   他人のチャンネルで利用する場合は、必ず配信者の許諾を得ること。
    *   YouTubeのAPI利用規約やレート制限を遵守した設計になっているが、過度な連続投稿は行わないこと。

## 6. 開発背景・経緯（ストーリー）

本拡張機能は、単なる「自動化ツール」として始まったわけではありません。配信者のリアルな悩みに寄り添い、**「配信体験そのものを向上させるパートナー」**となることを目指して、機能改善を重ねてきました。

### **フェーズ1：基本骨格の実装**
開発の初期段階では、要件定義に基づき、「マシュマロの質問を定期的にYouTubeに投稿する」というコア機能の実装に注力しました。Manifest V3の仕様に準拠したService Workerをベースに、マシュマロのページを監視する`content_script`と、投稿処理を行う`background`処理の基本骨格を構築しました。

### **フェーズ2：利用シーンを想定した機能の具体化とセキュリティ強化**
コア機能が形になると、次に「実際に配信者が使うなら？」という視点で、機能の具体化と安全性の向上に取り組みました。

*   **DOMセレクタの最適化:** マシュマロのサイト構造を分析し、質問やログイン状態を正確に読み取るためのDOMセレクタを特定・修正しました。これは、外部サービスと連携する上で最も不安定になりがちな部分であり、安定稼働のための重要なステップでした。
*   **安全なXSS対策の実装:** 当初からセキュリティは重視していましたが、Manifest V3のService Worker環境で確実に動作するよう、投稿内容をサニタイズするロジックをより堅牢なものに修正しました。これにより、悪意のある質問によるXSS攻撃のリスクを排除しています。
*   **文字数制限の撤廃:** 当初は200字で質問を切り捨てる仕様でしたが、「質問者の意図を全文伝えたい」という配信者のニーズを汲み取り、この制限を撤廃。より丁寧なコミュニケーションを可能にしました。

### **フェーズ3：UI/UXの徹底的な改善**
ツールは、機能が優れているだけでは不十分です。「いかにストレスなく、直感的に使えるか」を追求し、UI/UXの大幅な改善を行いました。

*   **ポップアップUIのモダン化:** 拡張機能の「顔」であるポップアップUIを、より現代的で分かりやすいデザインに刷新。ステータスが一目でわかるようにし、操作性を向上させました。
*   **設定フローの簡略化:** 当初は設定画面（options.html）で行う必要があった「YouTube LiveのURL設定」や「APIキー設定」を、メインのポップアップ画面に統合。これにより、配信のたびに複数の画面を行き来する手間がなくなり、格段にスムーズな操作性を実現しました。
*   **視覚的なフィードバックの強化:** 設定したYouTube Liveのサムネイルとタイトルを表示する機能を追加。これにより、ユーザーは「今、どの配信に投稿しようとしているのか」を視覚的に確認でき、誤操作を防ぎます。

このように、本拡張機能は、技術的な課題解決とユーザー目線での改善を繰り返すことで、現在の形に至りました。単に作業を自動化するだけでなく、配信者がより安心して、よりクリエイティブな活動に集中できる環境を提供すること。それが、このツールに込められた想いです。
