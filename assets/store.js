/* ============================================================
 * store.js — 本地数据存储层（基于 IndexedDB）
 * 个人使用 H5：无需后端，所有数据存在浏览器本地（IndexedDB）
 * 容量随手机剩余空间走，告别 localStorage 的 5MB 上限。
 * ------------------------------------------------------------
 * 设计：对外保持同步接口（get/set/remove/getUsage/warnIfFull），
 * 内部用「内存镜像 + IndexedDB 异步落盘」实现；应用启动时
 * Store.init() 把数据载入内存并一次性迁移历史 localStorage 数据。
 * 若设备不支持 IndexedDB，自动回退 localStorage（功能不变）。
 * ========================================================== */
(function (global) {
  'use strict';

  const PREFIX = 'lifehub:';
  const IDB_NAME = 'lifehub';
  const IDB_STORE = 'kv';

  // 内存镜像：所有同步读写都先操作它
  let _mem = {};
  let _backing = 'idb';   // 'idb' 或兜底 'ls'
  let _dbPromise = null;
  let _ready = false;

  /* ---------- IndexedDB 底层 ---------- */
  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in global)) { reject(new Error('no-indexedDB')); return; }
      let req;
      try { req = indexedDB.open(IDB_NAME, 1); }
      catch (e) { reject(e); return; }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return _dbPromise;
  }

  function idbPut(key, value) {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, PREFIX + key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }

  function idbDelete(key) {
    return openDB().then((db) => new Promise((resolve) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(PREFIX + key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    }));
  }

  function idbEntries() {
    return openDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const cur = tx.objectStore(IDB_STORE).openCursor();
      const out = [];
      cur.onsuccess = (e) => {
        const c = e.target.result;
        if (c) { out.push([c.key, c.value]); c.continue(); }
        else resolve(out);
      };
      cur.onerror = () => reject(cur.error);
    }));
  }

  /* ---------- 一次性迁移：localStorage -> IndexedDB ---------- */
  function migrateFromLS() {
    // 先快照 lifehub: 前缀的键，再逐个迁移；
    // 不能在遍历中直接 removeItem，否则索引错位会漏掉相邻键
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(PREFIX) === 0) keys.push(k);
    }
    keys.forEach((k) => {
      const raw = localStorage.getItem(k);
      let val;
      try { val = JSON.parse(raw); } catch (e) { val = raw; }
      const realKey = k.slice(PREFIX.length);
      _mem[realKey] = val;
      idbPut(realKey, val).catch(() => {});
      try { localStorage.removeItem(k); } catch (e) {}  // 迁移后释放 5MB 配额
    });
  }

  /* ---------- 启动：载入内存（异步，需 await） ---------- */
  function init() {
    if (_ready) return Promise.resolve();
    return openDB()
      .then(() => idbEntries())
      .then((entries) => {
        if (entries.length === 0) {
          migrateFromLS();   // 首次使用：把历史 localStorage 数据搬过来
        } else {
          entries.forEach(([k, v]) => {
            if (typeof k === 'string' && k.indexOf(PREFIX) === 0) _mem[k.slice(PREFIX.length)] = v;
          });
        }
        _ready = true;
      })
      .catch(() => {
        // IndexedDB 不可用（部分隐私模式）：回退 localStorage
        _backing = 'ls';
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.indexOf(PREFIX) === 0) {
            const raw = localStorage.getItem(k);
            try { _mem[k.slice(PREFIX.length)] = JSON.parse(raw); } catch (e) {}
          }
        }
        _ready = true;
      });
  }

  /* ---------- 同步对外接口（保持不变） ---------- */
  const Store = {
    init,

    /** 读取，带默认值与容错 */
    get(key, fallback) {
      if (key in _mem) return _mem[key];
      return fallback;
    },

    /** 写入（内存即时、后台异步落盘） */
    set(key, value) {
      _mem[key] = value;
      if (_backing === 'idb') {
        idbPut(key, value).catch((e) => console.warn('Store.set(idb) failed:', e));
      } else {
        try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch (e) {}
      }
      return true;
    },

    /** 删除 */
    remove(key) {
      delete _mem[key];
      if (_backing === 'idb') {
        idbDelete(key).catch(() => {});
      } else {
        try { localStorage.removeItem(PREFIX + key); } catch (e) {}
      }
    },

    /** 生成简单唯一 id */
    uid() {
      return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    },

    /** 估算已用字节数（内存镜像统计） */
    getUsage() {
      let total = 0;
      for (const k in _mem) {
        const v = JSON.stringify(_mem[k]);
        total += (PREFIX.length + k.length + v.length) * 2; // UTF-16 估算
      }
      return total;
    },

    /** 检查容量，超过阈值则提示（IndexedDB 容量大，默认 100MB 才提示） */
    warnIfFull(thresholdMB) {
      const max = thresholdMB || 100;
      const used = this.getUsage();
      const usedMB = used / (1024 * 1024);
      if (usedMB > max) {
        const msg = '本地存储已使用 ' + usedMB.toFixed(1) + 'MB，建议导出备份并清理大体积内容（如 VLOG 照片）。';
        console.warn(msg);
        return msg;
      }
      return null;
    },
  };

  /* ---------- 日期 / 工具函数 ---------- */
  const Util = {
    /** 今天 YYYY-MM-DD（本地时区） */
    today() {
      const d = new Date();
      const off = d.getTimezoneOffset() * 60000;
      return new Date(d - off).toISOString().slice(0, 10);
    },

    /** 格式化日期为 YYYY-MM-DD */
    fmtDate(d) {
      const off = d.getTimezoneOffset() * 60000;
      return new Date(d - off).toISOString().slice(0, 10);
    },

    /** 友好日期：今天 / 明天 / 后天 / MM-DD */
    prettyDate(str) {
      if (!str) return '';
      const t = this.today();
      const diff = this.dayDiff(t, str);
      if (diff === 0) return '今天';
      if (diff === 1) return '明天';
      if (diff === 2) return '后天';
      if (diff < 0) return Math.abs(diff) + '天前';
      return str.slice(5);
    },

    /** 两个 YYYY-MM-DD 相差天数（b - a） */
    dayDiff(a, b) {
      const da = new Date(a + 'T00:00:00');
      const db = new Date(b + 'T00:00:00');
      return Math.round((db - da) / 86400000);
    },

    /** 把 YYYY-MM-DD 偏移 n 天，返回 YYYY-MM-DD（本地时区） */
    _shift(dateStr, n) {
      const d = new Date(dateStr + 'T00:00:00');
      d.setDate(d.getDate() + n);
      const off = d.getTimezoneOffset() * 60000;
      return new Date(d - off).toISOString().slice(0, 10);
    },
    /** 补零拼日期 */
    _pad(y, mo, d) {
      return String(y) + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    },
    /** 补零拼时间 HH:MM */
    _padTime(h, mi) {
      return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
    },

    /**
     * 自然语言解析待办日期与时间
     * 例：「明天 10 点 交水电费」→ { title:'交水电费', due:'2026-07-20', time:'10:00' }
     * 支持的日期：今天/明日/后天/大后天、周X/星期X/下周X、X月X日(号)、YYYY-MM-DD
     * 支持的时间：HH:MM、X点/X点半/X点X分、上午/下午/晚上/中午 + 数字
     */
    parseDue(text) {
      let t = String(text || '');
      let due = null, time = null, matched = false;

      // 1) 明确日期 YYYY-MM-DD / YYYY/MM/DD
      let m = t.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
      if (m) { due = this._pad(m[1], m[2], m[3]); matched = true; }

      // 2) X月X日 / X月X号
      if (!matched) {
        m = t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]/);
        if (m) { due = this._pad(new Date().getFullYear(), m[1], m[2]); matched = true; }
      }

      // 3) 周几 / 星期几 / 礼拜X（含「下个/下周」）
      if (!matched) {
        const wmap = { '日': 0, '天': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
        const wm = t.match(/(下{1,2}\s*个?)?(周|星期|礼拜)\s*([一二三四五六日天])/);
        if (wm) {
          const target = wmap[wm[3]];
          const extra = wm[1] ? 7 : 0; // 下周 +7
          const todayDow = new Date(this.today() + 'T00:00:00').getDay();
          let diff = (target - todayDow + 7) % 7;
          if (diff === 0) diff = 7; // 说「周一」默认指下周一
          due = this._shift(this.today(), diff + extra);
          matched = true;
        }
      }

      // 4) 相对日 今天/明天/后天/大后天
      if (!matched) {
        const rel = [['今天|今日', 0], ['明天|明日', 1], ['后天', 2], ['大后天', 3]];
        for (const [re, off] of rel) {
          if (new RegExp(re).test(t)) { due = this._shift(this.today(), off); matched = true; break; }
        }
      }

      // 时间：HH:MM
      let tm = t.match(/(\d{1,2}):(\d{2})/);
      if (tm) time = this._padTime(tm[1], tm[2]);
      else {
        const pm = /(下午|傍晚|晚上|夜里|夜晚)/.test(t);
        const am = /(凌晨|早上|早晨|上午|清晨)/.test(t);
        const hm = t.match(/(\d{1,2})\s*点\s*半/)
          || t.match(/(\d{1,2})\s*点\s*(\d{1,2})\s*分/)
          || t.match(/(\d{1,2})\s*点/);
        if (hm) {
          let hh = parseInt(hm[1], 10);
          let mm = 0;
          if (hm[0].indexOf('半') >= 0) mm = 30;
          else if (hm[2]) mm = parseInt(hm[2], 10);
          if (pm && hh < 12) hh += 12;
          time = this._padTime(hh, mm);
        } else if (/(中午|正午)/.test(t)) {
          time = '12:00';
        }
        void am;
      }

      // 清洗标题：移除识别到的日期/时间词
      let title = t
        .replace(/(\d{4})[-/.]\d{1,2}[-/.]\d{1,2}/g, '')
        .replace(/\d{1,2}\s*月\s*\d{1,2}\s*[日号]/g, '')
        .replace(/(下{1,2}\s*个?)?(周|星期|礼拜)\s*[一二三四五六日天]/g, '')
        .replace(/今天|今日|明天|明日|后天|大后天/g, '')
        .replace(/\d{1,2}:\d{2}/g, '')
        .replace(/(凌晨|早上|早晨|上午|清晨|中午|正午|下午|傍晚|晚上|夜里|夜晚)/g, '')
        .replace(/\d{1,2}\s*点\s*(半|\d{1,2}\s*分)?/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .replace(/^[的在，,\s]+|[的在，,\s]+$/g, '');

      return { title: title || t.trim(), due, time };
    },

    /** 近 n 天的日期数组（含今天，升序） */
    lastNDays(n) {
      const res = [];
      const base = new Date(this.today() + 'T00:00:00');
      for (let i = n - 1; i >= 0; i--) {
        const d = new Date(base.getTime() - i * 86400000);
        res.push(this.fmtDate(d));
      }
      return res;
    },

    /** 一周中的中文短名 */
    weekdayShort(str) {
      const names = ['日', '一', '二', '三', '四', '五', '六'];
      const d = new Date(str + 'T00:00:00');
      return '周' + names[d.getDay()];
    },

    /** HTML 转义，防止 XSS */
    esc(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    /** 简单 toast 提示 */
    toast(msg) {
      let el = document.getElementById('toast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.className = 'toast';
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove('show'), 1800);
    },
  };

  global.Store = Store;
  global.Util = Util;
})(window);
