/*
  src/real-main.js
  - BITRIDERZ REAL v3.0 - 完全リアルデータ専用版
  - ダミーデータ完全削除、センサー必須
  - リアルデータなしでは速度0km/hの完全停止版
*/

import './style.css';
import BluetoothManager from './bluetooth.js';

const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// 画像読み込みシステム（共通）
const images = {
  character: {
    normal: [],
    tired: [],
    fight: [],
    verytired: [],
    downhill: [],
  },
  trees: [],
  mountains: []
};

// 物理計算関数（共通）
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function solveCyclingSpeedKph(powerWatts, gradePercent, totalMass = 70) {
  if (powerWatts <= 0) return 0;
  
  const g = 9.81;
  const mu_rr = 0.005;
  const rho = 1.225;
  const cd_a = 0.3;
  const gradeRadians = Math.atan(gradePercent / 100);
  
  for (let speed = 0; speed <= 100; speed += 0.1) {
    const v_ms = speed / 3.6;
    const powerRolling = mu_rr * totalMass * g * Math.cos(gradeRadians) * v_ms;
    const powerClimbing = totalMass * g * Math.sin(gradeRadians) * v_ms;
    const powerAero = 0.5 * rho * cd_a * v_ms * v_ms * v_ms;
    const requiredPower = powerRolling + powerClimbing + powerAero;
    
    if (requiredPower >= powerWatts) {
      return speed;
    }
  }
  return 100;
}

// キャラクター状態定義
const characterStates = ['normal', 'tired', 'fight', 'verytired', 'downhill'];

// 画像読み込み（エラーハンドリング強化版）
async function loadImages() {
  console.log('画像読み込み開始...');
  
  // キャラクター画像読み込み
  for (const state of characterStates) {
    // 各stateの初期化を確実に行う
    if (!images.character[state]) {
      images.character[state] = [];
    }
    
    for (let i = 1; i <= 2; i++) {
      const img = new Image();
      img.src = `./image/main/${state}/${i}.png`;
      await new Promise((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => {
          console.warn(`画像読み込み失敗: ${img.src}`);
          resolve();
        };
      });
      images.character[state].push(img);
    }
  }
  
  // 木の画像読み込み
  const treeFiles = ['green1.png', 'green2.png', 'pink1.png', 'summer1.png', 'summer2.png', 'yerrow1.png'];
  for (const fileName of treeFiles) {
    const img = new Image();
    img.src = `./image/wood/${fileName}`;
    await new Promise((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => {
        console.warn(`木画像読み込み失敗: ${img.src}`);
        resolve();
      };
    });
    images.trees.push(img);
  }
  
  console.log('画像読み込み完了');
}

// UI要素取得
const powerStatus = document.querySelector('#powerStatus');
const heartStatus = document.querySelector('#heartStatus');
const cadenceStatus = document.querySelector('#cadenceStatus');

const powerButton = document.querySelector('#powerButton');
const heartButton = document.querySelector('#heartButton');
const cadenceButton = document.querySelector('#cadenceButton');
const boostButton = document.querySelector('#boostButton');

// ゲーム状態（リアルモード専用）
const state = {
  elapsed: 0,
  distanceKm: 0,
  roadPhase: 0,
  parallaxPhase: 0,
  boostUntil: 0,
  grade: 0,
  curveDrift: 0,
  telemetry: {
    speed: 0,
    realSpeed: 0,
    power: 0,
    cadence: 0,
    heartRate: 0,
  },
  trackLengthKm: 4.2,
  scenery: [],
  farScenery: [],
  veryFarScenery: [],
  ambientRiders: [],
  // REALモード専用設定
  realMode: true, // 常にリアルモード
  weight: 70, // デフォルト体重
  bluetooth: {
    connected: false,
    realHeartRate: null,
    realPower: null,
    realCadence: null,
  },
  timeOfDay: 0,
  stage: {
    type: 'forest',
    theme: 'peaceful'
  }
};

// デバッグ用: stateをwindowに公開
window.state = state;

// リアル専用テレメトリークラス
class RealTelemetry {
  constructor(appState) {
    this.state = appState;
  }

