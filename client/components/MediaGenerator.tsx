import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MediaType = "image" | "video";

const aspectOptions = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9", "9:21"];

export default function MediaGenerator() {
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
  const [loading, setLoading] = useState<boolean>(false);
  const [useSurvey, setUseSurvey] = useState<boolean>(true);

  // Encuestador simple para enriquecer prompt
  const [subject, setSubject] = useState("");
  const [style, setStyle] = useState("");
  const [mood, setMood] = useState("");
  const [camera, setCamera] = useState("");

  function buildPrompt() {
    if (!useSurvey) return prompt;
    const parts = [subject, style && `style: ${style}`, mood && `mood: ${mood}`, camera && `camera: ${camera}`]
      .filter(Boolean);
    return [prompt, ...parts].filter(Boolean).join("; ");
  }

  async function startGeneration() {
    const finalPrompt = buildPrompt();
    if (!finalPrompt) return;
    setLoading(true);
    setStatus("queued");
    setMediaUrl("");

    try {
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
      if (!resp.ok) throw new Error(data?.error || "Error iniciando generación");
      setJobId(data.jobId);
      setStatus(data.status || "queued");
      // En algunos casos imagen/video puede venir listo
      const directUrl = data?.video?.url || data?.assets?.video || data?.image?.url || data?.assets?.image;
      if (directUrl) setMediaUrl(directUrl);
    } catch (e: any) {
      setStatus("failed");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  // Polling del estado
  useEffect(() => {
    if (!jobId) return;
    const t = setInterval(async () => {
      try {
        const resp = await fetch(`/api/media/status/${jobId}`);
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.error || "Error consultando estado");
        setStatus(data.state || "unknown");
        const directUrl = data?.videoUrl || data?.imageUrl;
        if (directUrl) setMediaUrl(directUrl);
      } catch (e) {
        console.error(e);
      }
    }, 2500);
    return () => clearInterval(t);
  }, [jobId]);

  return (
    <div className="mt-6 p-4 border border-teal-600/40 rounded-xl bg-gray-950">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-teal-400">Generar medios (Imagen/Video)</h2>
        <label className="text-sm text-gray-300 flex items-center gap-2">
          <input type="checkbox" checked={useSurvey} onChange={() => setUseSurvey(v => !v)} />
          Usar encuestador para enriquecer prompt
        </label>
      </div>

      {useSurvey && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <Input placeholder="Sujeto principal (ej. un tigre en la nieve)" value={subject} onChange={e => setSubject(e.target.value)} />
          <Input placeholder="Estilo (cinemático, pintura al óleo, fotorrealista)" value={style} onChange={e => setStyle(e.target.value)} />
          <Input placeholder="Estado de ánimo (épico, melancólico, alegre)" value={mood} onChange={e => setMood(e.target.value)} />
          <Input placeholder="Cámara (travelling, dolly zoom, plano detalle)" value={camera} onChange={e => setCamera(e.target.value)} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        <div>
          <label className="text-sm text-gray-300">Tipo</label>
          <select className="w-full mt-1 p-2 rounded bg-gray-800 text-white" value={type} onChange={e => setType(e.target.value as MediaType)}>
            <option value="video">Video (Ray)</option>
            <option value="image">Imagen (Photon)</option>
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-300">Aspect Ratio</label>
          <select className="w-full mt-1 p-2 rounded bg-gray-800 text-white" value={aspectRatio} onChange={e => setAspectRatio(e.target.value)}>
            {aspectOptions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-300">Duración (segundos, múltiplos de 5)</label>
          <input type="range" min={5} max={30} step={5} value={durationSec} onChange={e => setDurationSec(Number(e.target.value))} className="w-full" />
          <div className="text-xs text-gray-400 mt-1">{durationSec}s</div>
        </div>
        <div>
          <label className="text-sm text-gray-300">Modelo</label>
          <select className="w-full mt-1 p-2 rounded bg-gray-800 text-white" value={model} onChange={e => setModel(e.target.value)}>
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
        </div>
        {type === "video" && (
          <div>
            <label className="text-sm text-gray-300">Resolución</label>
            <select className="w-full mt-1 p-2 rounded bg-gray-800 text-white" value={resolution} onChange={e => setResolution(e.target.value)}>
              <option value="540p">540p</option>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4k">4k</option>
            </select>
          </div>
        )}
        <div className="md:col-span-2">
          <label className="text-sm text-gray-300">Prompt</label>
          <Input value={prompt} onChange={e => setPrompt(e.target.value)} placeholder="Describe lo que quieres generar" />
        </div>
        <div className="md:col-span-2">
          <label className="text-sm text-gray-300">Imagen de referencia (URL opcional)</label>
          <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://... (usa tu propio CDN si es posible)" />
        </div>
      </div>

      <div className="flex gap-3 mt-4">
        <Button disabled={loading || !prompt.trim()} onClick={startGeneration} className="bg-teal-500 hover:bg-teal-600 text-gray-900">Generar</Button>
        <div className="text-sm text-gray-400">Estado: {status || "-"}</div>
      </div>

      {mediaUrl && (
        <div className="mt-4">
          {type === "video" ? (
            <video src={mediaUrl} controls className="w-full rounded-lg border border-teal-700" />
          ) : (
            <img src={mediaUrl} alt="Generación" className="max-w-full rounded-lg border border-teal-700" />
          )}
        </div>
      )}
    </div>
  );
}