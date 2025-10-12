import type { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";

const MCP_SCRIPT = path.resolve(process.cwd(), "arkaios-lab-starter", "apps", "mcp", "server.mjs");

async function runMcp(command: string, params: any = {}) {
  if (!fs.existsSync(MCP_SCRIPT)) {
    throw new Error("MCP script no encontrado: arkaios-lab-starter/apps/mcp/server.mjs");
  }
  return new Promise<any>((resolve, reject) => {
    const child = spawn(process.execPath, [MCP_SCRIPT], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let out = "";
    let err = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { out += chunk; });
    child.stderr.on("data", (chunk) => { err += chunk; });

    child.on("error", (e) => reject(e));
    child.on("close", (_code) => {
      const line = out.trim().split(/\r?\n/)[0] || "";
      try {
        const data = JSON.parse(line || "{}");
        resolve(data);
      } catch (e) {
        reject(new Error(`Salida MCP no parseable: ${line || out || err}`));
      }
    });

    const msg = JSON.stringify({ command, params }) + "\n";
    child.stdin.write(msg);
    child.stdin.end();
  });
}

export async function mcpHealth(req: Request, res: Response) {
  try {
    const data = await runMcp("arkaios.health");
    res.json({ ok: true, result: data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}

export async function mcpChat(req: Request, res: Response) {
  try {
    const { prompt = "" } = req.body || {};
    const data = await runMcp("arkaios.chat", { prompt });
    res.json({ ok: true, result: data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}