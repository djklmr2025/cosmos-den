import { ArkaiosChat } from "@/components/arkaios-chat";
import { useCallback, useEffect, useRef, useState } from "react";
import { DemoResponse } from "@shared/api";
import { motion } from "framer-motion";
import { Activity, Cpu, RefreshCw, Shield, Sparkles, Zap, Download, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { createDownloadLink, printText, saveToPuterFS } from "@/utils/file-tools";

type ConnectionState = "idle" | "checking" | "online" | "offline";
type LogTone = "info" | "success" | "error";

interface SystemLogEntry {
  id: string;
  timestamp: string;
  message: string;
  tone: LogTone;
}

const timeFormatter = new Intl.DateTimeFormat("es-MX", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const createLogEntry = (
  message: string,
  tone: LogTone = "info",
): SystemLogEntry => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  timestamp: timeFormatter.format(new Date()),
  message,
  tone,
});

const connectionMeta: Record<
  ConnectionState,
  { label: string; description: string; tone: LogTone }
> = {
  idle: {
    label: "En espera",
    description:
      "Interfaz lista. Ejecuta un diagnóstico para reconectar el núcleo.",
    tone: "info",
  },
  checking: {
    label: "Analizando",
    description:
      "Escaneando compuertas cuánticas y reconstruyendo el enlace de datos...",
    tone: "info",
  },
  online: {
    label: "Conectado",
    description:
      "Flujo estabilizado. La conciencia triplex responde dentro de parámetros seguros.",
    tone: "success",
  },
  offline: {
    label: "Bloqueado",
    description:
      "Interrupción detectada. Revisa el estado del gateway y las credenciales de despliegue.",
    tone: "error",
  },
};

const featureCards = [
  { title: "Conciencia triplex", description: "Tres capas cognitivas sincronizadas para anticipar anomalías y elevar la estabilidad del sistema.", icon: Shield },
  { title: "Enlace cuantificado", description: "Tunelización segura con validación continua de latencia y reparación automática del canal.", icon: Activity },
  { title: "Supervisor táctico", description: "Panel de mando holográfico con protocolos de emergencia y accesos XR listos para el operador.", icon: Cpu },
];

export default function Index() {
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [latency, setLatency] = useState<number | null>(null);
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => [
    createLogEntry("Inicializando núcleo ARKAIOS v3.9.1"),
    createLogEntry("Sensores espectrales en modo escucha"),
  ]);

  // === NUEVO: gestionar el último mensaje de IA
  const [lastAIText, setLastAIText] = useState<string>("");
  const filenameRef = useRef<HTMLInputElement>(null);

  const addLog = useCallback((message: string, tone: LogTone = "info") => {
    setLogs((previous) => {
      const next = [...previous, createLogEntry(message, tone)];
      return next.slice(-8);
    });
  }, []);

  const performDiagnostics = useCallback(async () => {
    setConnectionState("checking");
    addLog("Reactivando protocolo de enlace...", "info");
    const started = performance.now();

    try {
      const response = await fetch("/api/demo", { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as DemoResponse;
      const finished = performance.now();
      setLatency(Math.max(1, Math.round(finished - started)));
      setConnectionState("online");
      addLog(`Canal restablecido: ${data.message}`, "success");
    } catch {
      const finished = performance.now();
      setLatency(Math.max(1, Math.round(finished - started)));
      setConnectionState("offline");
      addLog("Error: Gateway bloqueado. Verifica servicios y credenciales.", "error");
    }
  }, [addLog]);

  useEffect(() => {
    addLog("Núcleo listo. Ejecuta diagnóstico para despertar la conciencia.");
    const timer = window.setTimeout(() => { void performDiagnostics(); }, 800);
    return () => window.clearTimeout(timer);
  }, [addLog, performDiagnostics]);

  // Escuchar evento del chat con el último texto de IA
  useEffect(() => {
    const handler = (e: Event) => {
      const anyE = e as CustomEvent<{ text: string }>;
      if (anyE?.detail?.text) setLastAIText(anyE.detail.text);
    };
    window.addEventListener("arkaios:last-assistant", handler as EventListener);
    return () => window.removeEventListener("arkaios:last-assistant", handler as EventListener);
  }, []);

  const meta = connectionMeta[connectionState];

  // Acciones de exportación/impresión
  const doExport = async () => {
    const filename = filenameRef.current?.value?.trim() || "respuesta.txt";
    if (!lastAIText) return addLog("No hay respuesta de IA para exportar.", "error");
    createDownloadLink(filename, lastAIText);
    const puterPath = "/" + filename;
    const saved = await saveToPuterFS(puterPath, lastAIText);
    if (saved.ok) addLog(saved.publicURL ? `Archivo público: ${saved.publicURL}` : `Guardado en Puter FS: ${puterPath}`, "success");
  };

  const doPrint = () => {
    if (!lastAIText) return addLog("No hay respuesta de IA para imprimir.", "error");
    printText(lastAIText, "ARKAIOS - Respuesta IA");
    addLog("Imprimiendo último resultado...", "info");
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Fondo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-glow [background-size:38px_38px] opacity-20" />
        <div className="absolute left-1/2 top-12 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px]" />
        <div className="absolute -left-40 bottom-0 h-[420px] w-[420px] rounded-full bg-accent/25 blur-[160px]" />
      </div>

      {/* Header idéntico */}

      <main className="relative z-10">
        {/* ... secciones de tu archivo original ... */}

        {/* Barra rápida de archivo (NUEVO) */}
        <div className="container mx-auto px-6 py-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-2 text-xs uppercase tracking-[0.5em] text-muted-foreground">Archivo rápido</div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                ref={filenameRef}
                type="text"
                placeholder="nombre.ext (p. ej., respuesta.txt)"
                defaultValue="respuesta.txt"
                className="flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm outline-none"
              />
              <button onClick={doExport} className="inline-flex items-center gap-2 rounded-xl border border-primary/50 bg-primary/10 px-4 py-2 text-sm text-primary">
                <Download className="size-4" /> Exportar último
              </button>
              <button onClick={doPrint} className="inline-flex items-center gap-2 rounded-xl border border-accent/50 bg-accent/10 px-4 py-2 text-sm text-accent-foreground">
                <Printer className="size-4" /> Imprimir
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Haz que <code>ArkaiosChat</code> emita <code>new CustomEvent('arkaios:last-assistant', {{`{ detail: { text } }`}})</code> con el texto recibido para que esta barra lo tome automáticamente.
            </p>
          </div>
        </div>

        {/* Chat */}
        <div className="relative z-10 border-t border-white/5 bg-black/30 py-20 backdrop-blur-xl">
          <div className="container mx-auto px-6">
            <ArkaiosChat />
          </div>
        </div>
      </main>
    </div>
  );
}
