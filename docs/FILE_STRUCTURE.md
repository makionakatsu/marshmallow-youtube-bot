# ファイル構成ガイド - Marshmallow to YouTube Bot

**最終更新:** 2025年1月13日  
**バージョン:** V2.0 本格運用版  

---

## 📁 ディレクトリ構成

```
marshmallow2youtube/
├── 📄 manifest.json                    # Chrome拡張機能設定
├── 📄 content_script_v2.js            # メインContent Script (V2.0本格運用版)
├── 📄 background.service_worker.js    # Background Script
├── 📄 popup.html                      # ポップアップUI
├── 📄 popup.js                        # ポップアップロジック
├── 📄 settings.html                   # 設定ページ
├── 📄 settings.js                     # 設定ロジック
├── 📄 README.md                       # プロジェクト概要
├── 📁 icons/                          # アイコンファイル群
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── 📁 docs/                           # ドキュメント
│   ├── 📄 FILE_STRUCTURE.md          # ファイル構成ガイド (本ファイル)
│   ├── 📁 operations/                 # 運用ドキュメント
│   │   ├── 📄 REQUIREMENTS_V2.md     # V2.0要件定義書
│   │   └── 📄 PROGRESS.md            # プロジェクト進捗管理
│   └── 📁 development/               # 開発ドキュメント
│       ├── 📄 REFACTORING_SUMMARY.md # リファクタリング成果サマリー
│       ├── 📄 REFACTORING_PLAN_V2.md # リファクタリング計画書
│       ├── 📄 PHASE2_TEST_REPORT.md  # Phase 2テスト完了レポート
│       ├── 📄 PHASE3_COMPLETION_REPORT.md # Phase 3完了レポート
│       ├── 📄 PROJECT_FINAL_SUMMARY.md # プロジェクト最終サマリー
│       └── 📄 USABILITY_TEST_GUIDE.md # ユーザビリティテストガイド
└── 📁 archive/                        # アーカイブ
    ├── 📄 content_script.js          # 旧版Content Script
    ├── 📁 tests/                     # テストファイル群
    │   ├── 📄 test_comprehensive.html
    │   ├── 📄 test_v2_basic.html
    │   ├── 📄 test_real_environment.html
    │   ├── 📄 test_real_environment.js
    │   ├── 📄 test_background_communication.js
    │   ├── 📄 test_background_integration.js
    │   ├── 📄 test_error_scenarios.js
    │   ├── 📄 test_performance.js
    │   ├── 📄 test_long_running.js
    │   └── 📄 background.test.js
    └── 📁 docs/legacy/               # レガシードキュメント
        ├── 📄 AI_READABLE_CODING_STANDARDS.md
        ├── 📄 requirements.md
        ├── 📄 tasks.md
        └── 📄 program_introduction.md
```

---

## 🎯 各ディレクトリの役割

### `/` (ルートディレクトリ)
**用途:** 本格運用で必要な Core ファイルのみ配置  
**対象者:** 一般ユーザー、運用担当者  

#### Core ファイル
- `manifest.json` - Chrome拡張機能の設定
- `content_script_v2.js` - メインロジック (V2.0リファクタリング版)
- `background.service_worker.js` - Background処理
- `popup.html/js` - ユーザーインターフェース
- `settings.html/js` - 設定管理
- `README.md` - プロジェクト概要

### `/docs/` - ドキュメント
**用途:** 運用・開発に関する全ドキュメント  
**対象者:** 開発者、運用担当者、保守担当者  

#### `/docs/operations/` - 運用ドキュメント
**日常運用で参照する重要ドキュメント**
- `REQUIREMENTS_V2.md` - 要件定義書
- `PROGRESS.md` - プロジェクト進捗管理

#### `/docs/development/` - 開発ドキュメント
**開発・改修時に参照する技術ドキュメント**
- `REFACTORING_SUMMARY.md` - リファクタリング成果
- `PROJECT_FINAL_SUMMARY.md` - プロジェクト総括
- 各Phase完了レポート

### `/archive/` - アーカイブ
**用途:** 直接の運用には不要だが保管すべきファイル  
**対象者:** 開発者（トラブルシューティング、テスト実行時）  

#### `/archive/tests/` - テストファイル
**品質保証・デバッグ時に使用**
- 包括的テストスイート
- 各種専門テストツール
- レガシーテストファイル

