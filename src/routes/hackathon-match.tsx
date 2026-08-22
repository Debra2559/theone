import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, HeartFilled, MessageCircleHeart } from "@/components/app-icons";
import { getHackathonMatch, type HackathonPerson } from "@/lib/hackathon-match.functions";

export const Route = createFileRoute("/hackathon-match")({
  head: () => ({ meta: [{ title: "匹配样本 · 心动说明书" }] }),
  loader: () => getHackathonMatch(),
  errorComponent: ({ error }) => (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5">
      <div className="dreamy-card w-full max-w-md p-7 text-center">
        <p className="eyebrow text-primary">Sample unavailable</p>
        <h1 className="mt-2 font-display text-2xl font-semibold">样本暂时取不到</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{error.message}</p>
        <Link
          to="/auth"
          className="btn-starlight mt-6 inline-flex rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          回到登录
        </Link>
      </div>
    </div>
  ),
  component: HackathonMatchPage,
});

function genderLabel(gender: string) {
  return gender === "female" || gender === "女"
    ? "女生"
    : gender === "male" || gender === "男"
      ? "男生"
      : gender;
}

function statusLabel(status: string) {
  if (status.includes("BREAK_UP")) return "关系已结束";
  if (status.includes("MATCH")) return "已匹配";
  return status.replaceAll("_", " ");
}

function profileSections(profile: string) {
  return profile
    .split(/^## /m)
    .filter(Boolean)
    .map((section) => {
      const [title, ...lines] = section.split("\n");
      return {
        title: title?.trim() ?? "资料",
        content: lines
          .join("\n")
          .replace(/\*\*(.*?)\*\*/g, "$1")
          .replace(/`(.*?)`/g, "$1")
          .trim(),
      };
    });
}

function PersonCard({ person, accent }: { person: HackathonPerson; accent: "pink" | "blue" }) {
  const sections = profileSections(person.profile);
  return (
    <article className="dreamy-card overflow-hidden p-0">
      <div
        className={`border-b px-5 py-5 ${accent === "pink" ? "border-rose-foreground/15 bg-blush/45" : "border-chart-4/15 bg-candy-sky/40"}`}
      >
        <p className="eyebrow text-primary">Participant</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h2 className="font-display text-3xl font-semibold">{person.nickname}</h2>
          <span className="rounded-full bg-card/80 px-3 py-1 text-xs text-muted-foreground">
            {genderLabel(person.gender)}
          </span>
        </div>
      </div>
      <div className="space-y-5 p-5">
        {sections.map((section) => (
          <section key={section.title}>
            <h3 className="font-display text-lg font-semibold text-primary">{section.title}</h3>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted-foreground">
              {section.content}
            </p>
          </section>
        ))}
        <MemoryList title="TA 记得的自己" items={person.memories_self} />
        <MemoryList title="TA 想要的关系" items={person.memories_ideal} />
      </div>
    </article>
  );
}

function MemoryList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <section>
      <h3 className="font-display text-lg font-semibold text-primary">{title}</h3>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-muted-foreground">
        {items.slice(0, 4).map((item) => (
          <li key={item} className="border-l-2 border-accent/50 pl-3">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function HackathonMatchPage() {
  const match = Route.useLoaderData();
  return (
    <main className="min-h-dvh bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link
              to="/auth"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> 返回
            </Link>
            <p className="eyebrow mt-6 text-primary">Hackathon Match</p>
            <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">
              一份真实的心动样本
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-muted-foreground">
              接口返回的双方资料与聊天记录，整理成一页关系档案。
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-border/70 bg-card/70 px-3 py-2 text-right shadow-sm">
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Status</p>
            <p className="mt-1 text-sm font-semibold text-primary">
              {statusLabel(match.match_status)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{match.message_count} 条对话</p>
          </div>
        </header>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <PersonCard person={match.user_a} accent="pink" />
          <PersonCard person={match.user_b} accent="blue" />
        </div>

        <section className="mt-5 dreamy-card p-5 sm:p-7">
          <div className="flex items-center gap-2">
            <MessageCircleHeart className="h-5 w-5 text-primary" />
            <h2 className="font-display text-2xl font-semibold">聊天片段</h2>
            <span className="ml-auto text-xs text-muted-foreground">{match.match_id}</span>
          </div>
          <div className="mt-5 space-y-3">
            {match.messages.map((message, index) => {
              const isA = message.from === "a";
              return (
                <div
                  key={`${message.sent_at}-${index}`}
                  className={`flex ${isA ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[86%] rounded-2xl px-4 py-3 ${isA ? "rounded-tl-sm bg-blush/55" : "rounded-tr-sm bg-candy-sky/55"}`}
                  >
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="font-semibold">
                        {isA ? match.user_a.nickname : match.user_b.nickname}
                      </span>
                      <time>{message.sent_at}</time>
                    </div>
                    <p className="mt-1.5 text-sm leading-6">{message.content}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <HeartFilled className="h-4 w-4 text-rose-foreground" />
          <span>样本 ID：{match.match_id}</span>
        </div>
      </div>
    </main>
  );
}
