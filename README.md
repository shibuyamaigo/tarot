# 🎮 BITRIDERZ v2.8

**レトロゲーム風サイクリングトレーナー + Bluetooth実デバイス対応**

## ✨ 特徴

- **5段階キャラクターフォーム**: パワー強度でリアルタイム変化
- **物理エンジン**: 体重・勾配・パワー完全連動
- **Bluetooth対応**: パワーメーター・心拍計・ケイデンス
- **レトロ演出**: 稲妻・風・花火エフェクト
- **レスポンシブ**: 全デバイス対応

## 🔗 Bluetooth機能

### 対応デバイス
- **パワーメーター**: KICKR, Elite, Tacx等
- **心拍計**: Bluetooth対応全般
- **ケイデンス**: CSC対応センサー

### 接続環境
- **HTTPS必須**: Web Bluetooth API要件
- **Chrome推奨**: 最大互換性
- **デバイス**: Mac/Windows/Android

## 🚀 開発履歴

### v2.8 (Prototype 2)
- [x] ブランドリニューアル: RetroRide → BITRIDERZ
- [x] 5段階キャラクターフォーム実装
- [x] Bluetooth Phase A/B完了
- [x] 物理計算エンジン体重連動
- [x] 安全第一の段階的実装
- [x] GitHub Pages HTTPS環境デプロイ完了

### Phase実装状況
- ✅ **Phase A**: Bluetooth基盤準備
- ✅ **Phase B**: 実デバイス接続
- ✅ **HTTPS対応**: GitHub Pages デプロイ完了
- ⏳ **Phase C**: データ統合（予定）

### 本日の進捗 (2026-05-26)
- ✅ SSH認証でGitHub接続成功
- ✅ GitHub Actions自動デプロイ設定
- ✅ HTTPS環境でBluetooth API利用可能
- ✅ 全コードリポジトリ管理下
- 🔄 **次**: 実デバイステスト開始

## 📱 クイックスタート

### ローカル開発
```bash
npm install
npm run dev
```
**注意**: Bluetooth機能はHTTPS必須

### HTTPS テスト環境
1. GitHub Pages デプロイ（推奨）
2. Chrome実験フラグ有効化
3. mkcert でローカルSSL

## 🛡️ 安全措置

- **段階的実装**: 各Phaseで動作確認
- **ダミーフォールバック**: 実データ失敗時
- **エラーハンドリング**: Bluetooth切断対応
- **バックアップ完備**: 即座復旧可能

## 🎯 今後の展開

### Phase C: データ統合
- 実心拍表示統合
- 実パワー物理計算統合
- ダミーとリアルの自動切替

### Phase D: 高度機能
- GPXコース読み込み
- セッション履歴
- パワーゾーン表示

## 🔧 技術スタック

- **Frontend**: Vanilla JS + Canvas
- **Bluetooth**: Web Bluetooth API
- **Physics**: Newton-Raphson法
- **Build**: Vite
- **Deploy**: GitHub Pages

---

**開発**: Claude Code Assistant  
**ライセンス**: 個人開発プロジェクト  
**更新**: 2026-05-26