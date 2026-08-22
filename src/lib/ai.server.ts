import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";

export function getGateway() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI 服务尚未配置");
  return createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey: key,
    headers: { "Lovable-API-Key": key },
  });
}

// 一次性生成 JSON：内部用流式调用避免长请求被切断，最后聚合文本解析
export async function generateJson<T>(system: string, prompt: string): Promise<T> {
  const gateway = getGateway();
  const result = streamText({
    model: gateway.responses("openai/gpt-5.6-sol"),
    system,
    prompt,
    providerOptions: { openai: { store: false } },
  });
  const text = await result.text;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI 返回格式异常");
  return JSON.parse(match[0]) as T;
}

export type ManualSection = { icon: string; title: string; points: string[] };
export type ManualContent = {
  title: string;
  oneLiner: string;
  badges: string[];
  sections: ManualSection[];
};

// AI 失败时的兜底：用测试原始结果拼装说明书
export function buildManualFallback(
  nickname: string,
  results: Record<string, { label?: string; summary?: string; type?: string }>,
): ManualContent {
  const badges: string[] = [];
  const get = (k: string) => results[k];
  const mbti = get("mbti");
  const attachment = get("attachment");
  const loveLanguage = get("loveLanguage");
  const needs = get("needs");
  const element = get("element");
  const zodiac = get("zodiac");
  if (mbti?.label) badges.push(mbti.label.split(" · ")[0] ?? mbti.label);
  if (attachment?.label) badges.push(attachment.label);
  if (loveLanguage?.label) badges.push(loveLanguage.label);
  if (needs?.label) badges.push(needs.label);
  if (element?.label) badges.push(element.label);
  if (zodiac?.label) badges.push(zodiac.label);

  const sections: ManualSection[] = [
    {
      icon: "🎨",
      title: "性格底色",
      points: [
        mbti?.summary || "多面而独特，等待更多测试来描绘",
        element?.summary ? `四元素气质：${element.label}——${element.summary}` : "完成四元素测试可解锁",
      ],
    },
    {
      icon: "💗",
      title: "恋爱模式",
      points: [
        attachment?.summary ? `依恋类型：${attachment.label}——${attachment.summary}` : "完成依恋测试可解锁",
        loveLanguage?.summary ? `爱的语言：${loveLanguage.label}——${loveLanguage.summary}` : "完成爱的语言测试可解锁",
      ],
    },
    {
      icon: "🔋",
      title: "需求说明",
      points: [
        needs?.summary ? `${needs.label}——${needs.summary}` : "完成高低需求测试可解锁",
      ],
    },
    {
      icon: "🧭",
      title: "相处攻略",
      points: [
        "先从尊重彼此的节奏开始",
        "多做几个测试，这里的建议会越来越准",
      ],
    },
    {
      icon: "💘",
      title: "理想搭档",
      points: ["愿意认真读完这份说明书的人，已经赢了一半"],
    },
  ];

  return {
    title: `《${nickname}使用说明书》`,
    oneLiner: "一个正在被慢慢了解的有趣灵魂",
    badges,
    sections,
  };
}

export const MANUAL_PROMPT = `你是一位温暖又有洞察力的性格分析师，为年轻人恋爱社交 App「心动说明书」撰写「个人使用说明书」。
根据用户的基础信息和各项测试结果，生成一份既准又好玩、像产品说明书一样的个人档案。

要求：
- 用中文，语气年轻、温暖、具体，避免空泛的星座套话
- 每个 points 条目 15-40 字，要具体可感，像朋友的观察而不是报告
- 指出优点，也温柔地指出 1-2 个「注意事项」（雷区/小缺点）
- 严格返回 JSON，不要输出任何其他内容

返回 JSON 结构：
{
  "title": "《昵称使用说明书》",
  "oneLiner": "一句话灵魂速写，20字以内",
  "badges": ["MBTI", "依恋类型", "爱的语言", "需求程度", "元素", "星座"],  // 只包含用户实际测过的
  "sections": [
    {"icon": "🎨", "title": "性格底色", "points": ["3-4条"]},
    {"icon": "💗", "title": "恋爱模式", "points": ["3-4条，综合依恋类型与爱的语言"]},
    {"icon": "🔋", "title": "需求说明", "points": ["2-3条，相处中的电量需求"]},
    {"icon": "⚠️", "title": "注意事项", "points": ["2条，温柔的雷区提醒"]},
    {"icon": "🧭", "title": "相处攻略", "points": ["3条，给未来对象的使用小贴士"]},
    {"icon": "💘", "title": "理想搭档", "points": ["2-3条，什么样的人最适合"]}
  ]
}`;
