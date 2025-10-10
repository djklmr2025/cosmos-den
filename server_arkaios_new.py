# server_arkaios_new.py — ARKAIOS AI Server con Builder Mode
"""
Servidor Flask con capacidades completas de IA Builder Mode
"""

import os
import json
import uuid
import time
import logging
from datetime import datetime
from pathlib import Path

from flask import Flask, request, send_from_directory, jsonify
from flask_cors import CORS

# Importar módulos ARKAIOS
from arkaios_ai_brain_real import get_ai_brain_real  # Versión con LLM real
from arkaios_file_manager import get_file_manager
from arkaios_executor import get_executor
from arkaios_builder_mode import get_builder

# ========== CONFIG ==========
APP_DIR = Path(__file__).parent.resolve()
STATIC_DIR = APP_DIR
STORAGE = Path(os.getenv("ARK_STORAGE", "data")).resolve()
MEM_DIR = Path(os.getenv("MEMORY_DIR", str(STORAGE / "memory"))).resolve()
WORKSPACE = Path(os.getenv("ARK_WORKSPACE", str(STORAGE / "workspace"))).resolve()

LOG_PATH = MEM_DIR / "arkaios_log.jsonl"
SESSION_PATH = MEM_DIR / "arkaios_session_last.json"

STORAGE.mkdir(parents=True, exist_ok=True)
MEM_DIR.mkdir(parents=True, exist_ok=True)
WORKSPACE.mkdir(parents=True, exist_ok=True)

# ========== LOGGING ==========
logger = logging.getLogger("arkaios")
logger.setLevel(logging.DEBUG)
ch = logging.StreamHandler()
ch.setLevel(logging.DEBUG)
ch.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s: %(message)s"))
logger.addHandler(ch)

def log_json(event: dict):
    """Añade una línea JSONL al log estructurado."""
    try:
        event.setdefault("ts", int(time.time() * 1000))
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")
    except Exception as e:
        logger.warning(f"No se pudo escribir log JSONL: {e}")

# ========== APP ==========
app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="")
CORS(app, resources={r"/*": {"origins": "*"}})

SESSIONS = {}  # token -> {"email":..., "name":..., "iat":...}

# Inicializar módulos ARKAIOS
ai_brain = get_ai_brain_real()  # Usar versión con LLM real
file_manager = get_file_manager(str(WORKSPACE))
executor = get_executor(str(WORKSPACE))
builder = get_builder(str(WORKSPACE))

# ===== Util =====
def ok(data=None, **kw):
    obj = {"ok": True}
    if isinstance(data, dict):
        obj.update(data)
    if kw:
        obj.update(kw)
    return jsonify(obj)

def err(msg, code=400, **kw):
    payload = {"ok": False, "error": str(msg)}
    payload.update(kw)
    return jsonify(payload), code

def require_auth():
    tok = request.args.get("token") or (request.get_json(silent=True) or {}).get("token")
    return SESSIONS.get(tok)

# ====== Front estático ======
@app.get("/")
def home():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return send_from_directory(STATIC_DIR, "index.html")
    return jsonify({"error": "index.html no encontrado"}), 404

@app.get("/app")
def app_page():
    arkaios_path = STATIC_DIR / "arkaios-integrated.html"
    if arkaios_path.exists():
        return send_from_directory(STATIC_DIR, "arkaios-integrated.html")
    return jsonify({"error": "arkaios-integrated.html no encontrado"}), 404

# ====== Health ======
@app.get("/health")
def health():
    data = {
        "ok": True,
        "name": "ARKAIOS AI Server",
        "version": "2.0.0",
        "status": "ready",
        "workspace": str(WORKSPACE),
        "features": {
            "ai_brain": True,
            "file_manager": True,
            "executor": True,
            "builder_mode": True,
        },
        "tools_available": {
            "node": executor.check_tool_installed("node")["installed"],
            "npm": executor.check_tool_installed("npm")["installed"],
            "python": executor.check_tool_installed("python")["installed"],
            "git": executor.check_tool_installed("git")["installed"],
        }
    }
    return jsonify(data)

