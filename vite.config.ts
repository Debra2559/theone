// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // The local app is commonly opened through 127.0.0.1 or a LAN IP. Vite's
  // inferred HMR hostname can then point at localhost and leave the page
  // partially hydrated, so use a stable reload-based dev server locally.
  vite: {
    server: {
      hmr: false,
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    // Keep route components in the main client module. The automatic
    // `?tsr-split=component` chunks currently lose the Router context during
    // local dev hydration, which surfaces as an invalid React hook call.
    router: {
      codeSplittingOptions: {
        defaultBehavior: [],
      },
    },
  },
});
