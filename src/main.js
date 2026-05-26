/*
  src/main.js
  - v2.8.6 - 画像エラー緊急修正版
  - 破損画像による描画エラーでゲーム停止する問題を修正
  - try-catch + フォールバック処理で安全な描画を保証
  - リアル心拍データ統合のPhase C実装継続中
  - AUTO と MANUAL を切り替え、速度と斜度を直接テストできます。
*/

import './style.css';
import BluetoothManager from './bluetooth.js';

const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

// 画像読み込みシステム
const images = {
  character: {
    normal: [],
    tired: [],
    fight: [], 
    verytired: [],
    downhill: []
  },
  trees: [],
  scenery: {
    houses: [],
    signs: [],
    flowers: []
  }
};

let imagesLoaded = false;

// 画像を非同期で読み込み
async function loadImages() {
  try {
    console.log('画像読み込み開始...');
    
    // キャラクター画像読み込み（5段階フォーム）
    const characterStates = ['normal', 'tired', 'fight', 'verytired', 'downhill'];
    for (const state of characterStates) {
      for (let i = 1; i <= 2; i++) {
        const img = new Image();
        img.src = `./image/main/${state}/${i}.png`;
        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => {
            console.warn(`画像読み込み失敗: ${img.src}`);
            resolve(); // エラーでも続行
          };
        });
        images.character[state].push(img);
      }
    }
    
    // 木の画像読み込み（新しいファイル名対応）
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
    
    // 建物の画像読み込み
    const houseImg = new Image();
    houseImg.src = `./image/etc/house1.png`;
    await new Promise((resolve) => {
      houseImg.onload = () => resolve();
      houseImg.onerror = () => {
        console.warn(`建物画像読み込み失敗: ${houseImg.src}`);
        resolve();
      };
    });
    images.scenery.houses.push(houseImg);
    
    // 看板の画像読み込み
    const signFiles = ['hyoushiki1.png', 'caution.png'];
    for (const fileName of signFiles) {
      const img = new Image();
      img.src = `./image/etc/${fileName}`;
      await new Promise((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => {
          console.warn(`看板画像読み込み失敗: ${img.src}`);
          resolve();
        };
      });
      images.scenery.signs.push(img);
    }
    
    // 花の画像読み込み
    const flowerFiles = ['pink.png', 'white.png', 'yerrow.png'];
    for (const fileName of flowerFiles) {
      const img = new Image();
      img.src = `./image/etc/flower/${fileName}`;
      await new Promise((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => {
          console.warn(`花画像読み込み失敗: ${img.src}`);
          resolve();
        };
      });
      images.scenery.flowers.push(img);
    }
    
    imagesLoaded = true;
    console.log('画像読み込み完了');
    
  } catch (error) {
    console.error('画像読み込みエラー:', error);
    console.log('数式描画にフォールバック');
    imagesLoaded = false;
  }
}

// 画像読み込み開始
loadImages();

const hud = {
  speed: document.querySelector('#speedValue'),
  power: document.querySelector('#powerValue'),
  cadence: document.querySelector('#cadenceValue'),
  heart: document.querySelector('#heartValue'),
  grade: document.querySelector('#gradeValue'),
  distance: document.querySelector('#distanceValue'),
  timer: document.querySelector('#timerValue'),
  speedBar: document.querySelector('#speedBar'),
  powerBar: document.querySelector('#powerBar'),
  courseDot: document.querySelector('#courseDot'),
};

// デバッグ: 全要素の存在確認
const boostButton = document.querySelector('#boostButton');
const autoModeButton = document.querySelector('#autoModeButton');
const manualModeButton = document.querySelector('#manualModeButton');
const realModeButton = document.querySelector('#realModeButton');
const powerButton = document.querySelector('#powerButton');
const heartButton = document.querySelector('#heartButton');
const cadenceButton = document.querySelector('#cadenceButton');
const speedSlider = document.querySelector('#speedSlider');
const speedSliderValue = document.querySelector('#speedSliderValue');
const gradeSlider = document.querySelector('#gradeSlider');
const gradeSliderValue = document.querySelector('#gradeSliderValue');
const weightSlider = document.querySelector('#weightSlider');
const weightSliderValue = document.querySelector('#weightSliderValue');
const presetChips = Array.from(document.querySelectorAll('.preset-chip'));

console.log('=== 要素存在確認 ===');
console.log('boostButton:', boostButton);
console.log('autoModeButton:', autoModeButton);
console.log('manualModeButton:', manualModeButton);
console.log('realModeButton:', realModeButton);
console.log('powerButton:', powerButton);
console.log('heartButton:', heartButton);
console.log('cadenceButton:', cadenceButton);
console.log('speedSlider:', speedSlider);
console.log('gradeSlider:', gradeSlider);
console.log('weightSlider:', weightSlider);
console.log('presetChips length:', presetChips.length);
console.log('==================');

const palette = {
  skyTop: '#6d9dff',
  skyBottom: '#9fd0ff',
  sun: '#fff2bf',
  cloud: '#f8fbff',
  mountainFar: '#27456f',
  mountainNear: '#1a3517',
  mountainNear2: '#0f2612',
  grassA: '#168312',
  grassB: '#1d9417',
  roadA: '#6f7078',
  roadB: '#65666d',
  shoulderA: '#8a4815',
  shoulderB: '#9e561e',
  white: '#f7f8fb',
  poleRed: '#d64747',
  signText: '#616b76',
  heartDanger: '#ff8484',
};

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
  scenery: [], // メインシーナリー（道路近く）
  farScenery: [], // 遠景シーナリー（50%サイズ、遅い）
  veryFarScenery: [], // 超遠景シーナリー（25%サイズ、さらに遅い）
  ambientRiders: [],
  debug: {
    manual: false,
    realMode: false,
    manualSpeed: 40,
    manualGrade: 0,
    weight: 70,
    fastDayNight: true, // true=1分で1日、false=1時間で1日
  },
  // Phase A: Bluetooth基盤（安全実装）
  bluetooth: {
    connected: false,
    realHeartRate: null,
    realPower: null,
    realCadence: null,
  },
  timeOfDay: 0, // 0-1 (0=朝, 0.25=昼, 0.5=夕, 0.75=夜, 1=朝)
  stage: {
    type: 'forest', // forest, city, mountain, beach
    theme: 'peaceful' // peaceful, busy, challenging
  }
};

// デバッグ用: stateをwindowに公開
window.state = state;

seedScenery();
seedFarScenery();
seedAmbientRiders();

class DummyTelemetry {
  constructor(appState) {
    this.state = appState;
  }

