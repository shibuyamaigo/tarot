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

// ゲーム状態（リアルモード専用）
const state = {
  elapsed: 0,
  distanceKm: 0,
  roadPhase: 0,
  parallaxPhase: 0,
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
    this.lastLogTime = 0; // ログ制御用
  }

  update(dt) {
    const s = this.state;
    const t = s.elapsed;

    // 時間帯の更新
    const dayLength = 60; // 1分で1日サイクル
    s.timeOfDay = (t % dayLength) / dayLength;

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

    // 斜度制御（停止時は固定、走行時は距離ベースで変化）
    if (s.telemetry.speed > 1.0) {
      // 走行中：距離ベースで斜度変化（より自然）
      const distancePhase = s.distanceKm * 0.5; // 2kmごとに1周期
      const baseGrade = Math.sin(distancePhase * 0.8) * 6.0 + Math.sin(distancePhase * 0.3 + 1.2) * 4.0;
      s.grade = clamp(baseGrade, -15, 20);
    } else {
      // 停止中：斜度を徐々に平坦化（自然な停止）
      s.grade = s.grade * 0.995; // 緩やかに0%に戻る
      if (Math.abs(s.grade) < 0.1) s.grade = 0;
    }

    // 実パワーから速度を逆算（リアルデータ必須）
    if (targetPower > 0) {
      targetRealSpeed = solveCyclingSpeedKph(targetPower, s.grade, s.weight);
      
      // 1秒に1回だけログ出力
      if (t - this.lastLogTime >= 1.0) {
        console.log(`🚴 REAL速度計算: ${targetRealSpeed.toFixed(1)}km/h (${targetPower}W, ${s.grade.toFixed(1)}%)`);
        this.lastLogTime = t;
      }
    } else {
      targetRealSpeed = 0; // パワー0なら完全停止
      
      // 停止時も1秒に1回だけ
      if (t - this.lastLogTime >= 1.0) {
        console.log(`⚠️ センサー未接続: 速度0km/h`);
        this.lastLogTime = t;
      }
    }

    // BOOSTは削除済み - 完全リアルデータ専用

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

    // 時間帯に応じた背景グラデーション
    const timeColor = this.getTimeColor(s.timeOfDay);
    this.drawSkyGradient(timeColor);

    // 遠景→近景の順で描画
    this.drawMountains();
    this.drawScenery();
    this.drawRoad();
    this.drawPlayer();
    
    // UI要素
    this.drawStatusOverlay();
  }

  getTimeColor(timeOfDay) {
    // 0=朝, 0.25=昼, 0.5=夕, 0.75=夜, 1=朝
    if (timeOfDay < 0.25) {
      return { top: '#87CEEB', bottom: '#E0F6FF' }; // 朝
    } else if (timeOfDay < 0.5) {
      return { top: '#87CEFA', bottom: '#F0F8FF' }; // 昼
    } else if (timeOfDay < 0.75) {
      return { top: '#FF6347', bottom: '#FFE4B5' }; // 夕
    } else {
      return { top: '#191970', bottom: '#483D8B' }; // 夜
    }
  }

  drawSkyGradient(colors) {
    const { width, height } = this.ctx.canvas;
    const gradient = this.ctx.createLinearGradient(0, 0, 0, height * 0.6);
    gradient.addColorStop(0, colors.top);
    gradient.addColorStop(1, colors.bottom);
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height * 0.6);
  }

  drawMountains() {
    const { width, height } = this.ctx.canvas;
    const s = this.state;
    
    // 遠景の山々
    this.ctx.fillStyle = '#6B7280';
    for (let i = 0; i < 8; i++) {
      const x = (i * 120 + s.parallaxPhase * 3) % (width + 200) - 100;
      const h = 80 + Math.sin(i * 0.7) * 40;
      
      // 三角形の山
      this.ctx.beginPath();
      this.ctx.moveTo(x, height * 0.6);
      this.ctx.lineTo(x + 60, height * 0.6 - h);
      this.ctx.lineTo(x + 120, height * 0.6);
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  drawScenery() {
    const { width, height } = this.ctx.canvas;
    const s = this.state;
    
    // 中景の木々
    this.ctx.fillStyle = '#22C55E';
    for (let i = 0; i < 15; i++) {
      const x = (i * 60 + s.parallaxPhase * 8) % (width + 100) - 50;
      const h = 30 + Math.sin(i * 0.8 + s.elapsed * 0.1) * 10;
      
      // シンプルな木の形
      this.ctx.fillRect(x + 20, height * 0.7 - h, 20, h); // 幹
      this.ctx.beginPath();
      this.ctx.arc(x + 30, height * 0.7 - h, 25, 0, Math.PI * 2); // 葉
      this.ctx.fill();
    }
  }

  drawRoad() {
    const { width, height } = this.ctx.canvas;
    const s = this.state;
    
    // 道路面
    this.ctx.fillStyle = '#374151';
    this.ctx.fillRect(0, height * 0.75, width, height * 0.25);
    
    // 道路の白線（動的）
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 4;
    this.ctx.setLineDash([20, 20]);
    this.ctx.lineDashOffset = -s.roadPhase * 40;
    
    this.ctx.beginPath();
    this.ctx.moveTo(0, height * 0.85);
    this.ctx.lineTo(width, height * 0.85);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
  }

  drawPlayer() {
    const { width, height } = this.ctx.canvas;
    const s = this.state;
    
    const x = width / 2;
    const y = height * 0.8;
    const speed = s.telemetry.speed;
    
    // サイクリストのシンプル表現
    this.ctx.fillStyle = speed > 0 ? '#EF4444' : '#9CA3AF'; // 動作時は赤、停止時はグレー
    
    // 車体
    this.ctx.fillRect(x - 30, y - 20, 60, 15);
    
    // ホイール（回転表現）
    const wheelRotation = s.roadPhase * 10;
    this.ctx.strokeStyle = '#1F2937';
    this.ctx.lineWidth = 3;
    
    // 前輪
    this.ctx.beginPath();
    this.ctx.arc(x + 20, y - 10, 12, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(x + 20 + Math.cos(wheelRotation) * 8, y - 10 + Math.sin(wheelRotation) * 8);
    this.ctx.lineTo(x + 20 - Math.cos(wheelRotation) * 8, y - 10 - Math.sin(wheelRotation) * 8);
    this.ctx.stroke();
    
    // 後輪
    this.ctx.beginPath();
    this.ctx.arc(x - 20, y - 10, 12, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(x - 20 + Math.cos(wheelRotation) * 8, y - 10 + Math.sin(wheelRotation) * 8);
    this.ctx.lineTo(x - 20 - Math.cos(wheelRotation) * 8, y - 10 - Math.sin(wheelRotation) * 8);
    this.ctx.stroke();
  }

  drawStatusOverlay() {
    const { width, height } = this.ctx.canvas;
    const s = this.state;
    
    // 半透明オーバーレイ
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(10, 10, 300, 80);
    
    // ステータステキスト
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '16px monospace';
    this.ctx.fillText(`速度: ${s.telemetry.speed.toFixed(1)} km/h`, 20, 30);
    this.ctx.fillText(`パワー: ${Math.round(s.telemetry.power)} W`, 20, 50);
    this.ctx.fillText(`斜度: ${s.grade >= 0 ? '+' : ''}${s.grade.toFixed(1)}%`, 20, 70);
  }
}

// 初期化とメインループ
async function init() {
  await loadImages();
  
  const telemetry = new RealTelemetry(state);
  const renderer = new RealRenderer(ctx, state);
  
  // BOOST削除済み - リアルデータのみに集中

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