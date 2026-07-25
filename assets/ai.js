/* ============================================================
 * ai.js — AI 模块（对话 / 本地助手 / 流式输出 / 总结）
 * ========================================================== */
(function () {
  'use strict';

  const { Store, Util, App } = window;
  const { DB, openSheet, closeSheet, renderTab, empty } = App;

  /* ============================================================
   * 渲染主入口
   * ========================================================== */
  function renderAI() {
    if (App.aiView === 'learn') return renderLearn();
    const chat = DB.chat();
    let h = '<div class="card learn-entry" data-action="ai.learn">📚 <b>OpenCode 培训资料</b><br><span class="muted" style="font-size:12px">点开自学：终端里的开源 AI 编程 Agent</span></div>';
    h += '<div class="chip-row section-gap">';
    h += '<button class="chip" data-action="ai.summarize">📊 总结我的数据</button>';
    h += '<button class="chip" data-action="ai.clearChat">🗑 清空对话</button>';
    h += '</div>';
    const M = { local: '本地助手', webllm: '本地模型', cloud: '联网AI' };
    h += '<div class="chip-row section-gap" style="margin-top:-6px">';
    ['local', 'webllm', 'cloud'].forEach((m) => {
      h += '<button class="chip ' + (App.aiMode === m ? 'active' : '') + '" data-action="ai.mode" data-m="' + m + '">' + M[m] + '</button>';
    });
    h += '</div>';
    if (App.aiMode === 'webllm') {
      const mdl = webllmModel();
      const gpuOk = !!navigator.gpu;
      if (gpuOk) {
        h += '<div class="card" style="padding:10px 14px;font-size:12px" id="webllmCard">🧠 本地模型：<b>' + Util.esc(mdl) + '</b> · 完全免费、数据不出本机</div>';
        h += '<select class="field mt8" id="webllmModel">' +
          WEBLLM_MODELS.map((o) =>
            '<option value="' + o[0] + '"' + (o[0] === mdl ? ' selected' : '') + '>' + o[1] + '</option>').join('') +
          '</select>';
      } else {
        const hasCloud = !!(DB.settings().apiBase && DB.settings().apiKey);
        h += '<div class="card" style="padding:12px 14px;font-size:12.5px;line-height:1.6" id="webllmCard">' +
          '<div style="color:#ff6b6b;font-weight:600;margin-bottom:6px">⚠️ 本地模型无法在你的设备上运行</div>' +
          '本地模型需要浏览器支持 <b>WebGPU</b>。推荐改用「联网 AI」模式，任何浏览器都能用。' +
          (hasCloud
            ? ''
            : ' <button class="btn btn-primary btn-sm mt8" data-action="ai.gotoCloud">一键切到联网 AI</button>') +
          '</div>';
      }
    }
    h += '<div class="chat-wrap"><div class="chat-msgs" id="chatMsgs">';
    if (!chat.length) {
      const hint = App.aiMode === 'webllm'
        ? (navigator.gpu ? '当前是「本地模型」模式：完全免费、无需 Key。首次对话会自动下载模型。' : '当前是「本地模型」模式，但不支持 WebGPU。请改用「联网 AI」。')
        : App.aiMode === 'cloud'
          ? '当前是「联网 AI」模式：在「我的」接入 API Key 后即为联网智能助手。'
          : '当前是「本地助手」模式：离线、免费，但是规则问答。想要真正的 AI，去「我的」接入 API 后切到「联网 AI」。';
      h += '<div class="empty"><div class="big">🤖</div>嗨，我是你的 AI 生活助手。<br>试试问我：「给我一个健身计划」「旅行打包清单」「今天怎么安排」<br><span class="muted" style="font-size:12px">' + Util.esc(hint) + '</span></div>';
    } else {
      chat.forEach((m) => h += msgBubble(m));
    }
    h += '</div>';
    h += '<div class="chat-input"><input class="field" id="aiInput" placeholder="说点什么…" /><button class="btn btn-primary" data-action="ai.send">发送</button></div>';
    h += '</div>';
    App.screen.innerHTML = h;
    scrollChat();
    bindWebLLM();
  }
  App.renderers.ai = renderAI;

  function bindWebLLM() {
    const sel = document.getElementById('webllmModel');
    if (sel) sel.addEventListener('change', () => {
      const cur = DB.settings(); cur.webllmModel = sel.value; DB.setSettings(cur);
      App._wllm = null;
      Util.toast('已选 ' + sel.value + '，下次对话生效');
    });
  }

  function renderLearn() {
    const L = window.LEARN;
    let h = '<div class="card"><div class="flex-between"><div class="card-title" style="margin:0">📚 OpenCode 培训资料</div><button class="btn btn-ghost btn-sm" data-action="ai.back">← 返回</button></div>';
    h += '<div class="muted mt8" style="font-size:12px">开源终端 AI 编程 Agent · 自己学习用（资料更新 ' + (L ? L.updated : '') + '）</div></div>';
    if (L && L.sections) {
      L.sections.forEach((s, i) => {
        h += '<div class="card"><div class="card-title">' + (i + 1) + '. ' + Util.esc(s.title) + '</div><div class="learn-body">' + s.body + '</div></div>';
      });
    } else {
      h += empty('📭', '培训资料未加载');
    }
    App.screen.innerHTML = h;
    App.screen.scrollTop = 0;
  }

  function msgBubble(m) {
    const cls = m.role === 'me' ? 'me' : 'bot';
    const av = m.role === 'me' ? '🙂' : '🤖';
    return '<div class="msg ' + cls + '"><div class="av">' + av + '</div><div class="bubble">' + Util.esc(m.text) + '</div></div>';
  }

  function scrollChat() {
    const el = document.getElementById('chatMsgs');
    if (el) el.scrollTop = el.scrollHeight;
  }

  /* ============================================================
   * 发送消息
   * ========================================================== */
  async function sendAI() {
    const input = document.getElementById('aiInput');
    const text = (input.value || '').trim();
    if (!text) return;
    input.value = '';
    const chat = DB.chat();
    chat.push({ role: 'me', text });
    DB.setChat(chat);
    renderAI();
    const msgsEl = document.getElementById('chatMsgs');
    const thinking = document.createElement('div');
    thinking.className = 'msg bot';
    thinking.innerHTML = '<div class="av">🤖</div><div class="bubble">思考中…</div>';
    msgsEl.appendChild(thinking);
    scrollChat();
    const setPartial = (p) => { const b = thinking.querySelector('.bubble'); if (b) { b.textContent = p; scrollChat(); } };

    let reply;
    if (App.aiMode === 'webllm') {
      reply = await callWebLLM(text, setPartial);
      if (typeof reply === 'string' && reply.startsWith('ERR:')) {
        Util.toast('本地模型不可用，已回退本地助手');
        reply = localAssistant(text) + '\n\n（本地模型出错，已回退规则助手：' + reply.slice(4) + '）';
        setPartial(reply);
      }
    } else if (App.aiMode === 'cloud') {
      reply = await callAI(text, undefined, setPartial);
      if (reply === null || (typeof reply === 'string' && reply.startsWith('ERR:'))) {
        if (typeof reply === 'string' && reply.startsWith('ERR:')) {
          const detail = reply.slice(4);
          const tip = /UNAVAILABLE FOR FREE|PAID VERSION/i.test(detail)
            ? '该模型已转付费，请在「我的」换一个 :free 模型'
            : detail.slice(0, 120);
          Util.toast('联网失败：' + tip);
        }
        reply = localAssistant(text);
      }
    } else {
      reply = localAssistant(text);
    }
    thinking.remove();
    const updated = DB.chat();
    updated.push({ role: 'bot', text: reply });
    DB.setChat(updated);
    renderAI();
  }
  App.sendAI = sendAI;

  /* ============================================================
   * 调用云 AI（支持流式）
   * ========================================================== */
  async function callAI(userText, systemOverride, onPartial) {
    const s = DB.settings();
    if (!s.apiBase || !s.apiKey) return null;
    const sys = systemOverride || '你是「生活家 LifeHub」里的 AI 生活助手，帮助用户管理生活、运动、旅行，并回答各类问题。请用简体中文，回答简洁、友好、实用。';
    const hist = DB.chat().slice(-12).map((m) => ({ role: m.role === 'me' ? 'user' : 'assistant', content: m.text }));
    const messages = [{ role: 'system', content: sys }, ...hist, { role: 'user', content: userText }];
    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), 60000);
    try {
      const r = await fetch(s.apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.apiKey },
        body: JSON.stringify({ model: s.apiModel || 'deepseek-v4-flash', messages, stream: true }),
        signal: controller.signal,
      });
      clearTimeout(to);
      if (!r.ok) {
        const txt = await r.text().catch(() => '');
        return 'ERR:HTTP ' + r.status + ' ' + txt.slice(0, 240);
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let full = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const j = JSON.parse(trimmed.slice(6));
              const delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
              if (delta) { full += delta; if (onPartial) onPartial(full); }
            } catch (e) { /* skip malformed chunk */ }
          }
        }
      }
      return full || '（模型没有返回内容）';
    } catch (e) {
      clearTimeout(to);
      return 'ERR:' + (e.name === 'AbortError' ? '请求超时（60s）' : e.message);
    }
  }
  App._callAI = callAI;

  /* ============================================================
   * WebLLM 本地模型
   * ========================================================== */
  const WEBLLM_MODELS = [
    ['Qwen3-0.6B-q4f16_1-MLC', 'Qwen3 0.6B（最小·最快）'],
    ['Qwen3-1.7B-q4f16_1-MLC', 'Qwen3 1.7B（均衡推荐）'],
    ['Llama-3.2-1B-Instruct-q4f16_1-MLC', 'Llama 3.2 1B'],
    ['Qwen2.5-1.5B-Instruct-q4f16_1-MLC', 'Qwen2.5 1.5B'],
    ['Phi-3.5-mini-instruct-q4f16_1-MLC', 'Phi-3.5-mini 3.8B（更强）'],
  ];
  const WEBLLM_DEFAULT = 'Qwen3-1.7B-q4f16_1-MLC';

  function webllmModel() {
    const valid = WEBLLM_MODELS.map((m) => m[0]);
    const cur = DB.settings().webllmModel;
    if (cur && valid.indexOf(cur) !== -1) return cur;
    if (cur) { const s = DB.settings(); s.webllmModel = WEBLLM_DEFAULT; DB.setSettings(s); }
    return WEBLLM_DEFAULT;
  }

  async function callWebLLM(userText, onPartial) {
    if (!navigator.gpu) {
      return 'ERR:当前浏览器不支持 WebGPU，无法运行本地模型。请用最新版 Chrome / Edge（桌面端），或切到「本地助手」。';
    }
    try {
      if (!App._wllm) {
        if (!App._wllmLoading) {
          App._wllmLoading = (async () => {
            Util.toast('首次加载本地模型，请稍候（约几百 MB，之后会缓存到本机）');
            let mod;
            try {
              mod = await import('https://esm.run/@mlc-ai/web-llm');
            } catch (e1) {
              mod = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm/+esm');
            }
            const model = webllmModel();
            App._wllm = await mod.CreateMLCEngine(model, { initProgressCallback: (p) => updateWebLLMProgress(p) });
          })();
        }
        try {
          await App._wllmLoading;
        } finally {
          App._wllmLoading = null;
        }
      }
      const sys = '你是「生活家 LifeHub」里的 AI 生活助手，帮助用户管理生活、运动、旅行，并回答各类问题。请用简体中文，回答简洁、友好、实用。';
      const hist = DB.chat().slice(-10).map((m) => ({ role: m.role === 'me' ? 'user' : 'assistant', content: m.text }));
      const messages = [{ role: 'system', content: sys }, ...hist, { role: 'user', content: userText }];
      const stream = await App._wllm.chat.completions.create({ messages, stream: true, stream_options: { include_usage: true }, temperature: 0.7, max_tokens: 600 });
      let out = '';
      for await (const chunk of stream) {
        const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
        if (d) { out += d; if (onPartial) onPartial(out); }
      }
      return out || '（模型没有返回内容）';
    } catch (e) {
      return 'ERR:本地模型出错：' + (e && e.message ? e.message : e);
    }
  }

  function updateWebLLMProgress(p) {
    const card = document.getElementById('webllmCard');
    if (!card) return;
    const pct = p && typeof p.progress === 'number' ? Math.round(p.progress * 100) : 0;
    const txt = p && p.text ? p.text : '';
    card.textContent = '🧠 模型加载中 ' + pct + '%' + (txt ? ' · ' + txt : '');
  }

  /* ============================================================
   * 本地规则助手
   * ========================================================== */
  function localAssistant(text) {
    const t = text.toLowerCase();
    const has = (...kw) => kw.some((k) => t.includes(k));

    if (has('你好', 'hi', 'hello', '在吗', '嗨')) {
      return '你好呀！我是你的 AI 生活助手 😊\n我可以帮你：\n· 制定健身 / 运动计划\n· 生成旅行打包清单\n· 规划今天的生活安排\n· 给健康 / 习惯小建议\n\n想先从哪方面开始？';
    }
    if (has('健身', '运动', '训练', '锻炼', '增肌', '塑形') && has('计划', '安排', '表', '怎么', '如何')) {
      return '给你一份通用每周运动计划（可按自身情况调整）：\n\n周一 力量训练（胸/背）45min\n周二 慢跑或骑行 30min\n周三 休息 / 拉伸瑜伽\n周四 力量训练（腿/肩）45min\n周五 有氧 HIIT 20min\n周六 户外活动 / 球类 60min\n周日 完全休息\n\n小贴士：每次训练前热身 5–10 分钟，后拉伸 10 分钟，保证睡眠与蛋白质摄入。';
    }
    if (has('减肥', '减脂', '瘦')) {
      return '减脂三件套，简单有效：\n1. 热量缺口：饮食控制为主，运动为辅\n2. 每周 3–5 次有氧（快走/跑步/骑行），每次 30–45min\n3. 增加蛋白质与蔬菜，少油少糖\n\n坚持 4 周就能看到变化。要不要我帮你记到「运动」里？';
    }
    if (has('打包', '行李', '带什么', '准备', '必备')) {
      return '旅行打包清单（通用版）：\n\n📄 证件：身份证/护照、机票酒店订单、驾照\n💳 财务：现金、银行卡、信用卡\n📱 电子：手机、充电器、充电宝、耳机、转换插头\n🧴 洗漱：牙刷牙膏、防晒、护肤品小样\n👕 衣物：按天数+1 备换洗，外套、舒适鞋\n💊 药品：晕车药、创可贴、常用药\n🕶 其他：墨镜、雨伞、口罩、湿巾\n\n去海边/雪场再单独加对应装备～';
    }
    if (has('去哪', '旅行', '目的地', '推荐', '好玩', '攻略', '城市')) {
      return '想出去玩？几个思路：\n· 想放松 → 海边/温泉（青岛、三亚、云南）\n· 想逛吃 → 成都、长沙、西安\n· 想自然 → 川西、新疆、贵州\n· 想人文 → 北京、洛阳、苏州\n\n告诉我预算和天数，我帮你细化行程，也能直接存进「旅行」模块。';
    }
    if (has('今天', '安排', '计划', '待办', '日程', '做什么')) {
      const todos = DB.todos().filter((x) => !x.done);
      let base = '今日建议节奏：\n☀ 上午：处理 1–2 件重要待办\n🍱 中午：散步 15min + 好好吃饭\n📚 下午：专注工作/学习块\n🌙 晚上：运动 30min + 复盘\n\n';
      if (todos.length) base += '你还有 ' + todos.length + ' 件待办未完成，先挑最重要的做掉吧！';
      else base += '目前待办是空的，享受轻松的一天 🎉';
      return base;
    }
    if (has('喝水', '睡眠', '习惯', '健康', '早起')) {
      return '健康小建议：\n· 喝水：每天 1.5–2L，少量多次，可用「习惯打卡」记录\n· 睡眠：固定作息，睡前 1h 远离屏幕\n· 久坐：每 45min 起身活动 3min\n\n这些都能在「生活 → 习惯打卡」里养成哦。';
    }
    if (has('你是谁', '你叫', '名字', '介绍')) {
      return '我是 LifeHub 里的 AI 助手 🤖，集成在你的生活 / 运动 / 旅行小应用里。\n当前是本地模式（无需联网）。去「我的」一键接入大模型，我就能联网回答你的问题、帮你总结数据。';
    }
    if (has('opencode', '培训', '学习资料', '终端', '编程 agent', '编程agent')) {
      return '想学 OpenCode？点开 AI 版块顶部的「📚 OpenCode 培训资料」就能看全套自学教程。';
    }
    return '收到～我可以帮你做这些事：\n· 制定健身 / 减脂计划\n· 生成旅行打包清单 & 目的地推荐\n· 规划今天的生活安排\n· 健康 / 习惯小建议\n\n直接说需求就行，比如「给我一个健身计划」。也可以去「我的」接入大模型 API 获得更强能力。';
  }

  /* ============================================================
   * 数据总结
   * ========================================================== */
  function localSummary() {
    const todos = DB.todos();
    const undone = todos.filter((t) => !t.done).length;
    const overdue = todos.filter((t) => t.due && !t.done && Util.dayDiff(Util.today(), t.due) < 0).length;
    const vlogs = DB.vlogs();
    const today = Util.today();
    const monthVlogs = vlogs.filter((v) => (v.date || '').slice(0, 7) === today.slice(0, 7)).length;
    const weekSet = new Set(Util.lastNDays(7));
    const wc = DB.workouts().filter((w) => weekSet.has(w.date)).reduce((s, w) => s + (Number(w.count) || 0), 0);
    const tips = [];
    if (overdue > 0) tips.push('先处理 ' + overdue + ' 件逾期待办');
    if (monthVlogs === 0) tips.push('这个月还没记 VLOG，随手拍一张记录生活吧');
    if (wc < 50) tips.push('本周运动偏少，安排 2–3 次训练');
    if (!tips.length) tips.push('保持得不错，继续保持节奏！');
    return '【本周生活小结 · 本地版】\n待办：未完成 ' + undone + ' 件（逾期 ' + overdue + ' 件）\nVLOG：累计 ' + vlogs.length + ' 条，本月 ' + monthVlogs + ' 条\n运动：本周 ' + wc + ' 个\n\n建议：\n' +
      tips.map((t, i) => (i + 1) + '. ' + t).join('\n') +
      '\n\n（想要更智能的总结，可切到「本地模型」或接入联网 AI）';
  }

  function buildSummaryContext() {
    const today = Util.today();
    const todos = DB.todos();
    const undone = todos.filter((t) => !t.done);
    const overdue = todos.filter((t) => t.due && !t.done && Util.dayDiff(today, t.due) < 0);
    const vlogs = DB.vlogs();
    const monthVlogs = vlogs.filter((v) => (v.date || '').slice(0, 7) === today.slice(0, 7)).length;
    const weekSet = new Set(Util.lastNDays(7));
    const workouts = DB.workouts();
    const weekSessions = workouts.filter((w) => weekSet.has(w.date)).length;
    const weekCount = workouts.filter((w) => weekSet.has(w.date)).reduce((s, w) => s + (Number(w.count) || 0), 0);
    const sports = DB.sports();
    const weekDur = sports.filter((s) => weekSet.has(s.date)).reduce((s, r) => s + (Number(r.duration) || 0), 0);
    const trips = DB.trips();
    const upcoming = trips.filter((t) => !t.end || t.end >= today).slice(0, 3);
    let ctx = '【生活家数据快照 · ' + today + '】\n';
    ctx += '待办：共 ' + todos.length + ' 件，未完成 ' + undone.length + ' 件，逾期 ' + overdue.length + ' 件';
    if (overdue.length) ctx += '（如：' + overdue.slice(0, 3).map((t) => t.text).join('、') + '）';
    ctx += '\n';
    ctx += 'VLOG：累计 ' + vlogs.length + ' 条，本月 ' + monthVlogs + ' 条\n';
    ctx += '运动：本周打卡 ' + weekSessions + ' 次、共 ' + weekCount + ' 个；本周运动时长 ' + weekDur + ' 分钟\n';
    ctx += '旅行：' + (upcoming.length ? upcoming.map((t) => t.title + '（' + (t.dest || '未填目的地') + '）').join('、') : '暂无计划') + '\n';
    return ctx;
  }

  function openSummarySheet() {
    const ctx = buildSummaryContext();
    const prompt = ctx + '\n请基于以上数据，给我一份本周生活总结（250 字以内），并给出 2–3 条可立即执行的小建议。用友好的口语化中文，分点呈现。';
    openSheet('📊 总结我的数据',
      '<div class="center" id="sumLoading" style="padding:24px 0;white-space:pre-wrap">🤖 正在生成总结…</div>' +
      '<div id="sumBody" style="display:none;white-space:pre-wrap;font-size:14px;line-height:1.65"></div>',
      (mask) => {
        const loading = mask.querySelector('#sumLoading');
        const body = mask.querySelector('#sumBody');
        (async () => {
          let reply = null;
          if (App.aiMode === 'webllm') {
            loading.textContent = '🧠 本地模型生成中…';
            reply = await callWebLLM(prompt, (p) => { if (p) loading.textContent = p; });
          } else if (App.aiMode === 'cloud') {
            const s = DB.settings();
            if (s.apiBase && s.apiKey) {
              const sys = '你是生活家 LifeHub 的 AI 助手，擅长把用户的应用数据提炼成有温度的生活总结与可执行建议。';
              reply = await callAI(prompt, sys, (p) => { if (p) loading.textContent = p; });
            }
          }
          if (!reply || (typeof reply === 'string' && reply.startsWith('ERR:'))) {
            reply = localSummary();
          }
          loading.style.display = 'none';
          body.style.display = 'block';
          body.textContent = reply;
          mask.querySelector('.sheet').appendChild(save);
          mask.querySelector('#sheetCancel').remove();
        })();
      });
  }

  /* ============================================================
   * 动作注册
   * ========================================================== */
  App.onAction('ai.send', () => sendAI());

  App.onAction('ai.mode', (btn) => {
    const m = btn.dataset.m;
    App.aiMode = m;
    const s = DB.settings(); s.aiMode = m; DB.setSettings(s);
    renderAI();
    Util.toast(m === 'local' ? '已切换为离线规则助手' : m === 'webllm' ? '已切换为本地模型' : '已切换为联网 AI');
  });

  App.onAction('ai.learn', () => {
    App.aiView = 'learn';
    renderAI();
  });

  App.onAction('ai.back', () => {
    App.aiView = 'chat';
    renderAI();
  });

  App.onAction('ai.summarize', () => openSummarySheet());

  App.onAction('ai.clearChat', () => {
    if (!confirm('确定清空对话历史？')) return;
    DB.setChat([]);
    renderAI();
    Util.toast('已清空');
  });

  App.onAction('ai.gotoCloud', () => {
    App.aiMode = 'cloud';
    const s = DB.settings(); s.aiMode = 'cloud'; DB.setSettings(s);
    renderTab('me');
    Util.toast('已切换到联网 AI 模式，请到「我的」配置 API Key');
  });

})();
