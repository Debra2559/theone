import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  HeartFilled,
  Loader2,
  MessageCircleHeart,
  Sparkles,
} from "@/components/app-icons";
import { getMyProfile } from "@/lib/app.functions";
import { getMatchCandidates } from "@/lib/match.functions";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";

export const Route = createFileRoute("/_authenticated/match/1v1")({
  head: () => ({
    meta: [
      { title: "1v1 匹配 · 心动说明书" },
      { name: "description", content: "把一次心动，变成只属于你们两个人的相遇。" },
    ],
  }),
  loader: async () => {
    const profile = await getMyProfile();
    if (!profile?.onboarding_done) throw redirect({ to: "/onboarding" });
    const result = await getMatchCandidates();
    return {
      profile,
      candidate: result.candidates.find((item) => !item.matched) ?? result.candidates[0] ?? null,
    };
  },
  component: OneOnOne,
});

type Stage = "notice" | "brief" | "pull" | "bridge";

function OneOnOne() {
  const { profile, candidate } = Route.useLoaderData();
  const [stage, setStage] = useState<Stage>("notice");
  const [wish, setWish] = useState("");

  useEffect(() => {
    if (stage !== "pull") return;
    const timer = window.setTimeout(() => setStage("bridge"), 2800);
    return () => window.clearTimeout(timer);
  }, [stage]);

  const nickname = candidate?.persona.nickname ?? "这位心动对象";
  const avatar = candidate?.persona.avatar;
  const currentNickname = profile?.nickname ?? "你";

  return (
    <AppShell>
      <div className="relative min-h-[calc(100dvh-9.5rem)] overflow-hidden">
        <header className="flex items-start gap-3">
          <Link
            to="/match"
            aria-label="返回推荐"
            className="mt-0.5 rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="eyebrow text-primary">One to One</p>
            <h1 className="mt-1 font-display text-[28px] font-semibold">只聊这一个人</h1>
          </div>
        </header>

        {stage === "notice" && (
          <section className="one-on-one-panel mt-7 p-6 sm:p-8">
            <div className="one-on-one-seal">
              <HeartFilled className="h-7 w-7" />
            </div>
            <p className="eyebrow mt-6 text-primary">A little promise</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">给这次相遇一封告知信</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              进入 1v1 后，你和 {nickname}{" "}
              会被放进同一座小桥边的房间。聊这个人的时候，暂时不能切换到其他人。
            </p>
            <div className="mt-5 space-y-2.5 rounded-2xl bg-secondary/60 p-4 text-sm leading-6">
              <p className="flex gap-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                你可以先写下这次想了解的事
              </p>
              <p className="flex gap-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                本次只围绕 {nickname} 展开
              </p>
              <p className="flex gap-2">
                <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                结束 1v1 后，随时可以回到推荐
              </p>
            </div>
            <button
              onClick={() => setStage("brief")}
              className="btn-starlight mt-7 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold"
            >
              我知道了，写下诉求
              <Sparkles className="h-4 w-4" />
            </button>
          </section>
        )}

        {stage === "brief" && (
          <section className="one-on-one-panel mt-7 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-secondary">
                <UserAvatar avatar={avatar} className="h-full w-full text-2xl" />
              </span>
              <div>
                <p className="eyebrow text-primary">To {nickname}</p>
                <h2 className="font-display text-xl font-semibold">你想先聊什么？</h2>
              </div>
            </div>
            <label className="mt-7 block">
              <span className="mb-2 block text-sm font-semibold">写给丘比特的纸条</span>
              <textarea
                autoFocus
                value={wish}
                onChange={(event) => setWish(event.target.value)}
                maxLength={180}
                rows={5}
                placeholder="比如：我想知道 TA 是不是也喜欢慢慢聊天，第一次开口可以聊什么？"
                className="w-full resize-none rounded-2xl border border-input bg-background/70 px-4 py-3 text-sm leading-7 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <span className="mt-1 block text-right text-[11px] text-muted-foreground">
                {wish.length}/180
              </span>
            </label>
            <button
              disabled={!wish.trim()}
              onClick={() => setStage("pull")}
              className="btn-starlight mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-45"
            >
              让丘比特出发
              <HeartFilled className="h-4 w-4" />
            </button>
          </section>
        )}

        {(stage === "pull" || stage === "bridge") && (
          <section className="one-on-one-panel one-on-one-scene-wrap mt-7 overflow-hidden p-4 sm:p-6">
            <div className="relative z-10 flex items-center justify-between gap-3 px-2">
              <div>
                <p className="eyebrow text-primary">Cupid is on the way</p>
                <h2 className="mt-1 font-display text-2xl font-semibold">
                  {stage === "pull" ? "正在把你们拉到一起" : "你们已经到桥边啦"}
                </h2>
              </div>
              <span className="rounded-full bg-card/80 px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
                {stage === "pull" ? "牵线中" : "牵线完成"}
              </span>
            </div>

            <div
              className={`one-on-one-scene mt-5 ${stage === "pull" ? "is-pulling" : "is-bridge"}`}
            >
              <div className="one-on-one-stars" aria-hidden />
              <div className="cupid-character" aria-label="丘比特">
                <span className="cupid-wing cupid-wing-left" />
                <span className="cupid-wing cupid-wing-right" />
                <span className="cupid-head">丘</span>
                <span className="cupid-bow" />
                <span className="cupid-label">丘比特</span>
              </div>
              <div className="love-arrow" aria-hidden>
                <span />
              </div>
              <div className="traveler traveler-me">
                <span className="traveler-avatar traveler-avatar-me">
                  <UserAvatar avatar={profile?.avatar} className="h-full w-full text-xl" />
                </span>
                <span>{currentNickname}</span>
              </div>
              <div className="traveler traveler-them">
                <span className="traveler-avatar traveler-avatar-them">
                  <UserAvatar avatar={avatar} className="h-full w-full text-xl" />
                </span>
                <span>{nickname}</span>
              </div>
              <div className="bridge-scene" aria-hidden>
                <span className="bridge-rail bridge-rail-left" />
                <span className="bridge-rail bridge-rail-right" />
                <span className="bridge-deck" />
                <span className="bridge-water bridge-water-one" />
                <span className="bridge-water bridge-water-two" />
              </div>
              <div className="scene-caption">
                {stage === "pull" ? "先别急，心动需要一点魔法" : "桥这边风很轻，刚好适合开始"}
              </div>
            </div>

            {stage === "bridge" && (
              <div className="relative z-10 mt-5 rounded-2xl bg-card/80 p-4 text-center shadow-sm backdrop-blur">
                <p className="text-sm font-semibold">诉求已收到</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">“{wish}”</p>
                <div className="mt-4 flex gap-2">
                  <Link
                    to="/match"
                    className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-semibold text-muted-foreground"
                  >
                    回到推荐
                  </Link>
                  <Link
                    to="/counselor"
                    className="btn-starlight flex flex-1 items-center justify-center gap-1 rounded-full px-4 py-2.5 text-sm font-semibold"
                  >
                    去聊天
                    <MessageCircleHeart className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            )}
          </section>
        )}

        {!candidate && stage !== "notice" && (
          <p className="mt-5 text-center text-xs text-muted-foreground">
            当前没有新的匹配，先回推荐看看吧。
          </p>
        )}

        {stage === "pull" && <Loader2 className="mx-auto mt-5 h-4 w-4 text-primary" />}
      </div>
    </AppShell>
  );
}
