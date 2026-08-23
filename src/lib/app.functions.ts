import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateJson, buildManualFallback, MANUAL_PROMPT, type ManualContent } from "./ai.server";
import { loveGameAnswersSchema, loveGameResultSchema } from "./love-game-schema";

const testIdSchema = z.enum([
  "mbti",
  "attachment",
  "love-language",
  "needs",
  "element",
  "love-dialogue",
  "zodiac",
  "bazi",
]);

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("profiles")
      .select("*")
      .eq("id", context.userId)
      .maybeSingle();
    return data;
  });

const profileInput = z.object({
  nickname: z.string().min(1).max(20),
  gender: z.string(),
  birth_date: z.string(),
  birth_time: z.string(),
  city: z.string(),
  bio: z.string().max(200),
  avatar: z.string(),
});

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => profileInput.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("profiles")
      .update({
        nickname: data.nickname,
        gender: data.gender,
        birth_date: data.birth_date || null,
        birth_time: data.birth_time,
        city: data.city,
        bio: data.bio,
        avatar: data.avatar,
        onboarding_done: true,
      })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTestResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("test_results")
      .select("*")
      .eq("user_id", context.userId);
    return data ?? [];
  });

export const saveTestResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        test_id: testIdSchema,
        answers: z.record(z.string().min(1).max(80), z.unknown()),
        result: z.record(z.string().min(1).max(80), z.unknown()),
      })
      .refine((data) => JSON.stringify(data.answers).length <= 50_000, "测试答案过大")
      .refine((data) => JSON.stringify(data.result).length <= 50_000, "测试结果过大")
      .superRefine((data, ctx) => {
        if (data.test_id !== "love-dialogue") return;
        if (!loveGameAnswersSchema.safeParse(data.answers).success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["answers"],
            message: "恋爱剧场答案格式无效",
          });
        }
        if (!loveGameResultSchema.safeParse(data.result).success) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["result"],
            message: "恋爱剧场画像格式无效",
          });
        }
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("test_results").upsert(
      {
        user_id: context.userId,
        test_id: data.test_id,
        answers: data.answers as unknown as import("@/integrations/supabase/types").Json,
        result: data.result as unknown as import("@/integrations/supabase/types").Json,
      },
      { onConflict: "user_id,test_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getManual = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_manuals")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    return data;
  });

