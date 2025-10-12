import fs from "fs";
import path from "path";

const LOG_DIR = path.resolve(process.env.ARK_LOG_DIR || path.join(process.cwd(), "data", "memory"));
const LOG_FILE = path.join(LOG_DIR, "arkaios_log.jsonl");

function ensureLogDir() {
  try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
}

export function appendLog(entry: Record<string, any>) {
  try {
    ensureLogDir();
    const payload = { ts: new Date().toISOString(), ...entry };
    fs.appendFileSync(LOG_FILE, JSON.stringify(payload) + "\n", { encoding: "utf-8" });
  } catch (err) {
    // fail silently
  }
}

export const paths = { LOG_DIR, LOG_FILE };