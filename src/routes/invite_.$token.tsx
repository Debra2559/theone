import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, HeartFilled, Loader2 } from "@/components/app-icons";
import { UserAvatar } from "@/components/user-avatar";
import { supabase } from "@/integrations/supabase/client";
import { acceptRelationshipInvite, getRelationshipInvite } from "@/lib/relationship.functions";

export const Route = createFileRoute("/invite_/$token")({
  head: () => ({
    meta: [
      { title: "一起做测试 · 心动说明书" },
      { name: "description", content: "和好友一起完成测试，生成你们的专属关系报告。" },
    ],
  }),
  loader: async ({ params }) => getRelationshipInvite({ data: { token: params.token } }),
  component: RelationshipInvite,
});

function RelationshipInvite() {
  const invite = Route.useLoaderData();
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(Boolean(data.user)));
  }, []);

  const continueInvite = async () => {
    if (signedIn !== true) {
      navigate({ to: "/auth", search: { invite: token } });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const result = await acceptRelationshipInvite({ data: { token } });
      if (result.status === "needs_onboarding") {
        navigate({ to: "/onboarding", search: { invite: token } });
        return;
      }
      if (result.status === "needs_tests") {
        navigate({ to: "/home", search: { invite: token } });
        return;
      }
      navigate({ to: "/match/$matchId", params: { matchId: result.matchId } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "邀请处理失败");
    } finally {
      setBusy(false);
    }
  };

  const alreadyAccepted = invite.status === "accepted" && Boolean(invite.matchId);

  return (
    <main className="invite-page relative flex min-h-dvh items-center justify-center overflow-hidden px-5 py-10">
      <div className="invite-page-line invite-page-line-one" />
      <div className="invite-page-line invite-page-line-two" />
      <section className="invite-card relative z-10 w-full max-w-sm">
        <p className="invite-kicker">A SHARED FIELD GUIDE</p>
        <div className="invite-avatar-pair">
          <span className="invite-avatar invite-avatar-me">
            <UserAvatar avatar={invite.inviter?.avatar} className="h-full w-full text-4xl" />
          </span>
          <span className="invite-heart">
            <HeartFilled className="h-5 w-5" />
          </span>
          <span className="invite-avatar invite-avatar-friend">
            <span className="text-3xl">?</span>
          </span>
        </div>
        <p className="invite-from">{invite.inviter?.nickname ?? "一位朋友"} 邀请你</p>
        <h1 className="invite-title">
          一起写一份
          <br />
          只属于你们的关系报告
        </h1>
        <p className="invite-copy">
          完成一个小测试，看看你们为什么会被彼此吸引，以及怎样靠近会更舒服。
        </p>
        <div className="invite-steps">
          <span>
            <b>01</b> 完成你的测试
          </span>
          <span>
            <b>02</b> 生成双方关系画像
          </span>
        </div>
        <button
          type="button"
          onClick={continueInvite}
          disabled={busy || signedIn === null}
          className="btn-starlight invite-cta"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          {alreadyAccepted ? "查看你们的关系报告" : signedIn ? "开始我的测试" : "登录后开始"}
        </button>
        <p className="invite-footnote">你的测试结果只用于生成这份关系报告</p>
      </section>
    </main>
  );
}
