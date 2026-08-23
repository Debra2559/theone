import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageCircleHeart, ArrowLeft, Sparkles } from "@/components/app-icons";
import { generateRelationshipManual, getMatch } from "@/lib/match.functions";
import { createThread } from "@/lib/counselor.functions";
import { AppShell, RouteError } from "@/components/app-shell";
import { SharePosterButton } from "@/components/poster-share";
import { UserAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/_authenticated/match_/$matchId")({
  head: () => ({
    meta: [
      { title: "关系说明书 · 心动说明书" },
      { name: "description", content: "两个人的关系说明书：化学反应、潜在摩擦与相处攻略。" },
      { property: "og:title", content: "关系说明书 · 心动说明书" },
      { property: "og:description", content: "两个人的关系说明书。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context, params }) => {
    const profile = context.profile;
    const match = await getMatch({ data: { matchId: params.matchId } });
    return { profile, match };
  },
  errorComponent: RouteError,
  component: MatchDetail,
});

type RelManual = {
  title?: string;
  verdict?: string;
  chemistry?: string[];
  friction?: string[];
  playbook?: string[];
  firstDates?: { name: string; why: string }[];
  meetSignal?: string;
};

function ListCard({
  emoji,
  title,
  items,
}: {
  emoji: string;
  title: string;
  items?: string[] | undefined;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div className="dreamy-card p-5">
      <h3 className="font-display flex items-center gap-2 font-semibold">
        <span>{emoji}</span> {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-foreground/90">
            <span className="mt-1 text-primary">✦</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatchDetail() {
  const { profile, match } = Route.useLoaderData();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [chatting, setChatting] = useState(false);

  const persona = (match.personas ?? match.partner_profile) as unknown as {
    id?: string;
    nickname: string;
    age?: number;
    city: string;
    tagline?: string;
    avatar: string;
    bio?: string;
  };
  const rel = (match.relationship_manual ?? null) as RelManual | null;

  // 匹配后自动生成关系说明书
  useEffect(() => {
    if (rel || generating) return;
    setGenerating(true);
    generateRelationshipManual({ data: { matchId: match.id } })
      .then(() => window.location.reload())
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "生成失败，点下方按钮重试");
        setGenerating(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id]);

  const chatAboutMatch = async () => {
    setChatting(true);
    try {
      const { id } = await createThread({
        data: {
          title: `关于 ${persona.nickname}`,
          context_type: "match",
          situation: "",
          match_id: match.id,
        },
      });
      navigate({ to: "/counselor/$threadId", params: { threadId: id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建对话失败");
      setChatting(false);
    }
  };

  return (
    <AppShell>
      <button
        onClick={() => navigate({ to: "/match" })}
        className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> 返回遇见
      </button>

      {/* 双方头部 */}
      <div className="dreamy-card relative mt-4 overflow-hidden p-7 text-center">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-accent" />
        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-secondary">
              <UserAvatar avatar={profile?.avatar} className="h-full w-full text-3xl" />
            </span>
            <p className="mt-1.5 text-sm font-semibold">{profile?.nickname}</p>
          </div>
          <div className="flex flex-col items-center">
            <span className="animate-twinkle text-2xl">💞</span>
            <p className="font-display mt-1 text-2xl font-bold gradient-text">{match.score}%</p>
            <p className="text-[10px] tracking-wide text-muted-foreground">合拍指数</p>
          </div>
          <div className="text-center">
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-primary/15">
              <UserAvatar avatar={persona.avatar} className="h-full w-full text-3xl" />
            </span>
            <p className="mt-1.5 text-sm font-semibold">{persona.nickname}</p>
          </div>
        </div>
        {rel?.verdict && (
          <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">「{rel.verdict}」</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          {persona.nickname}
          {persona.age ? ` · ${persona.age}岁` : ""} · {persona.city}
          {persona.tagline ? ` —— ${persona.tagline}` : ""}
        </p>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {rel && (
            <SharePosterButton
              filename={`关系说明书-${profile?.nickname ?? "我"}x${persona.nickname}.png`}
              data={{
                kind: "relationship",
                meName: profile?.nickname ?? "我",
                meAvatar: profile?.avatar ?? "✨",
                partnerName: persona.nickname,
                partnerAvatar: persona.avatar,
                score: match.score,
                verdict: rel.verdict,
                chemistry: rel.chemistry ?? [],
                friction: rel.friction ?? [],
                playbook: rel.playbook ?? [],
                dateIdeas: (rel.firstDates ?? []).map((d) => d.name),
              }}
            />
          )}
          <button
            onClick={chatAboutMatch}
            disabled={chatting}
            className="btn-starlight inline-flex items-center gap-1.5 rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            {chatting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircleHeart className="h-4 w-4" />
            )}
            找军师聊聊 TA
          </button>
        </div>
      </div>

      {/* 关系说明书 */}
      {!rel ? (
        <div className="dreamy-card mt-6 flex flex-col items-center p-10 text-center">
          {generating ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <h2 className="font-display mt-4 text-lg font-bold">军师正在奋笔疾书…</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                正在阅读你们俩的说明书，生成你们的关系说明书，十几秒就好
              </p>
            </>
          ) : (
            <>
              <span className="text-5xl">📝</span>
              <h2 className="font-display mt-4 text-lg font-bold">关系说明书还没生成</h2>
              <button
                onClick={() => {
                  setGenerating(true);
                  generateRelationshipManual({ data: { matchId: match.id } })
                    .then(() => window.location.reload())
                    .catch((err) => {
                      toast.error(err instanceof Error ? err.message : "生成失败");
                      setGenerating(false);
                    });
                }}
                className="btn-starlight mt-5 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
              >
                <Sparkles className="h-4 w-4" /> 生成关系说明书
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <h2 className="font-display text-center text-xl font-bold gradient-text">
            {rel.title ?? "关系说明书"}
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <ListCard emoji="🧪" title="化学反应" items={rel.chemistry} />
            <ListCard emoji="⚡" title="潜在摩擦" items={rel.friction} />
          </div>

          <ListCard emoji="📜" title="相处攻略" items={rel.playbook} />

          {rel.firstDates && rel.firstDates.length > 0 && (
            <div className="dreamy-card p-5">
              <h3 className="font-display flex items-center gap-2 font-semibold">
                <span>🎡</span> 约会点子
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {rel.firstDates.map((d, i) => (
                  <div key={i} className="rounded-xl bg-secondary/60 p-4">
                    <p className="text-sm font-semibold">{d.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{d.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {rel.meetSignal && (
            <div className="dreamy-card border-primary/30 bg-primary/5 p-5">
              <h3 className="font-display flex items-center gap-2 font-semibold text-primary">
                <span>🦊</span> 军师的见面建议
              </h3>
              <p className="mt-2 text-sm leading-relaxed">{rel.meetSignal}</p>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
