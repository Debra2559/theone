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

const CANDIES = [
  "bg-candy-lilac",
  "bg-candy-yellow",
  "bg-candy-pink",
  "bg-candy-mint",
  "bg-candy-sky",
  "bg-candy-peach",
] as const;

function Home() {
  const { profile, testCount, testIds, hasManual } = Route.useLoaderData();
  const totalTests = TESTS.length;
  const percent = Math.round((testCount / totalTests) * 100);

  const hour = new Date().getHours();
  const greet = hour < 6 ? "夜深了" : hour < 12 ? "早上好" : hour < 18 ? "下午好" : "晚上好";

  return (
    <AppShell>
      {/* 问候头部 */}
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="eyebrow">{greet}</p>
          <h1 className="mt-1 truncate font-display text-[28px] font-semibold leading-tight">
            {profile?.nickname}
          </h1>
        </div>
        <Link to="/profile" className="shrink-0">
          <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-candy-pink ring-2 ring-card shadow-sm">
            <UserAvatar avatar={profile?.avatar} className="h-full w-full text-2xl" />
          </span>
        </Link>
      </header>

      {/* 说明书大卡 */}
      <section className="romance-gradient relative mt-6 overflow-hidden rounded-3xl border border-foreground/5 p-6">
        <div className="bokeh pointer-events-none absolute inset-0" />
        <span aria-hidden className="animate-twinkle absolute left-6 top-6 text-sm text-rose">✦</span>
        <span aria-hidden className="animate-twinkle absolute bottom-8 right-28 text-xs text-accent" style={{ animationDelay: "1.1s" }}>✦</span>
        <img
          src={foxImg}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -right-3 -top-3 h-24 w-24 rotate-6 object-contain opacity-90"
        />
        <span className="rounded-full bg-foreground/80 px-3 py-1 text-[11px] font-semibold text-background">
          我的说明书
        </span>
        <p className="mt-4 font-display text-5xl font-semibold tracking-tight">
          {percent}
          <span className="text-2xl font-normal">%</span>
        </p>
        <p className="mt-1 text-sm font-medium text-foreground/70">
          {hasManual
            ? "说明书已生成，随时可以翻阅"
            : testCount === 0
              ? "做第一个测试，开始写你的说明书"
              : `已完成 ${testCount}/${totalTests} 个测试，快集齐啦`}
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-card/70">
          <div
            className="h-full rounded-full bg-foreground transition-all duration-700"
            style={{ width: `${percent}%` }}
          />
        </div>
        {testCount === 0 ? (
          <Link
            to="/tests/$testId"
            params={{ testId: TESTS[0]!.id }}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
          >
            开始第一个测试
          </Link>
        ) : (
          <Link
            to="/manual"
            className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5"
          >
            <BookOpen className="h-4 w-4" />
            {hasManual ? "翻阅说明书" : "生成说明书"}
          </Link>
        )}
      </section>

      {/* 测试乐园 */}
      <section className="mt-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">Test Lab</p>
            <h2 className="mt-1 font-display text-xl font-semibold">轻测试乐园</h2>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
            {testCount}/{totalTests}
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {TESTS.map((t, i) => {
            const done = testIds.includes(t.id);
            return (
              <Link
                key={t.id}
                to="/tests/$testId"
                params={{ testId: t.id }}
                className={`group relative overflow-hidden rounded-3xl border border-foreground/5 ${CANDIES[i % CANDIES.length]} p-4 transition-transform hover:-translate-y-1 active:scale-[0.98]`}
              >
                <div className="flex items-start justify-between">
                  <span className="text-3xl">{t.emoji}</span>
                  {done && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
                <h3 className="mt-3 font-display text-sm font-semibold">{t.name}</h3>
                <p className="mt-0.5 flex items-center gap-0.5 text-[11px] font-medium text-foreground/60">
                  {done ? "已完成 · 点我重测" : `${t.minutes} · ${t.category}`}
                  <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </p>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 军师入口 */}
      <Link
        to="/counselor"
        className="dreamy-card group mt-6 flex items-center gap-4 p-5 transition-transform hover:-translate-y-0.5"
      >
        <img src={foxImg} alt="狐军师" className="h-14 w-14 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold">狐军师在线</h3>
          <p className="truncate text-xs text-muted-foreground">
            聊天开场、见面时机、吵架救场，尽管问
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </Link>
    </AppShell>
  );
}
