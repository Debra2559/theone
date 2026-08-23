import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "@/components/app-icons";
import foxImg from "@/assets/fox.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "心动说明书 · 遇见真正懂你的人" },
      {
        name: "description",
        content: "从轻测试开始认识自己、看见自己，写下会陪你不断更新的人生说明书。",
      },
      { property: "og:title", content: "心动说明书 · 遇见真正懂你的人" },
      {
        property: "og:description",
        content: "认识自己 × 看见自己 × 读懂关系，把每一次选择都变成更清晰的自我理解。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/home" : "/auth", replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background">
      <img src={foxImg} alt="狐军师" className="h-20 w-20 animate-float object-contain" />
      <p className="font-display text-xl font-bold gradient-text">心动说明书</p>
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
