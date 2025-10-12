import type { Request, Response } from "express";
import { mcpManager } from "../utils/mcp-manager";

export async function mcpHealth(req: Request, res: Response) {
  try {
    const data = await mcpManager.health();
    res.json({ ok: true, result: data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}

export async function mcpChat(req: Request, res: Response) {
  try {
    const { prompt = "" } = req.body || {};
    const data = await mcpManager.chat(prompt);
    res.json({ ok: true, result: data });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message || String(e) });
  }
}