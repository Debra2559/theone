import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateJson } from "./ai.server";
import { scorePair, type ManualLike } from "./match-score";
import { fetchHackathonMatchData, type HackathonPerson } from "./hackathon-match.functions";
import type { Json } from "@/integrations/supabase/types";

// 关系说明书的固定结构（可序列化）
type RelationshipManual = {
  title: string;
  verdict: string;
  chemistry: string[];
  friction: string[];
  playbook: string[];
  firstDates: { name: string; why: string }[];
  meetSignal: string;
};

// 从测试结果/说明书里提取用于打分的画像
export function extractManualLike(
  resultMap: Record<string, { label?: string }>,
  manualContent: unknown,
): ManualLike {
  const c = (manualContent ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  return {
    mbti: (resultMap["mbti"]?.label ?? str(c["mbti"]) ?? "").slice(0, 4) || str(c["mbti"]),
    element: resultMap["element"]?.label ?? str(c["element"]),
    zodiac: resultMap["zodiac"]?.label ?? str(c["zodiac"]),
    attachment: resultMap["attachment"]?.label ?? str(c["attachment"]),
    loveLanguage: resultMap["loveLanguage"]?.label ?? str(c["loveLanguage"]),
    needs: resultMap["needs"]?.label ?? str(c["needs"]),
    relationshipGoal: str(c["goal"]) ?? str(c["relationshipGoal"]),
    communicationStyle: str(c["communicationStyle"]),
    relationshipPace: str(c["relationshipPace"]),
    hobbies: arr(c["hobbies"]),
    values: arr(c["values"]),
    profileCompletion:
      Object.values(c).filter((value) => {
        if (typeof value === "string") return value.trim().length > 0;
        return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined;
      }).length > 4
        ? 100
        : 65,
  };
}

type CandidatePersona = {
  id: string;
  nickname: string;
  gender: string;
  age: number;
  city: string;
  avatar: string;
  tagline: string;
  tags: Json;
  manual: Json;
  bio?: string;
};

function profileField(profile: string, label: string) {
  const line = profile.split("\n").find((item) => item.trim().startsWith(`- ${label}:`));
  return line?.split(":").slice(1).join(":").trim() ?? "";
}

function profileSection(profile: string, heading: string) {
  const match = profile.match(new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`));
  return match?.[1]?.trim() ?? "";
}

function zodiacElement(zodiac: string) {
  if (["白羊座", "狮子座", "射手座"].some((item) => zodiac.includes(item))) return "火象";
  if (["双子座", "天秤座", "水瓶座"].some((item) => zodiac.includes(item))) return "风象";
  if (["巨蟹座", "天蝎座", "双鱼座"].some((item) => zodiac.includes(item))) return "水象";
  if (["金牛座", "处女座", "摩羯座"].some((item) => zodiac.includes(item))) return "土象";
  return undefined;
}

function normalizeGender(gender: string) {
  if (gender === "男" || gender === "male") return "male";
  if (gender === "女" || gender === "female") return "female";
  return gender;
}

function normalizeDatabasePersona(persona: CandidatePersona): CandidatePersona {
  const manual =
    persona.manual && typeof persona.manual === "object" && !Array.isArray(persona.manual)
      ? (persona.manual as Record<string, unknown>)
      : {};
  const tags = Array.isArray(persona.tags) ? persona.tags : [];
  const oneLiner = typeof manual["oneLiner"] === "string" ? manual["oneLiner"] : "";
  return {
    ...persona,
    gender: normalizeGender(persona.gender),
    tags,
    bio: persona.bio || oneLiner || persona.tagline,
  };
}

function personToPersona(person: HackathonPerson, index: number): CandidatePersona {
  const selfIntro = profileSection(person.profile, "关于我")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .trim();
  const hobbySection = profileSection(person.profile, "兴趣爱好");
  const tags = [...hobbySection.matchAll(/`([^`]+)`/g)].map((match) => match[1]!.trim());
  const zodiac = profileField(person.profile, "星座");
  const mbti = person.memories_self
    .join(" ")
    .match(/\b[EI][NS][TF][JP]\b/i)?.[0]
    ?.toUpperCase();
  const cityParts = profileField(person.profile, "居住地")
    .split(",")
    .map((item) => item.trim());
  const city =
    cityParts.length > 1 ? cityParts.at(-2) || cityParts.at(-1) || "未知" : cityParts[0] || "未知";
  const gender =
    person.gender === "男" ? "male" : person.gender === "女" ? "female" : person.gender;
  const age = Number(profileField(person.profile, "年龄").match(/\d+/)?.[0] ?? 0);
  const tagline =
    selfIntro
      .split(/[。！？\n]/)
      .find(Boolean)
      ?.trim() || "一位值得慢慢了解的人";

  return {
    id: `a0000000-0000-4000-8000-${String(index + 101).padStart(12, "0")}`,
    nickname: person.nickname,
    gender,
    age,
    city,
    avatar: `db:${gender === "female" ? "lorelei" : "micah"}:${person.nickname}`,
    tagline: tagline.slice(0, 48),
    tags,
    manual: {
      mbti,
      zodiac,
      element: zodiacElement(zodiac),
      hobbies: tags,
      oneLiner: selfIntro.slice(0, 180),
      idealMatch: profileSection(person.profile, "关于我们").slice(0, 240),
    },
    bio: selfIntro.slice(0, 320),
  };
}

export const getMatchCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const [
      { data: profile },
      { data: results },
      { data: manualRow },
      { data: personas },
      { data: existing },
    ] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      context.supabase.from("test_results").select("test_id, result").eq("user_id", uid),
      context.supabase.from("user_manuals").select("content").eq("user_id", uid).maybeSingle(),
      context.supabase.from("personas").select("*"),
      context.supabase.from("matches").select("id, persona_id, status").eq("user_id", uid),
    ]);

    const resultMap: Record<string, { label?: string }> = {};
    for (const r of results ?? []) resultMap[r.test_id] = r.result as { label?: string };
    const me = extractManualLike(resultMap, manualRow?.content);
    const myCity = profile?.city ?? "";
    const myTags = me.hobbies ?? [];
    const matchedIds = new Map(
      (existing ?? [])
        .filter((m) => m.persona_id && m.status !== "dismissed")
        .map((m) => [m.persona_id as string, m.id]),
    );

    const myGender = profile?.gender;
    let pool = ((personas ?? []) as CandidatePersona[]).map(normalizeDatabasePersona);
    let source: "database" | "live" = "database";

    if (pool.length === 0) {
      try {
        const liveMatch = await fetchHackathonMatchData();
        const people = [liveMatch.user_a, liveMatch.user_b];
        pool = people
          .filter((person) => person.nickname !== profile?.nickname)
          .map((person, index) => personToPersona(person, index));
        source = "live";
      } catch (error) {
        console.error("[Match] 无法加载实时候选", error);
      }
    }

    const oppositeGenderPool = pool.filter((p) =>
      myGender === "female"
        ? p.gender === "male"
        : myGender === "male"
          ? p.gender === "female"
          : true,
    );
    if (oppositeGenderPool.length > 0) pool = oppositeGenderPool;
    const candidates = pool.map((p) => {
      const pm = (p.manual ?? {}) as ManualLike;
      const tags = Array.isArray(p.tags) ? (p.tags as string[]) : [];
      const { score, highlights } = scorePair(me, pm, !!myCity && p.city === myCity, myTags, tags);
      return {
        persona: p,
        score,
        highlights,
        matched: matchedIds.has(p.id),
        matchId: matchedIds.get(p.id) ?? null,
        source,
      };
    });

    candidates.sort((a, b) => b.score - a.score);
    return { candidates, hasData: (results ?? []).length > 0, source };
  });

