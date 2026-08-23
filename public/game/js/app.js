/* =========================================================================
 * app.js — 《恋爱人格剧场》UI 控制器
 * 流程：封面 → 游戏(5阶段30关，阶段间有小结屏) → 加载 → 个人说明书 → （可选）双人缘分报告
 * 用户资料：优先由宿主 App postMessage 注入（昵称/头像/性别），
 *          独立访问时回退 URL 参数 → localStorage → 默认值。
 * ========================================================================= */

(() => {
  'use strict';

  /* ---------- 工具 ---------- */
  const $ = sel => document.querySelector(sel);
  const show = id => { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); $(id).classList.remove('hidden'); };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const STORE = { me: 'ltm_profile_me', partner: 'ltm_profile_partner', host: 'ltm_host_profile' };
  const readStore = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const writeStore = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } };

  /* ---------- 全局状态 ---------- */
  let session = null;        // 当前游戏会话
  let mode = 'me';           // 'me' | 'partner'
  let manual = null;         // 当前生成的画像
  let profileJson = null;
  let hostProfile = null;    // 宿主 App 注入的用户资料
  let pendingNext = null;    // 小结屏停留时待进入的题号

  /* =====================================================================
   * 宿主资料注入（iframe 场景）+ 独立访问 fallback
   * ===================================================================== */
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (d && d.type === 'love-game:profile' && d.payload) {
      hostProfile = {
        nickname: d.payload.nickname || '',
        gender: d.payload.gender || '',
        avatar: d.payload.avatar || '',          // emoji 或 db: 头像标识
        avatarImg: d.payload.avatarImg || '',    // 宿主渲染好的 data URI（DiceBear）
      };
      writeStore(STORE.host, hostProfile);
      renderIntro();
    }
  });

  function loadHostProfile() {
    if (hostProfile) return hostProfile;
    hostProfile = readStore(STORE.host);
    if (hostProfile) return hostProfile;
    // 独立访问：URL 参数 ?nick=&avatar=&avatarImg=
    const qs = new URLSearchParams(location.search);
    const p = {
      nickname: qs.get('nick') || '',
      gender: qs.get('gender') || '',
      avatar: qs.get('avatar') || '',
      avatarImg: qs.get('avatarImg') || '',
    };
    if (p.nickname || p.avatar || p.avatarImg) { hostProfile = p; writeStore(STORE.host, p); }
    return hostProfile;
  }

  /* TA 的形象：场景情绪符号（抽象体系，留白给想象） */
  function taAvatarOf(sceneCfg) {
    const mood = sceneCfg && sceneCfg.mood || '';
    const MOOD_MAP = [
      [/心动|甜|喜欢|开心|兴奋|期待|热/, '😊'], [/紧张|忐忑|犹豫/, '😖'],
      [/委屈|失落|落空|难过|遗憾/, '🥺'], [/生气|愤怒|火|烦/, '😤'],
      [/冷战|冷|疏离|沉默/, '🫥'], [/沉|重|压力|疲惫|累/, '😔'],
      [/平静|安稳|踏实/, '🙂'], [/害羞|脸红|心动加速/, '☺️'],
    ];
    for (const [re, emoji] of MOOD_MAP) if (re.test(mood)) return emoji;
    return (sceneCfg && sceneCfg.emoji) || '🌙';
  }

  /* =====================================================================
   * 封面
   * ===================================================================== */
  function renderIntro() {
    const partner = readStore(STORE.partner);
    const me = readStore(STORE.me);
    const host = loadHostProfile();

    $('#intro-greet').innerHTML = host && host.nickname
      ? `欢迎回来，<b>${esc(host.nickname)}</b>。这趟旅程，为你而开。`
      : '三十幕悲欢，替你翻开自己。';

    $('#intro-partner-tip').innerHTML = partner
      ? `TA 的说明书已就绪，可以 <a href="javascript:void(0)" onclick="App.showCompat()">查看你们的缘分报告</a>`
      : '';
    $('#intro-me-tip').innerHTML = me
      ? `上次生成：${esc(me.nickname || '我')} 的《${esc(me.archetype_name || '恋爱说明书')}》`
      : '这本说明书会随你每玩一次变得更立体。';
  }

  function startGame(which) {
    mode = which;
    const host = loadHostProfile();
    const nickname = (which === 'partner'
      ? ''                                        // TA 模式不需要昵称
      : (host && host.nickname) || '') || '旅人';
    session = GameEngine.createSession(nickname);
    session.playerAvatarImg = (host && host.avatarImg) || '';
    session.playerAvatar = (host && host.avatar) || '🙂';

    questionIndex = -1;
    currentStage = null;
    show('#screen-game');
    renderQuestion();
  }

  /* =====================================================================
   * 游戏流程（情景对话版 · 30 幕 · 阶段间小结）
   * ===================================================================== */
  let questionIndex = -1;
  let currentStage = null;

  /* 阶段寄语：小结屏的一句话 */
  const STAGE_QUOTES = {
    meet: '第一句开场白已经发出去了。你还不知道，接下来的每一步都在悄悄写你的画像。',
    honeymoon: '热恋像夏天，什么都浓。浓得刚刚好的，才走得远。',
    grinding: '浪漫退潮之后，露出来的是生活本身。你们开始真正相处了。',
    conflict: '争吵不是关系的裂缝，是两个人的边界在互相确认。',
    deep: '走到这里的问题，都没有标准答案——只有你们想要的答案。',
  };

  const flowEl = () => $('#dialogue-flow');
  const barEl = () => $('#choice-bar');

  function renderQuestion() { renderQuestionAt(questionIndex + 1); }

  async function renderQuestionAt(index) {
    const scenario = SCENARIOS[index];
    if (!scenario) { finishGame(); return; }

    /* 阶段切换 → 先插入小结屏（第一幕不插入） */
    if (currentStage && scenario.stage !== currentStage) {
      showInterlude(currentStage, index);
      return;
    }
    await renderScenarioAt(index);
  }

  /* 实际渲染某一幕 */
  async function renderScenarioAt(index) {
    questionIndex = index;
    const scenario = SCENARIOS[questionIndex];
    if (!scenario) { finishGame(); return; }

    if (currentStage !== scenario.stage) {
      currentStage = scenario.stage;
      $('#stage-chip').textContent = stageLabel(scenario.stage);
      $('#stage-desc').textContent = (STAGES.find(s => s.key === scenario.stage) || {}).desc || '';
    }

    const progress = Math.round((questionIndex / SCENARIOS.length) * 100);
    $('#progress-bar').style.width = progress + '%';
    $('#progress-text').textContent = `${questionIndex + 1} / ${SCENARIOS.length}`;

    // 场景氛围背景（色彩场 + 粒子，Canvas 程序化生成，无图片）
    SceneBackdrop.render($('#scene-backdrop'), scenario);

    // 明暗色调同步到游戏屏 UI（气泡/头部/选项随之换肤）
    const sceneCfg = scenario.scene || {};
    $('#screen-game').dataset.tone = sceneCfg.tone || 'dark';

    $('#insight-toast').classList.add('hidden');
    $('#btn-back').disabled = questionIndex === 0;

    // 清空对话流与选项栏，先落一条时间/场景分割线，再播开场白 → 出选项
    const flow = flowEl(), bar = barEl();
    Dialogue.hideChoices(bar);
    flow.innerHTML = '';
    Dialogue.systemDivider(flow, `${sceneCfg.time || ''} · ${sceneCfg.location || ''}`);

    const dlg = scenario.dialogue || {};
    const avatar = taAvatarOf(sceneCfg);
    const pace = sceneCfg.pace || 'normal';
    const intro = (dlg.intro || []).map(l => Object.assign({ avatar }, l));

    await Dialogue.play(flow, intro, { taAvatar: avatar, pace });
    if (questionIndex !== index) return; // 播放期间已切题（快速回退），放弃后续渲染

    Dialogue.showChoices(bar, scenario.options, (idx) => answer(scenario, idx));
  }

  async function answer(scenario, optionIndex) {
    const idx = questionIndex;                    // 快照当前题号
    const option = GameEngine.choose(session, scenario.id, optionIndex);
    const flow = flowEl(), bar = barEl();

    // 把"我的回复"定格进对话流，收起选项栏
    // cold 场景追加「已读」回执并留白一拍——已读不回，沉默即台词
    const sceneCfgA = scenario.scene || {};
    const paceA = sceneCfgA.pace || 'normal';
    Dialogue.hideChoices(bar);
    await Dialogue.appendMine(flow, option.text, { pace: paceA, readReceipt: paceA === 'cold' });
    if (questionIndex !== idx) return;

    // TA 的反应台词 + 内心旁白（dialogue.reactions 与 options 同下标）
    const dlg = scenario.dialogue || {};
    const avatar = taAvatarOf(sceneCfgA);
    const reactions = ((dlg.reactions || [])[optionIndex] || []).map(l => Object.assign({ avatar }, l));
    if (reactions.length) {
      await Dialogue.play(flow, reactions, { taAvatar: avatar, pace: paceA });
      if (questionIndex !== idx) return;
    }

    // 即时洞察："选择即画像"
    $('#insight-text').textContent = '💡 ' + option.note;
    $('#insight-toast').classList.remove('hidden');
    $('#insight-toast').classList.add('pop');

    // 手动确认进入下一幕（最后一关按钮变为生成说明书）
    const isLast = questionIndex >= SCENARIOS.length - 1;
    Dialogue.showNext(bar, isLast ? '生成我的说明书 →' : '下一幕 →', () => {
      $('#insight-toast').classList.remove('pop');
      renderQuestion();
    });
  }

  /* =====================================================================
   * 阶段小结屏（30 幕的呼吸点）
   * ===================================================================== */
  function showInterlude(stageKey, nextIndex) {
    pendingNext = nextIndex;
    const stats = GameEngine.stageStats(session);
    const st = stats[stageKey] || {};
    const stageMeta = STAGES.find(s => s.key === stageKey) || {};

    const stageOrder = STAGES.findIndex(s => s.key === stageKey);
    $('#il-eyebrow').textContent = `第 ${stageOrder + 1} 站 · ${st.count || 0} 幕完成`;
    $('#il-stage-name').textContent = stageMeta.label || '';
    $('#il-quote').textContent = STAGE_QUOTES[stageKey] || '';

    /* 这一站最触动的一幕：取该阶段权重最重（画像影响最大）的一次选择 */
    const stageAnswers = (session.answers || []).filter(a => a.stage === stageKey);
    const strongest = stageAnswers.slice().sort((a, b) => {
      const wa = Object.values(a.weights || {}).reduce((s, v) => s + Math.abs(v), 0);
      const wb = Object.values(b.weights || {}).reduce((s, v) => s + Math.abs(v), 0);
      return wb - wa;
    })[0];
    $('#il-note').innerHTML = strongest
      ? `这一站，你在第 ${strongest.act} 幕「${esc(strongest.title)}」里的选择：<br><b>${esc(strongest.optionText)}</b><br><span class="muted">${esc(strongest.insight || '')}</span>`
      : '这一站的每一步，都被画像悄悄记下。';

    /* 本阶段八维迷你条 */
    const dims = st.dims || {};
    $('#il-dims').innerHTML = GameEngine.DIMENSIONS.map(d => {
      const v = dims[d.key] ?? 50;
      return `
      <div class="dim-row">
        <div class="dim-label">${esc(d.label)} <span class="dim-val">${v}</span></div>
        <div class="dim-track"><div class="dim-fill" style="width:${v}%"></div><div class="dim-knob" style="left:${v}%"></div></div>
        <div class="dim-scale"><span>${esc(d.low)}</span><span>${esc(d.high)}</span></div>
      </div>`;
    }).join('');

    const isDeep = stageKey === 'deep';
    $('#il-continue').textContent = isDeep ? '进入终章 · 生成我的说明书 →' : '继续旅程 →';
    $('#il-continue').onclick = () => {
      pendingNext = null;
      show('#screen-game');
      renderScenarioAt(nextIndex);
    };
    show('#screen-interlude');
  }

  /* 返回上一题：撤销刚做的选择，回到上一场景重新选择 */
  function goBack() {
    const undone = GameEngine.undoLast(session);
    if (!undone) return;               // 第一题没有可撤销的选择
    $('#insight-toast').classList.remove('pop');
    // 回退可能跨阶段：重算 currentStage，不弹小结屏
    const target = SCENARIOS[questionIndex - 1];
    if (target && target.stage !== currentStage) currentStage = null;
    renderScenarioAt(questionIndex - 1);
  }

  function finishGame() {
    show('#screen-loading');
    SceneBackdrop.stop();
    $('#loading-text').textContent = '正在为你生成「个人说明书」…';

    setTimeout(() => {
      const dims = GameEngine.normalize(session);
      manual = Portrait.buildManual(session, dims);
      profileJson = Portrait.toProfileJson(manual);

      /* 嵌入 theone App（iframe）时，把画像结果同步给宿主页面 */
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({
            type: 'love-game:result',
            payload: {
              profile: profileJson,                 // 含 evidence / stage_stats / dimension_confidence
              choices: (session.answers || []).map(a => ({
                scenarioId: a.scenarioId,
                stage: a.stage,
                title: a.title,
                act: a.act,
                optionIndex: a.optionIndex,
                optionText: a.optionText,
                insight: a.insight,
                weights: a.weights,
              })),
              stageStats: profileJson.stage_stats,
              answeredAt: new Date().toISOString(),
            },
          }, '*');
        }
      } catch (e) { /* 独立运行时忽略 */ }

      if (mode === 'partner') {
        writeStore(STORE.partner, profileJson);
        renderCompat();
      } else {
        writeStore(STORE.me, profileJson);
        renderReport();
      }
    }, 900);
  }

  /* =====================================================================
   * 个人说明书报告
   * ===================================================================== */
  function renderReport() {
    show('#screen-report');
    const m = manual;
    const name = m.nickname || '我';

    /* 头部 */
    $('#r-name').textContent = name;
    $('#r-arch-name').textContent = m.archetype.name;
    $('#r-arch-emoji').textContent = m.archetype.emoji;
    $('#r-tagline').textContent = m.archetype.tagline;
    $('#r-substyle').textContent = m.subStyle ? m.subStyle.label : '';
    $('#r-paragraph').textContent = m.archetype.paragraph;

    /* 雷达图 */
    const cv = $('#radar');
    const dpr = window.devicePixelRatio || 1;
    const size = Math.min(360, window.innerWidth - 64);
    cv.width = size * dpr; cv.height = (size * 0.92) * dpr;
    cv.style.width = size + 'px'; cv.style.height = (size * 0.92) + 'px';
    drawRadar(cv, m.dimensions, dpr);

    /* 维度条 */
    $('#dim-bars').innerHTML = m.dimensionSummary.map(d => `
      <div class="dim-row">
        <div class="dim-label">${esc(d.label)} <span class="dim-val">${d.value}</span></div>
        <div class="dim-track"><div class="dim-fill" style="width:${d.value}%"></div><div class="dim-knob" style="left:${d.value}%"></div></div>
        <div class="dim-scale"><span>${esc(d.low)}</span><span>${esc(d.high)}</span></div>
      </div>`).join('');

    /* 证据链：每个维度的分数都有出处 */
    renderEvidence(m);

    /* 沟通密码 & 关系模式 */
    $('#r-comm').innerHTML = m.communicatePassword.map(t => `<li>${esc(t)}</li>`).join('');
    $('#r-pattern').innerHTML = m.relationshipPattern.map(t => `<li>${esc(t)}</li>`).join('');

    /* 摩擦预警区 & 隐形闪光点 */
    $('#r-friction').innerHTML = (m.frictionAlerts.length ? m.frictionAlerts : ['暂无显著预警项，相处模式相对均衡']).map(t => `<li>${esc(t)}</li>`).join('');
    $('#r-strengths').innerHTML = (m.hiddenStrengths.length ? m.hiddenStrengths : ['你的特质较为均衡，温和而稳定']).map(t => `<li>${esc(t)}</li>`).join('');

    /* 成长建议 & 理想伴侣画像 */
    $('#r-growth').innerHTML = (m.growthAdvice.length ? m.growthAdvice : ['当前没有明显短板，保持这份松弛感就好']).map(t => `<li>${esc(t)}</li>`).join('');
    $('#r-ideal').innerHTML = m.idealPartner
      ? `<div class="ideal-head">${m.idealPartner.archetypeEmoji} ${esc(m.idealPartner.archetypeName)}
           <span class="muted small"> · ${esc(m.idealPartner.tagline)}</span></div>
         <ul class="nice-list">${m.idealPartner.points.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
      : '';

    /* 心元大模型解读（预留接口②）：需手动确认才调用 */
    $('#xinyuan-summary').textContent = '点击下方按钮，心元大模型才会开始解读你的画像。';
    $('#xinyuan-tip').textContent = '正式版将由心元大模型基于完整画像生成（情感陪伴 / 缘分测量 / 人格洞察）。';
    $('#xinyuan-confirm').style.display = '';

    /* 缘分匹配（预留接口①）：是否已有 TA 的画像 */
    renderCompatSection();
    $('#btn-goto-compat').style.display = readStore(STORE.partner) ? '' : 'none';

    /* 底部 JSON */
    $('#json-payload').textContent = JSON.stringify(profileJson, null, 2);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* 证据链区块：每维度可展开「你在第 N 幕这样选」 */
  function renderEvidence(m) {
    const evidence = m.evidence || {};
    const conf = m.confidence || {};
    $('#r-evidence').innerHTML = GameEngine.DIMENSIONS.map((d, i) => {
      const items = evidence[d.key] || [];
      const score = m.dimensions[d.key];
      const confN = conf[d.key] || 0;
      const lines = items.map(it => `
        <div class="ev-line">
          <span class="ev-act">第 ${it.act} 幕</span>${esc(it.choice)}
          ${it.note ? `<br><span class="ev-conf">${esc(it.note)}</span>` : ''}
        </div>`).join('');
      return `
        <div class="ev-item${i === 0 ? ' open' : ''}">
          <div class="ev-head" onclick="this.parentElement.classList.toggle('open')">
            <span>${esc(d.label)}<span class="ev-caret"> ▸</span></span>
            <span><span class="ev-conf">${confN} 个依据</span> <span class="ev-score">${score}</span></span>
          </div>
          <div class="ev-list">${lines || '<div class="ev-line">本局该维度未被重点探测</div>'}</div>
        </div>`;
    }).join('');
  }

  /* 双人缘分区（报告中） */
  function renderCompatSection() {
    const partner = readStore(STORE.partner);
    const box = $('#compat-box');
    if (!partner) {
      box.innerHTML = `
        <p class="muted">还差一本「TA 的说明书」。让 TA 也玩一遍，就能看到你们的行为模式是默契互补、还是需要磨合。</p>
        <button class="btn primary" onclick="App.startPartner()">让 TA 也来测一本 →</button>`;
      return;
    }
    AnalysisService.matchCompatibility(profileJson, partner).then(res => {
      box.innerHTML = `
        <div class="compat-hero">
          <span class="score">${res.score}</span>
          <div><b>${esc(res.verdict)}</b>
          <p class="muted">${esc(res.tip)}</p></div>
        </div>
        <h4>逐维度对照</h4>
        <div class="dim-compare">
          ${res.perDimension.map(p => `
            <div class="cmp-row">
              <span class="cmp-label">${esc(p.label)}</span>
              <span class="cmp-bar"><i style="width:${p.a}%"></i></span><b>${p.a}</b>
              <span class="cmp-bar b"><i style="width:${p.b}%"></i></span><b>${p.b}</b>
              <em>${esc(p.type)}</em>
            </div>`).join('')}
        </div>
        ${res.complementPoints.length ? `<h4>✨ 互补亮点</h4><ul>${res.complementPoints.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        ${res.frictionPoints.length ? `<h4>⚠️ 需要留意的差异</h4><ul>${res.frictionPoints.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
        <button class="btn ghost" onclick="App.showCompat()">查看完整缘分报告</button>`;
    });
  }

  /* 让 TA 玩：清空旧 partner 再进入游戏 */
  function startPartner() {
    try { localStorage.removeItem(STORE.partner); } catch (e) {}
    startGame('partner');
  }

  /* 心元解读刷新 */
  async function refreshXinyuan(scene) {
    const res = await AnalysisService.xinyuanAnalyze(profileJson, scene);
    $('#xinyuan-summary').textContent = res.summary;
    $('#xinyuan-payload').textContent = JSON.stringify(AnalysisService.buildXinyuanPayload(profileJson, scene), null, 2);
    $('#xinyuan-tip').textContent = res.tip || '';
    $('#scene-fate').classList.toggle('active', scene === 'fate');
    $('#scene-companion').classList.toggle('active', scene === 'companionship');
    $('#scene-insight').classList.toggle('active', scene === 'insight');
  }

  /* =====================================================================
   * 双人缘分报告（完整页）
   * ===================================================================== */
  function renderCompat() {
    const me = readStore(STORE.me);
    const partner = readStore(STORE.partner);
    if (!me || !partner) { renderIntro(); show('#screen-intro'); return; }
    show('#screen-compat');
    $('#c-me').textContent = me.nickname || '我';
    $('#c-partner').textContent = partner.nickname || 'TA';

    AnalysisService.matchCompatibility(me, partner).then(res => {
      $('#c-score').textContent = res.score;
      $('#c-verdict').textContent = res.verdict;
      $('#c-tip').textContent = res.tip;
      $('#c-compare').innerHTML = res.perDimension.map(p => `
        <div class="cmp-row">
          <span class="cmp-label">${esc(p.label)}</span>
          <span class="cmp-bar"><i style="width:${p.a}%"></i></span><b>${p.a}</b>
          <span class="cmp-bar b"><i style="width:${p.b}%"></i></span><b>${p.b}</b>
          <em>${esc(p.type)}</em>
        </div>`).join('');
      $('#c-complement').innerHTML = res.complementPoints.length ? res.complementPoints.map(t => `<li>${esc(t)}</li>`).join('') : '<li>暂无显著互补项</li>';
      $('#c-friction').innerHTML = res.frictionPoints.length ? res.frictionPoints.map(t => `<li>${esc(t)}</li>`).join('') : '<li>暂无显著摩擦项</li>';
    });

    // 缘分测量：需手动确认才调用心元 fate 场景
    $('#c-xinyuan').textContent = '点击下方按钮，让心元大模型测量你们的缘分。';
    $('#c-xinyuan-confirm').style.display = '';
  }

  /* 报告页：手动确认后让心元大模型解读我的画像 */
  function confirmXinyuan() {
    $('#xinyuan-confirm').style.display = 'none';
    $('#xinyuan-summary').textContent = '心元正在读懂你的画像…';
    refreshXinyuan('insight');
  }

  /* 双人报告：手动确认后让心元测量缘分 */
  function confirmFate() {
    $('#c-xinyuan-confirm').style.display = 'none';
    $('#c-xinyuan').textContent = '心元正在解读这份缘分的走向…';
    AnalysisService.xinyuanAnalyze(readStore(STORE.me), 'fate').then(r => { $('#c-xinyuan').textContent = r.summary; });
  }

  /* =====================================================================
   * 分享卡
   * ===================================================================== */
  function shareText() {
    const m = manual;
    const name = m.nickname || '我';
    return [
      `📖 《${name} 的恋爱说明书》`,
      `—— ${m.archetype.emoji} ${m.archetype.name} · ${m.archetype.tagline}`,
      ``,
      `${m.archetype.paragraph}`,
      ``,
      `【我的沟通密码】`,
      ...m.communicatePassword.map(t => `· ${t}`),
      ``,
      `【我的关系模式】`,
      ...m.relationshipPattern.map(t => `· ${t}`),
      ``,
      `【我的摩擦预警区】`,
      ...(m.frictionAlerts.length ? m.frictionAlerts : ['暂无显著预警项']).map(t => `· ${t}`),
      ``,
      `—— 来自《恋爱人格剧场》· 30 幕选择，画出这份画像`,
    ].join('\n');
  }

  async function copyShare() {
    const text = shareText();
    try { await navigator.clipboard.writeText(text); alert('已复制到剪贴板，去发给 TA 吧 💌'); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      alert('已复制到剪贴板，去发给 TA 吧 💌');
    }
  }

  /* =====================================================================
   * 雷达图（鸢尾紫 × 陶土金，对齐 App chart 配色）
   * ===================================================================== */
  function drawRadar(canvas, dims, dpr) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width / dpr, H = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2 + 4, R = Math.min(W, H) / 2 - 36;
    const keys = GameEngine.DIMENSIONS, n = keys.length;
    const ang = i => Math.PI * 2 * i / n - Math.PI / 2;

    // 网格环
    for (let ring = 1; ring <= 4; ring++) {
      const r = R * ring / 4;
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const x = cx + r * Math.cos(ang(i)), y = cy + r * Math.sin(ang(i));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'oklch(0.5 0.04 315 / 14%)'; ctx.lineWidth = 1; ctx.stroke();
    }
    // 轴线
    keys.forEach((_, i) => {
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.cos(ang(i)), cy + R * Math.sin(ang(i)));
      ctx.strokeStyle = 'oklch(0.5 0.04 315 / 20%)'; ctx.stroke();
    });
    // 标签
    ctx.fillStyle = 'oklch(0.49 0.025 315)'; ctx.font = '12px "Noto Sans SC","PingFang SC",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    keys.forEach((d, i) => {
      const lx = cx + (R + 22) * Math.cos(ang(i)), ly = cy + (R + 22) * Math.sin(ang(i));
      ctx.fillText(d.label, lx, ly);
    });
    // 数据多边形
    ctx.beginPath();
    keys.forEach((d, i) => {
      const v = (dims[d.key] ?? 50) / 100;
      const x = cx + R * v * Math.cos(ang(i)), y = cy + R * v * Math.sin(ang(i));
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, 'oklch(0.48 0.1 306 / 45%)'); grad.addColorStop(1, 'oklch(0.62 0.1 57 / 35%)');
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = 'oklch(0.48 0.1 306)'; ctx.lineWidth = 2; ctx.stroke();
    // 顶点
    keys.forEach((d, i) => {
      const v = (dims[d.key] ?? 50) / 100;
      const x = cx + R * v * Math.cos(ang(i)), y = cy + R * v * Math.sin(ang(i));
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = 'oklch(0.48 0.1 306)'; ctx.fill();
    });
  }

  /* =====================================================================
   * 对外暴露 + 事件绑定
   * ===================================================================== */
  window.App = {
    start: () => startGame('me'),
    startPartner,
    goBack,
    confirmXinyuan,
    confirmFate,
    copyShare,
    showCompat: () => renderCompat(),
    xinyuan: (scene) => refreshXinyuan(scene),
    refreshCompat: () => renderCompatSection(),
    renderIntro,
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadHostProfile();
    renderIntro();
    Dialogue.bindFastForward($('#dialogue-flow'));
    // 心元场景切换
    document.querySelectorAll('#xinyuan-scenes button').forEach(b => {
      b.addEventListener('click', () => refreshXinyuan(b.dataset.scene));
    });
  });
})();
