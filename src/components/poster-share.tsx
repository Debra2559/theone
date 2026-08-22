import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Share2 } from "@/components/app-icons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { renderPoster, type PosterData } from "@/lib/poster";

export function SharePosterButton({
  data,
  filename,
}: {
  data: PosterData;
  filename: string;
}) {
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);

  const generate = async () => {
    setBusy(true);
    try {
      const canvas = await renderPoster(data);
      const b = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!b) throw new Error("empty");
      if (imgUrl) URL.revokeObjectURL(imgUrl);
      const url = URL.createObjectURL(b);
      setImgUrl(url);
      setBlob(b);
      setOpen(true);
    } catch {
      toast.error("海报生成失败，再试一次");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = filename;
    a.click();
    toast.success("海报已保存，快去分享吧 ✨");
  };

  const share = async () => {
    if (!blob) return;
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "心动说明书" });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return; // 用户取消
      }
    }
    // 不支持系统分享（如微信内置浏览器）→ 保存图片
    save();
  };

  return (
    <>
      <button
        onClick={generate}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
        分享海报
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">你的专属海报</DialogTitle>
            <DialogDescription>保存图片，或直接分享到社交平台</DialogDescription>
          </DialogHeader>
          {imgUrl && (
            <img
              src={imgUrl}
              alt="说明书海报"
              className="mx-auto max-h-[52vh] w-auto rounded-2xl border border-border"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={save}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-input px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <Download className="h-4 w-4" /> 保存图片
            </button>
            <button
              onClick={share}
              className="btn-starlight inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-semibold"
            >
              <Share2 className="h-4 w-4" /> 分享
            </button>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            微信内打开时，可长按图片保存后分享
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