export const generateManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: profile }, { data: results }] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase.from("test_results").select("*").eq("user_id", context.userId),
    ]);
    if (!results || results.length === 0) {
      throw new Error("先完成至少一个测试，才能生成你的说明书哦");
    }

    const nickname = profile?.nickname ?? "这位朋友";
    const resultMap: Record<string, { label?: string; summary?: string; type?: string }> = {};
    for (const r of results) {
      resultMap[r.test_id] = r.result as { label?: string; summary?: string };
    }
    /* 恋爱人格剧场：完整画像（30 幕选择 + 证据链）太长，蒸馏成 AI 可用的摘要 */
    const DIM_LABELS: Record<string, string> = {
      directness: "沟通直接度",
      sensibility: "感性与共情",
      initiative: "主动性",
      independence: "独立与空间",
      conflict_confront: "冲突直面度",
      future_oriented: "未来导向",
      savings: "金钱规划",
      intimacy: "亲密度需求",
    };
    const loveGame = resultMap["love-dialogue"] as
      | {
          label?: string;
          summary?: string;
          detail?: {
            archetype_name?: string;
            sub_style?: string;
            dimensions?:
              | Array<{ key?: string; label?: string; value?: number; anchor?: string }>
              | Record<string, number>;
            dimensions_detail?: Array<{
              key?: string;
              label?: string;
              value?: number;
              anchor?: string;
            }>;
            communicate_password?: string[];
            relationship_pattern?: string[];
            friction_alerts?: string[];
            hidden_strengths?: string[];
            ideal_partner?: { archetype_name?: string; tagline?: string; match_points?: string[] };
            evidence?: Record<string, Array<{ scene?: string; choice?: string; note?: string }>>;
            stage_stats?: Record<
              string,
              { label?: string; count?: number; dims?: Record<string, number> }
            >;
          };
        }
      | undefined;
    if (loveGame?.detail) {
      const d = loveGame.detail;
      /* 维度列表三态兼容：优先 dimensions_detail（数组），
         其次数组形态 dimensions，最后对象形态 dimensions（Record<key, 0~100>） */
      const dimsList: Array<{ key?: string; label?: string; value?: number; anchor?: string }> =
        d.dimensions_detail ??
        (Array.isArray(d.dimensions)
          ? d.dimensions
          : Object.entries(d.dimensions ?? {}).map(([key, value]) => ({
              key,
              label: DIM_LABELS[key] ?? key,
              value: value as number,
              anchor: "",
            })));
      const dims = dimsList
        .map((x) => `${x.label ?? x.key}=${Math.round(x.value ?? 0)}(${x.anchor ?? ""})`)
        .join("、");
      const evidence = Object.entries(d.evidence ?? {})
        .slice(0, 8)
        .map(([k, ev]) => {
          const first = ev?.[0];
          return first ? `${k}：「${first.choice ?? ""}」——${(first.note ?? "").slice(0, 40)}` : k;
        })
        .join("\n");
      const stages = Object.entries(d.stage_stats ?? {})
        .map(([k, s]) => {
          const dimsBrief = Object.entries(s.dims ?? {})
            .filter(([, v]) => v >= 62 || v <= 38)
            .map(([dk, dv]) => `${dk}${dv}`)
            .join("/");
          return `${s.label ?? k}(${s.count ?? 0}幕${dimsBrief ? `，${dimsBrief}` : ""})`;
        })
        .join("、");
      resultMap["love-dialogue"] = {
        ...loveGame,
        summary: [
          `剧场人格：${d.archetype_name ?? ""}（${d.sub_style ?? ""}）`,
          `八维画像：${dims}`,
          (d.communicate_password ?? []).length
            ? `沟通密码：${(d.communicate_password ?? []).join("；")}`
            : "",
          (d.relationship_pattern ?? []).length
            ? `关系模式：${(d.relationship_pattern ?? []).join("；")}`
            : "",
          (d.friction_alerts ?? []).length
            ? `摩擦预警：${(d.friction_alerts ?? []).join("；")}`
            : "",
          (d.hidden_strengths ?? []).length
            ? `隐藏优点：${(d.hidden_strengths ?? []).join("；")}`
            : "",
          d.ideal_partner?.archetype_name
            ? `理想搭档：${d.ideal_partner.archetype_name}——${d.ideal_partner.tagline ?? ""}`
            : "",
          stages ? `阶段演变：${stages}` : "",
          evidence ? `代表性选择（证据链节选）：\n${evidence}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    // AI 只接收蒸馏摘要；完整画像保留给兜底说明书，不重复进入模型上下文。
    const aiResultMap = {
      ...resultMap,
      ...(resultMap["love-dialogue"]
        ? {
            "love-dialogue": {
              type: resultMap["love-dialogue"].type,
              label: resultMap["love-dialogue"].label,
              summary: resultMap["love-dialogue"].summary,
            },
          }
        : {}),
    };

    let content: ManualContent;
    try {
      content = await generateJson<ManualContent>(
        MANUAL_PROMPT,
        `用户信息：昵称 ${nickname}，性别 ${profile?.gender || "保密"}，城市 ${profile?.city || "未知"}，个人简介「${profile?.bio || "无"}」\n\n测试结果：\n${JSON.stringify(aiResultMap, null, 2)}`,
      );
      if (!content.title || !Array.isArray(content.sections)) throw new Error("bad shape");
    } catch {
      content = buildManualFallback(nickname, resultMap);
    }

    const { error } = await context.supabase
      .from("user_manuals")
      .upsert({ user_id: context.userId, content }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return content;
  });

export const getHomeData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const [{ data: profile }, { data: results }, { data: manual }, { data: matches }] =
      await Promise.all([
        context.supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        context.supabase.from("test_results").select("test_id, result").eq("user_id", uid),
        context.supabase.from("user_manuals").select("user_id").eq("user_id", uid).maybeSingle(),
        context.supabase
          .from("matches")
          .select("id, score, status, created_at, persona_id, personas(nickname, avatar, tagline)")
          .order("created_at", { ascending: false })
          .limit(4),
      ]);
    return {
      profile,
      testCount: results?.length ?? 0,
      testIds: (results ?? []).map((r) => r.test_id),
      hasManual: !!manual,
      matches: matches ?? [],
    };
  });
