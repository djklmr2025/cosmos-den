# arkaios_executor.py - Ejecutor de comandos para ARKAIOS
"""
Sistema seguro de ejecución de comandos con sandboxing y timeout
"""

import os
import subprocess
import logging
import threading
from typing import Dict, List, Optional
from pathlib import Path
from datetime import datetime

logger = logging.getLogger("arkaios.executor")


class CommandExecutor:
    """Ejecutor de comandos con seguridad y control"""
    
    def __init__(self, workspace_root: str = None, timeout: int = 300):
        """
        Args:
            workspace_root: Directorio donde ejecutar comandos
            timeout: Timeout en segundos para comandos
        """
        self.workspace_root = Path(workspace_root or os.getcwd()).resolve()
        self.default_timeout = timeout
        self.execution_history = []
        
        # Comandos permitidos (whitelist)
        self.allowed_commands = {
            # Node/npm
            "npm": ["install", "run", "start", "build", "test", "init", "-v", "--version"],
            "npx": ["create-react-app", "create-next-app", "@vue/cli", "degit", "create-vue", "vite"],
            "node": ["-v", "--version", "-e"],
            
            # Python
            "python": ["-m", "-c", "-V", "--version", "manage.py", "venv"],
            "pip": ["install", "list", "show", "freeze"],
            
            # Git
            "git": ["init", "add", "commit", "push", "pull", "status", "log", "clone", "branch", "--version", "checkout"],
            
            # Firebase
            "firebase": ["init", "deploy", "serve", "login", "logout", "emulators:start"],
            
            # Otros
            "ls": [],
            "dir": [],
            "pwd": [],
            "cd": [],
            "cat": [],
            "type": [],
            "find": [],
            "grep": [],
            "findstr": [],
            "code": [],
            "explorer": []
        }
        
        # Comandos bloqueados (blacklist)
        self.forbidden_commands = [
            "rm", "del", "rmdir", "format", "shutdown", "reboot",
            "dd", "mkfs", "fdisk", "kill", "killall",
        ]
        
        # Máximo historial
        self.max_history = 50
        
        logger.info(f"CommandExecutor iniciado. Workspace: {self.workspace_root}")
    
    def _is_command_allowed(self, command: str, args: List[str]) -> tuple[bool, str]:
        """
        Verifica si un comando está permitido
        
        Returns:
            (permitido, razón)
        """
        # Verificar blacklist
        if command in self.forbidden_commands:
            return False, f"Comando '{command}' está prohibido por seguridad"
        
        # Verificar whitelist
        if command not in self.allowed_commands:
            return False, f"Comando '{command}' no está en la whitelist"
        
        # Verificar argumentos si hay restricciones
        allowed_args = self.allowed_commands[command]
        if allowed_args:
            # Al menos un argumento debe estar en la whitelist
            if not args:
                return False, f"Comando '{command}' requiere argumentos específicos"
            
            first_arg = args[0] if args else ""
            if first_arg not in allowed_args and not any(allowed in first_arg for allowed in allowed_args):
                return False, f"Argumento '{first_arg}' no permitido para '{command}'"
        
        return True, "OK"
    
    def execute_command(self, command: str, args: List[str] = None,
                       cwd: str = None, timeout: int = None,
                       env: Dict[str, str] = None) -> Dict:
        """
        Ejecuta un comando de forma segura
        
        Args:
            command: Comando a ejecutar
            args: Lista de argumentos
            cwd: Directorio de trabajo (relativo al workspace)
            timeout: Timeout en segundos
            env: Variables de entorno adicionales
        
        Returns:
            {
                "ok": bool,
                "command": str,
                "stdout": str,
                "stderr": str,
                "return_code": int,
                "duration": float,
                "error": str
            }
        """
        args = args or []
        timeout = timeout or self.default_timeout
        
        # Validar comando
        allowed, reason = self._is_command_allowed(command, args)
        if not allowed:
            logger.warning(f"Comando rechazado: {command} {args}. Razón: {reason}")
            return {
                "ok": False,
                "command": f"{command} {' '.join(args)}",
                "error": reason,
            }
        
        # Preparar directorio de trabajo
        if cwd:
            work_dir = self.workspace_root / cwd
        else:
            work_dir = self.workspace_root
        
        if not work_dir.exists():
            return {
                "ok": False,
                "command": f"{command} {' '.join(args)}",
                "error": f"Directorio no existe: {cwd}",
            }
        
        # Preparar ambiente
        exec_env = os.environ.copy()
        if env:
            exec_env.update(env)
        
        # Construir comando completo
        full_command = [command] + args
        
        start_time = datetime.now()
        
        try:
            logger.info(f"Ejecutando: {' '.join(full_command)} en {work_dir}")
            
            # Ejecutar proceso
            process = subprocess.Popen(
                full_command,
                cwd=str(work_dir),
                env=exec_env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                shell=False,  # Importante: no usar shell para seguridad
            )
            
            # Esperar con timeout
            try:
                stdout, stderr = process.communicate(timeout=timeout)
                return_code = process.returncode
            except subprocess.TimeoutExpired:
                process.kill()
                stdout, stderr = process.communicate()
                logger.warning(f"Comando excedió timeout de {timeout}s")
                return {
                    "ok": False,
                    "command": ' '.join(full_command),
                    "stdout": stdout,
                    "stderr": stderr,
                    "error": f"Timeout de {timeout} segundos excedido",
                    "duration": timeout,
                }
            
            duration = (datetime.now() - start_time).total_seconds()
            
            # Registrar en historial
            execution_record = {
                "command": ' '.join(full_command),
                "cwd": str(work_dir.relative_to(self.workspace_root)),
                "return_code": return_code,
                "duration": duration,
                "timestamp": start_time.isoformat(),
                "success": return_code == 0,
            }
            self.execution_history.append(execution_record)
            
            logger.info(f"Comando completado. Código: {return_code}, Duración: {duration:.2f}s")
            
            return {
                "ok": return_code == 0,
                "command": ' '.join(full_command),
                "stdout": stdout,
                "stderr": stderr,
                "return_code": return_code,
                "duration": duration,
            }
        
        except FileNotFoundError:
            return {
                "ok": False,
                "command": ' '.join(full_command),
                "error": f"Comando '{command}' no encontrado. ¿Está instalado?",
            }
        except Exception as e:
            logger.error(f"Error ejecutando comando: {e}")
            return {
                "ok": False,
                "command": ' '.join(full_command),
                "error": str(e),
            }
    
    def execute_shell_script(self, script: str, cwd: str = None, 
                            timeout: int = None) -> Dict:
        """
        Ejecuta un script de shell
        
        Args:
            script: Script a ejecutar
            cwd: Directorio de trabajo
            timeout: Timeout en segundos
        
        Returns:
            Similar a execute_command
        """
        # Por seguridad, no permitir scripts arbitrarios por ahora
        return {
            "ok": False,
            "error": "Ejecución de scripts arbitrarios deshabilitada por seguridad"
        }
    
    def execute_python_code(self, code: str, cwd: str = None, 
                           timeout: int = None) -> Dict:
        """
        Ejecuta código Python
        
        Args:
            code: Código Python a ejecutar
            cwd: Directorio de trabajo
            timeout: Timeout en segundos
        
        Returns:
            Similar a execute_command
        """
        return self.execute_command(
            "python",
            ["-c", code],
            cwd=cwd,
            timeout=timeout
        )
    
    def execute_node_script(self, script: str, cwd: str = None,
                           timeout: int = None) -> Dict:
        """
        Ejecuta código Node.js
        
        Args:
            script: Código JavaScript a ejecutar
            cwd: Directorio de trabajo
            timeout: Timeout en segundos
        
        Returns:
            Similar a execute_command
        """
        return self.execute_command(
            "node",
            ["-e", script],
            cwd=cwd,
            timeout=timeout
        )
    
    def npm_install(self, packages: List[str] = None, cwd: str = None,
                   dev: bool = False, timeout: int = None) -> Dict:
        """
        Instala paquetes npm
        
        Args:
            packages: Lista de paquetes a instalar (None para install sin args)
            cwd: Directorio del proyecto
            dev: Si True, instala como devDependencies
            timeout: Timeout en segundos
        
        Returns:
            Similar a execute_command
        """
        args = ["install"]
        
        if dev:
            args.append("--save-dev")
        
        if packages:
            args.extend(packages)
        
        return self.execute_command("npm", args, cwd=cwd, timeout=timeout or 600)
    
    def git_command(self, git_args: List[str], cwd: str = None,
                   timeout: int = None) -> Dict:
        """
        Ejecuta comando Git
        
        Args:
            git_args: Argumentos para git
            cwd: Directorio del repositorio
            timeout: Timeout en segundos
        
        Returns:
            Similar a execute_command
        """
        return self.execute_command("git", git_args, cwd=cwd, timeout=timeout)
    
    def git_init(self, cwd: str = None) -> Dict:
        """Inicializa un repositorio Git"""
        return self.git_command(["init"], cwd=cwd)
    
    def git_add(self, files: List[str] = None, cwd: str = None) -> Dict:
        """Agrega archivos al stage"""
        files = files or ["."]
        return self.git_command(["add"] + files, cwd=cwd)
    
    def git_commit(self, message: str, cwd: str = None) -> Dict:
        """Hace commit de cambios"""
        return self.git_command(["commit", "-m", message], cwd=cwd)
    
    def git_push(self, cwd: str = None) -> Dict:
        """Push de cambios al remote"""
        return self.git_command(["push"], cwd=cwd)
    
    def check_tool_installed(self, tool: str) -> Dict:
        """
        Verifica si una herramienta está instalada
        
        Returns:
            {
                "ok": bool,
                "tool": str,
                "installed": bool,
                "version": str (opcional),
                "error": str (opcional)
            }
        """
        version_args = {
            "npm": ["--version"],
            "node": ["--version"],
            "python": ["--version"],
            "git": ["--version"],
            "firebase": ["--version"],
        }
        
        args = version_args.get(tool, ["--version"])
        
        result = self.execute_command(tool, args, timeout=5)
        
        if result["ok"]:
            version = result["stdout"].strip()
            return {
                "ok": True,
                "tool": tool,
                "installed": True,
                "version": version,
            }
        else:
            return {
                "ok": True,
                "tool": tool,
                "installed": False,
                "error": f"{tool} no está instalado o no está en PATH",
            }
    
    def get_history(self, limit: int = 10) -> List[Dict]:
        """Obtiene el historial de ejecuciones"""
        return self.execution_history[-limit:]
    
    def clear_history(self):
        """Limpia el historial"""
        self.execution_history = []


# Singleton instance
_executor_instance = None


def get_executor(workspace_root: str = None) -> CommandExecutor:
    """Obtiene la instancia singleton del executor"""
    global _executor_instance
    if _executor_instance is None:
        _executor_instance = CommandExecutor(workspace_root)
    return _executor_instance
