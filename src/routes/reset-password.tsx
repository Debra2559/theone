import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Lock } from "@/components/app-icons";
import foxImg from "@/assets/fox.png";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "重置密码 · 心动说明书" },
      { name: "description", content: "设置你的新密码。" },
      { property: "og:title", content: "重置密码 · 心动说明书" },
      { property: "og:description", content: "设置你的新密码。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 重置链接带 type=recovery 的 hash，supabase 客户端会自动建立 recovery 会话
    const hash = window.location.hash;
    if (!hash.includes("type=recovery")) {
      setInvalid(true);
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("密码已更新，欢迎回来 ✨");
      navigate({ to: "/home" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败，再试一次");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="starfield flex min-h-screen items-center justify-center bg-background px-4">
      <div className="dreamy-card w-full max-w-md p-8 text-center">
        <img src={foxImg} alt="狐军师" className="mx-auto h-16 w-16 object-contain" />
        {invalid ? (
          <>
            <h1 className="font-display mt-4 text-xl font-semibold">链接无效或已过期</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              重新去登录页点「忘记密码」，让狐军师再给你发一封。
            </p>
            <button
              onClick={() => navigate({ to: "/auth" })}
              className="btn-starlight mt-6 rounded-full px-6 py-2.5 text-sm font-semibold"
            >
              去登录页
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display mt-4 text-xl font-semibold">设置新密码</h1>
            <p className="mt-1 text-sm text-muted-foreground">想一个好记又安全的密码</p>
            <form onSubmit={onSubmit} className="mt-6 space-y-4 text-left">
              <label className="block">
                <span className="mb-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Lock className="h-4 w-4" /> 新密码
                </span>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                  disabled={!ready}
                  className="w-full rounded-xl border border-input bg-background/60 px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40 disabled:opacity-60"
                />
              </label>
              <button
                type="submit"
                disabled={busy || !ready}
                className="btn-starlight flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold disabled:opacity-60"
              >
                {(busy || !ready) && <Loader2 className="h-4 w-4 animate-spin" />}
                {ready ? "确认新密码" : "正在验证链接…"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
