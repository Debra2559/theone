import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Loader2, Sparkles } from "@/components/app-icons";
import { generateManual, getMyProfile, saveTestResult } from "@/lib/app.functions";
import { avatarDataUri } from "@/lib/avatars";
import { loveGameMessageSchema, type LoveGamePayload } from "@/lib/love-game-schema";

/**
 * 恋爱人格剧场 · 沉浸式互动小游戏
 *
 * 小游戏以 iframe 形式整体挂在 public/game/ 下独立运行（样式零冲突），
 * 进入时把用户资料（昵称/头像/性别）postMessage 注入游戏（love-game:profile），
 * 游戏不再有开场表单，直接以宿主资料开局；
 * 玩家通关后游戏会 postMessage 画像结果（love-game:result，含证据链与阶段统计），
 * 这里负责把结果写入 test_results（test_id = love-dialogue），
 * 之后「生成说明书」会自动把这份画像喂给 AI，产出更丰富的个人说明书。
 */

export const Route = createFileRoute("/_authenticated/game")({
  head: () => ({
    meta: [
      { title: "恋爱人格剧场 · 心动说明书" },
      { name: "description", content: "30 幕沉浸式对话剧情，玩出你的爱情人格画像。" },
      { property: "og:title", content: "恋爱人格剧场 · 心动说明书" },
      { property: "og:description", content: "30 幕沉浸式对话剧情，玩出你的爱情人格画像。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    const profile = await getMyProfile();
    if (!profile?.onboarding_done) throw redirect({ to: "/onboarding" });
    return { profile };
  },
  component: GamePage,
});

function GamePage() {
  const navigate = useNavigate();
  const { profile } = Route.useLoaderData();
  const [synced, setSynced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const saveToken = useRef(0);
  const savingResultKey = useRef<string | null>(null);
  const savedResultKey = useRef<string | null>(null);

  /* 进入剧场：把用户资料注入游戏（昵称 / 头像 / 性别），游戏侧据此开局 */
  const sendProfile = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "love-game:profile",
        payload: {
          nickname: profile?.nickname ?? "",
          gender: profile?.gender ?? "", // 男生 | 女生 | 保密
          avatar: profile?.avatar ?? "", // emoji 或 db: 插画头像标识
          avatarImg: avatarDataUri(profile?.avatar) ?? "", // DiceBear 渲染好的 data URI
        },
      },
      window.location.origin,
    );
  }, [profile]);

  const syncResult = useCallback(async (payload: LoveGamePayload) => {
    const resultKey = JSON.stringify([payload.profile.generated_at, payload.choices]);
    if (savingResultKey.current === resultKey || savedResultKey.current === resultKey) return;
    savingResultKey.current = resultKey;
    const token = ++saveToken.current;
    setSaving(true);
    setSynced(false);
    try {
      const p = payload.profile ?? {};
      const label = `${p.archetype_emoji ?? "🎭"} ${p.archetype_name ?? "恋爱人格"}`;
      const cp = p["communicate_password"];
      const summary =
        (Array.isArray(cp) && cp.length
          ? cp.filter(Boolean).join("；")
          : typeof cp === "string"
            ? cp
            : "") || "由 30 幕对话剧情生成的爱情人格画像";
      await saveTestResult({
        data: {
          test_id: "love-dialogue",
          answers: {
            choices: payload.choices,
            stageStats: payload.stageStats ?? p.stage_stats ?? {},
          },
          result: {
            type: p.archetype ?? "unknown",
            label,
            summary,
            detail: p, // 完整画像（含 evidence 证据链 / stage_stats / dimension_confidence）
          },
        },
      });
      savedResultKey.current = resultKey;
      if (token === saveToken.current) {
        setSynced(true);
        toast.success("画像已同步，可以更新你的说明书了 ✨");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "画像同步失败，可通关后重试");
    } finally {
      if (savingResultKey.current === resultKey) savingResultKey.current = null;
      if (token === saveToken.current) setSaving(false);
    }
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe || e.source !== iframe.contentWindow || e.origin !== window.location.origin)
        return;
      const parsed = loveGameMessageSchema.safeParse(e.data);
      if (parsed.success) void syncResult(parsed.data.payload);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [syncResult]);

  const goManual = async () => {
    setGenerating(true);
    try {
      await generateManual();
      toast.success("说明书已更新 ✨");
      navigate({ to: "/manual" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成失败，稍后再试");
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0d0a14]">
      {/* 游戏本体：iframe 全屏，独立运行；onLoad 后注入用户资料 */}
      <iframe
        ref={iframeRef}
        src="/game/index.html"
        title="恋爱人格剧场"
        className="h-full w-full border-0"
        allow="fullscreen"
        onLoad={sendProfile}
      />

      {/* 顶部退出条 */}
      <button
        onClick={() => navigate({ to: "/home" })}
        className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/35 px-3.5 py-2 text-xs font-medium text-white/90 backdrop-blur-md transition-colors hover:bg-black/55"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> 退出剧场
      </button>

      {/* 通关后浮出的同步/更新条 */}
      {(saving || synced) && (
        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-center gap-3 border-t border-white/10 bg-black/60 px-4 py-3.5 backdrop-blur-xl">
          {saving ? (
            <span className="flex items-center gap-2 text-sm text-white/85">
              <Loader2 className="h-4 w-4 animate-spin" /> 正在同步你的画像…
            </span>
          ) : (
            <>
              <span className="flex items-center gap-1.5 text-sm text-white/85">
                <Sparkles className="h-4 w-4 text-amber-300" /> 画像已写入，让说明书更懂你
              </span>
              <button
                onClick={goManual}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-secondary px-5 py-2 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03] disabled:opacity-60"
              >
                {generating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <BookOpen className="h-4 w-4" />
                )}
                更新我的说明书
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
