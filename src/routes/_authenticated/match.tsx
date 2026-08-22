import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Heart,
  HeartFilled,
  X,
  Sparkles,
  MapPin,
  RotateCcw,
  ChevronRight,
  Loader2,
} from "@/components/app-icons";
import { getMyProfile } from "@/lib/app.functions";
import { createMatch, getMatchCandidates } from "@/lib/match.functions";
import { AppShell, RouteError } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/_authenticated/match")({
  head: () => ({
    meta: [
      { title: "推荐 · 心动说明书" },
      { name: "description", content: "一页一个人，慢慢看，认真喜欢。" },
      { property: "og:title", content: "推荐 · 心动说明书" },
      { property: "og:description", content: "一页一个人，慢慢看，认真喜欢。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    const profile = await getMyProfile();
    if (!profile?.onboarding_done) throw redirect({ to: "/onboarding" });
    return getMatchCandidates();
  },
  errorComponent: RouteError,
  component: Match,
});

type Candidate = {
  persona: {
    id: string;
    nickname: string;
    gender: string;
    age: number;
    city: string;
    tagline: string;
    avatar: string;
    tags: unknown;
    bio: string;
    manual: unknown;
  };
  score: number;
  highlights: string[];
  matched: boolean;
  matchId: string | null;
  source?: "database" | "live";
};

const COVERS = [
  "from-primary/25 via-secondary/40 to-accent/25",
  "from-secondary/50 via-accent/20 to-primary/20",
  "from-accent/25 via-primary/20 to-secondary/45",
  "from-primary/30 via-accent/25 to-secondary/35",
];

function scoreColor(score: number) {
  if (score >= 80) return "text-accent";
  if (score >= 65) return "text-primary";
  return "text-muted-foreground";
}

function genderLabel(g: string) {
  return g === "female" ? "女生" : g === "male" ? "男生" : "保密";
}

function Match() {
  const { candidates, hasData } = Route.useLoaderData() as {
    candidates: Candidate[];
    hasData: boolean;
  };
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fresh = candidates.filter((c) => !c.matched);
  const matched = candidates.filter((c) => c.matched);
  const visibleCandidates = fresh.length > 0 ? fresh : candidates;
  const current =
    visibleCandidates.length > 0 ? visibleCandidates[index % visibleCandidates.length] : undefined;
  const coverClass = COVERS[index % COVERS.length];

  const next = () => {
    setIndex((i) => i + 1);
    setProgress(0);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const like = async (superLike = false) => {
    if (!current || pending) return;
    if (current.source === "live") {
      toast.info("这是真实匹配样本，已为你打开完整资料与聊天记录");
      navigate({ to: "/hackathon-match" });
      return;
    }
    setPending(true);
    try {
      const { id } = await createMatch({
        data: {
          personaId: current.persona.id,
          score: current.score,
          highlights: current.highlights,
        },
      });
      toast.success(
        superLike ? "超级喜欢已送达 ✨ TA 会优先看到你" : "心动成功，去翻你们的关系说明书吧 💗",
      );
      navigate({ to: "/match/$matchId", params: { matchId: id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败");
      setPending(false);
    }
  };

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProgress(max > 0 ? el.scrollTop / max : 0);
  };

  const manual = (current?.persona.manual ?? {}) as Record<string, unknown>;
  const factChips: { label: string; value: string }[] = [];
  if (current) {
    const push = (label: string, key: string) => {
      const v = manual[key];
      if (typeof v === "string" && v) factChips.push({ label, value: v });
    };
    push("MBTI", "mbti");
    push("星座", "zodiac");
    push("元素", "element");
    push("依恋", "attachment");
    push("爱的语言", "loveLanguage");
    push("需求", "needs");
  }
  const tags =
    current && Array.isArray(current.persona.tags) ? (current.persona.tags as string[]) : [];

  return (
    <AppShell>
      <div className="flex h-[calc(100dvh-9.5rem)] min-h-[540px] flex-col">
        {/* 顶部：标题 + 进度 */}
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">For You</p>
            <h1 className="mt-1 font-display text-[26px] font-semibold">
              推荐
              <span className="ml-2 inline-block h-[3px] w-7 rounded-full bg-primary align-middle" />
            </h1>
            {!hasData && (
              <p className="mt-1 text-xs text-muted-foreground">
                还没做测试，合拍指数是盲猜 ·{" "}
                <Link to="/home" className="font-semibold text-primary">
                  去做测试
                </Link>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/match/1v1"
              aria-label="进入 1v1 匹配"
              className="group flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border border-primary/15 bg-card/75 text-primary shadow-sm transition-transform hover:-translate-y-0.5 active:scale-95"
            >
              <Sparkles className="h-5 w-5 transition-transform group-hover:rotate-12" />
              <span className="mt-0.5 text-[10px] font-semibold tracking-wide">1v1 匹配</span>
            </Link>
            {visibleCandidates.length > 0 && current && (
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
                {Math.min(index + 1, visibleCandidates.length)} / {visibleCandidates.length}
              </span>
            )}
          </div>
        </div>

        {current ? (
          <div
            key={current.persona.id}
            className="dreamy-card relative mt-4 min-h-0 flex-1 animate-in fade-in slide-in-from-bottom-4 overflow-hidden p-0 duration-500"
          >
            {/* 卡片内部滚动区 */}
            <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto">
              {/* 封面 */}
              <div
                className={`relative flex h-[62%] min-h-[320px] flex-col justify-end overflow-hidden ${coverClass} p-5`}
              >
                <div className="absolute inset-0 bg-background/15" />
                <UserAvatar
                  avatar={current.persona.avatar}
                  className="!rounded-none pointer-events-none absolute inset-0 h-full w-full object-cover text-[14rem] drop-shadow-lg"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-foreground/10 via-transparent to-foreground/72" />
                <div className="relative z-10 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 rounded-full bg-card/88 px-3 py-1 text-[11px] font-medium text-foreground backdrop-blur">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    今日活跃
                  </div>
                  <div className="flex h-14 w-14 flex-col items-center justify-center rounded-full bg-card/92 shadow-md backdrop-blur">
                    <span
                      className={`font-display text-lg font-semibold leading-none ${scoreColor(current.score)}`}
                    >
                      {current.score}%
                    </span>
                    <span className="mt-0.5 text-[9px] text-muted-foreground">合拍</span>
                  </div>
                </div>
                <div className="relative z-10 mt-auto">
                  <h2 className="font-display text-3xl font-semibold text-background drop-shadow-md">
                    {current.persona.nickname}
                    <span className="ml-2 text-xl font-normal text-background/75">
                      {current.persona.age}
                    </span>
                  </h2>
                  <p className="mt-1 flex items-center gap-1 text-sm text-background/85 drop-shadow-md">
                    <MapPin className="h-3.5 w-3.5" />
                    {current.persona.city} · {genderLabel(current.persona.gender)}
                  </p>
                </div>
              </div>

              {/* 资料区 */}
              <div className="space-y-6 p-5 pb-28">
                <section>
                  <p className="eyebrow text-primary">关于 TA</p>
                  <p className="mt-2 text-base font-semibold leading-relaxed">
                    {current.persona.tagline}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {current.persona.bio}
                  </p>
                  {tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs text-secondary-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </section>

                {factChips.length > 0 && (
                  <section>
                    <p className="eyebrow text-primary">TA 的测试</p>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      {factChips.map((f) => (
                        <div key={f.label} className="rounded-2xl bg-secondary/50 px-3.5 py-2.5">
                          <p className="text-[10px] text-muted-foreground">{f.label}</p>
                          <p className="mt-0.5 truncate text-sm font-semibold">{f.value}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {current.highlights.length > 0 && (
                  <section>
                    <p className="eyebrow text-primary">你们的合拍点</p>
                    <ul className="mt-2.5 space-y-2">
                      {current.highlights.map((h, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 rounded-2xl bg-accent/10 px-3.5 py-2.5 text-sm"
                        >
                          <span className="text-accent">✦</span>
                          <span>{h}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            </div>

            {/* 右侧滚动进度 */}
            <div className="pointer-events-none absolute right-1.5 top-6 h-24 w-1 rounded-full bg-foreground/10">
              <div
                className="w-full rounded-full bg-foreground/60 transition-all"
                style={{ height: `${Math.max(12, progress * 100)}%` }}
              />
            </div>

            {/* 悬浮操作按钮 */}
            <div className="absolute bottom-6 right-3.5 flex flex-col items-center gap-3.5">
              <button
                aria-label="超级喜欢"
                onClick={() => like(true)}
                disabled={pending}
                className="flex items-center justify-center rounded-full bg-gradient-to-br from-chart-3 to-primary text-primary-foreground shadow-lg transition-transform hover:scale-110 active:scale-95 disabled:opacity-60"
                style={{ height: 52, width: 52 }}
              >
                <Sparkles className="h-6 w-6" />
              </button>
              <button
                aria-label="喜欢"
                onClick={() => like(false)}
                disabled={pending}
                className="flex items-center justify-center rounded-full bg-gradient-to-br from-rose-foreground to-chart-3 text-primary-foreground shadow-lg shadow-rose-foreground/40 transition-transform hover:scale-110 active:scale-95 disabled:opacity-60"
                style={{ height: 64, width: 64 }}
              >
                {pending ? (
                  <Loader2 className="h-7 w-7 animate-spin" />
                ) : (
                  <HeartFilled className="h-7 w-7 animate-heartbeat" />
                )}
              </button>
              <button
                aria-label="不喜欢"
                onClick={next}
                disabled={pending}
                className="flex items-center justify-center rounded-full bg-chart-4 text-primary-foreground shadow-lg transition-transform hover:scale-110 active:scale-95 disabled:opacity-60"
                style={{ height: 52, width: 52 }}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        ) : (
          <div className="dreamy-card mt-4 flex min-h-0 flex-1 flex-col items-center justify-center p-8 text-center">
            <span className="text-5xl">🌙</span>
            <h2 className="mt-4 font-display text-lg font-semibold">今日推荐看完啦</h2>
            <p className="mt-2 max-w-[16rem] text-sm text-muted-foreground">
              小镇体验官都被你翻完了，可以回头再看看，或者去互动页找狐狸军师聊聊。
            </p>
            <button
              onClick={() => setIndex(0)}
              className="btn-starlight mt-6 inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              <RotateCcw className="h-4 w-4" />
              再看一遍
            </button>
          </div>
        )}
      </div>

      {/* 已心动 */}
      {matched.length > 0 && (
        <section className="mt-6">
          <h2 className="font-display text-base font-semibold">已心动 💗</h2>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {matched.map((c) => (
              <button
                key={c.persona.id}
                onClick={() =>
                  c.matchId && navigate({ to: "/match/$matchId", params: { matchId: c.matchId } })
                }
                className="dreamy-card flex shrink-0 items-center gap-2.5 p-3 pr-4 transition-transform hover:-translate-y-0.5"
              >
                <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary/15">
                  <UserAvatar avatar={c.persona.avatar} className="h-full w-full text-xl" />
                </span>
                <div className="text-left">
                  <p className="text-xs font-semibold">
                    {c.persona.nickname} · {c.score}%
                  </p>
                  <p className="flex items-center text-[10px] text-primary">
                    关系说明书 <ChevronRight className="h-3 w-3" />
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
