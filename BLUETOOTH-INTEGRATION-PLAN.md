# Bluetooth統合計画 - 慎重実装アプローチ

## 🚨 過去の失敗から学ぶ

### 前回の失敗パターン（記録・分析）
```
1. Bluetooth機能実装
2. "接続" まで成功
3. HRダミーデータ解除を試行
4. → ゲーム全体停止・フリーズ
5. → 復旧不可、リバート必要

原因推定:
- ダミーデータ生成ロジックの削除
- 実データ受信コールバックの未実装
- データフロー断絶による undefined エラー
```

### 🎯 今回の慎重アプローチ

#### 段階的実装戦略（バックアップ必須）
```
Phase A: 現在のダミーシステム維持
Phase B: Bluetooth接続のみ（データ流用なし）
Phase C: リアルデータとダミーの共存
Phase D: 段階的ダミー削除
```

---

## 📋 現在のダミーデータシステム分析

### ダミーデータ生成箇所の特定
```javascript
// src/main.js 現在のダミー生成（削除厳禁）
function updateSimulation(dt) {
  const t = state.elapsed;
  
  // パワーダミーデータ（sine波）
  const powerWaveA = Math.sin(t * 0.64) * 20;
  const powerWaveB = Math.sin(t * 0.18 + 0.9) * 26;
  let targetPower = basePower + powerWaveA + powerWaveB;
  
  // 心拍ダミーデータ  
  targetHeart = targetRealSpeed === 0 ? 72 : clamp(88 + targetPower * 0.16, 88, 182);
  
  // ケイデンスダミーデータ
  targetCadence = targetRealSpeed === 0 ? 0 : clamp(58 + targetRealSpeed * 0.72, 58, 118);
  
  // テレメトリー更新（重要：この流れを維持）
  s.telemetry.power = damp(s.telemetry.power, targetPower, 0.08);
  s.telemetry.heartRate = damp(s.telemetry.heartRate, targetHeart, 0.08);
  s.telemetry.cadence = damp(s.telemetry.cadence, targetCadence, 0.12);
}
```

### HUD表示システム（既存）
```javascript
// updateHud() - 既存の表示ロジック
function updateHud() {
  const { speed, power, cadence, heartRate } = state.telemetry;
  
  hud.power.textContent = `${Math.round(power)}w (${powerToWeight.toFixed(1)} W/kg)`;
  hud.cadence.textContent = Math.round(cadence).toString();
  hud.heart.textContent = Math.round(heartRate).toString(); // ← ここが変更対象
  
  // 心拍色変更（既存ロジック維持）
  if (heartRate > 148) {
    hud.heart.style.color = palette.heartDanger;
  } else {
    hud.heart.style.color = '#ffd76b';
  }
}
```

---

## 🔗 Bluetooth統合アプローチ

### Phase A: 接続状態管理の実装（安全第一）

#### 1. Bluetooth Manager インスタンス化
```javascript
// src/main.js に追加（ダミーに影響しない）
import BluetoothManager from './bluetooth.js';

const bluetoothManager = new BluetoothManager();
let bluetoothConnected = false; // 接続状態フラグ
let realHeartRate = null;       // 実データ（null = 未接続）
let realPower = null;
let realCadence = null;
```

#### 2. 接続状態表示（UI先行実装）
```javascript
// updateHud() 修正案（安全版）
function updateHud() {
  const { speed, power, cadence, heartRate } = state.telemetry;
  
  // 心拍表示：接続状態で分岐
  if (bluetoothConnected && realHeartRate !== null) {
    hud.heart.textContent = Math.round(realHeartRate).toString();
  } else if (bluetoothConnected) {
    hud.heart.textContent = '--'; // 接続済みだがデータなし
  } else {
    hud.heart.textContent = Math.round(heartRate).toString(); // ダミー継続
  }
  
  // パワー・ケイデンスも同様の安全な分岐
  // ... 既存ダミーロジックは絶対に削除しない
}
```

#### 3. Bluetooth接続UI（既存ボタン流用）
```javascript
// 既存のbluetoothButtonを活用
bluetoothButton.addEventListener('click', async () => {
  try {
    bluetoothButton.textContent = '接続中...';
    
    const device = await bluetoothManager.connectDevice();
    bluetoothConnected = true;
    
    bluetoothButton.textContent = '✅接続済み';
    bluetoothButton.classList.add('bluetooth-connected');
    
    console.log(`デバイス接続成功: ${device.name}`);
  } catch (error) {
    console.error('接続失敗:', error);
    bluetoothButton.textContent = '❌接続失敗';
    
    // 5秒後にリセット
    setTimeout(() => {
      bluetoothButton.textContent = 'BT接続';
    }, 5000);
  }
});
```

### Phase B: コールバック実装（データ受信）

