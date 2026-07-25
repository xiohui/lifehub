/* ============================================================
 * settings.js — 我的 / 设置（API 配置 / 数据管理 / 主题 / 安装引导）
 * ========================================================== */
(function () {
  'use strict';

  const { Store, Util, App } = window;
  const { DB, openSheet, closeSheet, renderTab, empty } = App;

  /* ============================================================
   * 渲染主入口
   * ========================================================== */
  function renderMe() {
    const s = DB.settings();
    const isDark = s.theme === 'dark';
    const apiBase = s.apiBase || '';
    const apiKey = s.apiKey || '';
    const apiModel = s.apiModel || 'deepseek-v4-flash';
    const hasCloud = !!(apiBase && apiKey);

    let h = '';

    // ===== 主题 + 安装 =====
    h += '<div class="card"><div class="row">' +
      '<div><div class="card-title" style="margin:0">⚙️ 设置</div></div>' +
      '<div class="switch"><input type="checkbox" id="themeToggle"' + (isDark ? ' checked' : '') + ' /><label class="slider" for="themeToggle" data-action="me.toggleTheme"></label></div></div>' +
      '</div>';

    h += renderInstallCard();

    // ===== 联网 AI 配置（折叠式） =====
    h += '<div class="card" style="padding:12px 14px">';
    h += '<div class="flex-between" style="cursor:pointer" id="aiConfigToggle"><span class="label" style="font-weight:600">🌐 联网 AI 配置</span>' +
      '<span class="muted" id="aiConfigArrow">▸</span></div>';
    h += '<div id="aiConfigBody" style="display:none;margin-top:10px">';
    h += '<div class="muted" style="font-size:12px;margin-bottom:10px">填入兼容 OpenAI 格式的 API。推荐 OpenRouter 免费档（支持鸿蒙），或使用 DeepSeek V4 官方接口。</div>';

    h += '<div class="set-row"><div class="label">接口地址<br><span class="desc">OpenAI 兼容格式</span></div>' +
      '<input class="field" id="apiBase" value="' + Util.esc(apiBase) + '" placeholder="https://api.openai.com/v1/chat/completions" style="max-width:180px;font-size:12px" /></div>';

    h += '<div class="set-row"><div class="label">模型<br><span class="desc">如 deepseek-v4-flash</span></div>' +
      '<input class="field" id="apiModel" value="' + Util.esc(apiModel) + '" placeholder="模型名" style="max-width:120px;font-size:12px" /></div>';

    h += '<div class="set-row"><div class="label">API Key<br><span class="desc">粘贴你的 Key</span></div>' +
      '<input class="field" id="apiKey" type="password" value="' + Util.esc(apiKey) + '" placeholder="sk-..." style="max-width:160px;font-size:12px" /></div>';

    h += '<button class="btn btn-primary btn-block mt8" data-action="me.saveSettings">💾 保存设置</button>';

    // OpenRouter 快捷配置
    h += '<div class="muted mt12" style="font-size:12px;font-weight:600">快速配置</div>';
    h += '<div class="row mt8"><button class="btn btn-ghost btn-sm" data-action="me.quickFill">🔮 DeepSeek</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="me.quickOpenRouter">⚡ OpenRouter</button></div>';

    // OpenRouter 模型选择（在 quickOpenRouter 后刷新）
    h += '<div class="row mt8"><select class="field" id="orModel" style="font-size:12px"><option value="tencent/hunyuan-3d">Hunyuan 3D（免费）</option></select>' +
      '<button class="btn btn-ghost btn-sm" data-action="me.refreshOrModels">🔄</button></div>';

    h += '<button class="btn btn-sm mt8" data-action="me.testApi">🔌 测试连接</button>';

    h += '</div></div>';

    // ===== 数据管理 =====
    const usedBytes = Store.getUsage();
    const usedMB = usedBytes / (1024 * 1024);
    h += '<div class="card"><div class="card-title">💾 数据管理</div>' +
      '<div class="flex-between muted" style="font-size:11px;margin:4px 0"><span id="quotaInfo">' + usedMB.toFixed(1) + 'MB</span><span id="quotaPct"></span></div>' +
      '<button class="btn btn-primary btn-block mt8" data-action="me.import">📥 导入数据</button>' +
      '<button class="btn btn-block mt8" data-action="me.export">📤 导出备份</button>' +
      '<button class="btn btn-block mt8 btn-danger" data-action="me.clear">⚠️ 清空全部数据</button>' +
      '<div class="muted mt8" style="font-size:11px">数据全部存在你的手机浏览器本地数据库（IndexedDB）中，跟随手机剩余空间，容量远大于原来的 5MB。清除浏览器数据或卸载浏览器会导致数据丢失，请定期导出备份。</div></div>';

    App.screen.innerHTML = h;
    bindAIConfigToggle();

    // 异步填充真实配额（手机剩余空间给本应用的额度）
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then((e) => {
        const el = document.getElementById('quotaInfo');
        const pe = document.getElementById('quotaPct');
        if (!el) return;
        const u = e.usage || 0;
        const q = e.quota || 0;
        if (q > 0) {
          const used = u / 1048576;
          const total = q / 1048576;
          const unit = total > 1024 ? (total / 1024).toFixed(2) + 'GB' : Math.round(total) + 'MB';
          el.textContent = used.toFixed(1) + 'MB / ' + unit;
          if (pe) pe.textContent = Math.round((u / q) * 100) + '%';
        } else {
          el.textContent = (u / 1048576).toFixed(1) + 'MB';
        }
      }).catch(() => {});
    }
  }
  App.renderers.me = renderMe;

  function bindAIConfigToggle() {
    const toggle = document.getElementById('aiConfigToggle');
    const body = document.getElementById('aiConfigBody');
    const arrow = document.getElementById('aiConfigArrow');
    if (!toggle || !body) return;
    toggle.addEventListener('click', () => {
      const shown = body.style.display === 'block';
      body.style.display = shown ? 'none' : 'block';
      if (arrow) arrow.textContent = shown ? '▸' : '▾';
    });
  }

  function renderInstallCard() {
    const isApp = installDone();
    if (isApp) return '<div class="card"><div class="card-title">📲 已安装为 App</div><div class="muted">你已通过「添加到主屏幕」把它装成 App，享受全屏离线体验 ✅</div></div>';
    const ua = navigator.userAgent.toLowerCase();
    const inApp = /micromessenger|qq\/|weibo|dingtalk|tieba|ucbrowser/.test(ua);
    return '<div class="card"><div class="card-title">📲 安装到手机主屏</div>' +
      '<div class="muted" style="margin-bottom:10px">装到主屏后，它就是独立 App：全屏无地址栏、可离线打开、数据只在你手机上。' + (inApp ? '你当前在 App 内置浏览器中，请先点右上角 ⋯「在浏览器打开」，再到浏览器里安装。' : '') + '</div>' +
      '<button class="btn btn-primary btn-block" data-action="me.copyLink">📋 复制本页链接（用手机浏览器打开后安装）</button>' +
      '<div class="row mt8"><button class="btn btn-ghost btn-sm" data-action="me.toggleInstallSteps">查看各手机安装步骤 ▾</button></div>' +
      '<div id="installSteps" style="display:none;font-size:12px;line-height:1.9" class="muted mt8">' +
        '<div><b>华为浏览器：</b>打开链接 → 点右下角 ⋮ →「添加至主屏幕」→ 定名称后确定。</div>' +
        '<div><b>安卓 Chrome / Edge：</b>打开链接 → 地址栏右侧「安装」图标，或 ⋮ →「安装应用」。</div>' +
        '<div><b>iOS Safari：</b>打开链接 → 点底部分享 →「添加到主屏幕」→ 命名后右上角「添加」。</div></div>' +
      '</div>';
  }

  function installDone() {
    try { if (localStorage.getItem('lifehub_install_done') === '1') return true; } catch (e) {}
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  /* ============================================================
   * API 设置
   * ========================================================== */
  function saveSettings() {
    const base = document.getElementById('apiBase').value.trim();
    const key = document.getElementById('apiKey').value.trim();
    const model = document.getElementById('apiModel').value.trim();
    const s = DB.settings();
    s.apiBase = base;
    s.apiKey = key;
    s.apiModel = model || 'deepseek-v4-flash';
    DB.setSettings(s);
    App.aiMode = 'cloud';
    s.aiMode = 'cloud';
    DB.setSettings(s);
    Util.toast('已保存并切换到联网 AI 模式');
  }

  async function testApiConnection() {
    const base = (document.getElementById('apiBase').value || '').trim();
    const key = (document.getElementById('apiKey').value || '').trim();
    const model = (document.getElementById('apiModel').value || '').trim() || 'deepseek-v4-flash';
    if (!base || !key) { Util.toast('请先填接口和 Key'); return; }
    Util.toast('正在测试连接…');
    try {
      const r = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({ model, messages: [{ role: 'user', content: 'ping，只回 ok' }], stream: false }),
      });
      let j = null;
      try { j = await r.json(); } catch (_) {}
      if (!r.ok) {
        let msg = (j && j.error && j.error.message) || ('HTTP ' + r.status);
        msg = String(msg);
        if (/UNAVAILABLE FOR FREE|PAID VERSION/i.test(msg)) {
          msg = '该模型已转为付费。请到上方下拉换一个带「:free」的模型再点「一键填入」重试。';
        }
        Util.toast('连接失败：' + msg.slice(0, 200));
        return;
      }
      const ok = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      Util.toast(ok ? '连接成功 ✓' : ('连接失败：' + ((j && j.error && j.error.message) || '空响应')));
    } catch (e) {
      Util.toast('连接失败：' + (e && e.message ? e.message : e));
    }
  }

  async function loadOpenRouterModels(sel) {
    if (!sel) return;
    try {
      const r = await fetch('https://openrouter.ai/api/v1/models');
      if (!r.ok) { Util.toast('获取免费模型失败，已用内置列表'); return; }
      const j = await r.json();
      const ms = (j.data || j).filter((m) => {
        const p = m.pricing || {};
        const free = (parseFloat(p.prompt || '0') === 0 && parseFloat(p.completion || '0') === 0) || (m.id && m.id.endsWith(':free'));
        if (!free) return false;
        const id = (m.id || '').toLowerCase();
        if (id.includes('lyria') || id.includes('content-safety') || id.includes('preview')) return false;
        return true;
      });
      if (!ms.length) { Util.toast('暂无可用的免费模型'); return; }
      const zh = (id) => /tencent|qwen|deepseek|hunyuan|glm|nemotron|yi-/.test(id);
      ms.sort((a, b) => (zh(b.id) ? 1 : 0) - (zh(a.id) ? 1 : 0));
      const cur = sel.value;
      sel.innerHTML = ms.map((m) => {
        const nm = (m.name || m.id).replace(/\s*\(free\)/i, '');
        return '<option value="' + m.id + '">' + nm + (zh(m.id) ? '（中文友好）' : '') + '</option>';
      }).join('');
      if (cur && ms.some((m) => m.id === cur)) sel.value = cur;
      Util.toast('已更新免费模型列表（' + ms.length + ' 个）');
    } catch (e) {
      Util.toast('获取失败（国内需 VPN/代理）：' + (e && e.message ? e.message : e));
    }
  }

  function fallbackCopy(text, done) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      done();
    } catch (e) {
      Util.toast('复制失败，请手动复制地址栏链接');
    }
  }

  /* ============================================================
   * 导入数据
   * ========================================================== */
  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const keys = ['todos', 'habits', 'notes', 'sports', 'workouts', 'trips', 'places', 'chat', 'vlogs'];
          for (const k of keys) {
            if (Array.isArray(data[k])) Store.set(k, data[k]);
          }
          Util.toast('导入成功！');
          renderTab(App.currentTab);
        } catch (err) {
          Util.toast('导入失败：文件格式不正确');
        }
      };
      reader.readAsText(file);
    });
    input.click();
  }

  /* ============================================================
   * 动作注册
   * ========================================================== */
  App.onAction('me.toggleTheme', () => {
    const s = DB.settings();
    s.theme = s.theme === 'dark' ? 'light' : 'dark';
    DB.setSettings(s);
    document.body.classList.toggle('dark', s.theme === 'dark');
    document.body.classList.toggle('light', s.theme === 'light');
  });

  App.onAction('me.saveSettings', saveSettings);
  App.onAction('me.testApi', testApiConnection);

  App.onAction('me.quickFill', () => {
    const base = document.getElementById('apiBase');
    const model = document.getElementById('apiModel');
    const key = document.getElementById('apiKey');
    if (base) base.value = 'https://api.deepseek.com/chat/completions';
    if (model) model.value = 'deepseek-v4-flash';
    if (key) key.focus();
    Util.toast('已填入 DeepSeek 接口与模型，粘贴 Key 后点保存');
  });

  App.onAction('me.quickOpenRouter', () => {
    const base = document.getElementById('apiBase');
    const model = document.getElementById('apiModel');
    const key = document.getElementById('apiKey');
    const sel = document.getElementById('orModel');
    const chosen = (sel && sel.value) || 'tencent/hy3:free';
    if (base) base.value = 'https://openrouter.ai/api/v1/chat/completions';
    if (model) model.value = chosen;
    if (key) key.focus();
    Util.toast('已填入 OpenRouter 免费档，粘贴你的免费 Key 后点保存');
  });

  App.onAction('me.refreshOrModels', () => {
    loadOpenRouterModels(document.getElementById('orModel'));
  });

  App.onAction('me.copyLink', () => {
    const url = location.href;
    const done = () => Util.toast('已复制链接，去手机浏览器粘贴打开后安装');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
    } else {
      fallbackCopy(url, done);
    }
  });

  App.onAction('me.toggleInstallSteps', () => {
    const el = document.getElementById('installSteps');
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  });

  App.onAction('me.import', () => importData());

  App.onAction('install.noMore', () => {
    try { localStorage.setItem('lifehub_install_done', '1'); } catch (e) {}
    const bar = document.getElementById('installBar');
    if (bar) bar.setAttribute('hidden', '');
    Util.toast('已不再提示安装');
  });

})();
