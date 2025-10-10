# arkaios_builder_mode.py - Builder Mode para ARKAIOS
"""
Sistema de construcción automatizada de proyectos
Tipo Puter/Firebase - Scaffolding y deploy automatizado
"""

import os
import json
import logging
from typing import Dict, List, Optional
from pathlib import Path
from datetime import datetime

from arkaios_executor import get_executor
from arkaios_file_manager import get_file_manager

logger = logging.getLogger("arkaios.builder")


class BuilderMode:
    """Constructor automático de proyectos"""
    
    def __init__(self, workspace_root: str = None):
        self.workspace_root = Path(workspace_root or os.getcwd()).resolve()
        self.executor = get_executor(str(self.workspace_root))
        self.file_manager = get_file_manager(str(self.workspace_root))
        
        # Templates de proyectos
        self.project_templates = {
            "react": self._create_react_app,
            "nextjs": self._create_nextjs_app,
            "vue": self._create_vue_app,
            "python-api": self._create_python_api,
            "express": self._create_express_app,
            "html-static": self._create_html_static,
        }
        
        logger.info("BuilderMode iniciado")
    
    def create_project(self, project_type: str, name: str, 
                      options: Dict = None) -> Dict:
        """
        Crea un nuevo proyecto
        
        Args:
            project_type: Tipo de proyecto (react, nextjs, vue, etc)
            name: Nombre del proyecto
            options: Opciones adicionales
        
        Returns:
            {
                "ok": bool,
                "project_type": str,
                "name": str,
                "path": str,
                "steps": [str],
                "error": str
            }
        """
        options = options or {}
        
        if project_type not in self.project_templates:
            return {
                "ok": False,
                "error": f"Tipo de proyecto '{project_type}' no soportado. " +
                        f"Disponibles: {', '.join(self.project_templates.keys())}"
            }
        
        logger.info(f"Creando proyecto {project_type}: {name}")
        
        try:
            # Ejecutar template correspondiente
            template_func = self.project_templates[project_type]
            result = template_func(name, options)
            
            if result["ok"]:
                logger.info(f"Proyecto {name} creado exitosamente")
            else:
                logger.error(f"Error creando proyecto {name}: {result.get('error')}")
            
            return result
        
        except Exception as e:
            logger.error(f"Excepción creando proyecto: {e}")
            return {
                "ok": False,
                "error": str(e)
            }
    
    def _create_react_app(self, name: str, options: Dict) -> Dict:
        """Crea una aplicación React"""
        steps = []
        
        # Verificar npm
        npm_check = self.executor.check_tool_installed("npm")
        if not npm_check["installed"]:
            return {
                "ok": False,
                "error": "npm no está instalado"
            }
        steps.append(f"✓ npm detectado: {npm_check['version']}")
        
        # Usar template TypeScript si se especifica
        template = options.get("template", "")
        args = ["create-react-app", name]
        if template:
            args.extend(["--template", template])
        
        # Crear proyecto con create-react-app
        steps.append(f"Ejecutando: npx {' '.join(args)}")
        result = self.executor.execute_command("npx", args, timeout=600)
        
        if not result["ok"]:
            return {
                "ok": False,
                "error": f"Error creando app React: {result.get('error')}",
                "steps": steps,
                "details": result
            }
        
        steps.append("✓ Proyecto React creado")
        
        # Instalar dependencias adicionales si se especifican
        extra_deps = options.get("dependencies", [])
        if extra_deps:
            steps.append(f"Instalando dependencias: {', '.join(extra_deps)}")
            install_result = self.executor.npm_install(extra_deps, cwd=name)
            if install_result["ok"]:
                steps.append("✓ Dependencias instaladas")
            else:
                steps.append(f"⚠ Error instalando dependencias: {install_result.get('error')}")
        
        # Crear README personalizado
        readme_content = self._generate_readme("React", name, {
            "start": "npm start",
            "build": "npm run build",
            "test": "npm test",
        })
        self.file_manager.create_file(f"{name}/README_ARKAIOS.md", readme_content, overwrite=True)
        steps.append("✓ README creado")
        
        return {
            "ok": True,
            "project_type": "react",
            "name": name,
            "path": name,
            "steps": steps,
            "next_steps": [
                f"cd {name}",
                "npm start"
            ]
        }
    
    def _create_nextjs_app(self, name: str, options: Dict) -> Dict:
        """Crea una aplicación Next.js"""
        steps = []
        
        npm_check = self.executor.check_tool_installed("npm")
        if not npm_check["installed"]:
            return {"ok": False, "error": "npm no está instalado"}
        steps.append(f"✓ npm detectado: {npm_check['version']}")
        
        # Crear con create-next-app
        args = ["create-next-app@latest", name]
        
        # Opciones por defecto
        if options.get("typescript", True):
            args.append("--typescript")
        if options.get("tailwind", True):
            args.append("--tailwind")
        args.append("--app")  # Usar App Router por defecto
        
        steps.append(f"Ejecutando: npx {' '.join(args)}")
        result = self.executor.execute_command("npx", args, timeout=600)
        
        if not result["ok"]:
            return {
                "ok": False,
                "error": f"Error creando app Next.js: {result.get('error')}",
                "steps": steps
            }
        
        steps.append("✓ Proyecto Next.js creado")
        
        readme_content = self._generate_readme("Next.js", name, {
            "dev": "npm run dev",
            "build": "npm run build",
            "start": "npm start",
        })
        self.file_manager.create_file(f"{name}/README_ARKAIOS.md", readme_content, overwrite=True)
        steps.append("✓ README creado")
        
        return {
            "ok": True,
            "project_type": "nextjs",
            "name": name,
            "path": name,
            "steps": steps,
            "next_steps": [
                f"cd {name}",
                "npm run dev"
            ]
        }
    
    def _create_vue_app(self, name: str, options: Dict) -> Dict:
        """Crea una aplicación Vue"""
        steps = []
        
        npm_check = self.executor.check_tool_installed("npm")
        if not npm_check["installed"]:
            return {"ok": False, "error": "npm no está instalado"}
        steps.append(f"✓ npm detectado: {npm_check['version']}")
        
        # Crear con @vue/cli (simplificado - usar create-vue es más moderno)
        args = ["create-vue@latest", name]
        
        steps.append(f"Ejecutando: npx {' '.join(args)}")
        result = self.executor.execute_command("npx", args, timeout=600)
        
        if not result["ok"]:
            return {
                "ok": False,
                "error": f"Error creando app Vue: {result.get('error')}",
                "steps": steps
            }
        
        steps.append("✓ Proyecto Vue creado")
        
        return {
            "ok": True,
            "project_type": "vue",
            "name": name,
            "path": name,
            "steps": steps,
            "next_steps": [
                f"cd {name}",
                "npm install",
                "npm run dev"
            ]
        }
    
    def _create_python_api(self, name: str, options: Dict) -> Dict:
        """Crea una API Python con Flask o FastAPI"""
        steps = []
        
        # Verificar Python
        python_check = self.executor.check_tool_installed("python")
        if not python_check["installed"]:
            return {"ok": False, "error": "Python no está instalado"}
        steps.append(f"✓ Python detectado: {python_check['version']}")
        
        # Crear estructura del proyecto
        project_path = self.workspace_root / name
        project_path.mkdir(exist_ok=True)
        steps.append(f"✓ Directorio '{name}' creado")
        
        framework = options.get("framework", "flask")
        
        # Crear archivos base
        if framework == "flask":
            app_content = '''from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({"message": "Hello from ARKAIOS API!"})

@app.route('/api/health')
def health():
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
'''
            requirements = "flask\nflask-cors\n"
        else:  # fastapi
            app_content = '''from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def home():
    return {"message": "Hello from ARKAIOS API!"}

@app.get("/api/health")
def health():
    return {"status": "ok"}
'''
            requirements = "fastapi\nuvicorn[standard]\n"
        
        self.file_manager.create_file(f"{name}/app.py", app_content)
        self.file_manager.create_file(f"{name}/requirements.txt", requirements)
        steps.append("✓ Archivos creados (app.py, requirements.txt)")
        
        # Crear README
        readme_content = self._generate_readme(f"Python API ({framework})", name, {
            "install": "pip install -r requirements.txt",
            "run": "python app.py" if framework == "flask" else "uvicorn app:app --reload",
        })
        self.file_manager.create_file(f"{name}/README.md", readme_content)
        steps.append("✓ README creado")
        
        return {
            "ok": True,
            "project_type": "python-api",
            "name": name,
            "path": name,
            "steps": steps,
            "next_steps": [
                f"cd {name}",
                "pip install -r requirements.txt",
                "python app.py"
            ]
        }
    
    def _create_express_app(self, name: str, options: Dict) -> Dict:
        """Crea una API Express (Node.js)"""
        steps = []
        
        npm_check = self.executor.check_tool_installed("npm")
        if not npm_check["installed"]:
            return {"ok": False, "error": "npm no está instalado"}
        steps.append(f"✓ npm detectado: {npm_check['version']}")
        
        # Crear directorio
        project_path = self.workspace_root / name
        project_path.mkdir(exist_ok=True)
        steps.append(f"✓ Directorio '{name}' creado")
        
        # Inicializar npm
        init_result = self.executor.execute_command("npm", ["init", "-y"], cwd=name)
        if init_result["ok"]:
            steps.append("✓ package.json creado")
        
        # Instalar Express
        install_result = self.executor.npm_install(["express", "cors"], cwd=name)
        if install_result["ok"]:
            steps.append("✓ Express instalado")
        
        # Crear app.js
        app_content = '''const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Hello from ARKAIOS API!' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
'''
        self.file_manager.create_file(f"{name}/app.js", app_content)
        steps.append("✓ app.js creado")
        
        # Actualizar package.json con script de start
        # (Simplificado - en producción parsear el JSON)
        
        readme_content = self._generate_readme("Express API", name, {
            "start": "node app.js",
        })
        self.file_manager.create_file(f"{name}/README.md", readme_content)
        steps.append("✓ README creado")
        
        return {
            "ok": True,
            "project_type": "express",
            "name": name,
            "path": name,
            "steps": steps,
            "next_steps": [
                f"cd {name}",
                "node app.js"
            ]
        }
    
    def _create_html_static(self, name: str, options: Dict) -> Dict:
        """Crea un sitio HTML estático"""
        steps = []
        
        # Crear directorio
        project_path = self.workspace_root / name
        project_path.mkdir(exist_ok=True)
        steps.append(f"✓ Directorio '{name}' creado")
        
        # Crear archivos HTML, CSS, JS
        html_content = '''<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>''' + name + '''</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="container">
        <h1>¡Bienvenido a ''' + name + '''!</h1>
        <p>Creado con ARKAIOS Builder Mode</p>
        <button onclick="showMessage()">Click Me</button>
    </div>
    <script src="script.js"></script>
</body>
</html>'''
        
        css_content = '''* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    min-height: 100vh;
    display: flex;
    justify-content: center;
    align-items: center;
}

.container {
    background: white;
    padding: 3rem;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    text-align: center;
}

h1 {
    color: #667eea;
    margin-bottom: 1rem;
}

button {
    margin-top: 2rem;
    padding: 12px 30px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 25px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s;
}

button:hover {
    background: #764ba2;
    transform: translateY(-2px);
    box-shadow: 0 10px 20px rgba(0,0,0,0.2);
}'''
        
        js_content = '''function showMessage() {
    alert('¡Hola desde ARKAIOS Builder Mode! 🚀');
}

console.log('App iniciada correctamente');'''
        
        self.file_manager.create_file(f"{name}/index.html", html_content)
        self.file_manager.create_file(f"{name}/style.css", css_content)
        self.file_manager.create_file(f"{name}/script.js", js_content)
        steps.append("✓ Archivos HTML, CSS, JS creados")
        
        readme_content = f'''# {name}

Sitio web estático creado con ARKAIOS Builder Mode

## Abrir
- Simplemente abre `index.html` en tu navegador
- O usa un servidor local: `python -m http.server 8000`

Creado el {datetime.now().strftime("%Y-%m-%d")}
'''
        self.file_manager.create_file(f"{name}/README.md", readme_content)
        steps.append("✓ README creado")
        
        return {
            "ok": True,
            "project_type": "html-static",
            "name": name,
            "path": name,
            "steps": steps,
            "next_steps": [
                f"Abre {name}/index.html en tu navegador"
            ]
        }
    
    def _generate_readme(self, project_type: str, name: str, commands: Dict) -> str:
        """Genera un README personalizado"""
        readme = f'''# {name}

Proyecto {project_type} creado con ARKAIOS Builder Mode

## Comandos

'''
        for cmd_name, cmd in commands.items():
            readme += f"**{cmd_name.title()}**: `{cmd}`\n\n"
        
        readme += f'''
## Información

- Creado: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
- Tipo: {project_type}
- Generado por: ARKAIOS AI

---

🚀 ¡Feliz desarrollo!
'''
        return readme
    
    def list_templates(self) -> Dict:
        """Lista los templates disponibles"""
        return {
            "ok": True,
            "templates": list(self.project_templates.keys()),
            "descriptions": {
                "react": "Aplicación React con create-react-app",
                "nextjs": "Aplicación Next.js con App Router",
                "vue": "Aplicación Vue 3",
                "python-api": "API REST con Flask o FastAPI",
                "express": "API REST con Express (Node.js)",
                "html-static": "Sitio web estático (HTML/CSS/JS)",
            }
        }


# Singleton instance
_builder_instance = None


def get_builder(workspace_root: str = None) -> BuilderMode:
    """Obtiene la instancia singleton del builder"""
    global _builder_instance
    if _builder_instance is None:
        _builder_instance = BuilderMode(workspace_root)
    return _builder_instance
