/* ============================================================
 * life.js — 生活模块（待办 / VLOG / 备忘 / 统计 / 习惯）
 * ========================================================== */
(function () {
  'use strict';

  const { Store, Util, App } = window;
  const { DB, openSheet, closeSheet, renderTab, chip, stat, empty } = App;

  /* ============================================================
   * 渲染主入口
   * ========================================================== */
  function renderLife() {
    let html = '<div class="chip-row section-gap">';
    html += chip('todo', '待办', App.lifeView === 'todo');
    html += chip('reading', '读书', App.lifeView === 'reading');
    html += chip('vlog', 'VLOG', App.lifeView === 'vlog');
    html += chip('stats', '统计', App.lifeView === 'stats');
    html += '</div>';
    if (App.lifeView === 'todo') html += lifeTodo();
    else if (App.lifeView === 'reading') html += lifeReading();
    else if (App.lifeView === 'vlog') html += lifeVlog();
    else html += lifeStats();
    App.screen.innerHTML = html;
    if (App.lifeView === 'todo') enableTodoDrag();
  }
  App.renderers.life = renderLife;

  /* ============================================================
   * 待办
   * ========================================================== */
  function lifeTodo() {
    if (!App.todoFilter) App.todoFilter = 'undone';
    let all = DB.todos();
    let needSave = false;
    all = all.map((t, i) => { if (typeof t.order !== 'number') { t.order = i; needSave = true; } return t; });
    if (needSave) DB.setTodos(all);
    const today = Util.today();
    const isToday = (t) => t.due && Util.dayDiff(today, t.due) <= 0;
    const filters = [['all', '全部'], ['today', '今天'], ['undone', '未完成'], ['important', '重要']];
    const canDrag = true;
    let fhtml = '<div class="chip-row" style="margin:14px 0 12px">';
    filters.forEach(([k, lbl]) => {
      fhtml += '<button class="chip ' + (App.todoFilter === k ? 'active' : '') + '" data-action="todo.filter" data-f="' + k + '">' + lbl + '</button>';
    });
    fhtml += '</div>';
    if (App.todoDoneOpen === undefined) App.todoDoneOpen = false;
    let list = all;
    if (App.todoFilter === 'today') list = all.filter(isToday).sort((a, b) => a.order - b.order);
    else if (App.todoFilter === 'undone') list = all.filter((t) => !t.done).sort((a, b) => a.order - b.order);
    else if (App.todoFilter === 'important') list = all.filter((t) => t.important).sort((a, b) => a.order - b.order);

    let h = '<div class="card"><div class="row"><input class="field" id="todoInput" placeholder="添加待办，如「明天10点 交报告」" /><button class="btn btn-primary btn-sm" data-action="todo.add">添加</button></div>';
    h += fhtml;

    if (!all.length) {
      h += empty('📝', '还没有待办，添加第一件吧');
    } else if (App.todoFilter === 'all') {
      const undone = all.filter((t) => !t.done).sort((a, b) => a.order - b.order);
      const done = all.filter((t) => t.done).sort((a, b) => a.order - b.order);
      if (undone.length) {
        h += '<div id="todoList">';
        undone.forEach((t) => { h += todoRow(t, canDrag); });
        h += '</div>';
        if (canDrag) h += '<div class="muted mt8" style="font-size:11.5px;padding:0 4px">⠿ 拖动手柄可排序（所有视图通用，仅重排当前看到的项）</div>';
      }
      if (done.length) {
        const open = App.todoDoneOpen;
        h += '<div class="todo-done-head" data-action="todo.toggleDone">';
        h += '<span class="rec-count">' + done.length + '</span> ✅ 已完成';
        h += '<span class="chevron">' + (open ? '▾' : '▸') + '</span></div>';
        h += '<div class="collapsible-body' + (open ? ' open' : '') + '">';
        done.forEach((t) => { h += todoRow(t, false); });
        h += '</div>';
      }
      if (!undone.length && !done.length) h += empty('🔍', '这个筛选下没有待办');
    } else if (!list.length) {
      h += empty('🔍', '这个筛选下没有待办');
    } else {
      h += '<div id="todoList">';
      list.forEach((t) => { h += todoRow(t, canDrag); });
      h += '</div>';
      if (canDrag) h += '<div class="muted mt8" style="font-size:11.5px;padding:0 4px">⠿ 拖动手柄可排序（所有视图通用，仅重排当前看到的项）</div>';
    }
    h += '</div></div>';
    h += habitsSection();
    return h;
  }

  /* ============================================================
   * 读书打卡（独立视图，生活页 chip 行「读书」）
   * ========================================================== */
  function lifeReading() {
    return renderBooks();
  }

  function todoRow(t, canDrag) {
    const today = Util.today();
    const overdue = t.due && !t.done && Util.dayDiff(today, t.due) < 0;
    const subs = t.subtasks || [];
    const subDone = subs.filter((s) => s.done).length;
    let h = '<div class="item ' + (t.done ? 'done' : '') + '" data-id="' + t.id + '">';
    if (canDrag) h += '<div class="drag-handle" title="拖动排序">⠿</div>';
    h += '<div class="check ' + (t.done ? 'on' : '') + '" data-action="todo.toggle" data-id="' + t.id + '">' + (t.done ? '✓' : '') + '</div>';
    h += '<div class="main"><div class="title">' + (t.important ? '⭐ ' : '') + Util.esc(t.text) + '</div>';
    if (t.due) {
      h += '<div class="meta" style="' + (overdue ? 'color:var(--red)' : '') + '">📅 ' + Util.prettyDate(t.due) + (t.time ? ' ' + t.time : '') + (overdue ? ' · 逾期' : '') + '</div>';
    } else {
      h += '<div class="meta"><button class="chip chip-sm" data-action="todo.setdue" data-id="' + t.id + '" data-days="0">今天</button><button class="chip chip-sm" data-action="todo.setdue" data-id="' + t.id + '" data-days="1">明天</button><button class="chip chip-sm" data-action="todo.setdue" data-id="' + t.id + '" data-days="7">下周</button></div>';
    }
    if (t.focus) h += '<div class="meta">🍅 已专注 ' + t.focus + ' 分</div>';
    if (subs.length) h += '<div class="meta">📋 子任务 ' + subDone + '/' + subs.length + (subDone === subs.length ? ' ✓' : '') + '</div>';
    h += '</div>';
    h += '<button class="btn btn-ghost btn-sm" data-action="todo.star" data-id="' + t.id + '" title="标记重要">' + (t.important ? '⭐' : '☆') + '</button>';
    h += '<button class="btn btn-ghost btn-sm" data-action="todo.focus" data-id="' + t.id + '" title="专注计时">🍅</button>';
    h += '<button class="btn btn-ghost btn-sm" data-action="todo.sub.open" data-id="' + t.id + '" title="子任务">📋' + (subs.length ? ' ' + subDone + '/' + subs.length : '') + '</button>';
    h += '<button class="btn btn-ghost btn-sm" data-action="todo.del" data-id="' + t.id + '">删</button></div>';
    return h;
  }

  /* ---------------- 待办拖拽排序 ---------------- */
  function enableTodoDrag() {
    const list = document.getElementById('todoList');
    if (!list) return;
    App.dragState.list = list;
    list.querySelectorAll('.drag-handle').forEach((hd) => {
      hd.addEventListener('pointerdown', (e) => {
        const item = hd.closest('.item');
        if (!item) return;
        App.dragState.el = item; App.dragState.pid = e.pointerId; App.dragState.moved = false;
        item.classList.add('dragging');
        try { hd.setPointerCapture(e.pointerId); } catch (_) {}
        e.preventDefault();
      });
    });
    if (!App.dragBound) {
      App.dragBound = true;
      document.addEventListener('pointermove', (e) => {
        if (!App.dragState.el) return;
        const list = App.dragState.list;
        const y = e.clientY;
        const sibs = [...list.querySelectorAll('.item:not(.dragging)')];
        for (const sib of sibs) {
          const r = sib.getBoundingClientRect();
          if (y < r.top + r.height / 2) { list.insertBefore(App.dragState.el, sib); App.dragState.moved = true; return; }
        }
        list.appendChild(App.dragState.el); App.dragState.moved = true;
      });
      document.addEventListener('pointerup', () => {
        if (!App.dragState.el) return;
        const el = App.dragState.el; el.classList.remove('dragging'); App.dragState.el = null;
        if (!App.dragState.moved) return;
        const list = App.dragState.list;
        const ids = [...list.querySelectorAll('.item')].map((it) => it.dataset.id);
        const arr = DB.todos();
        const byId = {}; arr.forEach((t) => { byId[t.id] = t; });
        const visibleSet = new Set(ids);
        const queue = [...ids];
        const merged = [];
        arr.slice().sort((a, b) => a.order - b.order).forEach((t) => {
          if (visibleSet.has(t.id)) merged.push(byId[queue.shift()]);
          else merged.push(t);
        });
        merged.forEach((t, i) => { t.order = i; });
        DB.setTodos(merged);
        renderLife();
      });
    }
  }

  /* ============================================================
   * VLOG
   * ========================================================== */
  function lifeVlog() {
    const vlogs = DB.vlogs().slice().sort((a, b) => (b.created || 0) - (a.created || 0));
    let h = '<div class="card"><button class="btn btn-primary btn-block" data-action="vlog.add">＋ 记一条 VLOG</button>' +
      '<div class="muted mt8" style="font-size:11.5px">📷 可上传照片，第一张作为封面 · 数据只存本机</div></div>';
    if (!vlogs.length) {
      h += empty('📷', '还没有 VLOG，记录生活的精彩瞬间吧');
    } else {
      h += '<div class="vlog-grid">';
      vlogs.forEach((v) => {
        const cover = (v.photos && v.photos.length) ? v.photos[0] : '';
        h += '<div class="vlog-card" data-action="vlog.open" data-id="' + v.id + '">';
        h += '<div class="vlog-cover' + (cover ? '' : ' no-photo') + '">';
        if (cover) h += '<img src="' + cover + '" alt="" />';
        else h += '<div class="vlog-cover-ph">📷</div>';
        h += '<div class="vlog-date">' + Util.esc(v.date) + '</div>';
        h += '</div>';
        h += '<div class="vlog-info"><div class="vlog-title">' + Util.esc(v.title || '未命名 VLOG') + '</div>';
        h += '<div class="vlog-sub">' + ((v.photos && v.photos.length) ? v.photos.length + ' 张' : '无照片') +
          ' · ' + ((v.text || '').trim() ? '有文字' : '随手记') + '</div></div>';
        h += '</div>';
      });
      h += '</div>';
    }
    return h;
  }

  function compressImage(file, maxW, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read fail'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('img fail'));
        img.onload = () => {
          let w = img.width, hgt = img.height;
          if (w > maxW) { hgt = Math.round(hgt * maxW / w); w = maxW; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = hgt;
          canvas.getContext('2d').drawImage(img, 0, 0, w, hgt);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function openVlogSheet() {
    App.vlogDraftPhotos = [];
    const d = Util.today();
    openSheet('记一条 VLOG',
      '<input class="field" id="vTitle" placeholder="标题，如「周末爬山」" />' +
      '<div class="row mt12"><input class="field" id="vDate" type="date" value="' + d + '" />' +
      '<button class="btn btn-ghost btn-sm" id="vPickPhoto">📷 加照片</button></div>' +
      '<input type="file" id="vPhoto" accept="image/*" multiple style="display:none" />' +
      '<div class="photo-thumbs mt12" id="vThumbs"></div>' +
      '<textarea class="field mt12" id="vText" rows="4" placeholder="写点什么…记录此刻的心情、发生了什么"></textarea>' +
      '<button class="btn btn-primary btn-block mt12" id="vSave">保存</button>',
      (mask) => {
        const fileInput = mask.querySelector('#vPhoto');
        const thumbs = mask.querySelector('#vThumbs');
        const renderThumbs = () => {
          thumbs.innerHTML = App.vlogDraftPhotos.map((p, i) =>
            '<div class="photo-thumb"><img src="' + p + '" alt="" />' +
            '<span class="ph-badge' + (i === 0 ? ' cover' : '') + '">' + (i === 0 ? '封面' : (i + 1)) + '</span>' +
            '<button class="ph-del" data-del="' + i + '">✕</button></div>'
          ).join('');
          thumbs.querySelectorAll('[data-del]').forEach((b) => {
            b.addEventListener('click', () => { App.vlogDraftPhotos.splice(+b.dataset.del, 1); renderThumbs(); });
          });
        };
        mask.querySelector('#vPickPhoto').addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', async () => {
          const files = [...fileInput.files];
          for (const f of files) {
            try { App.vlogDraftPhotos.push(await compressImage(f, 1024, 0.7)); }
            catch (e) { /* skip bad images */ }
          }
          fileInput.value = '';
          renderThumbs();
        });
        mask.querySelector('#vSave').addEventListener('click', () => {
          const title = (document.getElementById('vTitle').value || '').trim();
          const date = document.getElementById('vDate').value || Util.today();
          const text = (document.getElementById('vText').value || '').trim();
          if (!title && !text && !App.vlogDraftPhotos.length) { Util.toast('写点什么或加张照片吧'); return; }
          const arr = DB.vlogs();
          arr.push({ id: Store.uid(), title: title || '随手记', date, text, photos: App.vlogDraftPhotos.slice(), created: Date.now() });
          if (DB.setVlogs(arr)) {
            const warn = Store.warnIfFull();
            if (warn) Util.toast(warn.slice(0, 60) + '…');
            App.vlogDraftPhotos = []; closeSheet(); renderLife(); Util.toast('已记录 VLOG');
          } else {
            Util.toast('照片太大，本地空间不足，请删减后再试');
          }
        });
      });
  }

  function openVlogDetail(id) {
    const v = DB.vlogs().find((x) => x.id === id);
    if (!v) return;
    let body = '<div class="vlog-detail">';
    if (v.photos && v.photos.length) {
      body += '<div class="vlog-photos">';
      v.photos.forEach((p) => { body += '<img src="' + p + '" alt="" />'; });
      body += '</div>';
    }
    body += '<div class="vlog-d-date">📅 ' + Util.esc(v.date) + '</div>';
    body += '<div class="vlog-d-text" style="white-space:pre-wrap">' +
      (v.text ? Util.esc(v.text) : '<span class="muted">（没有文字）</span>') + '</div>';
    body += '</div>';
    openSheet(Util.esc(v.title || '未命名 VLOG'), body, (mask) => {
      const del = document.createElement('button');
      del.className = 'btn btn-block mt16';
      del.style.background = 'var(--red)';
      del.style.color = '#fff';
      del.textContent = '删除这条 VLOG';
      del.addEventListener('click', () => {
        DB.setVlogs(DB.vlogs().filter((x) => x.id !== id));
        closeSheet(); renderLife(); Util.toast('已删除');
      });
      mask.querySelector('.sheet').insertBefore(del, mask.querySelector('#sheetCancel'));
    });
  }

  /* ============================================================
   * 统计
   * ========================================================== */
  function lifeStats() {
    const todos = DB.todos();
    const today = Util.today();
    const doneTodos = todos.filter((t) => t.done).length;
    const overdue = todos.filter((t) => t.due && !t.done && Util.dayDiff(today, t.due) < 0).length;
    const vlogs = DB.vlogs();
    const ym = today.slice(0, 7);
    const monthVlogs = vlogs.filter((v) => (v.date || '').slice(0, 7) === ym).length;
    const focusMin = todos.reduce((s, t) => s + (t.focus || 0), 0);
    const habits = DB.habits();
    const habitsMonthPct = habits.length ? Math.round(habits.filter((h) => h.dates && h.dates.some((d) => d.slice(0, 7) === ym)).length / habits.length * 100) : 0;

    let h = '<div class="card"><div class="card-title">📊 生活概览</div><div class="stat-grid">';
    h += stat(doneTodos + '/' + todos.length, '待办完成');
    h += stat(overdue + ' 件', '逾期待办');
    h += stat(vlogs.length + ' 条', 'VLOG 总数');
    h += stat(monthVlogs + ' 条', '本月 VLOG');
    h += stat(habitsMonthPct + '%', '本月习惯');
    h += stat(focusMin + ' 分', '累计专注');
    h += '</div></div>';

    if (vlogs.length) {
      const recent = vlogs.slice().sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 3);
      h += '<div class="card">';
      h += '<div class="card-title recent-toggle" data-action="stats.toggleRecentVlog">最近 VLOG <span class="muted">' + recent.length + ' 条 · ' + (App.showRecentVlog ? '收起 ▴' : '展开 ▾') + '</span></div>';
      h += '<div class="recent-body"' + (App.showRecentVlog ? '' : ' style="display:none"') + '>';
      recent.forEach((v) => {
        h += '<div class="item" style="padding:8px 0"><div class="check" style="cursor:default">📷</div>';
        h += '<div class="main"><div class="title" style="font-weight:500">' + Util.esc(v.title || '未命名') + '</div>';
        h += '<div class="meta">' + Util.esc(v.date) + ' · ' + ((v.photos && v.photos.length) ? v.photos.length + ' 张照片' : '无照片') + '</div></div></div>';
      });
      h += '</div>';
      h += '</div>';
    } else {
      h += empty('📷', '还没有 VLOG，去「VLOG」记一条吧');
    }
    h += '<div class="card center muted" style="font-size:12px">数据来自本机，换设备不互通</div>';
    return h;
  }

  function noteDay(c) {
    if (!c && c !== 0) return Util.today();
    if (typeof c === 'number') return Util.fmtDate(new Date(c));
    const s = String(c);
    return s.length >= 10 ? s.slice(0, 10) : Util.today();
  }

  /* ============================================================
   * 番茄专注
   * ========================================================== */
  function openFocus(id) {
    const t = DB.todos().find((x) => x.id === id);
    if (!t) return;
    App.focus.todoId = id; App.focus.total = 25 * 60; App.focus.remaining = App.focus.total; App.focus.started = false; App.focus.running = false;
    openSheet('🍅 专注：' + t.text,
      '<div class="center" style="font-size:36px;font-weight:700;font-variant-numeric:tabular-nums" id="focusDisplay">25:00</div>' +
      '<div class="row mt12"><select class="field" id="focusDur">' +
        '<option value="25">🍅 25 分钟</option><option value="45">⏱ 45 分钟</option><option value="5">☕ 5 分钟</option></select></div>' +
      '<div class="row mt12"><button class="btn btn-primary btn-block" id="focusBtn">开始</button><button class="btn" id="focusReset">重置</button></div>',
      (mask) => {
        const disp = mask.querySelector('#focusDisplay');
        const btn = mask.querySelector('#focusBtn');
        const dur = mask.querySelector('#focusDur');
        dur.addEventListener('change', () => {
          if (App.focus.running) return;
          App.focus.total = Number(dur.value) * 60; App.focus.remaining = App.focus.total; focusSetDisplay(disp);
        });
        btn.addEventListener('click', () => {
          if (!App.focus.running) {
            App.focus.running = true; App.focus.started = true; btn.textContent = '暂停';
            App.focus.id = setInterval(() => {
              App.focus.remaining--;
              focusSetDisplay(disp);
              if (App.focus.remaining <= 0) focusAutoFinish();
            }, 1000);
          } else {
            App.focus.running = false; clearInterval(App.focus.id); btn.textContent = '继续';
          }
        });
        mask.querySelector('#focusReset').addEventListener('click', () => {
          App.focus.running = false; clearInterval(App.focus.id); App.focus.remaining = App.focus.total; focusSetDisplay(disp); btn.textContent = '开始';
        });
        const done = document.createElement('button');
        done.className = 'btn btn-block mt12';
        done.textContent = '结束并记录专注';
        done.addEventListener('click', focusFinishManual);
        mask.querySelector('.sheet').appendChild(done);
        mask.querySelector('#sheetCancel').remove();
      });
  }

  function focusSetDisplay(el) {
    const m = String(Math.floor(App.focus.remaining / 60)).padStart(2, '0');
    const s = String(App.focus.remaining % 60).padStart(2, '0');
    if (el) el.textContent = m + ':' + s;
  }

  function focusAutoFinish() {
    clearInterval(App.focus.id); App.focus.running = false;
    focusRecord(Math.round(App.focus.total / 60));
    // 自动开始休息
    setTimeout(() => {
      Util.toast('☕ 专注完成！休息 5 分钟吧');
      openFocusRest();
    }, 500);
  }

  function openFocusRest() {
    closeSheet();
    Util.toast('☕ 休息 5 分钟开始…');
    setTimeout(() => Util.toast('☕ 休息结束，继续加油！'), 5 * 60 * 1000);
  }

  function focusFinishManual() {
    clearInterval(App.focus.id); App.focus.running = false;
    const elapsed = App.focus.started ? Math.max(1, Math.round((App.focus.total - App.focus.remaining) / 60)) : 0;
    focusRecord(elapsed || Math.round(App.focus.total / 60));
  }

  function focusRecord(mins) {
    const arr = DB.todos(); const i = arr.findIndex((x) => x.id === App.focus.todoId);
    if (i >= 0) { arr[i].focus = (arr[i].focus || 0) + mins; DB.setTodos(arr); }
    closeSheet(); renderLife(); Util.toast('专注完成 +' + mins + ' 分钟');
  }

  /* ============================================================
   * 子任务
   * ========================================================== */
  function openSubSheet(id) {
    const t = DB.todos().find((x) => x.id === id);
    if (!t) return;
    if (!t.subtasks) t.subtasks = [];
    const renderBody = () => {
      const done = t.subtasks.filter((s) => s.done).length;
      let b = '<div id="subBody">';
      b += '<div class="muted" style="margin-bottom:8px">进度 ' + done + ' / ' + t.subtasks.length + '</div>';
      if (t.subtasks.length) {
        b += '<div class="subtask-list">';
        t.subtasks.forEach((s, i) => {
          b += '<div class="subtask">';
          b += '<div class="check ' + (s.done ? 'on' : '') + '" data-sub-toggle="' + i + '">' + (s.done ? '✓' : '') + '</div>';
          b += '<div class="subtask-text ' + (s.done ? 'done' : '') + '">' + Util.esc(s.text) + '</div>';
          b += '<button class="btn btn-ghost btn-sm" data-sub-del="' + i + '">删</button>';
          b += '</div>';
        });
        b += '</div>';
      } else {
        b += '<div class="muted">还没有子任务，下面添加。</div>';
      }
      b += '</div>';
      b += '<div class="row mt12"><input class="field" id="subInput" placeholder="添加子任务…" /><button class="btn btn-primary btn-sm" data-sub-add>添加</button></div>';
      return b;
    };
    openSheet('📋 子任务：' + t.text, renderBody(), (mask) => {
      const persist = () => { const arr = DB.todos(); const i = arr.findIndex((x) => x.id === id); if (i >= 0) arr[i].subtasks = t.subtasks.slice(); DB.setTodos(arr); };
      const rebind = () => {
        const body = mask.querySelector('#subBody');
        body.querySelectorAll('[data-sub-toggle]').forEach((el) => el.addEventListener('click', () => {
          const i = Number(el.dataset.subToggle); t.subtasks[i].done = !t.subtasks[i].done; persist(); body.outerHTML = renderBody(); rebind();
        }));
        body.querySelectorAll('[data-sub-del]').forEach((el) => el.addEventListener('click', () => {
          const i = Number(el.dataset.subDel); t.subtasks.splice(i, 1); persist(); body.outerHTML = renderBody(); rebind();
        }));
        mask.querySelector('[data-sub-add]').addEventListener('click', () => {
          const inp = mask.querySelector('#subInput'); const v = (inp.value || '').trim();
          if (!v) { Util.toast('写点什么'); return; }
          t.subtasks.push({ id: Store.uid(), text: v, done: false }); persist();
          body.outerHTML = renderBody(); rebind();
          const ni = mask.querySelector('#subInput'); if (ni) ni.focus();
        });
      };
      rebind();
      mask.querySelector('#sheetCancel').remove();
    });
  }

  /* ============================================================
   * 习惯工具
   * ========================================================== */
  function calcStreak(dates) {
    const set = new Set(dates);
    let s = 0;
    let d = new Date(Util.today() + 'T00:00:00');
    if (!set.has(Util.fmtDate(d))) d = new Date(d.getTime() - 86400000);
    while (set.has(Util.fmtDate(d))) { s++; d = new Date(d.getTime() - 86400000); }
    return s;
  }

  function dots(dates) {
    const days = Util.lastNDays(7);
    let h = '<div class="dots">';
    days.forEach((d) => { h += '<div class="dot ' + (dates.includes(d) ? 'on' : '') + '" title="' + d + '"></div>'; });
    return h + '</div>';
  }

  const HABIT_PRESETS = [
    { name: '喝水 8 杯', emoji: '💧' },
    { name: '早起', emoji: '🌅', time: '07:00' },
    { name: '阅读 30 分', emoji: '📚' },
    { name: '运动 30 分', emoji: '🏃' },
    { name: '冥想 10 分', emoji: '🧘' },
    { name: '早睡', emoji: '🌙', time: '23:00' },
    { name: '记账', emoji: '💰' },
    { name: '写日记', emoji: '✍️' },
  ];

  function openHabitTemplates() {
    let body = '<div class="chip-row">';
    HABIT_PRESETS.forEach((p, i) => {
      body += '<button class="chip" data-tpl="' + i + '">' + p.emoji + ' ' + Util.esc(p.name) + '</button>';
    });
    body += '</div>';
    openSheet('选择习惯模板', body, (mask) => {
      mask.querySelectorAll('[data-tpl]').forEach((b) => {
        b.addEventListener('click', () => {
          const p = HABIT_PRESETS[Number(b.dataset.tpl)];
          const arr = DB.habits();
          arr.push({ id: Store.uid(), name: p.name, dates: [], time: p.time || null, created: Date.now() });
          DB.setHabits(arr);
          closeSheet(); renderLife();
          Util.toast('已添加：' + p.name);
        });
      });
      mask.querySelector('#sheetCancel').remove();
    });
  }

  /* ============================================================
   * 习惯提醒
   * ========================================================== */
  function requestNotify() {
    if (!('Notification' in window)) return Promise.resolve(false);
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
      return Promise.resolve(Notification.permission === 'granted');
    }
    return Notification.requestPermission().then((p) => p === 'granted').catch(() => false);
  }

  function fireReminder(hb) {
    const msg = '该打卡啦：' + hb.name;
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('生活家 · 习惯提醒', { body: msg }); } catch (e) {}
    }
    Util.toast('⏰ ' + msg);
  }

  function startReminders() {
    if (startReminders._on) return;
    startReminders._on = true;
    const tick = () => {
      const now = new Date();
      const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      DB.habits().forEach((hb) => {
        if (hb.time && hb.time === hhmm) {
          const key = hb.id + ':' + Util.today();
          if (App.lastRemind[key]) return;
          App.lastRemind[key] = true;
          fireReminder(hb);
        }
      });
    };
    setInterval(tick, 20000);
    tick();
  }

  function openHabitRemind(id) {
    const hb = DB.habits().find((x) => x.id === id);
    if (!hb) return;
    openSheet('设置每日提醒',
      '<div class="muted" style="margin-bottom:10px">应用处于打开状态时会按时提醒你打卡（首次需允许通知）。</div>' +
      '<input class="field" id="remindTime" type="time" value="' + (hb.time || '20:00') + '" />',
      (mask) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-block mt16';
        btn.textContent = '保存';
        btn.addEventListener('click', () => {
          const t = document.getElementById('remindTime').value;
          const arr = DB.habits();
          const i = arr.findIndex((x) => x.id === id);
          if (i >= 0) { arr[i].time = t || null; DB.setHabits(arr); }
          requestNotify();
          closeSheet(); renderLife();
          Util.toast(t ? ('已设提醒 ' + t) : '已取消提醒');
        });
        mask.querySelector('.sheet').appendChild(btn);
        mask.querySelector('#sheetCancel').remove();
      });
  }

  /* ============================================================
   * 习惯打卡主区域（渲染在生活→待办页底部习惯区块）
   * ========================================================== */
  function habitsSection() {
    const habits = DB.habits();
    if (!habits.length) return '';
    let h = '<div class="card"><div class="card-title">习惯打卡 <button class="btn btn-ghost btn-sm" data-action="habit.template" style="float:right;margin-top:-4px">＋ 模板</button></div>';
    habits.forEach((hb) => {
      const dates = hb.dates || [];
      const today = Util.today();
      const done = dates.includes(today);
      const streak = calcStreak(dates);
      const heat = heatmap(dates);
      h += '<div class="habit-block">';
      h += '<div class="flex-between"><span style="cursor:pointer" data-action="habit.done" data-id="' + hb.id + '">' + (hb.emoji || '📌') + ' <b>' + Util.esc(hb.name) + '</b>' + (done ? ' ✓' : '') + '</span>' +
        '<div><button class="btn btn-ghost btn-sm" data-action="habit.remind" data-id="' + hb.id + '">⏰</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="habit.del" data-id="' + hb.id + '">删</button></div></div>';
      h += '<div class="hm-wrap">' + heat + '</div>';
      const ym = Util.today().slice(0, 7);
      const monthDays = dates.filter((d) => d.slice(0, 7) === ym).length;
      const now = new Date();
      const totalDays = now.getDate();
      const pct = Math.round(monthDays / totalDays * 100);
      h += '<div class="flex-between"><div>' + dots(dates) + '</div><div><span class="muted">本月 ' + monthDays + '/' + totalDays + ' · ' + pct + '%</span><span class="muted" style="margin-left:8px">连续 ' + streak + ' 天</span></div></div>';
      h += '</div>';
    });
    h += '<div class="row mt8"><input class="field" id="habitInput" placeholder="新习惯名，如「喝牛奶」" /><button class="btn btn-primary btn-sm" data-action="habit.add">添加</button></div>';
    h += '</div>';
    return h;
  }

  function heatmap(dates) {
    const set = new Set(dates);
    const weeks = 17;
    const end = new Date(Util.today() + 'T00:00:00');
    const lastSunday = new Date(end.getTime() - end.getDay() * 86400000);
    const start = new Date(lastSunday.getTime() - (weeks - 1) * 7 * 86400000);
    let h = '<div class="heatmap">';
    for (let w = 0; w < weeks; w++) {
      h += '<div class="hm-col">';
      for (let d = 0; d < 7; d++) {
        const dt = new Date(start.getTime() + (w * 7 + d) * 86400000);
        const ds = Util.fmtDate(dt);
        const future = dt > end;
        const on = !future && set.has(ds);
        h += '<div class="hm-cell ' + (future ? 'future' : (on ? 'on' : '')) + '" title="' + ds + (on ? ' · 已打卡' : '') + '"></div>';
      }
      h += '</div>';
    }
    h += '</div>';
    return h;
  }

  /* ============================================================
   * 读书记录
   * ========================================================== */
  const BOOK_STATUS = [
    { key: 'reading', label: '在读', emoji: '📖', cls: 'tag-green' },
    { key: 'want', label: '想读', emoji: '📝', cls: 'tag-amber' },
    { key: 'done', label: '已读', emoji: '✅', cls: 'tag-blue' },
  ];
  const bookStatusOf = (k) => BOOK_STATUS.find((s) => s.key === k) || BOOK_STATUS[0];

  function ensureReadCal() {
    if (App.readCalY == null) { const n = new Date(); App.readCalY = n.getFullYear(); App.readCalM = n.getMonth(); }
  }
  function calReadingDays(ym) {
    const map = {};
    DB.readingLogs().forEach((l) => { if ((l.date || '').slice(0, 7) === ym) map[l.date] = true; });
    return map;
  }
  function readStreak() {
    const set = new Set(DB.readingLogs().map((l) => l.date).filter(Boolean));
    if (!set.size) return 0;
    const fmt = (x) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    const d = new Date();
    if (!set.has(fmt(d))) d.setDate(d.getDate() - 1);
    let s = 0;
    while (set.has(fmt(d))) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }
  function renderReadingCalendar() {
    ensureReadCal();
    const y = App.readCalY, m = App.readCalM;
    const ym = y + '-' + String(m + 1).padStart(2, '0');
    const first = new Date(y, m, 1);
    const startDow = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = Util.today();
    const days = calReadingDays(ym);
    let h = '<div class="card"><div class="cal-nav">';
    h += '<button class="btn btn-ghost btn-sm" data-action="reading.cal.prev">‹</button>';
    h += '<span><b>' + y + '年' + (m + 1) + '月</b></span>';
    h += '<button class="btn btn-ghost btn-sm" data-action="reading.cal.next">›</button></div>';
    h += '<div class="cal-grid">';
    ['一', '二', '三', '四', '五', '六', '日'].forEach((w) => { h += '<div class="cal-weekday">' + w + '</div>'; });
    for (let i = 0; i < startDow; i++) h += '<div class="cal-cell cal-empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = ym + '-' + String(d).padStart(2, '0');
      const future = Util.dayDiff(today, ds) > 0;
      let cls = 'cal-cell active';
      if (future) cls = 'cal-cell future';
      if (ds === today) cls += ' today';
      if (App.readCalSel === ds) cls += ' selected';
      h += '<div class="' + cls + '" data-action="reading.select" data-date="' + ds + '">';
      h += '<div class="cal-day-num">' + d + '</div>';
      if (days[ds]) h += '<div class="cal-dot read"></div>';
      h += '</div>';
    }
    h += '</div>';
    h += '<div class="cal-legend"><span class="dot-read"></span>已阅读</div>';
    if (App.readCalSel && days[App.readCalSel]) {
      const dl = DB.readingLogs().filter((l) => l.date === App.readCalSel);
      if (dl.length) {
        h += '<div class="read-day-detail">';
        dl.forEach((l) => { h += '<div class="read-dl-row">📖 ' + Util.esc(l.bookTitle || '') + ' · ' + (l.minutes || 0) + '分钟' + (l.pages ? ' · ' + l.pages + '页' : '') + '</div>'; });
        h += '</div>';
      }
    }
    h += '</div>';
    return h;
  }

  function renderBooks() {
    const books = DB.books().slice().sort((a, b) => (b.created || 0) - (a.created || 0));
    const stLabels = { want: '想读', reading: '在读', done: '已读' };
    const logs = DB.readingLogs();
    const today = Util.today();
    const todayMin = logs.filter((l) => l.date === today).reduce((s, l) => s + (l.minutes || 0), 0);
    const streak = readStreak();

    // 今日阅读打卡卡片
    let h = '<div class="card reading-card"><div class="card-title">📚 读书打卡</div>';
    h += '<div class="read-streak"><span class="num">' + streak + '</span><span class="lbl">连续打卡 · 天</span></div>';
    if (todayMin > 0) h += '<div class="read-today-done">今日已读 ' + todayMin + ' 分钟 ✓</div>';
    if (books.length) {
      h += '<button class="btn btn-primary btn-block mt8" data-action="reading.open">打卡今日阅读</button>';
    } else {
      h += '<div class="muted mt8">还没有书，先添加一本再打卡阅读。</div>';
      h += '<button class="btn btn-primary btn-block mt8" data-action="book.add">＋ 添加一本书</button>';
    }
    h += '</div>';

    // 阅读日历（蓝点）
    h += renderReadingCalendar();

    // 书架卡片
    h += '<div class="card"><div class="card-title">📚 书架 <button class="btn btn-ghost btn-sm" data-action="book.add" style="float:right;margin-top:-4px">＋ 添加</button></div>';
    if (!books.length) {
      h += empty('📚', '还没有书，点「＋ 添加」记录想读/在读的书');
    } else {
      BOOK_STATUS.forEach((st) => {
        const list = books.filter((b) => b.status === st.key);
        if (!list.length) return;
        h += '<div class="book-group-title">' + st.emoji + ' ' + st.label + ' <span class="muted">' + list.length + '</span></div>';
        list.forEach((b) => { h += bookRow(b); });
      });
    }
    h += '</div>';
    return h;
  }

  function bookRow(b) {
    const pct = (b.pages && b.page != null) ? Math.min(100, Math.round((b.page / b.pages) * 100)) : 0;
    let h = '<div class="item" data-action="book.open" data-id="' + b.id + '" style="cursor:pointer">';
    h += '<div class="main"><div class="title">' + Util.esc(b.title);
    if (b.author) h += ' <span class="muted" style="font-weight:400;font-size:12px">· ' + Util.esc(b.author) + '</span>';
    h += '</div>';
    if (b.status === 'reading') {
      h += '<div class="meta">📄 ' + (b.page || 0) + '/' + (b.pages || '?') + ' 页 · ' + pct + '%</div>';
      if (b.pages) h += '<div class="progress"><i style="width:' + pct + '%"></i></div>';
    } else if (b.status === 'done') {
      const r = b.rating || 0;
      h += '<div class="meta">⭐ ' + (r ? '★'.repeat(r) + '☆'.repeat(5 - r) : '未评分') + '</div>';
    } else {
      h += '<div class="meta">想读清单</div>';
    }
    h += '</div>';
    const st = bookStatusOf(b.status);
    h += '<button class="btn btn-ghost btn-sm" data-action="book.status" data-id="' + b.id + '" title="切换状态">' + st.emoji + '</button>';
    h += '<button class="btn btn-ghost btn-sm" data-action="book.del" data-id="' + b.id + '">删</button>';
    h += '</div>';
    return h;
  }

  function openBookSheet(id) {
    const books = DB.books();
    const b = id ? books.find((x) => x.id === id) : null;
    const isEdit = !!b;
    const statusOpts = BOOK_STATUS.map((s) => '<option value="' + s.key + '"' + ((b && b.status === s.key) || (!b && s.key === 'want') ? ' selected' : '') + '>' + s.label + '</option>').join('');
    openSheet(isEdit ? '编辑书籍' : '添加书籍',
      '<input class="field" id="bTitle" placeholder="书名，如「活着」" value="' + (b ? Util.esc(b.title) : '') + '" />' +
      '<input class="field mt12" id="bAuthor" placeholder="作者（可选）" value="' + (b ? Util.esc(b.author || '') : '') + '" />' +
      '<div class="row mt12"><input class="field" id="bPage" type="number" min="0" placeholder="当前页" value="' + (b && b.page != null ? b.page : '') + '" />' +
      '<input class="field" id="bPages" type="number" min="0" placeholder="总页数" value="' + (b && b.pages ? b.pages : '') + '" /></div>' +
      '<div class="row mt12"><select class="field" id="bStatus">' + statusOpts + '</select>' +
      '<input class="field" id="bRating" type="number" min="0" max="5" placeholder="评分0-5" value="' + (b && b.rating ? b.rating : '') + '" /></div>' +
      '<textarea class="field mt12" id="bNote" rows="3" placeholder="读后感 / 笔记（可选）">' + (b ? Util.esc(b.note || '') : '') + '</textarea>' +
      '<button class="btn btn-primary btn-block mt16" id="bSave">保存</button>',
      (mask) => {
        mask.querySelector('#bSave').addEventListener('click', () => {
          const title = (document.getElementById('bTitle').value || '').trim();
          if (!title) { Util.toast('写个书名'); return; }
          const obj = {
            title,
            author: (document.getElementById('bAuthor').value || '').trim(),
            page: Math.max(0, parseInt(document.getElementById('bPage').value || '0', 10) || 0),
            pages: parseInt(document.getElementById('bPages').value || '0', 10) || 0,
            status: document.getElementById('bStatus').value,
            rating: Math.max(0, Math.min(5, parseInt(document.getElementById('bRating').value || '0', 10) || 0)),
            note: (document.getElementById('bNote').value || '').trim(),
          };
          let arr = DB.books();
          if (isEdit) {
            const i = arr.findIndex((x) => x.id === id);
            if (i >= 0) arr[i] = Object.assign({}, arr[i], obj);
          } else {
            arr.push(Object.assign({ id: Store.uid(), created: Date.now() }, obj));
          }
          DB.setBooks(arr);
          closeSheet(); renderLife();
          Util.toast(isEdit ? '已更新' : '已添加');
        });
        mask.querySelector('#sheetCancel').remove();
      });
  }

  // 暴露 startReminders 供 app-core 的 init 调用
  App.startReminders = startReminders;

  /* ============================================================
   * 动作注册
   * ========================================================== */
  App.onAction('life.view', (btn) => {
    App.lifeView = btn.dataset.view;
    renderLife();
  });

  App.onAction('todo.add', () => {
    const input = document.getElementById('todoInput');
    if (!input) return;
    const raw = (input.value || '').trim();
    if (!raw) { Util.toast('写点什么'); return; }
    const { title, due, time } = Util.parseDue(raw);
    if (!title) { Util.toast('写点什么'); return; }
    const arr = DB.todos();
    arr.push({ id: Store.uid(), text: title, due, time, done: false, important: false, focus: 0, subtasks: [], order: arr.length, created: Date.now() });
    DB.setTodos(arr);
    input.value = '';
    renderLife();
    Util.toast('已添加');
  });

  App.onAction('todo.filter', (btn) => {
    App.todoFilter = btn.dataset.f;
    renderLife();
  });

  App.onAction('todo.toggleDone', () => {
    App.todoDoneOpen = !App.todoDoneOpen;
    renderLife();
  });

  App.onAction('todo.toggle', (btn) => {
    const id = btn.dataset.id;
    const arr = DB.todos();
    const i = arr.findIndex((t) => t.id === id);
    if (i >= 0) { arr[i].done = !arr[i].done; DB.setTodos(arr); renderLife(); }
  });

  App.onAction('todo.star', (btn) => {
    const id = btn.dataset.id;
    const arr = DB.todos();
    const i = arr.findIndex((t) => t.id === id);
    if (i >= 0) { arr[i].important = !arr[i].important; DB.setTodos(arr); renderLife(); }
  });

  App.onAction('todo.focus', (btn) => {
    openFocus(btn.dataset.id);
  });

  App.onAction('todo.sub.open', (btn) => {
    openSubSheet(btn.dataset.id);
  });

  App.onAction('todo.del', (btn) => {
    const id = btn.dataset.id;
    if (!confirm('确定删除此待办？')) return;
    DB.setTodos(DB.todos().filter((t) => t.id !== id));
    renderLife();
    Util.toast('已删除');
  });

  App.onAction('todo.setdue', (btn) => {
    const id = btn.dataset.id;
    const days = Number(btn.dataset.days);
    const d = new Date();
    d.setDate(d.getDate() + days);
    const due = Util.fmtDate(d);
    const arr = DB.todos();
    const i = arr.findIndex((t) => t.id === id);
    if (i >= 0) { arr[i].due = due; DB.setTodos(arr); renderLife(); }
  });

  App.onAction('vlog.add', () => openVlogSheet());
  App.onAction('vlog.open', (btn) => openVlogDetail(btn.dataset.id));

  App.onAction('habit.add', () => {
    const input = document.getElementById('habitInput');
    if (!input) return;
    const name = (input.value || '').trim();
    if (!name) { Util.toast('写个名字'); return; }
    const arr = DB.habits();
    arr.push({ id: Store.uid(), name, dates: [], time: null, created: Date.now() });
    DB.setHabits(arr);
    input.value = '';
    renderLife();
    Util.toast('已添加');
  });

  App.onAction('habit.done', (btn) => {
    const id = btn.dataset.id;
    const arr = DB.habits();
    const hb = arr.find((x) => x.id === id);
    if (!hb) return;
    if (!hb.dates) hb.dates = [];
    const today = Util.today();
    const idx = hb.dates.indexOf(today);
    if (idx >= 0) hb.dates.splice(idx, 1);
    else hb.dates.push(today);
    DB.setHabits(arr);
    renderLife();
  });

  App.onAction('habit.template', () => openHabitTemplates());
  App.onAction('habit.remind', (btn) => openHabitRemind(btn.dataset.id));

  App.onAction('habit.del', (btn) => {
    if (!confirm('确定删除此习惯？')) return;
    DB.setHabits(DB.habits().filter((h) => h.id !== btn.dataset.id));
    renderLife();
    Util.toast('已删除');
  });

  App.onAction('stats.toggleRecentVlog', () => {
    App.showRecentVlog = !App.showRecentVlog;
    renderLife();
  });

  App.onAction('book.add', () => openBookSheet());
  App.onAction('book.open', (btn) => openBookSheet(btn.dataset.id));
  App.onAction('book.status', (btn) => {
    const id = btn.dataset.id;
    const arr = DB.books();
    const b = arr.find((x) => x.id === id);
    if (!b) return;
    const order = ['want', 'reading', 'done'];
    b.status = order[(order.indexOf(b.status) + 1) % 3];
    DB.setBooks(arr); renderLife();
  });
  App.onAction('book.del', (btn) => {
    if (!confirm('确定删除此书？')) return;
    DB.setBooks(DB.books().filter((x) => x.id !== btn.dataset.id));
    renderLife(); Util.toast('已删除');
  });

  // 读书打卡：A+B 风格弹窗（毛玻璃 + 补卡日期 + 周目标占比 + 连续徽章）
  function weekReadingMinutes(refDate) {
    const d = new Date(refDate + 'T00:00:00');
    const dow = (d.getDay() + 6) % 7;
    const monday = new Date(d.getTime() - dow * 86400000);
    const sunday = new Date(monday.getTime() + 6 * 86400000);
    const logs = DB.readingLogs();
    let sum = 0;
    logs.forEach((l) => { if (l.date >= Util.fmtDate(monday) && l.date <= Util.fmtDate(sunday)) sum += (l.minutes || 0); });
    return sum;
  }

  function openReadingSheet(presetDate) {
    const books = DB.books();
    if (!books.length) { Util.toast('先添加一本书'); return; }
    App._rkDate = presetDate || Util.today();
    const isToday = App._rkDate === Util.today();
    const streak = readStreak();
    const WEEK_GOAL = 80; // 每周阅读目标（分钟），后续可让用户设定
    const weekMin = weekReadingMinutes(App._rkDate);
    const stLabels = { want: '想读', reading: '在读', done: '已读' };
    let body = '';
    // 补卡日期行（B）
    body += '<div class="ck-date-row">';
    body += '<span class="ck-d" id="rkDateLabel">' + (isToday ? '今天 ' : '补卡 ') + App._rkDate.slice(5) + '</span>';
    body += '<span class="ck-chg" id="rkChgDate">改日期补卡 ↩</span>';
    body += '</div>';
    body += '<input type="date" id="rkDatePicker" value="' + App._rkDate + '" style="display:none" />';
    // 选书
    body += '<div class="field-label mt12">选书</div>';
    body += '<select class="field" id="rkBook">';
    books.forEach((b) => { body += '<option value="' + b.id + '">' + Util.esc(b.title) + (b.status !== 'reading' ? '（' + (stLabels[b.status] || '其他') + '）' : '') + '</option>'; });
    body += '</select>';
    // 时长 + 页数
    body += '<div class="row mt8"><input class="field" id="rkMin" type="number" min="0" placeholder="时长(分钟)" /><input class="field" id="rkPage" type="number" min="0" placeholder="页数" /></div>';
    // 周目标占比预览（A）
    body += '<div class="ck-preview"><div style="flex:1">';
    body += '<div class="ck-pv-txt" style="margin-bottom:7px">本周阅读 <b>' + weekMin + '</b> 分钟 · 目标 ' + WEEK_GOAL + '</div>';
    body += '<div class="goal-bar"><div class="goal-fill" style="width:' + Math.min(100, Math.round(weekMin / WEEK_GOAL * 100)) + '%"></div></div>';
    body += '</div></div>';
    // 连续徽章（B）
    body += '<div class="ck-badges">';
    [7, 30, 100].forEach((n) => { body += '<div class="ck-mb' + (streak >= n ? ' on' : '') + '"><b>' + n + '</b><span>天</span></div>'; });
    body += '</div>';
    body += '<button class="btn btn-primary btn-block mt16" id="rkSave">完成打卡 · 连续 ' + streak + ' 天</button>';

    openSheet('记录阅读', body, (mask) => {
      mask.querySelector('.sheet').classList.add('glass-sheet');
      // 改日期补卡（B）
      const datePicker = mask.querySelector('#rkDatePicker');
      mask.querySelector('#rkChgDate').addEventListener('click', () => { if (datePicker.showPicker) datePicker.showPicker(); else datePicker.click(); });
      datePicker.addEventListener('change', () => {
        App._rkDate = datePicker.value || App._rkDate;
        const isT = App._rkDate === Util.today();
        mask.querySelector('#rkDateLabel').textContent = (isT ? '今天 ' : '补卡 ') + App._rkDate.slice(5);
      });
      // 保存
      mask.querySelector('#rkSave').addEventListener('click', () => {
        const bookId = mask.querySelector('#rkBook').value;
        const min = Math.max(0, parseInt(mask.querySelector('#rkMin').value || '0', 10) || 0);
        const pg = Math.max(0, parseInt(mask.querySelector('#rkPage').value || '0', 10) || 0);
        if (!min && !pg) { Util.toast('填个时长或页数'); return; }
        const book = DB.books().find((x) => x.id === bookId);
        const date = App._rkDate;
        const logs = DB.readingLogs();
        const ex = logs.find((l) => l.date === date && l.bookId === bookId);
        if (ex) { ex.minutes = (ex.minutes || 0) + min; ex.pages = (ex.pages || 0) + pg; }
        else logs.push({ id: Store.uid(), date, bookId, bookTitle: book ? book.title : '', minutes: min, pages: pg, created: Date.now() });
        DB.setReadingLogs(logs);
        closeSheet(); renderLife();
        Util.toast('📚 打卡成功！');
      });
    });
  }

  // 读书打卡：今日阅读记录
  App.onAction('reading.checkin', () => {
    const bookEl = document.getElementById('rkBook');
    if (!bookEl) { Util.toast('先添加一本书'); return; }
    const bookId = bookEl.value;
    const minEl = document.getElementById('rkMin');
    const pgEl = document.getElementById('rkPage');
    const min = Math.max(0, parseInt((minEl ? minEl.value : '0') || '0', 10) || 0);
    const pg = Math.max(0, parseInt((pgEl ? pgEl.value : '0') || '0', 10) || 0);
    if (!min && !pg) { Util.toast('填个时长或页数'); return; }
    const book = DB.books().find((x) => x.id === bookId);
    const today = Util.today();
    const logs = DB.readingLogs();
    const ex = logs.find((l) => l.date === today && l.bookId === bookId);
    if (ex) { ex.minutes = (ex.minutes || 0) + min; ex.pages = (ex.pages || 0) + pg; }
    else logs.push({ id: Store.uid(), date: today, bookId, bookTitle: book ? book.title : '', minutes: min, pages: pg, created: Date.now() });
    DB.setReadingLogs(logs);
    renderLife();
    Util.toast('📚 打卡成功！');
  });

  App.onAction('reading.open', () => openReadingSheet());
  App.onAction('reading.cal.prev', () => {
    App.readCalM--; if (App.readCalM < 0) { App.readCalM = 11; App.readCalY--; }
    renderLife();
  });
  App.onAction('reading.cal.next', () => {
    App.readCalM++; if (App.readCalM > 11) { App.readCalM = 0; App.readCalY++; }
    renderLife();
  });
  App.onAction('reading.select', (btn) => {
    App.readCalSel = btn.dataset.date;
    renderLife();
  });

  /* ============================================================
   * 导出给其他模块
   * ========================================================== */
  App.habitsSection = habitsSection;

})();
