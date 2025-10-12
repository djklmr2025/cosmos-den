import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createServer } from "./server";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Permitir configurar puerto vía env y caer al siguiente si ocupado
  // Nota: HMR se alinea con el puerto elegido
  // Usa PORT o 8081 por defecto
  // Si el puerto está ocupado, strictPort=false permite fallback automático
  server: {
    host: "127.0.0.1",
    port: Number(process.env.PORT || 8081),
    strictPort: false,
    open: false,
    hmr: { host: "127.0.0.1", port: Number(process.env.PORT || 8081) },
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
    configureServer(server) {
      const app = createServer();

      // Add Express app as middleware to Vite dev server
      server.middlewares.use(app);
    },
  };
}
