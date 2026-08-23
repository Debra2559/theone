import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/app.functions";

// 认证布局（集成托管模式）：整棵子树都要求登录，子路由无需各自鉴权。
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/auth" });
    const profile = await getMyProfile();
    if (!profile?.onboarding_done && location.pathname !== "/onboarding") {
      throw redirect({ to: "/onboarding" });
    }
    return { user: data.session.user, profile };
  },
  component: () => <Outlet />,
});
