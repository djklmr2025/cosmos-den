import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEffect, useState } from "react";

type MediaType = "image" | "video";
type ProviderType =
  | "luma"
  | "pollinations"
  | "comfyui"
  | "fal"
  | "replicate"
  | "huggingface";

const aspectOptions = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21"];

export default function MediaGenerator() {
  const [provider, setProvider] = useState<ProviderType>("luma");
  const [type, setType] = useState<MediaType>("video");
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [durationSec, setDurationSec] = useState<number>(5);
  const [model, setModel] = useState<string>("ray-2");
  const [resolution, setResolution] = useState<string>("720p");
  const [jobId, setJobId] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [downloadUrl, setDownloadUrl] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [useSurvey, setUseSurvey] = useState<boolean>(true);
  const [workflowJson, setWorkflowJson] = useState<string>("");
  const [comfyMode, setComfyMode] = useState<"basic" | "advanced">("basic");
  const [basicPrompt, setBasicPrompt] = useState<string>("");
  const [basicNegPrompt, setBasicNegPrompt] = useState<string>("");
  const [basicSteps, setBasicSteps] = useState<number>(20);
  const [basicCfg, setBasicCfg] = useState<number>(8);
  const [basicSeed, setBasicSeed] = useState<number>(0);
  const [basicWidth, setBasicWidth] = useState<number>(768);
  const [basicHeight, setBasicHeight] = useState<number>(768);
  const [basicCkpt, setBasicCkpt] = useState<string>("MODEL_NAME.ckpt");
  const [comfyBase, setComfyBase] = useState<string>(() => {
    try {
      return (
        localStorage.getItem("arkaios.comfyBase") || "http://127.0.0.1:9000"
      );
    } catch {
      return "http://127.0.0.1:9000";
    }
  });
  const [testStatus, setTestStatus] = useState<string>("");
  const [autoStart, setAutoStart] = useState<boolean>(true);
  const [startStatus, setStartStatus] = useState<string>("");
  const [comfyServiceStatus, setComfyServiceStatus] = useState<string>("");

  useEffect(() => {
    if (provider !== "comfyui") return;
    const m = comfyBase.match(/:(\d+)/);
    const port = m ? Number(m[1]) : 9000;
    let cancelled = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/comfyui/manage/status?port=${port}`);
        const data = await r.json();
        if (!cancelled) {
          if (r.ok && data?.ok) {
            setComfyServiceStatus(
              `ComfyUI ${data.running ? "activo" : "detenido"}${data.pid ? ` (pid=${data.pid})` : ""}`,
            );
          } else {
            setComfyServiceStatus(`Estado: ${data?.error || "error"}`);
          }
        }
      } catch (err: any) {
        if (!cancelled) setComfyServiceStatus(`Error estado: ${err?.message || String(err)}`);
      }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [provider, comfyBase]);

  // Encuestador simple para enriquecer prompt
  const [subject, setSubject] = useState("");
  const [style, setStyle] = useState("");
  const [mood, setMood] = useState("");
  const [camera, setCamera] = useState("");

  // Estado de proveedores (sólo visibilidad; se activan si hay claves)
  const env: any = (import.meta as any)?.env || {};
  const hasFal = !!env.VITE_FAL_API_KEY;
  const hasReplicate = !!env.VITE_REPLICATE_API_TOKEN;
  const hasHF = !!env.VITE_HF_TOKEN;

  // Construcción de workflow básico (Texto->Imagen) para ComfyUI
  function buildBasicWorkflow(params: {
    prompt: string;
    negativePrompt?: string;
    steps: number;
    cfg: number;
    seed: number;
    width: number;
    height: number;
    ckpt: string;
  }) {
    const {
      prompt,
      negativePrompt = "",
      steps,
      cfg,
      seed,
      width,
      height,
      ckpt,
    } = params;
    // Estructura semejante al export JSON de ComfyUI
    return {
      "1": {
        class_type: "CheckpointLoaderSimple",
        inputs: { ckpt_name: ckpt },
        id: 1,
      },
      "2": {
        class_type: "CLIPTextEncode",
        inputs: { text: prompt, clip: ["1", 1] },
        id: 2,
      },
      "3": {
        class_type: "CLIPTextEncode",
        inputs: { text: negativePrompt, clip: ["1", 1] },
        id: 3,
      },
      "4": {
        class_type: "EmptyLatentImage",
        inputs: { width: width, height: height },
        id: 4,
      },
      "5": {
        class_type: "KSampler",
        inputs: {
          seed: seed,
          steps: steps,
          cfg: cfg,
          sampler_name: "euler",
          scheduler: "normal",
          denoise: 1,
          model: ["1", 0],
          positive: ["2", 0],
          negative: ["3", 0],
          latent_image: ["4", 0],
        },
        id: 5,
      },
      "6": {
        class_type: "VAEDecode",
        inputs: { samples: ["5", 0], vae: ["1", 2] },
        id: 6,
      },
      "7": {
        class_type: "SaveImage",
        inputs: { images: ["6", 0] },
        id: 7,
      },
    } as const;
  }

  function buildPrompt() {
    if (!useSurvey) return prompt;
    const parts = [
      subject,
      style && `style: ${style}`,
      mood && `mood: ${mood}`,
      camera && `camera: ${camera}`,
    ].filter(Boolean);
    return [prompt, ...parts].filter(Boolean).join("; ");
  }

  async function startGeneration() {
    const finalPrompt = buildPrompt();
    if (provider !== "comfyui" && !finalPrompt) return;
    setLoading(true);
    setStatus("queued");
    setMediaUrl("");
    setDownloadUrl("");

    try {
      // Proveedor local: ComfyUI (workflow avanzado)
      if (provider === "comfyui") {
        if (comfyMode === "advanced") {
          if (!workflowJson.trim()) {
            throw new Error(
              "Pega un workflow JSON de ComfyUI en el campo correspondiente",
            );
          }
          const resp = await fetch(
            `/api/comfyui/prompt?base=${encodeURIComponent(comfyBase)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                client_id: "arkaios-ui",
                workflow: workflowJson,
              }),
            },
          );
          const data = await resp.json();
          if (!resp.ok)
            throw new Error(data?.error || "Error enviando workflow a ComfyUI");
          const pid = data?.jobId || data?.raw?.prompt_id;
          setJobId(pid || "");
          setStatus("queued");
          return;
        } else {
          // Modo básico: construir un workflow mínimo T2I
          const wf = buildBasicWorkflow({
            prompt: basicPrompt || finalPrompt,
            negativePrompt: basicNegPrompt,
            steps: basicSteps,
            cfg: basicCfg,
            seed: basicSeed,
            width: basicWidth,
            height: basicHeight,
            ckpt: basicCkpt,
          });
          const resp = await fetch(
            `/api/comfyui/prompt?base=${encodeURIComponent(comfyBase)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                client_id: "arkaios-ui",
                workflow: JSON.stringify(wf),
              }),
            },
          );
          const data = await resp.json();
          if (!resp.ok)
            throw new Error(
              data?.error || "Error enviando workflow básico a ComfyUI",
            );
          const pid = data?.jobId || data?.raw?.prompt_id;
          setJobId(pid || "");
          setStatus("queued");
          return;
        }
      }
      // Rama gratuita: Pollinations (sólo imagen)
      if (provider === "pollinations") {
        // Asegura tipo imagen para Pollinations
        const pollPrompt = encodeURIComponent(finalPrompt);
        const referrer = "arkaios.local"; // opcional, ayuda a estabilidad en web
        const pollUrl = `https://image.pollinations.ai/prompt/${pollPrompt}?referrer=${referrer}`;
        setJobId("");
        setStatus("completed");
        setMediaUrl(pollUrl);
        setDownloadUrl(pollUrl);
        return;
      }

      // Proveedores remotos visibles: fal.ai, Replicate, Hugging Face (requieren API key)
      if (provider === "fal") {
        throw new Error(
          hasFal
            ? "Integración FAL pendiente en backend"
            : "Falta VITE_FAL_API_KEY en el entorno",
        );
      }
      if (provider === "replicate") {
        throw new Error(
          hasReplicate
            ? "Integración Replicate pendiente en backend"
            : "Falta VITE_REPLICATE_API_TOKEN en el entorno",
        );
      }
      if (provider === "huggingface") {
        throw new Error(
          hasHF
            ? "Integración Hugging Face pendiente en backend"
            : "Falta VITE_HF_TOKEN en el entorno",
        );
      }

      // Proveedor por defecto (Luma): usa backend
      const resp = await fetch("/api/media/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          prompt: finalPrompt,
          aspect_ratio: aspectRatio,
          durationSec,
          model,
          resolution,
          image_url: imageUrl || undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        // Fallback gratuito para video: si falla Luma o no hay key, intentamos crear un MP4 corto desde imagen
        if (type === "video") {
          await createVideoFallbackFromImage(finalPrompt, imageUrl);
          return;
        }
        throw new Error(data?.error || "Error iniciando generación");
      }
      setJobId(data.jobId);
      setStatus(data.status || "queued");
      // En algunos casos imagen/video puede venir listo
      const directUrl =
        data?.video?.url ||
        data?.assets?.video ||
        data?.image?.url ||
        data?.assets?.image;
      if (directUrl) {
        setMediaUrl(directUrl);
        setDownloadUrl(directUrl);
      }
    } catch (e: any) {
      setStatus("failed");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Fallback gratuito: crear un video corto (Ken Burns) desde imagen
  async function createVideoFallbackFromImage(finalPrompt: string, refImageUrl?: string) {
    try {
      // 1) Si no hay imagen de referencia, usa Pollinations para obtener una gratis
      const pollPrompt = encodeURIComponent(finalPrompt || "video experimental");
      const referrer = "arkaios.local";
      const fallbackImage = refImageUrl || `https://image.pollinations.ai/prompt/${pollPrompt}?referrer=${referrer}`;

      // 2) Convertir la imagen a video (2.5s @ 24fps) con un efecto Ken Burns simple
      const blobUrl = await kenBurnsToMp4(fallbackImage, { durationMs: 2500, fps: 24, width: 960, height: 540 });
      setJobId("");
      setStatus("completed");
      setMediaUrl(blobUrl);
      setDownloadUrl(blobUrl);

      // 3) Intentar convertir a MP4 en el servidor para mejor compatibilidad
      try {
        const base64 = await blobUrlToBase64(blobUrl);
        const r = await fetch("/api/media/convert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceBase64: base64, targetFormat: "mp4" }),
        });
        const d = await r.json();
        if (r.ok && d?.downloadUrl) {
          setDownloadUrl(d.downloadUrl);
          setMediaUrl(d.downloadUrl);
        }
      } catch (err) {
        console.warn("Conversión a MP4 no disponible, usando WebM:", err);
      }
    } catch (err) {
      console.error("Fallback de video desde imagen falló:", err);
      setStatus("failed");
    }
  }

  async function kenBurnsToMp4(imageSrc: string, opts: { durationMs: number; fps: number; width: number; height: number; }) {
    const { durationMs, fps, width, height } = opts;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas no disponible");

    const img = await loadImage(imageSrc);
    const stream = canvas.captureStream(fps);
    const chunks: BlobPart[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
    return await new Promise<string>((resolve, reject) => {
      let start: number | null = null;
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        try {
          const webmBlob = new Blob(chunks, { type: "video/webm" });
          // Crear URL del blob para preview/descarga
          const url = URL.createObjectURL(webmBlob);
          resolve(url);
        } catch (err) { reject(err as any); }
      };
      recorder.start();

      const animate = (ts: number) => {
        if (start === null) start = ts;
        const elapsed = ts - start;
        const t = Math.min(1, elapsed / durationMs);

        // Efecto Ken Burns: zoom lento 1.02 -> 1.15 y desplazamiento leve
        const zoom = 1.02 + t * (1.15 - 1.02);
        const panX = (img.width * 0.02) * t;
        const panY = (img.height * 0.02) * t;

        ctx.clearRect(0, 0, width, height);
        const srcW = img.width / zoom;
        const srcH = img.height / zoom;
        const srcX = (img.width - srcW) / 2 + panX;
        const srcY = (img.height - srcH) / 2 + panY;
        ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, width, height);

        if (elapsed < durationMs) {
          requestAnimationFrame(animate);
        } else {
          recorder.stop();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  function loadImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }

  async function blobUrlToBase64(url: string) {
    const r = await fetch(url);
    const b = await r.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        // res es un dataURL: data:video/webm;base64,....
        resolve(res);
      };
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(b);
    });
  }

  // Integración: escucha evento externo para recibir prompt desde el chat
  useEffect(() => {
    const handler = (ev: Event) => {
      try {
        const d = (ev as CustomEvent<{ prompt: string; type?: MediaType; provider?: ProviderType; auto?: boolean }>).detail as any;
        if (!d || typeof d.prompt !== 'string') return;
        if (d.provider) setProvider(d.provider as ProviderType);
        if (d.type) setType(d.type as MediaType);
        else if (d.provider === 'pollinations') setType('image');
        setPrompt(d.prompt);
        setImageUrl('');
        if (d.auto) {
          // Pequeño retraso para asegurar render antes de ejecutar
          setTimeout(() => { startGeneration(); }, 100);
        }
      } catch (err) {
        console.warn('Evento arkaios.media.prompt inválido:', err);
      }
    };
    window.addEventListener('arkaios.media.prompt', handler as EventListener);
    return () => {
      window.removeEventListener('arkaios.media.prompt', handler as EventListener);
    };
  }, []);

  // Polling del estado
  useEffect(() => {
    if (!jobId) return;
    const t = setInterval(async () => {
      try {
        const endpoint =
          provider === "comfyui"
            ? `/api/comfyui/history/${jobId}?base=${encodeURIComponent(comfyBase)}`
            : `/api/media/status/${jobId}`;
        const resp = await fetch(endpoint);
        const data = await resp.json();
        if (!resp.ok)
          throw new Error(data?.error || "Error consultando estado");
        setStatus(data.state || data.status || "unknown");
        const directUrl = data?.videoUrl || data?.imageUrl;
        if (directUrl) {
          setMediaUrl(directUrl);
          setDownloadUrl(directUrl);
        }
      } catch (e) {
        console.error(e);
      }
    }, 2500);
    return () => clearInterval(t);
  }, [jobId, provider, comfyBase]);

  useEffect(() => {
    try {
      localStorage.setItem("arkaios.comfyBase", comfyBase);
    } catch {}
  }, [comfyBase]);

  return (
    <div className="mt-6 p-4 border border-teal-600/40 rounded-xl bg-gray-950">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-teal-400">
          Generar medios (Imagen/Video)
        </h2>
        <label className="text-sm text-gray-300 flex items-center gap-2">
          <input
            type="checkbox"
            checked={useSurvey}
            onChange={() => setUseSurvey((v) => !v)}
          />
          Usar encuestador para enriquecer prompt
        </label>
      </div>

      {useSurvey && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <Input
            placeholder="Sujeto principal (ej. un tigre en la nieve)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Input
            placeholder="Estilo (cinemático, pintura al óleo, fotorrealista)"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          />
          <Input
            placeholder="Estado de ánimo (épico, melancólico, alegre)"
            value={mood}
            onChange={(e) => setMood(e.target.value)}
          />
          <Input
            placeholder="Cámara (travelling, dolly zoom, plano detalle)"
            value={camera}
            onChange={(e) => setCamera(e.target.value)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        <div>
          <label className="text-sm text-gray-300">Proveedor</label>
          <select
            className="w-full mt-1 p-2 rounded bg-gray-800 text-white"
            value={provider}
            onChange={(e) => {
              const p = e.target.value as ProviderType;
              setProvider(p);
              // Si cambia a Pollinations, fuerza tipo imagen
              if (p === "pollinations" && type !== "image") setType("image");
              if (p === "comfyui" && type !== "image") setType("image");
            }}
          >
            <option value="luma">Luma (GPU remota, requiere API key)</option>
            <option value="fal">
              fal.ai (GPU remota){!hasFal ? " · no configurado" : ""}
            </option>
            <option value="replicate">
              Replicate (GPU remota){!hasReplicate ? " · no configurado" : ""}
            </option>
            <option value="huggingface">
              Hugging Face Inference{!hasHF ? " · no configurado" : ""}
            </option>
            <option value="pollinations">
              Pollinations (gratis, sólo imagen)
            </option>
            <option value="comfyui">
              ComfyUI (local addon: Básico/Avanzado)
            </option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-300">Tipo</label>
          <select
            className="w-full mt-1 p-2 rounded bg-gray-800 text-white"
            value={type}
            onChange={(e) => setType(e.target.value as MediaType)}
          >
            {provider === "luma" && <option value="video">Video (Ray)</option>}
            <option value="image">
              Imagen{" "}
              {provider === "luma"
                ? "(Photon)"
                : provider === "pollinations"
                  ? "(Pollinations)"
                  : "(ComfyUI)"}
            </option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-300">Aspect Ratio</label>
          <select
            className="w-full mt-1 p-2 rounded bg-gray-800 text-white"
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value)}
          >
            {aspectOptions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        {provider === "luma" && type === "video" && (
          <div>
            <label className="text-sm text-gray-300">
              Duración (segundos, múltiplos de 5)
            </label>
            <input
              type="range"
              min={5}
              max={30}
              step={5}
              value={durationSec}
              onChange={(e) => setDurationSec(Number(e.target.value))}
              className="w-full"
            />
            <div className="text-xs text-gray-400 mt-1">{durationSec}s</div>
          </div>
        )}
        <div>
          <label className="text-sm text-gray-300">Modelo</label>
          {provider === "luma" ? (
            <select
              className="w-full mt-1 p-2 rounded bg-gray-800 text-white"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {type === "video" ? (
                <>
                  <option value="ray-2">ray-2</option>
                  <option value="ray-flash-2">ray-flash-2</option>
                  <option value="ray-1-6">ray-1-6</option>
                </>
              ) : (
                <>
                  <option value="photon-1">photon-1</option>
                  <option value="photon-flash-1">photon-flash-1</option>
                </>
              )}
            </select>
          ) : provider === "pollinations" ? (
            <div className="text-xs text-gray-400 mt-2">
              Pollinations no requiere modelo; genera imagen directamente desde
              el prompt.
            </div>
          ) : (
            <div className="text-xs text-gray-400 mt-2">
              ComfyUI usa el modelo definido en tu workflow JSON.
            </div>
          )}
        </div>
        {provider === "luma" && type === "video" && (
          <div>
            <label className="text-sm text-gray-300">Resolución</label>
            <select
              className="w-full mt-1 p-2 rounded bg-gray-800 text-white"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            >
              <option value="540p">540p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4k">4k</option>
            </select>
          </div>
        )}
        {provider !== "comfyui" && (
          <>
            <div className="md:col-span-2">
              <label className="text-sm text-gray-300">Prompt</label>
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe lo que quieres generar"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm text-gray-300">
                Imagen de referencia (URL opcional)
              </label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... (usa tu propio CDN si es posible)"
              />
            </div>
          </>
        )}
        {provider === "comfyui" && (
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm text-gray-300">Servidor ComfyUI:</label>
              <Input
                value={comfyBase}
                onChange={(e) => setComfyBase(e.target.value)}
                placeholder="http://127.0.0.1:9000"
              />
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    setTestStatus("probando...");
                    if (autoStart) {
                      const m = comfyBase.match(/:(\d+)/);
                      const port = m ? Number(m[1]) : 9000;
                      setStartStatus(`arrancando ComfyUI en ${port}...`);
                      const rStart = await fetch(`/api/comfyui/manage/start?port=${port}`, { method: "POST" });
                      const dStart = await rStart.json();
                      if (!rStart.ok || !dStart?.ok) {
                        setStartStatus(`No se pudo arrancar: ${dStart?.error || "error"}`);
                      } else {
                        setStartStatus(`ComfyUI iniciado (pid=${dStart.pid})`);
                        // Pequeña espera para levantar servidor
                        await new Promise((r) => setTimeout(r, 1200));
                      }
                    }
                    const r = await fetch(
                      `/api/comfyui/test?base=${encodeURIComponent(comfyBase)}`,
                    );
                    const data = await r.json();
                    if (data?.reachable) setTestStatus(`OK (${data.status})`);
                    else
                      setTestStatus(
                        `No accesible: ${data?.error || data?.status || ""}`,
                      );
                  } catch (err: any) {
                    setTestStatus(`Error: ${err?.message || String(err)}`);
                  }
                }}
              >
                Probar conexión
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  try {
                    const m = comfyBase.match(/:(\d+)/);
                    const port = m ? Number(m[1]) : 9000;
                    setTestStatus(`liberando puerto ${port}...`);
                    const r = await fetch(`/api/system/free-port?port=${port}`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                    });
                    const data = await r.json();
                    if (!r.ok || !data?.ok) {
                      setTestStatus(`No se pudo liberar: ${data?.error || "error"}`);
                      return;
                    }
                    const killed = Array.isArray(data?.killed) ? data.killed : [];
                    if (killed.length === 0) {
                      setTestStatus(`Puerto ${port} ya estaba libre`);
                    } else {
                      setTestStatus(`Liberado. PID(s) cerrados: ${killed.join(", ")}`);
                    }
                  } catch (err: any) {
                    setTestStatus(`Error liberando: ${err?.message || String(err)}`);
                  }
                }}
              >
                Forzar puerto
              </Button>
              <Button
                variant="default"
                onClick={async () => {
                  try {
                    const m = comfyBase.match(/:(\d+)/);
                    const port = m ? Number(m[1]) : 9000;
                    setStartStatus(`arrancando ComfyUI en ${port}...`);
                    const r = await fetch(`/api/comfyui/manage/start?port=${port}`, { method: "POST" });
                    const data = await r.json();
                    if (!r.ok || !data?.ok) {
                      setStartStatus(`No se pudo arrancar: ${data?.error || "error"}`);
                    } else {
                      setStartStatus(`ComfyUI iniciado (pid=${data.pid})`);
                    }
                  } catch (err: any) {
                    setStartStatus(`Error arrancando: ${err?.message || String(err)}`);
                  }
                }}
              >
                Arrancar ComfyUI
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  try {
                    const m = comfyBase.match(/:(\d+)/);
                    const port = m ? Number(m[1]) : 9000;
                    setStartStatus(`deteniendo ComfyUI en ${port}...`);
                    const r = await fetch(`/api/comfyui/manage/stop?port=${port}`, { method: "POST" });
                    const data = await r.json();
                    if (!r.ok || !data?.ok) {
                      setStartStatus(`No se pudo detener: ${data?.error || "error"}`);
                    } else {
                      setStartStatus(`ComfyUI detenido`);
                    }
                  } catch (err: any) {
                    setStartStatus(`Error deteniendo: ${err?.message || String(err)}`);
                  }
                }}
              >
                Detener ComfyUI
              </Button>
              <span className="text-xs text-gray-400">{testStatus || ""}</span>
              <span className="text-xs text-gray-400">{startStatus || ""}</span>
              <span className="text-xs text-gray-400">{comfyServiceStatus || ""}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm text-gray-300">Modo ComfyUI:</label>
              <select
                className="rounded bg-gray-800 text-white p-2"
                value={comfyMode}
                onChange={(e) => setComfyMode(e.target.value as any)}
              >
                <option value="basic">Básico (Texto a Imagen)</option>
                <option value="advanced">Avanzado (Pegar JSON)</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-sm text-gray-300">Auto-liberar y arrancar (force):</label>
              <input
                type="checkbox"
                className="w-4 h-4"
                checked={autoStart}
                onChange={(e) => setAutoStart(e.target.checked)}
              />
            </div>
            {comfyMode === "advanced" ? (
              <>
                <label className="text-sm text-gray-300">
                  Workflow JSON (ComfyUI)
                </label>
                <textarea
                  className="w-full mt-1 p-2 rounded bg-gray-800 text-white min-h-[140px]"
                  value={workflowJson}
                  onChange={(e) => setWorkflowJson(e.target.value)}
                  placeholder="Pega aquí el JSON exportado del workflow de ComfyUI"
                />
                <div className="text-xs text-gray-400 mt-1">
                  Nota: el prompt de arriba no modifica el workflow. Edita el
                  JSON para cambiar textos/modelos.
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-300">Prompt</label>
                    <Input
                      value={basicPrompt}
                      onChange={(e) => setBasicPrompt(e.target.value)}
                      placeholder="Describe la imagen (T2I)"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300">
                      Negative Prompt
                    </label>
                    <Input
                      value={basicNegPrompt}
                      onChange={(e) => setBasicNegPrompt(e.target.value)}
                      placeholder="Opcional: lo que NO quieres"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300">Steps</label>
                    <Input
                      type="number"
                      value={basicSteps}
                      onChange={(e) =>
                        setBasicSteps(Number(e.target.value) || 20)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300">CFG</label>
                    <Input
                      type="number"
                      value={basicCfg}
                      onChange={(e) => setBasicCfg(Number(e.target.value) || 8)}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300">Seed</label>
                    <Input
                      type="number"
                      value={basicSeed}
                      onChange={(e) =>
                        setBasicSeed(Number(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-300">
                      Tamaño (ancho x alto)
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        value={basicWidth}
                        onChange={(e) =>
                          setBasicWidth(Number(e.target.value) || 768)
                        }
                      />
                      <Input
                        type="number"
                        value={basicHeight}
                        onChange={(e) =>
                          setBasicHeight(Number(e.target.value) || 768)
                        }
                      />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-300">
                      Checkpoint (modelo)
                    </label>
                    <Input
                      value={basicCkpt}
                      onChange={(e) => setBasicCkpt(e.target.value)}
                      placeholder="Ej: SD15/SDXL: nombre de archivo.ckpt/safetensors"
                    />
                    <div className="text-xs text-gray-400 mt-1">
                      Debe existir en tu ComfyUI local. Usa el nombre exacto del
                      archivo de modelo.
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex gap-3 mt-4">
        <Button
          disabled={
            loading ||
            (provider !== "comfyui" && !prompt.trim()) ||
            (provider === "comfyui" &&
              comfyMode === "advanced" &&
              !workflowJson.trim()) ||
            (provider === "comfyui" &&
              comfyMode === "basic" &&
              !basicPrompt.trim())
          }
          onClick={startGeneration}
          className="bg-teal-500 hover:bg-teal-600 text-gray-900"
        >
          Generar
        </Button>
        <div className="text-sm text-gray-400">Estado: {status || "-"}</div>
      </div>

      {mediaUrl && (
        <div className="mt-4">
          {provider === "luma" && type === "video" ? (
            <video
              src={mediaUrl}
              controls
              className="w-full rounded-lg border border-teal-700"
            />
          ) : (
            <img
              src={mediaUrl}
              alt="Generación"
              className="max-w-full rounded-lg border border-teal-700"
            />
          )}
          {downloadUrl && (
            <div className="mt-2">
              <a
                href={downloadUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center px-3 py-2 rounded bg-teal-600 text-gray-900 hover:bg-teal-500"
              >
                Descargar (.mp4 / .webm)
              </a>
            </div>
          )}
        </div>
      )}
      {provider === "pollinations" && type === "video" && (
        <div className="mt-3 text-xs text-amber-400">
          Nota: Pollinations sólo soporta imágenes. Cambia el tipo a Imagen para
          usar el proveedor gratuito.
        </div>
      )}
      {provider === "comfyui" && (
        <div className="mt-3 text-xs text-amber-400">
          {comfyMode === "advanced"
            ? "Usa workflows con nodo SaveImage para ver resultados aquí."
            : "El modo Básico crea un workflow T2I mínimo; asegúrate de configurar el checkpoint correctamente."}{" "}
          El servidor local debe estar activo en {comfyBase}.
        </div>
      )}
    </div>
  );
}
  // Cuando el medio está listo, publica un evento para que el Chat muestre previsualización y descarga
  useEffect(() => {
    if (!mediaUrl) return;
    if (!status || (status !== "completed" && status !== "ready")) return;
    try {
      const detail = {
        type,
        provider,
        url: mediaUrl,
        downloadUrl: downloadUrl || mediaUrl,
        prompt: prompt,
      };
      window.dispatchEvent(new CustomEvent("arkaios.media.result", { detail }));
    } catch (err) {
      console.warn("No se pudo despachar arkaios.media.result:", err);
    }
  }, [mediaUrl, status]);
