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

  /* ---------- 头像节点：图片路径用 <img>，否则用文字/emoji ---------- */
  function avatarNode(avatar) {
    if (avatar && /[/.]/.test(avatar) && /\.(jpe?g|png|webp|gif|svg)$/i.test(avatar)) {
      const img = el('img', 'dlg-avatar dlg-avatar-img');
      img.src = avatar;
      img.alt = 'TA';
      return img;
    }
    return el('span', 'dlg-avatar', avatar || '💬');
  }

  /* ---------- 单条气泡 DOM ---------- */
  function bubbleNode(line, motion) {
    if (line.who === 'narrator') {
      return el('p', 'dlg-narrator', line.text);
    }
    const side = line.who === 'me' ? 'mine' : 'ta';
    const wrap = el('div', `dlg-row ${side}`);
    if (side === 'ta') {
      wrap.appendChild(avatarNode(line.avatar));
    }
    const bubble = el('div', `dlg-bubble motion-${motion || 'pop'}`);
    bubble.appendChild(el('span', 'dlg-text'));
    wrap.appendChild(bubble);
    return wrap;
  }

  /* ---------- 「对方正在输入…」指示气泡 ---------- */
  function typingNode(avatar) {
    const wrap = el('div', 'dlg-row ta dlg-typing-row');
    wrap.appendChild(avatarNode(avatar));
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

  /* ---------- 播一段对话 ---------- */
  async function play(container, lines, opts = {}) {
    const pace = paceOf(opts.pace);
    playing = true;
    skipFlag = false;

    for (const line of (lines || [])) {
      if (line.who === 'ta') {
        // 先弹「正在输入」，停一拍，再换成真实气泡
        const tip = typingNode(line.avatar || opts.taAvatar);
        container.appendChild(tip);
        scrollToBottom(container);
        if (!skipFlag) await wait(pace.typingMs);
        tip.remove();
      }

      const node = bubbleNode(line, pace.motion);
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

  /* ---------- 定格"我的回复"（可选已读回执 + 沉默留白） ---------- */
  async function appendMine(container, text, opts = {}) {
    const node = bubbleNode({ who: 'me', text });
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
