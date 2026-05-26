# RetroRide Phase 2: 本格実装ロードマップ

## 🎯 Phase 1完成状況（v2.8.2）

### ✅ 完成済み機能
- **コア物理エンジン**: 完全動作（体重・勾配・パワー計算）
- **5段階キャラクターフォーム**: powerToWeight反応システム
- **視覚エフェクト**: 風・稲妻・花火・速度エフェクト
- **HUD system**: リアルタイムテレメトリー表示（PWR+W/kg）
- **テストモード**: 手動パワー・勾配・体重調整
- **レスポンシブUI**: 全デバイス対応
- **Bluetooth API**: パワーメーター接続実装済み

### 🎮 現在の疑似データ生成
```javascript
// 現在のダミーデータ（src/main.js line 220-240）
const powerWaveA = Math.sin(t * 0.64) * 20;
const powerWaveB = Math.sin(t * 0.18 + 0.9) * 26;
targetPower = clamp(basePower + powerWaveA + powerWaveB, 60, 420);

// コース勾配生成（極悪ヒルクライム対応）
const baseGrade = Math.sin(t * 0.075) * 8.0 + Math.sin(t * 0.031 + 1.4) * 5.5;
s.grade = clamp(baseGrade, -20, 25);
```

---

## 🔗 Phase 2-A: リアルデバイス接続

### Web Bluetooth API対応状況

#### ✅ 実装済み
```javascript
// src/bluetooth.js - 完全実装済み
- CYCLING_POWER_SERVICE (パワーメーター)
- HEART_RATE_SERVICE (心拍計)
- CSC_SERVICE (ケイデンス)
- データバリデーション (2500W上限等)
- 複数デバイス同時接続
- 自動再接続処理
```

#### 🌐 ブラウザ・OS対応
| Platform | Chrome | Safari | Firefox | Edge |
|----------|--------|--------|---------|------|
| **Windows** | ✅ Full | ❌ No | ❌ No | ✅ Full |
| **macOS** | ✅ Full | ❌ No | ❌ No | ✅ Full |
| **Android** | ✅ Full | ❌ No | ❌ No | ❌ No |
| **iOS** | ❌ No | ❌ No | ❌ No | ❌ No |

**結論**: Chromeブラウザ必須、iOS未対応

### 🔧 実デバイステスト環境

#### 必要機器
1. **パワーメーター**: 
   - Wahoo KICKR, Elite Direto, Tacx Neo等
   - Bluetooth対応必須（ANT+のみは不可）

2. **テスト端末**:
   - **Mac**: Chrome使用で接続可能
   - **Android**: Chrome使用で接続可能  
   - **Windows**: Chrome/Edge使用で接続可能
   - **iPhone**: 現状不可（Capacitor + iOS移行が必要）

#### 🧪 localhost接続テスト手順
```bash
# 1. HTTPSが必要（Web Bluetooth要件）
npm install -g mkcert
mkcert -install
mkcert localhost 127.0.0.1 ::1

# 2. Vite HTTPS設定
# vite.config.js
export default {
  server: {
    https: {
      key: fs.readFileSync('localhost-key.pem'),
      cert: fs.readFileSync('localhost.pem'),
    }
  }
}

# 3. https://localhost:5173 でアクセス
```

---

## 📊 Phase 2-B: リアルコースデータ

### コースファイル形式設計

#### GPXファイル解析システム
```javascript
// 提案: GPX -> RetroRide変換
// GPX入力例
<trkpt lat="35.6762" lon="139.6503">
  <ele>40.2</ele>
  <extensions>
    <power>245</power>
    <grade>3.2</grade>
  </extensions>
</trkpt>

// RetroRide内部形式
const courseData = {
  name: "箱根ヒルクライム",
  distance: 10.5, // km
  segments: [
    [100, 0.5, "paved", 1],    // [距離m, 勾配%, 路面, シーン]
    [100, 1.2, "paved", 1],
    [100, 3.8, "paved", 2],    // 登坂開始
    // ... 総計105セグメント
  ],
  scenery: {
    1: "山麓平地",
    2: "森林登坂", 
    3: "山頂付近"
  }
};
```

#### ファイルサイズ最適化
```
10kmコース = 100セグメント × 4values × 4bytes = 1.6KB
100kmコース = 1000セグメント × 4values × 4bytes = 16KB
```

### 🎨 背景シーン連動
```javascript
// segments配列の4番目でシーン指定
drawBackgroundScenery() {
  const currentScene = getCurrentScene(state.distanceKm);
  switch(currentScene) {
    case 1: this.drawFlatScenery(); break;    // 平地・住宅街
    case 2: this.drawForestScenery(); break;  // 森林
    case 3: this.drawMountainScenery(); break; // 山頂
  }
}
```

