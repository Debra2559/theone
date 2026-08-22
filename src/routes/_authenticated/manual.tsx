import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Cake,
  ChevronRight,
  Loader2,
  MapPin,
  RefreshCw,
  MessageCircleHeart,
  Sparkles,
} from "@/components/app-icons";
import { generateManual, getManual, getMyProfile, getTestResults } from "@/lib/app.functions";
import { createThread } from "@/lib/counselor.functions";
import { AppShell, RouteError } from "@/components/app-shell";
import { SharePosterButton } from "@/components/poster-share";
import { UserAvatar } from "@/components/user-avatar";
import { TESTS } from "@/lib/tests";

export const Route = createFileRoute("/_authenticated/manual")({
  head: () => ({
    meta: [
      { title: "我的说明书 · 心动说明书" },
      { name: "description", content: "由你的测试生成的专属个人说明书。" },
      { property: "og:title", content: "我的说明书 · 心动说明书" },
      { property: "og:description", content: "由你的测试生成的专属个人说明书。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    const profile = await getMyProfile();
    if (!profile?.onboarding_done) throw redirect({ to: "/onboarding" });
    const [manualRow, results] = await Promise.all([getManual(), getTestResults()]);
    return { profile, manualRow, results };
  },
  errorComponent: RouteError,
  component: Manual,
});

type ManualSection = { icon: string; title: string; points: string[] };
type ManualContent = {
  title?: string;
  oneLiner?: string;
  badges?: string[];
  sections?: ManualSection[];
};

type ReportChapter = {
  icon: string;
  title: string;
  subtitle: string;
  points: string[];
  kind?: "points" | "traits";
};

type PageDirection = "forward" | "back";

function pageTitle(section: ReportChapter | undefined, index: number) {
  return section?.title ?? (index === 0 ? "扉页" : "未命名章节");
}

function getAge(birthDate?: string | null) {
  if (!birthDate) return null;
  const birthday = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birthday.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birthday.getFullYear();
  const month = now.getMonth() - birthday.getMonth();
  if (month < 0 || (month === 0 && now.getDate() < birthday.getDate())) age -= 1;
  return age > 0 ? age : null;
}

function Manual() {
  const { profile, manualRow, results } = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageDirection, setPageDirection] = useState<PageDirection>("forward");
  const [turning, setTurning] = useState(false);
  const turnTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (turnTimer.current !== null) window.clearTimeout(turnTimer.current);
    };
  }, []);

  const resultMap: Record<string, { label: string; summary: string }> = {};
  for (const r of results) resultMap[r.test_id] = r.result as { label: string; summary: string };

  const m = ((manualRow?.content ?? {}) as ManualContent) || {};
  const hasManual = !!manualRow;

  const regenerate = async () => {
    setBusy(true);
    try {
      await generateManual();
      toast.success("说明书已重新生成 ✨");
      await router.invalidate();
      setBusy(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成失败，稍后再试");
      setBusy(false);
    }
  };

  const chatAboutSelf = async () => {
    setChatting(true);
    try {
      const { id } = await createThread({
        data: {
          title: "聊聊我自己",
          context_type: "self",
          situation: "想请军师帮我解读我的个人说明书",
          match_id: null,
        },
      });
      navigate({ to: "/counselor/$threadId", params: { threadId: id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建对话失败");
      setChatting(false);
    }
  };

  const rawSections = m.sections ?? [];
  const findSection = (keywords: RegExp) =>
    rawSections.find((section) => keywords.test(section.title));
  const personalitySection = findSection(/性格|底色|闪光/);
  const boundarySection = findSection(/注意|边界|雷区/);
  const relationshipSection = findSection(/恋爱|关系|亲密/);
  const adviceSection = findSection(/攻略|建议|提示/);
  const measuredTests = TESTS.filter((test) => resultMap[test.id]);
  const profileAge = getAge(profile?.birth_date);
  const reportTraits = [
    ["性格底色", resultMap.mbti?.label],
    ["亲密节奏", resultMap.attachment?.label],
    ["被爱方式", resultMap.loveLanguage?.label],
    ["关系电量", resultMap.needs?.label],
    ["生活气质", resultMap.element?.label ?? resultMap.zodiac?.label],
  ].filter((trait): trait is [string, string] => Boolean(trait[1])) as [string, string][];
  const reportChapters: ReportChapter[] = [
    {
      icon: "✦",
      title: "这份画像是怎么来的？",
      subtitle: "每一次选择，都在勾勒真实的你。",
      points:
        measuredTests.length > 0
          ? measuredTests.slice(0, 4).map((test) => `${test.name} → ${resultMap[test.id]?.label}`)
          : ["完成一个测试，这份画像才会开始有名字。"],
    },
    {
      icon: "✧",
      title: "你的社交闪光点",
      subtitle: "这些是你在关系中自然发亮的部分。",
      points: personalitySection?.points?.slice(0, 4) ?? [
        m.oneLiner ?? "你有自己的节奏，也有值得被看见的光。",
      ],
    },
    {
      icon: "◌",
      title: "你在社交里的边界感",
      subtitle: "边界不是拒绝靠近，而是让靠近变得舒服。",
      points: boundarySection?.points?.slice(0, 3) ?? [
        resultMap.attachment?.summary ?? "你需要先建立信任，再把更柔软的一面交出来。",
        resultMap.needs?.summary ?? "适合你的关系，会尊重亲密和独处之间的呼吸感。",
      ],
    },
    {
      icon: "◒",
      title: "你在关系里是什么样的？",
      subtitle: "亲密关系，是你的另一种语言。",
      points:
        relationshipSection?.points?.slice(0, 4) ??
        [
          resultMap.attachment?.summary,
          resultMap.loveLanguage?.summary,
          resultMap.needs?.summary,
        ].filter((point): point is string => Boolean(point)),
    },
    {
      icon: "◈",
      title: "五维社交特质画像",
      subtitle: "用几个关键词，把你的社交 DNA 摆在桌面上。",
      points: reportTraits.map(([label, value]) => `${label} · ${value}`),
      kind: "traits",
    },
    {
      icon: "✦",
      title: "给你的社交小提示",
      subtitle: "不必改变自己，只要把合适的信号发出去。",
      points: adviceSection?.points?.slice(0, 3) ?? [
        "在熟悉的兴趣场景里主动一点，你的魅力会更自然地出现。",
        "适度表达自己的需要，让对方知道如何靠近你。",
      ],
    },
  ];

  const turnPage = (direction: PageDirection) => {
    if (turning || reportChapters.length === 0) return;
    const nextIndex = direction === "forward" ? pageIndex + 1 : pageIndex - 1;
    if (nextIndex < 0 || nextIndex >= reportChapters.length) return;
    setPageDirection(direction);
    setTurning(true);
    turnTimer.current = window.setTimeout(() => {
      setPageIndex(nextIndex);
      setTurning(false);
      turnTimer.current = null;
    }, 720);
  };

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">
            {profile?.nickname} 的<span className="gradient-text">使用说明书</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasManual ? "由你的测试和资料生成 · 可随时更新" : "完成任意测试后即可生成"}
          </p>
        </div>
        {hasManual && (
          <div className="flex flex-wrap gap-2">
            <SharePosterButton
              filename={`心动说明书-${profile?.nickname ?? "我"}.png`}
              data={{
                kind: "manual",
                nickname: profile?.nickname ?? "新朋友",
                avatar: profile?.avatar ?? "✨",
                title: m.title ?? `${profile?.nickname} 的说明书`,
                oneLiner: m.oneLiner,
                badges: m.badges ?? [],
                sections: (m.sections ?? []).map((s) => ({
                  icon: s.icon,
                  title: s.title,
                  points: s.points,
                })),
              }}
            />
            <button
              onClick={regenerate}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              重新生成
            </button>
            <button
              onClick={chatAboutSelf}
              disabled={chatting}
              className="btn-starlight inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {chatting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircleHeart className="h-4 w-4" />
              )}
              和军师聊聊
            </button>
          </div>
        )}
      </div>

      {!hasManual ? (
        <div className="dreamy-card mt-8 flex flex-col items-center p-10 text-center">
          <span className="text-6xl">📖</span>
          <h2 className="font-display mt-4 text-xl font-bold">说明书还是空白页</h2>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            做完任意一个测试，AI 就能把你的性格、心动模式和相处偏好写成一份专属说明书。
          </p>
          {results.length > 0 ? (
            <button
              onClick={regenerate}
              disabled={busy}
              className="btn-starlight mt-6 inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              生成我的说明书
            </button>
          ) : (
            <button
              onClick={() => navigate({ to: "/home" })}
              className="btn-starlight mt-6 rounded-full px-8 py-3 text-sm font-semibold"
            >
              先去做个测试
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <section className="life-book-shell" aria-label="人生之书">
            <div className={`life-book ${bookOpen ? "is-open" : "is-closed"}`}>
              {!bookOpen ? (
                <button
                  type="button"
                  onClick={() => setBookOpen(true)}
                  className="life-book-cover group"
                  aria-label="打开人生之书"
                >
                  <span className="life-book-cover-mark">VOL. 01</span>
                  <span className="life-book-cover-rule" />
                  <span className="life-book-cover-title">
                    {profile?.nickname}
                    <small>的 人生之书</small>
                  </span>
                  <span className="life-book-cover-avatar">
                    <UserAvatar avatar={profile?.avatar} className="h-full w-full text-6xl" />
                  </span>
                  <span className="life-book-cover-foot">PERSONAL ARCHIVE · 2026</span>
                  <span className="life-book-cover-open">
                    <BookOpen className="h-4 w-4" /> 点击开卷
                  </span>
                </button>
              ) : (
                <div className="life-book-open">
                  <aside className="life-book-index">
                    <p className="eyebrow">Contents</p>
                    <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 lg:block lg:space-y-1.5">
                      {reportChapters.map((section, index) => (
                        <button
                          type="button"
                          key={`${section.title}-${index}`}
                          onClick={() => {
                            if (!turning) setPageIndex(index);
                          }}
                          className={`life-book-index-item ${pageIndex === index ? "is-active" : ""}`}
                        >
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          <strong>{pageTitle(section, index)}</strong>
                        </button>
                      ))}
                    </div>
                  </aside>

                  <article className="life-book-page life-book-page-intro">
                    <p className="life-book-kicker">AI 社交画像报告</p>
                    <p className="social-report-greeting">嗨，{profile?.nickname}</p>
                    <h2 className="social-report-title">
                      {m.title?.replace(/[《》]/g, "") ?? `清醒的 ${profile?.nickname}`}
                    </h2>
                    <span className="social-report-spark">✦</span>
                    <p className="social-report-lede">
                      {m.oneLiner ?? "在自己的节奏里，认真遇见同频的人"}
                    </p>
                    <p className="social-report-note">
                      AI 基于你在互动中的选择和表达，为你生成了这份专属社交画像
                    </p>
                    <div className="social-report-profile">
                      <span className="life-book-mini-avatar">
                        <UserAvatar avatar={profile?.avatar} className="h-full w-full text-3xl" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-lg font-semibold">{profile?.nickname}</p>
                        <p className="social-report-meta">
                          {profileAge && (
                            <span>
                              <Cake className="inline h-3 w-3" /> {profileAge} 岁
                            </span>
                          )}
                          {profile?.city && (
                            <span>
                              <MapPin className="inline h-3 w-3" /> {profile.city}
                            </span>
                          )}
                        </p>
                        <div className="social-report-tags">
                          {(m.badges ?? reportTraits.map(([, value]) => value))
                            .slice(0, 3)
                            .map((badge) => (
                              <span key={badge}>{badge}</span>
                            ))}
                        </div>
                      </div>
                    </div>
                    <p className="social-report-scroll-hint">向右翻阅查看完整画像</p>
                    <span className="life-book-folio">I · 01</span>
                  </article>

                  <article
                    className={`life-book-page life-book-page-chapter ${turning ? `is-turning-${pageDirection}` : ""}`}
                  >
                    <p className="life-book-kicker">
                      · {String(pageIndex + 1).padStart(2, "0")} · {reportChapters[pageIndex]?.icon}
                    </p>
                    <h2 className="social-report-chapter-title">
                      {pageTitle(reportChapters[pageIndex], pageIndex)}
                    </h2>
                    <p className="social-report-chapter-subtitle">
                      {reportChapters[pageIndex]?.subtitle}
                    </p>
                    <div className="life-book-chapter-line" />
                    {reportChapters[pageIndex]?.kind === "traits" ? (
                      <div className="social-report-traits">
                        {reportTraits.map(([label, value]) => (
                          <div key={label} className="social-report-trait">
                            <div className="flex items-center justify-between gap-2">
                              <span>{label}</span>
                              <strong>{value}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <ul className="social-report-points">
                        {(reportChapters[pageIndex]?.points ?? []).map((point, index) => (
                          <li key={`${point}-${index}`}>
                            <span className="life-book-point-number">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <span className="life-book-folio">
                      {String(pageIndex + 2).padStart(2, "0")} ·{" "}
                      {String(reportChapters.length + 1).padStart(2, "0")}
                    </span>
                  </article>
                </div>
              )}
            </div>

            {bookOpen && (
              <div className="life-book-controls">
                <button
                  type="button"
                  onClick={() => turnPage("back")}
                  disabled={turning || pageIndex === 0}
                  className="life-book-control"
                  aria-label="上一页"
                  title="上一页"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <span>
                  {String(pageIndex + 1).padStart(2, "0")} /{" "}
                  {String(reportChapters.length).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={() => turnPage("forward")}
                  disabled={turning || pageIndex === reportChapters.length - 1}
                  className="life-book-control"
                  aria-label="下一页"
                  title="下一页"
                >
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setBookOpen(false)}
                  className="ml-auto text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  合上
                </button>
              </div>
            )}
          </section>

          {m.badges && m.badges.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1">
              {m.badges.map((badge) => (
                <span key={badge} className="life-book-badge">
                  {badge}
                </span>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate({ to: "/match" })}
            className="social-report-match-cta"
          >
            <span>用这份画像去匹配</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          {TESTS.filter((t) => !resultMap[t.id]).length > 0 && (
            <button
              onClick={() => navigate({ to: "/home" })}
              className="flex w-full items-center justify-between border-b border-foreground/15 px-1 py-3 text-left text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              <span>
                还有 {TESTS.filter((t) => !resultMap[t.id]).length} 个测试，可以继续补写这本书
              </span>
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </AppShell>
  );
}
