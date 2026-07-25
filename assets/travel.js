/* ============================================================
 * travel.js — 旅行模块（地点 / 行程 / AI 生成）
 * ========================================================== */
(function () {
  'use strict';

  const { Store, Util, App } = window;
  const { DB, openSheet, closeSheet, renderTab, empty } = App;

  /* ============================================================
   * 渲染主入口
   * ========================================================== */
  function renderTravel() {
    const trips = DB.trips().slice().sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999'));
    const places = DB.places();
    let h = '';

    h += '<div class="card"><div class="card-title">📌 想去 & 足迹</div>';
    if (!places.length) h += empty('📌', '标记想去的地方，点🤖 AI 生成行程');
    places.forEach((p) => {
      const emoji = p.visited ? '✓' : '';
      h += '<div class="item"><div class="check ' + (p.visited ? 'on' : '') + '" data-action="travel.toggle.place" data-id="' + p.id + '">' + emoji + '</div>';
      h += '<div class="main"><div class="title">' + Util.esc(p.name) + '</div><div class="meta">' + Util.esc(p.city || '') + (p.cat ? ' · ' + Util.esc(p.cat) : '') + (p.visited ? ' · 已打卡' : ' · 想去') + '</div></div>';
      h += (!p.visited ? '<button class="btn btn-ghost btn-sm" data-action="travel.aiGen" data-id="' + p.id + '" title="AI 生成行程">🤖 AI</button>' : '');
      h += '<button class="btn btn-ghost btn-sm" data-action="travel.del.place" data-id="' + p.id + '">删</button></div>';
    });
    h += '<button class="btn btn-block mt8" data-action="travel.add">＋ 添加想去的地方</button>';
    h += '</div>';

    h += '<div class="card"><div class="card-title">🗺️ 旅行计划 <span class="more">点 ＋ 新建</span></div>';
    const imports = DB.imports().slice().sort((a, b) => (b.created || 0) - (a.created || 0));
    if (!trips.length && !imports.length) h += empty('🗺️', '从想去的地点生成行程，或手动添加');
    trips.forEach((t) => {
      const st = tripStatus(t);
      let prog = 0;
      if (t.start && t.end) {
        const total = Util.dayDiff(t.start, t.end) + 1;
        const done = Math.min(total, Math.max(0, Util.dayDiff(t.start, Util.today()) + 1));
        prog = total > 0 ? Math.round((done / total) * 100) : 0;
      }
      h += '<div class="item" style="flex-direction:column;align-items:stretch;gap:6px">';
      h += '<div class="flex-between"><div class="title" style="font-weight:600">' + Util.esc(t.title) + '</div><span class="chip ' + st.cls + '" style="cursor:default">' + st.txt + '</span></div>';
      h += '<div class="meta">📍 ' + Util.esc(t.dest || '—') + (t.start ? ' · ' + t.start + (t.end ? ' ~ ' + t.end : '') : '') + '</div>';
      if (prog > 0) h += '<div class="progress"><i style="width:' + prog + '%"></i></div>';
      if (t.note) {
        h += '<details class="plan-detail"><summary>📋 查看行程</summary>' +
          '<div class="plan-body">' + Util.esc(t.note) + '</div></details>';
      }
      h += '<div class="flex-between">' +
        '<button class="btn btn-ghost btn-sm" data-action="travel.edit.trip" data-id="' + t.id + '">✏️ 编辑</button>' +
        '<button class="btn btn-ghost btn-sm" data-action="travel.del.trip" data-id="' + t.id + '">删除</button></div>';
      h += '</div>';
    });
    imports.forEach((it) => {
      h += '<div class="item" data-action="travel.openImport" data-id="' + it.id + '" style="cursor:pointer">';
      h += '<div class="main"><div class="title">📄 ' + Util.esc(it.title) + '</div><div class="meta">点击查看 HTML · ' + (it.created ? new Date(it.created).toLocaleDateString() : '') + '</div></div>';
      h += '<button class="btn btn-ghost btn-sm" data-action="travel.delImport" data-id="' + it.id + '">删</button></div>';
    });
    h += '<button class="btn btn-block mt8" data-action="travel.add">＋ 新建旅行计划</button>';
    h += '<button class="btn btn-block mt8" data-action="travel.import">📥 导入 HTML 计划</button>';
    h += '<input type="file" id="importFile" accept=".html,.htm,text/html" style="display:none" />';
    h += '</div>';

    App.screen.innerHTML = h;
    const fi = document.getElementById('importFile');
    if (fi) fi.addEventListener('change', (e) => handleImportFile(e));
  }
  App.renderers.travel = renderTravel;

  function tripStatus(t) {
    const today = Util.today();
    if (t.start && t.end && today >= t.start && today <= t.end) return { txt: '进行中', cls: 'tag-green' };
    if (t.start && today < t.start) return { txt: '未开始', cls: 'tag-amber' };
    if (t.end && today > t.end) return { txt: '已结束', cls: 'tag-red' };
    return { txt: '计划', cls: 'tag-amber' };
  }

  /* ============================================================
   * 弹层：新建旅行 / 地点
   * ========================================================== */
  function openTravelSheet() {
    openSheet('新建旅行 / 地点',
      '<div class="row"><select class="field" id="tKind"><option value="trip">旅行计划</option><option value="place">想去 / 足迹</option></select></div>' +
      '<input class="field mt12" id="tTitle" placeholder="标题，如「国庆日本行」" />' +
      '<input class="field mt12" id="tDest" placeholder="目的地 / 城市" />' +
      '<div class="row mt12"><input class="field" id="tStart" type="date" placeholder="开始" /><input class="field" id="tEnd" type="date" placeholder="结束" /></div>' +
      '<input class="field mt12" id="tCat" placeholder="分类/备注(可选)" />',
      () => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-block mt16';
        btn.textContent = '保存';
        btn.addEventListener('click', () => {
          const kind = document.getElementById('tKind').value;
          const title = document.getElementById('tTitle').value.trim();
          if (!title) { Util.toast('请填写标题'); return; }
          if (kind === 'trip') {
            const arr = DB.trips(); arr.push({
              id: Store.uid(), title, dest: document.getElementById('tDest').value,
              start: document.getElementById('tStart').value, end: document.getElementById('tEnd').value,
              note: document.getElementById('tCat').value,
            }); DB.setTrips(arr);
          } else {
            const arr = DB.places(); arr.push({
              id: Store.uid(), name: title, city: document.getElementById('tDest').value,
              cat: document.getElementById('tCat').value, visited: false,
            }); DB.setPlaces(arr);
          }
          closeSheet(); renderTravel(); Util.toast('已保存');
        });
        document.querySelector('.sheet').appendChild(btn);
        document.getElementById('sheetCancel').remove();
      });
  }

  /* ============================================================
   * 弹层：编辑旅行计划
   * ========================================================== */
  function openEditTripSheet(id) {
    const trips = DB.trips();
    const t = trips.find((x) => x.id === id);
    if (!t) return;
    openSheet('编辑旅行计划',
      '<input class="field" id="eTitle" placeholder="标题" value="' + Util.esc(t.title || '') + '" />' +
      '<input class="field mt12" id="eDest" placeholder="目的地" value="' + Util.esc(t.dest || '') + '" />' +
      '<div class="row mt12"><input class="field" id="eStart" type="date" value="' + (t.start || '') + '" /><input class="field" id="eEnd" type="date" value="' + (t.end || '') + '" /></div>' +
      '<textarea class="field mt12" id="eNote" rows="4" placeholder="行程备注">' + Util.esc(t.note || '') + '</textarea>' +
      '<textarea class="field mt12" id="ePref" rows="2" placeholder="用户偏好（可选），如：美食为主、带老人小孩、预算有限、不爬山、喜欢小众景点">' + Util.esc(t.pref || '') + '</textarea>',
      () => {
        const saveBtn = document.createElement('button');
        saveBtn.className = 'btn btn-primary btn-block mt16';
        saveBtn.textContent = '保存';
        saveBtn.addEventListener('click', () => {
          t.title = document.getElementById('eTitle').value.trim() || t.title;
          t.dest = document.getElementById('eDest').value.trim();
          t.start = document.getElementById('eStart').value;
          t.end = document.getElementById('eEnd').value;
          t.note = document.getElementById('eNote').value.trim();
          t.pref = document.getElementById('ePref').value.trim();
          DB.setTrips(trips);
          closeSheet(); renderTravel(); Util.toast('已更新');
        });
        document.querySelector('.sheet').appendChild(saveBtn);
        const aiBtn = document.createElement('button');
        aiBtn.className = 'btn btn-block mt8';
        aiBtn.textContent = '🤖 按偏好 AI 重新生成';
        aiBtn.addEventListener('click', () => {
          const pref = document.getElementById('ePref').value.trim();
          t.pref = pref;
          DB.setTrips(trips);
          closeSheet();
          openAITripSheet(null, t, pref);
        });
        document.querySelector('.sheet').appendChild(aiBtn);
        document.getElementById('sheetCancel').remove();
      });
  }

  /* ============================================================
   * AI 生成行程（支持编辑模式：传入 trip 对象时不新建，更新现有行程）
   * ========================================================== */
  function openAITripSheet(placeId, editTrip, prefillReq) {
    let dest, days, startDate, planText;
    let req = prefillReq || '';
    let stage = 'input';
    const isEdit = !!editTrip;

    if (isEdit) {
      dest = editTrip.dest || '';
      startDate = editTrip.start || Util.today();
      if (editTrip.start && editTrip.end) {
        days = Util.dayDiff(editTrip.start, editTrip.end) + 1;
      } else {
        days = 3;
      }
      planText = editTrip.note || '';
    } else {
      const places = DB.places();
      const p = places.find((x) => x.id === placeId);
      if (!p) return;
      dest = p.city || p.name;
      days = 3;
      startDate = Util.today();
      planText = '';
    }

    const renderBody = () => {
      if (stage === 'input') {
        return '<div class="muted" style="margin-bottom:10px">' + (isEdit ? '修改条件后点生成，新计划将覆盖当前行程。' : '设置行程参数，点「生成计划」让 AI 为你规划行程。') + '</div>' +
          '<input class="field" id="aiDest" placeholder="目的地" value="' + Util.esc(dest) + '" />' +
          '<div class="row mt12"><input class="field" id="aiStart" type="date" value="' + startDate + '" />' +
          '<input class="field" id="aiDays" type="number" min="1" max="30" value="' + days + '" style="max-width:80px" placeholder="天数" /></div>' +
          '<textarea class="field mt12" id="aiReq" rows="3" placeholder="补充要求（可选）如：带老人、美食为主、预算有限、不爬山">' + Util.esc(req) + '</textarea>' +
          '<button class="btn btn-primary btn-block mt16" id="aiGenBtn">🤖 生成计划</button>';
      }
      return '<div class="muted" style="margin-bottom:10px">可编辑下方行程，或修改条件后重新生成。</div>' +
        '<div class="row"><span style="font-weight:500;flex:1">📍 ' + Util.esc(dest) + ' · ' + days + ' 天</span>' +
        '<button class="btn btn-ghost btn-sm" id="aiBackToInput">✏️ 改条件</button></div>' +
        '<textarea class="field mt12" id="aiPlan" rows="12" style="font-size:13px;font-family:inherit;white-space:pre-wrap">' + Util.esc(planText) + '</textarea>' +
        '<div class="row mt12"><button class="btn btn-primary btn-block" id="aiSavePlan">' + (isEdit ? '💾 更新行程' : '💾 保存为计划') + '</button>' +
        '<button class="btn btn-block" id="aiRegen">🔄 重新生成</button></div>';
    };

    openSheet('🤖 AI 生成行程', renderBody(), (mask) => {
      const rebind = () => {
        if (stage === 'input') {
          const genBtn = mask.querySelector('#aiGenBtn');
          if (!genBtn) return;
          genBtn.addEventListener('click', async () => {
            dest = mask.querySelector('#aiDest').value.trim() || dest;
            startDate = mask.querySelector('#aiStart').value || Util.today();
            days = Number(mask.querySelector('#aiDays').value) || 3;
            req = mask.querySelector('#aiReq').value.trim();
            genBtn.textContent = '🤖 生成中…';
            genBtn.disabled = true;
            planText = await generateTripPlan(dest, startDate, days, req);
            stage = 'result';
            mask.querySelector('#sheetCancel').remove();
            const sheet = mask.querySelector('.sheet');
            sheet.innerHTML = '<h3>🤖 AI 生成行程</h3>' + renderBody() + '<button class="btn btn-block mt16" id="sheetCancel2">取消</button>';
            const c2 = sheet.querySelector('#sheetCancel2');
            if (c2) c2.addEventListener('click', closeSheet);
            rebind();
          });
        } else {
          const planEl = mask.querySelector('#aiPlan');
          const saveBtn = mask.querySelector('#aiSavePlan');
          const regenBtn = mask.querySelector('#aiRegen');
          const backBtn = mask.querySelector('#aiBackToInput');
          if (backBtn) backBtn.addEventListener('click', () => {
            planText = (mask.querySelector('#aiPlan').value || '').trim();
            stage = 'input';
            const sheet = mask.querySelector('.sheet');
            sheet.innerHTML = '<h3>🤖 AI 生成行程</h3>' + renderBody() + '<button class="btn btn-block mt16" id="sheetCancel2">取消</button>';
            const c2 = sheet.querySelector('#sheetCancel2');
            if (c2) c2.addEventListener('click', closeSheet);
            rebind();
          });
          if (regenBtn) regenBtn.addEventListener('click', async () => {
            planText = (mask.querySelector('#aiPlan').value || '').trim();
            dest = Util.esc(dest);
            regenBtn.textContent = '🔄 重新生成…';
            regenBtn.disabled = true;
            planText = await generateTripPlan(dest, startDate, days, req);
            stage = 'result';
            const sheet = mask.querySelector('.sheet');
            sheet.innerHTML = '<h3>🤖 AI 生成行程</h3>' + renderBody() + '<button class="btn btn-block mt16" id="sheetCancel2">取消</button>';
            const c2 = sheet.querySelector('#sheetCancel2');
            if (c2) c2.addEventListener('click', closeSheet);
            rebind();
          });
          if (saveBtn) saveBtn.addEventListener('click', () => {
            planText = (mask.querySelector('#aiPlan').value || '').trim();
            closeSheet();
            if (isEdit) {
              const trips = DB.trips();
              const t = trips.find((x) => x.id === editTrip.id);
              if (t) {
                t.dest = dest;
                t.start = startDate;
                const end = new Date(startDate + 'T00:00:00');
                end.setDate(end.getDate() + days - 1);
                t.end = Util.fmtDate(end);
                t.note = planText;
                DB.setTrips(trips);
                renderTravel();
                Util.toast('行程已更新');
              }
            } else {
              openSaveTripSheet(dest, startDate, days, planText);
            }
          });
        }
      };
      rebind();
    });
  }

  function openSaveTripSheet(dest, startDate, days, planText) {
    const end = new Date(startDate + 'T00:00:00');
    end.setDate(end.getDate() + days - 1);
    const endDate = Util.fmtDate(end);
    openSheet('💾 保存为旅行计划',
      '<input class="field" id="sTitle" placeholder="标题" value="' + Util.esc(dest) + days + '日游" />' +
      '<input class="field mt12" id="sDest" placeholder="目的地" value="' + Util.esc(dest) + '" />' +
      '<div class="row mt12"><input class="field" id="sStart" type="date" value="' + startDate + '" />' +
      '<input class="field" id="sEnd" type="date" value="' + endDate + '" /></div>' +
      '<input class="field mt12" id="sNote" placeholder="备注(可选)" />',
      (mask) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-block mt16';
        btn.textContent = '保存';
        btn.addEventListener('click', () => {
          const title = document.getElementById('sTitle').value.trim();
          const dest2 = document.getElementById('sDest').value.trim();
          const start = document.getElementById('sStart').value;
          const end2 = document.getElementById('sEnd').value;
          const noteExtra = document.getElementById('sNote').value.trim();
          if (!title) { Util.toast('请填写标题'); return; }
          const fullNote = planText + (noteExtra ? '\n\n——\n备注：' + noteExtra : '');
          const arr = DB.trips();
          arr.push({ id: Store.uid(), title, dest: dest2, start, end: end2, note: fullNote });
          DB.setTrips(arr);
          closeSheet();
          renderTravel();
          Util.toast('已保存旅行计划');
        });
        mask.querySelector('.sheet').appendChild(btn);
        document.getElementById('sheetCancel').remove();
      });
  }

  async function generateTripPlan(dest, startDate, days, req) {
    const prompt = '为「' + dest + '」生成一份 ' + days + ' 天的旅行计划，从 ' + startDate + ' 开始。\n' +
      (req ? '要求：' + req + '\n' : '') +
      '请按以下格式输出：\n' +
      '📅 Day 1 - 日期（月/日）主题\n上午：...\n下午：...\n晚上：...\n🍽 美食推荐\n🏨 住宿建议\n💡 小贴士\n\n请用简体中文，内容具体实用。';
    if (App.aiMode === 'cloud') {
      const s = DB.settings();
      if (s.apiBase && s.apiKey) {
        const sys = '你是资深旅行规划师，擅长制定详细、个性化的旅行计划。始终用简体中文回复。';
        const result = await callAI(prompt, sys);
        if (result && !result.startsWith('ERR:')) return result;
        Util.toast('AI 生成失败，使用模板计划');
      }
    }
    return localTravelPlan(dest, days, req);
  }

  function localTravelPlan(dest, days, req) {
    const parts = ['📅 ' + dest + ' ' + days + ' 日旅行计划'];
    const acts = [
      ['抵达与探索', ['抵达' + dest + '，入住酒店', '游览当地标志性景点', '品尝特色美食']],
      ['深度体验', ['上午参观博物馆/文化景点', '下午体验当地特色活动', '晚上逛夜市/商业街']],
      ['自然与放松', ['上午户外景点/公园', '下午休闲/SPA/茶馆', '傍晚看日落']],
      ['周边探索', ['前往周边一日游', '体验不同风貌', '返回市区晚餐']],
      ['自由活动', ['自由安排（购物/补漏景点）', '整理行李', '结束行程返程']],
    ];
    for (let i = 0; i < days; i++) {
      const a = acts[Math.min(i, acts.length - 1)];
      parts.push('\n📅 Day ' + (i + 1) + ' - ' + a[0]);
      a[1].forEach((item) => parts.push('• ' + item));
    }
    parts.push('\n🍽 美食推荐：当地特色餐厅、小吃街');
    parts.push('🏨 住宿建议：市中心/交通便利区域');
    if (req) parts.push('💡 特别提醒：' + req);
    return parts.join('\n');
  }

  // 需要从 ai.js 引用 callAI — 用后期绑定
  function callAI(text, sys) {
    if (App._callAI) return App._callAI(text, sys);
    return null;
  }

  /* ============================================================
   * 导入 HTML 计划 + 全屏查看
   * ========================================================== */
  function handleImportFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const html = String(reader.result || '');
      const arr = DB.imports();
      arr.push({ id: Store.uid(), title: file.name.replace(/\.html?$/i, ''), html, created: Date.now() });
      DB.setImports(arr);
      e.target.value = '';
      renderTravel();
      Util.toast('已导入：' + file.name);
    };
    reader.onerror = () => Util.toast('读取失败');
    reader.readAsText(file, 'UTF-8');
  }

  function openImportViewer(item) {
    const mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:60;display:flex;flex-direction:column';
    mask.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #eee;flex:0 0 auto">' +
      '<button id="ivClose" style="border:none;background:#f0f2f7;color:#333;border-radius:10px;padding:7px 14px;font-size:14px;cursor:pointer">✕ 关闭</button>' +
      '<div style="font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + Util.esc(item.title) + '</div></div>' +
      '<iframe id="ivFrame" style="flex:1;border:0;width:100%;background:#fff"></iframe>';
    document.body.appendChild(mask);
    const frame = mask.querySelector('#ivFrame');
    frame.setAttribute('sandbox', '');
    try { frame.srcdoc = item.html; } catch (_) { frame.src = 'data:text/html;charset=utf-8,' + encodeURIComponent(item.html); }
    mask.querySelector('#ivClose').addEventListener('click', () => mask.remove());
  }

  /* ============================================================
   * 动作注册
   * ========================================================== */
  App.onAction('travel.add', () => openTravelSheet());
  App.onAction('travel.edit.trip', (btn) => openEditTripSheet(btn.dataset.id));

  App.onAction('travel.toggle.place', (btn) => {
    const id = btn.dataset.id;
    const arr = DB.places();
    const p = arr.find((x) => x.id === id);
    if (p) { p.visited = !p.visited; DB.setPlaces(arr); renderTravel(); }
  });

  App.onAction('travel.del.place', (btn) => {
    const id = btn.dataset.id;
    if (!confirm('确定删除？')) return;
    DB.setPlaces(DB.places().filter((p) => p.id !== id));
    renderTravel();
    Util.toast('已删除');
  });

  App.onAction('travel.del.trip', (btn) => {
    const id = btn.dataset.id;
    if (!confirm('确定删除？')) return;
    DB.setTrips(DB.trips().filter((t) => t.id !== id));
    renderTravel();
    Util.toast('已删除');
  });

  App.onAction('travel.aiGen', (btn) => openAITripSheet(btn.dataset.id));

  App.onAction('travel.import', () => {
    const inp = document.getElementById('importFile');
    if (inp) inp.click();
  });

  App.onAction('travel.openImport', (btn) => {
    const id = btn.dataset.id;
    const item = DB.imports().find((x) => x.id === id);
    if (item) openImportViewer(item);
  });

  App.onAction('travel.delImport', (btn) => {
    const id = btn.dataset.id;
    if (!confirm('确定删除此导入的计划？')) return;
    DB.setImports(DB.imports().filter((x) => x.id !== id));
    renderTravel();
    Util.toast('已删除');
  });

})();
