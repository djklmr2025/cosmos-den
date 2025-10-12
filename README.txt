# Codex CLI Starter Pack – ARKAIOS (cosmos-den)

**Proyecto raíz:** `C:\Users\djklm\Desktop\ARKAIOS\cosmos-den`

## Contenido
- `codex.json` — Metadatos para orientar a Codex CLI (root, scripts, puertos permitidos).
- `scripts/start_arkaios_dev.ps1` — Mata procesos sueltos y lanza `pnpm dev` en `127.0.0.1:8081`.
- `scripts/stop_arkaios_dev.ps1` — Cierra Vite/Node (incluye kill por puerto 8081).
- `scripts/lock_node_firewall.ps1` — (Opcional) Crea reglas de firewall para que `node.exe` solo use loopback:8081.
- `scripts/unlock_node_firewall.ps1` — Elimina las reglas anteriores.

## Uso rápido
1. Copia el contenido del ZIP dentro de la carpeta del proyecto.
2. Abre PowerShell como Administrador.
3. Ejecuta:
   .\scripts\start_arkaios_dev.ps1
   - Agrega `-NewWindow` si quieres abrir otro PowerShell con el dev server.
4. Para parar:
   .\scripts\stop_arkaios_dev.ps1

### Firewall (opcional)
Bloquear todo de `node.exe` excepto `127.0.0.1:8081` (ajusta NodePath si usas NVM u otra ruta):
.\scripts\lock_node_firewall.ps1 -Port 8081 -NodePath C:\Program Files
odejs
ode.exe
Revertir:
.\scripts\unlock_node_firewall.ps1 -Port 8081

> Este pack no modifica `vite.config.ts` automáticamente; solo recuerda la configuración recomendada:
> `server: { host: '127.0.0.1', port: 8081, strictPort: true, open: false }`
