import { createFileRoute, Link, notFound, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, RotateCcw, ArrowLeft, BookOpen } from "@/components/app-icons";
import { generateManual, getMyProfile, saveTestResult } from "@/lib/app.functions";
import { AppShell, RouteError } from "@/components/app-shell";
import { TESTS, getTest, scoreQuiz, computeZodiac, computeBazi } from "@/lib/tests";

export const Route = createFileRoute("/_authenticated/tests_/$testId")({
  head: () => ({
    meta: [
      { title: "测试 · 心动说明书" },
      { name: "description", content: "一个关于你的小测试。" },
      { property: "og:title", content: "测试 · 心动说明书" },
      { property: "og:description", content: "一个关于你的小测试。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { invite?: string } => {
    const invite =
      typeof search["invite"] === "string" && /^[a-f0-9]{32}$/i.test(search["invite"])
        ? search["invite"]
        : undefined;
    return invite ? { invite } : {};
  },
  loader: async ({ params }) => {
    const test = getTest(params.testId);
    if (!test) throw notFound();
    if (test.kind === "game") throw redirect({ to: "/game" }); // 剧场类测试走独立游戏页
    const profile = await getMyProfile();
    if (!profile?.onboarding_done) throw redirect({ to: "/onboarding" });
    return { test, birthDate: profile.birth_date ?? null };
  },
  errorComponent: RouteError,
  notFoundComponent: () => (
    <AppShell>
      <div className="dreamy-card mx-auto mt-16 max-w-md p-8 text-center">
        <p className="text-4xl">🔭</p>
        <p className="mt-3 font-display font-semibold">这个测试不存在</p>
        <Link
          to="/home"
          className="btn-starlight mt-5 inline-block rounded-full px-6 py-2 text-sm font-semibold"
        >
          回理解页
        </Link>
      </div>
    </AppShell>
  ),
  component: TestRunner,
});

type DoneResult = { testId: string; emoji: string; label: string; summary: string };

function TestRunner() {
  const { test, birthDate } = Route.useLoaderData();
  const { invite } = Route.useSearch();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [results, setResults] = useState<DoneResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);

  const save = async (
    testId: string,
    answersPayload: Record<string, unknown>,
    result: Record<string, unknown>,
  ) => {
    await saveTestResult({ data: { test_id: testId, answers: answersPayload, result } });
  };

  const answer = async (optionIndex: number) => {
    if (busy) return;
    const next = [...answers, optionIndex];
    setAnswers(next);
    if (next.length < test.questions.length) {
      setIndex(next.length);
      return;
    }
    setBusy(true);
    try {
      const scored = scoreQuiz(test, next);
      await save(
        test.id,
        { answers: next },
        { type: scored.type, label: scored.label, summary: scored.summary, detail: scored.detail },
      );
      setResults([
        { testId: test.id, emoji: test.emoji, label: scored.label, summary: scored.summary },
      ]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败，再点一次试试");
    } finally {
      setBusy(false);
    }
  };

  const runBirthday = async () => {
    if (!birthDate) {
      toast.error("先去补充生日信息吧");
      navigate({ to: "/onboarding", search: invite ? { invite } : {} });
      return;
    }
    setBusy(true);
    try {
      if (test.resultKey === "zodiac") {
        const z = computeZodiac(birthDate);
        const label = `${z.sign} · 属${z.animal}`;
        const summary = `${z.element}星座，生肖${z.animal}`;
        await save(test.id, { birth_date: birthDate }, { type: z.sign, label, summary, detail: z });
        setResults([{ testId: test.id, emoji: test.emoji, label, summary }]);
      } else {
        const b = computeBazi(birthDate);
        const label = `${b.pillar}年 · ${b.element}命`;
        await save(
          test.id,
          { birth_date: birthDate },
          { type: b.pillar, label, summary: b.trait, detail: b },
        );
        setResults([{ testId: test.id, emoji: test.emoji, label, summary: b.trait }]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  };

  const goManual = async () => {
    setGenerating(true);
    try {
      await generateManual();
      toast.success("说明书已更新 ✨");
      if (invite) {
        navigate({ to: "/invite/$token", params: { token: invite } });
      } else {
        navigate({ to: "/manual" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "生成失败");
      setGenerating(false);
    }
  };

  /* ---------- 结果页 ---------- */
  if (results) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl">
          {results.map((r) => (
            <div key={r.testId} className="dreamy-card relative mb-5 overflow-hidden p-7">
              <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-accent" />
              <div className="text-center">
                <span className="text-5xl">{r.emoji}</span>
                <h1 className="font-display mt-3 text-2xl font-bold gradient-text">{r.label}</h1>
                {r.summary && <p className="mt-2 text-sm text-muted-foreground">{r.summary}</p>}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                setResults(null);
                setAnswers([]);
                setIndex(0);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-input px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <RotateCcw className="h-4 w-4" /> 重新测
            </button>
            <Link
              to="/home"
              search={invite ? { invite } : {}}
              className="inline-flex items-center gap-1.5 rounded-full border border-input px-5 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <ArrowLeft className="h-4 w-4" /> 更多测试
            </Link>
            <button
              onClick={goManual}
              disabled={generating}
              className="btn-starlight inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookOpen className="h-4 w-4" />
              )}
              更新我的说明书
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  /* ---------- 生日类测试 ---------- */
  if (test.kind === "birthday") {
    return (
      <AppShell>
        <div className="mx-auto max-w-lg">
          <div className="dreamy-card relative overflow-hidden p-8 text-center">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-accent" />
            <span className="text-5xl">{test.emoji}</span>
            <h1 className="font-display mt-3 text-2xl font-bold">{test.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{test.desc}</p>
            {birthDate ? (
              <>
                <p className="mt-5 rounded-xl bg-secondary/60 px-4 py-3 text-sm">
                  将根据你的生日 <span className="font-semibold text-primary">{birthDate}</span>{" "}
                  自动推算
                </p>
                <button
                  onClick={runBirthday}
                  disabled={busy}
                  className="btn-starlight mt-6 inline-flex items-center gap-2 rounded-full px-8 py-3 text-sm font-semibold disabled:opacity-60"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  揭晓答案 ✨
                </button>
              </>
            ) : (
              <>
                <p className="mt-5 rounded-xl bg-secondary/60 px-4 py-3 text-sm">
                  这个测试需要你的生日信息，先去补一下吧
                </p>
                <button
                  onClick={() => navigate({ to: "/onboarding" })}
                  className="btn-starlight mt-6 rounded-full px-8 py-3 text-sm font-semibold"
                >
                  去补充生日
                </button>
              </>
            )}
          </div>
        </div>
      </AppShell>
    );
  }

  /* ---------- 问答测试 ---------- */
  const q = test.questions[index];
  const total = test.questions.length;
  const progress = Math.round((index / total) * 100);

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <Link
            to="/home"
            search={invite ? { invite } : {}}
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> 退出
          </Link>
          <span className="text-sm text-muted-foreground">
            {Math.min(index + 1, total)} / {total}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: "var(--gradient-starlight)" }}
          />
        </div>

        {q && (
          <div className="dreamy-card relative mt-6 overflow-hidden p-7 md:p-9">
            <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-primary via-secondary to-accent" />
            <p className="text-xs font-semibold tracking-widest text-primary/70">
              {test.emoji} {test.name}
            </p>
            <h1 className="font-display mt-3 text-xl font-bold leading-relaxed md:text-2xl">
              {q.text}
            </h1>
            <div className="mt-6 space-y-3">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={busy}
                  className="group flex w-full items-center gap-3 rounded-2xl border border-input bg-card/60 px-5 py-4 text-left text-sm transition-all hover:border-primary hover:bg-primary/10 disabled:opacity-60"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    {String.fromCharCode(65 + i)}
                  </span>
                  {opt.text}
                </button>
              ))}
            </div>
            {busy && (
              <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 正在为你解读…
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// 保持引用，避免未使用告警
void TESTS;
