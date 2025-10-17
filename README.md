# 馃寣 cosmos-den

**Plataforma de IA aut贸noma con capacidades avanzadas de generaci贸n de contenido, ejecuci贸n de c贸digo y integraci贸n MCP**

<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/djklmr2025/cosmos-den?style=for-the-badge&color=yellow)](https://github.com/djklmr2025/cosmos-den/stargazers)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2025.1-blue?style=for-the-badge)](releases)

**[馃殌 Demo en Vivo](https://cosmos-den.vercel.app/)** | **[馃洜锔?Builder Demo](https://arkaios-builder.base44.app/)**

</div>

---

## 馃搵 Tabla de Contenidos

- [驴Qu茅 es cosmos-den?](#-qu茅-es-cosmos-den)
- [Caracter铆sticas Principales](#-caracter铆sticas-principales)
- [Instalaci贸n](#-instalaci贸n)
- [Uso R谩pido](#-uso-r谩pido)
- [Generaci贸n de Medios](#-generaci贸n-de-medios)
- [Integraci贸n MCP](#-integraci贸n-mcp)
- [API Reference](#-api-reference)
- [Despliegue](#-despliegue)
- [Contribuir](#-contribuir)

---

## 馃専 驴Qu茅 es cosmos-den?

**cosmos-den** es una plataforma de IA que combina:

- 馃帹 **Generaci贸n de contenido multimedia** (im谩genes con ComfyUI, videos con Luma)
- 馃捇 **Ejecuci贸n segura de c贸digo** con terminal controlado
- 馃 **Chat inteligente** con capacidades de construcci贸n de proyectos
- 馃攲 **Integraci贸n MCP** para conectar con otras IAs
- 馃寪 **Interfaz web moderna** con modo Chat y Laboratorio

### Casos de Uso

- Desarrolladores que necesitan un asistente IA para proyectos completos
- Creadores de contenido que requieren generaci贸n automatizada de medios
- Equipos que buscan automatizar flujos de trabajo con IA
- Investigadores experimentando con modelos generativos

---

## 鉁?Caracter铆sticas Principales

### 馃幁 Modos de Operaci贸n

**Modo Chat**
- Construcci贸n de proyectos completos con comandos `/make` y `/export`
- Ejecuci贸n de c贸digo y comandos del sistema
- Generaci贸n de documentaci贸n y c贸digo
- Orientado a desarrollo y automatizaci贸n

**Modo Laboratorio**
- Generaci贸n de im谩genes con ComfyUI (local)
- Generaci贸n de videos con Luma Dream Machine (cloud)
- Interfaz visual para experimentaci贸n
- Preview en tiempo real

### 馃敡 Capacidades T茅cnicas

- **Terminal Seguro**: Lista blanca de comandos permitidos
- **Gesti贸n de Archivos**: Creaci贸n, edici贸n y exportaci贸n
- **Conversi贸n de Medios**: WebM 鈫?MP4 con FFmpeg
- **Gateway IA**: Orquestaci贸n de tareas complejas
- **Daemon Service**: Servidor persistente con auto-reinicio

---

## 馃殌 Instalaci贸n

### Prerrequisitos

- Node.js 18+ y pnpm
- Python 3.10+ (para ComfyUI, opcional)
- FFmpeg (para conversi贸n de video, opcional)

### Instalaci贸n R谩pida

```bash
# Clonar repositorio
git clone https://github.com/djklmr2025/cosmos-den.git
cd cosmos-den

# Instalar dependencias
pnpm install

# Configurar variables de entorno
cp .env.example .env
# Edita .env con tus claves API

# Iniciar en modo desarrollo
pnpm dev
```

### Acceso

- **Interfaz Web**: http://localhost:8082
- **API Health**: http://localhost:8082/health
- **API Docs**: http://localhost:8082/api/ping

---

## 馃挮 Uso R谩pido

### Comandos Principales

```bash
# Iniciar servidor de desarrollo
pnpm dev

# Iniciar con daemon (producci贸n)
node scripts/arkaios-daemon.js

# Build para producci贸n
pnpm build

# Iniciar producci贸n
pnpm start
```

### Variables de Entorno

```env
# APIs Externas
LUMA_API_KEY=tu_clave_luma
AIDA_GATEWAY_URL=https://arkaios-gateway-open.onrender.com/aida/gateway
AIDA_AUTH_TOKEN=opcional

# ComfyUI (local)
COMFYUI_ROOT=C:/ruta/a/ComfyUI
COMFYUI_PYTHON=python
COMFYUI_SCRIPT=main.py
COMFYUI_BASE_URL=http://127.0.0.1:8188

# Servidor
ARK_PORT=8082
LOCAL_BASE=http://127.0.0.1:3000
```

---

## 馃帹 Generaci贸n de Medios

### Im谩genes con ComfyUI

#### Modo B谩sico (desde Lab)

1. Abre el Laboratorio 鈫?Generador de Medios
2. Selecciona Proveedor: **ComfyUI**
3. Ingresa tu prompt:

```
Positivo: Retrato futurista ultra-realista de una exploradora espacial, 
iluminaci贸n cinematogr谩fica, detalle en ojos y textura de traje, 
estilo fotorrealista, 85mm, DOF suave

Negativo: artefactos, manos deformes, baja resoluci贸n, blur excesivo
```

4. Ajusta par谩metros: steps=20, cfg=8, modelo=sd_xl_base_1.0.safetensors
5. Genera y descarga

#### Modo Avanzado (workflow JSON)

Pega un workflow exportado de ComfyUI:

```json
{
  "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}},
  "2": {"class_type": "CLIPTextEncode", "inputs": {"text": "tu prompt", "clip": ["1", 1]}},
  "3": {"class_type": "CLIPTextEncode", "inputs": {"text": "negative prompt", "clip": ["1", 1]}},
  "4": {"class_type": "EmptyLatentImage", "inputs": {"width": 768, "height": 768}},
  "5": {"class_type": "KSampler", "inputs": {"seed": 0, "steps": 20, "cfg": 8, "sampler_name": "euler", "scheduler": "normal", "denoise": 1, "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0], "latent_image": ["4", 0]}},
  "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
  "7": {"class_type": "SaveImage", "inputs": {"images": ["6", 0]}}
}
```

### Videos con Luma Dream Machine

#### Desde el Lab

1. Selecciona Proveedor: **Luma**
2. Tipo: **Video**
3. Ingresa prompt:

```
Una toma a茅rea de un dron sobre una ciudad futurista al atardecer, 
estilo cinematogr谩fico, colores c谩lidos, movimiento suave de c谩mara
```

4. Configura: modelo=ray-2, duraci贸n=5s, resoluci贸n=720p
5. Espera generaci贸n y descarga

#### V铆a API

```bash
curl -X POST http://localhost:8082/api/media/generate \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "luma",
    "type": "video",
    "prompt": "toma a茅rea ciudad futurista atardecer cinematogr谩fico",
    "model": "ray-2",
    "durationSec": 5,
    "resolution": "720p"
  }'
```

### Auto-arranque de ComfyUI

El sistema puede gestionar ComfyUI autom谩ticamente:

```bash
# Iniciar ComfyUI en puerto 9000
curl -X POST http://localhost:8082/api/comfyui/manage/start?port=9000

# Verificar estado
curl http://localhost:8082/api/comfyui/manage/status?port=9000

# Detener
curl -X POST http://localhost:8082/api/comfyui/manage/stop?port=9000
```

---

## 馃 Integraci贸n MCP

### Configuraci贸n HTTP

```json
{
  "mcpHttpServers": {
    "arkaios-mcp-http": {
      "url": "http://localhost:8090/mcp"
    }
  }
}
```

### Configuraci贸n STDIO

```json
{
  "mcpServers": {
    "cosmos-den-mcp": {
      "command": "node",
      "args": ["apps/mcp/server.mjs"],
      "cwd": "C:/ruta/a/cosmos-den",
      "env": {
        "AIDA_GATEWAY_URL": "https://arkaios-gateway-open.onrender.com/aida/gateway",
        "AIDA_AUTH_TOKEN": "",
        "LOCAL_BASE": "http://127.0.0.1:3000"
      },
      "autoStart": true
    }
  }
}
```

### Uso desde otra IA

```bash
# Enviar objetivo de construcci贸n
curl -X POST http://localhost:8082/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Construye un TODO app con React+Vite y API REST simple"
  }'

# Ejecutar comando seguro
curl -X POST http://localhost:8082/mcp/tools/run \
  -H "Content-Type: application/json" \
  -d '{
    "cmd": "pnpm",
    "args": ["-v"]
  }'
```

---

## 馃摗 API Reference

### Health Check

```bash
GET /health
Response: { "status": "ok" }
```

### Chat Gateway

```bash
POST /api/chat
Body: {
  "prompt": "Construye una landing page moderna con animaciones"
}
```

### Terminal Seguro

```bash
POST /api/terminal/run
Body: {
  "cmd": "echo",
  "args": ["Hello cosmos-den"]
}
```

### Conversi贸n de Medios

```bash
# Convertir WebM a MP4
POST /api/media/convert
Body: {
  "sourceUrl": "https://example.com/video.webm",
  "targetFormat": "mp4"
}

# Descargar resultado
GET /api/media/file/:id.mp4
```

### ComfyUI Proxy

```bash
# Enviar generaci贸n
POST /api/comfyui/prompt?base=http://127.0.0.1:9000
Body: {
  "client_id": "cosmos-ui",
  "workflow": {...}
}

# Consultar estado
GET /api/comfyui/history/:jobId?base=http://127.0.0.1:9000

# Descargar imagen
GET /api/comfyui/view?filename=...&type=output&base=http://127.0.0.1:9000
```

### Luma Video

```bash
# Iniciar generaci贸n
POST /api/media/generate
Body: {
  "provider": "luma",
  "type": "video",
  "prompt": "...",
  "model": "ray-2"
}

# Consultar estado
GET /api/media/status/:generationId
```

---

## 馃寪 Despliegue

### Render (Backend)

1. Crea un Web Service apuntando al repositorio
2. Configuraci贸n:
   - Build: `pnpm install && pnpm build`
   - Start: `pnpm start`
3. Variables de entorno:
   - `LUMA_API_KEY` (requerida)
   - `COMFYUI_BASE_URL` (opcional)
   - `ARK_PORT` (opcional, default 8082)

### Vercel (Frontend)

1. Conecta el repositorio
2. Root Directory: carpeta del cliente
3. Framework Preset: Vite
4. Deploy

### Local con Daemon

```bash
# Configurar variables de entorno
export ARK_DAEMON_CMD=pnpm
export ARK_DAEMON_ARGS=dev
export ARK_PORT=8082

# Iniciar daemon
node scripts/arkaios-daemon.js

# Logs en: data/logs/daemon.log
```

### Empaquetado Windows (.exe)

Consulta `docs/packaging-exe.md` para generar un instalador completo con todas las dependencias.

---

## 馃 Contribuir

### Formas de Contribuir

1. 馃専 Dale una estrella al repositorio
2. 馃悰 Reporta bugs con detalles reproducibles
3. 馃挕 Prop贸n nuevas caracter铆sticas
4. 馃敡 Env铆a pull requests
5. 馃摉 Mejora la documentaci贸n

### Gu铆as de Desarrollo

```bash
# Fork y clonar
git clone https://github.com/tu-usuario/cosmos-den.git

# Crear rama
git checkout -b feature/nueva-caracteristica

# Hacer cambios y commit
git commit -m "feat: descripci贸n de cambio"

# Push y crear PR
git push origin feature/nueva-caracteristica
```

### C贸digo de Conducta

- Respeto y profesionalismo
- C贸digo limpio y bien documentado
- Tests para nuevas caracter铆sticas
- Seguir convenciones del proyecto

---

## 馃摓 Soporte y Comunidad

- **Issues**: [GitHub Issues](https://github.com/djklmr2025/cosmos-den/issues)
- **Discusiones**: [GitHub Discussions](https://github.com/djklmr2025/cosmos-den/discussions)
- **Email**: contact@cosmos-den.ai

---

## 馃搫 Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.

**漏 2025 djklmr2025** - Construyendo el futuro de la IA, un proyecto a la vez.

---

## 馃檹 Agradecimientos

- ComfyUI por la plataforma de generaci贸n de im谩genes
- Luma AI por Dream Machine
- La comunidad open source por las herramientas y librer铆as

---

<div align="center">

**[猬?Volver arriba](#-cosmos-den)**

</div>
