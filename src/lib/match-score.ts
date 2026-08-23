// 匹配打分（纯函数，客户端安全）

export type ManualLike = {
  mbti?: string;
  element?: string;
  zodiac?: string;
  attachment?: string;
  loveLanguage?: string;
  needs?: string;
  relationshipGoal?: string;
  communicationStyle?: string;
  relationshipPace?: string;
  hobbies?: string[];
  values?: string[];
  profileCompletion?: number;
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

function similarity(a?: string, b?: string) {
  if (!a || !b) return 50;
  return a === b ? 100 : 35;
}

function jaccard(a: string[] = [], b: string[] = []) {
  const left = new Set(a.filter(Boolean));
  const right = new Set(b.filter(Boolean));
  if (left.size === 0 || right.size === 0) return 45;
  const intersection = [...left].filter((item) => right.has(item)).length;
  const union = new Set([...left, ...right]).size;
  return union === 0 ? 45 : Math.round((intersection / union) * 100);
}

function mbtiSimilarity(a?: string, b?: string) {
  if (!a || !b || a.length < 4 || b.length < 4) return 50;
  let same = 0;
  for (let i = 0; i < 4; i++) if (a[i] === b[i]) same++;
  return [35, 55, 78, 92, 72][same] ?? 50;
}

function relationshipGoalSimilarity(a?: string, b?: string) {
  if (!a || !b) return 50;
  if (a === b) return 100;
  const serious = (value: string) => /结婚|长期|稳定/.test(value);
  const explore = (value: string) => /恋爱|认识|了解|不限/.test(value);
  if ((serious(a) && serious(b)) || (explore(a) && explore(b))) return 76;
  return 35;
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
  const shared = [...new Set([...myTags, ...(me.hobbies ?? [])])].filter((t) =>
    [...new Set([...otherTags, ...(other.hobbies ?? [])])].includes(t),
  );
  const interests = jaccard(myTags, otherTags);
  const goal = relationshipGoalSimilarity(me.relationshipGoal, other.relationshipGoal);
  const conversation = Math.round(
    similarity(me.loveLanguage, other.loveLanguage) * 0.45 +
      similarity(me.communicationStyle, other.communicationStyle) * 0.25 +
      similarity(me.relationshipPace, other.relationshipPace) * 0.15 +
      Math.max(jaccard(me.values, other.values), 45) * 0.15,
  );
  const signals = Math.round(
    (el.pts / 20) * 100 * 0.18 +
      ((mb - 10) / 10) * 100 * 0.34 +
      ((nd.pts - 6) / 9) * 100 * 0.23 +
      ((at.pts - 6) / 9) * 100 * 0.25,
  );
  const exploration =
    me.profileCompletion !== undefined && other.profileCompletion !== undefined
      ? Math.round((me.profileCompletion + other.profileCompletion) / 2)
      : 60;
  const compatibility = Math.round(
    signals * 0.42 +
      interests * 0.16 +
      goal * 0.12 +
      (sameCity ? 100 : 42) * 0.1 +
      conversation * 0.15 +
      exploration * 0.05,
  );
  const confidence = 0.5 + 0.5 * Math.min(1, exploration / 100);
  const score = Math.max(55, Math.min(97, Math.round(50 + (compatibility - 50) * confidence)));

  const highlights: string[] = [];
  if (el.note) highlights.push(el.note);
  if (nd.note && nd.pts >= 11) highlights.push(nd.note);
  if (at.note && at.pts >= 10) highlights.push(at.note);
  if (shared.length > 0) highlights.push(`共同爱好：${shared.slice(0, 3).join("、")}`);
  if (sameCity) highlights.push("同城，适合从低压力见面开始");
  if (me.relationshipGoal && other.relationshipGoal && goal >= 76) {
    highlights.push(`关系目标接近：${other.relationshipGoal}`);
  }
  if (me.needs && other.needs && nd.pts >= 11) {
    highlights.push("亲密电量接近，相处节奏更容易对上");
  }
  if (me.loveLanguage && other.loveLanguage && me.loveLanguage === other.loveLanguage) {
    highlights.push(`爱的语言都是「${me.loveLanguage}」`);
  }

  if (highlights.length === 0) highlights.push("先从彼此都愿意聊的日常开始");
  return { score, highlights: highlights.slice(0, 3) };
}