#### 実データ受信ハンドラー
```javascript
// BluetoothManagerコールバック設定
bluetoothManager.setCallbacks({
  onHeartRateData: (hr) => {
    console.log(`Heart Rate: ${hr} bpm`);
    realHeartRate = hr; // グローバル変数に保存
    // ダミー生成は継続、表示のみ実データ使用
  },
  
  onPowerData: (power) => {
    console.log(`Power: ${power} W`);
    realPower = power;
    // 物理計算には影響させない（Phase C以降）
  },
  
  onCadenceData: (cadence) => {
    console.log(`Cadence: ${cadence} rpm`);
    realCadence = cadence;
  },
  
  onDeviceConnected: (deviceName) => {
    console.log(`デバイス接続: ${deviceName}`);
  },
  
  onDeviceDisconnected: (deviceName) => {
    console.log(`デバイス切断: ${deviceName}`);
    bluetoothConnected = false;
    realHeartRate = null;
    realPower = null;
    realCadence = null;
    
    bluetoothButton.textContent = 'BT接続';
    bluetoothButton.classList.remove('bluetooth-connected');
  }
});
```

### Phase C: ゲームロジック統合（最注意）

#### 慎重な実データ統合
```javascript
// updateSimulation() 修正版（ダミー保持）
function updateSimulation(dt) {
  // 既存ダミー生成は削除しない（フォールバック用）
  const dummyHeart = targetRealSpeed === 0 ? 72 : clamp(88 + targetPower * 0.16, 88, 182);
  
  // 実データがあればそちらを使用、なければダミー
  const finalHeartRate = (bluetoothConnected && realHeartRate !== null) 
    ? realHeartRate 
    : dummyHeart;
    
  // テレメトリー更新（既存フロー維持）
  s.telemetry.heartRate = damp(s.telemetry.heartRate, finalHeartRate, 0.08);
  
  // パワー統合（Phase D以降）
  // const finalPower = (bluetoothConnected && realPower !== null) ? realPower : targetPower;
}
```

---

## 🛡️ 安全措置・テスト計画

### 必須バックアップポイント
```bash
# Phase毎にバックアップ作成
cp src/main.js backup_phase_A_main.js
cp src/bluetooth.js backup_phase_A_bluetooth.js

# Git タグでも保護
git tag -a "v2.8.2-stable" -m "Bluetooth統合前の安定版"
```

### 段階的テスト手順
```
1. Phase A実装 → localhost動作確認（ダミーデータ維持）
2. Bluetoothボタンクリック → 接続UI確認（ゲーム動作継続）
3. 心拍計接続 → "--"表示確認（ダミー影響なし）
4. 実データ受信 → コンソールログ確認（表示のみ）
5. フリーズ・エラーなし確認 → Phase B移行
```

### 🚨 緊急時ロールバック
```javascript
// 最悪の場合の即座復旧
const EMERGENCY_ROLLBACK = () => {
  bluetoothConnected = false;
  realHeartRate = null;
  realPower = null;
  realCadence = null;
  console.log("緊急ロールバック: ダミーデータに復帰");
};

// エラー検出時自動実行
window.addEventListener('error', (event) => {
  if (event.error.message.includes('bluetooth')) {
    EMERGENCY_ROLLBACK();
  }
});
```

---

## 🌐 GitHub Pages デプロイ戦略

### HTTPS要件対応
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [ main ]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install and Build
        run: |
          npm install
          npm run build
      - name: Deploy
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### GitHub Pages URL
```
https://[username].github.io/retro272/
# ↑ 自動HTTPS、Web Bluetooth対応
```

---

## 📝 実装チェックリスト

### Phase A: 基盤準備
- [ ] BluetoothManager import追加
- [ ] 接続状態フラグ追加
- [ ] 既存UI修正（表示分岐）
- [ ] ダミーデータ完全保持確認
- [ ] localhost動作確認

### Phase B: 接続機能
- [ ] bluetoothButtonイベント追加
- [ ] コールバック実装
- [ ] エラーハンドリング
- [ ] 切断処理
- [ ] 実機接続テスト

### Phase C: データ統合
- [ ] 心拍データ統合
- [ ] ダミーフォールバック維持
- [ ] パワーデータ統合（慎重）
- [ ] 物理計算影響確認

---

## 🎯 成功指標

### 技術指標
- [ ] 接続成功率 > 90%
- [ ] ゲームフリーズゼロ
- [ ] 60fps維持（Bluetooth動作時も）
- [ ] ダミー→リアル切り替えシームレス

### ユーザー体験指標  
- [ ] HR表示："--" ↔ "162bpm" 切り替え
- [ ] パワー表示：実データ反映
- [ ] エフェクト：実データ連動
- [ ] キャラフォーム：実パワー反応

---

**重要**: 前回の失敗を絶対に繰り返さないよう、各Phaseで必ず動作確認し、問題があれば即座に前のPhaseに戻る。

どのPhaseから開始しますか？ まずはPhase A（基盤準備）を安全に実装することを推奨します。