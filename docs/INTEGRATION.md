# Integración ARKAIOS · cosmos-den ↔ MCP ↔ Gateway

Este documento describe cómo se comunican los demonios entre los tres repos (cosmos-den, arkaios-lab-starter, builderOS_Lab) y cómo validar la salud del sistema sin tocar despliegues en producción.

## Topología (lineal)
- cosmos-den (frontend/orquestador)
  - Dev/API: `http://localhost:8082` (variable `ARK_PORT`)
  - Orquestación: llama al MCP HTTP o directamente al Gateway
- MCP Wrapper (arkaios-lab-starter)
  - HTTP daemon opcional: `http://localhost:8090/mcp` (variable `MCP_HTTP_PORT`)
  - Endpoints: `GET /mcp/health`, `POST /mcp/run`
- BuilderOS Lab (Gateway)
  - Gateway: `https://arkaios-gateway-open.onrender.com/aida/gateway` (`AIDA_GATEWAY_URL`)
  - Health: `https://arkaios-gateway-open.onrender.com/aida/health`
  - Índice del Lab: `https://djklmr2025.github.io/builderOS_Lab/index.json`

Flujo recomendado:
```
cosmos-den → MCP HTTP (arkaios-lab-starter) → A.I.D.A. Gateway (builderOS_Lab)
                ↘︎ fallback directo → Gateway si MCP no está disponible
```

## Variables de entorno
- `AIDA_GATEWAY_URL` = `https://arkaios-gateway-open.onrender.com/aida/gateway`
- `AIDA_AUTH_TOKEN` = `<TOKEN>` (vacío en OPEN; `Bearer <TOKEN>` para SECURE)
- `MCP_HTTP_PORT` = `8090` (wrapper HTTP local)
- `MCP_HTTP_URL` = `http://localhost:8090` (opcional para definir URL completa)
- `ARK_PORT` = `8082` (backend de cosmos-den)
- `LOCAL_BASE` = backend local del lab (p.ej. `http://localhost:8080`)

Notas:
- El wrapper HTTP añade `Bearer` si el token ya lo incluye; evita duplicarlo.
- Para producción 24/7, sustituye `localhost` por hosts de Render/Vercel si corresponde.

## Arranque de daemons
- MCP HTTP (wrapper):
  - Dev: `npm run mcp:http`
  - PM2 (Windows): `pm2 start ecosystem.config.cjs --only mcp-http --update-env && pm2 save`
- cosmos-den:
  - Dev: `pnpm dev`
  - Producción: `node scripts/arkaios-daemon.js`
- Gateway (builderOS_Lab): ya activo en Render (`/aida/health`)

## Pruebas rápidas
- Gateway health: `curl -s https://arkaios-gateway-open.onrender.com/aida/health`
- Plan (Gateway): `curl -s -X POST https://arkaios-gateway-open.onrender.com/aida/gateway -H "Content-Type: application/json" -d '{"agent_id":"claude","action":"plan","params":{"objective":"mapear BuilderOS"}}'`
- Read (Gateway): `curl -s -X POST https://arkaios-gateway-open.onrender.com/aida/gateway -H "Content-Type: application/json" -d '{"agent_id":"claude","action":"read","params":{"target":"https://djklmr2025.github.io/builderOS_Lab/index.json"}}'`
- MCP health: `curl -s http://localhost:8090/mcp/health`
- cosmos-den health: `curl -s http://localhost:8082/health`

## UI de prueba
- `safe_puter.html` (BuilderOS Lab)
  - Local: `http://localhost:8000/safe_puter.html`
  - Pages: `https://djklmr2025.github.io/builderOS_Lab/safe_puter.html?gw=https%3A%2F%2Farkaios-gateway-open.onrender.com%2Faida%2Fgateway`
  - Token: `...&token=TU_TOKEN`

## Operación segura
- No cambiar código en producción sin aprobación; priorizar ajustes de entorno.
- Documentar hostnames/puertos para evitar confusión entre local y cloud.
- Usar `pm2 save` tras cambios de env y `--update-env` en reinicios.