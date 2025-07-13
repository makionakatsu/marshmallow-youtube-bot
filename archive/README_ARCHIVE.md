# アーカイブディレクトリ - README

**作成日:** 2025年1月13日  
**目的:** V2.0リファクタリングプロジェクト完了後のファイル整理  

---

## 📁 アーカイブ内容

このディレクトリには、V2.0本格運用には直接必要ないが、品質保証・トラブルシューティング・将来の開発で価値があるファイルを保管しています。

### `/tests/` - テストファイル群
**用途:** 品質保証、デバッグ、リグレッションテスト

#### 総合テストスイート
- `test_comprehensive.html` - 全テストを統合実行
- `test_v2_basic.html` - 基本機能テスト

#### 専門テストツール
- `test_real_environment.html/js` - 実環境テスト
- `test_background_communication.js` - Background Script通信テスト
- `test_background_integration.js` - Background Script統合テスト
- `test_error_scenarios.js` - エラーシナリオテスト
- `test_performance.js` - パフォーマンステスト
- `test_long_running.js` - 長時間稼働テスト

#### レガシーテスト
- `background.test.js` - 旧版Background Scriptテスト

### `/docs/legacy/` - レガシードキュメント
**用途:** 歴史的価値、開発経緯の理解

- `AI_READABLE_CODING_STANDARDS.md` - AI可読性標準（開発時）
- `requirements.md` - 初期要件定義
- `tasks.md` - 初期タスク管理
- `program_introduction.md` - プログラム紹介文書

### `/` (アーカイブルート)
- `content_script.js` - 旧版Content Script（V1.0）

---

## 🔧 アーカイブファイルの使用方法

### テストファイルの使用

#### 総合品質チェック時
```bash
# ルートディレクトリから実行
cp archive/tests/test_comprehensive.html .
open test_comprehensive.html
# テスト完了後
rm test_comprehensive.html
```

#### 特定問題の調査時
```bash
# パフォーマンス問題
cp archive/tests/test_performance.js .
# エラー調査
cp archive/tests/test_error_scenarios.js .
# 実環境問題
cp archive/tests/test_real_environment.* .
```

### 旧版への緊急復旧時
```bash
# V1.0への一時復旧（緊急時のみ）
cp archive/content_script.js .
# manifest.json で "content_script_v2.js" -> "content_script.js" に変更
```

---

## ⚠️ 重要な注意事項

### 削除禁止ファイル
- **全テストファイル**: 将来的な品質保証に必要
- **旧版Content Script**: 緊急時復旧用
- **レガシードキュメント**: 開発経緯の理解に必要

### 使用時の注意
1. **一時的使用**: テストファイルは使用後にアーカイブに戻す
2. **バックアップ**: 重要な変更前は必ずバックアップ
3. **ドキュメント確認**: 使用前に `/docs/FILE_STRUCTURE.md` を確認

### 追加アーカイブ時
新しいファイルをアーカイブする際は、適切なサブディレクトリに分類し、このREADMEを更新してください。

---

## 📊 アーカイブファイル統計

### テストファイル
- **総合テスト**: 2ファイル
- **専門テスト**: 7ファイル
- **レガシーテスト**: 1ファイル
- **総計**: 10ファイル

### ドキュメント
- **レガシー文書**: 4ファイル
- **コードファイル**: 1ファイル（旧版Content Script）

### 総アーカイブサイズ
- **概算**: 500KB以下（主にテキストファイル）
- **重要度**: 高（将来的な保守に必要）

---

## 🔮 将来的な管理方針

### 定期的な見直し（年1回推奨）
1. **使用頻度確認**: 過去1年での使用状況
2. **技術的陳腐化**: Chrome Extension APIの変更等
3. **ストレージ最適化**: 不要となったファイルの精査

### 新バージョン開発時
1. **現行版のアーカイブ**: V2.0ファイル群の適切な保管
2. **テスト環境更新**: 新バージョン対応テストの作成
3. **段階的移行**: 安全な移行プロセスの実施

---

**管理責任者:** プロジェクト保守担当者  
**最終更新:** 2025年1月13日  
**次回見直し予定:** 2026年1月