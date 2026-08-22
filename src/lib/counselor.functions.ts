import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function extractMessageText(parts: unknown) {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter(
      (part): part is { type?: unknown; text?: unknown } =>
        typeof part === "object" && part !== null,
    )
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join(" ");
}

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("counselor_threads")
      .select("*, matches(id, personas(nickname, avatar))")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    const threads = data ?? [];
    if (threads.length === 0) return [];

    const { data: messages } = await context.supabase
      .from("counselor_messages")
      .select("thread_id, parts, created_at")
      .in(
        "thread_id",
        threads.map((thread) => thread.id),
      )
      .order("created_at", { ascending: false });

    const previews = new Map<string, { text: string; createdAt: string }>();
    for (const message of messages ?? []) {
      if (previews.has(message.thread_id)) continue;
      const text = extractMessageText(message.parts);
      if (text) previews.set(message.thread_id, { text, createdAt: message.created_at });
    }

    return threads.map((thread) => ({
      ...thread,
      preview: previews.get(thread.id)?.text || thread.situation,
      previewAt: previews.get(thread.id)?.createdAt || thread.updated_at,
    }));
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().min(1).max(30),
        context_type: z.enum(["match", "external", "self", "general"]),
        situation: z.string().max(500),
        match_id: z.string().uuid().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("counselor_threads")
      .insert({
        user_id: context.userId,
        title: data.title,
        context_type: data.context_type,
        situation: data.situation,
        match_id: data.match_id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const getThreadData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: thread, error } = await context.supabase
      .from("counselor_threads")
      .select("*, matches(id, personas(nickname, avatar, tagline))")
      .eq("id", data.threadId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !thread) throw new Error("对话不存在");

    const { data: messages } = await context.supabase
      .from("counselor_messages")
      .select("id, role, parts, created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });

    return {
      thread,
      messages: (messages ?? []).map((m) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: m.parts,
      })),
    };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ threadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("counselor_threads")
      .delete()
      .eq("id", data.threadId)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
