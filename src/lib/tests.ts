// 题库与计分逻辑（纯前端安全模块）
// 每个选项的 score 表示它给各个维度加的权重

export type QuizOption = { text: string; score: Record<string, number> };
export type QuizQuestion = { text: string; options: QuizOption[] };
export type TestDef = {
  id: string;
  name: string;
  emoji: string;
  category: "基础测试" | "增值测试";
  desc: string;
  minutes: string;
  kind: "quiz" | "birthday" | "game";
  resultKey: string; // 写入说明书的字段名
  questions: QuizQuestion[];
  // 每个可能结果的展示文案
  results: Record<string, { label: string; summary: string }>;
};

const mbtiResults: Record<string, { label: string; summary: string }> = {};
for (const t of [
  "ENFP", "ENFJ", "ENTP", "ENTJ", "ESFP", "ESFJ", "ESTP", "ESTJ",
  "INFP", "INFJ", "INTP", "INTJ", "ISFP", "ISFJ", "ISTP", "ISTJ",
]) {
  mbtiResults[t] = { label: t, summary: "" };
}

export const TESTS: TestDef[] = [
  {
    id: "mbti",
    name: "MBTI 速测",
    emoji: "🧭",
    category: "基础测试",
    desc: "12 道题，快速定位你的性格坐标",
    minutes: "约 2 分钟",
    kind: "quiz",
    resultKey: "mbti",
    results: mbtiResults,
    questions: [
      { text: "周末最理想的回血方式是——", options: [
        { text: "和朋友约饭逛街剧本杀", score: { E: 1 } },
        { text: "一个人宅家追剧充电", score: { I: 1 } } ] },
      { text: "在陌生聚会上，你通常——", options: [
        { text: "主动开启话题的那个人", score: { E: 1 } },
        { text: "等别人来搭话的那个人", score: { I: 1 } } ] },
      { text: "遇到开心的事，第一反应是——", options: [
        { text: "立刻分享给全世界", score: { E: 1 } },
        { text: "自己先偷着乐一会儿", score: { I: 1 } } ] },
      { text: "你更相信——", options: [
        { text: "眼见为实的细节", score: { S: 1 } },
        { text: "直觉和可能性", score: { N: 1 } } ] },
      { text: "看小说时你更关注——", options: [
        { text: "具体的情节和画面", score: { S: 1 } },
        { text: "背后的隐喻和想象", score: { N: 1 } } ] },
      { text: "做计划时你习惯——", options: [
        { text: "一步一步按流程来", score: { S: 1 } },
        { text: "抓住大方向随缘发挥", score: { N: 1 } } ] },
      { text: "朋友来找你倾诉，你会——", options: [
        { text: "帮 TA 分析问题出在哪", score: { T: 1 } },
        { text: "先接住 TA 的情绪", score: { F: 1 } } ] },
      { text: "做决定时你更看重——", options: [
        { text: "逻辑上对不对", score: { T: 1 } },
        { text: "大家的感受好不好", score: { F: 1 } } ] },
      { text: "吵架之后你更在意——", options: [
        { text: "到底谁有道理", score: { T: 1 } },
        { text: "关系有没有受伤", score: { F: 1 } } ] },
      { text: "旅行前你会——", options: [
        { text: "做好完整攻略再出发", score: { J: 1 } },
        { text: "到了再说，惊喜至上", score: { P: 1 } } ] },
      { text: "你的桌面通常——", options: [
        { text: "井井有条，各就各位", score: { J: 1 } },
        { text: "乱中有序，自己知道", score: { P: 1 } } ] },
      { text: "截止日期前你一般——", options: [
        { text: "提前完成才安心", score: { J: 1 } },
        { text: "最后冲刺效率高", score: { P: 1 } } ] },
    ],
  },
  {
    id: "attachment",
    name: "依恋类型",
    emoji: "🫂",
    category: "基础测试",
    desc: "看看你在亲密关系里是哪种小动物",
    minutes: "约 2 分钟",
    kind: "quiz",
    resultKey: "attachment",
    results: {
      secure: { label: "安全型", summary: "亲密和独立都能拿捏，是关系里的定海神针" },
      anxious: { label: "焦虑型", summary: "爱得很满，也需要被反复确认的爱" },
      avoidant: { label: "疏离型", summary: "自由至上，靠太近会下意识后退半步" },
    },
    questions: [
      { text: "喜欢的人半天没回消息——", options: [
        { text: "TA 应该在忙，等会儿就好", score: { secure: 1 } },
        { text: "是不是我说错什么了…", score: { anxious: 1 } },
        { text: "无所谓，各忙各的", score: { avoidant: 1 } } ] },
      { text: "恋爱中你最害怕的是——", options: [
        { text: "没什么特别怕的", score: { secure: 1 } },
        { text: "对方突然不爱我了", score: { anxious: 1 } },
        { text: "失去自由被绑住", score: { avoidant: 1 } } ] },
      { text: "和伴侣吵架之后——", options: [
        { text: "冷静一下主动沟通", score: { secure: 1 } },
        { text: "立刻想把话说清楚", score: { anxious: 1 } },
        { text: "想一个人静静几天", score: { avoidant: 1 } } ] },
      { text: "对方说「我们需要谈谈」——", options: [
        { text: "好啊，聊聊呗", score: { secure: 1 } },
        { text: "心里咯噔一下", score: { anxious: 1 } },
        { text: "下意识想逃", score: { avoidant: 1 } } ] },
      { text: "你表达爱意的方式是——", options: [
        { text: "自然而然说出口", score: { secure: 1 } },
        { text: "反复确认 TA 也爱我", score: { anxious: 1 } },
        { text: "放在心里，不太会说", score: { avoidant: 1 } } ] },
      { text: "单身久了你会——", options: [
        { text: "享受当下也期待爱情", score: { secure: 1 } },
        { text: "有点焦虑怕遇不到", score: { anxious: 1 } },
        { text: "觉得一个人也挺好", score: { avoidant: 1 } } ] },
      { text: "对方太黏人的时候——", options: [
        { text: "开心接受，挺甜的", score: { secure: 1 } },
        { text: "刚好，我也是这样", score: { anxious: 1 } },
        { text: "需要一点呼吸空间", score: { avoidant: 1 } } ] },
      { text: "深夜 emo 的时候会——", options: [
        { text: "找朋友或伴侣聊聊", score: { secure: 1 } },
        { text: "翻 TA 的朋友圈和动态", score: { anxious: 1 } },
        { text: "自己消化，不麻烦别人", score: { avoidant: 1 } } ] },
    ],
  },
  {
    id: "love-language",
    name: "爱的语言",
    emoji: "💌",
    category: "基础测试",
    desc: "你最想被爱的方式是什么",
    minutes: "约 2 分钟",
    kind: "quiz",
    resultKey: "loveLanguage",
    results: {
      words: { label: "肯定的言语", summary: "「我在乎你」要说出口才算数" },
      time: { label: "精心的时刻", summary: "专注的陪伴是最好的礼物" },
      gifts: { label: "接收礼物", summary: "礼物是心意的实体化" },
      service: { label: "服务的行动", summary: "爱就是做给你看" },
      touch: { label: "身体接触", summary: "一个拥抱胜过千言万语" },
    },
    questions: [
      { text: "最戳你的表白方式是——", options: [
        { text: "一长段掏心窝的话", score: { words: 1 } },
        { text: "包场陪你看一整晚星星", score: { time: 1 } },
        { text: "精心挑选了很久的礼物", score: { gifts: 1 } },
        { text: "默默帮你搞定一堆麻烦", score: { service: 1 } },
        { text: "一个大大的结实的拥抱", score: { touch: 1 } } ] },
      { text: "忙碌一天后最想要——", options: [
        { text: "听 TA 认真说辛苦了", score: { words: 1 } },
        { text: "一起安静吃顿不看手机的饭", score: { time: 1 } },
        { text: "TA 带回家的小蛋糕", score: { gifts: 1 } },
        { text: "发现 TA 已把家务做完", score: { service: 1 } },
        { text: "靠在一起充会儿电", score: { touch: 1 } } ] },
      { text: "纪念日最期待——", options: [
        { text: "一封手写的信", score: { words: 1 } },
        { text: "一次两个人的短途旅行", score: { time: 1 } },
        { text: "一份有纪念意义的礼物", score: { gifts: 1 } },
        { text: "TA 把一切都安排妥当", score: { service: 1 } },
        { text: "手牵手压马路就够", score: { touch: 1 } } ] },
      { text: "难过的时候最治愈的是——", options: [
        { text: "被认真地夸奖肯定", score: { words: 1 } },
        { text: "专注的陪伴和倾听", score: { time: 1 } },
        { text: "突然出现的惊喜小礼物", score: { gifts: 1 } },
        { text: "TA 用实际行动帮忙", score: { service: 1 } },
        { text: "被摸摸头抱一抱", score: { touch: 1 } } ] },
      { text: "你觉得爱最常体现在——", options: [
        { text: "说出口的在意", score: { words: 1 } },
        { text: "愿意花时间陪你", score: { time: 1 } },
        { text: "记住你的喜好", score: { gifts: 1 } },
        { text: "为你做的小事里", score: { service: 1 } },
        { text: "下意识的靠近", score: { touch: 1 } } ] },
      { text: "异地恋最不能少的是——", options: [
        { text: "每天语音说晚安", score: { words: 1 } },
        { text: "定期的视频云约会", score: { time: 1 } },
        { text: "时不时寄来惊喜包裹", score: { gifts: 1 } },
        { text: "TA 帮你点好外卖", score: { service: 1 } },
        { text: "见面时紧紧的拥抱", score: { touch: 1 } } ] },
      { text: "你最常对恋人做的是——", options: [
        { text: "夸 TA，把爱说出口", score: { words: 1 } },
        { text: "安排两个人的共同活动", score: { time: 1 } },
        { text: "送贴心的小礼物", score: { gifts: 1 } },
        { text: "帮 TA 解决实际问题", score: { service: 1 } },
        { text: "黏着 TA 贴贴", score: { touch: 1 } } ] },
      { text: "哪种忽略最让你受伤——", options: [
        { text: "很久没听到一句夸奖", score: { words: 1 } },
        { text: "约会时 TA 总看手机", score: { time: 1 } },
        { text: "忘记重要的日子", score: { gifts: 1 } },
        { text: "答应的事没有做到", score: { service: 1 } },
        { text: "很久没有牵手拥抱", score: { touch: 1 } } ] },
    ],
  },
  {
    id: "needs",
    name: "高低需求",
    emoji: "🔋",
    category: "增值测试",
    desc: "你在恋爱里的「电量需求」有多大",
    minutes: "约 1 分钟",
    kind: "quiz",
    resultKey: "needs",
    results: {
      high: { label: "高需求", summary: "爱要浓烈，需要高频的陪伴和回应" },
      mid: { label: "中需求", summary: "亲密有间，张弛有度最舒服" },
      low: { label: "低需求", summary: "各自精彩，偶尔交汇就很美好" },
    },
    questions: [
      { text: "恋爱后你理想的联系频率——", options: [
        { text: "随时分享日常碎碎念", score: { high: 1 } },
        { text: "每天认真聊一会儿", score: { mid: 1 } },
        { text: "有事再联系就好", score: { low: 1 } } ] },
      { text: "对方晚归没报备——", options: [
        { text: "会问清楚才安心", score: { high: 1 } },
        { text: "提一嘴就好", score: { mid: 1 } },
        { text: "完全 OK，信任至上", score: { low: 1 } } ] },
      { text: "你需要的个人空间——", options: [
        { text: "不多，黏着挺好", score: { high: 1 } },
        { text: "一半一半", score: { mid: 1 } },
        { text: "很多，需要大量独处", score: { low: 1 } } ] },
      { text: "吵架时你需要——", options: [
        { text: "马上哄我马上好", score: { high: 1 } },
        { text: "冷静后好好沟通", score: { mid: 1 } },
        { text: "各自消化再汇合", score: { low: 1 } } ] },
      { text: "仪式感对你来说——", options: [
        { text: "非常重要，必须安排", score: { high: 1 } },
        { text: "偶尔来点就好", score: { mid: 1 } },
        { text: "可有可无", score: { low: 1 } } ] },
      { text: "理想中的相处状态——", options: [
        { text: "形影不离的连体婴", score: { high: 1 } },
        { text: "亲密有间的搭档", score: { mid: 1 } },
        { text: "各自精彩的盟友", score: { low: 1 } } ] },
    ],
  },
  {
    id: "element",
    name: "四元素气质",
    emoji: "🔥",
    category: "增值测试",
    desc: "你的灵魂是火、水、风还是土",
    minutes: "约 1 分钟",
    kind: "quiz",
    resultKey: "element",
    results: {
      fire: { label: "火象", summary: "热情直接，爱就轰轰烈烈" },
      water: { label: "水象", summary: "细腻深情，感受力满格" },
      air: { label: "风象", summary: "灵动有趣，灵魂需要呼吸感" },
      earth: { label: "土象", summary: "踏实温暖，安全感本感" },
    },
    questions: [
      { text: "朋友眼中的你是——", options: [
        { text: "热情似火的行动派", score: { fire: 1 } },
        { text: "温柔细腻的知心人", score: { water: 1 } },
        { text: "古灵精怪的点子王", score: { air: 1 } },
        { text: "踏实靠谱的定心丸", score: { earth: 1 } } ] },
      { text: "面对新事物你会——", options: [
        { text: "冲就完了！", score: { fire: 1 } },
        { text: "先感受一下氛围", score: { water: 1 } },
        { text: "好奇地研究一下", score: { air: 1 } },
        { text: "评估清楚再决定", score: { earth: 1 } } ] },
      { text: "你的情绪像——", options: [
        { text: "火山，来得快去得快", score: { fire: 1 } },
        { text: "海水，深沉又绵长", score: { water: 1 } },
        { text: "微风，自由且善变", score: { air: 1 } },
        { text: "大地，稳定而持久", score: { earth: 1 } } ] },
      { text: "理想的周末是——", options: [
        { text: "来点刺激的冒险", score: { fire: 1 } },
        { text: "治愈系的彻底放松", score: { water: 1 } },
        { text: "社交或学点新东西", score: { air: 1 } },
        { text: "规律充实地度过", score: { earth: 1 } } ] },
      { text: "做决定主要靠——", options: [
        { text: "一腔热血", score: { fire: 1 } },
        { text: "直觉和感受", score: { water: 1 } },
        { text: "理性分析", score: { air: 1 } },
        { text: "实际考量", score: { earth: 1 } } ] },
      { text: "你最不能忍受的是——", options: [
        { text: "无聊", score: { fire: 1 } },
        { text: "冷漠", score: { water: 1 } },
        { text: "束缚", score: { air: 1 } },
        { text: "不靠谱", score: { earth: 1 } } ] },
    ],
  },
  {
    id: "love-dialogue",
    name: "恋爱人格剧场",
    emoji: "🎭",
    category: "增值测试",
    desc: "30 幕沉浸式对话剧情，玩着玩着就画出了你的爱情人格画像",
    minutes: "约 12 分钟",
    kind: "game",
    resultKey: "loveDialogue",
    results: {},
    questions: [],
  },
  {
    id: "zodiac",
    name: "星座档案",
    emoji: "✨",
    category: "增值测试",
    desc: "根据生日生成你的星座与生肖卡",
    minutes: "10 秒",
    kind: "birthday",
    resultKey: "zodiac",
    results: {},
    questions: [],
  },
  {
    id: "bazi",
    name: "八字速览",
    emoji: "☯️",
    category: "增值测试",
    desc: "看看你的年份干支与五行主属性",
    minutes: "10 秒",
    kind: "birthday",
    resultKey: "bazi",
    results: {},
    questions: [],
  },
];