  update(dt) {
    const s = this.state;
    const t = s.elapsed;

    // 時間帯の更新
    const dayLength = 60; // 1分で1日サイクル
    s.timeOfDay = (t % dayLength) / dayLength;
    const boostActive = t < s.boostUntil;

    // リアルデータ専用処理
    let targetPower = 0;
    let targetCadence = 0;
    let targetHeart = 0;
    let targetRealSpeed = 0;

    // パワーデータ処理
    if (s.bluetooth.realPower !== null) {
      targetPower = s.bluetooth.realPower;
      if (powerStatus) powerStatus.textContent = `${targetPower}W`;
    } else {
      targetPower = 0; // リアルデータなしは0W
      if (powerStatus) powerStatus.textContent = '未接続';
    }

    // 心拍データ処理
    if (s.bluetooth.realHeartRate !== null) {
      targetHeart = s.bluetooth.realHeartRate;
      if (heartStatus) heartStatus.textContent = `${targetHeart}bpm`;
    } else {
      targetHeart = 0; // リアルデータなしは0bpm
      if (heartStatus) heartStatus.textContent = '未接続';
    }

    // ケイデンスデータ処理
    if (s.bluetooth.realCadence !== null) {
      targetCadence = s.bluetooth.realCadence;
      if (cadenceStatus) cadenceStatus.textContent = `${targetCadence}rpm`;
    } else {
      targetCadence = 0; // リアルデータなしは0rpm
      if (cadenceStatus) cadenceStatus.textContent = '未接続';
    }

    // 斜度は自動生成（将来的にスマートローラーから取得）
    const baseGrade = Math.sin(t * 0.075) * 8.0 + Math.sin(t * 0.031 + 1.4) * 5.5;
    s.grade = clamp(baseGrade, -20, 25);

    // 実パワーから速度を逆算（リアルデータ必須）
    if (targetPower > 0) {
      targetRealSpeed = solveCyclingSpeedKph(targetPower, s.grade, s.weight);
      console.log(`🚴 REAL速度計算: ${targetRealSpeed.toFixed(1)}km/h (${targetPower}W, ${s.grade.toFixed(1)}%)`);
    } else {
      targetRealSpeed = 0; // パワー0なら完全停止
      console.log(`⚠️ センサー未接続: 速度0km/h`);
    }

    // ブーストボーナス
    if (boostActive) {
      targetRealSpeed *= 1.2;
      console.log(`🚀 BOOST効果: ${targetRealSpeed.toFixed(1)}km/h`);
    }

    // スムージング
    const smoothing = 0.96;
    s.telemetry.power = s.telemetry.power * smoothing + targetPower * (1 - smoothing);
    s.telemetry.cadence = s.telemetry.cadence * smoothing + targetCadence * (1 - smoothing);
    s.telemetry.heartRate = s.telemetry.heartRate * smoothing + targetHeart * (1 - smoothing);
    s.telemetry.realSpeed = s.telemetry.realSpeed * smoothing + targetRealSpeed * (1 - smoothing);
    s.telemetry.speed = s.telemetry.realSpeed;

    // 距離計算
    s.distanceKm += (s.telemetry.realSpeed / 3600) * dt;
    s.roadPhase += (s.telemetry.realSpeed / 3600) * dt * 20;
    s.parallaxPhase += (s.telemetry.realSpeed / 3600) * dt * 8;
  }
}

// シンプルなレンダラー（数式描画メイン）
class RealRenderer {
  constructor(context, appState) {
    this.ctx = context;
    this.state = appState;
  }

  render() {
    const { width, height } = this.ctx.canvas;
    const s = this.state;

    // 背景クリア
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, width, height);

    // 道路描画
    this.drawRoad();

    // プレイヤー描画（数式メイン）
    this.drawPlayer();

