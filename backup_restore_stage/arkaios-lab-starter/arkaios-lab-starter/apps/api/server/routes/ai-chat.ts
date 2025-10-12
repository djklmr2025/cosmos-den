import type { Request, Response } from "express";
import type { ChatRequest, ChatResponse } from "@arkaios/shared/api";
import dotenv from "dotenv"; dotenv.config();
const GATEWAY_URL = process.env.AIDA_GATEWAY_URL!; const AUTH_TOKEN = process.env.AIDA_AUTH_TOKEN!;
export async function handleAiChat(req: Request, res: Response) {
  const body = req.body as ChatRequest;
  if (!body?.prompt) return res.status(400).json({ status:400, error:"Missing 'prompt'", reply:"" });
  try {
    const r = await fetch(GATEWAY_URL, { method:"POST",
      headers:{ "Content-Type":"application/json", "Authorization":`Bearer ${AUTH_TOKEN}` },
      body: JSON.stringify({ agent_id:"puter", action:"ask", params:{ objective: body.prompt } }) });
    if (!r.ok) return res.status(r.status).json({ status:r.status, error:`Gateway error: ${await r.text()}`, reply:"" });
    const data = await r.json(); const reply = data.output ?? data.result ?? JSON.stringify(data,null,2);
    res.json({ status:200, reply } as ChatResponse);
  } catch(e:any){ res.status(500).json({ status:500, reply:"", error: e?.message ?? String(e) }); }
}
