import type { Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import ffmpegPath from "ffmpeg-static";

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

// Workspace para archivos temporales y convertidos
const WORKSPACE = path.resolve(process.env.ARK_WORKSPACE || path.join(process.cwd(), "data", "workspace"));
const MEDIA_DIR = path.join(WORKSPACE, "media");
try { fs.mkdirSync(MEDIA_DIR, { recursive: true }); } catch {}

function safeJoinMedia(filename: string) {
  const abs = path.resolve(MEDIA_DIR, filename);
  if (!abs.startsWith(MEDIA_DIR)) throw new Error("Ruta fuera de media dir");
  return abs;
}

function bufferFromBase64(base64: string) {
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  return Buffer.from(clean, "base64");
}

async function writeBufferToFile(buf: Buffer, rel: string) {
  const abs = safeJoinMedia(rel);
  await fs.promises.mkdir(path.dirname(abs), { recursive: true });
  await fs.promises.writeFile(abs, buf);
  return abs;
}

async function downloadToFile(url: string, rel: string) {
  const resp = await (globalThis as any).fetch(url);
  if (!resp.ok) throw new Error(`No se pudo descargar: ${resp.status}`);
  const arr = await resp.arrayBuffer();
  const buf = Buffer.from(arr);
  return await writeBufferToFile(buf, rel);
}

async function convertWebmToMp4(inputAbs: string, outputAbs: string) {
  return await new Promise<{ ok: boolean; code: number; stderr: string }>((resolve) => {
    // Resolver binario de ffmpeg: usar estático si existe; si no, fallback a PATH
    const ffBin = (() => {
      try {
        if (ffmpegPath && typeof ffmpegPath === "string" && fs.existsSync(ffmpegPath)) {
          return ffmpegPath;
        }
      } catch {}
      return "ffmpeg";
    })();

    try {
      console.log(`[media.convert] ffBin`, ffBin);
    } catch {}

    const args = [
      "-y",
      "-i",
      inputAbs,
      "-an",
      "-vf",
      "scale=trunc(iw/2)*2:trunc(ih/2)*2",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "23",
      "-movflags",
      "+faststart",
      "-pix_fmt",
      "yuv420p",
      outputAbs,
    ];

    const child = spawn(ffBin, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err) => {
      // Si falla el binario (por ejemplo ENOENT), probamos con ffmpeg del PATH y, si es necesario, usamos fallback mpeg4
      if (ffBin !== "ffmpeg") {
        const child2 = spawn("ffmpeg", args, { windowsHide: true });
        let stderr2 = "";
        child2.stderr.on("data", (d) => (stderr2 += d.toString()));
        child2.on("close", (code2) => {
          if (code2 === 0) return resolve({ ok: true, code: code2, stderr: stderr2 });
          const argsFallback = [
            "-y",
            "-i",
            inputAbs,
            "-an",
            "-vf",
            "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-c:v",
            "mpeg4",
            "-q:v",
            "4",
            outputAbs,
          ];
          const child3 = spawn("ffmpeg", argsFallback, { windowsHide: true });
          let stderr3 = "";
          child3.stderr.on("data", (d) => (stderr3 += d.toString()));
          child3.on("close", (code3) => {
            resolve({ ok: code3 === 0, code: code3, stderr: String(err) + "\n" + stderr2 + "\n" + stderr3 });
          });
        });
      } else {
        resolve({ ok: false, code: -1, stderr: String(err) });
      }
    });
    child.on("close", async (code) => {
      if (code === 0) return resolve({ ok: true, code, stderr });
      // Fallback a mpeg4 si libx264 no está disponible
      const argsFallback = [
        "-y",
        "-i",
        inputAbs,
        "-an",
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v",
        "mpeg4",
        "-q:v",
        "4",
        outputAbs,
      ];
      const child2 = spawn(ffBin, argsFallback, { windowsHide: true });
      let stderr2 = "";
      child2.stderr.on("data", (d) => (stderr2 += d.toString()));
      child2.on("close", (code2) => {
        resolve({ ok: code2 === 0, code: code2, stderr: stderr + "\n" + stderr2 });
      });
    });
  });
}

export async function handleMediaConvert(req: Request, res: Response) {
  try {
    const { sourceUrl, sourceBase64, targetFormat = "mp4" } = (req.body || {}) as {
      sourceUrl?: string;
      sourceBase64?: string; // puede venir como dataURL o base64 puro
      targetFormat?: "mp4";
    };

    if (targetFormat !== "mp4") {
      return res.status(400).json({ ok: false, error: "Sólo se soporta mp4" });
    }
    if (!sourceUrl && !sourceBase64) {
      return res.status(400).json({ ok: false, error: "Falta sourceUrl o sourceBase64" });
    }

    const id = makeJobId();
    const inRel = `${id}.webm`;
    const outRel = `${id}.mp4`;
    const inAbs = safeJoinMedia(inRel);
    const outAbs = safeJoinMedia(outRel);

    if (sourceBase64) {
      const buf = bufferFromBase64(sourceBase64);
      await writeBufferToFile(buf, inRel);
    } else if (sourceUrl) {
      await downloadToFile(sourceUrl, inRel);
    }

    const r = await convertWebmToMp4(inAbs, outAbs);
    if (!r.ok) {
      // Degradación elegante: si no se puede convertir (ffmpeg ausente), devolver el WebM original
      const downloadUrlWebm = `/api/media/file/${inRel}`;
      return res.json({ ok: true, downloadUrl: downloadUrlWebm, id, format: "webm", note: "ffmpeg no disponible, usando WebM" });
    }

    const downloadUrl = `/api/media/file/${outRel}`;
    return res.json({ ok: true, downloadUrl, id, format: "mp4" });
  } catch (err: any) {
    console.error("[media.convert]", err);
    res.status(500).json({ ok: false, error: err?.message || "Error interno" });
  }
}

export async function handleMediaFile(req: Request, res: Response) {
  try {
    const name = String(req.params.name || "");
    if (!name || !/^[\w.-]+$/.test(name)) {
      return res.status(400).json({ ok: false, error: "Nombre inválido" });
    }
    const abs = safeJoinMedia(name);
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ ok: false, error: "Archivo no encontrado" });
    }
    const ext = path.extname(abs).toLowerCase();
    const ct = ext === ".mp4" ? "video/mp4" : ext === ".webm" ? "video/webm" : "application/octet-stream";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=3600");
    const stream = fs.createReadStream(abs);
    stream.on("error", (e) => res.status(500).end(String(e)));
    stream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Error interno" });
  }
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