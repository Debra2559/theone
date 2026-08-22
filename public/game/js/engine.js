/* =========================================================================
 * engine.js — 打分引擎（选择即画像）
 * 8 个画像维度，每个选项对相关维度给出 [-2, +2] 的权重。
 * 游戏结束对每个维度做平均归一化，得到 0~100 的分数。
 * ========================================================================= */

const GameEngine = (() => {
  /* 维度体系：key 用于程序，label 用于展示，low/high 是量表两端的语义 */
  const DIMENSIONS = [
    { key: 'directness',        label: '沟通直接度', low: '委婉含蓄', high: '直来直往' },
    { key: 'sensibility',       label: '感性与共情', low: '理性克制', high: '感性共情' },
    { key: 'initiative',        label: '主动性',     low: '被动等待', high: '主动出击' },
    { key: 'independence',      label: '独立与空间', low: '依赖黏合', high: '独立自主' },
    { key: 'conflict_confront', label: '冲突直面度', low: '回避躲闪', high: '直面沟通' },
    { key: 'future_oriented',   label: '未来导向',   low: '活在当下', high: '长远规划' },
    { key: 'savings',           label: '金钱规划',   low: '随性消费', high: '节俭规划' },
    { key: 'intimacy',          label: '亲密度需求', low: '需要空间', high: '紧密黏合' },
  ];

  const dimKey = (key) => DIMENSIONS.find(d => d.key === key);

  /* 新建一次游戏会话 */
  function createSession(nickname) {
    return {
      nickname: nickname || '',
      answers: [],                        // [{ scenarioId, optionIndex, optionText }]
      sums: Object.fromEntries(DIMENSIONS.map(d => [d.key, 0])),     // 维度加权和
      counts: Object.fromEntries(DIMENSIONS.map(d => [d.key, 0])),   // 维度被探测次数
    };
  }

  /* 做一次选择：累计该选项对各维度的权重 */
  function choose(session, scenarioId, optionIndex) {
    const scenario = SCENARIOS.find(s => s.id === scenarioId);
    if (!scenario) throw new Error(`场景不存在: ${scenarioId}`);
    const option = scenario.options[optionIndex];
    if (!option) throw new Error(`选项不存在: ${scenarioId}[${optionIndex}]`);

    Object.entries(option.weights || {}).forEach(([k, v]) => {
      session.sums[k] += v;
      session.counts[k] += 1;
    });
    session.answers.push({
      scenarioId, optionIndex,
      optionText: option.text,
      insight: option.note,
      weights: option.weights,            // 记录权重，供「返回上一题」撤销计分
    });
    return option;
  }

  /* 撤销最后一次选择：弹出该答案并回退其对各维度的累计（返回上一题用） */
  function undoLast(session) {
    const last = session.answers.pop();
    if (!last) return null;
    Object.entries(last.weights || {}).forEach(([k, v]) => {
      session.sums[k] -= v;
      session.counts[k] -= 1;
    });
    return last;
  }

  /* 归一化：每个维度取平均权重，映射到 0~100（默认 50 为中性） */
  function normalize(session) {
    const dims = {};
    DIMENSIONS.forEach(d => {
      const count = session.counts[d.key];
      const sum = session.sums[d.key];
      const raw = count > 0 ? 50 + (sum / count) * 25 : 50; // ±2 → ±50 分
      dims[d.key] = Math.max(0, Math.min(100, Math.round(raw)));
    });
    return dims;
  }

  /* 把维度分数转成描述性文本，如「沟通直接度 直来直往（78/100）」 */
  function dimSummary(dims) {
    return DIMENSIONS.map(d => ({
      ...d,
      value: dims[d.key],
      anchor: dims[d.key] >= 55 ? d.high : (dims[d.key] <= 45 ? d.low : '均衡'),
    }));
  }

  return { DIMENSIONS, dimKey, createSession, choose, undoLast, normalize, dimSummary };
})();
