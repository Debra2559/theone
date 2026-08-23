import { createFileRoute, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
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
import foxAsset from "@/assets/fox.png";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";

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
  tone: "sand" | "peach" | "sage" | "lilac" | "butter" | "mist";
};

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

  const resultMap: Record<
    string,
    { label: string; summary: string; detail?: Record<string, number> }
  > = {};
  for (const r of results) {
    resultMap[r.test_id] = r.result as {
      label: string;
      summary: string;
      detail?: Record<string, number>;
    };
  }

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
    ["性格底色", resultMap["mbti"]?.label],
    ["亲密节奏", resultMap["attachment"]?.label],
    ["被爱方式", resultMap["loveLanguage"]?.label],
    ["关系电量", resultMap["needs"]?.label],
    ["生活气质", resultMap["element"]?.label ?? resultMap["zodiac"]?.label],
  ].filter((trait): trait is [string, string] => Boolean(trait[1])) as [string, string][];
  const detailFor = (testId: string) => resultMap[testId]?.detail ?? {};
  const scoreFor = (testId: string, keys: string[], fallback: number) => {
    const detail = detailFor(testId);
    const total = Object.values(detail).reduce((sum, value) => sum + value, 0);
    if (!total) return fallback;
    const value = keys.reduce((sum, key) => sum + (detail[key] ?? 0), 0);
    return Math.round(48 + (value / total) * 46);
  };
  const radarData = [
    { subject: "有趣度", value: scoreFor("mbti", ["E", "N", "P"], 64), fullMark: 100 },
    {
      subject: "共情力",
      value: scoreFor("mbti", ["F"], scoreFor("attachment", ["secure"], 68)),
      fullMark: 100,
    },
    {
      subject: "边界感",
      value: scoreFor("attachment", ["secure", "avoidant"], 62),
      fullMark: 100,
    },
    { subject: "稳定度", value: scoreFor("attachment", ["secure"], 70), fullMark: 100 },
    { subject: "社交活力", value: scoreFor("mbti", ["E", "P"], 60), fullMark: 100 },
  ];
  const reportChapters: ReportChapter[] = [
    {
      icon: "✦",
      title: "这份画像是怎么来的？",
      subtitle: "每一次选择，都在勾勒真实的你。",
      points:
        measuredTests.length > 0
          ? measuredTests.slice(0, 4).map((test) => `${test.name} → ${resultMap[test.id]?.label}`)
          : ["完成一个测试，这份画像才会开始有名字。"],
      tone: "sand",
    },
    {
      icon: "✧",
      title: "你的社交闪光点",
      subtitle: "这些是你在关系中自然发亮的部分。",
      points: personalitySection?.points?.slice(0, 4) ?? [
        m.oneLiner ?? "你有自己的节奏，也有值得被看见的光。",
      ],
      tone: "peach",
    },
    {
      icon: "◌",
      title: "你在社交里的边界感",
      subtitle: "边界不是拒绝靠近，而是让靠近变得舒服。",
      points: boundarySection?.points?.slice(0, 3) ?? [
        resultMap["attachment"]?.summary ?? "你需要先建立信任，再把更柔软的一面交出来。",
        resultMap["needs"]?.summary ?? "适合你的关系，会尊重亲密和独处之间的呼吸感。",
      ],
      tone: "sage",
    },
    {
      icon: "◒",
      title: "你在关系里是什么样的？",
      subtitle: "亲密关系，是你的另一种语言。",
      points:
        relationshipSection?.points?.slice(0, 4) ??
        [
          resultMap["attachment"]?.summary,
          resultMap["loveLanguage"]?.summary,
          resultMap["needs"]?.summary,
        ].filter((point): point is string => Boolean(point)),
      tone: "lilac",
    },
    {
      icon: "◈",
      title: "五维社交特质画像",
      subtitle: "用几个关键词，把你的社交 DNA 摆在桌面上。",
      points: reportTraits.map(([label, value]) => `${label} · ${value}`),
      kind: "traits",
      tone: "butter",
    },
    {
      icon: "✦",
      title: "给你的社交小提示",
      subtitle: "不必改变自己，只要把合适的信号发出去。",
      points: adviceSection?.points?.slice(0, 3) ?? [
        "在熟悉的兴趣场景里主动一点，你的魅力会更自然地出现。",
        "适度表达自己的需要，让对方知道如何靠近你。",
      ],
      tone: "mist",
    },
  ];

  return (
    <AppShell>
      <div className="manual-header flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">
            {profile?.nickname} 的<span className="gradient-text">使用说明书</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasManual ? "由你的测试和资料生成 · 可随时更新" : "完成任意测试后即可生成"}
          </p>
        </div>
        {hasManual && (
          <div className="manual-actions flex flex-wrap gap-2">
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
                <div className="life-book-open social-report-shell">
                  <div className="social-report">
                    <nav className="social-report-nav" aria-label="报告章节">
                      <span className="social-report-nav-label">目录</span>
                      <div className="social-report-nav-scroller">
                        {reportChapters.map((section, index) => (
                          <a key={`${section.title}-${index}`} href={`#report-chapter-${index}`}>
                            <small>{String(index + 1).padStart(2, "0")}</small>
                            <span>{section.title.replace(/[？?]/g, "")}</span>
                          </a>
                        ))}
                      </div>
                    </nav>

                    <header className="social-report-hero">
                      <div className="social-report-hero-copy">
                        <p className="life-book-kicker">AI 社交画像报告 · VOL. 01</p>
                        <p className="social-report-greeting">嗨，{profile?.nickname}</p>
                        <h2 className="social-report-title">
                          {m.title?.replace(/[《》]/g, "") ?? `清醒的 ${profile?.nickname}`}
                        </h2>
                        <p className="social-report-lede">
                          {m.oneLiner ?? "在自己的节奏里，认真遇见同频的人"}
                        </p>
                      </div>
                      <div className="social-report-hero-portrait">
                        <span className="social-report-orbit" />
                        <span className="social-report-hero-avatar">
                          <UserAvatar avatar={profile?.avatar} className="h-full w-full text-6xl" />
                        </span>
                        <span className="social-report-portrait-caption">{profile?.nickname}</span>
                      </div>
                    </header>

                    <div className="social-report-profile">
                      <span className="life-book-mini-avatar">
                        <UserAvatar avatar={profile?.avatar} className="h-full w-full text-3xl" />
                      </span>
                      <div className="min-w-0 flex-1">
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
                          <span>{measuredTests.length} 项测试已完成</span>
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

                    <div className="social-report-source-note">
                      <span className="social-report-source-mark">✦</span>
                      <p>AI 基于你在互动中的选择和表达，整理出这份专属社交画像。</p>
                      <span>阅读时间 · 约 3 分钟</span>
                    </div>

                    <div className="social-report-fox-note">
                      <img src={foxAsset} alt="狐军师插画" />
                      <div>
                        <p className="social-report-fox-label">狐军师的旁白</p>
                        <p>你不需要变成另一个人，只需要让对的人更容易读懂你。</p>
                      </div>
                    </div>

                    {reportChapters.map((chapter, index) => (
                      <section
                        key={`${chapter.title}-${index}`}
                        id={`report-chapter-${index}`}
                        className={`social-report-chapter social-report-chapter-${chapter.tone}`}
                      >
                        <div className="social-report-chapter-inner">
                          <p className="social-report-kicker">
                            {String(index + 1).padStart(2, "0")} <span>{chapter.icon}</span>
                          </p>
                          <h2 className="social-report-chapter-title">{chapter.title}</h2>
                          <p className="social-report-chapter-subtitle">{chapter.subtitle}</p>
                          <div className="life-book-chapter-line" />
                          {chapter.kind === "traits" ? (
                            <div className="social-report-traits-layout">
                              <div className="social-report-radar">
                                <ResponsiveContainer width="100%" height="100%">
                                  <RadarChart data={radarData} outerRadius="68%">
                                    <PolarGrid stroke="rgba(95, 77, 61, 0.18)" />
                                    <PolarAngleAxis
                                      dataKey="subject"
                                      tick={{ fill: "#66594f", fontSize: 10 }}
                                    />
                                    <PolarRadiusAxis
                                      domain={[0, 100]}
                                      tick={false}
                                      axisLine={false}
                                    />
                                    <Radar
                                      dataKey="value"
                                      stroke="#df725f"
                                      fill="#df725f"
                                      fillOpacity={0.22}
                                      strokeWidth={2}
                                    />
                                  </RadarChart>
                                </ResponsiveContainer>
                              </div>
                              <div className="social-report-bars">
                                {radarData.map((item) => (
                                  <div key={item.subject} className="social-report-bar-row">
                                    <div>
                                      <span>{item.subject}</span>
                                      <strong>{item.value}</strong>
                                    </div>
                                    <span className="social-report-bar-track">
                                      <i style={{ width: `${item.value}%` }} />
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <p className="social-report-chart-caption">
                                基于已完成测试的相对倾向，仅作自我观察参考
                              </p>
                            </div>
                          ) : (
                            <ol className="social-report-points">
                              {chapter.points.map((point, pointIndex) => (
                                <li key={`${point}-${pointIndex}`}>
                                  <span className="life-book-point-number">
                                    {String(pointIndex + 1).padStart(2, "0")}
                                  </span>
                                  <span>{point}</span>
                                </li>
                              ))}
                            </ol>
                          )}
                        </div>
                      </section>
                    ))}

                    <footer className="social-report-footer">
                      <p className="social-report-footer-eyebrow">THE NEXT CHAPTER</p>
                      <h2>把这份画像，带去遇见一个人。</h2>
                      <p>让匹配从“感觉不错”，变成有依据的靠近。</p>
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/match" })}
                        className="social-report-match-cta"
                      >
                        <span>用这份画像去匹配</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <span className="social-report-footer-mark">心动说明书 · 个人档案</span>
                    </footer>
                  </div>
                </div>
              )}
            </div>
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
