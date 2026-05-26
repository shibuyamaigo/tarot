/*
  src/main.js
  - v2.7
  - 今回は「手動速度テストモード」「背景速度の底上げ」「停止〜100km/h確認」を追加しています。
  - AUTO と MANUAL を切り替え、速度と斜度を直接テストできます。
  - 速度は簡略物理モデル、速度感は演出プロファイルで気持ちよく見せます。
*/

import './style.css';

const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

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

const boostButton = document.querySelector('#boostButton');
const autoModeButton = document.querySelector('#autoModeButton');
const manualModeButton = document.querySelector('#manualModeButton');
const speedSlider = document.querySelector('#speedSlider');
const speedSliderValue = document.querySelector('#speedSliderValue');
const gradeSlider = document.querySelector('#gradeSlider');
const gradeSliderValue = document.querySelector('#gradeSliderValue');
const presetChips = Array.from(document.querySelectorAll('.preset-chip'));

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
  scenery: [],
  ambientRiders: [],
  debug: {
    manual: false,
    manualSpeed: 40,
    manualGrade: 0,
  },
};

seedScenery();
seedAmbientRiders();

class DummyTelemetry {
  constructor(appState) {
    this.state = appState;
  }

  update(dt) {
    const s = this.state;
    s.elapsed += dt;
    const t = s.elapsed;
    const boostActive = t < s.boostUntil;

    const powerWaveA = Math.sin(t * 0.64) * 20;
    const powerWaveB = Math.sin(t * 0.18 + 0.9) * 26;
    const cadenceWave = Math.sin(t * 1.08 + 0.1) * 4;
    const heartWave = Math.sin(t * 0.41 + 1.1) * 6;
    const boostPower = boostActive ? 90 : 0;

    let targetPower = 198 + powerWaveA + powerWaveB + boostPower;
    let targetCadence = 84 + cadenceWave + (boostActive ? 8 : 0);
    let targetHeart = 130 + heartWave + (boostActive ? 7 : 0);
    let targetRealSpeed = 0;

    if (s.debug.manual) {
      s.grade = s.debug.manualGrade;
      targetRealSpeed = s.debug.manualSpeed;
      targetPower = estimateCyclingPowerWatts(targetRealSpeed, s.grade);
      targetCadence = targetRealSpeed === 0 ? 0 : clamp(58 + targetRealSpeed * 0.72, 58, 118);
      targetHeart = targetRealSpeed === 0 ? 72 : clamp(88 + targetPower * 0.16, 88, 182);
    } else {
      // 将来スマートローラー負荷に渡せるよう、grade を内部状態として持つ。
      s.grade = clamp(Math.sin(t * 0.075) * 2.8 + Math.sin(t * 0.031 + 1.4) * 1.9, -3.5, 6.5);
      targetRealSpeed = solveCyclingSpeedKph(targetPower, s.grade);
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
    this.drawScenery();
    this.drawAmbientRiders();
    this.drawPlayerShadow();
    this.drawPlayer();
    this.drawScreenAccent();
  }

  clear() {
    this.ctx.clearRect(0, 0, this.w, this.h);
  }

  drawSky() {
    const gradient = this.ctx.createLinearGradient(0, this.hudHeight, 0, this.horizonY + 30);
    gradient.addColorStop(0, palette.skyTop);
    gradient.addColorStop(1, palette.skyBottom);
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, this.hudHeight, this.w, this.horizonY - this.hudHeight + 40);

    this.ctx.fillStyle = palette.sun;
    this.ctx.beginPath();
    this.ctx.arc(102, this.hudHeight + 64, 14, 0, Math.PI * 2);
    this.ctx.fill();

    const cloudShiftFar = (this.state.parallaxPhase * 3.8) % (this.w + 180);
    const cloudShiftNear = (this.state.parallaxPhase * 6.4) % (this.w + 220);
    drawCloud(this.ctx, 100 - cloudShiftFar + this.state.curveDrift * 4, this.hudHeight + 94, 0.72);
    drawCloud(this.ctx, 694 - cloudShiftNear + this.state.curveDrift * 7, this.hudHeight + 102, 0.82);
    drawCloud(this.ctx, 1040 - cloudShiftFar + this.state.curveDrift * 4, this.hudHeight + 94, 0.72);
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

  drawScenery() {
    for (const item of this.state.scenery) {
      const p = item.progress;
      const depth = Math.pow(p, 1.68);
      const scale = lerp(0.4, 3.2, Math.pow(p, 1.9));
      const y = lerp(this.horizonY + 6, this.h - 38, Math.pow(p, 1.84));
      const roadHalf = lerp(this.roadTopHalf, this.roadBottomHalf, depth);
      const center = this.getRoadCenter(depth);
      const x = center + item.side * (roadHalf + 34 + scale * 8);

      if (item.type === 'tree') drawTree(this.ctx, x, y, scale);
      if (item.type === 'pole') drawPole(this.ctx, x, y, scale);
      if (item.type === 'sign') drawSign(this.ctx, x, y, scale);
    }
  }

  drawAmbientRiders() {
    for (const rider of this.state.ambientRiders) {
      const p = rider.progress;
      const depth = Math.pow(p, 1.65);
      const scale = lerp(0.42, 2.2, Math.pow(p, 1.85));
      const y = lerp(this.horizonY + 12, this.h - 74, Math.pow(p, 1.78));
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
    const frame = Math.floor(this.state.elapsed * (this.state.telemetry.cadence / 32)) % 2;
    const bob = frame === 0 ? 0 : 3;
    drawRearCyclist(this.ctx, this.w * 0.5, this.h - 172 - bob, 3.8, frame, PLAYER_CYCLIST_COLORS);
  }

  drawScreenAccent() {
    this.ctx.fillStyle = 'rgba(255,255,255,0.05)';
    this.ctx.fillRect(0, this.hudHeight - 1, this.w, 2);
  }
}

const telemetry = new DummyTelemetry(state);
const renderer = new Renderer(ctx, state);

boostButton.addEventListener('click', () => {
  state.boostUntil = state.elapsed + 4.2;
});

autoModeButton.addEventListener('click', () => {
  state.debug.manual = false;
  syncTestControls();
});

manualModeButton.addEventListener('click', () => {
  state.debug.manual = true;
  syncTestControls();
});

speedSlider.addEventListener('input', (event) => {
  state.debug.manual = true;
  state.debug.manualSpeed = Number(event.target.value);
  syncTestControls();
});

gradeSlider.addEventListener('input', (event) => {
  state.debug.manual = true;
  state.debug.manualGrade = Number(event.target.value);
  syncTestControls();
});

presetChips.forEach((chip) => {
  chip.addEventListener('click', () => {
    state.debug.manual = true;
    state.debug.manualSpeed = Number(chip.dataset.speed || 0);
    syncTestControls();
  });
});

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

function seedScenery() {
  const types = ['tree', 'pole', 'tree', 'sign', 'tree', 'pole'];
  for (let i = 0; i < 22; i += 1) {
    state.scenery.push({
      progress: Math.random() * 0.98,
      side: i % 2 === 0 ? -1 : 1,
      type: types[i % types.length],
    });
  }
}

function updateScenery(dt, sceneryFactor = 1) {
  const base = state.telemetry.speed * dt * 0.0022 * sceneryFactor;
  for (const item of state.scenery) {
    // 奥はゆっくり、近景は速く。白線と景色が同じ世界で流れるよう係数を共有します。
    item.progress += base * (0.6 + item.progress * 1.38);
    if (item.progress > 1.03) {
      item.progress = 0.03 + Math.random() * 0.09;
      item.side = Math.random() > 0.5 ? 1 : -1;
      item.type = Math.random() > 0.72 ? 'sign' : Math.random() > 0.5 ? 'tree' : 'pole';
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
  speedSliderValue.textContent = `${state.debug.manualSpeed}k`;
  gradeSliderValue.textContent = `${state.debug.manualGrade >= 0 ? '+' : ''}${state.debug.manualGrade}%`;

  autoModeButton.classList.toggle('is-active', !state.debug.manual);
  manualModeButton.classList.toggle('is-active', state.debug.manual);

  presetChips.forEach((chip) => {
    const chipSpeed = Number(chip.dataset.speed || 0);
    chip.classList.toggle('is-active', state.debug.manual && chipSpeed === state.debug.manualSpeed);
  });
}

function updateHud() {
  const { speed, power, cadence, heartRate } = state.telemetry;
  hud.speed.textContent = speed.toFixed(1);
  hud.power.textContent = Math.round(power).toString();
  hud.cadence.textContent = Math.round(cadence).toString();
  hud.heart.textContent = Math.round(heartRate).toString();
  hud.grade.textContent = `${state.grade >= 0 ? '+' : ''}${state.grade.toFixed(1)}%`;
  hud.distance.textContent = state.distanceKm.toFixed(2);
  hud.timer.textContent = formatTime(state.elapsed);
  hud.speedBar.style.width = `${clamp((speed / 100) * 100, 0, 100)}%`;
  hud.powerBar.style.width = `${clamp((power / 360) * 100, 0, 100)}%`;

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

function estimateCyclingPowerWatts(speedKph, gradePercent) {
  const rho = 1.226;
  const cda = 0.34;
  const crr = 0.0055;
  const totalMass = 82;
  const drivetrain = 0.97;
  const v = speedKph / 3.6;
  const grade = gradePercent / 100;
  const drag = 0.5 * rho * cda * v * v * v;
  const rolling = totalMass * 9.80665 * crr * v;
  const gravity = totalMass * 9.80665 * grade * v;
  return clamp((drag + rolling + gravity) / drivetrain, 0, 1400);
}

function solveCyclingSpeedKph(powerWatts, gradePercent) {
  const rho = 1.226;
  const cda = 0.34;
  const crr = 0.0055;
  const totalMass = 82;
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
