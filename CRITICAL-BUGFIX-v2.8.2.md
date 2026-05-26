# RetroRide v2.8.2 緊急バグ修正ログ

## 🚨 CRITICAL: ゲーム本質に関わる重大バグ群

### 📋 修正サマリー
**発生日時**: 2026-05-26 19:20  
**重要度**: Game Breaking  
**影響範囲**: 物理計算・エフェクト・UI レスポンシブ  
**発見者**: ユーザー体験テスト中発見  

---

## 🔴 バグ 1: 体重がパワー計算に反映されない

### 症状
- TEST MODEで体重変更してもパワー計算が変わらない
- 同じパワーで登坂可能（ゲームバランス破綻）
- パワーウェイトレシオ表示は変わるが実質影響なし

### 根本原因
**物理計算関数の固定値問題**:
```javascript
// ❌ 問題のあるコード
function estimateCyclingPowerWatts(speedKph, gradePercent) {
  const totalMass = 82; // ← 固定値！
}

function solveCyclingSpeedKph(powerWatts, gradePercent) {
  const totalMass = 82; // ← 固定値！
}
```

### 修正内容
```javascript
// ✅ 修正後
function estimateCyclingPowerWatts(speedKph, gradePercent, weightKg = 70) {
  const bikeWeight = 12; // 自転車重量
  const totalMass = weightKg + bikeWeight; // 動的計算
}

function solveCyclingSpeedKph(powerWatts, gradePercent, weightKg = 70) {
  const bikeWeight = 12; // 自転車重量  
  const totalMass = weightKg + bikeWeight; // 動的計算
}

// 呼び出し側も修正
targetPower = estimateCyclingPowerWatts(targetRealSpeed, s.grade, s.debug.weight || 70);
targetRealSpeed = solveCyclingSpeedKph(targetPower, s.grade, s.debug.weight || 70);
```

### ゲームへの影響
- **修正前**: 体重40kgでも90kgでも同じパワーで登れる（ゲーム破綻）
- **修正後**: 軽い選手ほど登坂有利、重い選手ほど平地有利（リアル）

---

## 🔴 バグ 2: 稲妻エフェクト消失

### 症状
- 超高強度（8.0W/kg以上）でも稲妻エフェクトが出ない
- PWRオーラ削除時に誤って稲妻呼び出しも削除

### 修正内容
```javascript
// ✅ 稲妻エフェクト復活
// 超高強度時の稲妻エフェクト（8.0W/kg以上）
if (powerToWeight >= 8.0) {
  this.drawSprintFlash(this.state.elapsed);
}
```

---

## 🔴 バグ 3: レスポンシブでTEST MODE消失

### 症状
- 画面幅980px以下でTEST MODEウィンドウが消える
- `position: static` により絶対位置が無効化

### 修正内容
```css
/* ❌ 問題のあるCSS */
@media (max-width: 980px) {
  .test-dock {
    position: static; /* ← 絶対位置を無効化 */
    margin-top: 8px;
  }
}

/* ✅ 修正後 */
@media (max-width: 980px) {
  .test-dock {
    position: absolute; /* 絶対位置維持 */
    left: 10px;
    right: 10px;
    bottom: 10px;
    margin-top: 0;
  }
}
```

---

## 💡 技術的教訓

### 1. 物理計算パラメータの管理
```javascript
// 🚀 Best Practice: 設定の外部化
const PHYSICS_CONFIG = {
  bikeWeight: 12,
  defaultRiderWeight: 70,
  airDensity: 1.226,
  dragCoefficient: 0.34,
  rollingResistance: 0.0055,
  drivetrainEfficiency: 0.97
};
```

### 2. エフェクト削除時の影響範囲確認
- 関数削除時は呼び出し元を全て確認
- 条件分岐内の処理も見落としやすい

### 3. レスポンシブ設計の原則
- 重要UI要素は全ブレークポイントで確認
- `position: static` は絶対位置を無効化

---

## ✅ 動作確認項目

### 体重計算確認
- [ ] 体重40kg → 登坂パワー低下確認
- [ ] 体重90kg → 登坂パワー増加確認  
- [ ] 平地での重量による差確認

### エフェクト確認
- [ ] 8.0W/kg以上で稲妻発動
- [ ] 画面フラッシュ効果
- [ ] ランダム稲妻描画

### レスポンシブ確認
- [ ] 980px以下でTEST MODE表示
- [ ] 720px以下でTEST MODE表示
- [ ] 各ブレークポイントでUI崩れなし

---

## 🔒 今後の予防策

### 開発チェックリスト拡張
```
✅ 物理計算関数の引数確認
✅ 固定値の動的化
✅ エフェクト削除時の影響範囲確認
✅ 全ブレークポイントでのUI確認
✅ ゲームバランスへの影響評価
```

### コードレビューポイント
1. **関数の引数**: 固定値が混入していないか
2. **エフェクト系**: 削除時の呼び出し元確認
3. **CSS メディアクエリ**: 重要要素の表示確認
4. **ゲームロジック**: バランス変更の意図確認

---

## 📊 影響度評価

| バグ | ユーザー影響 | ビジネス影響 | 修正難易度 |
|------|-------------|-------------|-----------|
| 体重計算無効 | 🔴 ゲーム破綻 | 🔴 極大 | 🟡 中 |
| 稲妻エフェクト | 🟡 体験低下 | 🟡 小 | 🟢 易 |
| レスポンシブ | 🟠 機能制限 | 🟠 中 | 🟢 易 |

**総合評価**: 🔴 緊急対応必須

---

**修正担当**: Claude Code Assistant  
**修正完了**: 2026-05-26 19:25  
**テスト環境**: localhost:5175  
**関連ファイル**: src/main.js (物理計算), src/style.css (レスポンシブ)

---

## 🎯 次回開発時の注意点

1. **物理計算変更時は必ずゲームバランステスト**
2. **エフェクト系変更時は視覚確認必須**  
3. **CSS変更時は全デバイスサイズでテスト**
4. **CLAUDE.md のチェックリスト活用**

この経験を活かして、より堅牢な開発プロセスを構築していく。