# ====== Auth ======
@app.post("/auth/google")
def auth_google():
    body = request.get_json(force=True) or {}
    email = body.get("email", "demo@arkaios.local")
    name = body.get("name", "Demo User")
    
    tok = uuid.uuid4().hex
    SESSIONS[tok] = {"email": email, "name": name, "iat": int(time.time())}
    log_json({"type": "login", "email": email})
    
    logger.info(f"Usuario autenticado: {email}")
    return ok(token=tok, user={"email": email, "name": name})

# ====== AI CHAT ======
@app.post("/api/ai/chat")
def ai_chat():
    """
    Endpoint principal de chat con IA
    Procesa mensajes naturales y los convierte en acciones
    """
    body = request.get_json(force=True) or {}
    user = require_auth()
    
    message = body.get("message", "").strip()
    if not message:
        return err("Mensaje vacío")
    
    user_email = user["email"] if user else "anon"
    logger.info(f"Chat de {user_email}: {message}")
    
    # Procesar con AI Brain
    context = {
        "current_directory": str(WORKSPACE),
        "user": user_email,
    }
    
    result = ai_brain.process_message(message, context)
    
    log_json({
        "type": "ai_chat",
        "user": user_email,
        "message": message,
        "intent": result.get("intent"),
        "action": result.get("action"),
    })
    
    return ok(result)

# ====== AI EXECUTE ======
@app.post("/api/ai/execute")
def ai_execute():
    """
    Ejecuta una acción específica con confirmación
    """
    body = request.get_json(force=True) or {}
    user = require_auth()
    
    action = body.get("action")
    params = body.get("params", {})
    
    if not action:
        return err("Acción no especificada")
    
    user_email = user["email"] if user else "anon"
    logger.info(f"Execute de {user_email}: {action}")
    
    # Ejecutar acción
    try:
        result = _execute_action(action, params)
        
        log_json({
            "type": "ai_execute",
            "user": user_email,
            "action": action,
            "success": result.get("ok", False),
        })
        
        return ok(result)
    
    except Exception as e:
        logger.error(f"Error ejecutando acción: {e}")
        return err(str(e))

def _execute_action(action: str, params: dict) -> dict:
    """Ejecuta una acción específica"""
    
    actions = {
        "file_create": lambda p: file_manager.create_file(p["path"], p.get("content", "")),
        "file_read": lambda p: file_manager.read_file(p["path"]),
        "file_edit": lambda p: file_manager.update_file(p["path"], p["content"]),
        "file_delete": lambda p: file_manager.delete_file(p["path"], confirm=p.get("confirm", False)),
        "file_list": lambda p: file_manager.list_files(p.get("path", ".")),
        
        "code_execute": lambda p: executor.execute_command(
            p.get("command", "python"),
            p.get("args", []),
            cwd=p.get("cwd")
        ),
        
        "package_install": lambda p: executor.npm_install(
            [p["package"]] if isinstance(p["package"], str) else p["package"],
            cwd=p.get("cwd")
        ),
        
        "git_execute": lambda p: executor.git_command(
            p["command"].split() if isinstance(p["command"], str) else p["command"],
            cwd=p.get("cwd")
        ),
        
        "project_scaffold": lambda p: builder.create_project(
            p["type"],
            p["name"],
            p.get("options", {})
        ),
    }
    
    handler = actions.get(action)
    if not handler:
        return {"ok": False, "error": f"Acción '{action}' no reconocida"}
    
    return handler(params)

# ====== FILE MANAGER ENDPOINTS ======
@app.get("/api/files/list")
def api_list_files():
    """Lista archivos del workspace"""
    path = request.args.get("path", ".")
    recursive = request.args.get("recursive", "false").lower() == "true"
    
    result = file_manager.list_files(path, recursive=recursive)
    return ok(result)