export function getTest(id: string) {
  return TESTS.find((t) => t.id === id);
}

// 计分：返回 { type, label, summary, detail }
export function scoreQuiz(test: TestDef, answers: number[]) {
  const totals: Record<string, number> = {};
  test.questions.forEach((q, i) => {
    const opt = q.options[answers[i] ?? -1];
    if (!opt) return;
    for (const [k, v] of Object.entries(opt.score)) {
      totals[k] = (totals[k] ?? 0) + (v as number);
    }
  });

  if (test.id === "mbti") {
    const type =
      ((totals["E"] ?? 0) >= (totals["I"] ?? 0) ? "E" : "I") +
      ((totals["S"] ?? 0) > (totals["N"] ?? 0) ? "S" : "N") +
      ((totals["T"] ?? 0) > (totals["F"] ?? 0) ? "T" : "F") +
      ((totals["J"] ?? 0) > (totals["P"] ?? 0) ? "J" : "P");
    const info = mbtiInfo[type];
    return {
      type,
      label: `${type} · ${info?.name ?? ""}`,
      summary: info?.desc ?? "",
      detail: totals,
    };
  }

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const winner = sorted[0]?.[0] ?? "";
  const info = test.results[winner];
  return {
    type: winner,
    label: info?.label ?? winner,
    summary: info?.summary ?? "",
    detail: totals,
  };
}

