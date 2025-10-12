import path from "path";
import fs from "fs";
import { spawn, ChildProcessWithoutNullStreams } from "child_process";

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
};

/**
 * MCPManager mantiene un proceso persistente del runtime MCP (server.mjs)
 * y ofrece un canal request-respuesta secuencial vía stdin/stdout.
 *
 * Nota: Asume que el runtime devuelve una línea JSON por comando.
 */
export class MCPManager {
  private scriptPath: string;
  private child: ChildProcessWithoutNullStreams | null = null;
  private buffer = "";
  private queue: PendingRequest[] = [];
  private starting = false;

  constructor(scriptPath?: string) {
    this.scriptPath = scriptPath || path.resolve(process.cwd(), "arkaios-lab-starter", "apps", "mcp", "server.mjs");
  }

  private ensureScript() {
    if (!fs.existsSync(this.scriptPath)) {
      throw new Error("MCP script no encontrado: arkaios-lab-starter/apps/mcp/server.mjs");
    }
  }

  private attachListeners() {
    if (!this.child) return;
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");

    this.child.stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      // Procesar por líneas
      let idx: number;
      while ((idx = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const data = JSON.parse(line);
          const pending = this.queue.shift();
          if (pending) pending.resolve(data);
          // Si no hay pending, descartamos o logueamos silenciosamente
        } catch {
          // Línea no JSON, ignorar (podría ser log)
        }
      }
    });

    this.child.stderr.on("data", (_chunk: string) => {
      // Podríamos reportar errores si hay pending
      // Para no reventar, ignoramos stderr a menos que cierre el proceso
    });

    this.child.on("error", (err) => {
      // Rechazar todas las pendientes
      while (this.queue.length) {
        const p = this.queue.shift()!;
        p.reject(err);
      }
      this.child = null;
    });

    this.child.on("close", () => {
      // Rechazar todas las pendientes y limpiar
      while (this.queue.length) {
        const p = this.queue.shift()!;
        p.reject(new Error("MCP runtime cerrado"));
      }
      this.child = null;
    });
  }

  async start() {
    if (this.child || this.starting) return;
    this.starting = true;
    this.ensureScript();
    this.child = spawn(process.execPath, [this.scriptPath], {
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    this.attachListeners();
    this.starting = false;
  }

  async send(command: string, params: any = {}): Promise<any> {
    await this.start();
    if (!this.child) throw new Error("MCP runtime no iniciado");
    // Serializamos mediante la cola
    return new Promise<any>((resolve, reject) => {
      this.queue.push({ resolve, reject });
      try {
        const msg = JSON.stringify({ command, params }) + "\n";
        this.child!.stdin.write(msg);
      } catch (e) {
        const p = this.queue.pop();
        if (p) p.reject(e);
      }
    });
  }

  async health() {
    return this.send("arkaios.health");
  }

  async chat(prompt: string) {
    return this.send("arkaios.chat", { prompt });
  }
}

// Exportamos un singleton por conveniencia
export const mcpManager = new MCPManager();