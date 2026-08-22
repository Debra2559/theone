import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, BookOpen, Loader2, Sparkles } from "@/components/app-icons";
import { generateManual, getMyProfile, saveTestResult } from "@/lib/app.functions";

/**
 * 恋爱人格剧场 · 沉浸式互动小游戏
 *
 * 小游戏以 iframe 形式整体挂在 public/game/ 下独立运行（样式零冲突），
 * 玩家通关后游戏会 postMessage 画像结果（love-game:result），
 * 这里负责把结果写入 test_results（test_id = love-dialogue），
 * 之后「生成说明书」会自动把这份画像喂给 AI，产出更丰富的个人说明书。
 */

type GamePayload = {
  profile: {
    archetype?: string;
    archetype_name?: string;
    archetype_emoji?: string;
    dimensions?: Record<string, number>;
    [key: string]: unknown;
  };
  choices: Array<{
    scenarioId: string;
    optionIndex: number;
    optionText: string;
  }>;
};

export const Route = createFileRoute("/_authenticated/game")({
  head: () => ({
    meta: [
      { title: "恋爱人格剧场 · 心动说明书" },
      { name: "description", content: "15 幕沉浸式对话剧情，玩出你的爱情人格画像。" },
      { property: "og:title", content: "恋爱人格剧场 · 心动说明书" },
      { property: "og:description", content: "15 幕沉浸式对话剧情，玩出你的爱情人格画像。" },
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
  const [synced, setSynced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const saveToken = useRef(0); // 防重复保存（iframe 内重玩会再次上报）

  const syncResult = useCallback(async (payload: GamePayload) => {
    const token = ++saveToken.current;
    setSaving(true);
    try {
      const p = payload.profile ?? {};
      const label = `${p.archetype_emoji ?? "🎭"} ${p.archetype_name ?? "恋爱人格"}`;
      const summary =
        (p.communicate_password && typeof p.communicate_password === "object"
          ? String((p.communicate_password as { label?: string }).label ?? "")
          : "") || "由 15 幕对话剧情生成的爱情人格画像";
      await saveTestResult({
        data: {
          test_id: "love-dialogue",
          answers: { choices: payload.choices ?? [] },
          result: {
            type: p.archetype ?? "unknown",
            label,
            summary,
            detail: p,
          },
        },
      });
      if (token === saveToken.current) {
        setSynced(true);
        toast.success("画像已同步，可以更新你的说明书了 ✨");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "画像同步失败，可通关后重试");
    } finally {
      if (token === saveToken.current) setSaving(false);
    }
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data as { type?: string; payload?: GamePayload } | null;
      if (data?.type === "love-game:result" && data.payload?.profile) {
        void syncResult(data.payload);
      }
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
      {/* 游戏本体：iframe 全屏，独立运行 */}
      <iframe
        src="/game/index.html"
        title="恋爱人格剧场"
        className="h-full w-full border-0"
        allow="fullscreen"
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