@app.post("/api/files/create")
def api_create_file():
    """Crea un nuevo archivo"""
    body = request.get_json(force=True) or {}
    
    filepath = body.get("path")
    content = body.get("content", "")
    overwrite = body.get("overwrite", False)
    
    if not filepath:
        return err("Ruta del archivo requerida")
    
    result = file_manager.create_file(filepath, content, overwrite=overwrite)
    
    if result["ok"]:
        log_json({"type": "file_create", "path": filepath})
    
    return ok(result) if result["ok"] else err(result["error"])

@app.get("/api/files/read")
def api_read_file():
    """Lee un archivo"""
    filepath = request.args.get("path")
    
    if not filepath:
        return err("Ruta del archivo requerida")
    
    result = file_manager.read_file(filepath)
    return ok(result) if result["ok"] else err(result["error"])

@app.post("/api/files/edit")
def api_edit_file():
    """Edita un archivo"""
    body = request.get_json(force=True) or {}
    
    filepath = body.get("path")
    content = body.get("content")
    
    if not filepath or content is None:
        return err("Ruta y contenido requeridos")
    
    result = file_manager.update_file(filepath, content)
    
    if result["ok"]:
        log_json({"type": "file_edit", "path": filepath})
    
    return ok(result) if result["ok"] else err(result["error"])

@app.post("/api/files/delete")
def api_delete_file():
    """Elimina un archivo"""
    body = request.get_json(force=True) or {}
    
    filepath = body.get("path")
    confirm = body.get("confirm", False)
    
    if not filepath:
        return err("Ruta del archivo requerida")
    
    result = file_manager.delete_file(filepath, confirm=confirm)
    
    if result["ok"]:
        log_json({"type": "file_delete", "path": filepath})
    
    return ok(result) if result["ok"] else err(result["error"])

@app.get("/api/files/search")
def api_search_files():
    """Busca archivos"""
    pattern = request.args.get("pattern", "")
    content = request.args.get("content", "false").lower() == "true"
    
    if not pattern:
        return err("Patrón de búsqueda requerido")
    
    result = file_manager.search_files(pattern, content_search=content)
    return ok(result) if result["ok"] else err(result["error"])

@app.get("/api/files/tree")
def api_file_tree():
    """Obtiene la estructura de directorios en formato árbol"""
    directory = request.args.get("path", ".")
    max_depth = int(request.args.get("max_depth", "3"))
    
    result = file_manager.get_file_tree(directory, max_depth=max_depth)
    return ok(result) if result["ok"] else err(result["error"])

@app.post("/api/files/mkdir")
def api_create_directory():
    """Crea un nuevo directorio"""
    body = request.get_json(force=True) or {}
    dirpath = body.get("path")
    
    if not dirpath:
        return err("Ruta del directorio requerida")
    
    result = file_manager.create_directory(dirpath)
    
    if result["ok"]:
        log_json({"type": "directory_create", "path": dirpath})
    
    return ok(result) if result["ok"] else err(result["error"])

@app.get("/api/files/favorites")
def api_get_favorites():
    """Obtiene la lista de archivos favoritos"""
    result = file_manager.get_favorites()
    return ok(favorites=result["favorites"]) if result["ok"] else err(result["error"])

@app.post("/api/files/favorites/add")
def api_add_favorite():
    """Añade un archivo a favoritos"""
    body = request.get_json(force=True) or {}
    filepath = body.get("path")
    
    if not filepath:
        return err("Ruta del archivo requerida")
    
    result = file_manager.add_to_favorites(filepath)
    return ok(result) if result["ok"] else err(result["error"])

@app.post("/api/files/favorites/remove")
def api_remove_favorite():
    """Elimina un archivo de favoritos"""
    body = request.get_json(force=True) or {}
    filepath = body.get("path")
    
    if not filepath:
        return err("Ruta del archivo requerida")
    
    result = file_manager.remove_from_favorites(filepath)
    return ok(result) if result["ok"] else err(result["error"])

