import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { pathToFileURL } from "url";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "127.0.0.1",
    port: 8082,
    strictPort: true,
    open: false,
    hmr: { host: "127.0.0.1", port: 8082 },
    fs: {
      allow: [
        path.resolve(__dirname, "."),
        path.resolve(__dirname, "./client"),
        path.resolve(__dirname, "./shared"),
        path.resolve(__dirname, "./public"),
      ],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  define: {
    __COMMIT_SHA__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || process.env.COMMIT_SHA || ""),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    async configureServer(server) {
      try {
        const serverEntry = path.resolve(process.cwd(), "server/index.ts");
        const serverUrl = pathToFileURL(serverEntry).href;
        const { createServer } = await import(serverUrl) as { createServer: () => any };
        const app = createServer();

        // Add Express app as middleware to Vite dev server
        server.middlewares.use(app);
      } catch (err: any) {
        console.warn(`[express-plugin] Skipping local Express integration: ${err?.message ?? err}`);
      }
    },
  };
}
