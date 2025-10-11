import type { Request, Response } from "express";
import path from "path";
import fs from "fs";

// Workspace raíz seguro (por defecto: data/workspace)
const WORKSPACE = path.resolve(process.env.ARK_WORKSPACE || path.join(process.cwd(), "data", "workspace"));
// Asegurar que el workspace existe
try { fs.mkdirSync(WORKSPACE, { recursive: true }); } catch {}

function resolveSafe(targetPath: string) {
  const p = path.resolve(WORKSPACE, targetPath || ".");
  if (!p.startsWith(WORKSPACE)) {
    throw new Error("Ruta fuera del workspace");
  }
  return p;
}

export async function fsList(req: Request, res: Response) {
  try {
    const { path: rel = "." } = req.body || {};
    const abs = resolveSafe(rel);
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    const list = entries.map((e) => ({
      name: e.name,
      path: path.join(rel, e.name).replace(/\\/g, "/"),
      type: e.isDirectory() ? "dir" : "file",
    }));
    res.json({ ok: true, items: list });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
}

export async function fsRead(req: Request, res: Response) {
  try {
    const { path: rel } = req.body || {};
    if (!rel) return res.status(400).json({ ok: false, error: "Falta 'path'" });
    const abs = resolveSafe(rel);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) return res.status(400).json({ ok: false, error: "No es un archivo" });
    const content = fs.readFileSync(abs, "utf-8");
    res.json({ ok: true, path: rel, content });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
}

export async function fsWrite(req: Request, res: Response) {
  try {
    const { path: rel, content = "" } = req.body || {};
    if (!rel) return res.status(400).json({ ok: false, error: "Falta 'path'" });
    const abs = resolveSafe(rel);
    const dir = path.dirname(abs);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(abs, content, "utf-8");
    res.json({ ok: true, path: rel });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
}

export async function fsMkdir(req: Request, res: Response) {
  try {
    const { path: rel } = req.body || {};
    if (!rel) return res.status(400).json({ ok: false, error: "Falta 'path'" });
    const abs = resolveSafe(rel);
    fs.mkdirSync(abs, { recursive: true });
    res.json({ ok: true, path: rel });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
}

export async function fsUpload(req: Request, res: Response) {
  try {
    const { path: relDir = ".", filename, contentBase64 } = req.body || {};
    if (!filename) return res.status(400).json({ ok: false, error: "Falta 'filename'" });
    if (!contentBase64) return res.status(400).json({ ok: false, error: "Falta 'contentBase64'" });
    const dirAbs = resolveSafe(relDir);
    fs.mkdirSync(dirAbs, { recursive: true });
    const abs = path.resolve(dirAbs, filename);
    if (!abs.startsWith(WORKSPACE)) {
      return res.status(400).json({ ok: false, error: "Ruta fuera del workspace" });
    }
    const buffer = Buffer.from(contentBase64, "base64");
    fs.writeFileSync(abs, buffer);
    res.json({ ok: true, path: path.join(relDir, filename).replace(/\\/g, "/") });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
}

// Vaciar el workspace (elimina todo su contenido)
export async function fsClear(req: Request, res: Response) {
  try {
    const { confirm = false } = req.body || {};
    if (!confirm) return res.status(400).json({ ok: false, error: "Se requiere confirmación" });
    const entries = fs.readdirSync(WORKSPACE, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.resolve(WORKSPACE, e.name);
      // Seguridad: no salir del workspace
      if (!abs.startsWith(WORKSPACE)) continue;
      fs.rmSync(abs, { recursive: true, force: true });
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
}

// Eliminar un archivo o carpeta dentro del workspace (recursivo)
export async function fsDelete(req: Request, res: Response) {
  try {
    const { path: rel } = req.body || {};
    if (!rel) return res.status(400).json({ ok: false, error: "Falta 'path'" });
    const abs = resolveSafe(rel);
    if (!fs.existsSync(abs)) {
      return res.json({ ok: true, removed: false });
    }
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      fs.rmSync(abs, { recursive: true, force: true });
    } else {
      fs.rmSync(abs, { force: true });
    }
    res.json({ ok: true, removed: true, path: rel });
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message });
  }
}