import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleAiChat } from "./routes/ai-chat";
import { handleGateway } from "./routes/gateway";
import { handleMediaGenerate, handleMediaStatus, handleMediaConvert, handleMediaFile } from "./routes/media";
import { handleHealth } from "./routes/health";
import { fsList, fsRead, fsWrite, fsMkdir, fsUpload, fsClear, fsDelete, fsCopy, fsMove } from "./routes/fs";
import { registerMemoryRoutes } from "./routes/memory";
import { handleTerminalRun } from "./routes/terminal";
import { handleComfyPrompt, handleComfyHistory, handleComfyView, handleComfyTest } from "./routes/comfyui";
import { handleFreePort, handlePortStatus, handleComfyStart, handleComfyStatus, handleComfyStop } from "./routes/system";
import { todoList, todoCreate, todoDelete, todoToggle } from "./routes/todo";

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
  // Gateway directo (herramientas/FS)
  app.post("/api/gateway", handleGateway);
  // Salud del Gateway (diagnóstico rápido)
  app.get("/api/gateway/_alive", (_req, res) => {
    res.json({ ok: true, route: "/api/gateway", method: "POST" });
  });

  // Media (Imagen/Video) vía Luma API
  app.post("/api/media/generate", handleMediaGenerate);
  app.get("/api/media/status/:id", handleMediaStatus);
  app.post("/api/media/convert", handleMediaConvert);
  app.get("/api/media/file/:name", handleMediaFile);

  // ComfyUI local (proxy): workflows avanzados
  app.post("/api/comfyui/prompt", handleComfyPrompt);
  app.get("/api/comfyui/history/:id", handleComfyHistory);
  app.get("/api/comfyui/view", handleComfyView);
  app.get("/api/comfyui/test", handleComfyTest);

  // Sistema: estado de puerto y liberación forzada (Windows)
  app.get("/api/system/port-status", handlePortStatus);
  app.post("/api/system/free-port", handleFreePort);

  // Gestión de ComfyUI: arrancar/detener/estado (Windows)
  app.post("/api/comfyui/manage/start", handleComfyStart);
  app.get("/api/comfyui/manage/status", handleComfyStatus);
  app.post("/api/comfyui/manage/stop", handleComfyStop);

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
  app.post("/fs/copy", fsCopy);
  app.post("/fs/move", fsMove);

  // Terminal
  app.post("/api/terminal/run", handleTerminalRun);

  // MCP-style aliases (para compatibilidad con daemon MCP)
  app.get("/mcp/health", handleHealth);
  app.post("/mcp/tools/run", handleTerminalRun);

  // TODO API (CRUD simple)
  app.get("/api/todo", todoList);
  app.post("/api/todo", todoCreate);
  app.delete("/api/todo/:id", todoDelete);
  app.patch("/api/todo/:id/toggle", todoToggle);

  return app;
}
