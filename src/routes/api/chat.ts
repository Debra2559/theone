import { createFileRoute } from "@tanstack/react-router";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { z } from "zod";
import { getGateway } from "@/lib/ai.server";

type ChatBody = { messages?: unknown; threadId?: unknown; relatedMatchId?: unknown };

async function loadMatchContext(supabase: SupabaseClient, userId: string, matchId: string) {
  if (!matchId) return null;

  const { data: matchRow } = await supabase
    .from("matches")
    .select(
      "score, highlights, relationship_manual, user_id, matched_user_id, personas(nickname, gender, age, city, tagline, tags, manual, bio, avatar)",
    )
    .eq("id", matchId)
    .or(`user_id.eq.${userId},matched_user_id.eq.${userId}`)
    .neq("status", "dismissed")
    .maybeSingle();
  if (!matchRow) return null;

  let persona = matchRow.personas;
  if (!persona) {
    const partnerId = matchRow.user_id === userId ? matchRow.matched_user_id : matchRow.user_id;
    if (!partnerId) return null;
    const [{ data: profile }, { data: manualRow }, { data: results }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", partnerId).maybeSingle(),
      supabase.from("user_manuals").select("content").eq("user_id", partnerId).maybeSingle(),
      supabase.from("test_results").select("test_id, result").eq("user_id", partnerId),
    ]);
    if (!profile) return null;
    persona = {
      ...profile,
      manual: manualRow?.content ?? {},
      testResults: Object.fromEntries((results ?? []).map((item) => [item.test_id, item.result])),
    };
  }

  return {
    match: {
      score: matchRow.score,
      highlights: matchRow.highlights,
      relationship_manual: matchRow.relationship_manual,
    },
    persona,
  };
}