export const createMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        personaId: z.string().uuid(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const [{ data: profile }, { data: results }, { data: manualRow }, { data: persona }] =
      await Promise.all([
        context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
        context.supabase
          .from("test_results")
          .select("test_id, result")
          .eq("user_id", context.userId),
        context.supabase
          .from("user_manuals")
          .select("content")
          .eq("user_id", context.userId)
          .maybeSingle(),
        context.supabase.from("personas").select("*").eq("id", data.personaId).maybeSingle(),
      ]);
    if (!persona) throw new Error("推荐对象不存在");
    const resultMap: Record<string, { label?: string }> = {};
    for (const result of results ?? [])
      resultMap[result.test_id] = result.result as { label?: string };
    const me = extractManualLike(resultMap, manualRow?.content);
    const candidate = normalizeDatabasePersona(persona as CandidatePersona);
    const candidateManual = (candidate.manual ?? {}) as ManualLike;
    const candidateTags = Array.isArray(candidate.tags) ? (candidate.tags as string[]) : [];
    const { score, highlights } = scorePair(
      me,
      candidateManual,
      Boolean(profile?.city && profile.city === candidate.city),
      me.hobbies ?? [],
      candidateTags,
    );
    const { data: existing } = await context.supabase
      .from("matches")
      .select("id")
      .eq("user_id", context.userId)
      .eq("persona_id", data.personaId)
      .maybeSingle();
    if (existing) return { id: existing.id };

    const { data: row, error } = await context.supabase
      .from("matches")
      .insert({
        user_id: context.userId,
        persona_id: data.personaId,
        score,
        highlights,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const listMyMatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("matches")
      .select(
        "id, score, highlights, status, created_at, user_id, matched_user_id, persona_id, personas(nickname, avatar, tagline, age, city, bio, tags, manual)",
      )
      .or(`user_id.eq.${context.userId},matched_user_id.eq.${context.userId}`)
      .neq("status", "dismissed")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const partnerIds = rows
      .filter((row) => !row.personas)
      .map((row) => (row.user_id === context.userId ? row.matched_user_id : row.user_id))
      .filter((id): id is string => Boolean(id));
    const { data: profiles } = partnerIds.length
      ? await context.supabase
          .from("profiles")
          .select("id, nickname, avatar, bio, city")
          .in("id", partnerIds)
      : { data: [] };
    const partners = new Map((profiles ?? []).map((profile) => [profile.id, profile]));

    return rows.flatMap((row) => {
      const partnerId = row.user_id === context.userId ? row.matched_user_id : row.user_id;
      const person = row.personas ?? (partnerId ? partners.get(partnerId) : null);
      if (!person) return [];
      return [
        {
          id: row.id,
          score: row.score,
          highlights: Array.isArray(row.highlights) ? row.highlights : [],
          status: row.status,
          createdAt: row.created_at,
          person: {
            nickname: person.nickname,
            avatar: person.avatar,
            tagline: "tagline" in person ? person.tagline : person.bio,
            city: person.city,
          },
        },
      ];
    });
  });

export const getMatch = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: match, error } = await context.supabase
      .from("matches")
      .select("*, personas(*)")
      .eq("id", data.matchId)
      .maybeSingle();
    if (error || !match) throw new Error("匹配不存在");
    if (match.user_id !== context.userId && match.matched_user_id !== context.userId) {
      throw new Error("无权查看");
    }
    const partnerId = match.user_id === context.userId ? match.matched_user_id : match.user_id;
    if (!partnerId) return { ...match, partner_profile: null };
    const { data: partnerProfile } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", partnerId)
      .maybeSingle();
    return { ...match, partner_profile: partnerProfile };
  });

