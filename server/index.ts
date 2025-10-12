import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleAiChat } from "./routes/ai-chat";
import { fsList, fsRead, fsWrite, fsAppend, fsMkdir, fsUpload, fsClear, fsDelete } from "./routes/fs";
import { handleTerminalRun } from "./routes/terminal";
import { mcpHealth, mcpChat } from "./routes/mcp";

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

  // MCP (runtime alterno)
  app.post("/api/mcp/health", mcpHealth);
  app.post("/api/mcp/chat", mcpChat);

  // File System (local workspace)
  app.post("/fs/list", fsList);
  app.post("/fs/read", fsRead);
  app.post("/fs/write", fsWrite);
  app.post("/fs/append", fsAppend);
  app.post("/fs/mkdir", fsMkdir);
  app.post("/fs/upload", fsUpload);
  app.post("/fs/clear", fsClear);
  app.post("/fs/delete", fsDelete);

  // Terminal
  app.post("/api/terminal/run", handleTerminalRun);

  return app;
}
