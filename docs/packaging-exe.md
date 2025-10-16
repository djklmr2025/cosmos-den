Empaquetado a .exe y asistente opcional de ComfyUI

Objetivo

- Generar un ejecutable liviano de ARKAIOS para Windows y ofrecer ComfyUI como addon externo opcional (no incluido por defecto), evitando una app pesada.

Estrategia sugerida

- Usa Electron + Vite React para el empaquetado con `electron-builder`.
- ARKAIOS levanta su UI y backend Express; ComfyUI corre como proceso separado cuando el usuario lo tiene o decide instalarlo.
- Por defecto, los proveedores GPU remotos quedan visibles y se activan sólo si hay API keys en entorno.

Pasos de preparación

1) Añade electron:
   - `npm i -D electron electron-builder concurrently cross-env`
2) Crea scripts en `package.json`:
   - `"electron:dev": "cross-env VITE_DEV_SERVER=true concurrently \"vite\" \"electron .\""`
   - `"electron:build": "electron-builder"`
3) Crea `electron/main.ts` que:
   - Crea BrowserWindow cargando la URL del dev server o `index.html` empaquetado.
   - Arranca el servidor Express embebido (o lo usa si se ejecuta aparte).
4) Configura `electron-builder` en `package.json`:
   - `"build": { "appId": "com.arkaios.app", "win": { "target": ["nsis"], "artifactName": "ARKAIOS-${version}.exe" }, "files": ["dist/**", "server/**", "electron/**"], "extraResources": ["data/**"] }`

Asistente opcional de ComfyUI

- Al primer arranque:
  1) Detecta `COMFYUI_BASE_URL` o puerto local 8188.
  2) Si no está disponible, ofrece instalar ComfyUI (abrir guía y descarga) o conectar a una instancia existente.
  3) Si se instala, lanzar proceso en segundo plano minimizado, con chequeos de puerto y reintentos.

Variables de entorno útiles (Vite/Node)

- `COMFYUI_BASE_URL` → `http://127.0.0.1:8188` por defecto si se usa local.
- `LUMA_API_KEY`, `VITE_FAL_API_KEY`, `VITE_REPLICATE_API_TOKEN`, `VITE_HF_TOKEN` para proveedores remotos.

Notas

- No incluir PyTorch/ComfyUI dentro del .exe para mantenerlo liviano.
- Documenta que el usuario puede instalar ComfyUI por separado y point-and-click desde ARKAIOS.