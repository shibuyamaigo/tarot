/*
  src/storage.js - IndexedDBによるデータ永続化
  CLAUDE.md準拠：データ最小化 - 1セッション数十KB以内
  セキュリティ：全データ入力点でバリデーション
*/

const DB_NAME = 'RetroRideDB';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const STORE_SETTINGS = 'settings';

// データバリデーション（セキュリティ原則準拠）
function validateSessionData(data) {
  if (!data || typeof data !== 'object') return false;
  
  const { speed, power, cadence, heartRate, distance, elapsed } = data;
  
  // セキュリティ原則の上限チェック
  if (speed && (speed < 0 || speed > 100)) return false;  // 100km/h
  if (power && (power < 0 || power > 2500)) return false; // 2500W
  if (cadence && (cadence < 0 || cadence > 220)) return false; // 220rpm
  if (heartRate && (heartRate < 40 || heartRate > 220)) return false; // 220bpm
  if (distance && (distance < 0 || distance > 500)) return false; // 500km
  if (elapsed && (elapsed < 0 || elapsed > 43200)) return false; // 12時間
  
  return true;
}

class RetroRideDB {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // セッションデータストア
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const sessionStore = db.createObjectStore(STORE_SESSIONS, {
            keyPath: 'id',
            autoIncrement: true
          });
          sessionStore.createIndex('timestamp', 'timestamp', { unique: false });
          sessionStore.createIndex('date', 'date', { unique: false });
        }
        
        // 設定データストア
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
        }
      };
    });
  }

  // セッション保存（データ最小化）
  async saveSession(sessionData) {
    if (!validateSessionData(sessionData)) {
      throw new Error('Invalid session data');
    }

    const now = new Date();
    const session = {
      timestamp: now.getTime(),
      date: now.toISOString().split('T')[0], // YYYY-MM-DD
      version: '2.7',
      ...sessionData
    };

    // データサイズチェック（数十KB制限）
    const dataSize = JSON.stringify(session).length;
    if (dataSize > 50000) { // 50KB制限
      throw new Error('Session data too large');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_SESSIONS], 'readwrite');
      const store = transaction.objectStore(STORE_SESSIONS);
      const request = store.add(session);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  // 最新セッション取得
  async getLatestSession() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_SESSIONS], 'readonly');
      const store = transaction.objectStore(STORE_SESSIONS);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev'); // 降順
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const cursor = request.result;
        resolve(cursor ? cursor.value : null);
      };
    });
  }

  // 日次統計取得
  async getDayStats(date) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_SESSIONS], 'readonly');
      const store = transaction.objectStore(STORE_SESSIONS);
      const index = store.index('date');
      const request = index.getAll(date);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const sessions = request.result;
        const stats = {
          totalDistance: 0,
          totalTime: 0,
          maxPower: 0,
          avgPower: 0,
          sessionCount: sessions.length
        };
        
        if (sessions.length > 0) {
          let totalPowerSum = 0;
          sessions.forEach(session => {
            stats.totalDistance += session.distance || 0;
            stats.totalTime += session.elapsed || 0;
            stats.maxPower = Math.max(stats.maxPower, session.maxPower || 0);
            totalPowerSum += session.avgPower || 0;
          });
          stats.avgPower = totalPowerSum / sessions.length;
        }
        
        resolve(stats);
      };
    });
  }

  // 設定保存
  async saveSetting(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_SETTINGS], 'readwrite');
      const store = transaction.objectStore(STORE_SETTINGS);
      const request = store.put({ key, value });
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // 設定取得
  async getSetting(key, defaultValue = null) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_SETTINGS], 'readonly');
      const store = transaction.objectStore(STORE_SETTINGS);
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : defaultValue);
      };
    });
  }
}

export default RetroRideDB;