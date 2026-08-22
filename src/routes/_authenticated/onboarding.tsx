import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "@/components/app-icons";
import { getMyProfile, saveProfile } from "@/lib/app.functions";
import { avatarBatch, DEFAULT_AVATAR } from "@/lib/avatars";
import { UserAvatar } from "@/components/user-avatar";
import foxImg from "@/assets/fox.png";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "初次见面 · 心动说明书" },
      { name: "description", content: "填写基础资料，开启你的专属说明书。" },
      { property: "og:title", content: "初次见面 · 心动说明书" },
      { property: "og:description", content: "填写基础资料，开启你的专属说明书。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { edit?: boolean } => {
    const edit = search["edit"] === true || search["edit"] === "true";
    return edit ? { edit: true } : {};
  },
  loaderDeps: ({ search }) => ({ edit: search.edit }),
  loader: async ({ deps }) => {
    const profile = await getMyProfile();
    if (profile?.onboarding_done && !deps.edit) throw redirect({ to: "/home" });
    return profile;
  },
  component: Onboarding,
});


const GENDERS = [
  { value: "male", label: "男生" },
  { value: "female", label: "女生" },
  { value: "secret", label: "保密" },
];

function Onboarding() {
  const navigate = useNavigate();
  const profile = Route.useLoaderData();
  const { edit } = Route.useSearch();
  const [nickname, setNickname] = useState(profile?.nickname ?? "");
  const [gender, setGender] = useState(profile?.gender ?? "secret");
  const [birthDate, setBirthDate] = useState(profile?.birth_date ?? "");
  const [city, setCity] = useState(profile?.city ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [batchOffset, setBatchOffset] = useState(0);
  const [choices] = useState(() => avatarBatch(10, 0));
  const [avatar, setAvatar] = useState(profile?.avatar ?? DEFAULT_AVATAR);
  const [busy, setBusy] = useState(false);
  const shown = batchOffset === 0 ? choices : avatarBatch(10, batchOffset);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!birthDate) {
      toast.error("生日很重要哦，星座和八字都靠它");
      return;
    }
    setBusy(true);
    try {
      await saveProfile({
        data: {
          nickname,
          gender,
          birth_date: birthDate,
          birth_time: "12:00",
          city,
          bio,
          avatar,
        },
      });
      toast.success(edit ? "资料已更新 ✨" : "资料保存好啦，欢迎入住小镇 ✨");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
      setBusy(false);
    }
  };

  return (
    <div className="starfield flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="dreamy-card w-full max-w-lg p-8">
        <div className="flex items-center gap-3">
          <img src={foxImg} alt="狐军师" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="font-display text-2xl font-bold gradient-text">{edit ? "编辑资料 ✏️" : "初次见面 👋"}</h1>
            <p className="text-xs text-muted-foreground">{edit ? "更新你的信息，说明书会更准" : "先认识一下你，30 秒就好"}</p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">挑一个你的专属形象</p>
              <button
                type="button"
                onClick={() => setBatchOffset((v) => v + 10)}
                className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
                换一批
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {shown.map((a) => (
                <button
                  type="button"
                  key={a}
                  onClick={() => setAvatar(a)}
                  className={`flex aspect-square items-center justify-center rounded-2xl transition-all ${
                    avatar === a
                      ? "scale-105 bg-primary/15 ring-2 ring-primary"
                      : "bg-secondary hover:bg-secondary/70"
                  }`}
                >
                  <UserAvatar avatar={a} className="h-11 w-11" />
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm text-muted-foreground">怎么称呼你？</span>
            <input
              required
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="给自己起个好听的名字"
              className="w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </label>

          <div>
            <p className="mb-2 text-sm text-muted-foreground">性别</p>
            <div className="flex gap-2">
              {GENDERS.map((g) => (
                <button
                  type="button"
                  key={g.value}
                  onClick={() => setGender(g.value)}
                  className={`flex-1 rounded-xl py-2.5 text-sm transition-all ${
                    gender === g.value
                      ? "bg-primary/25 font-semibold text-primary ring-1 ring-primary"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted-foreground">生日 🎂</span>
              <input
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                min="1970-01-01"
                max="2010-12-31"
                className="w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm text-muted-foreground">所在城市</span>
              <input
                maxLength={20}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="比如：上海"
                className="w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm text-muted-foreground">
              一句话介绍自己 <span className="text-xs">（选填）</span>
            </span>
            <textarea
              maxLength={60}
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="比如：周末在livehouse，平时在健身房"
              className="w-full resize-none rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="btn-starlight flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {edit ? "保存修改" : "出发，去做测试 ✨"}
          </button>
        </form>
      </div>
    </div>
  );
}
