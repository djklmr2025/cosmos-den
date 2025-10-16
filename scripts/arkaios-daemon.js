// ARKAIOS Daemon: mantiene el servidor en ejecución y reinicia con backoff si cae
// Uso: node scripts/arkaios-daemon.js
// Opcional: ARK_DAEMON_CMD, ARK_DAEMON_ARGS, ARK_PORT

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CMD = process.env.ARK_DAEMON_CMD || 'pnpm';
const ARGS = (process.env.ARK_DAEMON_ARGS || 'dev').split(' ');
const PORT = process.env.ARK_PORT || 8082;
const LOG_DIR = path.resolve(process.cwd(), 'data', 'logs');
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
const LOG_FILE = path.join(LOG_DIR, 'daemon.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  try { fs.appendFileSync(LOG_FILE, line); } catch {}
  console.log(line.trim());
}

let child = null;
let backoffMs = 2000;
const backoffMax = 30000;

function start() {
  log(`Starting ARKAIOS server: ${CMD} ${ARGS.join(' ')}`);
  child = spawn(CMD, ARGS, { cwd: process.cwd(), windowsHide: true });

  child.stdout.on('data', (d) => log(`[server] ${d.toString().trim()}`));
  child.stderr.on('data', (d) => log(`[server] ${d.toString().trim()}`));
  child.on('error', (err) => {
    log(`[daemon] Child error: ${err.message}`);
  });
  child.on('close', (code) => {
    log(`[daemon] Server exited with code ${code}. Restarting in ${backoffMs}ms...`);
    child = null;
    setTimeout(() => {
      backoffMs = Math.min(backoffMs * 2, backoffMax);
      start();
    }, backoffMs);
  });
}

async function healthCheck() {
  const url = `http://127.0.0.1:${PORT}/health`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    log(`[health] ok: uptime=${data.uptimeSec}s pid=${data.pid}`);
  } catch (e) {
    log(`[health] failed: ${e.message}`);
    // Si el proceso está caído por alguna razón no detectada, relanzar
    if (!child) {
      log(`[daemon] No child process, restarting now...`);
      backoffMs = 2000;
      start();
    }
  }
}

process.on('SIGINT', () => {
  log('[daemon] SIGINT received, shutting down...');
  if (child) {
    try { child.kill(); } catch {}
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('[daemon] SIGTERM received, shutting down...');
  if (child) {
    try { child.kill(); } catch {}
  }
  process.exit(0);
});

start();
setInterval(healthCheck, 10000);