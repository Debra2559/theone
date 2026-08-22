import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronRight,
  Filter,
  Loader2,
  MessageCircleHeart,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "@/components/app-icons";
import { getMyProfile } from "@/lib/app.functions";
import { createThread, deleteThread, listThreads } from "@/lib/counselor.functions";
import { AppShell, RouteError } from "@/components/app-shell";
import { UserAvatar } from "@/components/user-avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import foxImg from "@/assets/fox.png";

export const Route = createFileRoute("/_authenticated/counselor")({
  head: () => ({
    meta: [
      { title: "狐军师 · 心动说明书" },
      { name: "description", content: "恋爱军师随时在线：回复建议、见面时机、关系陪跑。" },
      { property: "og:title", content: "狐军师 · 心动说明书" },
      { property: "og:description", content: "恋爱军师随时在线。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async () => {
    const profile = await getMyProfile();
    if (!profile?.onboarding_done) throw redirect({ to: "/onboarding" });
    return listThreads();
  },
  errorComponent: RouteError,
  component: Counselor,
});

const THREAD_TYPES = [
  { value: "self", label: "认识自己", desc: "解读说明书 · 自我成长", defaultTitle: "聊聊我自己" },
  {
    value: "external",
    label: "App 之外的 TA",
    desc: "微信阶段 · 吵架摩擦 · 忽冷忽热",
    defaultTitle: "关于那个 TA",
  },
  { value: "general", label: "随便聊聊", desc: "恋爱社交的任何东西", defaultTitle: "随便聊聊" },
] as const;

const TYPE_BADGES: Record<string, string> = {
  self: "认识自己",
  match: "匹配对象",
  external: "App 之外的 TA",
  general: "随便聊聊",
};

function Counselor() {
  const threads = Route.useLoaderData() as ThreadView[];
  const navigate = useNavigate();
  const [tab, setTab] = useState<"messages" | "activity">("messages");
  const [matchesOpen, setMatchesOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [matchesOnly, setMatchesOnly] = useState(false);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<(typeof THREAD_TYPES)[number]["value"]>("general");
  const [title, setTitle] = useState("");
  const [situation, setSituation] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const matchThreads = useMemo(
    () => threads.filter((thread) => thread.context_type === "match").slice(0, 3),
    [threads],
  );
  const visibleThreads = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return threads.filter((thread) => {
      const persona = getPersona(thread);
      const matchesFilter = !matchesOnly || thread.context_type === "match";
      const matchesQuery =
        !normalized ||
        [thread.title, thread.preview, thread.situation, persona?.nickname]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalized));
      return matchesFilter && matchesQuery;
    });
  }, [matchesOnly, query, threads]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const finalTitle = title.trim() || THREAD_TYPES.find((t) => t.value === type)!.defaultTitle;
      const { id } = await createThread({
        data: {
          title: finalTitle,
          context_type: type,
          situation: situation.trim(),
          match_id: null,
        },
      });
      setOpen(false);
      navigate({ to: "/counselor/$threadId", params: { threadId: id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
      setBusy(false);
    }
  };

  const remove = async (threadId: string) => {
    setDeletingId(threadId);
    try {
      await deleteThread({ data: { threadId } });
      toast.success("对话已删除");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
      setDeletingId(null);
    }
  };

  return (
    <AppShell>
      <div className="-mx-5 -mt-8 min-h-[calc(100dvh-9.5rem)] bg-background px-5 pb-8 pt-5">
        <header>
          <div className="flex justify-center border-b border-border/60">
            <div className="flex items-center gap-7" role="tablist" aria-label="互动视图">
              <button
                role="tab"
                aria-selected={tab === "messages"}
                onClick={() => setTab("messages")}
                className={`relative px-1 pb-3 text-[21px] font-semibold transition-colors ${
                  tab === "messages"
                    ? "text-foreground after:absolute after:inset-x-1/4 after:-bottom-px after:h-1 after:rounded-full after:bg-primary"
                    : "text-muted-foreground/45"
                }`}
              >
                消息
              </button>
              <button
                role="tab"
                aria-selected={tab === "activity"}
                onClick={() => setTab("activity")}
                className={`relative px-1 pb-3 text-[21px] font-semibold transition-colors ${
                  tab === "activity"
                    ? "text-foreground after:absolute after:inset-x-1/4 after:-bottom-px after:h-1 after:rounded-full after:bg-primary"
                    : "text-muted-foreground/45"
                }`}
              >
                动态
                {matchThreads.length > 0 && (
                  <span className="absolute -right-2 top-0 h-2 w-2 rounded-full bg-destructive" />
                )}
              </button>
            </div>
          </div>
        </header>

        {tab === "messages" ? (
          <>
            <section className="mt-7">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">
                  新的匹配 <span className="text-muted-foreground">({matchThreads.length})</span>
                </h2>
                <button
                  aria-label={matchesOpen ? "收起新的匹配" : "展开新的匹配"}
                  title={matchesOpen ? "收起新的匹配" : "展开新的匹配"}
                  onClick={() => setMatchesOpen((value) => !value)}
                  className="rounded-full p-2 text-muted-foreground transition-transform hover:bg-secondary"
                >
                  <ChevronRight
                    className={`h-5 w-5 transition-transform ${matchesOpen ? "rotate-90" : ""}`}
                  />
                </button>
              </div>
              {matchesOpen && (
                <div className="mt-4 flex gap-4 overflow-x-auto pb-1">
                  <Link
                    to="/manual"
                    className="group flex w-[72px] shrink-0 flex-col items-center gap-2"
                  >
                    <span className="relative flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[22px] border border-primary/10 bg-candy-sky shadow-sm transition-transform group-hover:-translate-y-0.5">
                      <BookOpen className="h-8 w-8 text-primary/55" />
                      <span className="absolute inset-x-0 bottom-0 bg-primary/65 py-1 text-center text-[10px] font-semibold text-primary-foreground">
                        已出题
                      </span>
                    </span>
                    <span className="max-w-full truncate text-xs text-muted-foreground">
                      我的说明书
                    </span>
                  </Link>
                  {matchThreads.map((thread) => {
                    const persona = getPersona(thread);
                    return (
                      <button
                        key={thread.id}
                        onClick={() =>
                          navigate({ to: "/counselor/$threadId", params: { threadId: thread.id } })
                        }
                        className="group flex w-[72px] shrink-0 flex-col items-center gap-2"
                      >
                        <span className="flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-[22px] border border-border bg-secondary shadow-sm transition-transform group-hover:-translate-y-0.5">
                          {persona ? (
                            <UserAvatar
                              avatar={persona.avatar}
                              className="h-full w-full text-3xl"
                            />
                          ) : (
                            <img src={foxImg} alt="" className="h-full w-full object-contain p-2" />
                          )}
                        </span>
                        <span className="max-w-full truncate text-xs text-muted-foreground">
                          {persona?.nickname ?? thread.title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold">全部消息</h2>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                      <button
                        aria-label="新的咨询"
                        title="新的咨询"
                        className="rounded-full p-2 hover:bg-secondary"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </DialogTrigger>
                    <DialogContent className="bg-card sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle className="font-display">想聊点什么？</DialogTitle>
                        <DialogDescription>选个方向，军师好对症下药</DialogDescription>
                      </DialogHeader>
                      <form onSubmit={create} className="space-y-4">
                        <div className="grid gap-2">
                          {THREAD_TYPES.map((t) => (
                            <button
                              type="button"
                              key={t.value}
                              onClick={() => setType(t.value)}
                              className={`rounded-xl border px-4 py-3 text-left transition-all ${type === t.value ? "border-primary bg-primary/10" : "border-input hover:bg-secondary"}`}
                            >
                              <p className="text-sm font-semibold">{t.label}</p>
                              <p className="text-xs text-muted-foreground">{t.desc}</p>
                            </button>
                          ))}
                        </div>
                        <label className="block">
                          <span className="mb-1.5 block text-sm text-muted-foreground">
                            给这段对话起个名
                          </span>
                          <input
                            maxLength={30}
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={THREAD_TYPES.find((t) => t.value === type)!.defaultTitle}
                            className="w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1.5 block text-sm text-muted-foreground">
                            先简单说说情况（选填）
                          </span>
                          <textarea
                            maxLength={500}
                            rows={3}
                            value={situation}
                            onChange={(e) => setSituation(e.target.value)}
                            placeholder="比如：TA 回复越来越慢…"
                            className="w-full resize-none rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
                          />
                        </label>
                        <button
                          type="submit"
                          disabled={busy}
                          className="btn-starlight flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:opacity-60"
                        >
                          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                          开始咨询
                        </button>
                      </form>
                    </DialogContent>
                  </Dialog>
                  <button
                    aria-label={searchOpen ? "关闭搜索" : "搜索消息"}
                    title={searchOpen ? "关闭搜索" : "搜索消息"}
                    onClick={() => setSearchOpen((value) => !value)}
                    className="rounded-full p-2 hover:bg-secondary"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                  <button
                    aria-label={matchesOnly ? "显示全部消息" : "只看匹配消息"}
                    title={matchesOnly ? "显示全部消息" : "只看匹配消息"}
                    onClick={() => setMatchesOnly((value) => !value)}
                    className={`rounded-full p-2 transition-colors hover:bg-secondary ${matchesOnly ? "bg-primary/10 text-primary" : ""}`}
                  >
                    <Filter className="h-5 w-5" />
                  </button>
                </div>
              </div>
              {searchOpen && (
                <div className="relative mt-3">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="搜索名字或消息"
                    className="w-full rounded-2xl border border-border bg-card px-9 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
              )}

              {visibleThreads.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
                  没有找到相关消息
                </div>
              ) : (
                <div className="mt-3 divide-y divide-border/70">
                  {visibleThreads.map((thread, index) => {
                    const persona = getPersona(thread);
                    const unread = thread.context_type === "match" && index < 2;
                    return (
                      <div key={thread.id} className="group flex items-center gap-3 py-4">
                        <button
                          onClick={() =>
                            navigate({
                              to: "/counselor/$threadId",
                              params: { threadId: thread.id },
                            })
                          }
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-secondary">
                            {persona ? (
                              <UserAvatar
                                avatar={persona.avatar}
                                className="h-full w-full text-2xl"
                              />
                            ) : (
                              <img
                                src={foxImg}
                                alt="狐军师"
                                className="h-full w-full object-contain p-1"
                              />
                            )}
                            {unread && (
                              <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-destructive" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-3">
                              <span className="truncate text-[15px] font-semibold">
                                {persona?.nickname ?? thread.title}
                              </span>
                              <time className="shrink-0 text-[10px] text-muted-foreground">
                                {formatTime(thread.previewAt ?? thread.updated_at)}
                              </time>
                            </span>
                            <span className="mt-1 block truncate text-sm text-muted-foreground">
                              {thread.preview || "还没有消息，点开开始聊天"}
                            </span>
                          </span>
                        </button>
                        <button
                          aria-label={`删除${thread.title}`}
                          title="删除消息"
                          onClick={() => remove(thread.id)}
                          disabled={deletingId === thread.id}
                          className="shrink-0 rounded-full p-2 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                        >
                          {deletingId === thread.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : (
          <section className="mt-7 space-y-3">
            <div className="rounded-2xl border border-primary/10 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" />
                </span>
                <div>
                  <p className="text-sm font-semibold">你的消息中心已更新</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    新的匹配和军师回复会出现在这里。
                  </p>
                </div>
              </div>
            </div>
            {matchThreads.map((thread) => {
              const persona = getPersona(thread);
              return (
                <button
                  key={thread.id}
                  onClick={() =>
                    navigate({ to: "/counselor/$threadId", params: { threadId: thread.id } })
                  }
                  className="flex w-full items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left transition-colors hover:bg-secondary/50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary">
                    <UserAvatar avatar={persona?.avatar} className="h-full w-full text-xl" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {persona?.nickname ?? thread.title} 的匹配消息
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {thread.preview}
                    </span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </section>
        )}
      </div>
    </AppShell>
  );
}

type ThreadView = {
  id: string;
  title: string;
  context_type: string;
  situation: string;
  updated_at: string;
  preview?: string;
  previewAt?: string;
  matches: unknown;
};

function getPersona(thread: ThreadView) {
  const matches = thread.matches as {
    personas?: { nickname: string; avatar?: string | null };
  } | null;
  return matches?.personas;
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });
}
