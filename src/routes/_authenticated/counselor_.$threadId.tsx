import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, X } from "@/components/app-icons";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/app.functions";
import { getThreadData, linkThreadMatch, listMatchOptions } from "@/lib/counselor.functions";
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
import { UserAvatar } from "@/components/user-avatar";

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
    const [threadData, matchOptions] = await Promise.all([
      getThreadData({ data: { threadId: params.threadId } }),
      listMatchOptions(),
    ]);
    return { ...threadData, matchOptions };
  },
  errorComponent: RouteError,
  component: CounselorChat,
});

const STARTERS: Record<string, string[]> = {
  self: [
    "我的说明书里最准的是哪条？",
    "我在恋爱里最容易踩的坑是什么？",
    "做完其他测试会有哪些变化？",
  ],
  match: ["帮我想个自然的聊天开场白", "TA 说什么话代表对我有好感？", "什么时候约 TA 见面比较好？"],
  external: ["TA 已读不回，怎么办？", "我们吵架了，帮我分析一下", "这段关系该不该继续推进？"],
  general: ["怎么自然地开启聊天？", "第一次见面去哪里好？", "我适合什么样的人？"],
};

function CounselorChat() {
  const { thread, messages: initialMessages, matchOptions } = Route.useLoaderData();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [linkedMatchId, setLinkedMatchId] = useState<string | null>(thread.match_id);
  const [matchPickerOpen, setMatchPickerOpen] = useState(false);
  const [linkingMatch, setLinkingMatch] = useState(false);

  const activeMatch = matchOptions.find((match) => match.id === linkedMatchId) ?? null;
  const fixedMatch = thread.context_type === "match";

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
        body: { threadId: thread.id, relatedMatchId: linkedMatchId },
      }),
    [linkedMatchId, thread.id],
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

  useEffect(() => {
    setLinkedMatchId(thread.match_id);
    setMatchPickerOpen(false);
  }, [thread.id, thread.match_id]);

  // 保持输入框聚焦
  useEffect(() => {
    if (status === "ready") textareaRef.current?.focus();
  }, [status]);

  const persona = (
    thread.matches as unknown as {
      personas?: { nickname: string; avatar: string; tagline: string };
    } | null
  )?.personas;
  const linkedPersona = activeMatch ?? (fixedMatch ? persona : null);
  const starters = linkedPersona
    ? STARTERS.match
    : (STARTERS[thread.context_type] ?? STARTERS.general);

  const selectMatch = async (matchId: string | null) => {
    if (linkingMatch || isLoading || fixedMatch) return;
    setLinkingMatch(true);
    try {
      await linkThreadMatch({ data: { threadId: thread.id, matchId } });
      setLinkedMatchId(matchId);
      setMatchPickerOpen(false);
      toast.success(matchId ? "已关联嘉宾，军师会结合你们的情况回答" : "已取消嘉宾关联");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "关联失败");
    } finally {
      setLinkingMatch(false);
    }
  };

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
            {linkedPersona ? (
              <p className="truncate text-xs text-muted-foreground">
                {fixedMatch ? "匹配对话" : "正在和军师一起看"} · {linkedPersona.nickname}
              </p>
            ) : (
              <p className="truncate text-xs text-muted-foreground">
                可以 @ 一位匹配嘉宾，问你们两个人的事
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
                    description={
                      linkedPersona
                        ? `已关联 ${linkedPersona.nickname}，可以直接问你们两个人的事。`
                        : "消息发得越具体，建议越准。先 @ 一位嘉宾，军师会结合你们的情况。"
                    }
                    icon={<img src={foxImg} alt="狐军师" className="h-16 w-16 object-contain" />}
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
            <div className="counselor-context-picker">
              <div className="flex items-center gap-2">
                {linkedPersona ? (
                  <div className="counselor-linked-match">
                    <UserAvatar avatar={linkedPersona.avatar} className="h-6 w-6 text-sm" />
                    <span>
                      <small>@ 已关联</small>
                      <strong>{linkedPersona.nickname}</strong>
                    </span>
                    {!fixedMatch && (
                      <button
                        type="button"
                        aria-label="取消关联嘉宾"
                        onClick={() => selectMatch(null)}
                        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMatchPickerOpen((open) => !open)}
                    className="counselor-mention-trigger"
                    aria-expanded={matchPickerOpen}
                    aria-controls="counselor-match-picker"
                    disabled={linkingMatch || isLoading}
                  >
                    <span className="counselor-mention-symbol">@</span>
                    <span>关联一位匹配嘉宾</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
                {linkedPersona && !fixedMatch && (
                  <button
                    type="button"
                    onClick={() => setMatchPickerOpen((open) => !open)}
                    className="counselor-change-match"
                    aria-expanded={matchPickerOpen}
                    aria-controls="counselor-match-picker"
                    disabled={linkingMatch || isLoading}
                  >
                    {linkingMatch ? "保存中" : "更换"}
                  </button>
                )}
              </div>
              {matchPickerOpen && !fixedMatch && (
                <div
                  id="counselor-match-picker"
                  className="counselor-match-picker"
                  role="listbox"
                  aria-label="选择匹配嘉宾"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold">@ 谁来一起聊？</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        军师会读取你们的关系报告和双方画像
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="关闭嘉宾选择"
                      onClick={() => setMatchPickerOpen(false)}
                      className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
                      disabled={linkingMatch || isLoading}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {matchOptions.length > 0 ? (
                    <div className="mt-3 grid max-h-40 gap-1.5 overflow-y-auto">
                      {matchOptions.map((match) => (
                        <button
                          key={match.id}
                          type="button"
                          role="option"
                          aria-selected={match.id === linkedMatchId}
                          onClick={() => selectMatch(match.id)}
                          disabled={linkingMatch || isLoading}
                          className={`counselor-match-option ${match.id === linkedMatchId ? "is-active" : ""}`}
                        >
                          <UserAvatar avatar={match.avatar} className="h-9 w-9 text-lg" />
                          <span className="min-w-0 flex-1 text-left">
                            <strong>{match.nickname}</strong>
                            <small>{match.tagline || "已匹配嘉宾"}</small>
                          </span>
                          <span className="counselor-match-score">{match.score ?? "--"}%</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 rounded-xl bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                      先去推荐页完成一次匹配，军师才能读懂你们的关系。
                    </p>
                  )}
                </div>
              )}
            </div>
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
                placeholder={
                  linkedPersona
                    ? `问问你和 ${linkedPersona.nickname} 的事…`
                    : "把 TA 的消息贴给我，或者先 @ 一位嘉宾…"
                }
                disabled={isLoading}
              />
              <PromptInputFooter className="justify-end">
                <PromptInputSubmit
                  status={status}
                  onStop={stop}
                  disabled={isLoading && status !== "streaming"}
                />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
