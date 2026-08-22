import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="starfield flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl font-bold gradient-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">这颗星星不存在</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          你要找的页面可能飞到别的星系去了。
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="btn-starlight inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            回到首页
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="starfield flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
          页面打了个喷嚏
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          出了点小状况，刷新试试，或者回首页逛逛。
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn-starlight inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold"
          >
            再试一次
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-card px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/20"
          >
            回首页
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "心动说明书 · 遇见真正懂你的人" },
      {
        name: "description",
        content:
          "用好玩的测试写一份关于你的使用说明书，让 AI 帮你遇见真正合拍的人，还有狐军师全程陪跑你的恋爱。",
      },
      { property: "og:title", content: "心动说明书 · 遇见真正懂你的人" },
      {
        property: "og:description",
        content: "好玩的测试 × AI 个人说明书 × 智能匹配 × 恋爱军师，年轻人的恋爱通关指南。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="light" position="top-center" />
    </QueryClientProvider>
  );
}
