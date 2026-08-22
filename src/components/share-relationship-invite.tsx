import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Share2 } from "@/components/app-icons";
import { createRelationshipInvite } from "@/lib/relationship.functions";

export function ShareRelationshipInvite({ className = "" }: { className?: string }) {
  const [busy, setBusy] = useState(false);

  const shareInvite = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { token } = await createRelationshipInvite();
      const url = `${window.location.origin}/invite/${token}`;
      const shareData = {
        title: "来做个测试，看看我们的关系说明书",
        text: "我想和你一起生成一份专属关系报告，点开链接完成测试吧",
        url,
      };

      if (navigator.share) {
        try {
          await navigator.share(shareData);
          return;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") return;
        }
      }

      await navigator.clipboard.writeText(url);
      toast.success("邀请链接已复制，发给好友就好啦");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "邀请链接生成失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={shareInvite}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      邀请好友测一测
    </button>
  );
}
