import type { Request, Response } from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import type { ChatRequest, ChatResponse } from "../../shared/api";

dotenv.config();

const GATEWAY_URL = process.env.AIDA_GATEWAY_URL;
const AUTH_TOKEN = process.env.AIDA_AUTH_TOKEN;

/**
 * Handler principal de chat para la ruta /api/chat
 * Recibe el prompt del usuario y lo envía al A.I.D.A. Gateway
 */
export async function handleAiChat(req: Request, res: Response) {
  const body = req.body as ChatRequest;

  if (!body?.prompt) {
    return res.status(400).json({ status: 400, error: "Missing 'prompt' field" });
  }

  try {
    const payload = {
      agent_id: "puter",
      action: "ask",
      params: { objective: body.prompt }
    };

    const response = await fetch(GATEWAY_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({
        status: response.status,
        error: `Gateway error: ${errorText}`
      });
    }

    const data = await response.json();
    const reply = data.output || data.result || JSON.stringify(data, null, 2);

    const result: ChatResponse = { reply, status: 200 };
    res.json(result);

  } catch (err: any) {
    console.error("Error en handleAiChat:", err);
    const result: ChatResponse = {
      reply: "",
      status: 500,
      error: err.message || "Error interno en el servidor"
    };
    res.status(500).json(result);
  }
}
