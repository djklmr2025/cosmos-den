import type { Request, Response } from "express";

const DEFAULT_COMFY_BASE = process.env.COMFYUI_BASE_URL || "http://127.0.0.1:8188";

function sanitizeOverride(baseRaw: string | undefined): string | null {
  if (!baseRaw) return null;
  let url: URL;
  try { url = new URL(baseRaw); } catch { return null; }
  const allowedHosts = new Set(["127.0.0.1", "localhost"]);
  const allowedProtocols = new Set(["http:", "https:"]);
  if (!allowedProtocols.has(url.protocol)) return null;
  if (!allowedHosts.has(url.hostname)) return null;
  // port must be numeric, present
  const portNum = Number(url.port);
  if (!Number.isFinite(portNum) || portNum <= 0 || portNum > 65535) return null;
  // Strip any path/query from override; we only accept base authority
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function getComfyBase(req: Request): string {
  const qp = (req.query?.base as string | undefined) || undefined;
  const headerOverride = (req.headers["x-comfy-base"] as string | undefined) || undefined;
  const override = sanitizeOverride(qp || headerOverride);
  return override || DEFAULT_COMFY_BASE;
}

function buildComfyUrl(path: string, base: string) {
  return `${base}${path}`;
}

function safeParseJson(input: any): any {
  if (!input) return null;
  if (typeof input === "string") {
    try { return JSON.parse(input); } catch { return null; }
  }
  if (typeof input === "object") return input;
  return null;
}

export async function handleComfyPrompt(req: Request, res: Response) {
  try {
    const base = getComfyBase(req);
    const clientId = (req.body?.client_id as string) || "arkaios-ui";
    // Admitimos body.prompt (objeto o string) o body.workflow (objeto o string)
    const promptObj = safeParseJson(req.body?.prompt) || safeParseJson(req.body?.workflow);
    if (!promptObj) {
      return res.status(400).json({ error: "Falta 'prompt' o 'workflow' válido (JSON)" });
    }

    const payload = { client_id: clientId, prompt: promptObj };
    const url = buildComfyUrl("/prompt", base);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ error: (data as any)?.error || "Error en ComfyUI /prompt", provider: "comfyui" });
    }
    const promptId = (data as any)?.prompt_id || (data as any)?.id;
    return res.json({ provider: "comfyui", jobId: promptId, raw: data });
  } catch (err: any) {
    console.error("[comfy.prompt]", err);
    return res.status(500).json({ error: err?.message || "Error interno" });
  }
}

function extractFirstImageFromHistory(historyData: any): { filename?: string; subfolder?: string; type?: string } | null {
  if (!historyData) return null;
  // Algunos servidores exponen { outputs: { <node_id>: [{ images: [{ filename, subfolder, type }] }] } }
  const outputs = historyData?.outputs || historyData?.history?.outputs || historyData?.images ? { _root: [historyData] } : null;
  if (!outputs) return null;
  const candidates: any[] = [];
  for (const key of Object.keys(outputs)) {
    const arr = outputs[key];
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (Array.isArray(item?.images) && item.images.length > 0) {
          candidates.push(...item.images);
        }
      }
    }
  }
  return candidates.length > 0 ? candidates[0] : null;
}

export async function handleComfyHistory(req: Request, res: Response) {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: "Falta id de prompt" });
  try {
    const base = getComfyBase(req);
    const url = buildComfyUrl(`/history/${encodeURIComponent(id)}`, base);
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status).json({ error: (data as any)?.error || "Error en ComfyUI /history" });
    }
    const status = (data as any)?.status || (data as any)?.state || "unknown";
    const img = extractFirstImageFromHistory(data);
    let imageUrl: string | undefined;
    if (img?.filename) {
      const type = img?.type || "output";
      const subfolder = img?.subfolder || "";
      const filename = img.filename;
      imageUrl = `/api/comfyui/view?filename=${encodeURIComponent(filename)}&type=${encodeURIComponent(type)}&subfolder=${encodeURIComponent(subfolder)}&base=${encodeURIComponent(base)}`;
    }
    return res.json({ provider: "comfyui", state: status, imageUrl, raw: data });
  } catch (err: any) {
    console.error("[comfy.history]", err);
    return res.status(500).json({ error: err?.message || "Error interno" });
  }
}

export async function handleComfyView(req: Request, res: Response) {
  try {
    const base = getComfyBase(req);
    const filename = String(req.query.filename || "");
    const type = String(req.query.type || "output");
    const subfolder = String(req.query.subfolder || "");
    if (!filename) return res.status(400).send("Falta filename");
    const url = buildComfyUrl(`/view?filename=${encodeURIComponent(filename)}&type=${encodeURIComponent(type)}&subfolder=${encodeURIComponent(subfolder)}`, base);
    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text().catch(() => "Error externo");
      return res.status(r.status).send(text);
    }
    const ct = r.headers.get("content-type") || "application/octet-stream";
    const ab = await r.arrayBuffer();
    res.setHeader("Content-Type", ct);
    res.send(Buffer.from(ab));
  } catch (err: any) {
    console.error("[comfy.view]", err);
    return res.status(500).send(err?.message || "Error interno");
  }
}

export async function handleComfyTest(req: Request, res: Response) {
  try {
    const base = getComfyBase(req);
    const r = await fetch(`${base}/`, { method: "GET" });
    const text = await r.text().catch(() => "");
    const ok = r.ok || r.status >= 200; // consider any response as reachable
    return res.json({ provider: "comfyui", reachable: ok, status: r.status, length: text.length, base });
  } catch (err: any) {
    return res.status(200).json({ provider: "comfyui", reachable: false, error: err?.message || String(err) });
  }
}