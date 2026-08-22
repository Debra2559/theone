import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateJson, buildManualFallback, MANUAL_PROMPT, type ManualContent } from "./ai.server";

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
        test_id: z.string(),
        answers: z.record(z.string(), z.unknown()),
        result: z.record(z.string(), z.unknown()),
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

    let content: ManualContent;
    try {
      content = await generateJson<ManualContent>(
        MANUAL_PROMPT,
        `用户信息：昵称 ${nickname}，性别 ${profile?.gender || "保密"}，城市 ${profile?.city || "未知"}，个人简介「${profile?.bio || "无"}」\n\n测试结果：\n${JSON.stringify(resultMap, null, 2)}`,
      );
      if (!content.title || !Array.isArray(content.sections)) throw new Error("bad shape");
    } catch {
      content = buildManualFallback(nickname, resultMap);
    }

    const { error } = await context.supabase.from("user_manuals").upsert(
      { user_id: context.userId, content },
      { onConflict: "user_id" },
    );
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
