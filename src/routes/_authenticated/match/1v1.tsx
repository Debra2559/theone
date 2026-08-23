import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  HeartFilled,
  Loader2,
  MessageCircleHeart,
  Sparkles,
} from "@/components/app-icons";
import { createMatch, generateRelationshipManual, getMatchCandidates } from "@/lib/match.functions";
import { clearOneOnOneLock, getOneOnOneLock, setOneOnOneLock } from "@/lib/one-on-one";
import { AppShell } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import foxAsset from "@/assets/fox.png";

export const Route = createFileRoute("/_authenticated/match/1v1")({
  head: () => ({
    meta: [
      { title: "1v1 匹配 · 心动说明书" },
      { name: "description", content: "把一次心动，变成只属于你们两个人的相遇。" },
    ],
  }),
  loader: async ({ context }) => {
    const result = await getMatchCandidates();
    return {
      profile: context.profile,
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
  const [matchId, setMatchId] = useState<string | null>(null);
  const [manualState, setManualState] = useState<"idle" | "generating" | "ready" | "error">("idle");

  useEffect(() => {
    if (stage !== "pull") return;
    const timer = window.setTimeout(() => setStage("bridge"), 4600);
    return () => window.clearTimeout(timer);
  }, [stage]);

  useEffect(() => {
    if (stage !== "bridge" || !candidate || manualState === "generating" || manualState === "ready")
      return;
    let cancelled = false;
    const pair = async () => {
      setManualState("generating");
      try {
        const id = matchId ?? (await createMatch({ data: { personaId: candidate.persona.id } })).id;
        if (cancelled) return;
        setMatchId(id);
        await generateRelationshipManual({ data: { matchId: id } });
        if (!cancelled) setManualState("ready");
      } catch (error) {
        if (!cancelled) {
          setManualState("error");
          toast.error(error instanceof Error ? error.message : "关系说明书生成失败");
        }
      }
    };
    void pair();
    return () => {
      cancelled = true;
    };
  }, [candidate, manualState, matchId, stage]);

  const nickname = candidate?.persona.nickname ?? "这位心动对象";
  const avatar = candidate?.persona.avatar;
  const currentNickname = profile?.nickname ?? "你";

  useEffect(() => {
    const lock = getOneOnOneLock();
    if (!lock) return;
    setWish(lock.wish);
    setStage("bridge");
  }, []);

  const startOneOnOne = () => {
    if (!wish.trim()) return;
    setOneOnOneLock({
      candidateId: candidate?.persona.id ?? null,
      candidateNickname: nickname,
      wish: wish.trim(),
      startedAt: new Date().toISOString(),
    });
    setStage("pull");
  };

  const releaseOneOnOne = () => {
    clearOneOnOneLock();
    setWish("");
    setStage("notice");
    toast.success("已解除 1v1 专注，可以重新浏览推荐");
  };

  return (
    <AppShell>
      <div className="relative min-h-[calc(100dvh-9.5rem)] overflow-hidden">
        <header className="flex items-start gap-3">
          {stage === "notice" || stage === "brief" ? (
            <Link
              to="/match"
              aria-label="返回推荐"
              className="mt-0.5 rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={releaseOneOnOne}
              aria-label="解除 1v1"
              className="mt-0.5 rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <p className="eyebrow text-primary">One to One</p>
            <h1 className="mt-1 font-display text-[28px] font-semibold">只聊这一个人</h1>
          </div>
        </header>

        {stage === "notice" && (
          <section className="one-on-one-note-stage mt-6">
            <article className="one-on-one-note">
              <span className="one-on-one-note-tape" aria-hidden />
              <div className="one-on-one-note-heading">
                <span className="one-on-one-note-pin">
                  <HeartFilled className="h-4 w-4" />
                </span>
                <div>
                  <p className="eyebrow text-primary">A little promise</p>
                  <h2>给想认真认识一个人的你</h2>
                </div>
              </div>
              <div className="one-on-one-note-illustration">
                <div>
                  <p>一次只找一个人</p>
                  <strong>深度匹配</strong>
                </div>
                <img src={foxAsset} alt="狐军师插画" />
              </div>
              <p className="one-on-one-note-copy">
                1v1
                会根据你的测试、资料和诉求，帮你深度检索最匹配的那个人，并生成你们两人的专属说明书。
              </p>
              <div className="one-on-one-note-rules">
                <p>
                  <Check /> 这次只围绕 {nickname} 展开
                </p>
                <p>
                  <Check /> 确认后暂时不能查看或聊天其他人
                </p>
                <p>
                  <Check /> 想换人时，点击「解除 1v1」即可退出
                </p>
              </div>
              <p className="one-on-one-note-footer">把注意力交给一个人，故事才会真正开始。</p>
            </article>
            <button
              onClick={() => setStage("brief")}
              className="btn-starlight one-on-one-note-cta mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold"
            >
              写下我的诉求
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
              onClick={startOneOnOne}
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
              <div className="one-on-one-atmosphere" aria-hidden>
                <span className="scene-moon" />
                <span className="scene-cloud scene-cloud-one" />
                <span className="scene-cloud scene-cloud-two" />
              </div>
              <div className="cupid-character" aria-label="丘比特">
                <span className="cupid-wing cupid-wing-left" />
                <span className="cupid-wing cupid-wing-right" />
                <span className="cupid-body" />
                <span className="cupid-head">丘</span>
                <span className="cupid-bow" />
                <span className="cupid-bowstring" />
                <span className="cupid-label">丘比特</span>
              </div>
              <div className="love-arrow" aria-hidden>
                <span className="love-arrow-shaft" />
                <span className="love-arrow-heart" />
                <span className="love-arrow-spark" />
              </div>
              <div className="match-thread match-thread-me" aria-hidden />
              <div className="match-thread match-thread-them" aria-hidden />
              <div className="traveler traveler-me">
                <span className="traveler-shadow" aria-hidden />
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
                <span className="bridge-lamp bridge-lamp-left" />
                <span className="bridge-lamp bridge-lamp-right" />
                <span className="bridge-deck" />
                <span className="bridge-seam" />
                <span className="bridge-water bridge-water-one" />
                <span className="bridge-water bridge-water-two" />
              </div>
              <div className="scene-caption">
                {stage === "pull" ? "先别急，心动需要一点魔法" : "桥这边风很轻，刚好适合开始"}
              </div>
            </div>

            {stage === "bridge" && (
              <div className="relative z-10 mt-5 rounded-2xl bg-card/80 p-4 text-center shadow-sm backdrop-blur">
                <p className="text-sm font-semibold">你们已经到桥边</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">“{wish}”</p>
                <div className="mt-4 flex gap-2">
                  {manualState === "ready" && matchId ? (
                    <Link
                      to="/match/$matchId"
                      params={{ matchId }}
                      className="btn-starlight flex flex-1 items-center justify-center gap-1 rounded-full px-4 py-2.5 text-sm font-semibold"
                    >
                      查看你们的关系说明书
                      <MessageCircleHeart className="h-4 w-4" />
                    </Link>
                  ) : manualState === "error" ? (
                    <button
                      type="button"
                      onClick={() => setManualState("idle")}
                      className="btn-starlight flex flex-1 items-center justify-center gap-1 rounded-full px-4 py-2.5 text-sm font-semibold"
                    >
                      重新生成说明书
                      <Sparkles className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className="flex flex-1 items-center justify-center gap-2 rounded-full bg-primary/10 px-4 py-2.5 text-sm font-semibold text-primary">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在为你们写关系说明书…
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={releaseOneOnOne}
                  className="mt-3 text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                >
                  解除 1v1，重新浏览推荐
                </button>
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
