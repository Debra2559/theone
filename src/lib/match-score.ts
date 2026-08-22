// 匹配打分（纯函数，客户端安全）

export type ManualLike = {
  mbti?: string | undefined;
  element?: string | undefined;
  zodiac?: string | undefined;
  attachment?: string | undefined;
  loveLanguage?: string | undefined;
  needs?: string | undefined;
  hobbies?: string[] | undefined;
  values?: string[] | undefined;
};

const ELEMENT_PAIR: Record<string, string> = {
  "火象|风象": "风助火势，在一起永远不缺新鲜感",
  "水象|土象": "水土相融，能给彼此刚刚好的安全感",
  "火象|火象": "双火奔赴，热烈指数拉满",
  "水象|水象": "深海共鸣，情绪都被稳稳接住",
  "风象|风象": "灵魂同频，聊到天亮也不腻",
  "土象|土象": "稳稳的幸福，一起把日子过好",
};

function elementScore(a?: string, b?: string): { pts: number; note?: string } {
  if (!a || !b) return { pts: 10 };
  const key1 = `${a}|${b}`;
  const key2 = `${b}|${a}`;
  if (ELEMENT_PAIR[key1]) return { pts: 20, note: ELEMENT_PAIR[key1] };
  if (ELEMENT_PAIR[key2]) return { pts: 20, note: ELEMENT_PAIR[key2] };
  return { pts: 12 };
}

function mbtiScore(a?: string, b?: string): number {
  if (!a || !b || a.length !== 4 || b.length !== 4) return 10;
  let same = 0;
  for (let i = 0; i < 4; i++) if (a[i] === b[i]) same++;
  // 2-3 个字母相同最来电
  return same === 3 ? 20 : same === 2 ? 18 : same === 4 ? 14 : 12;
}

function needsScore(a?: string, b?: string): { pts: number; note?: string } {
  if (!a || !b) return { pts: 8 };
  if (a === b) return { pts: 15, note: `都是${a}，节奏天生同步` };
  if ((a === "高需求" && b === "低需求") || (a === "低需求" && b === "高需求")) {
    return { pts: 6, note: "需求节奏不同，需要多沟通" };
  }
  return { pts: 11 };
}

function attachmentScore(a?: string, b?: string): { pts: number; note?: string } {
  if (!a || !b) return { pts: 8 };
  if (a === "安全型" || b === "安全型") return { pts: 15, note: "有一方是安全型，关系底座很稳" };
  if (a === b) return { pts: 10 };
  return { pts: 6, note: "依恋模式需要磨合，磨合好会很深" };
}

export function scorePair(
  me: ManualLike,
  other: ManualLike,
  sameCity: boolean,
  myTags: string[],
  otherTags: string[],
): { score: number; highlights: string[] } {
  const el = elementScore(me.element, other.element);
  const mb = mbtiScore(me.mbti?.slice(0, 4), other.mbti?.slice(0, 4));
  const nd = needsScore(me.needs, other.needs);
  const at = attachmentScore(me.attachment, other.attachment);

  const shared = myTags.filter((t) => otherTags.includes(t));
  const hobbyPts = Math.min(shared.length * 5, 15);

  let score = 22 + el.pts + mb + nd.pts + at.pts + hobbyPts;
  if (sameCity) score += 5;
  score = Math.max(58, Math.min(97, Math.round(score)));

  const highlights: string[] = [];
  if (el.note) highlights.push(el.note);
  if (nd.note && nd.pts >= 11) highlights.push(nd.note);
  if (at.note && at.pts >= 10) highlights.push(at.note);
  if (shared.length > 0) highlights.push(`共同爱好：${shared.slice(0, 3).join("、")}`);
  if (sameCity) highlights.push("同城，见面零门槛");
  if (me.loveLanguage && other.loveLanguage && me.loveLanguage === other.loveLanguage) {
    highlights.push(`爱的语言都是「${me.loveLanguage}」`);
  }

  return { score, highlights: highlights.slice(0, 3) };
}
