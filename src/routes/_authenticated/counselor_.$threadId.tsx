import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import { ArrowLeft } from "@/components/app-icons";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/app.functions";
import { getThreadData } from "@/lib/counselor.functions";
import { AppShell, RouteError } from "@/components/app-shell";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import foxImg from "@/assets/fox.png";

export const Route = createFileRoute("/_authenticated/counselor_/$threadId")({
  head: () => ({
    meta: [
      { title: "军师对话 · 心动说明书" },
      { name: "description", content: "和狐军师聊聊你的恋爱问题。" },
      { property: "og:title", content: "军师对话 · 心动说明书" },
      { property: "og:description", content: "和狐军师聊聊你的恋爱问题。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ params }) => {
    const profile = await getMyProfile();
    if (!profile?.onboarding_done) throw redirect({ to: "/onboarding" });
    return getThreadData({ data: { threadId: params.threadId } });
  },
  errorComponent: RouteError,
  component: CounselorChat,
});

const STARTERS: Record<string, string[]> = {
  self: ["我的说明书里最准的是哪条？", "我在恋爱里最容易踩的坑是什么？", "做完其他测试会有哪些变化？"],
  match: ["帮我想个自然的聊天开场白", "TA 说什么话代表对我有好感？", "什么时候约 TA 见面比较好？"],
  external: ["TA 已读不回，怎么办？", "我们吵架了，帮我分析一下", "这段关系该不该继续推进？"],
  general: ["怎么自然地开启聊天？", "第一次见面去哪里好？", "我适合什么样的人？"],
};

function CounselorChat() {
  const { thread, messages: initialMessages } = Route.useLoaderData();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession();
          return {
            ...(data.session?.access_token
              ? { Authorization: `Bearer ${data.session.access_token}` }
              : {}),
            "X-Thread-Id": thread.id,
          };
        },
        body: { threadId: thread.id },
      }),
    [thread.id],
  );

  const { messages, sendMessage, status, stop } = useChat({
    id: thread.id,
    messages: initialMessages as UIMessage[],
    transport,
    onError: (err) => {
      toast.error(err.message || "军师走神了，再发一次试试");
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // 保持输入框聚焦
  useEffect(() => {
    if (status === "ready") textareaRef.current?.focus();
  }, [status]);

  const persona = (thread.matches as unknown as { personas?: { nickname: string; avatar: string; tagline: string } } | null)
    ?.personas;
  const starters = STARTERS[thread.context_type] ?? STARTERS["general"] ?? [];

  return (
    <AppShell>
      <div className="counselor-chat-page mx-auto flex h-[calc(100dvh-7.25rem)] w-full flex-col">
        {/* 头部 */}
        <div className="counselor-chat-header flex items-center gap-3 pb-3">
          <button
            onClick={() => navigate({ to: "/counselor" })}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display font-semibold">{thread.title}</h1>
            {persona && (
              <p className="truncate text-xs text-muted-foreground">
                关于 {persona.nickname} —— {persona.tagline}
              </p>
            )}
          </div>
          <img src={foxImg} alt="狐军师" className="h-9 w-9 object-contain" />
        </div>

        {/* 对话区 */}
        <div className="counselor-chat-surface flex min-h-0 flex-1 flex-col overflow-hidden">
          <Conversation className="counselor-chat-conversation flex-1">
            <ConversationContent className="gap-5 px-1 py-5 md:px-3 md:py-6">
              {messages.length === 0 && (
                <div>
                  <ConversationEmptyState
                    title="军师在此，尽管开口"
                    description="消息发得越具体，建议越准。也可以直接点下面的话题开始。"
                    icon={
                      <img src={foxImg} alt="狐军师" className="h-16 w-16 object-contain" />
                    }
                  />
                  <div className="mt-4 flex flex-wrap justify-center gap-2 px-2">
                    {starters.map((s) => (
                      <button
                        key={s}
                        onClick={() => sendMessage({ text: s })}
                        className="rounded-full border border-primary/40 bg-primary/10 px-4 py-2 text-xs text-primary transition-colors hover:bg-primary/20"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <Message key={m.id} from={m.role}>
                  <MessageContent>
                    {m.parts.map((part, i) =>
                      part.type === "text" ? (
                        m.role === "assistant" ? (
                          <MessageResponse key={i}>{part.text}</MessageResponse>
                        ) : (
                          <p key={i} className="whitespace-pre-wrap">
                            {part.text}
                          </p>
                        )
                      ) : null,
                    )}
                  </MessageContent>
                </Message>
              ))}

              {status === "submitted" && (
                <Message from="assistant">
                  <MessageContent>
                    <Shimmer>军师思考中…</Shimmer>
                  </MessageContent>
                </Message>
              )}
            </ConversationContent>
          </Conversation>

          {/* 输入区 */}
          <div className="counselor-chat-composer border-t border-border/60 pt-3">
            <PromptInput
              className="counselor-prompt"
              onSubmit={async ({ text }) => {
                const t = text.trim();
                if (!t || isLoading) return;
                await sendMessage({ text: t });
              }}
            >
              <PromptInputTextarea
                ref={textareaRef}
                placeholder="把 TA 的消息贴给我，或者直接说你的烦恼…"
                disabled={isLoading}
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit status={status} onStop={stop} disabled={isLoading && status !== "streaming"} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
