import type { Request, Response, Express } from "express";
import path from "path";
import fs from "fs";

const MEM_PATH = path.resolve(
  process.env.ARK_MEMORY_FILE || path.join(process.cwd(), "data", "memory.json")
);

function ensureMemFile() {
  try {
    fs.mkdirSync(path.dirname(MEM_PATH), { recursive: true });
  } catch {}
  if (!fs.existsSync(MEM_PATH)) {
    try { fs.writeFileSync(MEM_PATH, "{}", "utf-8"); } catch {}
  }
}

function readMem(): Record<string, any> {
  ensureMemFile();
  try {
    const t = fs.readFileSync(MEM_PATH, "utf-8");
    return JSON.parse(t || "{}");
  } catch {
    return {};
  }
}

function writeMem(obj: Record<string, any>) {
  try {
    fs.writeFileSync(MEM_PATH, JSON.stringify(obj, null, 2), "utf-8");
  } catch {}
}

function mask(val?: string | null) {
  if (!val || typeof val !== "string") return null;
  const n = val.length;
  if (n <= 4) return "***";
  return `${val.slice(0, 2)}***${val.slice(-2)}`;
}

export function registerMemoryRoutes(app: Express) {
  // Key info (status of special keys)
  app.get("/key-info", (_req: Request, res: Response) => {
    const mem = readMem();
    const api = mem["__api_key"] ?? null;
    const master = mem["__master_token"] ?? null;
    res.json({
      initialized: !!api,
      mask: mask(api),
      master_initialized: !!master,
      master_mask: mask(master),
      hint: "El API key se guarda en memory.json bajo '__api_key'",
    });
  });

  // List all keys
  app.get("/memory", (_req: Request, res: Response) => {
    const mem = readMem();
    res.json({ ok: true, keys: Object.keys(mem) });
  });

  // Read specific key
  app.get("/memory/:id", (req: Request, res: Response) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ ok: false, error: "Falta 'id'" });
    const mem = readMem();
    const value = mem[id] ?? null;
    res.json({ ok: true, id, value });
  });

  // Write key
  app.post("/memory", (req: Request, res: Response) => {
    const { id, value } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, error: "Falta 'id'" });
    const mem = readMem();
    mem[id] = value;
    writeMem(mem);
    res.json({ ok: true, id });
  });
}