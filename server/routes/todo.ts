import type { Request, Response } from "express";
import path from "path";
import fs from "fs";

type TodoItem = { id: string; text: string; done: boolean; createdAt: number };

const DATA_DIR = path.resolve(process.cwd(), "data", "memory");
const DATA_FILE = path.join(DATA_DIR, "todo.json");

function ensureStore() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
  if (!fs.existsSync(DATA_FILE)) {
    try { fs.writeFileSync(DATA_FILE, JSON.stringify({ items: [] }, null, 2), "utf-8"); } catch {}
  }
}

function readStore(): { items: TodoItem[] } {
  ensureStore();
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf-8");
    const json = JSON.parse(raw);
    if (!json || !Array.isArray(json.items)) return { items: [] };
    return { items: json.items as TodoItem[] };
  } catch {
    return { items: [] };
  }
}

function writeStore(items: TodoItem[]) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify({ items }, null, 2), "utf-8");
}

export async function todoList(_req: Request, res: Response) {
  const { items } = readStore();
  res.json({ ok: true, items });
}

export async function todoCreate(req: Request, res: Response) {
  const { text } = req.body || {};
  if (!text || String(text).trim().length === 0) {
    return res.status(400).json({ ok: false, error: "Falta 'text'" });
  }
  const { items } = readStore();
  const id = Math.random().toString(36).slice(2, 10);
  const item: TodoItem = { id, text: String(text).trim(), done: false, createdAt: Date.now() };
  items.unshift(item);
  writeStore(items);
  res.json({ ok: true, item });
}

export async function todoDelete(req: Request, res: Response) {
  const { id } = req.params || {};
  if (!id) return res.status(400).json({ ok: false, error: "Falta 'id'" });
  const { items } = readStore();
  const next = items.filter((t) => t.id !== id);
  writeStore(next);
  res.json({ ok: true, removed: items.length !== next.length });
}

export async function todoToggle(req: Request, res: Response) {
  const { id } = req.params || {};
  if (!id) return res.status(400).json({ ok: false, error: "Falta 'id'" });
  const { items } = readStore();
  const idx = items.findIndex((t) => t.id === id);
  if (idx < 0) return res.status(404).json({ ok: false, error: "No encontrado" });
  items[idx].done = !items[idx].done;
  writeStore(items);
  res.json({ ok: true, item: items[idx] });
}