const mbtiInfo: Record<string, { name: string; desc: string }> = {
  ENFP: { name: "竞选者", desc: "热情自由的灵感制造机，走到哪都是气氛担当" },
  ENFJ: { name: "主人公", desc: "天生的温暖领袖，总能照顾到每个人的感受" },
  ENTP: { name: "辩论家", desc: "脑洞大开的点子王，永远有聊不完的新话题" },
  ENTJ: { name: "指挥官", desc: "目标感拉满的行动派，靠谱是他的代名词" },
  ESFP: { name: "表演者", desc: "活在当下的快乐源泉，有 TA 在就不会冷场" },
  ESFJ: { name: "执政官", desc: "体贴周到的照顾者，把身边人都宠成小孩" },
  ESTP: { name: "企业家", desc: "精力充沛的冒险家，永远冲在好玩第一线" },
  ESTJ: { name: "总经理", desc: "秩序与效率的守护者，说一不二的行动派" },
  INFP: { name: "调停者", desc: "内心住着童话世界，温柔而坚定的理想主义者" },
  INFJ: { name: "提倡者", desc: "安静深邃的灵魂捕手，总能看穿别人的心" },
  INTP: { name: "逻辑学家", desc: "好奇心爆棚的思考者，脑子里装着宇宙" },
  INTJ: { name: "建筑师", desc: "理性与远见并存，习惯用行动表达温柔" },
  ISFP: { name: "探险家", desc: "随和的艺术家气质，用感受拥抱世界" },
  ISFJ: { name: "守卫者", desc: "安静温暖的守护者，细节里全是爱" },
  ISTP: { name: "鉴赏家", desc: "冷静的动手能力者，话少但事事靠谱" },
  ISTJ: { name: "物流师", desc: "严谨可靠的实干家，承诺过的事一定做到" },
};

