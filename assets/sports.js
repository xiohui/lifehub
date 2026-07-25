/* ============================================================
 * sports.js — 运动模块（v34 全面改造版）
 * 参考 Keep / Nike Run Club / 悦跑圈：
 *   把「打卡」与「记录」合并为一个「动态」主界面，
 *   打卡即记录、同屏可见；另设「日历」「目标」两个视图。
 * ========================================================== */
(function () {
  'use strict';

  const { Store, Util, App } = window;
  const { DB, openSheet, closeSheet } = App;
  const { SPORT_CATEGORIES, classifySport, SPORT_EMOJI_MAP } = window;

  /* ---------- 常用运动预设（快速打卡） ---------- */
  // 用户的常用运动（方便一键打卡 + 弹窗内预设）
  const USER_MOVES = ['跑步', '卷腹', '死虫式', '平板支撑', '俯卧撑', '登山跑', '俄罗斯转体', '深蹲'];

  const ENCOURAGE = [
    '今天也要动起来！', '坚持就是胜利 💪', '每一滴汗水都算数',
    '你比昨天更强了', '身体会记住你的努力', '今天的你很棒 👏',
  ];

  /* ============================================================
   * 工具函数
   * ========================================================== */
  function emojiOf(name) {
    const n = (name || '').trim();
    if (SPORT_EMOJI_MAP[n]) return SPORT_EMOJI_MAP[n];
    for (const k in SPORT_EMOJI_MAP) { if (n.includes(k)) return SPORT_EMOJI_MAP[k]; }
    return classifySport(n).icon;
  }

  function catKeyOf(name) { return classifySport(name).key; }

  function fmtDur(min) {
    min = Math.round(Number(min) || 0);
    if (min <= 0) return '';
    if (min >= 60) {
      const h = Math.floor(min / 60), m = min % 60;
      return h + '小时' + (m ? m + '分' : '');
    }
    return min + '分';
  }

  /** 记录的指标摘要文本 */
  function metricsText(w) {
    const parts = [];
    if (w.dur) parts.push('⏱ ' + fmtDur(w.dur));
    if (w.dist) parts.push('📍 ' + (+w.dist) + '公里');
    if (w.count) parts.push('🔁 ' + w.count + '次');
    if (w.items && w.items.length) {
      const groups = w.items.reduce((s, x) => s + (Number(x.sets) || 0), 0);
      const total = w.items.reduce((s, x) => s + (Number(x.sets) || 0) * (Number(x.reps) || 0), 0);
      parts.push('🏋️ ' + w.items.length + '项' + (groups ? '·' + groups + '组' : '') + (total ? '·' + total + '次' : ''));
    }
    return parts.join('　');
  }

  /** 迁移旧版 DB.sports() 到 DB.workouts()，仅执行一次 */
  function migrateLegacy() {
    const legacy = DB.sports();
    if (legacy && legacy.length) {
      const w = DB.workouts();
      legacy.forEach((s) => {
        w.push({
          id: s.id || Store.uid(),
          name: s.type || s.name || '运动',
          date: s.date || Util.today(),
          time: s.time || '',
          dur: Number(s.dur) || 0,
          dist: Number(s.dist) || 0,
          count: Number(s.count) || 0,
          note: s.note || '',
          sets: Array.isArray(s.sets) ? s.sets : [],
          created: s.created || Date.now(),
        });
      });
      DB.setWorkouts(w);
      DB.setSports([]);
    }
  }

  /** 升级旧 workouts 结构：补 group（大类）/ items（运动项目）字段 */
  function migrateSchema() {
    const arr = DB.workouts();
    if (!arr.length) return;
    let changed = false;
    const out = arr.map((w) => {
      if (w.group && w.items) return w;
      changed = true;
      const items = (Array.isArray(w.items) && w.items.length) ? w.items :
        (Array.isArray(w.sets) && w.sets.length) ? w.sets.map((s) => ({ name: s.name || '动作', sets: 0, reps: Number(s.count) || 0 })) :
        [{ name: w.name || '运动', sets: 0, reps: 0 }];
      const group = w.group || classifySport(w.name || (items[0] && items[0].name) || '').key;
      const count = Number(w.count) || items.reduce((s, x) => s + (Number(x.sets) || 0) * (Number(x.reps) || 0), 0);
      return Object.assign({}, w, { group: group, items: items, count: count });
    });
    if (changed) DB.setWorkouts(out);
  }

  /** 全部记录，按日期+时间倒序 */
  function allWorkouts() {
    return DB.workouts().slice().sort((a, b) => {
      const da = (a.date || '') + (a.time || '');
      const db = (b.date || '') + (b.time || '');
      if (da === db) return (b.created || 0) - (a.created || 0);
      return da < db ? 1 : -1;
    });
  }

  /* ---------- 统计 ---------- */
  function activeDatesSet() {
    return new Set(DB.workouts().map((w) => w.date).filter(Boolean));
  }

  function calcStreak() {
    const set = activeDatesSet();
    let s = 0;
    let d = new Date(Util.today() + 'T00:00:00');
    if (!set.has(Util.fmtDate(d))) d = new Date(d.getTime() - 86400000);
    while (set.has(Util.fmtDate(d))) { s++; d = new Date(d.getTime() - 86400000); }
    return s;
  }

  /** 本周（周一起）7 天 */
  function weekDates() {
    const today = new Date(Util.today() + 'T00:00:00');
    const dow = (today.getDay() + 6) % 7; // 周一=0
    const monday = new Date(today.getTime() - dow * 86400000);
    const arr = [];
    for (let i = 0; i < 7; i++) arr.push(Util.fmtDate(new Date(monday.getTime() + i * 86400000)));
    return arr;
  }

  function todayWorkouts() {
    const t = Util.today();
    return DB.workouts().filter((w) => w.date === t);
  }

  function monthWorkouts(ym) {
    ym = ym || Util.today().slice(0, 7);
    return DB.workouts().filter((w) => (w.date || '').slice(0, 7) === ym);
  }

  function calcPersonalBests() {
    const ws = DB.workouts();
    let maxDur = 0, maxDist = 0;
    ws.forEach((w) => {
      if (Number(w.dur) > maxDur) maxDur = Number(w.dur);
      if (Number(w.dist) > maxDist) maxDist = Number(w.dist);
    });
    // 单月最多次数
    const byMonth = {};
    ws.forEach((w) => { const m = (w.date || '').slice(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; });
    const maxMonth = Math.max(0, ...Object.values(byMonth));
    return { maxDur, maxDist, maxMonth };
  }

  /* ============================================================
   * 渲染主入口 —— 顶部视图切换 + 分发
   * ========================================================== */
  function renderSports() {
    migrateLegacy();
    migrateSchema();
    if (App.calYear == null) {
      const now = new Date();
      App.calYear = now.getFullYear();
      App.calMonth = now.getMonth();
    }
    const view = App.sportView || 'feed';
    let html = '<div class="chip-row section-gap sport-nav">';
    html += navChip('feed', '🏃 动态');
    html += navChip('calendar', '📅 日历');
    html += navChip('goals', '🎯 目标');
    html += '</div>';
    if (view === 'calendar') html += renderCalendar();
    else if (view === 'goals') html += renderGoals();
    else html += renderFeed();
    App.screen.innerHTML = html;
    if (view === 'feed') bindConfettiIfNeeded();
  }
  App.renderers.sports = renderSports;

  function navChip(view, label) {
    const on = (App.sportView || 'feed') === view;
    return '<button class="chip ' + (on ? 'active' : '') + '" data-action="sport.nav" data-view="' + view + '">' + label + '</button>';
  }

  /* ============================================================
   * 视图一：动态（打卡 + 记录 合并）
   * ========================================================== */
  function renderFeed() {
    const today = Util.today();
    const tws = todayWorkouts();
    const streak = calcStreak();
    const wds = weekDates();
    const activeSet = activeDatesSet();
    const weekActive = wds.filter((d) => activeSet.has(d)).length;
    const monthCount = monthWorkouts().length;
    const todayMin = tws.reduce((s, w) => s + (Number(w.dur) || 0), 0);
    const enc = ENCOURAGE[new Date().getDate() % ENCOURAGE.length];

    let h = '';

    /* ---- 今日 Hero ---- */
    h += '<div class="card hero-card">';
    h += '<div class="hero-top">';
    h += '<div><div class="hero-date">' + today.slice(5) + ' · ' + Util.weekdayShort(today) + '</div>';
    h += '<div class="hero-enc">' + enc + '</div></div>';
    h += '<div class="streak-badge">🔥 连续 ' + streak + ' 天</div>';
    h += '</div>';
    h += '<div class="hero-stats">';
    h += '<div class="hero-metric"><div class="hm-num">' + tws.length + '</div><div class="hm-lbl">今日次数</div></div>';
    h += '<div class="hero-metric"><div class="hm-num">' + (todayMin || 0) + '</div><div class="hm-lbl">今日分钟</div></div>';
    h += '<div class="hero-metric"><div class="hm-num">' + weekActive + '<span class="hm-unit">/7</span></div><div class="hm-lbl">本周活跃</div></div>';
    h += '</div>';
    h += '<button class="btn btn-primary btn-block mt12" data-action="sports.add">＋ 记录一次运动</button>';
    h += '</div>';

    /* ---- 快速打卡 ---- */
    h += '<div class="card">';
    h += '<div class="card-title">⚡ 快速打卡 <span class="more">点一下即记录，可再补充详情</span></div>';
    h += '<div class="quick-grid">';
    USER_MOVES.forEach((p) => {
      h += '<button class="quick-cell" data-action="quick.checkin" data-name="' + p + '">' +
        '<span class="qc-emoji">' + emojiOf(p) + '</span><span class="qc-name">' + p + '</span></button>';
    });
    h += '</div>';
    h += '</div>';

    /* ---- 本周概览 ---- */
    h += '<div class="card">';
    h += '<div class="card-title">📊 本周概览</div>';
    h += '<div class="week-track-row">';
    const names = ['一', '二', '三', '四', '五', '六', '日'];
    wds.forEach((d, i) => {
      const cnt = DB.workouts().filter((w) => w.date === d).length;
      const isToday = d === today;
      const future = Util.dayDiff(today, d) > 0;
      let cls = 'week-dot';
      if (cnt >= 2) cls += ' multi';
      else if (cnt === 1) cls += ' on';
      else if (future) cls += ' rest';
      if (isToday) cls += ' today';
      h += '<div class="week-day"><div class="' + cls + '">' + (cnt > 1 ? cnt : (cnt === 1 ? '✓' : '')) + '</div>' +
        '<div class="week-day-lbl">' + names[i] + '</div></div>';
    });
    h += '</div>';
    h += '<div class="mini-stats stat-grid mt12">';
    h += App.stat(weekActive + ' 天', '本周活跃');
    h += App.stat(streak + ' 天', '连续打卡');
    h += App.stat(monthCount + ' 次', '本月运动');
    h += App.stat(DB.workouts().length + ' 次', '累计运动');
    h += '</div>';
    h += '</div>';

    /* ---- 记录时间线（合并的「记录」），默认折叠 ---- */
    h += '<div class="card">';
    const ws = allWorkouts();
    const open = App.recordOpen ? 'open' : '';
    h += '<div class="card-title collapsible" data-action="sports.toggleRecords">' +
      '📖 运动记录 <span class="rec-count">' + ws.length + '</span>' +
      '<span class="chevron">' + (App.recordOpen ? '▾' : '▸') + '</span></div>';
    h += '<div class="collapsible-body ' + open + '">';
    if (!ws.length) {
      h += App.empty('🏃', '还没有运动记录，点上面的按钮开始第一次打卡吧');
    } else {
      h += renderTimeline(ws);
    }
    h += '</div>';
    h += '</div>';

    return h;
  }

  /** 按日期分组的时间线 */
  function renderTimeline(ws) {
    const today = Util.today();
    const yest = Util._shift(today, -1);
    const groups = [];
    const map = {};
    ws.forEach((w) => {
      const d = w.date || today;
      if (!map[d]) { map[d] = []; groups.push(d); }
      map[d].push(w);
    });
    let h = '<div class="timeline">';
    groups.forEach((d) => {
      let label = d.slice(5);
      if (d === today) label = '今天';
      else if (d === yest) label = '昨天';
      const cnt = map[d].length;
      const totMin = map[d].reduce((s, w) => s + (Number(w.dur) || 0), 0);
      h += '<div class="tl-date"><span class="tl-date-main">' + label + '</span>' +
        '<span class="tl-date-sub">' + Util.weekdayShort(d) + ' · ' + cnt + '次' +
        (totMin ? ' · ' + fmtDur(totMin) : '') + '</span></div>';
      map[d].forEach((w) => { h += workoutRow(w); });
    });
    h += '</div>';
    return h;
  }

  function workoutRow(w) {
    const cat = catKeyOf(w.group || w.name);
    const mt = metricsText(w);
    const titleNames = (w.items && w.items.length) ? w.items.map((s) => s.name).join('·') : (w.name || '运动');
    let h = '<div class="wk-row cat-' + cat + '" data-action="checkin.edit" data-id="' + w.id + '">';
    h += '<div class="wk-emoji">' + emojiOf(w.name || (w.items && w.items[0] && w.items[0].name)) + '</div>';
    h += '<div class="wk-main">';
    h += '<div class="wk-title">' + Util.esc(titleNames) + (w.time ? ' <span class="wk-time">' + Util.esc(w.time) + '</span>' : '') + '</div>';
    if (mt) h += '<div class="wk-metrics">' + mt + '</div>';
    if (w.items && w.items.length) {
      h += '<div class="wk-sets">' + w.items.map((s) =>
        Util.esc(s.name || '动作') + ((s.sets || s.reps) ? ' ' + (s.sets || 0) + '×' + (s.reps || 0) : '')).join('　') + '</div>';
    }
    if (w.note) h += '<div class="wk-note">📝 ' + Util.esc(w.note) + '</div>';
    h += '</div>';
    h += '<button class="btn btn-ghost btn-sm wk-del" data-action="checkin.del" data-id="' + w.id + '">删</button>';
    h += '</div>';
    return h;
  }

  /* ============================================================
   * 视图二：日历
   * ========================================================== */
  function calWorkoutCats(ym) {
    const map = {};
    DB.workouts().forEach((w) => {
      if ((w.date || '').slice(0, 7) !== ym) return;
      if (!map[w.date]) map[w.date] = new Set();
      map[w.date].add(catKeyOf(w.group || w.name));
    });
    return map;
  }

  function renderCalendar() {
    const y = App.calYear, m = App.calMonth;
    const ym = y + '-' + String(m + 1).padStart(2, '0');
    const first = new Date(y, m, 1);
    const startDow = (first.getDay() + 6) % 7; // 周一=0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = Util.today();
    const cats = calWorkoutCats(ym);
    const monthCount = monthWorkouts(ym).length;
    const activeDays = Object.keys(cats).length;

    let h = '<div class="card">';
    h += '<div class="cal-nav">';
    h += '<button class="btn btn-ghost btn-sm" data-action="cal.prev">‹</button>';
    h += '<span><b>' + y + '年' + (m + 1) + '月</b></span>';
    h += '<button class="btn btn-ghost btn-sm" data-action="cal.next">›</button>';
    h += '</div>';
    h += '<div class="cal-grid">';
    ['一', '二', '三', '四', '五', '六', '日'].forEach((w) => {
      h += '<div class="cal-weekday">' + w + '</div>';
    });
    for (let i = 0; i < startDow; i++) h += '<div class="cal-cell cal-empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = ym + '-' + String(d).padStart(2, '0');
      const future = Util.dayDiff(today, ds) > 0;
      const set = cats[ds];
      let cls = 'cal-cell active';
      if (future) cls = 'cal-cell future';
      if (ds === today) cls += ' today';
      if (App.calSelected === ds) cls += ' selected';
      h += '<div class="' + cls + '" data-action="cal.select" data-date="' + ds + '">';
      if (set && set.size) {
        const ckeys = { aerobic: 'aer', strength: 'str', core: 'core', duration: 'dur', ball: 'dur', other: 'dur' };
        const keys = [];
        set.forEach((c) => { const k = ckeys[c] || 'dur'; if (keys.indexOf(k) < 0) keys.push(k); });
        const primary = keys[0];
        let inner = '<div class="cal-day-num">' + d + '</div>';
        inner += '<div class="cal-bar ' + primary + '"></div>';
        if (keys.length === 1) {
          inner += '<div class="cal-dot ' + primary + '"></div>';
        } else {
          inner += '<div class="cal-dots-row"><div class="cal-dot sm ' + keys[0] + '"></div><div class="cal-dot sm ' + keys[1] + '"></div></div>';
        }
        h += inner + '</div>';
      } else {
        h += '<div class="cal-day-num">' + d + '</div></div>';
      }
    }
    h += '</div>';
    h += '<div class="cal-legend"><span class="dot-aer"></span>有氧 <span class="dot-str"></span>力量 <span class="dot-core"></span>核心 <span class="dot-dur"></span>其他</div>';
    h += '<div class="checkin-summary">本月运动 <b>' + monthCount + '</b> 次 · 活跃 <b>' + activeDays + '</b> 天</div>';
    h += '</div>';

    // 选中日详情
    const sel = App.calSelected;
    if (sel) {
      const dayWs = DB.workouts().filter((w) => w.date === sel)
        .sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1);
      h += '<div class="card">';
      h += '<div class="cal-detail-header"><span>' + sel.slice(5) + ' · ' + Util.weekdayShort(sel) + '</span>' +
        '<button class="btn btn-primary btn-sm" data-action="sports.add" data-date="' + sel + '">＋ 补记</button></div>';
      if (!dayWs.length) h += App.empty('🛌', '这天还没有运动记录');
      else { h += '<div class="timeline mt12">'; dayWs.forEach((w) => { h += workoutRow(w); }); h += '</div>'; }
      h += '</div>';
    }
    return h;
  }

  /* ============================================================
   * 视图三：目标 + 奖励 + 个人最佳
   * ========================================================== */
  function renderGoals() {
    const goals = DB.goals();
    const ym = Util.today().slice(0, 7);
    const mws = monthWorkouts(ym);
    // 统计本月各运动次数
    const cnt = {};
    mws.forEach((w) => { cnt[w.name] = (cnt[w.name] || 0) + 1; });

    let h = '<div class="card">';
    h += '<div class="card-title">🎯 本月目标 <button class="btn btn-ghost btn-sm" data-action="sport.goal" style="margin-top:-4px">＋ 设定</button></div>';
    const names = Object.keys(goals).filter((n) => goals[n] > 0);
    if (!names.length) {
      h += App.empty('🎯', '还没有设定目标，点「设定」为常做的运动定个月目标吧');
    } else {
      names.forEach((n) => {
        const target = goals[n];
        const cur = cnt[n] || 0;
        const pct = Math.min(100, Math.round(cur / target * 100));
        const hit = cur >= target;
        h += '<div class="goal-row">';
        h += '<div class="goal-top"><span>' + emojiOf(n) + ' ' + Util.esc(n) + '</span>' +
          '<span class="' + (hit ? 'goal-hit' : '') + '">' + cur + '/' + target + (hit ? ' 🎉已达成' : '') + '</span></div>';
        h += '<div class="goal-bar"><div class="goal-fill' + (hit ? ' full' : '') + '" style="width:' + pct + '%"></div></div>';
        if (hit && !rewardClaimed(n, ym)) {
          h += '<button class="btn btn-sm mt8" style="background:var(--amber-soft);color:var(--amber)" data-action="reward.claim" data-name="' + Util.esc(n) + '">🎁 领取达成奖励</button>';
        }
        h += '</div>';
      });
    }
    h += '</div>';

    /* 个人最佳 */
    const pb = calcPersonalBests();
    h += '<div class="card">';
    h += '<div class="card-title">🏆 个人最佳</div>';
    h += '<div class="stat-grid">';
    h += App.stat(pb.maxDur ? fmtDur(pb.maxDur) : '—', '最长单次时长');
    h += App.stat(pb.maxDist ? pb.maxDist + ' km' : '—', '最远单次距离');
    h += App.stat(pb.maxMonth + ' 次', '单月最多运动');
    h += App.stat(calcStreak() + ' 天', '当前连续');
    h += '</div>';
    h += '</div>';

    /* 已领奖励 */
    const rewards = DB.rewards();
    if (rewards.length) {
      h += '<div class="card">';
      h += '<div class="card-title">🎁 奖励墙</div>';
      h += '<div class="reward-wall">';
      rewards.slice().reverse().forEach((r) => {
        h += '<div class="reward-item">🏅<div class="reward-name">' + Util.esc(r.name) + '</div>' +
          '<div class="reward-month">' + Util.esc(r.month) + '</div></div>';
      });
      h += '</div></div>';
    }
    return h;
  }

  function rewardClaimed(name, ym) {
    return DB.rewards().some((r) => r.name === name && r.month === ym);
  }

  /* ============================================================
   * 打卡 / 记录 表单（新增 + 编辑，统一入口）
   * ========================================================== */
  function loadTemplates() {
    const s = DB.settings();
    return Array.isArray(s.workoutTemplates) ? s.workoutTemplates : [];
  }
  function saveTemplates(list) {
    const s = DB.settings();
    s.workoutTemplates = list;
    DB.setSettings(s);
  }

  function nowLocalInput() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function openCheckinSheet(existing, presetDate) {
    const w = existing || null;
    // 草稿：运动项目（具体动作），兼容旧 sets 结构
    const fromItems = (w && Array.isArray(w.items)) ? w.items :
      (w && Array.isArray(w.sets)) ? w.sets.map((s) => ({ name: s.name || '', sets: 0, reps: Number(s.count) || 0 })) : [];
    App._itemDraft = fromItems.map((s) => ({ name: s.name || '', sets: s.sets || 0, reps: s.reps || 0 }));
    const allNames = (w ? [w.name] : []).concat(App._itemDraft.map((s) => s.name)).filter(Boolean);
    App._autoGroup = (w && w.group) ? w.group : (allNames.length ? classifySport(allNames[0]).key : 'strength');
    App._groupSel = App._autoGroup;
    const initDate = w ? (w.date || Util.today()) : (presetDate || Util.today());
    const initTime = w ? (w.time || '12:00') : new Date().toTimeString().slice(0, 5);
    App._ckDate = initDate;
    App._ckTime = initTime;

    let body = '';
    // 动作组（训练大类）
    body += '<div class="field-label">动作组 · 训练大类</div>';
    body += '<div class="chip-row" id="ckGroups">';
    SPORT_CAT_KEYS.forEach((k) => {
      const c = SPORT_CATEGORIES[k];
      const on = (App._groupSel === k) ? ' active' : '';
      body += '<button type="button" class="chip' + on + '" data-group="' + k + '">' + c.icon + ' ' + c.label + '</button>';
    });
    body += '</div>';

    // 补卡日期行（A+B：可改日期补记过去）
    const isToday0 = App._ckDate === Util.today();
    body += '<div class="ck-date-row">';
    body += '<span class="ck-d" id="ckDateLabel">' + (isToday0 ? '今天 ' : '补卡 ') + App._ckDate.slice(5) + '</span>';
    body += '<span class="ck-chg" id="ckChgDate">改日期补卡 ↩</span>';
    body += '</div>';
    body += '<input type="date" id="ckDatePicker" value="' + App._ckDate + '" style="display:none" />';
    // 时间
    body += '<div class="field-label mt12">时间</div>';
    body += '<input class="field" id="ckTime" type="time" value="' + initTime + '" />';

    // 时长 + 秒表
    body += '<div class="field-label mt12">时长（分钟）</div>';
    body += '<div class="row"><input class="field" id="ckDur" type="number" min="0" inputmode="numeric" placeholder="0" value="' + (w && w.dur ? w.dur : '') + '" />';
    body += '<button type="button" class="btn btn-sm" id="ckTimerBtn">⏱ 秒表</button></div>';
    body += '<div class="chip-row mt8">';
    [15, 30, 45, 60].forEach((v) => { body += '<button type="button" class="chip" data-dur="' + v + '">' + v + '分</button>'; });
    body += '</div>';
    body += '<div class="timer-display" id="ckTimer" hidden>00:00</div>';

    // 距离
    body += '<div class="field-label mt12">距离（公里，选填）</div>';
    body += '<input class="field" id="ckDist" type="number" min="0" step="0.1" inputmode="decimal" placeholder="0" value="' + (w && w.dist ? w.dist : '') + '" />';

    // 运动项目（具体动作）
    body += '<div class="field-label mt12">运动项目 · 具体动作</div>';
    body += '<div class="chip-row" id="ckMoves">';
    USER_MOVES.forEach((p) => {
      body += '<button type="button" class="chip" data-move="' + p + '">' + emojiOf(p) + ' ' + p + '</button>';
    });
    body += '</div>';
    body += '<div id="ckItems"></div>';
    body += '<button type="button" class="btn btn-sm mt8" id="ckAddItem">＋ 加一个运动项目</button>';

    // 备注
    body += '<div class="field-label mt12">备注</div>';
    body += '<textarea class="field" id="ckNote" rows="2" placeholder="今天感觉如何？">' + (w && w.note ? Util.esc(w.note) : '') + '</textarea>';

    // 占比预览（A）：实时显示本次动作大类占比
    body += '<div class="ck-preview" id="ckPreview"></div>';
    // 连续徽章（B）：7 / 30 / 100 天里程碑
    const streakN = calcStreak();
    body += '<div class="ck-badges">';
    [7, 30, 100].forEach((n) => { body += '<div class="ck-mb' + (streakN >= n ? ' on' : '') + '"><b>' + n + '</b><span>天</span></div>'; });
    body += '</div>';
    body += '<button class="btn btn-primary btn-block mt16" id="ckSave">' + (w ? '保存修改' : ('完成打卡 · 连续 ' + streakN + ' 天')) + '</button>';

    openSheet(w ? '编辑记录' : '记录运动', body, (mask) => {
      const durEl = mask.querySelector('#ckDur');
      mask.querySelector('.sheet').classList.add('glass-sheet');

      // 改日期补卡（B）
      const datePicker = mask.querySelector('#ckDatePicker');
      mask.querySelector('#ckChgDate').addEventListener('click', () => {
        if (datePicker.showPicker) datePicker.showPicker(); else datePicker.click();
      });
      datePicker.addEventListener('change', () => {
        App._ckDate = datePicker.value || App._ckDate;
        const isT = App._ckDate === Util.today();
        mask.querySelector('#ckDateLabel').textContent = (isT ? '今天 ' : '补卡 ') + App._ckDate.slice(5);
      });

      // 占比预览（A）：实时更新本次动作的大类分布
      const previewEl = mask.querySelector('#ckPreview');
      const updatePreview = () => {
        const named = App._itemDraft.filter((s) => (s.name || '').trim());
        const total = named.length;
        const COLORS = { aerobic: '#FF7E83', strength: '#FFB454', core: '#FFD166', duration: '#F986B0', ball: '#F986B0', other: '#F986B0' };
        const CAT_LABEL = { aerobic: '有氧', strength: '力量', core: '核心', duration: '时长', ball: '球类', other: '其他' };
        const cnt = {};
        named.forEach((s) => { const k = classifySport(s.name).key; cnt[k] = (cnt[k] || 0) + 1; });
        const keys = Object.keys(cnt);
        let grad;
        if (total) {
          let acc = 0;
          const segs = keys.map((k) => {
            const pct = cnt[k] / total * 100;
            const seg = (COLORS[k] || '#F986B0') + ' ' + acc.toFixed(1) + '% ' + (acc + pct).toFixed(1) + '%';
            acc += pct; return seg;
          });
          grad = segs.join(', ');
        } else { grad = 'var(--surface-2) 0% 100%'; }
        const dayCount = DB.workouts().filter((x) => x.date === App._ckDate).length + (total ? 1 : 0);
        const legend = total ? keys.map((k) => CAT_LABEL[k] + ' ' + cnt[k]).join(' · ') : '选动作后显示占比';
        previewEl.innerHTML = '<div class="ck-pie" style="background:conic-gradient(' + grad + ')"><div class="ct">' + total + '</div></div>' +
          '<div class="ck-pv-txt">本次 <b>' + total + '</b> 个动作<br>' + legend + '<br>' + App._ckDate.slice(5) + ' 将练 ' + dayCount + ' 次</div>';
      };

      // 动作组大类点击
      mask.querySelectorAll('#ckGroups [data-group]').forEach((b) => {
        b.addEventListener('click', () => {
          App._groupSel = b.dataset.group;
          mask.querySelectorAll('#ckGroups [data-group]').forEach((x) => x.classList.remove('active'));
          b.classList.add('active');
        });
      });
      // 运动项目预设点击：加一行
      mask.querySelectorAll('#ckMoves [data-move]').forEach((b) => {
        b.addEventListener('click', () => { App._itemDraft.push({ name: b.dataset.move, sets: 0, reps: 0 }); renderItems(); });
      });
      // 时长快捷
      mask.querySelectorAll('[data-dur]').forEach((b) => {
        b.addEventListener('click', () => { durEl.value = b.dataset.dur; });
      });

      const itemsWrap = mask.querySelector('#ckItems');
      // 运动项目渲染
      const renderItems = () => {
        itemsWrap.innerHTML = App._itemDraft.map((s, i) =>
          '<div class="set-row">' +
          '<input class="field set-name" data-i="' + i + '" placeholder="动作名，如 深蹲" value="' + Util.esc(s.name) + '" />' +
          '<input class="field set-count" data-i="' + i + '" type="number" min="0" inputmode="numeric" placeholder="组" value="' + (s.sets || '') + '" style="width:46px" />' +
          '<span class="set-x">×</span>' +
          '<input class="field set-count" data-i="' + i + '" type="number" min="0" inputmode="numeric" placeholder="次" value="' + (s.reps || '') + '" style="width:46px" />' +
          '<button type="button" class="btn btn-ghost btn-sm" data-del-item="' + i + '">✕</button>' +
          '</div>').join('');
        itemsWrap.querySelectorAll('.set-name').forEach((el) => el.addEventListener('input', () => { App._itemDraft[+el.dataset.i].name = el.value; }));
        itemsWrap.querySelectorAll('.set-count').forEach((el, idx) => el.addEventListener('input', () => { const i = +el.dataset.i; App._itemDraft[i][idx === 0 ? 'sets' : 'reps'] = Number(el.value) || 0; }));
        itemsWrap.querySelectorAll('[data-del-item]').forEach((el) => el.addEventListener('click', () => { App._itemDraft.splice(+el.dataset.delItem, 1); renderItems(); }));
        updatePreview();
      };
      renderItems();
      mask.querySelector('#ckAddItem').addEventListener('click', () => { App._itemDraft.push({ name: '', sets: 0, reps: 0 }); renderItems(); });

      // 秒表
      const timerEl = mask.querySelector('#ckTimer');
      const timerBtn = mask.querySelector('#ckTimerBtn');
      let tState = { running: false, base: 0, start: 0, id: null };
      const paint = () => {
        const ms = tState.base + (tState.running ? Date.now() - tState.start : 0);
        const sec = Math.floor(ms / 1000);
        timerEl.textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
      };
      timerBtn.addEventListener('click', () => {
        timerEl.hidden = false;
        if (!tState.running) {
          tState.running = true; tState.start = Date.now();
          tState.id = setInterval(paint, 250);
          timerBtn.textContent = '⏸ 暂停';
        } else {
          tState.running = false; tState.base += Date.now() - tState.start;
          clearInterval(tState.id);
          const mins = Math.max(1, Math.round(tState.base / 60000));
          durEl.value = mins;
          timerBtn.textContent = '⏱ 继续';
          Util.toast('已计时 ' + mins + ' 分钟，已填入时长');
        }
      });

      // 保存
      mask.querySelector('#ckSave').addEventListener('click', () => {
        const items = App._itemDraft
          .filter((s) => (s.name || '').trim())
          .map((s) => ({ name: (s.name || '').trim(), sets: Number(s.sets) || 0, reps: Number(s.reps) || 0 }));
        if (!items.length) { Util.toast('先添加至少一个运动项目'); return; }
        const name = items[0].name;
        const date = App._ckDate;
        const time = mask.querySelector('#ckTime').value || initTime;
        const dur = Number(durEl.value) || 0;
        const dist = Number(mask.querySelector('#ckDist').value) || 0;
        const note = (mask.querySelector('#ckNote').value || '').trim();
        const group = App._groupSel || classifySport(name).key;
        const count = items.reduce((s, x) => s + (x.sets * x.reps), 0);
        const arr = DB.workouts();
        if (w) {
          const idx = arr.findIndex((x) => x.id === w.id);
          if (idx >= 0) {
            arr[idx] = Object.assign({}, arr[idx], { name, group, date, time: time || '', dur, dist, count, note, items });
          }
          DB.setWorkouts(arr);
          closeSheet(); renderSports(); Util.toast('已保存修改');
        } else {
          arr.push({ id: Store.uid(), name, group, date, time: time || '', dur, dist, count, note, items, created: Date.now() });
          DB.setWorkouts(arr);
          closeSheet(); renderSports();
          Util.toast('🎉 打卡成功！');
          maybeCelebrate(name);
        }
      });

      // 编辑态：提供删除按钮
      if (w) {
        const del = document.createElement('button');
        del.className = 'btn btn-block mt8 btn-danger';
        del.textContent = '删除这条记录';
        del.addEventListener('click', () => {
          if (!confirm('确定删除这条记录？')) return;
          DB.setWorkouts(DB.workouts().filter((x) => x.id !== w.id));
          closeSheet(); renderSports(); Util.toast('已删除');
        });
        mask.querySelector('.sheet').insertBefore(del, mask.querySelector('#sheetCancel'));
      }
    });
  }

  /** 打卡后：若刚好达成某目标，触发庆祝 */
  function maybeCelebrate(name) {
    const ym = Util.today().slice(0, 7);
    const goals = DB.goals();
    if (goals[name] && !rewardClaimed(name, ym)) {
      const cur = monthWorkouts(ym).filter((w) => w.name === name).length;
      if (cur === goals[name]) {
        App._celebrate = true;
      }
    }
  }

  function bindConfettiIfNeeded() {
    if (App._celebrate) { App._celebrate = false; setTimeout(simpleConfetti, 200); }
  }

  /* ---------- 轻量彩带 ---------- */
  function simpleConfetti() {
    const wrap = document.createElement('div');
    wrap.className = 'confetti-wrap';
    const colors = ['#5b7cfa', '#7c5cff', '#1fb877', '#f5a623', '#ef5350'];
    for (let i = 0; i < 40; i++) {
      const s = document.createElement('i');
      s.style.left = Math.random() * 100 + '%';
      s.style.background = colors[i % colors.length];
      s.style.animationDelay = (Math.random() * 0.4) + 's';
      s.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
      wrap.appendChild(s);
    }
    document.querySelector('.phone').appendChild(wrap);
    setTimeout(() => wrap.remove(), 2600);
  }

  /* ============================================================
   * 目标设定弹层
   * ========================================================== */
  function openGoalSheet() {
    const goals = DB.goals();
    let body = '<div class="muted" style="margin-bottom:10px">为常做的运动设定每月目标次数，达成后可领取奖励 🎁</div>';
    body += '<div id="goalList"></div>';
    body += '<div class="row mt12"><input class="field" id="goalName" placeholder="运动名，如 跑步" /><input class="field" id="goalNum" type="number" min="1" placeholder="次/月" style="max-width:100px" /></div>';
    body += '<button class="btn btn-primary btn-block mt12" id="goalAdd">添加 / 更新目标</button>';
    openSheet('设定月目标', body, (mask) => {
      const listEl = mask.querySelector('#goalList');
      const paint = () => {
        const g = DB.goals();
        const keys = Object.keys(g).filter((k) => g[k] > 0);
        if (!keys.length) { listEl.innerHTML = '<div class="muted">还没有目标</div>'; return; }
        listEl.innerHTML = keys.map((k) =>
          '<div class="set-row"><span style="flex:1">' + emojiOf(k) + ' ' + Util.esc(k) + '</span>' +
          '<span class="muted">' + g[k] + ' 次/月</span>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-del-goal="' + Util.esc(k) + '">✕</button></div>').join('');
        listEl.querySelectorAll('[data-del-goal]').forEach((b) => b.addEventListener('click', () => {
          const gg = DB.goals(); delete gg[b.dataset.delGoal]; DB.setGoals(gg); paint();
        }));
      };
      paint();
      mask.querySelector('#goalAdd').addEventListener('click', () => {
        const name = (mask.querySelector('#goalName').value || '').trim();
        const num = Number(mask.querySelector('#goalNum').value) || 0;
        if (!name || num <= 0) { Util.toast('填写运动名和目标次数'); return; }
        const gg = DB.goals(); gg[name] = num; DB.setGoals(gg);
        mask.querySelector('#goalName').value = ''; mask.querySelector('#goalNum').value = '';
        paint(); Util.toast('已设定：' + name + ' ' + num + '次/月');
      });
    });
  }

  /* ============================================================
   * 动作注册
   * ========================================================== */
  App.onAction('sport.nav', (btn) => { App.sportView = btn.dataset.view; App.calSelected = null; renderSports(); });
  App.onAction('sports.toggleRecords', () => { App.recordOpen = !App.recordOpen; renderSports(); });
  App.onAction('sports.add', (btn) => openCheckinSheet(null, btn && btn.dataset ? btn.dataset.date : null));

  App.onAction('quick.checkin', (btn) => {
    const name = btn.dataset.name;
    const group = classifySport(name).key;
    const now = new Date();
    const arr = DB.workouts();
    arr.push({
      id: Store.uid(), name, group, date: Util.today(),
      time: String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
      dur: 0, dist: 0, count: 0, note: '', items: [{ name: name, sets: 0, reps: 0 }], created: Date.now(),
    });
    DB.setWorkouts(arr);
    renderSports();
    Util.toast('✅ 已打卡「' + name + '」，点记录可补充详情');
    maybeCelebrate(name); bindConfettiIfNeeded();
  });

  App.onAction('checkin.edit', (btn) => {
    const w = DB.workouts().find((x) => x.id === btn.dataset.id);
    if (w) openCheckinSheet(w);
  });

  App.onAction('checkin.del', (btn, e) => {
    if (e) e.stopPropagation();
    if (!confirm('确定删除这条记录？')) return;
    DB.setWorkouts(DB.workouts().filter((x) => x.id !== btn.dataset.id));
    renderSports(); Util.toast('已删除');
  });

  App.onAction('cal.prev', () => {
    App.calMonth--; if (App.calMonth < 0) { App.calMonth = 11; App.calYear--; }
    App.calSelected = null; renderSports();
  });
  App.onAction('cal.next', () => {
    App.calMonth++; if (App.calMonth > 11) { App.calMonth = 0; App.calYear++; }
    App.calSelected = null; renderSports();
  });
  App.onAction('cal.select', (btn) => {
    const d = btn.dataset.date;
    App.calSelected = (App.calSelected === d) ? null : d;
    renderSports();
  });

  App.onAction('sport.goal', () => openGoalSheet());

  App.onAction('reward.claim', (btn) => {
    const name = btn.dataset.name;
    const ym = Util.today().slice(0, 7);
    if (rewardClaimed(name, ym)) { Util.toast('本月已领取'); return; }
    const arr = DB.rewards();
    arr.push({ id: Store.uid(), name, month: ym, date: Util.today() });
    DB.setRewards(arr);
    renderSports();
    simpleConfetti();
    Util.toast('🎉 恭喜达成「' + name + '」月目标，奖励已收入奖励墙！');
  });

})();
