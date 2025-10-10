# arkaios_ai_brain_real.py - AI Brain con conexión REAL a LLM
"""
Versión mejorada que conecta con:
1. Gateway A.I.D.A. (tu gateway existente)
2. OpenAI (si tienes API key)
3. Fallback a pattern matching local
"""

import json
import logging
import os
import re
import requests
from typing import Dict, List, Optional, Tuple
from datetime import datetime

logger = logging.getLogger("arkaios.ai_brain_real")


class AIBrainReal:
    """Cerebro de IA con conexión real a LLMs"""
    
    def __init__(self):
        # Configuración de LLM providers
        self.aida_gateway = os.getenv(
            "AIDA_GATEWAY", 
            "https://arkaios-gateway-open.onrender.com/aida/gateway"
        )
        self.aida_key = os.getenv(
            "AIDA_KEY",
            "KaOQ1ZQ4gyF5bkgxkiwPEFgkrUMW31ZEwVhOITkLRO5jaImetmUlYJegOdwG"
        )
        
        self.openai_key = os.getenv("OPENAI_API_KEY", None)
        
        self.conversation_history = []
        self.context = {
            "current_directory": os.getcwd(),
            "last_files_created": [],
            "last_commands_executed": [],
        }
        
        # Sistema de prompts para el LLM
        self.system_prompt = """Eres ARKAIOS, un asistente de IA avanzado para desarrollo de software.

Capacidades:
- Crear, editar y gestionar archivos y código
- Ejecutar comandos de terminal (npm, git, python)
- Crear proyectos completos (React, Next.js, Python APIs, etc.)
- Instalar paquetes y dependencias
- Hacer commits git
- Analizar y explicar código

Cuando el usuario te pide algo, debes responder en formato JSON con:
{
    "action": "tipo_de_accion",
    "params": {"parametros": "necesarios"},
    "response": "tu respuesta amigable al usuario",
    "needs_confirmation": true/false
}

Acciones disponibles:
- "file_create": Crear archivo {path, content}
- "file_edit": Editar archivo {path, content}
- "file_read": Leer archivo {path}
- "file_delete": Eliminar archivo {path}
- "file_list": Listar archivos {path}
- "code_execute": Ejecutar código {command, args, cwd}
- "project_scaffold": Crear proyecto {type, name, options}
- "package_install": Instalar paquete {package, manager}
- "git_execute": Comando git {command}
- "conversational": Solo conversación {ninguno}

Ejemplos:

Usuario: "Crea un proyecto React llamado mi-app"
Respuesta JSON:
{
    "action": "project_scaffold",
    "params": {"type": "react", "name": "mi-app", "options": {}},
    "response": "Voy a crear un proyecto React llamado 'mi-app' usando create-react-app. Esto puede tardar unos minutos.",
    "needs_confirmation": true
}

Usuario: "Crea un archivo test.py que imprima hola"
Respuesta JSON:
{
    "action": "file_create",
    "params": {"path": "test.py", "content": "print('Hola mundo!')"},
    "response": "He creado el archivo test.py con un print de 'Hola mundo!'",
    "needs_confirmation": false
}

Usuario: "Explícame qué es React"
Respuesta JSON:
{
    "action": "conversational",
    "params": {},
    "response": "React es una biblioteca de JavaScript...",
    "needs_confirmation": false
}

Siempre responde en español y sé amigable pero conciso."""

        logger.info("AIBrainReal iniciado")
    
    def process_message(self, user_message: str, user_context: Dict = None) -> Dict:
        """
        Procesa un mensaje usando LLM real o fallback
        """
        logger.info(f"Procesando mensaje: {user_message}")
        
        # Actualizar contexto
        if user_context:
            self.context.update(user_context)
        
        # Agregar a historial
        self.conversation_history.append({
            "role": "user",
            "content": user_message,
            "timestamp": datetime.now().isoformat()
        })
        
        # Intentar con diferentes providers en orden
        result = None
        
        # 1. Intentar con OpenAI (si hay API key)
        if self.openai_key:
            result = self._query_openai(user_message)
            if result:
                logger.info("Respuesta de OpenAI obtenida")
        
        # 2. Intentar con A.I.D.A. Gateway
        if not result:
            result = self._query_aida(user_message)
            if result:
                logger.info("Respuesta de A.I.D.A. obtenida")
        
        # 3. Fallback a pattern matching local
        if not result:
            logger.info("Usando fallback local")
            result = self._local_fallback(user_message)
        
        # Agregar respuesta al historial
        self.conversation_history.append({
            "role": "assistant",
            "content": result.get("response", ""),
            "timestamp": datetime.now().isoformat()
        })
        
        return result
    
    def _query_openai(self, message: str) -> Optional[Dict]:
        """Query a OpenAI GPT-4"""
        if not self.openai_key:
            return None
        
        try:
            # Construir mensajes
            messages = [
                {"role": "system", "content": self.system_prompt}
            ]
            
            # Agregar historial reciente (últimos 5 mensajes)
            recent_history = self.conversation_history[-5:] if len(self.conversation_history) > 0 else []
            for msg in recent_history:
                messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
            
            messages.append({"role": "user", "content": message})
            
            # Llamar a OpenAI
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openai_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4",
                    "messages": messages,
                    "temperature": 0.7,
                    "max_tokens": 1000
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"]
                
                # Parsear JSON de la respuesta
                try:
                    # Buscar JSON en la respuesta
                    json_match = re.search(r'\{.*\}', content, re.DOTALL)
                    if json_match:
                        result = json.loads(json_match.group())
                        result["ok"] = True
                        result["provider"] = "openai"
                        return result
                except json.JSONDecodeError:
                    pass
                
                # Si no hay JSON, respuesta conversacional
                return {
                    "ok": True,
                    "action": "conversational",
                    "params": {},
                    "response": content,
                    "needs_confirmation": False,
                    "provider": "openai"
                }
            
        except Exception as e:
            logger.error(f"Error con OpenAI: {e}")
        
        return None
    
    def _query_aida(self, message: str) -> Optional[Dict]:
        """Query al Gateway A.I.D.A."""
        try:
            # Detectar si es una tarea que necesita delegación
            keywords_heavy = [
                'crear', 'proyecto', 'instalar', 'ejecutar', 'archivo', 
                'código', 'deploy', 'git', 'npm', 'python'
            ]
            
            is_heavy_task = any(kw in message.lower() for kw in keywords_heavy)
            
            # Preparar request para A.I.D.A.
            payload = {
                "agent_id": "arkaios_builder",
                "action": "plan" if is_heavy_task else "explain",
                "params": {
                    "objective": message,
                    "context": {
                        "workspace": self.context.get("current_directory", ""),
                        "recent_files": self.context.get("last_files_created", [])
                    }
                }
            }
            
            headers = {
                "Content-Type": "application/json"
            }
            
            # Agregar Authorization solo si hay key
            if self.aida_key and self.aida_key != "demo":
                headers["Authorization"] = f"Bearer {self.aida_key}"
            
            response = requests.post(
                self.aida_gateway,
                headers=headers,
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                
                # Parsear respuesta de A.I.D.A.
                aida_response = data.get("output") or data.get("result") or str(data)
                
                # Intentar convertir respuesta en estructura de acción
                action_result = self._parse_aida_response(message, aida_response)
                action_result["provider"] = "aida"
                
                return action_result
            
        except Exception as e:
            logger.error(f"Error con A.I.D.A.: {e}")
        
        return None
    
    def _parse_aida_response(self, user_message: str, aida_response: str) -> Dict:
        """Convierte respuesta de A.I.D.A. en estructura de acción"""
        
        # Intentar detectar intención del mensaje original
        msg_lower = user_message.lower()
        
        # Crear proyecto
        if any(word in msg_lower for word in ['crea proyecto', 'crear proyecto', 'nuevo proyecto']):
            project_type = "react"
            if "react" in msg_lower:
                project_type = "react"
            elif "next" in msg_lower:
                project_type = "nextjs"
            elif "vue" in msg_lower:
                project_type = "vue"
            elif "python" in msg_lower or "api" in msg_lower:
                project_type = "python-api"
            elif "express" in msg_lower:
                project_type = "express"
            elif "html" in msg_lower:
                project_type = "html-static"
            
            # Extraer nombre
            name_match = re.search(r'llamado\s+(\w+)|named\s+(\w+)|"([^"]+)"|\'([^\']+)\'', msg_lower)
            project_name = "mi-proyecto"
            if name_match:
                project_name = [g for g in name_match.groups() if g][0]
            
            return {
                "ok": True,
                "intent": "create_project",
                "action": "project_scaffold",
                "params": {
                    "type": project_type,
                    "name": project_name,
                    "options": {}
                },
                "response": f"Según A.I.D.A., voy a crear un proyecto {project_type} llamado '{project_name}'.\n\n{aida_response}",
                "needs_confirmation": True
            }
        
        # Crear archivo
        elif any(word in msg_lower for word in ['crea archivo', 'crear archivo', 'nuevo archivo']):
            # Extraer nombre de archivo
            file_match = re.search(r'archivo\s+([^\s]+)|file\s+([^\s]+)', msg_lower)
            filename = "nuevo_archivo.txt"
            if file_match:
                filename = [g for g in file_match.groups() if g][0]
            
            return {
                "ok": True,
                "intent": "create_file",
                "action": "file_create",
                "params": {
                    "path": filename,
                    "content": ""
                },
                "response": f"A.I.D.A. sugiere crear el archivo '{filename}'.\n\n{aida_response}",
                "needs_confirmation": False
            }
        
        # Instalar paquete
        elif "instala" in msg_lower or "install" in msg_lower:
            packages = []
            for word in user_message.split():
                if not word.lower() in ['instala', 'install', 'el', 'paquete', 'los', 'paquetes']:
                    if len(word) > 2:
                        packages.append(word)
            
            return {
                "ok": True,
                "intent": "install_package",
                "action": "package_install",
                "params": {
                    "package": packages,
                    "manager": "npm"
                },
                "response": f"A.I.D.A. recomienda instalar: {', '.join(packages)}.\n\n{aida_response}",
                "needs_confirmation": True
            }
        
        # Git
        elif "git" in msg_lower:
            git_cmd = user_message.replace("git", "").strip()
            return {
                "ok": True,
                "intent": "git_command",
                "action": "git_execute",
                "params": {
                    "command": git_cmd
                },
                "response": f"A.I.D.A. sugiere ejecutar: git {git_cmd}\n\n{aida_response}",
                "needs_confirmation": True
            }
        
        # Respuesta conversacional
        else:
            return {
                "ok": True,
                "intent": "conversational",
                "action": "conversational",
                "params": {},
                "response": f"A.I.D.A. responde:\n\n{aida_response}",
                "needs_confirmation": False
            }
    
    def _local_fallback(self, message: str) -> Dict:
        """Fallback local usando pattern matching"""
        from arkaios_ai_brain import AIBrain
        
        local_brain = AIBrain()
        result = local_brain.process_message(message, self.context)
        result["provider"] = "local_fallback"
        
        return result
    
    def get_context(self) -> Dict:
        """Obtiene el contexto actual"""
        return self.context.copy()
    
    def update_context(self, updates: Dict):
        """Actualiza el contexto"""
        self.context.update(updates)
    
    def get_history(self, limit: int = 10) -> List[Dict]:
        """Obtiene el historial de conversación"""
        return self.conversation_history[-limit:]
    
    def clear_history(self):
        """Limpia el historial"""
        self.conversation_history = []


# Singleton instance
_brain_real_instance = None


def get_ai_brain_real() -> AIBrainReal:
    """Obtiene la instancia singleton del cerebro IA real"""
    global _brain_real_instance
    if _brain_real_instance is None:
        _brain_real_instance = AIBrainReal()
    return _brain_real_instance