#### `/archive/docs/legacy/` - レガシードキュメント
**歴史的価値はあるが日常参照しないドキュメント**

---

## 🔧 ファイル管理ルール

### 運用ファイルの管理

#### ✅ DO (推奨)
- **ルートディレクトリ**: 本格運用に必要なファイルのみ配置
- **バージョン管理**: 重要な変更時はgitでコミット
- **ドキュメント更新**: 機能変更時は該当ドキュメントも更新
- **アーカイブ活用**: 古いファイルは適切にアーカイブ

#### ❌ DON'T (禁止)
- **ルートディレクトリへのテストファイル配置**: 混乱の原因
- **ドキュメントの無秩序配置**: 情報の散逸
- **アーカイブファイルの削除**: 将来的なトラブルシューティングに必要
- **重要ファイルの直接編集**: バックアップなしでの変更

### テストファイルの管理

#### いつアーカイブから取り出すか
1. **品質問題発生時**: `archive/tests/`のテストを実行
2. **新機能追加時**: 既存テストとの整合性確認
3. **パフォーマンス問題**: 性能テストツールの活用
4. **リグレッション確認**: 総合テストスイートの実行

#### テスト実行手順
```bash
# テストファイルを一時的にルートにコピー
cp archive/tests/test_comprehensive.html .

# ブラウザでテスト実行
open test_comprehensive.html

# テスト完了後はアーカイブに戻す
rm test_comprehensive.html
```

---

## 📋 保守運用ガイド

### 日常的に参照するファイル

#### 運用担当者
1. `README.md` - プロジェクト概要
2. `docs/operations/PROGRESS.md` - 現在のステータス
3. `docs/operations/REQUIREMENTS_V2.md` - 機能仕様

#### 開発者
1. `content_script_v2.js` - メインロジック
2. `docs/development/REFACTORING_SUMMARY.md` - アーキテクチャ理解
3. `docs/development/PROJECT_FINAL_SUMMARY.md` - プロジェクト全体像

### トラブルシューティング時

#### エラー発生時の確認順序
1. **Chrome Developer Tools** - Console エラーの確認
2. **`archive/tests/test_comprehensive.html`** - 総合テスト実行
3. **`docs/development/PHASE3_COMPLETION_REPORT.md`** - 既知の問題確認
4. **`archive/tests/test_error_scenarios.js`** - エラーシナリオテスト

#### パフォーマンス問題時
1. **`archive/tests/test_performance.js`** - パフォーマンステスト実行
2. **`archive/tests/test_long_running.js`** - 長時間稼働テスト
3. **Chrome Task Manager** - メモリ使用量確認

### 機能追加・修正時

#### 開発フロー
1. **要件確認**: `docs/operations/REQUIREMENTS_V2.md`
2. **設計確認**: `docs/development/REFACTORING_SUMMARY.md`
3. **実装**: `content_script_v2.js` 修正
4. **テスト**: `archive/tests/` のテストツール活用
5. **ドキュメント更新**: 該当ドキュメントの更新

---

## 🔄 ファイル移動・削除時の注意事項

### 移動前の確認事項
- [ ] 移動対象ファイルが他ファイルから参照されていないか
- [ ] manifest.json での参照確認
- [ ] HTML ファイルでの script 参照確認
- [ ] ドキュメント内でのリンク確認

### 安全な移動手順
1. **バックアップ作成**: 重要ファイルのコピー
2. **参照関係確認**: grep等での参照箇所検索
3. **段階的移動**: 一度に全ては移動せず段階的に実施
4. **動作確認**: 移動後の機能テスト実行

### 緊急時の復旧手順
```bash
# アーカイブからの復旧
cp archive/content_script.js .  # 旧版への一時復旧
cp archive/tests/* .             # テスト環境復旧

# manifest.json での切り替え
# "content_script_v2.js" -> "content_script.js"
```

---

## 📞 サポート・連絡先

### ファイル構成に関する質問
- **技術的質問**: `docs/development/` 内ドキュメント参照
- **運用に関する質問**: `docs/operations/` 内ドキュメント参照
- **緊急時**: アーカイブからの復旧手順に従う

### 改善提案
- ファイル構成の改善案
- ドキュメント構成の最適化提案
- 新しいファイル分類の提案

---

**注意:** このファイル構成は V2.0 本格運用に最適化されています。将来的な大幅な機能追加時には、この構成の見直しを検討してください。