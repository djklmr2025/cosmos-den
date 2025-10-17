# 🌌 cosmos-den

**Plataforma de IA autónoma con capacidades avanzadas de generación de contenido, ejecución de código e integración MCP**

<div align="center">

[![GitHub Stars](https://img.shields.io/github/stars/djklmr2025/cosmos-den?style=for-the-badge&color=yellow)](https://github.com/djklmr2025/cosmos-den/stargazers)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2025.1-blue?style=for-the-badge)](releases)

**[🚀 Demo en Vivo](https://cosmos-den.vercel.app/)** | **[🛠️ Builder Demo](https://arkaios-builder.base44.app/)**

</div>

---

## 📋 Tabla de Contenidos

- [¿Qué es cosmos-den?](#-qué-es-cosmos-den)
- [Características Principales](#-características-principales)
- [Instalación](#-instalación)
- [Uso Rápido](#-uso-rápido)
- [Generación de Medios](#-generación-de-medios)
- [Integración MCP](#-integración-mcp)
- [API Reference](#-api-reference)
- [Despliegue](#-despliegue)
- [Contribuir](#-contribuir)

---

## 🌟 ¿Qué es cosmos-den?

**cosmos-den** es una plataforma de IA que combina:

- 🎨 **Generación de contenido multimedia** (imágenes con ComfyUI, videos con Luma)
- 💻 **Ejecución segura de código** con terminal controlado
- 🤖 **Chat inteligente** con capacidades de construcción de proyectos
- 🔌 **Integración MCP** para conectar con otras IAs
- 🌐 **Interfaz web moderna** con modo Chat y Laboratorio

### Casos de Uso

- Desarrolladores que necesitan un asistente IA para proyectos completos
- Creadores de contenido que requieren generación automatizada de medios
- Equipos que buscan automatizar flujos de trabajo con IA
- Investigadores experimentando con modelos generativos

---

## ✨ Características Principales

### 🎭 Modos de Operación

**Modo Chat**
- Construcción de proyectos completos con comandos `/make` y `/export`
- Ejecución de código y comandos del sistema
- Generación de documentación y código
- Orientado a desarrollo y automatización

**Modo Laboratorio**
- Generación de imágenes con ComfyUI (local)
- Generación de videos con Luma Dream Machine (cloud)
- Interfaz visual para experimentación
- Preview en tiempo real

### 🔧 Capacidades Técnicas

- **Terminal Seguro**: Lista blanca de comandos permitidos
- **Gestión de Archivos**: Creación, edición y exportación
- **Conversión de Medios**: WebM ↔ MP4 con FFmpeg
- **Gateway IA**: Orquestación de tareas complejas
- **Daemon Service**: Servidor persistente con auto-reinicio

---

## 🚀 Instalación

### Prerrequisitos

- Node.js 18+ y pnpm
- Python 3.10+ (para ComfyUI, opcional)
- FFmpeg (para conversión de video, opcional)

### Instalación Rápida

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

## 💫 Uso Rápido

### Comandos Principales

```bash
# Iniciar servidor de desarrollo
pnpm dev

# Iniciar con daemon (producción)
node scripts/arkaios-daemon.js

# Build para producción
pnpm build

# Iniciar producción
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

## 🎨 Generación de Medios

### Imágenes con ComfyUI

#### Modo Básico (desde Lab)

1. Abre el Laboratorio → Generador de Medios
2. Selecciona Proveedor: **ComfyUI**
3. Ingresa tu prompt:

```
Positivo: Retrato futurista ultra-realista de una exploradora espacial, 
iluminación cinematográfica, detalle en ojos y textura de traje, 
estilo fotorrealista, 85mm, DOF suave

Negativo: artefactos, manos deformes, baja resolución, blur excesivo
```

4. Ajusta parámetros: steps=20, cfg=8, modelo=sd_xl_base_1.0.safetensors
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
Una toma aérea de un dron sobre una ciudad futurista al atardecer, 
estilo cinematográfico, colores cálidos, movimiento suave de cámara
```

4. Configura: modelo=ray-2, duración=5s, resolución=720p
5. Espera generación y descarga

#### Vía API

```bash
curl -X POST http://localhost:8082/api/media/generate \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "luma",
    "type": "video",
    "prompt": "toma aérea ciudad futurista atardecer cinematográfico",
    "model": "ray-2",
    "durationSec": 5,
    "resolution": "720p"
  }'
```

### Auto-arranque de ComfyUI

El sistema puede gestionar ComfyUI automáticamente:

```bash
# Iniciar ComfyUI en puerto 9000
curl -X POST http://localhost:8082/api/comfyui/manage/start?port=9000

# Verificar estado
curl http://localhost:8082/api/comfyui/manage/status?port=9000

# Detener
curl -X POST http://localhost:8082/api/comfyui/manage/stop?port=9000
```

---

## 🤖 Integración MCP

### Configuración HTTP

```json
{
  "mcpHttpServers": {
    "arkaios-mcp-http": {
      "url": "http://localhost:8090/mcp"
    }
  }
}
```

### Configuración STDIO

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
# Enviar objetivo de construcción
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

## 📡 API Reference

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

### Conversión de Medios

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
# Enviar generación
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
# Iniciar generación
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

## 🌐 Despliegue

### Render (Backend)

1. Crea un Web Service apuntando al repositorio
2. Configuración:
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

## 🤝 Contribuir

### Formas de Contribuir

1. 🌟 Dale una estrella al repositorio
2. 🐛 Reporta bugs con detalles reproducibles
3. 💡 Propón nuevas características
4. 🔧 Envía pull requests
5. 📖 Mejora la documentación

### Guías de Desarrollo

```bash
# Fork y clonar
git clone https://github.com/tu-usuario/cosmos-den.git

# Crear rama
git checkout -b feature/nueva-caracteristica

# Hacer cambios y commit
git commit -m "feat: descripción de cambio"

# Push y crear PR
git push origin feature/nueva-caracteristica
```

### Código de Conducta

- Respeto y profesionalismo
- Código limpio y bien documentado
- Tests para nuevas características
- Seguir convenciones del proyecto

---

## 📞 Soporte y Comunidad

- **Issues**: [GitHub Issues](https://github.com/djklmr2025/cosmos-den/issues)
- **Discusiones**: [GitHub Discussions](https://github.com/djklmr2025/cosmos-den/discussions)
- **Email**: contact@cosmos-den.ai

---

## 📄 Licencia

MIT License - ver [LICENSE](LICENSE) para detalles.

**© 2025 djklmr2025** - Construyendo el futuro de la IA, un proyecto a la vez.

---

## 🙏 Agradecimientos

- ComfyUI por la plataforma de generación de imágenes
- Luma AI por Dream Machine
- La comunidad open source por las herramientas y librerías

---

<div align="center">

**[⬆ Volver arriba](#-cosmos-den)**

</div>