const REL_PROMPT = `你是「心动说明书」的关系分析师。根据两个人的个人说明书，生成一份好玩的「关系说明书」，帮两个正在互相了解的年轻人看懂彼此。

要求：
- 中文，语气像他们俩的损友兼军师，温暖具体，不说教
- 每条 15-45 字，必须结合两人的具体信息，拒绝套话
- 严格返回 JSON

返回结构：
{
  "title": "《A × B 的关系说明书》",
  "verdict": "一句话关系速写，25字以内",
  "chemistry": ["3-4条化学反应/为什么互相吸引"],
  "friction": ["2-3条潜在摩擦点，温柔但诚实"],
  "playbook": ["3-4条相处攻略，具体可执行"],
  "firstDates": [{"name": "约会点子", "why": "为什么适合你们俩，一句话"}, {"name": "...", "why": "..."}, {"name": "...", "why": "..."}],
  "meetSignal": "关于是否可以见面的建议，结合两人依恋类型和需求程度，2-3句话"
}`;

export const generateRelationshipManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ matchId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: match, error } = await context.supabase
      .from("matches")
      .select("*, personas(*)")
      .eq("id", data.matchId)
      .single();
    if (error || !match) throw new Error("匹配不存在");
    if (match.user_id !== context.userId && match.matched_user_id !== context.userId) {
      throw new Error("无权操作");
    }

    type Profile = {
      nickname: string;
      gender: string;
      age?: number;
      city: string;
      tagline?: string;
      avatar: string;
      bio: string;
    };
    const readUser = async (userId: string) => {
      const [{ data: profile }, { data: manualRow }, { data: results }] = await Promise.all([
        context.supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        context.supabase.from("user_manuals").select("content").eq("user_id", userId).maybeSingle(),
        context.supabase.from("test_results").select("test_id, result").eq("user_id", userId),
      ]);
      return { profile, manual: manualRow?.content ?? {}, results: results ?? [] };
    };

    const a = await readUser(match.user_id);
    const aProfile = a.profile as Profile | null;
    let bProfile: Profile;
    let bManual: unknown;
    let bResults: typeof a.results;
    if (match.matched_user_id) {
      const b = await readUser(match.matched_user_id);
      if (!b.profile) throw new Error("匹配对象资料不完整");
      bProfile = b.profile as Profile;
      bManual = b.manual;
      bResults = b.results;
    } else {
      if (match.user_id !== context.userId) throw new Error("无权操作");
      const persona = match.personas as unknown as {
        nickname: string;
        gender: string;
        age: number;
        city: string;
        tagline: string;
        tags: unknown;
        manual: unknown;
        avatar: string;
        bio?: string;
      };
      bProfile = { ...persona, bio: persona.bio ?? "" };
      bManual = persona.manual ?? {};
      bResults = [];
    }

    const aResultMap = Object.fromEntries(
      a.results.map((r) => [r.test_id, r.result as { label?: string }]),
    );
    const bResultMap = Object.fromEntries(
      bResults.map((r) => [r.test_id, r.result as { label?: string }]),
    );
    const aLike = extractManualLike(aResultMap, a.manual);
    const bLike = extractManualLike(bResultMap, bManual);

    const describe = (person: Profile, manual: unknown, results: typeof a.results) =>
      `${person.nickname}，${person.gender || "保密"}，${person.age ? `${person.age}岁，` : ""}${person.city || "未知"}，「${person.tagline || person.bio || "一位值得了解的人"}」\n个人说明书：${JSON.stringify(manual ?? {})}\n测试速览：${JSON.stringify(Object.fromEntries(results.map((r) => [r.test_id, r.result])))}`;

    let manual: RelationshipManual;
    try {
      const ai = await generateJson<RelationshipManual>(
        REL_PROMPT,
        `A：${describe(aProfile ?? { nickname: "你", gender: "", city: "", avatar: "", bio: "" }, a.manual, a.results)}\n\nB：${describe(bProfile, bManual, bResults)}`,
      );
      if (!ai.title || !Array.isArray(ai.chemistry)) throw new Error("bad shape");
      manual = ai;
    } catch {
      const aName = aProfile?.nickname ?? "你";
      manual = {
        title: `《${aName} × ${bProfile.nickname} 的关系说明书》`,
        verdict: "一段值得慢慢了解的关系",
        chemistry: (match.highlights as string[] | null) ?? ["合拍指数不错，值得深入了解"],
        friction: ["还在了解阶段，多聊聊才知道"],
        playbook: ["保持好奇，多问开放式问题", "分享日常是拉近距离的最快方式"],
        firstDates: [
          { name: "咖啡馆闲聊", why: "低门槛零压力，适合第一次见面的你们" },
          { name: "城市散步", why: "边走边聊，节奏刚刚好" },
        ],
        meetSignal: "如果线上聊得投机，一周左右就可以考虑见个面啦。",
      };
    }

    const { error: upErr } = await context.supabase
      .from("matches")
      .update({ relationship_manual: manual as unknown as Json, status: "manual_ready" })
      .eq("id", data.matchId);
    if (upErr) throw new Error(upErr.message);
    return manual;
  });
