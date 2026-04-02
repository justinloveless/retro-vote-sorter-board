
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => {
  
  const env = loadEnv(mode, process.cwd(), '')

  return ({
    server: {
      host: "::",
      port: 8081,
      // If 8081 is already taken (stale `vite`, `vite preview`, another app), fail instead of
      // silently using 8082+ — avoids “I ran dev but still see an old build on :8081”.
      strictPort: true,
    },
    build: {
      rollupOptions: {
        output: {
          // Atlaskit renderer pulls in a large dynamic-import graph (react-loadable).
          // Inline to avoid Rollup chunk assignment edge cases.
          inlineDynamicImports: true,
        },
      },
    },
    plugins: [
      react(),
      mode === 'development' &&
      componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "prosemirror-state",
        "prosemirror-model",
        "prosemirror-view",
        "prosemirror-transform",
        "prosemirror-gapcursor",
        "prosemirror-keymap",
        "prosemirror-commands",
        "prosemirror-schema-list",
        "prosemirror-history",
        "prosemirror-inputrules",
      ],
    },
    define: {
      "process.env": JSON.stringify({ NODE_ENV: mode }),
    },
    optimizeDeps: {
      include: ["@atlaskit/renderer", "@atlaskit/editor-core"],
    },
  });

});