function buildSystemPrompt(input: {
  nickname: string;
  contextType: string;
  situation: string;
  manual: unknown;
  match: unknown;
  persona: unknown;
}): string {
  const base = `你是「狐军师」🦊——「心动说明书」App 里的恋爱军师，一只聪明温暖、有点调皮的小狐狸。

说话风格：
- 用年轻人的口吻，短段落，像朋友聊天，偶尔用 1-2 个 emoji，不说教不鸡汤
- 给出的建议要具体可执行（比如直接给一两句可以发的回复示例、一个具体的约会点子）
- 诚实但温柔，指出问题时不绕弯子也不过度批评
- 回答控制在 300 字以内，结尾可以用一句话追问，引导用户补充更多细节

用户昵称：${input.nickname}`;

  const manualBlock = input.manual
    ? `\n\n用户的个人说明书：\n${JSON.stringify(input.manual)}`
    : "\n\n（用户还没有生成个人说明书，可以建议 TA 先去做测试生成）";

  if (input.match && input.persona) {
    return `${base}${manualBlock}

当前对话主题：用户主动关联了匹配对象「${(input.persona as { nickname?: string }).nickname ?? "TA"}」，现在要讨论你们两个人的事。
对方的资料/说明书：${JSON.stringify(input.persona)}
两人的关系说明书：${JSON.stringify(input.match)}
用户对这段关系/这个人的想法和描述：${input.situation || "（还没说，可以主动问问）"}

你的任务：只围绕这两个人的真实情况回答。结合双方的说明书、测试结果、合拍点、摩擦点和关系报告，分析你们的互动模式，给出具体建议。可以回答「我们适不适合」「为什么会这样」「下一步怎么推进」「第一次见面怎么安排」等问题。当用户发来对方的消息时，先结合双方差异解释，再给出 2-3 个不同风格的回复选项。不要把推测说成事实，也不要泄露与问题无关的对方隐私。`;
  }

  if (input.contextType === "external") {
    return `${base}${manualBlock}

当前对话主题：用户和一个「已经发展到 App 之外（比如微信）」的人之间的关系。
用户对这段关系的描述：${input.situation || "（还没说，可以主动问问）"}

你的任务：这是关系进入真实世界后的陪跑。帮用户分析吵架摩擦、已读不回、忽冷忽热、该不该推进关系、见家长前的紧张等各种真实问题。先共情，再分析可能的原因（给出多种可能性，不要一口咬定），最后给可执行的下一步。`;
  }

  if (input.contextType === "self") {
    return `${base}${manualBlock}

当前对话主题：帮助用户更了解自己。
你的任务：围绕用户的个人说明书聊天——解释结果、回答「我为什么在恋爱里总是…」这类问题、给自我成长的小建议。如果用户补充了新的个人信息或想法，认真记住并在回复里体现理解，同时可以提醒 TA「做完更多测试后可以重新生成更准的说明书」。`;
  }

  return `${base}${manualBlock}

当前对话主题：随便聊聊（恋爱、社交、自我都可以）。
你对这段关系的了解：${input.situation || "无"}
保持轻松，主动引导话题。`;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabaseUrl = process.env["SUPABASE_URL"]!;
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: authHeader } },
        });

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return new Response("Unauthorized", { status: 401 });

        let body: ChatBody;
        try {
          body = (await request.json()) as ChatBody;
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        const messages = body.messages as UIMessage[];
        const threadId = body.threadId as string;
        const relatedMatchIdResult = z
          .string()
          .uuid()
          .nullable()
          .safeParse(body.relatedMatchId ?? null);
        if (!relatedMatchIdResult.success) {
          return new Response("relatedMatchId 格式错误", { status: 400 });
        }
        const relatedMatchId = relatedMatchIdResult.data;
        if (!Array.isArray(messages) || !threadId) {
          return new Response("messages 和 threadId 必填", { status: 400 });
        }

        // 线程归属 + 上下文
        const { data: thread } = await supabase
          .from("counselor_threads")
          .select("*")
          .eq("id", threadId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (!thread) return new Response("对话不存在", { status: 404 });

        const [{ data: profile }, { data: manualRow }, { count: storedCount }] = await Promise.all([
          supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle(),
          supabase.from("user_manuals").select("content").eq("user_id", user.id).maybeSingle(),
          supabase
            .from("counselor_messages")
            .select("id", { count: "exact", head: true })
            .eq("thread_id", threadId),
        ]);

        const matchContext = await loadMatchContext(
          supabase,
          user.id,
          relatedMatchId ?? thread.match_id ?? "",
        );
        const match = matchContext?.match ?? null;
        const persona = matchContext?.persona ?? null;

        // 先落库新增的用户消息（payload 是全量历史，跳过已存的）
        const uiMessages = messages;
        const newOnes = uiMessages.slice(storedCount ?? 0);
        const newUserMsgs = newOnes.filter((m) => m.role === "user");
        if (newUserMsgs.length > 0) {
          const { error: insErr } = await supabase.from("counselor_messages").insert(
            newUserMsgs.map((m) => ({
              thread_id: threadId,
              role: "user",
              parts: m.parts,
            })),
          );
          if (insErr) console.error("保存用户消息失败", insErr);
        }

        const system = buildSystemPrompt({
          nickname: profile?.nickname ?? "朋友",
          contextType: thread.context_type,
          situation: thread.situation ?? "",
          manual: manualRow?.content ?? null,
          match,
          persona,
        });

        const gateway = getGateway();
        const result = streamText({
          model: gateway.responses("openai/gpt-5.6-sol"),
          system,
          messages: await convertToModelMessages(uiMessages),
          providerOptions: { openai: { store: false } },
          abortSignal: request.signal,
        });

        return result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          onFinish: async ({ responseMessage }) => {
            const { error } = await supabase.from("counselor_messages").insert({
              thread_id: threadId,
              role: "assistant",
              parts: responseMessage.parts,
            });
            if (error) console.error("保存助手消息失败", error);
            await supabase
              .from("counselor_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", threadId);
          },
        });
      },
    },
  },
});
