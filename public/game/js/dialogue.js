/* =========================================================================
 * dialogue.js — 情景对话渲染器（交互即情绪版）
 *
 *   - Dialogue.play(container, lines, opts)      逐条弹入 TA 气泡 / 旁白
 *     opts.pace: excited | normal | hesitant | cold —— 情绪操纵节奏：
 *       · TA 台词前先弹「对方正在输入…」指示气泡，时长随 pace 变化
 *       · 打字机速度随 pace 变化（犹豫时一字一顿，兴奋时秒回）
 *   - Dialogue.appendMine(container, text, opts) 定格"我的回复"，
 *     opts.readReceipt 时追加「已读」并沉默一拍（cold 场景的留白张力）
 *   - Dialogue.systemDivider(container, text)    微信式时间/场景分割线
 *   - Dialogue.showChoices / hideChoices         底部回复气泡选项
 *   - 点击对话区可快进跳过逐条播放
 *
 * 无外部依赖，挂到 window.Dialogue。
 * ========================================================================= */

const Dialogue = (() => {
  'use strict';

  /* ---------- 情绪节奏表 ---------- */
  const PACES = {
    excited:  { typingMs: 500,  typeSpeed: 24, afterLine: 220, lineGap: 200, motion: 'pop'  },
    normal:   { typingMs: 800,  typeSpeed: 36, afterLine: 300, lineGap: 320, motion: 'pop'  },
    hesitant: { typingMs: 1500, typeSpeed: 62, afterLine: 420, lineGap: 420, motion: 'drop' },
    cold:     { typingMs: 2200, typeSpeed: 80, afterLine: 520, lineGap: 520, motion: 'drop' },
  };
  const READ_RECEIPT_MS = 2300;   // 已读不回的沉默时长

  /* ---------- 选择后果的即时情绪反馈 ----------
   * 由选项权重推导（app.js deriveMood），作用在「对方正在输入」的一拍上：
   * 头像先演（跳动/扭捏/震动/下沉 + 表情浮标弹出），随后气泡按情绪入场：
   *   delight/happy → bounce 跳动（开心）
   *   shy          → wiggle 扭捏（害羞）
   *   neutral      → calm 平静（沉默）
   *   hurt         → drop 砸落（失落）
   *   angry        → shake 大幅震动（生气） */
  const MOOD_FX = {
    delight: { badge: '😍', cls: 'fx-delight', motion: 'bounce', typingExtra: 700 },
    happy:   { badge: '😊', cls: 'fx-happy',   motion: 'bounce', typingExtra: 550 },
    shy:     { badge: '😳', cls: 'fx-shy',     motion: 'wiggle', typingExtra: 600 },
    neutral: { badge: null, cls: '',           motion: 'calm',   typingExtra: 0 },
    hurt:    { badge: '🥺', cls: 'fx-hurt',    motion: 'drop',   typingExtra: 650 },
    angry:   { badge: '😤', cls: 'fx-angry',   motion: 'shake',  typingExtra: 750 },
  };

  let skipFlag = false;
  let playing = false;

  /* ---------- 工具 ---------- */
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const paceOf = name => PACES[name] || PACES.normal;
  const scrollToBottom = (container) => {
    const flow = container.closest('.dialogue-flow') || container;
    flow.scrollTo({ top: flow.scrollHeight, behavior: 'smooth' });
  };

  /* ---------- 头像节点：data URI 或图片路径用 <img>，否则用文字/emoji ---------- */
  function avatarNode(avatar) {
    const isImg = avatar && (
      /^data:image\//i.test(avatar) ||                                   // DiceBear 等内联 data URI
      (/[/.]/.test(avatar) && /\.(jpe?g|png|webp|gif|svg)$/i.test(avatar)) // 文件路径
    );
    if (isImg) {
      const img = el('img', 'dlg-avatar dlg-avatar-img');
      img.src = avatar;
      img.alt = 'TA';
      return img;
    }
    return el('span', 'dlg-avatar', avatar || '💬');
  }

  /* ---------- 单条气泡 DOM（mine 侧带头像，微信式右对齐） ---------- */
  function bubbleNode(line, motion) {
    if (line.who === 'narrator') {
      return el('p', 'dlg-narrator', line.text);
    }
    const side = line.who === 'me' ? 'mine' : 'ta';
    const wrap = el('div', `dlg-row ${side}`);
    const bubble = el('div', `dlg-bubble motion-${motion || 'pop'}`);
    bubble.appendChild(el('span', 'dlg-text'));
    if (side === 'ta') {
      wrap.appendChild(avatarNode(line.avatar));
    }
    wrap.appendChild(bubble);
    if (side === 'mine' && line.avatar) {
      wrap.appendChild(avatarNode(line.avatar));   // DOM 顺序 [气泡, 头像]：默认 row 方向头像自然落在最右
    }
    return wrap;
  }

  /* ---------- 「对方正在输入…」指示气泡（可带情绪头像） ---------- */
  function typingNode(avatar, moodFx) {
    const wrap = el('div', 'dlg-row ta dlg-typing-row');
    if (moodFx) {
      const avWrap = el('div', `dlg-avatar-wrap ${moodFx.cls || ''}`.trim());
      avWrap.appendChild(avatarNode(avatar));
      if (moodFx.badge) avWrap.appendChild(el('span', 'mood-badge', moodFx.badge));
      wrap.appendChild(avWrap);
    } else {
      wrap.appendChild(avatarNode(avatar));
    }
    const bubble = el('div', 'dlg-bubble dlg-typing');
    bubble.innerHTML = '<i></i><i></i><i></i>';
    wrap.appendChild(bubble);
    return wrap;
  }

  /* ---------- 打字机填充 ---------- */
  async function typewrite(span, text, speed) {
    span.textContent = '';
    for (let i = 0; i < text.length; i++) {
      if (skipFlag) { span.textContent = text; return; }
      span.textContent += text[i];
      await wait(speed);
    }
  }

  /* ---------- 独立情绪拍（reaction 全是旁白时，TA 的情绪也要有出口） ---------- */
  async function moodBeat(container, avatar, mood) {
    const fx = MOOD_FX[mood];
    if (!fx || !fx.badge) return;   // neutral 平静：不需要情绪拍
    const wrap = el('div', 'dlg-row ta dlg-typing-row');
    const avWrap = el('div', `dlg-avatar-wrap ${fx.cls}`);
    avWrap.appendChild(avatarNode(avatar));
    avWrap.appendChild(el('span', 'mood-badge', fx.badge));
    wrap.appendChild(avWrap);
    container.appendChild(wrap);
    scrollToBottom(container);
    if (!skipFlag) await wait(1000);
    wrap.remove();
  }

  /* ---------- 播一段对话 ----------
   * opts.reactMood: delight|happy|hurt|angry —— 第一条 TA 台词的
   * 「正在输入」阶段先演一拍情绪（头像动效+表情浮标），气泡按情绪入场；
   * 若本段没有 TA 台词，则在第一条旁白前插入独立情绪拍。 */
  async function play(container, lines, opts = {}) {
    const pace = paceOf(opts.pace);
    const moodFx = opts.reactMood ? MOOD_FX[opts.reactMood] : null;
    let moodBeatUsed = false;
    playing = true;
    skipFlag = false;

    for (const line of (lines || [])) {
      let motion = pace.motion;
      if (line.who === 'narrator' && moodFx && !moodBeatUsed) {
        moodBeatUsed = true;
        await moodBeat(container, opts.taAvatar, opts.reactMood);
      }
      if (line.who === 'ta') {
        // 先弹「正在输入」，停一拍，再换成真实气泡
        const withMood = !!(moodFx && !moodBeatUsed);
        const tip = typingNode(line.avatar || opts.taAvatar, withMood ? moodFx : null);
        container.appendChild(tip);
        scrollToBottom(container);
        if (!skipFlag) await wait(pace.typingMs + (withMood ? moodFx.typingExtra : 0));
        tip.remove();
        if (withMood) { motion = moodFx.motion || motion; moodBeatUsed = true; }
      }

      const node = bubbleNode(line, motion);
      node.classList.add('dlg-enter');
      container.appendChild(node);
      scrollToBottom(container);

      const textSpan = node.querySelector('.dlg-text');
      if (textSpan && line.who === 'ta' && !skipFlag) {
        await typewrite(textSpan, line.text, pace.typeSpeed);
      } else if (textSpan) {
        textSpan.textContent = line.text;
      }

      node.classList.add('dlg-in');
      if (!skipFlag) await wait(pace.afterLine);
      if (!skipFlag && lines.length > 1) await wait(pace.lineGap);
    }

    playing = false;
    skipFlag = false;
  }

  /* ---------- 时间 / 场景分割线（微信式） ---------- */
  function systemDivider(container, text) {
    const node = el('p', 'dlg-system', text);
    container.appendChild(node);
    scrollToBottom(container);
  }

  /* ---------- 渲染选项 ---------- */
  function showChoices(bar, options, onPick) {
    bar.innerHTML = '';
    bar.classList.remove('hidden');
    bar.appendChild(el('p', 'choice-hint', '选择你的回应'));
    const list = el('div', 'choice-list');
    options.forEach((opt, idx) => {
      const btn = el('button', 'choice-bubble');
      btn.innerHTML = `<span class="choice-key">${String.fromCharCode(65 + idx)}</span><span class="choice-text"></span>`;
      btn.querySelector('.choice-text').textContent = opt.text;
      btn.onclick = () => {
        if (playing) return;
        Array.from(list.children).forEach(b => { b.disabled = true; b.classList.add('dim'); });
        btn.classList.remove('dim');
        btn.classList.add('chosen');
        onPick(idx, opt);
      };
      list.appendChild(btn);
    });
    bar.appendChild(list);
  }

  function hideChoices(bar) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
  }

  /* ---------- 手动进入下一幕 ---------- */
  function showNext(bar, label, onNext) {
    bar.innerHTML = '';
    bar.classList.remove('hidden');
    const btn = el('button', 'choice-next', label || '下一幕 →');
    btn.onclick = () => { if (playing) return; onNext(); };
    bar.appendChild(btn);
  }

  /* ---------- 定格"我的回复"（可选已读回执 + 沉默留白 + 我的头像） ---------- */
  async function appendMine(container, text, opts = {}) {
    const node = bubbleNode({ who: 'me', text, avatar: opts.avatar });
    node.classList.add('dlg-enter');
    container.appendChild(node);
    node.querySelector('.dlg-text').textContent = text;
    scrollToBottom(container);
    await wait(60);
    node.classList.add('dlg-in');
    await wait(280);

    if (opts.readReceipt) {
      const receipt = el('p', 'dlg-read', '已读');
      container.appendChild(receipt);
      scrollToBottom(container);
      if (!skipFlag) await wait(READ_RECEIPT_MS);   // 已读不回，沉默即台词
    }
  }

  /* ---------- 快进 ---------- */
  function bindFastForward(flowEl) {
    flowEl.addEventListener('click', () => { if (playing) skipFlag = true; });
  }

  return { play, showChoices, hideChoices, showNext, appendMine, systemDivider, bindFastForward };
})();

window.Dialogue = Dialogue;
