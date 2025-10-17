import type { Request, Response } from "express";
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

  // Acciones soportadas por el gateway actual
  const SUPPORTED = new Set(["echo","plan","analyze","explain","generate","read","write","delete","copy","move","mkdir","list"]);
  const PROMPT_REQUIRED = new Set(["echo","plan","analyze","explain","generate"]);
  const PARAMS_REQUIRED = new Set(["read","write","delete","copy","move","mkdir","list"]);

  // Permitir que el cliente pase la acción y parámetros opcionales
  let action = (body as any)?.action as string | undefined;
  const paramsInput = (body as any)?.params as Record<string, any> | undefined;

  // Si la acción no es válida, usar una por defecto que suele estar habilitada
  if (!action || !SUPPORTED.has(action)) {
    // Por defecto: "plan" (pública en gateway por defecto). Si falla, el handler ya contempla fallback.
    action = "plan";
  }

  // Validación específica por tipo de acción
  if (PROMPT_REQUIRED.has(action) && !body?.prompt) {
    return res.status(400).json({ status: 400, error: "Missing 'prompt' field for selected action" });
  }
  if (PARAMS_REQUIRED.has(action) && (!paramsInput || Object.keys(paramsInput).length === 0)) {
    return res.status(400).json({ status: 400, error: `Missing 'params' for action '${action}'` });
  }

  // Mapear parámetros por acción cuando el cliente solo envía prompt.
  let params: Record<string, any> = paramsInput || {};
  if (Object.keys(params).length === 0 && body?.prompt) {
    params = action === "echo"
      ? { text: body.prompt }
      : action === "generate"
        ? { prompt: body.prompt }
        : { objective: body.prompt };
  }

  try {
    const payload = {
      agent_id: "puter",
      action,
      params
    };

    const response = await (globalThis as any).fetch(GATEWAY_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${AUTH_TOKEN}`
      },
      body: JSON.stringify(payload)
    });

    const maybeText = await response.text();
    let data: any = {};
    try { data = JSON.parse(maybeText); } catch { data = { raw: maybeText }; }

    if (!response.ok) {
      return res.status(response.status).json({
        status: response.status,
        error: `Gateway error: ${typeof data === "string" ? data : JSON.stringify(data)}`
      });
    }

    const rawReply = data.output || data.result || data.text || data;
    const reply = typeof rawReply === "string" ? rawReply : JSON.stringify(rawReply);
    const result: ChatResponse = { reply, status: 200 };
    res.json(result);

  } catch (err: any) {
    console.error("Error en handleAiChat:", err);
    const result: ChatResponse = {
      reply: "",
      status: 500,
      error: err?.message || "Error interno en el servidor"
    };
    res.status(500).json(result);
  }
}
