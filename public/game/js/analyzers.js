/* =========================================================================
 * analyzers.js — 分析服务层（预留接口）
 *
 * 这里是"个人说明书报告"对外部分析能力的接入点，两个预留接口：
 *
 *  ① 推荐算法匹配接口  matchCompatibility(profileA, profileB)
 *       → 将来由后端推荐算法实现：传入双方 profile JSON，返回契合度报告
 *       → 当前 demo 模式：本地规则引擎计算（同构返回，方便无缝切换）
 *
 *  ② 心元大模型分析接口  xinyuanAnalyze(profile, scene)
 *       → 面向「情感陪伴」「缘分测量」等场景调用心元大模型 API
 *       → 当前 demo 模式：本地模板生成（保留真实请求所需的完整契约）
 *
 * 切换真实 API 只需：改 config 中的 URL/Key，并替换下方 TODO 分支。
 * 前端消费方不感知差异 —— 返回结构已定义好。
 * ========================================================================= */

const AnalysisService = (() => {

  /* ---------- 配置（对接真实服务时只需改这里） ---------- */
  const config = {
    mode: 'demo', // 'demo' | 'live'

    /* ① 推荐算法匹配：后端服务地址（hackathon 后端 / 自建推荐服务） */
    matchingApiUrl: '/api/v1/match/analyze',
    matchingApiToken: '', // 预留鉴权

    /* ② 心元大模型：情感陪伴 / 缘分测量场景 */
    xinyuan: {
      // TODO: 待确认真实调用地址后替换，并把本文件顶部 mode 切成 'live'
      apiUrl: 'http://127.0.0.1:8010/v1/chat/completions', // 占位：pending 真实 URL
      apiKey: 'sk-hack-7cc4cc45106bca62476f0da77e1e2885',
      model: 'xinyuan-v1',                                 // 心元大模型标识
      scenes: {
        companionship: 'companionship', // 情感陪伴
        fate: 'fate',                   // 缘分测量
        insight: 'insight',             // 人格洞察
      },
    },
  };

  const DIMENSION_KEYS = GameEngine.DIMENSIONS.map(d => d.key);

  /* ---------- ① 推荐算法匹配接口 ---------- */
  /**
   * 输入双方 profile JSON（由 Portrait.toProfileJson 生成），返回契合度报告。
   * demo 模式用规则引擎：逐维度差值的平均反比 = 契合度，并标出互补/一致/摩擦维度。
   */
  async function matchCompatibility(profileA, profileB) {
    if (config.mode === 'live') {
      // TODO(正式接入)：POST config.matchingApiUrl，请求体见下方 buildMatchPayload
      const res = await fetch(config.matchingApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Token': config.matchingApiToken },
        body: JSON.stringify(buildMatchPayload(profileA, profileB)),
      });
      return res.json();
    }

    return new Promise(resolve => setTimeout(() => resolve(ruleBasedMatch(profileA, profileB)), 600));
  }

  /* demo 规则引擎：契合度计算 */
  function ruleBasedMatch(a, b) {
    const perDim = [];
    let totalDiff = 0;
    DIMENSION_KEYS.forEach(key => {
      const va = a.dimensions[key] ?? 50;
      const vb = b.dimensions[key] ?? 50;
      const diff = Math.abs(va - vb);
      totalDiff += diff;
      const dim = GameEngine.dimKey(key);
      perDim.push({
        key,
        label: dim.label,
        a: va, b: vb,
        diff,
        type: diff <= 12 ? '一致' : (diff >= 38 ? '互补' : '温和差异'),
      });
    });

    /* 契合度：差值越小分越高；再叠加 2 个互补维度奖励 + 2 个一致维度奖励 */
    const avgDiff = totalDiff / DIMENSION_KEYS.length;
    let score = Math.round(100 - avgDiff * 1.6);
    const complements = perDim.filter(p => p.type === '互补').length;
    const aligns = perDim.filter(p => p.type === '一致').length;
    score += Math.min(complements, 3) * 2;
    score = Math.max(0, Math.min(99, score));

    const friction = perDim.filter(p => p.diff >= 38).map(p =>
      `${p.label}差异明显（${p.a} vs ${p.b}）：一方偏"${p.a >= 55 ? GameEngine.dimKey(p.key).high : GameEngine.dimKey(p.key).low}"，一方偏"${p.b >= 55 ? GameEngine.dimKey(p.key).high : GameEngine.dimKey(p.key).low}"`);

    const complementText = perDim.filter(p => p.type === '互补').map(p =>
      `${p.label}互补：一个偏"${p.a >= 55 ? GameEngine.dimKey(p.key).high : GameEngine.dimKey(p.key).low}"，一个偏"${p.b >= 55 ? GameEngine.dimKey(p.key).high : GameEngine.dimKey(p.key).low}"，刚好互相补位`);

    let verdict;
    if (score >= 80) verdict = '默契伴侣：你们的行为模式高度同频，相处省力';
    else if (score >= 65) verdict = '潜力情侣：整体契合，个别维度需要用心磨合';
    else if (score >= 50) verdict = '互补拍档：差异是吸引力，也可能是摩擦源，看怎么接';
    else verdict = '磨合挑战：画像差异较大，需要很强的沟通意愿才能走远';

    return {
      engine: 'demo-rules-v1',     // live 时返回后端算法的 engine 名
      score,
      verdict,
      perDimension: perDim,
      complements,
      aligns,
      frictionPoints: friction,
      complementPoints: complementText,
      tip: '以上为 Demo 规则引擎结果。正式版将由推荐算法基于历史匹配数据与心元大模型分析共同得出。',
    };
  }

  /* 发送给匹配接口的请求体（契约定义） */
  function buildMatchPayload(profileA, profileB) {
    return {
      request_id: `match_${Date.now()}`,
      version: 'v1',
      profiles: [profileA, profileB],
      analysis: { dimensions: DIMENSION_KEYS },
    };
  }

  /* ---------- ② 心元大模型分析接口 ---------- */
  /**
   * 场景：情感陪伴 / 缘分测量 / 人格洞察
   * demo 模式：本地模板生成一段"心元解读"，并返回与真实接口一致的契约。
   */
  async function xinyuanAnalyze(profile, scene) {
    if (config.mode === 'live') {
      const res = await fetch(config.xinyuan.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.xinyuan.apiKey}` },
        body: JSON.stringify(buildXinyuanPayload(profile, scene)),
      });
      if (!res.ok) throw new Error(`心元 API 请求失败：HTTP ${res.status}`);
      return normalizeXinyuanResponse(await res.json(), scene);
    }

    return new Promise(resolve => setTimeout(() => resolve(ruleBasedXinyuan(profile, scene)), 700));
  }

  /* 兼容 OpenAI 兼容 / 自定义两种返回结构，统一成 { summary } */
  function normalizeXinyuanResponse(json, scene) {
    const text =
      json?.choices?.[0]?.message?.content ||
      json?.choices?.[0]?.text ||
      json?.summary || json?.result || json?.output || json?.text ||
      (typeof json === 'string' ? json : '');
    return { engine: json?.model || 'xinyuan', scene, summary: String(text), tip: '' };
  }

  /* demo 降级：按场景生成模板化"心元解读" */
  function ruleBasedXinyuan(profile, scene) {
    const d = profile.dimensions;
    const name = profile.nickname || '你';

    const companionText =
      `${name}，根据你在《恋爱时光机》里的行为轨迹，心元这样读懂你：你是一个` +
      (d.sensibility >= 60 ? '情感细腻、感知力很强' : '理性沉稳、边界感清晰') +
      '的人。' +
      (d.intimacy >= 60 ? '你在关系里渴望被回应、被需要，温暖的联结是你情绪的充电站。' :
       d.independence >= 60 ? '你在关系里更需要呼吸感，被充分信任与尊重，比粘腻的陪伴更让你安心。' :
       '你在亲密与独立之间游走，需要一段能让你"进可黏、退可闲"的关系。') +
      (d.conflict_confront <= 40 ? '面对矛盾你倾向于自己消化，记得：真正爱你的人，愿意接住你的坏情绪。' :
       '面对矛盾你敢于直面，这份坦诚是关系里珍贵的底气。');

    const archName = profile.archetype_name || profile.archetype;
    const fateText =
      `缘分视角解读：${name}的画像呈现"${archName}的气质"。你的` +
      (d.sensibility >= 60 ? '共情力' : '安定感') +
      (d.directness >= 60 ? '与直率' : '与分寸') +
      '，会在无形中吸引需要互补的人。' +
      `当前画相对"${profile.archetype}"特质显著，` +
      (d.future_oriented >= 60 ? '与你同频的是重承诺、有规划的人。' : '与你合拍的是随性松弛、能给足空间的人。') +
      '缘分不是玄学，而是两个人在关键时刻的选择高度。';

    const insightText =
      `人格洞察：${name}的核心底色是"${profile.archetype}"。` +
      (d.sensibility >= 60 ? '你容易被情绪牵引，也容易被真诚打动；' : '你不轻易被情绪裹挟，靠判断力做事；') +
      (d.initiative >= 60 ? '你习惯主动推进关系。' : '你更倾向在安全距离里观察，等对方走近。') +
      '认识自己，是经营好任何一段关系的起点。';

    const pool = {
      companionship: { scene: config.xinyuan.scenes.companionship, text: companionText },
      fate:          { scene: config.xinyuan.scenes.fate,          text: fateText },
      insight:       { scene: config.xinyuan.scenes.insight,       text: insightText },
    };
    const item = pool[scene] || pool.insight;

    return {
      engine: 'demo-xinyuan-template-v1',  // live 时返回心元大模型的模型标识
      scene: item.scene,
      summary: item.text,
      tip: '以上为 Demo 模板结果。正式版将由心元大模型基于完整画像生成，用于情感陪伴与缘分测量场景。',
    };
  }

  /* 发送给心元大模型的请求体（契约定义） */
  function buildXinyuanPayload(profile, scene) {
    return {
      model: config.xinyuan.model,
      scene,                                  // companionship | fate | insight
      messages: [
        {
          role: 'system',
          content: '你是心元大模型，擅长情感陪伴与缘分测量，用温暖、克制的语言解读用户画像。',
        },
        { role: 'user', content: JSON.stringify(profile) },
      ],
      temperature: 0.7,
    };
  }

  return {
    config,
    matchCompatibility,
    xinyuanAnalyze,
    buildMatchPayload,
    buildXinyuanPayload,
  };
})();
