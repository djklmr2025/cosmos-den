import type { Request, Response } from "express";
import dotenv from "dotenv";

dotenv.config();

const LUMA_API_KEY = process.env.LUMA_API_KEY;
const DM_BASE = "https://api.lumalabs.ai/dream-machine/v1";

type MediaType = "image" | "video";

interface GenerateBody {
  type: MediaType;
  prompt: string;
  aspect_ratio?: string; // e.g. "16:9", "9:16", "1:1"
  model?: string; // e.g. ray-2 / ray-flash-2 (video) or photon-1 / photon-flash-1 (image)
  durationSec?: number; // 5, 10, up to 30 by chaining
  resolution?: string; // 540p, 720p, 1080p, 4k
  image_url?: string; // referencia de imagen para image->video o image->image
}

interface GenerationCreateResponse {
  id?: string;
  generation_id?: string;
  status?: string;
  error?: string;
  // Para imágenes: url
  image?: { url?: string };
  // Para videos: assets con video url
  video?: { url?: string };
  assets?: { video?: string };
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${LUMA_API_KEY}`,
  };
}

async function createImage(body: GenerateBody) {
  const payload: any = {
    prompt: body.prompt,
  };
  if (body.aspect_ratio) payload.aspect_ratio = body.aspect_ratio;
  if (body.model) payload.model = body.model; // photon-1 | photon-flash-1
  // referencias (si hay)
  if (body.image_url) {
    payload.image_ref = [{ url: body.image_url, weight: 0.85 }];
  }

  const resp = await (globalThis as any).fetch(`${DM_BASE}/generations/image`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = (await resp.json()) as GenerationCreateResponse;
  return { ok: resp.ok, status: resp.status, data };
}

async function createVideo(body: GenerateBody) {
  const payload: any = {
    prompt: body.prompt,
    model: body.model || "ray-2",
  };
  if (body.aspect_ratio) payload.aspect_ratio = body.aspect_ratio;
  if (body.resolution) payload.resolution = body.resolution; // e.g. "720p"

  // Duración soportada directamente por API (5s, 10s en algunas cuentas)
  if (body.durationSec && (body.durationSec === 5 || body.durationSec === 10)) {
    payload.duration = `${body.durationSec}s`;
  }

  // keyframes: image->video
  if (body.image_url) {
    payload.keyframes = {
      frame0: { type: "image", url: body.image_url },
    };
  }

  const resp = await (globalThis as any).fetch(`${DM_BASE}/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = (await resp.json()) as GenerationCreateResponse;
  return { ok: resp.ok, status: resp.status, data };
}

// Extender video: usa el mismo id de generación previa.
// Nota: algunos planes soportan 5s por extensión; se encadena para alcanzar ~30s.
async function extendVideo(prevId: string, body: GenerateBody) {
  const payload: any = {
    prompt: body.prompt,
  };
  if (body.aspect_ratio) payload.aspect_ratio = body.aspect_ratio;
  if (body.image_url) {
    // se puede usar como frame para dirigir la extensión
    payload.keyframes = {
      frame1: { type: "image", url: body.image_url },
    };
  }
  // Endpoint basado en documentación pública; puede variar por plan
  const url = `${DM_BASE}/generations/${prevId}/extend`;
  const resp = await (globalThis as any).fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  const data = (await resp.json()) as GenerationCreateResponse;
  return { ok: resp.ok, status: resp.status, data };
}

// Obtener estado/asset de una generación
async function getGeneration(id: string) {
  const url = `${DM_BASE}/generations/${id}`;
  const resp = await (globalThis as any).fetch(url, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await resp.json();
  return { ok: resp.ok, status: resp.status, data };
}

// Memoria en proceso (simple) para jobs
const jobs = new Map<
  string,
  {
    type: MediaType;
    requestedDurationSec?: number;
    initialGenerationId?: string;
    segmentsRequested?: number;
    segmentsCompleted?: number;
    lastGenerationId?: string;
  }
>();

function makeJobId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export async function handleMediaGenerate(req: Request, res: Response) {
  if (!LUMA_API_KEY) {
    return res.status(500).json({ error: "Falta LUMA_API_KEY en entorno del servidor" });
  }

  const body = req.body as GenerateBody;
  if (!body?.type || !body?.prompt) {
    return res.status(400).json({ error: "Campos requeridos: type, prompt" });
  }

  try {
    if (body.type === "image") {
      const r = await createImage(body);
      if (!r.ok) {
        return res.status(r.status).json({ error: r.data?.error || "Error creando imagen" });
      }
      // La API responde con un id para consultar y, a veces, la url directa cuando finaliza
      const genId = (r.data.id || r.data.generation_id) as string | undefined;
      const jobId = makeJobId();
      jobs.set(jobId, {
        type: "image",
        initialGenerationId: genId,
        lastGenerationId: genId,
      });
      return res.json({ jobId, provider: "luma", generationId: genId, status: r.data.status, image: r.data.image, assets: r.data.assets });
    }

    // VIDEO
    const target = body.durationSec && body.durationSec > 0 ? body.durationSec : 5;
    const segments = Math.ceil(target / 5);
    const r = await createVideo(body);
    if (!r.ok) {
      return res.status(r.status).json({ error: r.data?.error || "Error creando video" });
    }

    const genId = (r.data.id || r.data.generation_id) as string | undefined;
    const jobId = makeJobId();
    jobs.set(jobId, {
      type: "video",
      requestedDurationSec: target,
      segmentsRequested: segments,
      segmentsCompleted: 1,
      initialGenerationId: genId,
      lastGenerationId: genId,
    });

    return res.json({ jobId, provider: "luma", generationId: genId, status: r.data.status, video: r.data.video, assets: r.data.assets });
  } catch (err: any) {
    console.error("[media.generate]", err);
    return res.status(500).json({ error: err?.message || "Error interno" });
  }
}

export async function handleMediaStatus(req: Request, res: Response) {
  const jobId = req.params.id;
  const job = jobs.get(jobId);
  if (!job) return res.status(404).json({ error: "Job no encontrado" });

  try {
    const genId = job.lastGenerationId || job.initialGenerationId;
    if (!genId) return res.json({ jobId, state: "unknown" });

    // Consultar estado actual
    const current = await getGeneration(genId);
    if (!current.ok) return res.status(current.status).json({ error: "Fallo consultando generación" });

    const state = current.data?.status || current.data?.state || "unknown";
    const videoUrl = current.data?.video?.url || current.data?.assets?.video;
    const imageUrl = current.data?.image?.url || current.data?.assets?.image;

    // Si es video y el usuario pidió >10s, encadenamos extensiones hasta ~30s
    if (job.type === "video" && job.segmentsRequested && job.segmentsCompleted && job.segmentsCompleted < job.segmentsRequested) {
      // Extender solo si la generación actual está completada
      if (state === "completed" || state === "ready") {
        const next = await extendVideo(genId, {
          type: "video",
          prompt: req.query.prompt ? String(req.query.prompt) : "",
          aspect_ratio: req.query.aspect_ratio ? String(req.query.aspect_ratio) : undefined,
        });
        if (next.ok) {
          const nextId = (next.data.id || next.data.generation_id) as string | undefined;
          if (nextId) {
            job.lastGenerationId = nextId;
            job.segmentsCompleted += 1;
          }
        }
      }
    }

    jobs.set(jobId, job); // actualizar
    return res.json({ jobId, state, videoUrl, imageUrl, job });
  } catch (err: any) {
    console.error("[media.status]", err);
    return res.status(500).json({ error: err?.message || "Error interno" });
  }
}