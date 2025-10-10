# 🏗️ ARKAIOS Builder Mode - Plan de Implementación

## 🎯 Objetivo
Crear una IA que pueda:
1. Gestionar archivos y código (crear, editar, eliminar)
2. Ejecutar código y scripts
3. Interactuar con herramientas de desarrollo (Git, npm, Firebase, etc.)
4. Automatizar tareas de desarrollo
5. Modo constructor tipo "Puter" para crear aplicaciones

## 📋 Componentes Core

### 1. AI Brain (Cerebro IA)
- **LLM Integration**: Usar LLM local o API
- **Command Parser**: Interpretar instrucciones naturales
- **Task Planner**: Dividir tareas complejas en pasos
- **Memory System**: Recordar contexto de conversación

### 2. File Manager (Gestor de Archivos)
- Crear/leer/actualizar/eliminar archivos
- Navegación de directorios
- Búsqueda de archivos
- Análisis de código

### 3. Code Executor (Ejecutor de Código)
- Ejecutar Python, JavaScript, Bash
- Capturar salida y errores
- Timeout y sandboxing básico
- Manejo de dependencias

### 4. Tool Integration (Integración de Herramientas)
- Git (clone, commit, push, pull)
- npm/pip (instalar paquetes)
- Firebase CLI
- Docker (opcional)

### 5. Builder Mode (Modo Constructor)
- Scaffolding de proyectos
- Generación de código base
- Configuración automática
- Deploy automatizado

## 🚀 MVP - Fase 1 (Implementación Inmediata)

### Archivos a crear:
1. `arkaios_ai_brain.py` - Core de IA
2. `arkaios_file_manager.py` - Gestor de archivos
3. `arkaios_executor.py` - Ejecutor de comandos
4. `arkaios_builder.py` - Modo constructor
5. Actualizar `server_arkaios.py` - Nuevos endpoints

### Endpoints API:
```
POST /api/ai/chat          - Conversación con IA
POST /api/ai/execute       - Ejecutar tarea específica
GET  /api/files/list       - Listar archivos
POST /api/files/create     - Crear archivo
POST /api/files/edit       - Editar archivo
POST /api/files/delete     - Eliminar archivo
GET  /api/files/read       - Leer archivo
POST /api/builder/scaffold - Crear proyecto base
POST /api/builder/deploy   - Desplegar proyecto
POST /api/tools/git        - Comandos Git
POST /api/tools/npm        - Comandos npm
POST /api/tools/firebase   - Firebase CLI
```

## 🔧 Stack Técnico

### Backend:
- **Flask** - API REST
- **LangChain** - Orquestación LLM (o directo con API)
- **Subprocess** - Ejecución de comandos
- **Watchdog** - Monitor de archivos

### LLM Options:
1. **OpenAI GPT-4** (requiere API key) - Mejor calidad
2. **Anthropic Claude** (requiere API key) - Excelente para código
3. **LM Studio** (local, gratuito) - Privacidad total
4. **Ollama** (local, gratuito) - Fácil setup

### Seguridad:
- Whitelist de comandos permitidos
- Sandboxing de ejecución
- Rate limiting
- Validación de rutas de archivos
- Logs de auditoría

## 📝 Ejemplo de Uso

```
Usuario: "Crea un proyecto React con TypeScript"

IA: 
1. Entiendo que quieres un proyecto React+TS
2. Voy a ejecutar: npx create-react-app my-app --template typescript
3. [Ejecuta comando]
4. Proyecto creado en ./my-app
5. ¿Quieres que instale dependencias adicionales?

Usuario: "Sí, instala axios y tailwindcss"

IA:
1. Navegando a ./my-app
2. Ejecutando: npm install axios
3. Ejecutando: npm install -D tailwindcss
4. Configurando tailwind...
5. ¡Listo! ¿Quieres que inicie el servidor dev?
```

## 🎮 Comandos Builder Mode

### Proyectos:
- `create react-app [name]`
- `create vue-app [name]`
- `create python-api [name]`
- `create nextjs-app [name]`

### Código:
- `create file [path]`
- `edit file [path]`
- `analyze code [path]`
- `refactor [path]`

### Git:
- `git init`
- `git commit -m "message"`
- `git push`

### Deploy:
- `deploy to firebase`
- `deploy to vercel`
- `deploy to render`

## 🔒 Seguridad

### Comandos Permitidos (Whitelist):
```python
ALLOWED_COMMANDS = {
    'npm': ['install', 'run', 'start', 'build'],
    'git': ['init', 'add', 'commit', 'push', 'pull', 'status'],
    'python': ['-m', 'run'],
    'firebase': ['init', 'deploy', 'serve'],
    'npx': ['create-react-app', 'create-next-app'],
}
```

### Rutas Protegidas:
```python
FORBIDDEN_PATHS = [
    '/etc/', '/sys/', '/proc/',
    'C:\\Windows\\System32\\',
    '~/.ssh/', '~/.aws/'
]
```

## 🎯 Próximos Pasos

1. ¿Qué LLM quieres usar? (OpenAI/Claude/Local)
2. ¿Tienes API keys disponibles?
3. ¿Qué herramientas tienes instaladas? (Git, Node, Python, Firebase CLI)
