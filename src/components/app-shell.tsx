import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Lock,
  Sparkles,
  Heart,
  HeartFilled,
  MessageCircleHeart,
  CircleUserRound,
} from "@/components/app-icons";
import { getOneOnOneLock, subscribeToOneOnOneLock } from "@/lib/one-on-one";

const NAV = [
  { to: "/home", label: "理解", icon: Sparkles },
  { to: "/match", label: "推荐", icon: Heart },
  { to: "/counselor", label: "消息", icon: MessageCircleHeart },
  { to: "/profile", label: "我的", icon: CircleUserRound },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [oneOnOneLock, setOneOnOneLock] = useState(() => getOneOnOneLock());

  useEffect(() => subscribeToOneOnOneLock(() => setOneOnOneLock(getOneOnOneLock())), []);

  return (
    <div className="min-h-dvh bg-background">
      {/* 手机画布：桌面端也保持 App 宽度的居中栏 */}
      <div className="app-canvas mx-auto min-h-dvh w-full max-w-md border-x border-border/50">
        <main className="relative z-10 px-5 pb-32 pt-8">{children}</main>
      </div>

      {/* 底部胶囊导航：选中 Tab 为柔和鸢尾紫晕染 */}
      <nav className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto w-full max-w-md">
          {/* 内容滑入导航前的渐隐过渡 */}
          <div className="pointer-events-none h-8 bg-gradient-to-t from-background via-background/70 to-transparent" />
          {oneOnOneLock && (
            <div className="one-on-one-lock-banner mx-5 mb-2 flex items-center gap-2 rounded-2xl border px-3 py-2.5 backdrop-blur-xl">
              <Lock className="h-4 w-4 shrink-0" />
              <p className="min-w-0 flex-1 truncate text-[11px]">
                1v1 专注中 · 正在寻找 {oneOnOneLock.candidateNickname}
              </p>
              <Link
                to="/match/1v1"
                className="shrink-0 text-[10px] font-semibold underline underline-offset-2"
              >
                查看
              </Link>
            </div>
          )}
          <div className="px-5 pb-5">
            <div className="app-nav flex items-center justify-between gap-1 rounded-full border p-1.5 backdrop-blur-xl">
              {NAV.map(({ to, label, icon: Icon }) => {
                const active = pathname.startsWith(to);
                const blocked = Boolean(oneOnOneLock) && (to === "/match" || to === "/counselor");
                const TabIcon = active && to === "/match" ? HeartFilled : Icon;
                if (blocked) {
                  return (
                    <span
                      key={to}
                      aria-label={`${label}（1v1 专注中）`}
                      aria-disabled="true"
                      className="flex flex-1 cursor-not-allowed flex-col items-center justify-center gap-[3px] rounded-full py-2 text-muted-foreground/35"
                    >
                      <Lock className="h-[17px] w-[17px]" />
                      <span className="font-display text-[10px] leading-none tracking-[0.14em]">
                        {label}
                      </span>
                    </span>
                  );
                }
                return (
                  <Link
                    key={to}
                    to={to}
                    aria-label={label}
                    className={`flex flex-1 flex-col items-center justify-center gap-[3px] rounded-full py-2 transition-all duration-300 active:scale-95 ${
                      active ? "bg-primary/10" : "hover:bg-primary/5"
                    }`}
                  >
                    <TabIcon
                      className={`h-[19px] w-[19px] transition-all duration-300 ${
                        active ? "scale-105 text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <span
                      className={`font-display text-[10px] leading-none tracking-[0.14em] transition-colors duration-300 ${
                        active ? "font-semibold text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>
    </div>
  );
}

export function RouteError({ error }: { error: Error }) {
  return (
    <AppShell>
      <div className="dreamy-card mx-auto mt-16 max-w-md p-8 text-center">
        <p className="text-4xl">💫</p>
        <h2 className="mt-3 font-display text-lg font-semibold">页面加载出了点小状况</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <Link
          to="/home"
          className="btn-starlight mt-5 inline-block rounded-full px-6 py-2 text-sm font-semibold"
        >
          回首页
        </Link>
      </div>
    </AppShell>
  );
}