const ZODIAC_SIGNS: [string, number, number][] = [
  ["摩羯座", 1, 19], ["水瓶座", 2, 18], ["双鱼座", 3, 20], ["白羊座", 4, 19],
  ["金牛座", 5, 20], ["双子座", 6, 21], ["巨蟹座", 7, 22], ["狮子座", 8, 22],
  ["处女座", 9, 22], ["天秤座", 10, 23], ["天蝎座", 11, 22], ["射手座", 12, 21],
];

export function computeZodiac(birthDate: string) {
  const d = new Date(birthDate);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  let sign = "摩羯座";
  for (let i = 0; i < ZODIAC_SIGNS.length; i++) {
    const cur = ZODIAC_SIGNS[i];
    const next = ZODIAC_SIGNS[(i + 1) % ZODIAC_SIGNS.length];
    if (!cur || !next) continue;
    const [name, m, dd] = cur;
    const [, nm, nd] = next;
    const after = month > m || (month === m && day >= dd);
    const before = month < nm || (month === nm && day < nd);
    if (after && before) { sign = name; break; }
  }
  const animals = ["鼠", "牛", "虎", "兔", "龙", "蛇", "马", "羊", "猴", "鸡", "狗", "猪"];
  const animal = animals[(d.getFullYear() - 1900) % 12] ?? "";
  const elementMap: Record<string, string> = {
    "白羊座": "火象", "狮子座": "火象", "射手座": "火象",
    "巨蟹座": "水象", "天蝎座": "水象", "双鱼座": "水象",
    "双子座": "风象", "天秤座": "风象", "水瓶座": "风象",
    "金牛座": "土象", "处女座": "土象", "摩羯座": "土象",
  };
  return { sign, animal, element: elementMap[sign] ?? "" };
}

export function computeBazi(birthDate: string) {
  const d = new Date(birthDate);
  const year = d.getFullYear();
  const stems = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
  const branches = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
  const stemElements = ["木", "木", "火", "火", "土", "土", "金", "金", "水", "水"];
  const si = (year - 4) % 10;
  const bi = (year - 4) % 12;
  const pillar = (stems[si] ?? "") + (branches[bi] ?? "");
  const element = stemElements[si] ?? "";
  const elementTrait: Record<string, string> = {
    木: "像树一样向上生长，有韧劲有主张",
    火: "像火一样热烈明亮，感染力十足",
    土: "像大地一样包容稳重，给人安全感",
    金: "像金子一样坚定锋利，原则感强",
    水: "像水一样灵动包容，适应力满分",
  };
  return { year, pillar, element, trait: elementTrait[element] ?? "" };
}
