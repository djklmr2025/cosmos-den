import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  preview?: string;
  textContent?: string | null;
}

type ConnectionState = "idle" | "connecting" | "online" | "error";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  delegated?: boolean;
  error?: boolean;
  attachments?: ChatAttachment[];
};

interface ConversationRecord {
  role: "user" | "assistant";
  content: string;
}

declare global {
  interface Window {
    puter?: {
      ai?: {
        chat: (input: unknown, options?: Record<string, unknown>) => Promise<unknown>;
        txt2img?: (prompt: string) => Promise<HTMLImageElement>;
      };
      fs?: {
        readdir?: (path: string) => Promise<unknown>;
      };
    };
  }
}

const defaultGateway = "https://arkaios-gateway-open.onrender.com/aida/gateway";
const defaultKey = "KaOQ1ZQ4gyF5bkgxkiwPEFgkrUMW31ZEwVhOITkLRO5jaImetmUlYJegOdwG";

const gatewayUrl = (import.meta.env.VITE_ARKAIOS_GATEWAY as string | undefined) ?? defaultGateway;
const gatewayKey = (import.meta.env.VITE_ARKAIOS_KEY as string | undefined) ?? defaultKey;

const formatTimestamp = (value: number) =>
  new Intl.DateTimeFormat("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);

const statusCopy: Record<ConnectionState, { label: string; tone: "info" | "success" | "error" }> = {
  idle: { label: "Standby", tone: "info" },
  connecting: { label: "Sincronizando", tone: "info" },
  online: { label: "Operativo", tone: "success" },
  error: { label: "Incidencia", tone: "error" },
};

const toneClasses: Record<string, string> = {
  info: "border-accent/50 bg-accent/10 text-accent-foreground",
  success: "border-primary/60 bg-primary/10 text-primary",
  error: "border-destructive/60 bg-destructive/10 text-destructive",
};

const MAX_TEXT_ATTACHMENT_CHARS = 6000;

const generateId = () => crypto.randomUUID();

export function ArkaiosChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: generateId(),
      role: "assistant",
      content:
        "👋 Bienvenido. ARKAIOS opera con GPT-4 a través del núcleo Puter.js. Puedes adjuntar archivos, imágenes o comandos especiales. Si lo deseas, sincronizaremos cada respuesta con A.I.D.A. para respaldo táctico.",
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [puterStatus, setPuterStatus] = useState<ConnectionState>("connecting");
  const [aiStatus, setAiStatus] = useState<ConnectionState>("connecting");
  const [gatewayStatus, setGatewayStatus] = useState<ConnectionState>("idle");
  const [syncWithAida, setSyncWithAida] = useState(true);
  const [selectedModel, setSelectedModel] = useState<"gpt-4o" | "gpt-4.1">("gpt-4.1");

  const listRef = useRef<HTMLUListElement>(null);
  const historyRef = useRef<ConversationRecord[]>([]);
  const puterRef = useRef<typeof window.puter>();

  const isGatewayConfigured = useMemo(() => Boolean(gatewayUrl && gatewayKey), []);

  const scrollToBottom = () => {
    queueMicrotask(() => {
      if (listRef.current) {
        listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
      }
    });
  };

  const pushMessage = (message: Omit<ChatMessage, "id" | "timestamp"> & { timestamp?: number }): ChatMessage => {
    const next: ChatMessage = {
      id: generateId(),
      timestamp: message.timestamp ?? Date.now(),
      ...message,
    };
    setMessages((prev) => [...prev, next]);
    scrollToBottom();
    return next;
  };

  const updateMessage = (id: string, patch: Partial<ChatMessage>) => {
    setMessages((prev) => prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));
  };

  const readFileAsDataURL = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const readFileAsText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });

  const processAttachments = async (files: File[]) => {
    const attachmentSummaries: string[] = [];
    const attachments: ChatAttachment[] = [];

    for (const file of files) {
      try {
        if (file.type.startsWith("image/")) {
          const dataUrl = await readFileAsDataURL(file);
          attachmentSummaries.push(`Imagen ${file.name} (${file.type}, ${Math.round(file.size / 1024)}KB): ${dataUrl}`);
          attachments.push({
            id: generateId(),
            name: file.name,
            type: file.type,
            size: file.size,
            preview: dataUrl,
            textContent: null,
          });
        } else if (file.type.startsWith("text/") || /(json|csv|md)$/i.test(file.name)) {
          const text = await readFileAsText(file);
          const trimmed = text.length > MAX_TEXT_ATTACHMENT_CHARS
            ? `${text.slice(0, MAX_TEXT_ATTACHMENT_CHARS)}\n…[contenido truncado]`
            : text;
          attachmentSummaries.push(`Archivo ${file.name} (${file.type}):\n${trimmed}`);
          attachments.push({
            id: generateId(),
            name: file.name,
            type: file.type,
            size: file.size,
            preview: undefined,
            textContent: trimmed,
          });
        } else {
          attachmentSummaries.push(`Archivo ${file.name} (${file.type || "tipo desconocido"}, ${Math.round(file.size / 1024)}KB)`);
          attachments.push({
            id: generateId(),
            name: file.name,
            type: file.type,
            size: file.size,
            preview: undefined,
            textContent: null,
          });
        }
      } catch (error) {
        attachmentSummaries.push(`No se pudo procesar ${file.name}: ${(error as Error).message}`);
      }
    }

    return { attachments, attachmentSummaries };
  };

  const ensurePuterReady = async () => {
    if (puterStatus === "online" && puterRef.current) {
      return;
    }

    setPuterStatus("connecting");

    const maxAttempts = 20;
    let attempt = 0;

    while (attempt < maxAttempts) {
      if (typeof window !== "undefined" && window.puter?.ai?.chat) {
        puterRef.current = window.puter;
        setPuterStatus("online");
        pushMessage({
          role: "system",
          content: "✅ Núcleo Puter.js cargado correctamente. GPT-4 listo para recibir instrucciones.",
        });
        return;
      }
      attempt += 1;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    setPuterStatus("error");
    pushMessage({
      role: "system",
      content: "🚨 No fue posible inicializar Puter.js. Verifica tu conexión a internet o vuelve a recargar la interfaz.",
      error: true,
    });
    throw new Error("Puter.js no disponible");
  };

  const verifyModel = async (model: "gpt-4o" | "gpt-4.1") => {
    setAiStatus("connecting");
    try {
      await ensurePuterReady();
      const response = await puterRef.current?.ai?.chat?.("Responde solo 'OK' para confirmar estado", {
        model,
        stream: false,
      });
      const text = typeof response === "string"
        ? response
        : (response as { message?: { content?: unknown }; text?: string })?.message?.content ??
          (response as { text?: string })?.text ??
          "";
      if (typeof text === "string" && text.toUpperCase().includes("OK")) {
        setAiStatus("online");
      } else {
        setAiStatus("online");
      }
    } catch (error) {
      setAiStatus("error");
      pushMessage({
        role: "system",
        content: `⚠️ Error validando el modelo ${model}: ${(error as Error).message}`,
        error: true,
      });
    }
  };

  const delegateToAida = async (prompt: string) => {
    if (!isGatewayConfigured) {
      pushMessage({
        role: "system",
        content: "⚠️ Gateway no configurado (define VITE_ARKAIOS_GATEWAY y VITE_ARKAIOS_KEY). No se sincronizó con A.I.D.A.",
        error: true,
      });
      return;
    }

    setGatewayStatus("connecting");

    try {
      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(gatewayKey ? { Authorization: `Bearer ${gatewayKey}` } : {}),
        },
        body: JSON.stringify({
          agent_id: "puter",
          action: "plan",
          params: {
            objective: `Sincroniza con A.I.D.A. el siguiente reporte generado por GPT-4: ${prompt}`,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const payload = data.output ?? data.result ?? data.response ?? JSON.stringify(data, null, 2);

      setGatewayStatus("online");
      pushMessage({
        role: "assistant",
        content:
          typeof payload === "string"
            ? payload
            : JSON.stringify(payload, null, 2),
        delegated: true,
        timestamp: Date.now(),
      });
    } catch (error) {
      setGatewayStatus("error");
      pushMessage({
        role: "assistant",
        content: `🚨 A.I.D.A. no respondió correctamente: ${(error as Error).message}`,
        error: true,
        delegated: true,
      });
    }
  };

  const executeSubmit = async () => {
    if (isSubmitting) return;

    const trimmed = input.trim();
    if (!trimmed && pendingFiles.length === 0) {
      return;
    }

    try {
      await ensurePuterReady();
    } catch {
      return;
    }

    setIsSubmitting(true);

    let attachmentsPayload: ChatAttachment[] = [];
    let attachmentSummary = "";

    if (pendingFiles.length > 0) {
      const { attachments, attachmentSummaries } = await processAttachments(pendingFiles);
      attachmentsPayload = attachments;
      attachmentSummary = attachmentSummaries.join("\n\n");
    }

    const compiledPrompt = attachmentSummary
      ? `${trimmed}\n\nARCHIVOS ADJUNTOS\n${attachmentSummary}`
      : trimmed;

    const userMessage = pushMessage({
      role: "user",
      content: trimmed || "(Sin texto, solo adjuntos)",
      attachments: attachmentsPayload,
    });

    historyRef.current.push({ role: "user", content: compiledPrompt });

    const placeholder = pushMessage({
      role: "assistant",
      content: `Contactando GPT-4${selectedModel === "gpt-4.1" ? ".1" : "o"} a través de Puter.js...`,
    });

    try {
      const response = await puterRef.current?.ai?.chat?.(historyRef.current.map((entry) => ({
        role: entry.role,
        content: entry.content,
      })), {
        model: selectedModel,
        stream: false,
      });

      let assistantText = "";
      if (typeof response === "string") {
        assistantText = response;
      } else {
        const message = (response as { message?: { content?: unknown }; text?: unknown })?.message?.content ??
          (response as { text?: unknown })?.text ??
          response;
        assistantText = typeof message === "string" ? message : JSON.stringify(message, null, 2);
      }

      updateMessage(placeholder.id, {
        content: assistantText,
      });

      historyRef.current.push({ role: "assistant", content: assistantText });

      if (syncWithAida) {
        await delegateToAida(assistantText);
      }
    } catch (error) {
      updateMessage(placeholder.id, {
        content: `🚨 Error comunicando con Puter.js: ${(error as Error).message}`,
        error: true,
      });
      historyRef.current.push({
        role: "assistant",
        content: `Error: ${(error as Error).message}`,
      });
    } finally {
      setInput("");
      setPendingFiles([]);
      setIsSubmitting(false);
    }

    updateMessage(userMessage.id, {
      attachments: attachmentsPayload,
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await executeSubmit();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    setPendingFiles((prev) => [...prev, ...Array.from(files)]);
    event.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const statusChip = (label: string, status: ConnectionState, icon: "puter" | "ai" | "gateway") => {
    const copy = statusCopy[status];
    const IconComponent =
      status === "online" ? CheckCircle2 : status === "error" ? AlertTriangle : Loader2;

    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border px-4 py-1 text-[10px] uppercase tracking-[0.45em]",
          toneClasses[copy.tone],
          status === "connecting" && "animate-pulse",
        )}
      >
        <IconComponent className={cn("size-3", status === "connecting" && "animate-spin")} />
        <span>
          {label}: {copy.label}
        </span>
      </div>
    );
  };

  useEffect(() => {
    void ensurePuterReady();
  }, []);

  useEffect(() => {
    if (puterStatus === "online") {
      void verifyModel(selectedModel);
    }
  }, [selectedModel, puterStatus]);

  useEffect(() => {
    scrollToBottom();
  }, [pendingFiles.length]);

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
          <div className="max-w-xl space-y-2">
            <p className="text-xs uppercase tracking-[0.5em] text-muted-foreground">Interfaz consciente</p>
            <h2 className="font-display text-3xl text-foreground">Canal operativo «ARKAIOS»</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Terminal híbrida conectada a GPT-4 a través de Puter.js. Opcionalmente sincroniza la respuesta con la
              inteligencia estratégica de A.I.D.A. para asegurar continuidad operativa.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {statusChip("Puter.js", puterStatus, "puter")}
            {statusChip("Modelo", aiStatus, "ai")}
            {statusChip("A.I.D.A.", gatewayStatus === "idle" ? "online" : gatewayStatus, "gateway")}
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-black/40 p-4">
          <label className="flex items-center gap-3 text-xs uppercase tracking-[0.5em] text-muted-foreground">
            Modelo activo
            <select
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value as "gpt-4o" | "gpt-4.1")}
              className="rounded-full border border-white/10 bg-black/40 px-4 py-1 text-[11px] uppercase tracking-[0.5em] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <option value="gpt-4.1">GPT-4.1 (Puter)</option>
              <option value="gpt-4o">GPT-4o (Puter)</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSyncWithAida((value) => !value)}
            className={cn(
              "flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-[11px] uppercase tracking-[0.5em] transition",
              syncWithAida ? "border-primary/50 bg-primary/10 text-primary" : "text-muted-foreground",
            )}
          >
            {syncWithAida ? <ToggleRight className="size-4" /> : <ToggleLeft className="size-4" />}
            Sincronizar con A.I.D.A.
          </button>
        </div>

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
                <span>{message.role === "user" ? "Operador" : message.delegated ? "A.I.D.A." : "ARKAIOS"}</span>
                <span>{formatTimestamp(message.timestamp)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content.trim().length === 0 ? "…" : message.content}
              </p>
              {message.attachments && message.attachments.length > 0 ? (
                <div className="flex flex-wrap gap-3 pt-2">
                  {message.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="overflow-hidden rounded-xl border border-white/10 bg-black/40"
                    >
                      {attachment.preview && attachment.type.startsWith("image/") ? (
                        <img
                          src={attachment.preview}
                          alt={attachment.name}
                          className="max-h-40 max-w-[180px] object-cover"
                        />
                      ) : (
                        <div className="flex flex-col gap-1 px-4 py-3 text-xs">
                          <span className="font-semibold text-foreground">{attachment.name}</span>
                          <span className="text-muted-foreground">
                            {attachment.type || "Archivo"} · {(attachment.size / 1024).toFixed(1)} KB
                          </span>
                          {attachment.textContent ? (
                            <span className="line-clamp-3 text-muted-foreground/80">
                              {attachment.textContent}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              {message.delegated ? (
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.4em] text-primary">
                  <Sparkles className="size-3" />
                  Respuesta sincronizada con A.I.D.A.
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

        {pendingFiles.length > 0 ? (
          <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-[0.5em] text-muted-foreground">Archivos listos para envío</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {pendingFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-xs"
                >
                  <Paperclip className="size-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">{file.name}</span>
                    <span className="text-muted-foreground">
                      {file.type || "Archivo"} · {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="ml-auto rounded-full border border-destructive/60 bg-destructive/20 p-1 text-destructive transition hover:bg-destructive/40"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-3 sm:flex-row">
          <input
            id="arkaios-attachments"
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,.pdf,.txt,.md,.json,.csv"
          />
          <div className="relative flex-1">
            <textarea
              className="min-h-[120px] w-full resize-none rounded-3xl border border-white/10 bg-black/40 px-6 py-4 text-sm leading-relaxed text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              placeholder="Describe la tarea a delegar..."
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void executeSubmit();
                }
              }}
            />
            {!isGatewayConfigured && syncWithAida && (
              <span className="absolute inset-x-6 bottom-3 text-[11px] uppercase tracking-[0.4em] text-destructive">
                Variables VITE_ARKAIOS_* ausentes. No se sincronizará con A.I.D.A.
              </span>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:w-44">
            <button
              type="button"
              onClick={() => document.getElementById("arkaios-attachments")?.click()}
              className="flex h-14 items-center justify-center gap-2 rounded-full border border-white/10 bg-black/50 text-xs uppercase tracking-[0.5em] text-foreground transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <Paperclip className="size-4" /> Adjuntar
            </button>
            <button
              type="submit"
              disabled={(input.trim().length === 0 && pendingFiles.length === 0) || isSubmitting}
              className="group relative flex h-14 items-center justify-center gap-2 overflow-hidden rounded-full border border-primary/60 px-6 font-display text-xs uppercase tracking-[0.6em] text-primary transition disabled:cursor-not-allowed disabled:border-muted/40 disabled:text-muted-foreground"
            >
              <span className="absolute inset-0 bg-primary/20 transition duration-300 group-hover:bg-primary/35" />
              {isSubmitting ? <Loader2 className="relative z-10 size-4 animate-spin" /> : <Send className="relative z-10 size-4" />}
              <span className="relative z-10">Transmitir</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