  update(dt) {
    const s = this.state;
    
    // REALモード：漕いでいる時間のみTIME加算
    if (s.debug.realMode) {
      if (s.telemetry.speed > 0.5) {
        s.elapsed += dt; // 走行中のみ時間カウント
      }
    } else {
      s.elapsed += dt; // 通常モードは常時カウント
    }
    
    const t = s.elapsed;
    
    // 時間帯の更新
    const dayLength = s.debug.fastDayNight ? 60 : 3600; // 60秒 or 3600秒(1時間)
    s.timeOfDay = (t % dayLength) / dayLength;
    const boostActive = t < s.boostUntil;

    const powerWaveA = Math.sin(t * 0.64) * 20;
    const powerWaveB = Math.sin(t * 0.18 + 0.9) * 26;
    const cadenceWave = Math.sin(t * 1.08 + 0.1) * 4;
    const heartWave = Math.sin(t * 0.41 + 1.1) * 6;
    const boostPower = boostActive ? 90 : 0;

    let targetPower = 198 + powerWaveA + powerWaveB + boostPower;
    let targetCadence = 84 + cadenceWave + (boostActive ? 8 : 0);
    
    // Phase C: リアル心拍データの統合（安全実装）
    let targetHeart;
    if (s.bluetooth.connected && s.bluetooth.realHeartRate !== null) {
      targetHeart = s.bluetooth.realHeartRate; // リアルデータを使用
      console.log(`✅ リアル心拍使用: ${targetHeart} bpm`);
    } else {
      targetHeart = 130 + heartWave + (boostActive ? 7 : 0); // ダミーデータ
      console.log(`⚠️ ダミー心拍使用: Bluetooth接続=${s.bluetooth.connected}, リアルHR=${s.bluetooth.realHeartRate}`);
    }
    
    let targetRealSpeed = 0;

    if (s.debug.realMode) {
      // REALモード: Bluetoothデータを優先使用
      if (s.bluetooth.realPower !== null) {
        targetPower = s.bluetooth.realPower;
        console.log(`🔥 REAL PWR: ${targetPower}W`);
      }
      if (s.bluetooth.realCadence !== null) {
        targetCadence = s.bluetooth.realCadence;
      }
      // REALモード：自然な斜度制御
      if (s.telemetry.speed > 1.0) {
        // 走行中：距離ベースで斜度変化
        const distancePhase = s.distanceKm * 0.5;
        const baseGrade = Math.sin(distancePhase * 0.8) * 6.0 + Math.sin(distancePhase * 0.3 + 1.2) * 4.0;
        s.grade = clamp(baseGrade, -15, 20);
      } else {
        // 停止中：斜度を徐々に平坦化
        s.grade = s.grade * 0.995;
        if (Math.abs(s.grade) < 0.1) s.grade = 0;
      }
      
      // 実パワーから速度を逆算
      targetRealSpeed = solveCyclingSpeedKph(targetPower, s.grade, s.debug.weight || 70);
      
      // ログ制御（1秒に1回）
      if (!this.lastLogTime) this.lastLogTime = 0;
      if (t - this.lastLogTime >= 1.0) {
        if (targetPower > 0) {
          console.log(`🚴 REAL速度計算: ${targetRealSpeed.toFixed(1)}km/h (${targetPower}W, ${s.grade.toFixed(1)}%)`);
        } else {
          console.log(`⚠️ センサー未接続: 速度0km/h`);
        }
        this.lastLogTime = t;
      }
    } else if (s.debug.manual) {
      s.grade = s.debug.manualGrade;
      targetRealSpeed = s.debug.manualSpeed;
      targetPower = estimateCyclingPowerWatts(targetRealSpeed, s.grade, s.debug.weight || 70);
      targetCadence = targetRealSpeed === 0 ? 0 : clamp(58 + targetRealSpeed * 0.72, 58, 118);
      targetHeart = targetRealSpeed === 0 ? 72 : clamp(88 + targetPower * 0.16, 88, 182);
    } else {
      // 将来スマートローラー負荷に渡せるよう、grade を内部状態として持つ。
      // 極悪ヒルクライム対応：-20%から25%まで拡張
      const baseGrade = Math.sin(t * 0.075) * 8.0 + Math.sin(t * 0.031 + 1.4) * 5.5;
      s.grade = clamp(baseGrade, -20, 25);
      targetRealSpeed = solveCyclingSpeedKph(targetPower, s.grade, s.debug.weight || 70);
    }

    s.curveDrift = Math.sin(t * 0.09) * 0.72 + Math.sin(t * 0.043 + 1.2) * 0.28;
    const targetMeterSpeed = clamp(targetRealSpeed * 1.08 + 1.2, 0, 100);

    s.telemetry.power = damp(s.telemetry.power, targetPower, 0.08);
    s.telemetry.cadence = damp(s.telemetry.cadence, targetCadence, 0.12);
    s.telemetry.heartRate = damp(s.telemetry.heartRate, targetHeart, 0.08);
    s.telemetry.realSpeed = damp(s.telemetry.realSpeed, targetRealSpeed, 0.07);
    s.telemetry.speed = damp(s.telemetry.speed, targetMeterSpeed, 0.08);

    const feel = sampleSpeedFeel(Math.max(10, s.telemetry.speed));
    const visualBoost = 1.95;
    s.distanceKm += (s.telemetry.realSpeed * dt) / 3600;
    s.roadPhase += s.telemetry.speed * dt * feel.linePhase * visualBoost;
    s.parallaxPhase += s.telemetry.speed * dt * feel.parallaxPhase * visualBoost;

    updateScenery(dt, feel.sceneryFactor * visualBoost);
    updateAmbientRiders(dt, feel.ambientFactor * visualBoost);
  }
}

class Renderer {
  constructor(context, appState) {
    this.ctx = context;
    this.state = appState;
    this.w = canvas.width;
    this.h = canvas.height;
    this.hudHeight = 116;
    this.baseHorizonY = 282;
    this.roadBottomY = this.h - 34;
    this.roadTopHalf = 42;
    this.roadBottomHalf = 314;
  }

  get horizonY() {
    // 上りで少し下がり、下りで少し上がる。
    return this.baseHorizonY + this.state.grade * 5.5;
  }

  render() {
    this.clear();
    this.drawSky();
    this.drawFarMountains();
    this.drawNearMountains();
    this.drawHorizonParallax();
    this.drawRoad();
    
    // Z-order修正：遠景→ライダー→近景の順で描画
    this.drawBackgroundScenery(); // 超遠景・遠景
    this.drawAmbientRiders();
    this.drawForegroundScenery(); // メインレーン
    
    this.drawPlayerShadow();
    this.drawPlayer();
    this.drawSpeedEffects(); // エフェクトシステム復活
    this.drawScreenAccent();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  drawSky() {
    const timeOfDay = this.state.timeOfDay;
    const skyColors = this.getTimeBasedColors(timeOfDay);
    
    // 空のグラデーション描画
    const gradient = this.ctx.createLinearGradient(0, this.hudHeight, 0, this.horizonY + 30);
    gradient.addColorStop(0, skyColors.skyTop);
    gradient.addColorStop(1, skyColors.skyBottom);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, this.hudHeight, this.w, this.horizonY - this.hudHeight + 40);

    // 太陽/月の描画
    this.drawCelestialBody(timeOfDay, skyColors);

    // 雲の描画
    const cloudShiftFar = (this.state.parallaxPhase * 3.8) % (this.w + 180);
    const cloudShiftNear = (this.state.parallaxPhase * 6.4) % (this.w + 220);
    drawCloud(this.ctx, 100 - cloudShiftFar + this.state.curveDrift * 4, this.hudHeight + 94, 0.72);
    drawCloud(this.ctx, 694 - cloudShiftNear + this.state.curveDrift * 7, this.hudHeight + 102, 0.82);
    drawCloud(this.ctx, 1040 - cloudShiftFar + this.state.curveDrift * 4, this.hudHeight + 94, 0.72);
  }

  getTimeBasedColors(timeOfDay) {
    // 時間帯による色定義 (0=朝, 0.25=昼, 0.5=夕, 0.75=夜, 1=朝)
    const colors = {
      morning: { skyTop: '#ff9a8b', skyBottom: '#a8d8ff', sun: '#ffdd59' },
      noon: { skyTop: '#6d9dff', skyBottom: '#9fd0ff', sun: '#ffd56b' },
      evening: { skyTop: '#ff6b5a', skyBottom: '#ffa85c', sun: '#ff4757' },
      night: { skyTop: '#1e3c72', skyBottom: '#2a5298', sun: '#c8d6e5' }
    };
    
    let color1, color2, ratio;
    
    if (timeOfDay < 0.25) {
      // 朝→昼 (0-0.25)
      color1 = colors.morning;
      color2 = colors.noon;
      ratio = timeOfDay / 0.25;
    } else if (timeOfDay < 0.5) {
      // 昼→夕 (0.25-0.5)
      color1 = colors.noon;
      color2 = colors.evening;
      ratio = (timeOfDay - 0.25) / 0.25;
    } else if (timeOfDay < 0.75) {
      // 夕→夜 (0.5-0.75)
      color1 = colors.evening;
      color2 = colors.night;
      ratio = (timeOfDay - 0.5) / 0.25;
    } else {
      // 夜→朝 (0.75-1)
      color1 = colors.night;
      color2 = colors.morning;
      ratio = (timeOfDay - 0.75) / 0.25;
    }
    
    // 色を補間
    return {
      skyTop: this.interpolateColor(color1.skyTop, color2.skyTop, ratio),
      skyBottom: this.interpolateColor(color1.skyBottom, color2.skyBottom, ratio),
      sun: this.interpolateColor(color1.sun, color2.sun, ratio)
    };
  }

