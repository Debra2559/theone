import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { scorePair } from "./match-score";
import { extractManualLike } from "./match.functions";
import type { Database, Json } from "@/integrations/supabase/types";

const tokenInput = z.object({ token: z.string().regex(/^[a-f0-9]{32}$/i) });

function publicSupabase() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Supabase 环境变量未配置");
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(
          typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
        );
        if (init?.headers)
          new Headers(init.headers).forEach((value, name) => headers.set(name, value));
        if (key.startsWith("sb_publishable_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type RelationshipInvitePreview = {
  token: string;
  status: string;
  inviter: { nickname: string; avatar: string } | null;
  matchId: string | null;
};

export const getRelationshipInvite = createServerFn({ method: "GET" })
  .inputValidator((d) => tokenInput.parse(d))
  .handler(async ({ data }) => {
    const { data: invite, error } = await publicSupabase()
      .from("relationship_invites")
      .select("token, status, inviter_nickname, inviter_avatar, match_id")
      .eq("token", data.token)
      .maybeSingle();
    if (error || !invite) throw new Error("这张邀请函不存在或已失效");

    return {
      token: invite.token,
      status: invite.status,
      inviter: { nickname: invite.inviter_nickname, avatar: invite.inviter_avatar },
      matchId: invite.match_id,
    } satisfies RelationshipInvitePreview;
  });

export const createRelationshipInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("nickname, avatar")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: pending } = await context.supabase
      .from("relationship_invites")
      .select("token")
      .eq("inviter_user_id", context.userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pending) return { token: pending.token };

    const { data: invite, error } = await context.supabase
      .from("relationship_invites")
      .insert({
        inviter_user_id: context.userId,
        inviter_nickname: profile?.nickname ?? "一位朋友",
        inviter_avatar: profile?.avatar ?? "db:lorelei:Friend",
      })
      .select("token")
      .single();
    if (error || !invite) throw new Error(error?.message ?? "邀请生成失败");
    return { token: invite.token };
  });

export type AcceptRelationshipInviteResult =
  | { status: "needs_onboarding" }
  | { status: "needs_tests" }
  | { status: "accepted"; matchId: string; score: number };

export const acceptRelationshipInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => tokenInput.parse(d))
  .handler(async ({ data, context }) => {
    const { data: invite, error: inviteError } = await context.supabase
      .from("relationship_invites")
      .select("id, token, inviter_user_id, invitee_user_id, match_id, status")
      .eq("token", data.token)
      .maybeSingle();
    if (inviteError || !invite) throw new Error("这张邀请函不存在或已失效");
    if (invite.inviter_user_id === context.userId) throw new Error("不能用自己的邀请函匹配自己");
    if (invite.status === "revoked") throw new Error("这张邀请函已经失效");
    if (invite.status === "accepted" && invite.invitee_user_id !== context.userId) {
      throw new Error("这张邀请函已经被使用");
    }
    if (invite.status === "accepted" && invite.match_id) {
      const { data: existing } = await context.supabase
        .from("matches")
        .select("id, score")
        .eq("id", invite.match_id)
        .maybeSingle();
      if (existing) return { status: "accepted", matchId: existing.id, score: existing.score };
    }

    const [{ data: me }, { data: myResults }] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase.from("test_results").select("test_id, result").eq("user_id", context.userId),
    ]);
    if (!me?.onboarding_done) return { status: "needs_onboarding" };
    if (!myResults || myResults.length === 0) return { status: "needs_tests" };

    const [{ data: ownMatch }, { data: reverseMatch }] = await Promise.all([
      context.supabase
        .from("matches")
        .select("id, score")
        .eq("user_id", context.userId)
        .eq("matched_user_id", invite.inviter_user_id)
        .maybeSingle(),
      context.supabase
        .from("matches")
        .select("id, score")
        .eq("user_id", invite.inviter_user_id)
        .eq("matched_user_id", context.userId)
        .maybeSingle(),
    ]);
    let matchId = ownMatch?.id ?? reverseMatch?.id;
    let finalScore = ownMatch?.score ?? reverseMatch?.score ?? 0;

    if (!matchId) {
      const { data: newMatch, error: matchError } = await context.supabase
        .from("matches")
        .insert({
          user_id: context.userId,
          matched_user_id: invite.inviter_user_id,
          score: 0,
          highlights: [],
          status: "new",
        })
        .select("id, score")
        .single();
      if (matchError || !newMatch) throw new Error(matchError?.message ?? "关系创建失败");
      matchId = newMatch.id;
    }

    const [{ data: inviter }, { data: inviterResults }, { data: inviterManual }] =
      await Promise.all([
        context.supabase
          .from("profiles")
          .select("*")
          .eq("id", invite.inviter_user_id)
          .maybeSingle(),
        context.supabase
          .from("test_results")
          .select("test_id, result")
          .eq("user_id", invite.inviter_user_id),
        context.supabase
          .from("user_manuals")
          .select("content")
          .eq("user_id", invite.inviter_user_id)
          .maybeSingle(),
      ]);
    if (!inviter) throw new Error("邀请发起人的资料已不存在");

    const myResultMap = Object.fromEntries(
      (myResults ?? []).map((r) => [r.test_id, r.result as { label?: string }]),
    );
    const inviterResultMap = Object.fromEntries(
      (inviterResults ?? []).map((r) => [r.test_id, r.result as { label?: string }]),
    );
    const meLike = extractManualLike(myResultMap, null);
    const inviterLike = extractManualLike(inviterResultMap, inviterManual?.content);
    const { score, highlights } = scorePair(
      inviterLike,
      meLike,
      Boolean(inviter.city && inviter.city === me.city),
      inviterLike.hobbies ?? [],
      meLike.hobbies ?? [],
    );

    finalScore = score;
    const { error: matchUpdateError } = await context.supabase
      .from("matches")
      .update({ score, highlights: highlights as unknown as Json, status: "manual_ready" })
      .eq("id", matchId);
    if (matchUpdateError) throw new Error(matchUpdateError.message);

    const { error: updateError } = await context.supabase
      .from("relationship_invites")
      .update({
        invitee_user_id: context.userId,
        match_id: matchId,
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite.id)
      .eq("status", "pending");
    if (updateError) throw new Error(updateError.message);
    return { status: "accepted", matchId, score: finalScore };
  });
