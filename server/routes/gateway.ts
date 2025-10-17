import type { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();

const GATEWAY_URL = process.env.AIDA_GATEWAY_URL;
const AUTH_TOKEN = process.env.AIDA_AUTH_TOKEN;

/**
 * Proxy directo al A.I.D.A. Gateway para operaciones de herramientas/FS.
 * Espera: { action: string, params: object, agent_id?: string }
 * Devuelve: { status: number, reply: string, error?: string }
 */
export async function handleGateway(req: Request, res: Response) {
  const { action, params, agent_id } = (req.body || {}) as {
    action?: string;
    params?: Record<string, any>;
    agent_id?: string;
  };

  if (!action || typeof action !== "string") {
    return res.status(400).json({ status: 400, error: "Missing or invalid 'action'" });
  }
  if (!params || typeof params !== "object") {
    return res.status(400).json({ status: 400, error: "Missing or invalid 'params'" });
  }

  try {
    const payload = {
      agent_id: agent_id || "puter",
      action,
      params,
    };

    const response = await (globalThis as any).fetch(GATEWAY_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!response.ok) {
      const errStr = typeof data === "string" ? data : JSON.stringify(data);
      return res.status(response.status).json({ status: response.status, error: `Gateway error: ${errStr}` });
    }

    const rawReply = data.output || data.result || data.text || data;
    const reply = typeof rawReply === "string" ? rawReply : JSON.stringify(rawReply);
    return res.json({ status: 200, reply });
  } catch (err: any) {
    return res.status(500).json({ status: 500, error: err?.message || "Internal error" });
  }
}