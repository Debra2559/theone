import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getGateway } from "@/lib/ai.server";

type ChatBody = { messages?: unknown; threadId?: unknown };

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

  if (input.contextType === "match" && input.persona) {
    return `${base}${manualBlock}

当前对话主题：用户和匹配对象「${(input.persona as { nickname?: string }).nickname ?? "TA"}」之间的事。
对方的资料/说明书：${JSON.stringify(input.persona)}
两人的关系说明书：${JSON.stringify(input.match)}
用户对这段关系/这个人的想法和描述：${input.situation || "（还没说，可以主动问问）"}

你的任务：帮用户读懂这个人、给聊天回复建议、推荐见面时机和活动、分析对方的潜台词。当用户发来对方的消息时，给出 2-3 个不同风格的回复选项（比如：俏皮版/真诚版/推拉版）。`;
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

        let match: unknown = null;
        let persona: unknown = null;
        if (thread.context_type === "match" && thread.match_id) {
          const { data: m } = await supabase
            .from("matches")
            .select("score, highlights, relationship_manual, personas(nickname, gender, age, city, tagline, tags, manual)")
            .eq("id", thread.match_id)
            .maybeSingle();
          if (m) {
            match = { score: m.score, highlights: m.highlights, relationship_manual: m.relationship_manual };
            persona = m.personas;
          }
        }

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
