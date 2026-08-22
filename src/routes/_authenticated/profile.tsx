import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { getHomeData } from "@/lib/app.functions";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, RouteError } from "@/components/app-shell";
import { TESTS } from "@/lib/tests";
import { BookOpen, Pencil, LogOut, ChevronRight, MapPin, Cake } from "@/components/app-icons";
import { UserAvatar } from "@/components/user-avatar";
import foxImg from "@/assets/fox.png";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "我的 · 心动说明书" },
      { name: "description", content: "我的资料、说明书和账号设置。" },
      { property: "og:title", content: "我的 · 心动说明书" },
      { property: "og:description", content: "我的资料、说明书和账号设置。" },
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
  component: Profile,
});

const GENDER_LABEL: Record<string, string> = {
  male: "男生",
  female: "女生",
  secret: "保密",
};

function age(birthDate?: string | null) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a > 0 && a < 120 ? a : null;
}

function Profile() {
  const { profile, testCount, hasManual, matches } = Route.useLoaderData();
  const navigate = useNavigate();
  const myAge = age(profile?.birth_date);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <AppShell>
      <p className="eyebrow">Profile</p>
      <h1 className="mt-1 font-display text-[28px] font-semibold">我的</h1>

      {/* 资料卡 */}
      <section className="relative mt-5 overflow-hidden rounded-3xl border border-foreground/5 bg-gradient-to-br from-candy-pink via-candy-peach/70 to-candy-lilac p-6">
        <div className="bokeh pointer-events-none absolute inset-0" />
        <span aria-hidden className="animate-twinkle absolute right-24 top-6 text-xs text-rose">✦</span>
        <img
          src={foxImg}
          alt=""
          aria-hidden
          className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 -rotate-6 object-contain opacity-80"
        />
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card shadow-sm">
            <UserAvatar avatar={profile?.avatar} className="h-full w-full text-4xl" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate font-display text-2xl font-semibold">
              {profile?.nickname}
              {myAge && <span className="ml-2 text-base font-normal text-foreground/60">{myAge}岁</span>}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-foreground/60">
              <span>{GENDER_LABEL[profile?.gender ?? "secret"]}</span>
              {profile?.city && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-3 w-3" /> {profile.city}
                </span>
              )}
              {profile?.birth_date && (
                <span className="flex items-center gap-0.5">
                  <Cake className="h-3 w-3" /> {profile.birth_date.slice(5)}
                </span>
              )}
            </div>
          </div>
        </div>
        {profile?.bio && (
          <p className="mt-3 rounded-2xl bg-card/70 px-4 py-2.5 text-sm text-foreground/80">
            {profile.bio}
          </p>
        )}
      </section>

      {/* 数据速览 */}
      <section className="mt-4 grid grid-cols-3 gap-3">
        <div className="dreamy-card p-4 text-center">
          <p className="font-display text-2xl font-semibold">
            {testCount}
            <span className="text-sm font-normal text-muted-foreground">/{TESTS.length}</span>
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">已完成测试</p>
        </div>
        <div className="dreamy-card p-4 text-center">
          <p className="font-display text-2xl font-semibold">{hasManual ? "✅" : "📝"}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {hasManual ? "说明书已生成" : "说明书待生成"}
          </p>
        </div>
        <div className="dreamy-card p-4 text-center">
          <p className="font-display text-2xl font-semibold">{matches.length}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">心动对象</p>
        </div>
      </section>

      {/* 菜单 */}
      <section className="mt-4 space-y-3">
        <Link
          to="/manual"
          className="dreamy-card group flex items-center gap-4 p-5 transition-transform hover:-translate-y-0.5"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-candy-lilac">
            <BookOpen className="h-5 w-5 text-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">我的说明书</p>
            <p className="text-xs text-muted-foreground">
              {hasManual ? "查看或重新生成" : "做完测试就能生成"}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          to="/onboarding"
          search={{ edit: true }}
          className="dreamy-card group flex items-center gap-4 p-5 transition-transform hover:-translate-y-0.5"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-candy-mint">
            <Pencil className="h-5 w-5 text-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">编辑资料</p>
            <p className="text-xs text-muted-foreground">昵称、生日、城市、一句话介绍</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        <button
          onClick={signOut}
          className="dreamy-card group flex w-full items-center gap-4 p-5 text-left transition-transform hover:-translate-y-0.5"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary">
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-muted-foreground">退出登录</p>
            <p className="text-xs text-muted-foreground">说明书会帮你保管好</p>
          </div>
        </button>
      </section>

      <p className="mt-8 text-center text-[11px] text-muted-foreground">
        心动说明书 · 写给宇宙的一封自我介绍 ✨
      </p>
    </AppShell>
  );
}
