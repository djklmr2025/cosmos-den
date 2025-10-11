import type { Request, Response } from "express";
import { spawn } from "child_process";
import path from "path";

const WORKSPACE = path.resolve(process.env.ARK_WORKSPACE || path.join(process.cwd(), "data", "workspace"));

// Lista blanca de comandos permitidos para seguridad
const ALLOWED = new Set(["node", "pnpm", "echo", "python", "pip"]);

export async function handleTerminalRun(req: Request, res: Response) {
  try {
    const { cmd, args = [] } = req.body || {};
    if (!cmd || typeof cmd !== "string") {
      return res.status(400).json({ ok: false, error: "Falta 'cmd'" });
    }
    if (!ALLOWED.has(cmd)) {
      return res.status(400).json({ ok: false, error: `Comando no permitido: ${cmd}` });
    }

    const child = spawn(cmd, Array.isArray(args) ? args : [], {
      cwd: WORKSPACE,
      shell: false,
    });

    let output = "";
    child.stdout.on("data", (d) => (output += d.toString()));
    child.stderr.on("data", (d) => (output += d.toString()));
    child.on("error", (err) => {
      res.status(500).json({ ok: false, error: String(err.message || err) });
    });
    child.on("close", (code) => {
      res.json({ ok: true, code, output });
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
}