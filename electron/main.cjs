// electron/main.cjs
const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let isDev = false;
try {
  // intenta usar el paquete si existe
  isDev = require("electron-is-dev");
} catch {
  isDev = false;
}

let mainWindow;
let serverProcess;

const DEV_FRONT_URL = process.env.DEV_SERVER_URL || "http://localhost:8080"; // Vite dev
const PROD_PORT = process.env.ELECTRON_PORT || "18080";
const PROD_ORIGIN = `http://127.0.0.1:${PROD_PORT}`;

/**
 * Espera hasta que el endpoint de health responda antes de cargar la UI
 */
async function waitFor(url, tries = 50, delay = 300) {
  const fetchFn = globalThis.fetch || (await import("node-fetch")).default;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetchFn(url);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, delay));
  }
  return false;
}

/**
 * Crea la ventana principal
 */
async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    show: false,
    backgroundColor: "#0b141a",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    // ======= DESARROLLO =======
    await mainWindow.loadURL(DEV_FRONT_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    mainWindow.show();
  } else {
    // ======= PRODUCCIÓN =======
    const serverEntry = path.join(process.cwd(), "dist", "server", "node-build.mjs");
    const frontIndex = path.join(process.cwd(), "client", "dist", "index.html");

    try {
      // Intenta levantar el backend de producción que sirve también el front
      serverProcess = spawn(process.execPath, [serverEntry], {
        cwd: process.cwd(),
        stdio: "inherit",
        env: {
          ...process.env,
          PORT: PROD_PORT,
          SERVE_STATIC: "true",
        },
      });

      await waitFor(`${PROD_ORIGIN}/health`);
      await mainWindow.loadURL(PROD_ORIGIN);
      mainWindow.show();
    } catch (err) {
      // Fallback: cargar directamente el build del front si el backend no existe
      await mainWindow.loadFile(frontIndex);
      mainWindow.show();
    }
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/**
 * Manejadores del ciclo de vida de Electron
 */
app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (serverProcess) {
    try { serverProcess.kill(); } catch {}
  }
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    try { serverProcess.kill(); } catch {}
  }
});

app.on("activate", () => {
  if (!mainWindow) createWindow();
});
