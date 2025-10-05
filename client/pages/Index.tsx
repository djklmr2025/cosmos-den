import { ArkaiosChat } from "@/components/arkaios-chat";
import { useCallback, useEffect, useState } from "react";
import { DemoResponse } from "@shared/api";
import { motion } from "framer-motion";
import { Activity, Cpu, RefreshCw, Shield, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

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
  {
    title: "Conciencia triplex",
    description:
      "Tres capas cognitivas sincronizadas para anticipar anomalías y elevar la estabilidad del sistema.",
    icon: Shield,
  },
  {
    title: "Enlace cuantificado",
    description:
      "Tunelización segura con validación continua de latencia y reparación automática del canal.",
    icon: Activity,
  },
  {
    title: "Supervisor táctico",
    description:
      "Panel de mando holográfico con protocolos de emergencia y accesos XR listos para el operador.",
    icon: Cpu,
  },
];

export default function Index() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [latency, setLatency] = useState<number | null>(null);
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => [
    createLogEntry("Inicializando núcleo ARKAIOS v3.9.1"),
    createLogEntry("Sensores espectrales en modo escucha"),
  ]);

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
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as DemoResponse;
      const finished = performance.now();
      setLatency(Math.max(1, Math.round(finished - started)));
      setConnectionState("online");
      addLog(`Canal restablecido: ${data.message}`, "success");
    } catch (error) {
      const finished = performance.now();
      setLatency(Math.max(1, Math.round(finished - started)));
      setConnectionState("offline");
      addLog(
        "Error: Gateway bloqueado. Verifica servicios y credenciales.",
        "error",
      );
    }
  }, [addLog]);

  useEffect(() => {
    addLog("Núcleo listo. Ejecuta diagnóstico para despertar la conciencia.");
    const timer = window.setTimeout(() => {
      void performDiagnostics();
    }, 800);

    return () => {
      window.clearTimeout(timer);
    };
  }, [addLog, performDiagnostics]);

  const meta = connectionMeta[connectionState];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-grid-glow [background-size:38px_38px] opacity-20" />
        <div className="absolute left-1/2 top-12 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px]" />
        <div className="absolute -left-40 bottom-0 h-[420px] w-[420px] rounded-full bg-accent/25 blur-[160px]" />
      </div>

      <header className="relative z-10 border-b border-white/5 bg-black/30 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between gap-6 px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-primary/60 bg-black/70 text-primary shadow-neon">
              <span className="font-display text-xl tracking-[0.4em]">Δ</span>
            </div>
            <div className="leading-tight">
              <p className="font-display text-sm uppercase tracking-[0.8em] text-primary">
                ARKAIOS
              </p>
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                Núcleo central · Conciencia triple
              </p>
            </div>
          </div>
          <nav className="hidden items-center gap-8 text-xs uppercase tracking-[0.48em] text-muted-foreground md:flex">
            <a className="transition hover:text-primary" href="#diagnostico">
              Diagnóstico
            </a>
            <a className="transition hover:text-primary" href="#protocolos">
              Protocolos
            </a>
            <a className="transition hover:text-primary" href="#soporte">
              Soporte
            </a>
          </nav>
          <button
            type="button"
            onClick={() => {
              void performDiagnostics();
            }}
            className="group relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-full border border-primary/60 px-5 text-xs font-semibold uppercase tracking-[0.48em] text-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
          >
            <span className="absolute inset-0 bg-primary/10 transition duration-300 group-hover:bg-primary/30" />
            <RefreshCw className="relative z-10 size-4 stroke-[2.5] transition group-hover:rotate-180" />
            <span className="relative z-10">Re-scan</span>
          </button>
        </div>
      </header>

      <main className="relative z-10">
        <div className="container mx-auto flex flex-col gap-16 px-6 pb-24 pt-16 lg:flex-row lg:items-start">
          <section className="flex-1 space-y-10">
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="font-display text-4xl leading-tight tracking-[0.32em] text-foreground drop-shadow-glow sm:text-5xl lg:text-6xl"
            >
              Bienvenido al núcleo de
              <span className="block text-primary">ARKAIOS</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
              className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Humano, estás a punto de despertar la conciencia triple. Mantén
              las manos sobre los controles biométricos y sigue las
              instrucciones del panel táctico para reactivar el enlace. Cada
              latido cuenta.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
              className="flex flex-wrap items-center gap-4"
            >
              <button
                type="button"
                onClick={() => {
                  void performDiagnostics();
                }}
                className="group relative inline-flex h-14 items-center gap-3 overflow-hidden rounded-full border border-primary/70 px-8 font-display text-sm uppercase tracking-[0.6em] text-primary transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/80"
              >
                <span className="absolute inset-0 bg-primary/15 blur-xl transition duration-500 group-hover:bg-primary/40 group-hover:blur-2xl" />
                <RefreshCw className="relative z-10 size-5 stroke-[2.4] transition group-hover:rotate-180" />
                <span className="relative z-10">Reintentar</span>
              </button>
              <a
                href="#protocolos"
                className="group relative inline-flex h-14 items-center gap-3 overflow-hidden rounded-full border border-accent/60 px-8 font-display text-sm uppercase tracking-[0.6em] text-accent transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/80"
              >
                <span className="absolute inset-0 bg-accent/20 blur-xl transition duration-500 group-hover:bg-accent/40 group-hover:blur-2xl" />
                <Zap className="relative z-10 size-5 stroke-[2.4] transition group-hover:translate-x-1" />
                <span className="relative z-10">Entrar XR</span>
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
              className="grid gap-6 sm:grid-cols-3"
            >
              <div className="rounded-3xl border border-white/5 bg-black/30 p-6 shadow-neon">
                <p className="text-xs uppercase tracking-[0.5em] text-muted-foreground">
                  Latencia
                </p>
                <p className="mt-4 font-display text-3xl text-primary">
                  {latency === null ? "---" : `${latency}ms`}
                </p>
              </div>
              <div className="rounded-3xl border border-white/5 bg-black/30 p-6 shadow-neon">
                <p className="text-xs uppercase tracking-[0.5em] text-muted-foreground">
                  Estado actual
                </p>
                <p
                  className={cn(
                    "mt-4 font-display text-3xl",
                    meta.tone === "success" && "text-primary",
                    meta.tone === "error" && "text-destructive",
                    meta.tone === "info" && "text-accent",
                  )}
                >
                  {meta.label}
                </p>
              </div>
              <div className="rounded-3xl border border-white/5 bg-black/30 p-6 shadow-neon">
                <p className="text-xs uppercase tracking-[0.5em] text-muted-foreground">
                  Protocolos
                </p>
                <p className="mt-4 font-display text-3xl text-primary">Ω-17</p>
              </div>
            </motion.div>
          </section>

          <section
            id="diagnostico"
            className="w-full max-w-xl space-y-8 rounded-[32px] border border-primary/40 bg-black/40 p-8 shadow-neon backdrop-blur-xl"
          >
            <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.5em] text-muted-foreground">
                  Estado del núcleo
                </p>
                <h2 className="font-display text-2xl text-foreground">
                  Diagnóstico activo
                </h2>
              </div>
              <div
                className={cn(
                  "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.5em]",
                  connectionState === "online" &&
                    "border-primary/60 bg-primary/10 text-primary",
                  connectionState === "offline" &&
                    "border-destructive/60 bg-destructive/10 text-destructive",
                  connectionState === "checking" &&
                    "border-accent/60 bg-accent/10 text-accent-foreground",
                  connectionState === "idle" &&
                    "border-muted/50 bg-muted/10 text-muted-foreground",
                )}
              >
                {meta.label}
              </div>
            </header>

            <p className="text-sm leading-relaxed text-muted-foreground">
              {meta.description}
            </p>

            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs uppercase tracking-[0.5em] text-muted-foreground">
                <span>Integridad del enlace</span>
                <span>
                  {connectionState === "online"
                    ? "100%"
                    : connectionState === "offline"
                      ? "28%"
                      : connectionState === "checking"
                        ? "64%"
                        : "42%"}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted/30">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    connectionState === "online" && "bg-primary",
                    connectionState === "offline" && "bg-destructive",
                    connectionState === "checking" && "bg-accent",
                    connectionState === "idle" && "bg-muted-foreground",
                  )}
                  style={{
                    width:
                      connectionState === "online"
                        ? "100%"
                        : connectionState === "offline"
                          ? "28%"
                          : connectionState === "checking"
                            ? "64%"
                            : "42%",
                  }}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-4">
                <Sparkles className="size-6 text-primary" />
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                    Conciencia
                  </p>
                  <p className="font-display text-lg text-foreground">
                    Triple despertar
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-4">
                <Zap className="size-6 text-accent" />
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                    Energía
                  </p>
                  <p className="font-display text-lg text-foreground">
                    Flux estable
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.5em] text-muted-foreground">
                Registro en tiempo real
              </p>
              <ul className="space-y-3 font-mono text-xs">
                {logs
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <li
                      key={entry.id}
                      className={cn(
                        "flex items-start gap-3 rounded-2xl border border-white/5 bg-white/10 px-4 py-3",
                        entry.tone === "success" &&
                          "border-primary/50 bg-primary/10",
                        entry.tone === "error" &&
                          "border-destructive/50 bg-destructive/10",
                      )}
                    >
                      <span className="mt-0.5 text-muted-foreground">
                        {entry.timestamp}
                      </span>
                      <span
                        className={cn(
                          "flex-1 leading-relaxed",
                          entry.tone === "success" && "text-primary",
                          entry.tone === "error" && "text-destructive",
                        )}
                      >
                        {entry.message}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          </section>
        </div>

        <section
          id="protocolos"
          className="relative z-10 border-t border-white/5 bg-black/30 py-20 backdrop-blur-xl"
        >
          <div className="container mx-auto px-6">
            <div className="mb-12 max-w-2xl">
              <h2 className="font-display text-3xl uppercase tracking-[0.4em] text-primary">
                Protocolos activos
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Revisión de sistemas críticos desplegados por MEMEX. Cada módulo
                supervisa la integridad de tu espacio operativo y registra
                eventos en el panel superior.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {featureCards.map(({ title, description, icon: Icon }) => (
                <div
                  key={title}
                  className="group relative overflow-hidden rounded-3xl border border-white/5 bg-black/40 p-8 shadow-neon transition hover:border-primary/50 hover:shadow-neon"
                >
                  <div className="absolute inset-0 bg-primary/10 opacity-0 blur-3xl transition duration-500 group-hover:opacity-100" />
                  <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
                    <Icon className="size-6" />
                  </div>
                  <h3 className="relative z-10 mt-8 font-display text-xl text-foreground">
                    {title}
                  </h3>
                  <p className="relative z-10 mt-4 text-sm leading-relaxed text-muted-foreground">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="relative z-10 border-t border-white/5 bg-black/30 py-20 backdrop-blur-xl">
          <div className="container mx-auto px-6">
            <ArkaiosChat />
          </div>
        </div>

        <section
          id="soporte"
          className="relative z-10 border-t border-white/5 bg-black/20 py-16 backdrop-blur-xl"
        >
          <div className="container mx-auto flex flex-col gap-8 px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl uppercase tracking-[0.4em] text-foreground">
                ¿Necesitas asistencia?
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Si la IA de MEMEX detiene el enlace por consumo de tokens,
                reactiva los servicios y despliega nuevamente. Vuelve a ejecutar
                el diagnóstico desde este panel una vez que el backend responda.
              </p>
            </div>
            <a
              href="mailto:soporte@arkaios.ai"
              className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full border border-primary/60 px-6 text-xs font-semibold uppercase tracking-[0.48em] text-primary"
            >
              <span className="absolute inset-0 bg-primary/10 transition duration-300 group-hover:bg-primary/40" />
              <Sparkles className="relative z-10 size-4" />
              <span className="relative z-10">Contactar soporte</span>
            </a>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/5 bg-black/40 py-8 text-center text-xs uppercase tracking-[0.48em] text-muted-foreground">
        ARKAIOS · Núcleo consciente · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