---

## 💾 Phase 2-C: データ永続化戦略

### 現在のデータ保存状況
```javascript
// 現在: メモリのみ（ページリロードで消失）
const state = {
  telemetry: { power, speed, cadence, heartRate },
  distanceKm: 0,
  elapsed: 0,
  // ← 保存されない
};
```

### 提案: 3段階データ管理

#### 1. セッション内データ（IndexedDB）
```javascript
// 5分間のリアルタイムデータ
const sessionData = {
  timestamp: Date.now(),
  samples: [
    { time: 0, power: 245, hr: 162, cadence: 88 },
    { time: 1, power: 251, hr: 164, cadence: 90 },
    // ... 300サンプル（5分）
  ]
};
// 容量: 300 × 4values × 8bytes = 9.6KB
```

#### 2. ライド履歴（LocalStorage）
```javascript
// 完了したライドの要約データ
const rideHistory = [
  {
    id: "ride_20261126_001",
    course: "箱根ヒルクライム", 
    duration: 1847, // 秒
    distance: 10.5,
    avgPower: 234,
    maxPower: 378,
    avgHR: 156,
    timestamp: Date.now()
  }
];
// 容量: 100ライド × 200bytes = 20KB
```

#### 3. ユーザー設定（LocalStorage）
```javascript
const userProfile = {
  weight: 70,
  ftp: 250, // Functional Threshold Power
  zones: [125, 150, 200, 250, 300], // パワーゾーン
  preferences: {
    units: "metric",
    autoUpload: false
  }
};
```

### 🔄 データフロー設計
```
リアルタイム → メモリ
    ↓ (1秒ごと)
IndexedDB（セッション）
    ↓ (ライド完了時)
LocalStorage（履歴）
    ↓ (オプション)
Supabase（クラウド同期）
```

---

## 🚀 Phase 2実装優先順位

### 2-A: 即座実装可能（1-2週間）
1. **HTTPS対応**: mkcert導入
2. **Bluetooth実デバイステスト**: Chrome + パワーメーター
3. **セッションデータ永続化**: IndexedDB実装

### 2-B: 中期実装（1-2ヶ月）
1. **GPXファイル対応**: ドラッグ&ドロップでコース読み込み
2. **ライド履歴機能**: 過去データ表示・比較
3. **パワーゾーン表示**: FTP基準のゾーン色分け

### 2-C: 長期実装（3-6ヶ月）
1. **iOS対応**: Capacitor移行
2. **Supabaseクラウド**: マルチデバイス同期
3. **ソーシャル機能**: ライドシェア・リーダーボード

---

## 🧪 Phase 2テスト計画

### デバイステスト環境
| 機器 | 用途 | 必要性 |
|------|------|--------|
| **Mac + Chrome** | 開発・基本テスト | 必須 |
| **Androidタブレット** | モバイルテスト | 推奨 |
| **パワーメーター** | 実デバイステスト | 必須 |
| **iPhone** | iOS対応確認 | Phase 2-C |

### 実装順序
```
Week 1-2: HTTPS + Bluetooth実テスト
Week 3-4: IndexedDBデータ永続化  
Week 5-6: GPXファイル対応
Week 7-8: ライド履歴・ユーザープロファイル
```

---

## 💡 技術的考慮事項

### セキュリティ
- HTTPS必須（Web Bluetooth要件）
- ローカルデータのみ（プライバシー重視）
- Supabase移行時はRow Level Security

### パフォーマンス  
- 1秒間隔のデータ保存（60fps維持）
- IndexedDB非同期操作
- 大容量GPXファイルのストリーミング処理

### 互換性
- Chrome 56+（Web Bluetooth最低要件）
- iOS対応はCapacitor経由のみ
- PWA対応でアプリライクな体験

---

## 🎯 Phase 2成功指標

### 技術指標
- [ ] パワーメーター実接続成功率 > 95%
- [ ] データ永続化による継続率向上
- [ ] 60fps維持（リアルデータ受信時も）

### ユーザー指標  
- [ ] 5分以上の継続セッション率
- [ ] リアルコースでのリプレイ性
- [ ] 複数デバイスでの一貫した体験

---

**Phase 2開始条件**: v2.8.2の全バグ修正完了 ✅  
**推定期間**: 2-4ヶ月  
**リスク**: iOS対応の技術的複雑さ  
**機会**: プロサイクリスト市場への本格参入

次のステップとしてどの部分から着手しますか？