  interpolateColor(color1, color2, ratio) {
    // 16進数カラーコードの補間
    const r1 = parseInt(color1.slice(1, 3), 16);
    const g1 = parseInt(color1.slice(3, 5), 16);
    const b1 = parseInt(color1.slice(5, 7), 16);
    
    const r2 = parseInt(color2.slice(1, 3), 16);
    const g2 = parseInt(color2.slice(3, 5), 16);
    const b2 = parseInt(color2.slice(5, 7), 16);
    
    const r = Math.round(r1 + (r2 - r1) * ratio);
    const g = Math.round(g1 + (g2 - g1) * ratio);
    const b = Math.round(b1 + (b2 - b1) * ratio);
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  drawCelestialBody(timeOfDay, colors) {
    // 太陽/月の位置計算（0.25で最高点、0.75で最低点）
    const celestialAngle = timeOfDay * Math.PI * 2 - Math.PI / 2; // -90度から開始
    const radius = 80; // 軌道半径
    const centerX = this.w * 0.7; // 右寄りの軌道
    const centerY = this.hudHeight + 80;
    
    const x = centerX + Math.cos(celestialAngle) * radius;
    const y = centerY + Math.sin(celestialAngle) * radius * 0.6; // 楕円軌道
    
    // 地平線より上にある場合のみ描画
    if (y < this.horizonY) {
      // 夜間（0.6-1.0 + 0.0-0.1）は月、昼間（0.1-0.6）は太陽
      const isNight = timeOfDay > 0.6 || timeOfDay < 0.1;
      const bodySize = isNight ? 12 : 14;
      
      // 昼間は太陽のグロー効果
      if (!isNight) {
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = colors.sun;
      }
      
      this.ctx.fillStyle = colors.sun;
      this.ctx.beginPath();
      this.ctx.arc(x, y, bodySize, 0, Math.PI * 2);
      this.ctx.fill();
      
      // 月の場合はクレーター
      if (isNight) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(x - 3, y - 2, 2, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.beginPath();
        this.ctx.arc(x + 2, y + 3, 1.5, 0, Math.PI * 2);
        this.ctx.fill();
      }
      
      this.ctx.shadowBlur = 0;
    }
  }

  drawFarMountains() {
    const y = this.horizonY - 2;
    const offset = this.state.curveDrift * 18 - (this.state.parallaxPhase * 2.9 % 160);
    this.ctx.fillStyle = palette.mountainFar;
    this.ctx.beginPath();
    this.ctx.moveTo(0, y);
    for (let x = -80; x <= this.w + 80; x += 70) {
      const nx = x + offset;
      const peak = Math.sin((x / 120) + 0.8) * 18 + Math.cos(x / 80) * 10;
      this.ctx.lineTo(nx, y - 26 - peak);
    }
    this.ctx.lineTo(this.w, y + 2);
    this.ctx.lineTo(0, y + 2);
    this.ctx.closePath();
    this.ctx.fill();
  }

  drawNearMountains() {
    const y = this.horizonY + 8;
    const offset = this.state.curveDrift * 36 - (this.state.parallaxPhase * 7.1 % 260);

    this.ctx.fillStyle = palette.mountainNear2;
    this.ctx.beginPath();
    this.ctx.moveTo(-40, y + 2);
    this.ctx.lineTo(30 + offset, y - 18);
    this.ctx.lineTo(90 + offset, y - 2);
    this.ctx.lineTo(150 + offset, y - 40);
    this.ctx.lineTo(210 + offset, y - 4);
    this.ctx.lineTo(270 + offset, y - 22);
    this.ctx.lineTo(332 + offset, y + 4);
    this.ctx.lineTo(-40, y + 4);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.moveTo(612 + offset, y + 2);
    this.ctx.lineTo(680 + offset, y - 18);
    this.ctx.lineTo(732 + offset, y - 4);
    this.ctx.lineTo(802 + offset, y - 44);
    this.ctx.lineTo(862 + offset, y - 2);
    this.ctx.lineTo(930 + offset, y - 20);
    this.ctx.lineTo(1005 + offset, y + 4);
    this.ctx.lineTo(612 + offset, y + 4);
    this.ctx.closePath();
    this.ctx.fill();

    this.ctx.fillStyle = palette.mountainNear;
    this.ctx.fillRect(0, y - 2, this.w, 4);
  }

  drawHorizonParallax() {
    const farY = this.horizonY + 10;
    const nearY = this.horizonY + 22;
    const farShift = -((this.state.parallaxPhase * 9.2) % 84);
    const nearShift = -((this.state.parallaxPhase * 18.8) % 58);

    this.ctx.fillStyle = '#16351b';
    for (let x = farShift - 84; x < this.w + 84; x += 84) {
      fillTriangle(this.ctx, x + 18, farY - 18, x, farY + 4, x + 36, farY + 4);
      fillTriangle(this.ctx, x + 56, farY - 14, x + 40, farY + 4, x + 70, farY + 4);
    }

    this.ctx.fillStyle = '#235227';
    for (let x = nearShift - 58; x < this.w + 58; x += 58) {
      fillTriangle(this.ctx, x + 12, nearY - 14, x - 2, nearY + 4, x + 24, nearY + 4);
      fillTriangle(this.ctx, x + 38, nearY - 10, x + 26, nearY + 4, x + 50, nearY + 4);
    }
  }

  drawRoad() {
    const rows = 128;
    const roadHeight = this.roadBottomY - this.horizonY;

    for (let i = 0; i < rows; i += 1) {
      const farT = i / rows;
      const nearT = (i + 1) / rows;
      const farEase = Math.pow(farT, 1.58);
      const nearEase = Math.pow(nearT, 1.58);
      const y1 = this.horizonY + farEase * roadHeight;
      const y2 = this.horizonY + nearEase * roadHeight;
      const center1 = this.getRoadCenter(farEase);
      const center2 = this.getRoadCenter(nearEase);
      const half1 = lerp(this.roadTopHalf, this.roadBottomHalf, farEase);
      const half2 = lerp(this.roadTopHalf, this.roadBottomHalf, nearEase);
      const row = { y1, y2, center1, center2, half1, half2, farEase, nearEase };

      this.drawGrassBand(i, row);
      this.drawShoulders(i, row);
      this.drawRoadBand(i, row);
      this.drawCenterLine(i, row);
    }

    this.drawHorizonLine();
  }

  getRoadCenter(depthEase) {
    const curveAmount = Math.pow(depthEase, 1.86);
    const subtle = Math.sin(this.state.elapsed * 0.16 + depthEase * 5.1) * 4;
    return this.w * 0.5 + this.state.curveDrift * 132 * curveAmount + subtle;
  }

  drawGrassBand(i, row) {
    this.ctx.fillStyle = i % 2 === 0 ? palette.grassA : palette.grassB;
    this.ctx.fillRect(0, row.y1, this.w, Math.max(1, row.y2 - row.y1 + 1));
  }

  drawShoulders(i, row) {
    this.ctx.fillStyle = i % 2 === 0 ? palette.shoulderA : palette.shoulderB;
    fillQuad(
      this.ctx,
      row.center1 - row.half1 - row.half1 * 0.14,
      row.y1,
      row.center1 - row.half1,
      row.y1,
      row.center2 - row.half2,
      row.y2,
      row.center2 - row.half2 - row.half2 * 0.14,
      row.y2,
    );
    fillQuad(
      this.ctx,
      row.center1 + row.half1,
      row.y1,
      row.center1 + row.half1 + row.half1 * 0.14,
      row.y1,
      row.center2 + row.half2 + row.half2 * 0.14,
      row.y2,
      row.center2 + row.half2,
      row.y2,
    );
  }

  drawRoadBand(i, row) {
    this.ctx.fillStyle = i % 2 === 0 ? palette.roadA : palette.roadB;
    fillQuad(
      this.ctx,
      row.center1 - row.half1,
      row.y1,
      row.center1 + row.half1,
      row.y1,
      row.center2 + row.half2,
      row.y2,
      row.center2 - row.half2,
      row.y2,
    );
  }

  drawCenterLine(i, row) {
    // 白線は景色と同じく、奥から手前へ迫る見え方にそろえます。
    const rawCycle = Math.floor(i - this.state.roadPhase);
    const dashCycle = ((rawCycle % 24) + 24) % 24;
    if (dashCycle > 10) return;

    const lineHalf1 = Math.max(1, row.half1 * 0.018);
    const lineHalf2 = Math.max(1, row.half2 * 0.018);
    this.ctx.fillStyle = palette.white;
    fillQuad(
      this.ctx,
      row.center1 - lineHalf1,
      row.y1,
      row.center1 + lineHalf1,
      row.y1,
      row.center2 + lineHalf2,
      row.y2,
      row.center2 - lineHalf2,
      row.y2,
    );
  }

  drawHorizonLine() {
    this.ctx.fillStyle = '#153f12';
    this.ctx.fillRect(0, this.horizonY - 2, this.w, 3);
  }

  drawBackgroundScenery() {
    // 超遠景レーン（32.5%サイズ、中央寄せ）
    this.drawSceneryLayer(this.state.veryFarScenery, 0.325, 1.6);
    
    // 遠景レーン（65%サイズ、中央寄せ）
    this.drawSceneryLayer(this.state.farScenery, 0.65, 1.3);
  }

  drawForegroundScenery() {
    // メインレーン（100%サイズ、最前面）
    this.drawSceneryLayer(this.state.scenery, 1.0, 1);
  }

  drawSceneryLayer(sceneryArray, sizeFactor, sideFactor) {
    for (const item of sceneryArray) {
      const p = item.progress;
      const depth = Math.pow(p, 1.68);
      const baseScale = lerp(0.4, 3.2, Math.pow(p, 1.9));
      const scale = baseScale * sizeFactor; // サイズファクター適用
      const y = lerp(this.horizonY + 6, this.h - 38, Math.pow(p, 1.84));
      const roadHalf = lerp(this.roadTopHalf, this.roadBottomHalf, depth);
      const center = this.getRoadCenter(depth);
      const x = center + item.side * sideFactor * (roadHalf + 34 + scale * 8);

      // 画像が読み込まれている場合は画像を使用、そうでなければ数式描画
      if (item.type === 'tree') {
        if (imagesLoaded && images.trees.length > 0) {
          this.drawImageTree(x, y, scale, item.variant || 0);
        } else {
          drawTree(this.ctx, x, y, scale);
        }
      } else if (item.type === 'house') {
        if (imagesLoaded && images.scenery.houses.length > 0) {
          this.drawImageHouse(x, y, scale);
        } else {
          drawPole(this.ctx, x, y, scale); // フォールバック
        }
      } else if (item.type === 'sign') {
        if (imagesLoaded && images.scenery.signs.length > 0) {
          this.drawImageSign(x, y, scale, item.variant || 0);
        } else {
          drawSign(this.ctx, x, y, scale);
        }
      } else if (item.type === 'flower') {
        if (imagesLoaded && images.scenery.flowers.length > 0) {
          this.drawImageFlower(x, y, scale, item.variant || 0);
        } else {
          // 花のフォールバック：小さい緑のドット
          this.ctx.fillStyle = '#4CAF50';
          this.ctx.beginPath();
          this.ctx.arc(x, y, scale * 2, 0, Math.PI * 2);
          this.ctx.fill();
        }
      } else if (item.type === 'pole') {
        drawPole(this.ctx, x, y, scale);
      }
    }
  }

  drawImageTree(x, y, scale, variant) {
    const img = images.trees[variant % images.trees.length];
    if (img && img.complete && !img.src.includes('404') && img.naturalWidth > 0) {
      try {
        const w = img.width * scale * 0.8;
        const h = img.height * scale * 0.8;
        this.ctx.drawImage(img, Math.round(x - w/2), Math.round(y - h), w, h);
      } catch (error) {
        // 画像描画エラー時は数式描画にフォールバック
        drawTree(this.ctx, x, y, scale);
      }
    } else {
      // 画像が無効時は数式描画
      drawTree(this.ctx, x, y, scale);
    }
  }

  drawImageHouse(x, y, scale) {
    const img = images.scenery.houses[0];
    if (img && img.complete) {
      const w = img.width * scale * 1.2;
      const h = img.height * scale * 1.2;
      this.ctx.drawImage(img, Math.round(x - w/2), Math.round(y - h), w, h);
    }
  }

  drawImageSign(x, y, scale, variant) {
    const img = images.scenery.signs[variant % images.scenery.signs.length];
    if (img && img.complete) {
      const w = img.width * scale * 0.9;
      const h = img.height * scale * 0.9;
      this.ctx.drawImage(img, Math.round(x - w/2), Math.round(y - h), w, h);
    }
  }

  drawImageFlower(x, y, scale, variant) {
    const img = images.scenery.flowers[variant % images.scenery.flowers.length];
    if (img && img.complete) {
      const w = img.width * scale * 0.5;
      const h = img.height * scale * 0.5;
      this.ctx.drawImage(img, Math.round(x - w/2), Math.round(y - h + scale * 5), w, h);
    }
  }

  drawAmbientRiders() {
    for (const rider of this.state.ambientRiders) {
      const p = rider.progress;
      const depth = Math.pow(p, 1.65);
      const scale = lerp(0.42, 2.2, Math.pow(p, 1.85));
      const y = lerp(this.horizonY + 12, this.h - 110, Math.pow(p, 1.78)); // 消える位置を上に調整
      const roadHalf = lerp(this.roadTopHalf, this.roadBottomHalf, depth);
      const center = this.getRoadCenter(depth);
      const x = center + roadHalf * rider.lane;
      const frame = Math.floor((this.state.elapsed * 3.8) + rider.seed) % 2;
      drawRearCyclist(this.ctx, x, y, scale, frame, CPU_CYCLIST_COLORS);
    }
  }

  drawPlayerShadow() {
    this.ctx.fillStyle = 'rgba(0,0,0,0.22)';
    this.ctx.beginPath();
    this.ctx.ellipse(this.w * 0.5, this.h - 74, 62, 14, 0, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawPlayer() {
    if (imagesLoaded && images.character.normal.length > 0) {
      this.drawImagePlayer();
    } else {
      this.drawMathPlayer();
    }
  }

  drawImagePlayer() {
    const telemetry = this.state.telemetry;
    const power = telemetry.power;
    const currentWeight = this.state.debug.weight || 70;
    const powerToWeight = power / currentWeight;
    const grade = this.state.grade;
    const heartRate = telemetry.heartRate;
    
    // 新しいフォーム判定システムを使用
    const characterState = this.getCharacterForm(powerToWeight, grade, heartRate);
    
    // 状態別のアニメーション間隔
    let animationInterval;
    switch(characterState) {
      case 'normal':
        animationInterval = 1.0; // 1秒間隔（ゆったり）
        break;
      case 'tired':
        animationInterval = 1.2; // 1.2秒間隔（少し疲労）
        break;
      case 'fight':  
        animationInterval = 0.6; // 0.6秒間隔（力強く）
        break;
      case 'verytired':
        animationInterval = 0.3; // 0.3秒間隔（激しい疲労で早い切り替え）
        break;
      case 'downhill':
        animationInterval = 0.8; // 0.8秒間隔（下り楽しい）
        break;
    }
    
    const frame = Math.floor(this.state.elapsed / animationInterval) % 2;
    // bobを削除して位置を固定
    
    const x = this.w * 0.5;
    const y = this.h - 75; // さらに2段下げて地面に近く
    const scale = 1.2; // サイズ調整
    
    // 画像の存在確認（安全な描画処理）
    if (images.character[characterState] && images.character[characterState].length > 0) {
      const img = images.character[characterState][frame];
      if (img && img.complete && !img.src.includes('404') && img.naturalWidth > 0) {
        try {
          const w = img.width * scale;
          const h = img.height * scale;
          // 固定位置に描画（bobなし）
          this.ctx.drawImage(img, Math.round(x - w/2), Math.round(y - h), w, h);
        } catch (error) {
          // エラー時は数式描画にフォールバック
          this.drawMathPlayer();
        }
      } else {
        this.drawMathPlayer();
      }
    } else {
      // フォールバック：normalを使用
      if (images.character.normal && images.character.normal.length > 0) {
        const img = images.character.normal[frame];
        if (img && img.complete && !img.src.includes('404') && img.naturalWidth > 0) {
          try {
            const w = img.width * scale;
            const h = img.height * scale;
            this.ctx.drawImage(img, Math.round(x - w/2), Math.round(y - h), w, h);
          } catch (error) {
            this.drawMathPlayer();
          }
        } else {
          this.drawMathPlayer();
        }
      } else {
        this.drawMathPlayer();
      }
    }
  }

  drawMathPlayer() {
    // ケイデンスベースのアニメーション: 60rpm = 1回転/秒
    const animationSpeed = Math.max(0.5, this.state.telemetry.cadence / 60);
    const frame = Math.floor(this.state.elapsed * animationSpeed) % 2;
    const bob = frame === 0 ? 0 : 3;
    drawRearCyclist(this.ctx, this.w * 0.5, this.h - 172 - bob, 3.8, frame, PLAYER_CYCLIST_COLORS);
  }

  drawSpeedEffects() {
    const telemetry = this.state.telemetry;
    const speed = telemetry.speed;
    const power = telemetry.power;
    const grade = this.state.grade;
    const currentWeight = this.state.debug.weight || 70;
    
    // パワーウェイトレシオ計算
    const powerToWeight = power / currentWeight;
    
    // 高速エフェクト（60km/h以上）
    if (speed > 60) {
      this.drawSpeedSparks(speed);
    }
    
    // 超高強度時の稲妻エフェクト（8.0W/kg以上）
    if (powerToWeight >= 8.0) {
      this.drawSprintFlash(this.state.elapsed);
    }
    
    // 下り坂エフェクト（-5%以下）
    if (grade < -5) {
      this.drawDownhillCelebration(grade);
    }
    
    // スプリント花火エフェクト（80km/h以上）
    if (speed > 80) {
      this.drawSprintFireworks(speed);
    }
  }

  // キャラクターフォーム判定（パワー強度とコンディションに基づく）
  getCharacterForm(powerToWeight, grade, heartRate) {
    // 下り坂専用フォーム（-3%以下）
    if (grade < -3) {
      return 'downhill';
    }
    
    // パワーウェイトレシオベースのフォーム判定
    if (powerToWeight >= 7.0 || heartRate >= 175) {
      return 'verytired'; // 超高強度（限界スプリント）
    } else if (powerToWeight >= 4.5 || heartRate >= 160) {
      return 'fight'; // 高強度（登坂・スプリント）
    } else if (powerToWeight >= 2.5 || heartRate >= 140) {
      return 'tired'; // 中強度（持続走行）
    } else {
      return 'normal'; // 低強度（巡航）
    }
  }

  drawSprintFlash(time) {
    // スーパースプリント時の画面フラッシュ
    const flashAlpha = Math.sin(time * 15) * 0.1 + 0.05;
    if (flashAlpha > 0.08) {
      this.ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
      this.ctx.fillRect(0, this.hudHeight, this.w, this.h - this.hudHeight);
    }
    
    // 稲妻エフェクト
    if (Math.sin(time * 20) > 0.7) {
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      
      // ランダムな稲妻パス
      let x = Math.random() * this.w;
      let y = this.hudHeight + 50;
      this.ctx.moveTo(x, y);
      
      for (let i = 0; i < 5; i++) {
        x += (Math.random() - 0.5) * 60;
        y += 40 + Math.random() * 30;
        this.ctx.lineTo(x, y);
      }
      this.ctx.stroke();
    }
  }

  drawSpeedSparks(speed) {
    // 60km/hから開始、より多くのスパーク
    const sparkCount = Math.floor((speed - 60) / 3) + 2;
    const time = this.state.elapsed;
    
    for (let i = 0; i < sparkCount; i++) {
      const x = (Math.sin(time * 3.2 + i * 1.1) * 0.5 + 0.5) * this.w;
      const y = this.hudHeight + 50 + Math.sin(time * 2.8 + i * 0.7) * 30;
      const alpha = 0.3 + Math.sin(time * 4.1 + i * 0.9) * 0.2;
      const size = 1.5 + Math.sin(time * 5.2 + i * 0.8) * 0.7;
      
      this.ctx.fillStyle = `rgba(255, 215, 107, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }
  
  drawDownhillCelebration(grade) {
    const intensity = Math.min((-grade - 5) / 5, 1); // -5%から-10%で強度1
    const time = this.state.elapsed;
    
    // 風の粒子エフェクト（画面全体＆密度減らした）
    const particleCount = Math.floor(5 * (intensity * 0.5 + 0.5)); // 1/4に減らした
    
    for (let i = 0; i < particleCount; i++) {
      const x = Math.random() * this.w; // 画面全体に広げた
      const y = this.hudHeight + Math.random() * (this.h - this.hudHeight); // 画面全体の高さ
      const alpha = 0.15 + Math.sin(time * 3.2 + i * 0.8) * 0.25;
      const size = 0.8 + intensity * 1.2;
      
      this.ctx.fillStyle = `rgba(173, 216, 255, ${alpha})`;
      this.ctx.beginPath();
      this.ctx.arc(x, y, size, 0, Math.PI * 2);
      this.ctx.fill();
    }
    
    // 強度が高い場合は風の軌跡
    if (intensity > 0.5) {
      this.drawWindTrails(time, intensity);
    }
  }
  
  drawWindTrails(time, intensity) {
    const trailCount = Math.floor(intensity * 6); // 少し減らした
    
    for (let i = 0; i < trailCount; i++) {
      const startX = Math.random() * this.w;
      const startY = this.hudHeight + Math.random() * (this.h - this.hudHeight); // 画面全体の高さ
      const length = 30 + intensity * 60; // 長めの軌跡で風らしさ向上
      const angle = -0.2 + Math.sin(time + i) * 0.3; // 風のランダム性向上
      
      this.ctx.strokeStyle = `rgba(173, 216, 255, ${0.2 + intensity * 0.3})`;
      this.ctx.lineWidth = 1.5 + intensity * 2;
      this.ctx.beginPath();
      this.ctx.moveTo(startX, startY);
      this.ctx.lineTo(startX + Math.cos(angle) * length, startY + Math.sin(angle) * length);
      this.ctx.stroke();
    }
  }
  
  drawSprintFireworks(speed) {
    const intensity = Math.min((speed - 80) / 20, 1); // 80-100km/hで強度0-1
    const time = this.state.elapsed;
    
    // 3箇所で花火
    if (Math.sin(time * 4) > 0.6) {
      this.drawFireworksBurst(this.w * 0.15, this.hudHeight + 100, time, 0, intensity);
    }
    
    if (Math.sin(time * 5 + 1) > 0.7) {
      this.drawFireworksBurst(this.w * 0.5, this.hudHeight + 80, time, 1, intensity);
    }
    
    if (Math.sin(time * 3.5 + 2) > 0.65) {
      this.drawFireworksBurst(this.w * 0.85, this.hudHeight + 120, time, 2, intensity);
    }
    
    // 空全体にキラキラ
    this.drawSkySparkles(time, intensity);
  }
  
  drawFireworksBurst(x, y, time, offset, intensity) {
    const burstTime = (time * 3 + offset * 2) % 6; // 6秒周期
    const burstPhase = burstTime % 1; // 1秒内での位相
    
    if (burstPhase < 0.8) { // 0.8秒間表示
      const particleCount = Math.floor(12 + intensity * 8);
      const expansion = burstPhase * 50 * (1 + intensity);
      
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = expansion * (0.5 + Math.random() * 0.5);
        const px = x + Math.cos(angle) * distance;
        const py = y + Math.sin(angle) * distance;
        const alpha = (0.8 - burstPhase) * (0.7 + intensity * 0.3);
        const size = 1 + intensity * 2;
        
        this.ctx.fillStyle = `rgba(255, 215, 107, ${alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(px, py, size, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }
  
  drawSkySparkles(time) {
    // 空全体に小さなキラキラ
    for (let i = 0; i < 20; i++) {
      const x = (Math.sin(time * 2.5 + i * 0.3) * 0.5 + 0.5) * this.w;
      const y = this.hudHeight + 40 + Math.sin(time * 3.1 + i * 0.4) * 120;
      const alpha = 0.2 + Math.sin(time * 8 + i * 0.7) * 0.3;
      const size = 0.8 + Math.sin(time * 12 + i * 0.5) * 0.4;
      
      if (alpha > 0.3) { // 明るい時だけ表示
        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  drawScreenAccent() {
    this.ctx.fillStyle = 'rgba(255,255,255,0.05)';
    this.ctx.fillRect(0, this.hudHeight - 1, this.w, 2);
  }
}

const telemetry = new DummyTelemetry(state);
const renderer = new Renderer(ctx, state);

// 安全なイベントリスナー追加
if (boostButton) {
  boostButton.addEventListener('click', () => {
    state.boostUntil = state.elapsed + 4.2;
  });
}

if (autoModeButton) {
  autoModeButton.addEventListener('click', () => {
    state.debug.manual = false;
    state.debug.realMode = false;
    syncTestControls();
  });
}

if (manualModeButton) {
  manualModeButton.addEventListener('click', () => {
    state.debug.manual = true;
    state.debug.realMode = false;
    syncTestControls();
  });
}

if (realModeButton) {
  realModeButton.addEventListener('click', () => {
    state.debug.manual = false;
    state.debug.realMode = true;
    syncTestControls();
  });
}

if (speedSlider) {
  speedSlider.addEventListener('input', (event) => {
    state.debug.manual = true;
    state.debug.manualSpeed = Number(event.target.value);
    syncTestControls();
  });
}

if (gradeSlider) {
  gradeSlider.addEventListener('input', (event) => {
    state.debug.manual = true;
    state.debug.manualGrade = Number(event.target.value);
    syncTestControls();
  });
}

if (weightSlider) {
  weightSlider.addEventListener('input', (event) => {
    state.debug.manual = true;
    state.debug.weight = Number(event.target.value);
    syncTestControls();
  });
}

presetChips.forEach((chip) => {
  if (chip) {
    chip.addEventListener('click', () => {
      state.debug.manual = true;
      state.debug.manualSpeed = Number(chip.dataset.speed || 0);
      syncTestControls();
    });
  }
});

// Phase A: Power接続ボタン（安全実装）
if (powerButton) {
  powerButton.addEventListener('click', async () => {
  console.log('🔗 Power接続ボタンクリック');
  
  if (!bluetoothManager.isSupported) {
    console.warn('❌ Web Bluetooth not supported');
    powerButton.textContent = '❌非対応';
    setTimeout(() => {
      powerButton.textContent = 'PWR接続';
    }, 3000);
    return;
  }
  
  try {
    // 接続中表示
    powerButton.textContent = '接続中...';
    powerButton.disabled = true;
    
    console.log('📱 Power接続開始...');
    
    // Phase B: 実際のBluetooth接続実行
    console.log('⚡ Phase B: 実Bluetooth接続開始');
    
    const device = await bluetoothManager.connectDevice();
    
    // 接続成功
    state.bluetooth.connected = true;
    powerButton.textContent = '✅接続済み';
    powerButton.classList.add('bluetooth-connected');
    powerButton.disabled = false;
    
    console.log(`🎉 接続成功: ${device.name}`);
    
  } catch (error) {
    console.error('❌ Bluetooth接続エラー:', error);
    powerButton.textContent = '❌失敗';
    powerButton.disabled = false;
    
    setTimeout(() => {
      powerButton.textContent = 'PWR接続';
    }, 5000);
  }
  });
}

// Heart Rate接続ボタン（将来実装）
if (heartButton) {
  heartButton.addEventListener('click', async () => {
    console.log('🔗 Heart Rate接続ボタンクリック');
    heartButton.textContent = '開発中...';
    setTimeout(() => {
      heartButton.textContent = 'HR接続';
    }, 2000);
  });
}

// Cadence接続ボタン（将来実装）
if (cadenceButton) {
  cadenceButton.addEventListener('click', async () => {
    console.log('🔗 Cadence接続ボタンクリック');
    cadenceButton.textContent = '開発中...';
    setTimeout(() => {
      cadenceButton.textContent = 'CAD接続';
    }, 2000);
  });
}

syncTestControls();

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  telemetry.update(dt);
  renderer.render();
  updateHud();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// Phase A: Bluetooth基盤初期化（安全実装）
const bluetoothManager = new BluetoothManager();

// Phase B: Bluetoothコールバック設定（安全実装）
bluetoothManager.setCallbacks({
  onHeartRateData: (hr) => {
    console.log(`💗 Heart Rate: ${hr} bpm`);
    state.bluetooth.realHeartRate = hr;
    state.bluetooth.connected = true; // 心拍データ受信 = 接続成功
    
    // デバッグ用: stateを確実にwindowに公開
    window.state = state;
    
    console.log(`🔄 Bluetooth状態更新: connected=${state.bluetooth.connected}`);
    console.log(`🔄 window.state公開確認:`, window.state?.bluetooth?.connected);
  },
  
  onPowerData: (power) => {
    console.log(`⚡ Power: ${power} W`);
    state.bluetooth.realPower = power;
    // 物理計算統合はPhase C（ダミー維持）
  },
  
  onCadenceData: (cadence) => {
    console.log(`🔄 Cadence: ${cadence} rpm`);
    state.bluetooth.realCadence = cadence;
    // 表示統合はPhase C（ダミー維持）
  },
  
  onDeviceConnected: (deviceName) => {
    console.log(`🔗 デバイス接続完了: ${deviceName}`);
  },
  
  onDeviceDisconnected: (deviceName) => {
    console.log(`🔌 デバイス切断: ${deviceName}`);
    state.bluetooth.connected = false;
    state.bluetooth.realHeartRate = null;
    state.bluetooth.realPower = null;
    state.bluetooth.realCadence = null;
    
    bluetoothButton.textContent = 'BT接続';
    bluetoothButton.classList.remove('bluetooth-connected');
    bluetoothButton.disabled = false;
  }
});

// 安全な初期化確認
console.log('🔗 BITRIDERZ Bluetooth System Ready');
console.log('📱 Web Bluetooth Support:', bluetoothManager.isSupported);

function getStageConfig() {
  const stage = state.stage;
  
  if (stage.type === 'forest' && stage.theme === 'peaceful') {
    return {
      types: ['tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'house', 'sign'],
      count: 20,
      treeRatio: 0.8
    };
  }
  // 将来の拡張用：都市、山、海ステージの設定
  // else if (stage.type === 'city') { ... }
  // else if (stage.type === 'mountain') { ... }
  
  // デフォルト設定
  return {
    types: ['tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'tree', 'house', 'sign'],
    count: 20,
    treeRatio: 0.8
  };
}

function seedScenery() {
  const config = getStageConfig();
  for (let i = 0; i < config.count; i += 1) {
    const item = {
      progress: Math.random() * 0.98,
      side: i % 2 === 0 ? -1 : 1,
      type: config.types[i % config.types.length],
    };
    
    // アイテム種別ごとの詳細設定
    if (item.type === 'tree') {
      item.variant = Math.floor(Math.random() * 6); // 6種類の木
    } else if (item.type === 'sign') {
      item.variant = Math.floor(Math.random() * 2); // 2種類の看板
    } else if (item.type === 'flower') {
      item.variant = Math.floor(Math.random() * 3); // 3種類の花
    }
    
    state.scenery.push(item);
  }
}

function seedFarScenery() {
  // 遠景シーナリー（65%サイズ、中央寄せ）
  const farTypes = ['tree', 'tree', 'tree', 'house', 'tree', 'tree'];
  for (let i = 0; i < 15; i += 1) {
    const item = {
      progress: Math.random() * 0.98,
      side: i % 2 === 0 ? -1.5 : 1.5, // 少し感覚を広げて配置
      type: farTypes[i % farTypes.length],
    };
    
    if (item.type === 'tree') {
      item.variant = Math.floor(Math.random() * 6);
    }
    
    state.farScenery.push(item);
  }
  
  // 超遠景シーナリー（32.5%サイズ、最も中央寄せ）
  const veryFarTypes = ['tree', 'tree', 'house', 'tree'];
  for (let i = 0; i < 12; i += 1) { // 数を少し増やして流れやすく
    const item = {
      progress: Math.random() * 0.98,
      side: i % 2 === 0 ? -1.8 : 1.8, // 少し感覚を広げて配置
      type: veryFarTypes[i % veryFarTypes.length],
    };
    
    if (item.type === 'tree') {
      item.variant = Math.floor(Math.random() * 6);
    }
    
    state.veryFarScenery.push(item);
  }
}

function updateScenery(dt, sceneryFactor = 1) {
  const base = state.telemetry.speed * dt * 0.0022 * sceneryFactor;
  
  // メインシーナリー更新
  for (const item of state.scenery) {
    // 奥はゆっくり、近景は速く。白線と景色が同じ世界で流れるよう係数を共有します。
    item.progress += base * (0.6 + item.progress * 1.38);
    if (item.progress > 1.03) {
      item.progress = 0.03 + Math.random() * 0.09;
      item.side = Math.random() > 0.5 ? 1 : -1;
      
      // ステージ設定に応じた配置
      const config = getStageConfig();
      const rand = Math.random();
      if (rand < config.treeRatio) {
        item.type = 'tree';
        item.variant = Math.floor(Math.random() * 6);
      } else if (rand < config.treeRatio + 0.1) {
        item.type = 'sign';
        item.variant = Math.floor(Math.random() * 2);
      } else {
        item.type = 'house';
      }
    }
  }
  
  // 遠景シーナリー更新（50%の速度）
  for (const item of state.farScenery) {
    item.progress += base * 0.5 * (0.3 + item.progress * 0.7);
    if (item.progress > 1.03) {
      item.progress = 0.03 + Math.random() * 0.09;
      item.side = Math.random() > 0.5 ? 1.5 : -1.5; // 少し感覚を広げて配置
      
      const rand = Math.random();
      if (rand < 0.8) {
        item.type = 'tree';
        item.variant = Math.floor(Math.random() * 6);
      } else {
        item.type = 'house';
      }
    }
  }
  
  // 超遠景シーナリー更新（25%の速度）
  for (const item of state.veryFarScenery) {
    item.progress += base * 0.25 * (0.2 + item.progress * 0.5);
    if (item.progress > 1.03) {
      item.progress = 0.03 + Math.random() * 0.09;
      item.side = Math.random() > 0.5 ? 1.8 : -1.8; // 少し感覚を広げて配置
      
      const rand = Math.random();
      if (rand < 0.75) {
        item.type = 'tree';
        item.variant = Math.floor(Math.random() * 6);
      } else {
        item.type = 'house';
      }
    }
  }
}

function seedAmbientRiders() {
  state.ambientRiders = [
    { progress: 0.24, lane: -0.18, speed: 31, seed: 0.2 },
    { progress: 0.46, lane: 0.16, speed: 28, seed: 1.1 },
    { progress: 0.68, lane: -0.1, speed: 25, seed: 2.6 },
  ];
}

function updateAmbientRiders(dt, ambientFactor = 1) {
  for (const rider of state.ambientRiders) {
    const relative = Math.max(0, state.telemetry.speed - rider.speed);
    rider.progress += relative * dt * 0.0018 * ambientFactor * (0.62 + rider.progress * 1.16);
    if (rider.progress > 0.98) {
      rider.progress = 0.08 + Math.random() * 0.22;
      rider.lane = -0.22 + Math.random() * 0.44;
      rider.speed = 26 + Math.random() * 8;
    }
  }
}

function syncTestControls() {
  speedSlider.value = String(state.debug.manualSpeed);
  gradeSlider.value = String(state.debug.manualGrade);
  weightSlider.value = String(state.debug.weight);
  speedSliderValue.textContent = `${state.debug.manualSpeed}k`;
  gradeSliderValue.textContent = `${state.debug.manualGrade >= 0 ? '+' : ''}${state.debug.manualGrade}%`;
  weightSliderValue.textContent = `${state.debug.weight}kg`;

  autoModeButton.classList.toggle('is-active', !state.debug.manual && !state.debug.realMode);
  manualModeButton.classList.toggle('is-active', state.debug.manual);
  realModeButton.classList.toggle('is-active', state.debug.realMode);

  presetChips.forEach((chip) => {
    if (chip) {
      const chipSpeed = Number(chip.dataset.speed || 0);
      chip.classList.toggle('is-active', state.debug.manual && chipSpeed === state.debug.manualSpeed);
    }
  });
}

function updateHud() {
  const { speed, power, cadence, heartRate } = state.telemetry;
  const currentWeight = state.debug.weight || 70;
  const powerToWeight = power > 0 ? (power / currentWeight) : 0;
  
  hud.speed.textContent = speed.toFixed(1);
  hud.power.textContent = `${Math.round(power)}w (${powerToWeight.toFixed(1)} W/kg)`;
  hud.cadence.textContent = Math.round(cadence).toString();
  hud.heart.textContent = Math.round(heartRate).toString();
  hud.grade.textContent = `${state.grade >= 0 ? '+' : ''}${state.grade.toFixed(1)}%`;
  hud.distance.textContent = state.distanceKm.toFixed(2);
  hud.timer.textContent = formatTime(state.elapsed);
  hud.speedBar.style.width = `${clamp((speed / 100) * 100, 0, 100)}%`;
  hud.powerBar.style.width = `${clamp((power / 600) * 100, 0, 100)}%`; // 極悪登坂用に600Wまで表示

  const courseRatio = (state.distanceKm % state.trackLengthKm) / state.trackLengthKm;
  hud.courseDot.style.left = `${12 + courseRatio * 72}%`;

  if (heartRate > 148) {
    hud.heart.style.color = palette.heartDanger;
  } else {
    hud.heart.style.color = '#ffd76b';
  }

  if (state.grade > 3.5) {
    hud.grade.style.color = '#ffb36e';
  } else if (state.grade < -1.5) {
    hud.grade.style.color = '#77f0ff';
  } else {
    hud.grade.style.color = '#ffd76b';
  }
}

function drawRearCyclist(context, x, y, scale, frame, colors) {
  const s = scale;
  const bob = frame === 0 ? 0 : 1 * s;

  pixelCircle(context, x - 10 * s, y + 34 * s, 6 * s, '#121212');
  pixelCircle(context, x + 10 * s, y + 34 * s, 6 * s, '#121212');
  pixelCircle(context, x - 10 * s, y + 34 * s, 4.2 * s, '#474b52');
  pixelCircle(context, x + 10 * s, y + 34 * s, 4.2 * s, '#474b52');

  pixelRect(context, x - 2 * s, y + 12 * s, 4 * s, 18 * s, '#101010');
  pixelRect(context, x - 6 * s, y + 11 * s, 12 * s, 3 * s, '#242424');
  pixelRect(context, x - 14 * s, y + 23 * s, 28 * s, 3 * s, colors.bike);
  pixelRect(context, x - 2 * s, y + 18 * s, 4 * s, 10 * s, colors.bike);
  pixelRect(context, x - 8 * s, y + 28 * s, 16 * s, 3 * s, colors.bike);

  pixelRect(context, x - 10 * s, y - 3 * s + bob, 20 * s, 16 * s, colors.jersey);
  pixelRect(context, x - 7 * s, y - 7 * s + bob, 14 * s, 5 * s, colors.neckShadow);
  pixelRect(context, x - 8 * s, y - 14 * s + bob, 16 * s, 10 * s, colors.hair);

  pixelRect(context, x - 9 * s, y - 22 * s + bob, 18 * s, 8 * s, '#101010');
  pixelRect(context, x - 7 * s, y - 21 * s + bob, 4 * s, 7 * s, colors.helmet);
  pixelRect(context, x + 3 * s, y - 21 * s + bob, 4 * s, 7 * s, colors.helmet);
  pixelRect(context, x - 2 * s, y - 19 * s + bob, 4 * s, 5 * s, colors.helmet);

  pixelRect(context, x - 13 * s, y - 2 * s + bob, 4 * s, 14 * s, colors.skin);
  pixelRect(context, x + 9 * s, y - 2 * s + bob, 4 * s, 14 * s, colors.skin);
  pixelRect(context, x - 14 * s, y + 10 * s + bob, 5 * s, 4 * s, '#1b1b1b');
  pixelRect(context, x + 9 * s, y + 10 * s + bob, 5 * s, 4 * s, '#1b1b1b');

  pixelRect(context, x - 9 * s, y + 13 * s + bob, 18 * s, 10 * s, colors.shorts);

  if (frame === 0) {
    pixelRect(context, x - 8 * s, y + 23 * s + bob, 5 * s, 12 * s, colors.skin);
    pixelRect(context, x + 3 * s, y + 24 * s + bob, 5 * s, 10 * s, colors.skin);
    pixelRect(context, x - 9 * s, y + 34 * s + bob, 5 * s, 5 * s, colors.shoe);
    pixelRect(context, x + 4 * s, y + 33 * s + bob, 5 * s, 5 * s, colors.shoe);
  } else {
    pixelRect(context, x - 8 * s, y + 24 * s + bob, 5 * s, 10 * s, colors.skin);
    pixelRect(context, x + 3 * s, y + 23 * s + bob, 5 * s, 12 * s, colors.skin);
    pixelRect(context, x - 9 * s, y + 33 * s + bob, 5 * s, 5 * s, colors.shoe);
    pixelRect(context, x + 4 * s, y + 34 * s + bob, 5 * s, 5 * s, colors.shoe);
  }

  pixelRect(context, x - 6 * s, y + 2 * s + bob, 12 * s, 3 * s, colors.logo);
}

function drawTree(context, x, y, scale) {
  const s = Math.max(1, scale);
  context.fillStyle = '#ffffff';
  context.fillRect(Math.round(x - 14 * s), Math.round(y - 40 * s), Math.round(28 * s), Math.round(5 * s));
  context.fillStyle = '#4a2a11';
  context.fillRect(Math.round(x - 2 * s), Math.round(y - 16 * s), Math.round(4 * s), Math.round(16 * s));
  context.fillStyle = '#173913';
  fillTriangle(context, x, y - 50 * s, x - 16 * s, y - 14 * s, x + 16 * s, y - 14 * s);
  fillTriangle(context, x, y - 36 * s, x - 20 * s, y + 2 * s, x + 20 * s, y + 2 * s);
}

function drawPole(context, x, y, scale) {
  const s = Math.max(1, scale);
  context.fillStyle = '#ffffff';
  context.fillRect(Math.round(x - 3 * s), Math.round(y - 26 * s), Math.round(6 * s), Math.round(26 * s));
  context.fillStyle = palette.poleRed;
  context.fillRect(Math.round(x - 3 * s), Math.round(y - 26 * s), Math.round(6 * s), Math.round(7 * s));
  context.fillRect(Math.round(x - 3 * s), Math.round(y - 12 * s), Math.round(6 * s), Math.round(7 * s));
}

function drawSign(context, x, y, scale) {
  const s = Math.max(1, scale);
  context.fillStyle = '#ffffff';
  context.fillRect(Math.round(x - 20 * s), Math.round(y - 26 * s), Math.round(40 * s), Math.round(14 * s));
  context.fillStyle = palette.signText;
  context.font = `${Math.max(8, Math.round(8 * s))}px "Press Start 2P", monospace`;
  context.textAlign = 'center';
  context.fillText('RetroRide', Math.round(x), Math.round(y - 16 * s));
  context.fillRect(Math.round(x - 2 * s), Math.round(y - 12 * s), Math.round(4 * s), Math.round(14 * s));
}

function drawCloud(context, x, y, scale) {
  context.fillStyle = palette.cloud;
  context.fillRect(x, y, 25 * scale, 8 * scale);
  context.fillRect(x + 8 * scale, y - 5 * scale, 12 * scale, 7 * scale);
  context.fillRect(x + 18 * scale, y + 1 * scale, 10 * scale, 5 * scale);
}

function pixelRect(context, x, y, w, h, color) {
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function pixelCircle(context, x, y, r, color) {
  context.fillStyle = color;
  context.beginPath();
  context.arc(Math.round(x), Math.round(y), Math.round(r), 0, Math.PI * 2);
  context.fill();
}

function fillTriangle(context, ax, ay, bx, by, cx, cy) {
  context.beginPath();
  context.moveTo(ax, ay);
  context.lineTo(bx, by);
  context.lineTo(cx, cy);
  context.closePath();
  context.fill();
}

function fillQuad(context, ax, ay, bx, by, cx, cy, dx, dy) {
  context.beginPath();
  context.moveTo(ax, ay);
  context.lineTo(bx, by);
  context.lineTo(cx, cy);
  context.lineTo(dx, dy);
  context.closePath();
  context.fill();
}

function formatTime(sec) {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.floor(sec % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function damp(current, target, ease) {
  return current + (target - current) * ease;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// 10〜100km/h の 10 段階で、表示速度に応じた「気持ちよさ」を補間します。
const SPEED_FEEL_STEPS = [
  { kph: 10, linePhase: 0.18, parallaxPhase: 0.030, sceneryFactor: 0.84, ambientFactor: 0.82 },
  { kph: 20, linePhase: 0.21, parallaxPhase: 0.037, sceneryFactor: 0.90, ambientFactor: 0.86 },
  { kph: 30, linePhase: 0.25, parallaxPhase: 0.044, sceneryFactor: 0.96, ambientFactor: 0.90 },
  { kph: 40, linePhase: 0.30, parallaxPhase: 0.053, sceneryFactor: 1.00, ambientFactor: 0.94 },
  { kph: 50, linePhase: 0.36, parallaxPhase: 0.064, sceneryFactor: 1.08, ambientFactor: 0.98 },
  { kph: 60, linePhase: 0.43, parallaxPhase: 0.078, sceneryFactor: 1.18, ambientFactor: 1.03 },
  { kph: 70, linePhase: 0.52, parallaxPhase: 0.094, sceneryFactor: 1.30, ambientFactor: 1.09 },
  { kph: 80, linePhase: 0.63, parallaxPhase: 0.114, sceneryFactor: 1.44, ambientFactor: 1.16 },
  { kph: 90, linePhase: 0.76, parallaxPhase: 0.138, sceneryFactor: 1.60, ambientFactor: 1.24 },
  { kph: 100, linePhase: 0.92, parallaxPhase: 0.165, sceneryFactor: 1.80, ambientFactor: 1.34 },
];

function sampleSpeedFeel(speedKph) {
  const speed = clamp(speedKph, 10, 100);
  for (let i = 0; i < SPEED_FEEL_STEPS.length - 1; i += 1) {
    const a = SPEED_FEEL_STEPS[i];
    const b = SPEED_FEEL_STEPS[i + 1];
    if (speed >= a.kph && speed <= b.kph) {
      const t = (speed - a.kph) / (b.kph - a.kph);
      return {
        linePhase: lerp(a.linePhase, b.linePhase, t),
        parallaxPhase: lerp(a.parallaxPhase, b.parallaxPhase, t),
        sceneryFactor: lerp(a.sceneryFactor, b.sceneryFactor, t),
        ambientFactor: lerp(a.ambientFactor, b.ambientFactor, t),
      };
    }
  }
  return SPEED_FEEL_STEPS[SPEED_FEEL_STEPS.length - 1];
}

function estimateCyclingPowerWatts(speedKph, gradePercent, weightKg = 70) {
  const rho = 1.226;
  const cda = 0.34;
  const crr = 0.0055;
  const bikeWeight = 12; // 自転車重量
  const totalMass = weightKg + bikeWeight;
  const drivetrain = 0.97;
  const v = speedKph / 3.6;
  const grade = gradePercent / 100;
  const drag = 0.5 * rho * cda * v * v * v;
  const rolling = totalMass * 9.80665 * crr * v;
  const gravity = totalMass * 9.80665 * grade * v;
  return clamp((drag + rolling + gravity) / drivetrain, 0, 2500); // 極悪登坂用に上限拡張
}

function solveCyclingSpeedKph(powerWatts, gradePercent, weightKg = 70) {
  const rho = 1.226;
  const cda = 0.34;
  const crr = 0.0055;
  const bikeWeight = 12; // 自転車重量
  const totalMass = weightKg + bikeWeight;
  const drivetrain = 0.97;
  const grade = gradePercent / 100;
  const wheelPower = Math.max(40, powerWatts * drivetrain);

  let low = 0;
  let high = 25;
  for (let i = 0; i < 28; i += 1) {
    const mid = (low + high) / 2;
    const drag = 0.5 * rho * cda * mid * mid * mid;
    const rolling = totalMass * 9.80665 * crr * mid;
    const gravity = totalMass * 9.80665 * grade * mid;
    const required = drag + rolling + gravity;
    if (required > wheelPower) {
      high = mid;
    } else {
      low = mid;
    }
  }

  return clamp(low * 3.6, 8, 72);
}

const PLAYER_CYCLIST_COLORS = {
  helmet: '#ffd12e',
  hair: '#744927',
  jersey: '#ffd12e',
  logo: '#222222',
  neckShadow: '#b47a34',
  shorts: '#1e1e1e',
  skin: '#efbe78',
  shoe: '#151515',
  bike: '#ffd12e',
};

const CPU_CYCLIST_COLORS = {
  helmet: '#6fe6ff',
  hair: '#5b3c22',
  jersey: '#6fe6ff',
  logo: '#1f2a35',
  neckShadow: '#9b6d33',
  shorts: '#1e1e1e',
  skin: '#d9a56f',
  shoe: '#151515',
  bike: '#6fe6ff',
};
