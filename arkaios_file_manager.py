# arkaios_file_manager.py - Gestor de Archivos para ARKAIOS
"""
Sistema de gestión de archivos seguro con sandboxing
"""

import os
import json
import shutil
import logging
from pathlib import Path
from typing import List, Dict, Optional, Union
from datetime import datetime

logger = logging.getLogger("arkaios.file_manager")


class FileManager:
    """Gestor de archivos con seguridad y sandboxing con capacidades avanzadas de navegación"""
    
    def __init__(self, workspace_root: str = None):
        """
        Args:
            workspace_root: Directorio raíz permitido para operaciones
        """
        self.workspace_root = Path(workspace_root or os.getcwd()).resolve()
        
        # Directorios prohibidos (seguridad)
        self.forbidden_paths = [
            Path("/etc"),
            Path("/sys"),
            Path("/proc"),
            Path("C:\\Windows\\System32"),
            Path.home() / ".ssh",
            Path.home() / ".aws",
        ]
        
        # Extensiones permitidas por defecto
        self.allowed_extensions = {
            # Código
            ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", ".h", ".hpp", ".cs", ".go", ".rb", ".php",
            # Web
            ".html", ".css", ".scss", ".sass", ".less", ".svg", ".vue", ".jsx", ".tsx",
            # Config
            ".json", ".yaml", ".yml", ".toml", ".ini", ".env", ".gitignore", ".dockerignore", ".editorconfig",
            # Docs
            ".md", ".txt", ".rst", ".pdf", ".doc", ".docx",
            # Datos
            ".csv", ".xml", ".sql", ".db", ".sqlite",
            # Imágenes (para previsualización)
            ".jpg", ".jpeg", ".png", ".gif", ".ico",
        }
        
        # Historial de navegación
        self.navigation_history = []
        self.max_history = 50
        
        # Favoritos
        self.favorites = []
        
        logger.info(f"FileManager iniciado. Workspace: {self.workspace_root}")
    
    def _is_path_safe(self, path: Union[str, Path]) -> bool:
        """Verifica que una ruta sea segura"""
        try:
            resolved_path = Path(path).resolve()
            
            # Verificar que esté dentro del workspace
            if not str(resolved_path).startswith(str(self.workspace_root)):
                logger.warning(f"Ruta fuera del workspace: {resolved_path}")
                return False
            
            # Verificar que no esté en directorios prohibidos
            for forbidden in self.forbidden_paths:
                if str(resolved_path).startswith(str(forbidden)):
                    logger.warning(f"Ruta prohibida: {resolved_path}")
                    return False
            
            return True
        except Exception as e:
            logger.error(f"Error validando ruta: {e}")
            return False
    
    def list_files(self, directory: str = ".", recursive: bool = False, 
                   include_hidden: bool = False) -> Dict:
        """
        Lista archivos en un directorio
        
        Returns:
            {
                "ok": bool,
                "path": str,
                "files": [{"name": str, "type": str, "size": int, "modified": str}],
                "error": str (opcional)
            }
        """
        try:
            dir_path = self.workspace_root / directory
            
            if not self._is_path_safe(dir_path):
                return {"ok": False, "error": "Ruta no permitida"}
            
            if not dir_path.exists():
                return {"ok": False, "error": "Directorio no existe"}
            
            if not dir_path.is_dir():
                return {"ok": False, "error": "No es un directorio"}
            
            files = []
            
            if recursive:
                pattern = "**/*"
            else:
                pattern = "*"
            
            for item in dir_path.glob(pattern):
                # Omitir archivos ocultos si no se solicitan
                if not include_hidden and item.name.startswith("."):
                    continue
                
                # Omitir directorios node_modules, venv, etc
                if any(p in item.parts for p in ["node_modules", ".venv", "venv", "__pycache__"]):
                    continue
                
                try:
                    stat = item.stat()
                    files.append({
                        "name": item.name,
                        "path": str(item.relative_to(self.workspace_root)),
                        "type": "directory" if item.is_dir() else "file",
                        "size": stat.st_size if item.is_file() else 0,
                        "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    })
                except Exception as e:
                    logger.warning(f"Error obteniendo info de {item}: {e}")
            
            # Ordenar: directorios primero, luego alfabético
            files.sort(key=lambda x: (x["type"] == "file", x["name"].lower()))
            
            return {
                "ok": True,
                "path": str(dir_path.relative_to(self.workspace_root)),
                "files": files,
                "count": len(files),
            }
        
        except Exception as e:
            logger.error(f"Error listando archivos: {e}")
            return {"ok": False, "error": str(e)}
    
    def read_file(self, filepath: str, encoding: str = "utf-8") -> Dict:
        """
        Lee el contenido de un archivo
        
        Returns:
            {"ok": bool, "content": str, "size": int, "error": str}
        """
        try:
            file_path = self.workspace_root / filepath
            
            if not self._is_path_safe(file_path):
                return {"ok": False, "error": "Ruta no permitida"}
            
            if not file_path.exists():
                return {"ok": False, "error": "Archivo no existe"}
            
            if not file_path.is_file():
                return {"ok": False, "error": "No es un archivo"}
            
            # Verificar tamaño (limitar a 10MB)
            size = file_path.stat().st_size
            if size > 10 * 1024 * 1024:
                return {"ok": False, "error": "Archivo demasiado grande (>10MB)"}
            
            # Leer archivo
            with open(file_path, "r", encoding=encoding) as f:
                content = f.read()
            
            return {
                "ok": True,
                "content": content,
                "path": str(file_path.relative_to(self.workspace_root)),
                "size": size,
                "lines": len(content.splitlines()),
            }
        
        except UnicodeDecodeError:
            return {"ok": False, "error": "El archivo no es texto o tiene codificación diferente"}
        except Exception as e:
            logger.error(f"Error leyendo archivo: {e}")
            return {"ok": False, "error": str(e)}
    
    def create_file(self, filepath: str, content: str = "", 
                   overwrite: bool = False) -> Dict:
        """
        Crea un nuevo archivo
        
        Returns:
            {"ok": bool, "path": str, "error": str}
        """
        try:
            file_path = self.workspace_root / filepath
            
            if not self._is_path_safe(file_path):
                return {"ok": False, "error": "Ruta no permitida"}
            
            # Verificar extensión
            if file_path.suffix and file_path.suffix not in self.allowed_extensions:
                return {"ok": False, "error": f"Extensión {file_path.suffix} no permitida"}
            
            # Verificar si existe
            if file_path.exists() and not overwrite:
                return {"ok": False, "error": "Archivo ya existe (usar overwrite=True)"}
            
            # Crear directorios padres si no existen
            file_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Escribir archivo
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            
            logger.info(f"Archivo creado: {file_path}")
            
            return {
                "ok": True,
                "path": str(file_path.relative_to(self.workspace_root)),
                "size": len(content),
            }
        
        except Exception as e:
            logger.error(f"Error creando archivo: {e}")
            return {"ok": False, "error": str(e)}
    
    def update_file(self, filepath: str, content: str) -> Dict:
        """
        Actualiza el contenido de un archivo existente
        
        Returns:
            {"ok": bool, "path": str, "error": str}
        """
        try:
            file_path = self.workspace_root / filepath
            
            if not self._is_path_safe(file_path):
                return {"ok": False, "error": "Ruta no permitida"}
            
            if not file_path.exists():
                return {"ok": False, "error": "Archivo no existe"}
            
            if not file_path.is_file():
                return {"ok": False, "error": "No es un archivo"}
            
            # Hacer backup antes de actualizar
            backup_path = file_path.with_suffix(file_path.suffix + ".bak")
            shutil.copy2(file_path, backup_path)
            
            # Actualizar archivo
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            
            logger.info(f"Archivo actualizado: {file_path}")
            
            return {
                "ok": True,
                "path": str(file_path.relative_to(self.workspace_root)),
                "size": len(content),
                "backup": str(backup_path.relative_to(self.workspace_root)),
            }
        
        except Exception as e:
            logger.error(f"Error actualizando archivo: {e}")
            return {"ok": False, "error": str(e)}
    
    def delete_file(self, filepath: str, confirm: bool = False) -> Dict:
        """
        Elimina un archivo
        
        Args:
            confirm: Debe ser True para confirmar eliminación
        
        Returns:
            {"ok": bool, "path": str, "error": str}
        """
        if not confirm:
            return {"ok": False, "error": "Se requiere confirmación (confirm=True)"}
        
        try:
            file_path = self.workspace_root / filepath
            
            if not self._is_path_safe(file_path):
                return {"ok": False, "error": "Ruta no permitida"}
            
            if not file_path.exists():
                return {"ok": False, "error": "Archivo no existe"}
            
            # Hacer backup antes de eliminar
            backup_dir = self.workspace_root / ".arkaios_trash"
            backup_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_name = f"{file_path.stem}_{timestamp}{file_path.suffix}"
            backup_path = backup_dir / backup_name
            
            shutil.move(str(file_path), str(backup_path))
            
            logger.info(f"Archivo eliminado: {file_path} -> {backup_path}")
            
            return {
                "ok": True,
                "path": str(file_path.relative_to(self.workspace_root)),
                "backup": str(backup_path.relative_to(self.workspace_root)),
            }
        
        except Exception as e:
            logger.error(f"Error eliminando archivo: {e}")
            return {"ok": False, "error": str(e)}
    
    def create_directory(self, dirpath: str) -> Dict:
        """
        Crea un directorio
        
        Returns:
            {"ok": bool, "path": str, "error": str}
        """
        try:
            dir_path = self.workspace_root / dirpath
            
            if not self._is_path_safe(dir_path):
                return {"ok": False, "error": "Ruta no permitida"}
            
            dir_path.mkdir(parents=True, exist_ok=True)
            
            logger.info(f"Directorio creado: {dir_path}")
            
            return {
                "ok": True,
                "path": str(dir_path.relative_to(self.workspace_root)),
            }
        
        except Exception as e:
            logger.error(f"Error creando directorio: {e}")
            return {"ok": False, "error": str(e)}
    
    def search_files(self, pattern: str, directory: str = ".", 
                    content_search: bool = False) -> Dict:
        """
        Busca archivos por nombre o contenido
        
        Args:
            pattern: Patrón de búsqueda (glob para nombre, regex para contenido)
            directory: Directorio donde buscar
            content_search: Si True, busca en el contenido de los archivos
        
        Returns:
            {"ok": bool, "results": [{"path": str, "matches": [...]}], "error": str}
        """
        try:
            dir_path = self.workspace_root / directory
            
            if not self._is_path_safe(dir_path):
                return {"ok": False, "error": "Ruta no permitida"}
            
            results = []
            
            if content_search:
                # Búsqueda en contenido
                import re
                regex = re.compile(pattern, re.IGNORECASE)
                
                for file_path in dir_path.rglob("*"):
                    if not file_path.is_file():
                        continue
                    
                    if file_path.suffix not in self.allowed_extensions:
                        continue
                    
                    try:
                        with open(file_path, "r", encoding="utf-8") as f:
                            content = f.read()
                            matches = regex.findall(content)
                            if matches:
                                results.append({
                                    "path": str(file_path.relative_to(self.workspace_root)),
                                    "matches": list(set(matches))[:10],  # Limitar a 10 matches
                                })
                    except:
                        continue
            else:
                # Búsqueda por nombre
                for file_path in dir_path.rglob(pattern):
                    results.append({
                        "path": str(file_path.relative_to(self.workspace_root)),
                        "type": "directory" if file_path.is_dir() else "file",
                    })
            
            return {
                "ok": True,
                "pattern": pattern,
                "results": results,
                "count": len(results),
            }
        
        except Exception as e:
            logger.error(f"Error buscando archivos: {e}")
            return {"ok": False, "error": str(e)}
    
    def get_file_info(self, filepath: str) -> Dict:
        """
        Obtiene información detallada de un archivo
        
        Returns:
            {"ok": bool, "info": {...}, "error": str}
        """
        try:
            file_path = self.workspace_root / filepath
            
            if not self._is_path_safe(file_path):
                return {"ok": False, "error": "Ruta no permitida"}
            
            if not file_path.exists():
                return {"ok": False, "error": "Archivo no existe"}
            
            stat = file_path.stat()
            
            info = {
                "name": file_path.name,
                "path": str(file_path.relative_to(self.workspace_root)),
                "type": "directory" if file_path.is_dir() else "file",
                "size": stat.st_size,
                "size_human": self._human_size(stat.st_size),
                "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                "extension": file_path.suffix,
            }
            
            if file_path.is_file() and file_path.suffix in self.allowed_extensions:
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        content = f.read()
                        info["lines"] = len(content.splitlines())
                        info["characters"] = len(content)
                except:
                    pass
            
            return {"ok": True, "info": info}
        
        except Exception as e:
            logger.error(f"Error obteniendo info de archivo: {e}")
            return {"ok": False, "error": str(e)}
    
    @staticmethod
    def _human_size(bytes: int) -> str:
        """Convierte bytes a formato legible"""
        for unit in ["B", "KB", "MB", "GB"]:
            if bytes < 1024.0:
                return f"{bytes:.1f} {unit}"
            bytes /= 1024.0
        return f"{bytes:.1f} TB"
        
    def add_to_history(self, path: str) -> None:
        """Añade una ruta al historial de navegación"""
        rel_path = str(Path(path).relative_to(self.workspace_root))
        if rel_path in self.navigation_history:
            self.navigation_history.remove(rel_path)
        self.navigation_history.insert(0, rel_path)
        if len(self.navigation_history) > self.max_history:
            self.navigation_history.pop()
    
    def get_navigation_history(self) -> List[str]:
        """Obtiene el historial de navegación"""
        return self.navigation_history
    
    def add_to_favorites(self, path: str) -> Dict:
        """Añade una ruta a favoritos"""
        try:
            file_path = self.workspace_root / path
            
            if not self._is_path_safe(file_path):
                return {"ok": False, "error": "Ruta no permitida"}
            
            if not file_path.exists():
                return {"ok": False, "error": "Ruta no existe"}
            
            rel_path = str(Path(path).relative_to(self.workspace_root))
            if rel_path not in self.favorites:
                self.favorites.append(rel_path)
            
            return {"ok": True, "favorites": self.favorites}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    
    def remove_from_favorites(self, path: str) -> Dict:
        """Elimina una ruta de favoritos"""
        try:
            rel_path = str(Path(path).relative_to(self.workspace_root))
            if rel_path in self.favorites:
                self.favorites.remove(rel_path)
            
            return {"ok": True, "favorites": self.favorites}
        except Exception as e:
            return {"ok": False, "error": str(e)}
    
    def get_favorites(self) -> List[str]:
        """Obtiene la lista de favoritos"""
        return self.favorites
        
    def watch_file(self, filepath: str) -> Dict:
        """
        Prepara un archivo para ser observado en tiempo real
        
        Returns:
            {"ok": bool, "path": str, "error": str}
        """
        try:
            file_path = self.workspace_root / filepath
            
            if not self._is_path_safe(file_path):
                return {"ok": False, "error": "Ruta no permitida"}
            
            if not file_path.exists():
                return {"ok": False, "error": "Archivo no existe"}
            
            if not file_path.is_file():
                return {"ok": False, "error": "No es un archivo"}
            
            # Añadir a historial
            self.add_to_history(filepath)
            
            return {
                "ok": True,
                "path": str(file_path.relative_to(self.workspace_root)),
                "ready_for_watch": True
            }
        except Exception as e:
            logger.error(f"Error preparando archivo para observar: {e}")
            return {"ok": False, "error": str(e)}
            
    def get_file_tree(self, directory: str = ".", max_depth: int = 3) -> Dict:
        """
        Obtiene la estructura de directorios en formato árbol
        
        Returns:
            {"ok": bool, "tree": {...}, "error": str}
        """
        try:
            dir_path = self.workspace_root / directory
            
            if not self._is_path_safe(dir_path):
                return {"ok": False, "error": "Ruta no permitida"}
            
            if not dir_path.exists():
                return {"ok": False, "error": "Directorio no existe"}
            
            if not dir_path.is_dir():
                return {"ok": False, "error": "No es un directorio"}
            
            def build_tree(path, current_depth=0):
                if current_depth > max_depth:
                    return {"name": path.name, "type": "directory", "children": [{"name": "...", "type": "more"}]}
                
                result = {
                    "name": path.name,
                    "path": str(path.relative_to(self.workspace_root)),
                    "type": "directory",
                    "children": []
                }
                
                try:
                    items = sorted(list(path.iterdir()), key=lambda p: (p.is_file(), p.name.lower()))
                    for item in items:
                        # Omitir ocultos y directorios especiales
                        if item.name.startswith(".") or item.name in ["node_modules", "__pycache__", "venv", ".venv"]:
                            continue
                        
                        if item.is_dir():
                            result["children"].append(build_tree(item, current_depth + 1))
                        else:
                            result["children"].append({
                                "name": item.name,
                                "path": str(item.relative_to(self.workspace_root)),
                                "type": "file",
                                "extension": item.suffix
                            })
                except Exception as e:
                    logger.warning(f"Error accediendo a {path}: {e}")
                
                return result
            
            tree = build_tree(dir_path)
            
            # Añadir a historial
            self.add_to_history(directory)
            
            return {"ok": True, "tree": tree}
        
        except Exception as e:
            logger.error(f"Error obteniendo árbol de directorios: {e}")
            return {"ok": False, "error": str(e)}


# Singleton instance
_file_manager_instance = None


def get_file_manager(workspace_root: str = None) -> FileManager:
    """Obtiene la instancia singleton del file manager"""
    global _file_manager_instance
    if _file_manager_instance is None:
        _file_manager_instance = FileManager(workspace_root)
    return _file_manager_instance
