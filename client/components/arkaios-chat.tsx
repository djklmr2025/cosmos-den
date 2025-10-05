import { FormEvent, useMemo, useRef, useState } from "react";
import { Loader2, Send, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  delegated?: boolean;
  error?: boolean;
}

const defaultGateway = "https://arkaios-gateway-open.onrender.com/aida/gateway";
const defaultKey = "KaOQ1ZQ4gyF5bkgxkiwPEFgkrUMW31ZEwVhOITkLRO5jaImetmUlYJegOdwG";

const gatewayUrl = (import.meta.env.VITE_ARKAIOS_GATEWAY as string | undefined) ?? defaultGateway;
const gatewayKey = (import.meta.env.VITE_ARKAIOS_KEY as string | undefined) ?? defaultKey;

const buildBody = (prompt: string) => ({
  agent_id: "puter",
  action: "plan",
  params: {
    objective: prompt,
  },
});

const prettyTimestamp = (value: number) =>
  new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);

export function ArkaiosChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "👋 Bienvenido. Describe tu objetivo y ARKAIOS decidirá si delega la tarea a la inteligencia del gateway.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const isGatewayConfigured = useMemo(() => Boolean(gatewayUrl && gatewayKey), []);

  const pushMessage = (message: Omit<ChatMessage, "id" | "timestamp"> & { timestamp?: number }) => {
    const next = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: message.timestamp ?? Date.now(),
    } satisfies ChatMessage;
    setMessages((prev) => [...prev, next]);
    queueMicrotask(() => {
      if (listRef.current) {
        listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }
    });
    return next;
  };

  const updateMessage = (id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((message) => (message.id === id ? { ...message, ...patch } : message)));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!input.trim() || isSubmitting) {
      return;
    }

    const prompt = input.trim();
    setInput("");
    setIsSubmitting(true);

    const userMessage = pushMessage({
      role: "user",
      content: prompt,
    });

    const waitingMessage = pushMessage({
      role: "assistant",
      content: "Analizando parámetros y verificando capacidad de delegación...",
    });

    if (!isGatewayConfigured) {
      updateMessage(waitingMessage.id, {
        content:
          "⚠️ Gateway no configurado. Define VITE_ARKAIOS_GATEWAY y VITE_ARKAIOS_KEY para habilitar la conexión real.",
        error: true,
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(gatewayKey ? { Authorization: `Bearer ${gatewayKey}` } : {}),
        },
        body: JSON.stringify(buildBody(prompt)),
      });

      if (!response.ok) {
        throw new Error(`Gateway HTTP ${response.status}`);
      }

      const data = await response.json();
      const delegation = data.output ?? data.result ?? data.response ?? JSON.stringify(data, null, 2);

      updateMessage(waitingMessage.id, {
        content: typeof delegation === "string" ? delegation : JSON.stringify(delegation, null, 2),
        delegated: true,
      });
    } catch (error) {
      console.error(error);
      updateMessage(waitingMessage.id, {
        content: `🚨 Error al contactar el gateway: ${(error as Error).message}`,
        error: true,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section
      id="interfaz"
      className="relative overflow-hidden rounded-[32px] border border-white/5 bg-black/40 p-8 shadow-neon backdrop-blur-xl"
    >
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -top-24 right-0 h-64 w-64 rounded-full bg-primary/25 blur-[120px]" />
        <div className="absolute -bottom-20 left-8 h-48 w-48 rounded-full bg-accent/25 blur-[120px]" />
      </div>
      <div className="relative z-10 flex flex-col gap-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.5em] text-muted-foreground">Interfaz consciente</p>
            <h2 className="font-display text-3xl text-foreground">Canal operativo «ARKAIOS»</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              La consola táctil conecta contra el Gateway A.I.D.A. para delegar tareas críticas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-3 animate-pulse rounded-full bg-primary" />
            <span className="text-xs uppercase tracking-[0.5em] text-primary">Link activo</span>
          </div>
        </header>

        <ul
          ref={listRef}
          className="h-[360px] space-y-4 overflow-y-auto rounded-[24px] border border-white/5 bg-black/50 p-6"
        >
          {messages.map((message) => (
            <li
              key={message.id}
              className={cn(
                "flex flex-col gap-2 rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-neon",
                message.role === "user"
                  ? "ml-auto max-w-[82%] border-primary/50 bg-primary/10 text-primary"
                  : "max-w-[82%] border-white/10 bg-white/5 text-foreground",
                message.error && "border-destructive/60 bg-destructive/10 text-destructive",
              )}
            >
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.5em] text-muted-foreground">
                <span>{message.role === "user" ? "Operador" : "ARKAIOS"}</span>
                <span>{prettyTimestamp(message.timestamp)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content.trim().length === 0 ? "…" : message.content}
              </p>
              {message.delegated ? (
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.4em] text-primary">
                  <Sparkles className="size-3" />
                  Delegación completada por Gateway
                </div>
              ) : null}
              {message.error ? (
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.4em] text-destructive">
                  <Zap className="size-3" />
                  Incidencia detectada
                </div>
              ) : null}
            </li>
          ))}
        </ul>

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <textarea
              className="min-h-[120px] w-full resize-none rounded-3xl border border-white/10 bg-black/40 px-6 py-4 text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              placeholder="Describe la tarea a delegar..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            {!isGatewayConfigured && (
              <span className="absolute inset-x-6 bottom-3 text-[11px] uppercase tracking-[0.4em] text-destructive">
                Configura las variables VITE_ARKAIOS_GATEWAY y VITE_ARKAIOS_KEY
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={isSubmitting || input.trim().length === 0}
            className="group relative flex h-14 items-center justify-center gap-2 overflow-hidden rounded-full border border-primary/60 px-6 font-display text-xs uppercase tracking-[0.6em] text-primary transition disabled:cursor-not-allowed disabled:border-muted/40 disabled:text-muted-foreground"
          >
            <span className="absolute inset-0 bg-primary/20 transition duration-300 group-hover:bg-primary/35" />
            {isSubmitting ? (
              <Loader2 className="relative z-10 size-4 animate-spin" />
            ) : (
              <Send className="relative z-10 size-4" />
            )}
            <span className="relative z-10">Transmitir</span>
          </button>
        </form>
      </div>
    </section>
  );
}
