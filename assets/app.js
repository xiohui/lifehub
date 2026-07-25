/* ============================================================
 * app.js — 生活家 LifeHub 主框架（v34 模块化）
 * 模块加载顺序：store → sport-cats → app(core) → life → sports → travel → ai → settings
 * ========================================================== */
(function () {
  'use strict';
  console.log('LifeHub v34 模块化版已加载');

  const { Store, Util } = window;
  const screen = document.getElementById('screen');
  const topTitle = document.getElementById('topTitle');
  const topSub = document.getElementById('topSub');

  /* ============================================================
   * 数据访问层
   * ========================================================== */
  const DB = {
    todos: () => Store.get('todos', []),
    setTodos: (v) => Store.set('todos', v),
    habits: () => Store.get('habits', []),
    setHabits: (v) => Store.set('habits', v),
    vlogs: () => Store.get('vlogs', []),
    setVlogs: (v) => Store.set('vlogs', v),
    notes: () => Store.get('notes', []),
    setNotes: (v) => Store.set('notes', v),
    sports: () => Store.get('sports', []),
    setSports: (v) => Store.set('sports', v),
    workouts: () => Store.get('workouts', []),
    setWorkouts: (v) => Store.set('workouts', v),
    goals: () => Store.get('goals', {}),
    setGoals: (v) => Store.set('goals', v),
    trips: () => Store.get('trips', []),
    setTrips: (v) => Store.set('trips', v),
    places: () => Store.get('places', []),
    setPlaces: (v) => Store.set('places', v),
    chat: () => Store.get('chat', []),
    setChat: (v) => Store.set('chat', v),
    settings: () => Store.get('settings', {}),
    setSettings: (v) => Store.set('settings', v),
    rewards: () => Store.get('rewards', []),
    setRewards: (v) => Store.set('rewards', v),
    imports: () => Store.get('imports', []),
    setImports: (v) => Store.set('imports', v),
    books: () => Store.get('books', []),
    setBooks: (v) => Store.set('books', v),
    readingLogs: () => Store.get('readingLogs', []),
    setReadingLogs: (v) => Store.set('readingLogs', v),
  };

  /* ============================================================
   * 共享状态
   * ========================================================== */
  const App = {
    currentTab: 'life',
    lifeView: 'todo',
    todoFilter: 'undone',
    noteTag: null,
    noteSearch: '',
    noteSort: 'time_desc',
    aiView: 'chat',
    aiMode: DB.settings().aiMode || 'local',
    sportView: 'feed',
    calYear: null,
    calMonth: null,
    calSelected: null,
    calFilter: 'all',
    vlogDraftPhotos: [],
    showRecent: false,
    showRecentVlog: false,
    focus: { running: false, id: null, remaining: 25 * 60, total: 25 * 60, todoId: null, started: false },
    timer: { running: false, start: 0, base: 0, id: null },
    dragState: { el: null, list: null, pid: null, moved: false },
    dragBound: false,
    lastRemind: {},
    _wllm: null,
    _wllmLoading: null,
    chatMsgCount: 0,
  };
  window.App = App;

  /* ============================================================
   * 动作处理器注册
   * ========================================================== */
  const actionHandlers = {};
  App.onAction = function onAction(action, handler) {
    if (Array.isArray(action)) {
      action.forEach((a) => { actionHandlers[a] = handler; });
    } else {
      actionHandlers[action] = handler;
    }
  };
  App.renderers = {};

  /* ============================================================
   * 底部弹层
   * ========================================================== */
  function openSheet(title, bodyHtml, onMount) {
    closeSheet();
    const mask = document.createElement('div');
    mask.className = 'sheet-mask';
    mask.innerHTML =
      '<div class="sheet"><h3>' + Util.esc(title) + '</h3>' +
      bodyHtml +
      '<button class="btn btn-block mt16" id="sheetCancel">取消</button></div>';
    document.querySelector('.phone').appendChild(mask);
    mask.addEventListener('click', (e) => { if (e.target === mask) closeSheet(); });
    mask.querySelector('#sheetCancel').addEventListener('click', closeSheet);
    if (onMount) onMount(mask);
    return mask;
  }
  function closeSheet() {
    const m = document.querySelector('.sheet-mask');
    if (m) m.remove();
  }
  App.openSheet = openSheet;
  App.closeSheet = closeSheet;

  /* ============================================================
   * 通用工具渲染
   * ========================================================== */
  function chip(view, label, on) {
    return '<button class="chip ' + (on ? 'active' : '') + '" data-action="life.view" data-view="' + view + '">' + label + '</button>';
  }
  function stat(num, lbl) {
    return '<div class="stat"><div class="num">' + num + '</div><div class="lbl">' + lbl + '</div></div>';
  }
  function empty(big, msg) {
    return '<div class="empty"><div class="big">' + big + '</div>' + msg + '</div>';
  }
  App.chip = chip;
  App.stat = stat;
  App.empty = empty;

  /* ============================================================
   * 顶部栏 + Tab 切换
   * ========================================================== */
  const TAB_META = {
    life:   { title: '生活', sub: '让每一天更有序' },
    sports: { title: '运动', sub: '记录每一次汗水' },
    travel: { title: '旅行', sub: '探索世界的角落' },
    ai:     { title: 'AI 助手', sub: '你的随身智能伙伴' },
    me:     { title: '我的', sub: '设置与数据' },
  };

  function renderTab(tab) {
    App.currentTab = tab;
    const meta = TAB_META[tab];
    topTitle.textContent = meta.title;
    topSub.textContent = meta.sub;
    document.querySelectorAll('.tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    if (App.renderers[tab]) App.renderers[tab]();
    screen.scrollTop = 0;
  }
  App.renderTab = renderTab;

  document.getElementById('tabbar').addEventListener('click', (e) => {
    const t = e.target.closest('.tab');
    if (t) renderTab(t.dataset.tab);
  });

  /* ============================================================
   * 主事件分发（基于 data-action 委托）
   * ========================================================== */
  screen.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (actionHandlers[action]) {
      e.preventDefault();
      actionHandlers[action](btn, e);
    }
  });

  // 回车快捷添加
  screen.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.id === 'todoInput') { e.preventDefault(); const btn = screen.querySelector('[data-action="todo.add"]'); if (btn) btn.click(); }
      if (e.target.id === 'habitInput') { e.preventDefault(); const btn = screen.querySelector('[data-action="habit.add"]'); if (btn) btn.click(); }
      if (e.target.id === 'aiInput') { e.preventDefault(); if (App.sendAI) App.sendAI(); }
    }
  });

  /* ============================================================
   * 导出 / 清空
   * ========================================================== */
  function exportData() {
    const data = {
      todos: DB.todos(), habits: DB.habits(), notes: DB.notes(),
      sports: DB.sports(), workouts: DB.workouts(), goals: DB.goals(), rewards: DB.rewards(),
      trips: DB.trips(), places: DB.places(), chat: DB.chat(), vlogs: DB.vlogs(), books: DB.books(),
      readingLogs: DB.readingLogs(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'lifehub-backup-' + Util.today() + '.json';
    a.click();
    URL.revokeObjectURL(url);
    Util.toast('已导出');
  }

  function clearData() {
    if (!confirm('确定清空全部数据？此操作不可恢复。')) return;
    ['todos', 'habits', 'notes', 'sports', 'workouts', 'goals', 'rewards', 'trips', 'places', 'chat', 'vlogs', 'books', 'readingLogs', 'imports'].forEach((k) => Store.remove(k));
    Util.toast('已清空');
    renderTab(App.currentTab);
  }

  /* ============================================================
   * 启动
   * ========================================================== */
  async function init() {
    await Store.init();   // 先异步载入 IndexedDB 数据（含首次从 localStorage 迁移），再做首次渲染
    const s = DB.settings();
    document.body.classList.toggle('dark', s.theme === 'dark');
    document.body.classList.toggle('light', s.theme === 'light');

    const q = new URLSearchParams(location.search).get('q');
    const lifeViews = ['todo', 'vlog', 'note', 'reading'];
    const tabs = ['life', 'sports', 'travel', 'ai', 'me'];
    if (q) {
      if (lifeViews.includes(q)) { App.lifeView = q; renderTab('life'); }
      else if (tabs.includes(q)) { renderTab(q); }
      else renderTab('life');
    } else {
      renderTab('life');
    }

    App.startReminders();
    initInstall();

    window.addEventListener('beforeunload', (e) => {
      e.preventDefault();
      e.returnValue = '';
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('assets/sw.js?v=53').catch(() => {});
      });
    }
  }

  function initInstall() {
    const bar = document.getElementById('installBar');
    const btn = document.getElementById('installBtn');
    const info = document.getElementById('installInfo');
    const close = document.getElementById('installClose');
    if (!bar) return;
    const hide = () => bar.setAttribute('hidden', '');
    const show = () => bar.removeAttribute('hidden');
    if (installDone()) { hide(); return; }
    let deferred = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      show();
    });
    window.addEventListener('appinstalled', () => {
      deferred = null; hide();
      try { localStorage.setItem('lifehub_install_done', '1'); } catch (e) {}
    });
    try {
      window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
        if (e.matches) { hide(); try { localStorage.setItem('lifehub_install_done', '1'); } catch (er) {} }
      });
    } catch (e) {}
    if (btn) btn.addEventListener('click', async () => {
      if (!deferred) { if (info) info.classList.toggle('show'); return; }
      deferred.prompt();
      try { const r = await deferred.userChoice; if (r.outcome === 'accepted') hide(); } catch (e) {}
      deferred = null;
    });
    if (close) close.addEventListener('click', hide);
    const noMore = document.querySelector('#installBar .install-skip');
    if (noMore) noMore.addEventListener('click', () => {
      try { localStorage.setItem('lifehub_install_done', '1'); } catch (e) {}
      hide();
      Util.toast('已不再提示安装');
    });
    setTimeout(() => {
      if (!deferred && !installDone()) { show(); if (info) info.classList.add('show'); }
    }, 1800);
  }

  function installDone() {
    try { if (localStorage.getItem('lifehub_install_done') === '1') return true; } catch (e) {}
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  /* ============================================================
   * 启动时同步全局引用
   * ========================================================== */
  App.DB = DB;
  App.screen = screen;

  // 暴露给模块使用
  App.exportData = exportData;
  App.clearData = clearData;

  // 注册跨模块动作（不依赖具体模块内容的通用动作）
  App.onAction('install.noMore', () => {
    try { localStorage.setItem('lifehub_install_done', '1'); } catch (e) {}
    const bar = document.getElementById('installBar');
    if (bar) bar.setAttribute('hidden', '');
    Util.toast('已不再提示安装');
  });

  App.onAction('me.export', exportData);
  App.onAction('me.clear', clearData);

  // 模块（life/sports/travel/ai/settings 等）在 app.js 之后才加载并注册各自的
  // renderer 与 action handler，且 init() 依赖 App.startReminders / App.renderers 等，
  // 因此必须等所有脚本执行完（DOMContentLoaded）再启动，否则会白屏。
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
