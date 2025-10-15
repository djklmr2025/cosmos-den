import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleAiChat } from "./routes/ai-chat";
import { handleMediaGenerate, handleMediaStatus } from "./routes/media";
import { handleHealth } from "./routes/health";
import { fsList, fsRead, fsWrite, fsMkdir, fsUpload, fsClear, fsDelete } from "./routes/fs";
import { registerMemoryRoutes } from "./routes/memory";
import { handleTerminalRun } from "./routes/terminal";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    const ping = process.env.PING_MESSAGE ?? "ping";
    res.json({ message: ping });
  });

  app.get("/api/demo", handleDemo);

  // Chat AI (Gateway)
  app.post("/api/chat", handleAiChat);

  // Media (Imagen/Video) vía Luma API
  app.post("/api/media/generate", handleMediaGenerate);
  app.get("/api/media/status/:id", handleMediaStatus);

  // Health endpoint for readiness/liveness checks
  app.get("/health", handleHealth);

  // Local memory/key-info endpoints (simulate Worker)
  registerMemoryRoutes(app);

  // File System (local workspace)
  app.post("/fs/list", fsList);
  app.post("/fs/read", fsRead);
  app.post("/fs/write", fsWrite);
  app.post("/fs/mkdir", fsMkdir);
  app.post("/fs/upload", fsUpload);
  app.post("/fs/clear", fsClear);
  app.post("/fs/delete", fsDelete);

  // Terminal
  app.post("/api/terminal/run", handleTerminalRun);

  // MCP-style aliases (para compatibilidad con daemon MCP)
  app.get("/mcp/health", handleHealth);
  app.post("/mcp/tools/run", handleTerminalRun);

  return app;
}
