/* =========================================================================
 * portrait.js — 画像生成器
 * 输入：8 维分数 → 输出：
 *   1. 恋爱人格（规则分类器）
 *   2. 沟通密码、关系模式、摩擦预警区、隐形闪光点（维度文本映射）
 *   3. 可序列化的 profile JSON（后续供匹配算法 / 心元大模型调用）
 * ========================================================================= */

const Portrait = (() => {

  /* ---------- 六种恋爱人格 ---------- */
  const ARCHETYPES = {
    romantic_adventurer: {
      name: '浪漫冒险家', emoji: '🌷',
      tagline: '主动炽热，为关系点燃火种的人',
      paragraph: '你热情、直接、愿意为关系冲锋。你相信心动需要经营，主动破冰、制造惊喜、表达亲密对你来说是本能。在感情里你像一团火，靠近的人都会觉得暖。记得给火炉添柴的同时，也留一点风眼，让自己喘口气。',
      strengths: ['擅长破冰，能快速拉近距离', '表达直接，对方不用猜', '愿意为关系投入惊喜与仪式感'],
      frictions: ['主动过头时，可能给对方压迫感', '需要即时回应，对方"已读不回"会放大你的不安', '情绪来得快去得快，需要练习倾听'],
    },
    gentle_empath: {
      name: '温柔共情者', emoji: '🍵',
      tagline: '细腻体贴，先照顾你心情的人',
      paragraph: '你共情力强，说话讲究分寸，总习惯先把对方的感受放在前面。你不擅长说狠话，宁可委屈自己也不愿关系变僵。这种温柔是稀缺的品质，但要记得：你也是值得被照顾的那一个。',
      strengths: ['敏锐察觉对方情绪，相处舒适', '表达委婉，极少主动伤害人', '在关系中稳定、包容、有耐心'],
      frictions: ['太照顾对方，容易压抑自己的需求', '不满往往憋着，直到一次性爆发', '委婉过头，关键时刻对方读不懂你的真实意图'],
    },
    rational_guardian: {
      name: '理性守护者', emoji: '🛡️',
      tagline: '务实稳健，为关系兜底的人',
      paragraph: '你理性、有规划、重承诺。你把关系当成一件需要长期经营的事：计划、资源、责任你都愿意承担。在你身边，对方会觉得安稳、被保护。不过偶尔也记得，感情不只靠逻辑维系，情绪也需要被看见。',
      strengths: ['做事有规划，靠得住', '金钱观健康，能给生活托底', '面对矛盾冷静，能就事论事'],
      frictions: ['理性主导时，对方可能觉得你不近人情', '太讲"应该"，少了点随性与浪漫', '对方需要情感共鸣时，你在分析问题'],
    },
    independent_space: {
      name: '独立空间派', emoji: '🪐',
      tagline: '边界清晰，尊重彼此自由的人',
      paragraph: '你独立、松弛、情绪稳定，相信好的感情是两个完整的个体并肩同行，而非互相捆绑。你不黏人，也不轻易被对方的状态牵着走。这种通透很难得，只是偶尔也透露一点想念，别让独立变成了疏离。',
      strengths: ['情绪稳定，不内耗', '尊重边界，给足对方空间', '遇事不纠缠，能快速翻篇'],
      frictions: ['过于独立，对方可能觉得被冷落', '回避细小的情感联结，亲密感容易稀释', '对方需要你时，你可能觉得"没必要"'],
    },
    action_taker: {
      name: '行动派直球', emoji: '⚡',
      tagline: '有话直说，解决问题第一的人',
      paragraph: '你干脆、果断、目标感强，遇到问题第一反应是"怎么解决"，而不是纠结情绪。你不喜欢模棱两可，说一不二。这种直球在磨合期特别加分，但也要留意：话太冲时，伤害会先于道理被接收。',
      strengths: ['不冷战，有事当场说清', '决策果断，给对方安全感', '把矛盾当课题，能高效推进'],
      frictions: ['言辞直率，无意中会伤到敏感的人', '追求"解决"优先，忽略对方先要"被理解"', '容易和同样强势的人硬碰硬'],
    },
    balanced_coordinator: {
      name: '稳健协调者', emoji: '🤝',
      tagline: '张弛有度，懂得在关系里调频的人',
      paragraph: '你的各项特质比较均衡：能主动也能等待，能讲理也能共情，重当下也不忘未来。你在关系里像个调音师，会根据对方和情境调整自己。这份灵活性让你自带亲和力，也意味着你值得更用心地感受：自己真实需要的是什么。',
      strengths: ['适应力强，跟多数人都能相处', '沟通方式灵活，不走极端', '心态平衡，关系里不容易崩盘'],
      frictions: ['有时为了"和谐"模糊自己的立场', '太均衡也可能被忽略真实偏好', '需要偶尔提醒自己：明确表达也是魅力'],
    },
  };

  /* ---------- 人格分类器 ---------- */
  function classifyArchetype(dims) {
    const d = dims;
    const active = (d.directness + d.initiative + d.conflict_confront) / 3; // 主动直面
    const empathy = d.sensibility;                                          // 感性共情
    const closeness = d.intimacy;                                           // 亲密度需求
    const independence = (d.independence + (100 - d.intimacy)) / 2;         // 独立空间
    const planning = (d.future_oriented + d.savings) / 2;                   // 规划导向

    if (active >= 60 && closeness >= 58) return ARCHETYPES.romantic_adventurer;
    if (empathy >= 58 && d.directness <= 52) return ARCHETYPES.gentle_empath;
    if (planning >= 58 && empathy <= 52) return ARCHETYPES.rational_guardian;
    if (independence >= 58 && closeness <= 50) return ARCHETYPES.independent_space;
    if (active >= 58 && d.directness >= 54) return ARCHETYPES.action_taker;
    return ARCHETYPES.balanced_coordinator;
  }

  /* ---------- 摩擦预警区 / 隐形闪光点 ---------- */
  const FRICTION_RULES = [
    { test: d => d.directness >= 70,          text: '沟通太直，注意语气，对方可能觉得被冒犯' },
    { test: d => d.directness <= 30,          text: '习惯委婉，关键时刻对方读不懂你的真实意图' },
    { test: d => d.conflict_confront <= 35,   text: '倾向回避冲突，情绪容易积压成一次大爆发' },
    { test: d => d.intimacy >= 70,            text: '亲密度需求高，需要即时回应，容易患得患失' },
    { test: d => d.intimacy <= 30,            text: '需要较多独立空间，对方可能觉得被冷落' },
    { test: d => d.savings <= 35,             text: '消费随性，未来可能因金钱观产生摩擦' },
    { test: d => d.future_oriented <= 35,     text: '偏活在当下，可能被对方认为"没有规划感"' },
    { test: d => d.sensibility >= 70,         text: '情绪感知强，容易被小事戳中，需练习区分感受与事实' },
    { test: d => d.independence >= 70,        text: '独立偏好强，记得在依赖与自由之间留出表达关爱的通道' },
  ];

  const STRENGTH_RULES = [
    { test: d => d.initiative >= 65,        text: '主动性强，关系里你总是推动者' },
    { test: d => d.sensibility >= 65,       text: '共情细腻，对方和你相处很舒服' },
    { test: d => d.directness >= 60,        text: '表达直接，对方不用费心猜你的心思' },
    { test: d => d.future_oriented >= 65,   text: '有长远规划，让对方觉得安心' },
    { test: d => d.savings >= 65,           text: '金钱观健康，能把生活过踏实' },
    { test: d => d.conflict_confront >= 60, text: '敢于直面矛盾，不冷战不逃避' },
    { test: d => d.independence >= 60,      text: '独立稳定，不内耗不纠缠' },
    { test: d => d.intimacy >= 60,          text: '愿意表达亲密，感情温度高' },
  ];

  /* ---------- 成长建议：由极端维度触发，给 TA 的「可执行」行动清单 ---------- */
  const GROWTH_RULES = [
    { test: d => d.directness >= 70,        text: '把结论换成邀请：「我建议…你觉得呢」，直率也能很温柔' },
    { test: d => d.directness <= 30,        text: '练习把「随便」换成具体偏好，让对方不用猜你的心意' },
    { test: d => d.conflict_confront <= 35, text: '约一次「不吵架的复盘」，把憋着的话拆成小份说出口' },
    { test: d => d.intimacy >= 70,          text: '把「需要回应」翻译成「我想要…」，给对方可执行的信号' },
    { test: d => d.intimacy <= 30,          text: '每隔几天主动传递一次「想你了」，别让独立变成疏离' },
    { test: d => d.savings <= 35,           text: '设一个共同小目标（比如约会基金），把随性消费变成共同期待' },
    { test: d => d.future_oriented <= 35,   text: '和 TA 聊一次「两年后的我们」，让当下也有方向感' },
    { test: d => d.sensibility >= 70,       text: '区分「感受」与「事实」：先说发生了什么，再安抚情绪' },
    { test: d => d.independence >= 70,      text: '在依赖与自由之间，主动留一条表达关爱的通道' },
  ];

  /* ---------- 沟通密码 / 关系模式 文案 ---------- */
  function communicatePassword(d) {
    const parts = [];
    if (d.directness >= 60) parts.push('我需要直接沟通，别让我猜');
    else if (d.directness <= 40) parts.push('我习惯委婉，请耐心读懂我的言外之意');
    else parts.push('我能直接也能委婉，取决于氛围');

    if (d.sensibility >= 60) parts.push('我容易被细节和情绪打动');
    else if (d.sensibility <= 40) parts.push('我更在乎事情被解决，而不是情绪被安抚');
    else parts.push('道理和感受，我都要');

    if (d.initiative >= 60) parts.push('我愿意先迈出那一步');
    else if (d.initiative <= 40) parts.push('我需要对方给一点信号，才敢靠近');
    else parts.push('我会看情况主动');
    return parts;
  }

  function relationshipPattern(d) {
    const parts = [];
    if (d.intimacy >= 62) parts.push('我需要安全感与被需要');
    else if (d.intimacy <= 40) parts.push('我需要个人空间，亲密要循序渐进');
    else parts.push('我享受亲密，也需要呼吸');

    if (d.independence >= 62) parts.push('我重视自己的独立节奏');
    else if (d.independence <= 40) parts.push('我习惯以关系为中心做决定');
    else parts.push('我能在依赖与独立之间找到平衡');

    if (d.future_oriented >= 60) parts.push('我重视共同成长与长远规划');
    else parts.push('我倾向随遇而安，把当下过好');
    return parts;
  }

  /* ---------- 人格细分：决策偏好 × 关系能量（副标签） ---------- */
  function subStyle(d) {
    const feel = d.sensibility;
    const reason = (d.future_oriented + d.savings) / 2;
    const decide = feel >= reason + 12 ? '情感优先' : (reason >= feel + 12 ? '理性优先' : '情理并重');
    const attach = d.intimacy;
    const space = d.independence;
    const energy = attach >= space + 12 ? '黏合型' : (space >= attach + 12 ? '独立型' : '平衡型');
    return { label: `${decide} · ${energy}`, decide, energy };
  }

  /* ---------- 理想伴侣画像：由我的画像反推「适合我的 TA」 ---------- */
  function idealPartner(d) {
    const points = [];
    if (d.intimacy >= 60) points.push('TA 热情回应、愿意投入高密度陪伴，让你随时感到被需要');
    if (d.intimacy <= 40) points.push('TA 尊重你的空间，不黏人，亲密与独处都让你自在');
    if (d.directness >= 60) points.push('TA 接得住直球，有事当面说清，不玻璃心不冷战');
    if (d.sensibility >= 60) points.push('TA 情感细腻，能接住你的情绪，不急着讲道理');
    if (d.conflict_confront >= 60) points.push('TA 敢直面矛盾，吵架后愿意一起复盘而不是回避');
    if (d.future_oriented >= 60) points.push('TA 同样重视规划，愿意和你把未来一件件落地');
    if (d.savings >= 60) points.push('TA 金钱观健康，钱怎么花能跟你聊到一块');
    if (d.independence >= 60) points.push('TA 情绪稳定、不内耗，给彼此恰到好处的安全感');
    if (points.length < 2) points.push('TA 与你同频又留有余地，相处省力、成长有力');

    /* 伴侣画像：把我的维度向均衡方向收敛一点，再分类出「适合的 TA」人格 */
    const ideal = {};
    GameEngine.DIMENSIONS.forEach(dim => {
      const mine = d[dim.key] ?? 50;
      ideal[dim.key] = Math.max(0, Math.min(100, Math.round(50 + (mine - 50) * 0.62)));
    });
    const arch = classifyArchetype(ideal);
    return {
      archetypeKey: Object.keys(ARCHETYPES).find(k => ARCHETYPES[k] === arch),
      archetypeName: arch.name,
      archetypeEmoji: arch.emoji,
      tagline: arch.tagline,
      points,
    };
  }

  /* ---------- 主入口：生成"个人说明书" ---------- */
  function buildManual(session, dims) {
    const archetype = classifyArchetype(dims);
    const friction = FRICTION_RULES.filter(r => r.test(dims)).map(r => r.text);
    const strength = STRENGTH_RULES.filter(r => r.test(dims)).map(r => r.text);

    return {
      nickname: session.nickname,
      archetype: {
        key: Object.keys(ARCHETYPES).find(k => ARCHETYPES[k] === archetype),
        name: archetype.name,
        emoji: archetype.emoji,
        tagline: archetype.tagline,
        paragraph: archetype.paragraph,
        strengths: archetype.strengths,
        frictions: archetype.frictions,
      },
      dimensions: dims,                       // 0~100 原始分数
      dimensionSummary: GameEngine.dimSummary(dims),
      communicatePassword: communicatePassword(dims),
      relationshipPattern: relationshipPattern(dims),
      frictionAlerts: friction,
      hiddenStrengths: strength,
      growthAdvice: GROWTH_RULES.filter(r => r.test(dims)).map(r => r.text),
      subStyle: subStyle(dims),
      idealPartner: idealPartner(dims),
      answerCount: session.answers.length,
      /* 预留字段：后续由匹配算法 / 心元大模型填充 */
      aiInsight: null,
      compatibility: null,
    };
  }

  /* ---------- 序列化：可下发到分析接口的 profile JSON ---------- */
  function toProfileJson(manual) {
    return {
      schema_version: '1.0',
      nickname: manual.nickname,
      generated_at: new Date().toISOString().slice(0, 19),
      archetype: manual.archetype.key,          // 人格标识（匹配算法消费）
      archetype_name: manual.archetype.name,    // 人格中文名（展示/心元文案消费）
      archetype_emoji: manual.archetype.emoji,
      dimensions: manual.dimensions,
      communicate_password: manual.communicatePassword,
      relationship_pattern: manual.relationshipPattern,
      friction_alerts: manual.frictionAlerts,
      hidden_strengths: manual.hiddenStrengths,
      growth_advice: manual.growthAdvice,
      sub_style: manual.subStyle.label,
      ideal_partner: {
        archetype: manual.idealPartner.archetypeKey,
        archetype_name: manual.idealPartner.archetypeName,
        archetype_emoji: manual.idealPartner.archetypeEmoji,
        tagline: manual.idealPartner.tagline,
        match_points: manual.idealPartner.points,
      },
    };
  }

  return { ARCHETYPES, classifyArchetype, buildManual, toProfileJson };
})();