    // 風景描画（数式）
    this.drawScenery();
  }

  drawRoad() {
    const { width, height } = this.ctx.canvas;
    const s = this.state;
    
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(0, height - 100, width, 100);
    
    // 斜度表示
    this.ctx.fillStyle = '#666';
    this.ctx.fillRect(width - 200, height - 120, 180, 20);
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '14px monospace';
    this.ctx.fillText(`Grade: ${s.grade.toFixed(1)}%`, width - 190, height - 107);
  }

  drawPlayer() {
    const { width, height } = this.ctx.canvas;
    const s = this.state;
    
    const x = width / 2;
    const y = height - 200;
    
    // プレイヤーを数式で描画
    this.ctx.fillStyle = '#ff6b6b';
    this.ctx.fillRect(x - 20, y - 40, 40, 40);
    
    // 速度表示
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '16px monospace';
    this.ctx.fillText(`${s.telemetry.speed.toFixed(1)} km/h`, x - 40, y - 50);
  }

  drawScenery() {
    const { width, height } = this.ctx.canvas;
    const s = this.state;
    
    // 背景の山々を数式で描画
    for (let i = 0; i < 10; i++) {
      const x = (i * 100 + s.parallaxPhase * 10) % (width + 200) - 100;
      const h = 50 + Math.sin(i * 0.5) * 30;
      
      this.ctx.fillStyle = '#4a4a6a';
      this.ctx.fillRect(x, height - 200 - h, 80, h);
    }
  }
}

// 初期化とメインループ
async function init() {
  await loadImages();
  
  const telemetry = new RealTelemetry(state);
  const renderer = new RealRenderer(ctx, state);
  
  // 安全なイベントリスナー追加
  if (boostButton) {
    boostButton.addEventListener('click', () => {
      state.boostUntil = state.elapsed + 4.2;
    });
  }

  // Bluetooth初期化
  const bluetoothManager = new BluetoothManager();
  
  bluetoothManager.setCallbacks({
    onHeartRateData: (hr) => {
      console.log(`💗 Heart Rate: ${hr} bpm`);
      state.bluetooth.realHeartRate = hr;
      state.bluetooth.connected = true;
      window.state = state;
    },
    
    onPowerData: (power) => {
      console.log(`⚡ Power: ${power} W`);
      state.bluetooth.realPower = power;
      state.bluetooth.connected = true;
      window.state = state;
    },
    
    onCadenceData: (cadence) => {
      console.log(`🔄 Cadence: ${cadence} rpm`);
      state.bluetooth.realCadence = cadence;
      state.bluetooth.connected = true;
      window.state = state;
    },
    
    onDeviceDisconnected: () => {
      console.log('📱 デバイス切断');
      state.bluetooth.connected = false;
      state.bluetooth.realHeartRate = null;
      state.bluetooth.realPower = null;
      state.bluetooth.realCadence = null;
    }
  });

  // Bluetooth接続ボタン
  if (powerButton) {
    powerButton.addEventListener('click', async () => {
      console.log('🔗 Power接続開始');
      try {
        powerButton.textContent = '接続中...';
        const device = await bluetoothManager.connectDevice();
        powerButton.textContent = '✅接続済み';
        console.log(`🎉 接続成功: ${device.name}`);
      } catch (error) {
        console.error('❌ 接続エラー:', error);
        powerButton.textContent = 'PWR接続';
      }
    });
  }

  if (heartButton) {
    heartButton.addEventListener('click', () => {
      heartButton.textContent = '開発中...';
      setTimeout(() => heartButton.textContent = 'HR接続', 2000);
    });
  }

  if (cadenceButton) {
    cadenceButton.addEventListener('click', () => {
      cadenceButton.textContent = '開発中...';
      setTimeout(() => cadenceButton.textContent = 'CAD接続', 2000);
    });
  }

  // HUD更新関数
  function updateHud() {
    const { speed, power, cadence, heartRate } = state.telemetry;
    
    document.querySelector('#speedValue').textContent = speed.toFixed(1);
    document.querySelector('#powerValue').textContent = Math.round(power);
    document.querySelector('#cadenceValue').textContent = Math.round(cadence);
    document.querySelector('#heartValue').textContent = Math.round(heartRate);
    document.querySelector('#gradeValue').textContent = `${state.grade >= 0 ? '+' : ''}${state.grade.toFixed(1)}%`;
    
    const minutes = Math.floor(state.elapsed / 60);
    const seconds = Math.floor(state.elapsed % 60);
    document.querySelector('#timerValue').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    document.querySelector('#distanceValue').textContent = state.distanceKm.toFixed(2);
    
    // プログレスバー
    document.querySelector('#speedBar').style.width = `${Math.min(speed / 60 * 100, 100)}%`;
    document.querySelector('#powerBar').style.width = `${Math.min(power / 400 * 100, 100)}%`;
  }

  // メインループ
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    state.elapsed += dt;
    telemetry.update(dt);
    renderer.render();
    updateHud();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

init();