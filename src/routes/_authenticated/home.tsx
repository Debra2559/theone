import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { getHomeData } from "@/lib/app.functions";
import { AppShell, RouteError } from "@/components/app-shell";
import { TESTS } from "@/lib/tests";
import { Check, ChevronRight, BookOpen, ArrowRight } from "@/components/app-icons";
import { UserAvatar } from "@/components/user-avatar";
import foxImg from "@/assets/fox.png";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "理解 · 心动说明书" },
      { name: "description", content: "做好玩的轻测试，生成你的专属个人说明书。" },
      { property: "og:title", content: "理解 · 心动说明书" },
      { property: "og:description", content: "做好玩的轻测试，生成你的专属个人说明书。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    const data = await getHomeData();
    if (!data.profile?.onboarding_done) throw redirect({ to: "/onboarding" });
    return data;
  },
  errorComponent: RouteError,
  component: Home,
});

function Home() {
  const { profile, testCount, testIds, hasManual } = Route.useLoaderData();
  const totalTests = TESTS.length;
  const percent = Math.round((testCount / totalTests) * 100);

  const hour = new Date().getHours();
  const greet = hour < 6 ? "夜深了" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <AppShell>
      <header className="home-header">
        <div className="min-w-0">
          <p className="home-kicker">PERSONAL FIELD GUIDE · 01</p>
          <h1 className="home-greeting">
            <span>{greet}</span>
            <strong>{profile?.nickname}</strong>
          </h1>
        </div>
        <Link to="/profile" className="home-avatar-link" aria-label="打开个人资料">
          <span className="home-avatar-frame">
            <UserAvatar avatar={profile?.avatar} className="h-full w-full text-2xl" />
          </span>
        </Link>
      </header>

      <section className="manual-feature relative mt-7 overflow-hidden">
        <div className="manual-feature-grain pointer-events-none absolute inset-0" />
        <span aria-hidden className="manual-feature-orbit manual-feature-orbit-one" />
        <span aria-hidden className="manual-feature-orbit manual-feature-orbit-two" />
        <img
          src={foxImg}
          alt=""
          aria-hidden
          className="manual-feature-fox pointer-events-none absolute object-contain"
        />
        <div className="manual-feature-topline">
          <span>MY PERSONAL MANUAL</span>
          <span>
            {String(testCount).padStart(2, "0")} / {String(totalTests).padStart(2, "0")}
          </span>
        </div>
        <div className="relative z-10 max-w-[15rem]">
          <p className="manual-feature-label">我的说明书</p>
          <p className="manual-feature-percent">
            {percent}
            <span>%</span>
          </p>
          <p className="manual-feature-copy">
            {hasManual
              ? "说明书已生成，随时可以翻阅"
              : testCount === 0
                ? "做第一个测试，开始写你的说明书"
                : `已完成 ${testCount}/${totalTests} 个测试，快集齐啦`}
          </p>
        </div>
        <div className="manual-feature-progress">
          <div
            className="h-full rounded-full bg-accent transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
        {testCount === 0 ? (
          <Link
            to="/tests/$testId"
            params={{ testId: TESTS[0]!.id }}
            className="manual-feature-cta"
          >
            <BookOpen className="h-4 w-4" />
            <span>开始第一个测试</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <Link to="/manual" className="manual-feature-cta">
            <BookOpen className="h-4 w-4" />
            <span>{hasManual ? "翻阅说明书" : "生成说明书"}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </section>

      <section className="mt-8">
        <div className="home-section-heading">
          <div>
            <p className="home-kicker">TEST LAB · DISCOVER YOUR PATTERNS</p>
            <h2 className="home-section-title">轻测试乐园</h2>
          </div>
          <span className="home-test-count">
            {testCount}/{totalTests}
          </span>
        </div>
        <div className="home-test-grid mt-4">
          {TESTS.map((t, i) => {
            const done = testIds.includes(t.id);
            return (
              <Link
                key={t.id}
                to="/tests/$testId"
                params={{ testId: t.id }}
                className={`home-test-card home-test-card-${i % 4} group relative overflow-hidden transition-transform hover:-translate-y-1 active:scale-[0.98]`}
              >
                <div className="home-test-card-top">
                  <span className="home-test-index">0{i + 1}</span>
                  {done && (
                    <span className="home-test-done">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <span className="home-test-icon">{t.emoji}</span>
                <h3 className="home-test-name">{t.name}</h3>
                <p className="home-test-desc">{t.desc}</p>
                <p className="home-test-meta">
                  <span>{done ? "已完成 · 点我重测" : `${t.minutes} · ${t.category}`}</span>
                  <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      <Link
        to="/counselor"
        className="home-counselor group mt-6 flex items-center gap-4 transition-transform hover:-translate-y-0.5"
      >
        <span className="home-counselor-mark">
          <img src={foxImg} alt="狐军师" className="h-12 w-12 object-contain" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="home-kicker">OPEN DESK · 24 / 7</p>
          <h3 className="home-counselor-title">狐军师在线</h3>
          <p className="home-counselor-copy">聊天开场、见面时机、吵架救场，尽管问</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </Link>
    </AppShell>
  );
}
