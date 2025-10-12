import type { Server as HttpServer } from "http";
import type { Server as HttpsServer } from "https";
import { WebSocketServer } from "ws";
import path from "path";
import * as pty from "node-pty";
import { appendLog } from "./utils/logger";
const MASTER_TOKEN = process.env.MASTER_TOKEN;

const WORKSPACE = path.resolve(process.env.ARK_WORKSPACE || path.join(process.cwd(), "data", "workspace"));

function selectShell(requested?: string): { cmd: string; args: string[] } {
  const isWin = process.platform === "win32";
  if (isWin) {
    if (requested === "cmd") return { cmd: "cmd.exe", args: [] };
    if (requested === "wsl-root") return { cmd: "wsl.exe", args: ["-u", "root"] };
    if (requested === "wsl") return { cmd: "wsl.exe", args: [] };
    return { cmd: "powershell.exe", args: ["-NoLogo"] };
  }
  // Linux/macOS
  if (requested === "zsh") return { cmd: "/bin/zsh", args: ["-l"] };
  return { cmd: "/bin/bash", args: ["-l"] };
}

export function initTerminalWs(httpServer: HttpServer | HttpsServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/terminal" });
  wss.on("connection", (ws, req) => {
    try {
      const sessionId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const base = `http://${req.headers.host || "localhost"}`;
      const url = new URL(req.url || "/ws/terminal", base);
      const shellParam = url.searchParams.get("shell") || undefined;
      const actorParam = (url.searchParams.get("actor") || "human").toLowerCase();
      const providedToken = url.searchParams.get("token") || "";
      if (MASTER_TOKEN && providedToken !== MASTER_TOKEN) {
        try { ws.close(1008, "unauthorized"); } catch {}
        return;
      }
      const { cmd, args } = selectShell(shellParam);

      const p = pty.spawn(cmd, args, {
        name: "xterm-color",
        cols: 80,
        rows: 24,
        cwd: WORKSPACE,
        env: process.env as any,
      });

      appendLog({ source: "terminal.ws", event: "open", sessionId, shell: cmd, args, cwd: WORKSPACE, ip: req.socket.remoteAddress, actor: actorParam });

      p.onData((data: string) => {
        try { ws.send(data); } catch {}
      });

      ws.on("message", (msg) => {
        const text = msg.toString();
        // Simple protocolo: si envían JSON con {type:"resize", cols, rows}
        try {
          const parsed = JSON.parse(text);
          if (parsed && parsed.type === "resize" && parsed.cols && parsed.rows) {
            p.resize(Number(parsed.cols) || 80, Number(parsed.rows) || 24);
            appendLog({ source: "terminal.ws", event: "resize", sessionId, cols: parsed.cols, rows: parsed.rows, actor: actorParam });
            return;
          }
        } catch {}

        appendLog({ source: "terminal.ws", event: "input", sessionId, data: text, actor: actorParam });
        p.write(text);
      });

      ws.on("close", () => {
        try { p.kill(); } catch {}
        appendLog({ source: "terminal.ws", event: "close", sessionId, actor: actorParam });
      });

      ws.on("error", () => {
        try { p.kill(); } catch {}
        appendLog({ source: "terminal.ws", event: "error", sessionId, actor: actorParam });
      });
    } catch (err) {
      try { ws.close(); } catch {}
    }
  });

  console.log("✅ Terminal WS listo en /ws/terminal");
  return wss;
}