# ====== BUILDER MODE ENDPOINTS ======
@app.get("/api/builder/templates")
def api_builder_templates():
    """Lista templates disponibles"""
    result = builder.list_templates()
    return ok(result)

@app.post("/api/builder/scaffold")
def api_builder_scaffold():
    """Crea un nuevo proyecto"""
    body = request.get_json(force=True) or {}
    
    project_type = body.get("type")
    name = body.get("name")
    options = body.get("options", {})
    
    if not project_type or not name:
        return err("Tipo de proyecto y nombre requeridos")
    
    logger.info(f"Scaffolding proyecto: {project_type} - {name}")
    
    result = builder.create_project(project_type, name, options)
    
    if result["ok"]:
        log_json({
            "type": "project_create",
            "project_type": project_type,
            "name": name,
        })
    
    return ok(result) if result["ok"] else err(result["error"], details=result)

# ====== EXECUTOR ENDPOINTS ======
@app.post("/api/tools/execute")
def api_execute_command():
    """Ejecuta un comando"""
    body = request.get_json(force=True) or {}
    
    command = body.get("command")
    args = body.get("args", [])
    cwd = body.get("cwd")
    timeout = body.get("timeout")
    
    if not command:
        return err("Comando requerido")
    
    result = executor.execute_command(command, args, cwd=cwd, timeout=timeout)
    
    log_json({
        "type": "command_execute",
        "command": command,
        "success": result.get("ok", False),
    })
    
    return ok(result)

@app.post("/api/tools/npm")
def api_npm():
    """Comandos npm"""
    body = request.get_json(force=True) or {}
    
    action = body.get("action", "install")
    packages = body.get("packages", [])
    cwd = body.get("cwd")
    
    if action == "install":
        result = executor.npm_install(packages, cwd=cwd)
    else:
        return err(f"Acción npm '{action}' no soportada")
    
    return ok(result)

@app.post("/api/tools/git")
def api_git():
    """Comandos Git"""
    body = request.get_json(force=True) or {}
    
    git_command = body.get("command", "").strip()
    cwd = body.get("cwd")
    
    if not git_command:
        return err("Comando git requerido")
    
    # Parsear comando
    parts = git_command.split()
    
    result = executor.git_command(parts, cwd=cwd)
    
    return ok(result)

@app.get("/api/tools/check")
def api_check_tools():
    """Verifica herramientas instaladas"""
    tools = ["node", "npm", "python", "git", "firebase"]
    results = {}
    
    for tool in tools:
        results[tool] = executor.check_tool_installed(tool)
    
    return ok(tools=results)

# ====== CONTEXT & HISTORY ======
@app.get("/api/context")
def api_get_context():
    """Obtiene el contexto actual"""
    context = ai_brain.get_context()
    return ok(context=context)

@app.get("/api/history")
def api_get_history():
    """Obtiene el historial de conversación"""
    limit = int(request.args.get("limit", 10))
    history = ai_brain.get_history(limit=limit)
    return ok(history=history)

# ====== INFO ======
@app.get("/api/info")
def api_info():
    """Información del sistema"""
    return ok(
        version="2.0.0",
        workspace=str(WORKSPACE),
        storage=str(STORAGE),
        features=[
            "AI Brain - Procesamiento de lenguaje natural",
            "File Manager - Gestión segura de archivos",
            "Command Executor - Ejecución de comandos con sandboxing",
            "Builder Mode - Scaffolding de proyectos",
        ],
        templates=list(builder.project_templates.keys()),
    )

# ====== RUN ======
if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    logger.info(f"🚀 ARKAIOS AI Server iniciando en puerto {port}")
    logger.info(f"📁 Workspace: {WORKSPACE}")
    logger.info(f"🧠 AI Brain: Activo")
    logger.info(f"🏗️  Builder Mode: {len(builder.project_templates)} templates disponibles")
    
    app.run(
        host="0.0.0.0",
        port=port,
        debug=True,
    )
