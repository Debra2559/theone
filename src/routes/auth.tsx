import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Loader2, Mail, Lock, Chrome } from "@/components/app-icons";
import foxImg from "@/assets/fox.png";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "登录 · 心动说明书" },
      { name: "description", content: "登录心动说明书，开启你的心动旅程。" },
      { property: "og:title", content: "登录 · 心动说明书" },
      { property: "og:description", content: "登录心动说明书，开启你的心动旅程。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Auth,
});

type Mode = "login" | "signup" | "forgot";

function Auth() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("重置邮件已发送，去邮箱看看吧 ✉️");
        return;
      }
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("注册成功！去邮箱点一下确认链接就完成啦 ✉️");
          setMode("login");
          return;
        }
        navigate({ to: "/home" });
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败，再试一次");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) toast.error("Google 登录失败，再试一次");
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-candy-pink/70 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-candy-lilac/70 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-56 w-56 -translate-x-1/2 rounded-full bg-candy-yellow/50 blur-3xl" />

      <div className="dreamy-card relative z-10 w-full max-w-md p-7">
        <div className="flex items-center gap-3">
          <img src={foxImg} alt="狐军师" className="h-12 w-12 object-contain" />
          <div>
            <h1 className="font-display text-2xl font-bold gradient-text">心动说明书</h1>
            <p className="text-xs text-muted-foreground">
              {mode === "login" && "欢迎回来，继续你的心动旅程"}
              {mode === "signup" && "加入我们，生成你的专属说明书"}
              {mode === "forgot" && "别慌，我们帮你找回账号"}
            </p>
          </div>
        </div>

        {mode !== "forgot" && (
          <div className="mt-6 flex rounded-full bg-secondary p-1">
            {(["login", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 rounded-full py-2 text-sm font-medium transition-all ${
                  mode === m ? "bg-card text-foreground shadow" : "text-muted-foreground"
                }`}
              >
                {m === "login" ? "登录" : "注册"}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" /> 邮箱
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
            />
          </label>
          {mode !== "forgot" && (
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Lock className="h-4 w-4" /> 密码
              </span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "至少 6 位" : "你的密码"}
                className="w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40"
              />
            </label>
          )}

          <button
            type="submit"
            disabled={busy}
            className="btn-starlight flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" && "登录"}
            {mode === "signup" && "注册"}
            {mode === "forgot" && "发送重置邮件"}
          </button>
        </form>

        {mode === "login" && (
          <button
            onClick={() => setMode("forgot")}
            className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            忘记密码了？
          </button>
        )}
        {mode === "forgot" && (
          <button
            onClick={() => setMode("login")}
            className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            想起来了，回去登录
          </button>
        )}

        {mode !== "forgot" && (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
              <div className="h-px flex-1 bg-border" />
              或者
              <div className="h-px flex-1 bg-border" />
            </div>
            <button
              onClick={google}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-input bg-card py-3 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <Chrome className="h-4 w-4" />
              用 Google 继续
            </button>
          </>
        )}
      </div>
    </div>
  );
}
