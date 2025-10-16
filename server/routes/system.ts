import type { Request, Response } from "express";
import { exec, spawn, ChildProcess } from "child_process";

function isValidPort(port: number) {
  return Number.isInteger(port) && port > 0 && port < 65536;
}

function execCmd(cmd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { windowsHide: true }, (error, stdout, stderr) => {
      if (error) return reject(error);
      resolve({ stdout, stderr });
    });
  });
}

async function getListeningPIDsWindows(port: number): Promise<number[]> {
  // Find processes listening on :port
  const { stdout } = await execCmd(`netstat -ano | findstr LISTENING | findstr :${port}`);
  const lines = stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const pids = new Set<number>();
  for (const line of lines) {
    // Example line: TCP    0.0.0.0:8000      0.0.0.0:0      LISTENING       1234
    const parts = line.split(/\s+/).filter(Boolean);
    const pidStr = parts[parts.length - 1];
    const pid = Number(pidStr);
    if (Number.isFinite(pid)) pids.add(pid);
  }
  return Array.from(pids);
}

export async function handlePortStatus(req: Request, res: Response) {
  try {
    const raw = (req.query.port as string) || (req.body?.port as string) || "";
    const port = Number(raw);
    if (!isValidPort(port)) {
      return res.status(400).json({ ok: false, error: "Puerto inválido" });
    }
    if (process.platform !== "win32") {
      return res.status(400).json({ ok: false, error: "Sólo soportado en Windows" });
    }
    const pids = await getListeningPIDsWindows(port);
    return res.json({ ok: true, port, listening: pids.length > 0, pids });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

export async function handleFreePort(req: Request, res: Response) {
  try {
    const raw = (req.query.port as string) || (req.body?.port as string) || "";
    const port = Number(raw);
    if (!isValidPort(port)) {
      return res.status(400).json({ ok: false, error: "Puerto inválido" });
    }
    if (process.platform !== "win32") {
      return res.status(400).json({ ok: false, error: "Sólo soportado en Windows" });
    }
    const pids = await getListeningPIDsWindows(port);
    if (pids.length === 0) {
      return res.json({ ok: true, port, message: "Sin procesos escuchando", killed: [], errors: [] });
    }

    const killed: number[] = [];
    const errors: Array<{ pid: number; error: string }> = [];
    for (const pid of pids) {
      try {
        await execCmd(`taskkill /F /PID ${pid}`);
        killed.push(pid);
      } catch (e: any) {
        errors.push({ pid, error: String(e?.message || e) });
      }
    }

    return res.json({ ok: true, port, killed, errors });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

// --- ComfyUI process management (Windows) ---
const comfyProcs: Map<number, ChildProcess> = new Map();

function getEnv(key: string, def?: string) {
  const v = process.env[key];
  return (v && v.trim().length > 0) ? v.trim() : (def ?? "");
}

async function ensurePortFreed(port: number) {
  const pids = await getListeningPIDsWindows(port);
  for (const pid of pids) {
    try { await execCmd(`taskkill /F /PID ${pid}`); } catch {}
  }
  // Slight delay to let OS release the socket
  await new Promise((r) => setTimeout(r, 600));
}

export async function handleComfyStart(req: Request, res: Response) {
  try {
    if (process.platform !== "win32") {
      return res.status(400).json({ ok: false, error: "Sólo soportado en Windows" });
    }
    const raw = (req.query.port as string) || (req.body?.port as string) || "";
    const port = Number(raw) || 9000;
    if (!isValidPort(port)) {
      return res.status(400).json({ ok: false, error: "Puerto inválido" });
    }

    // If already spawned for this port, report status
    const existing = comfyProcs.get(port);
    if (existing && existing.pid) {
      return res.json({ ok: true, message: "ComfyUI ya iniciado", pid: existing.pid, port });
    }

    await ensurePortFreed(port);

    const python = getEnv("COMFYUI_PYTHON", "python");
    const root = getEnv("COMFYUI_ROOT");
    const script = getEnv("COMFYUI_SCRIPT", "main.py");
    const extra = getEnv("COMFYUI_ARGS", "--listen 127.0.0.1");

    if (!root) {
      return res.status(400).json({ ok: false, error: "Falta COMFYUI_ROOT en .env (ruta a ComfyUI)" });
    }

    const args = [script, "--port", String(port), ...extra.split(" ").filter(Boolean)];
    const child = spawn(python, args, { cwd: root, windowsHide: true, stdio: "pipe" });
    comfyProcs.set(port, child);

    child.once("exit", () => {
      comfyProcs.delete(port);
    });

    let bootLog = "";
    child.stdout?.on("data", (d) => { bootLog += d.toString(); });
    child.stderr?.on("data", (d) => { bootLog += d.toString(); });

    // Return immediately; client can poll status/test
    return res.json({ ok: true, pid: child.pid, port, args, cwd: root });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

export async function handleComfyStatus(req: Request, res: Response) {
  try {
    const port = Number((req.query.port as string) || (req.body?.port as string) || 9000);
    const child = comfyProcs.get(port);
    const running = !!(child && !child.killed);
    res.json({ ok: true, port, running, pid: child?.pid || null });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}

export async function handleComfyStop(req: Request, res: Response) {
  try {
    const port = Number((req.query.port as string) || (req.body?.port as string) || 9000);
    const child = comfyProcs.get(port);
    if (!child) return res.json({ ok: true, message: "No hay proceso activo", port });
    try {
      child.kill("SIGTERM");
    } catch {}
    comfyProcs.delete(port);
    res.json({ ok: true, port, stopped: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}