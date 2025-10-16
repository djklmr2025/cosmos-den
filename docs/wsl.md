WSL en Windows: qué es y cómo habilitarlo

- WSL (Windows Subsystem for Linux) permite ejecutar una distribución Linux (ej. Ubuntu) dentro de Windows, con integración de sistema de archivos y terminal Bash.
- En ARKAIOS, la Terminal del Laboratorio puede usar `WSL` como shell si está instalado, ofreciendo comandos Linux (bash, apt, python, etc.) además de PowerShell.

Cómo instalar WSL (Windows 10/11)

1) Abre PowerShell como Administrador.
2) Ejecuta: `wsl --install`
   - Esto instala WSL y descarga Ubuntu por defecto. Reinicia si te lo pide.
3) Configura tu usuario Linux al abrir Ubuntu por primera vez.
4) Verifica: `wsl -l -v` debe listar la distro instalada.

Opciones útiles

- Instalar otra distro: `wsl --install -d Ubuntu-22.04`
- Actualizar WSL: `wsl --update`
- Abrir shell Linux: en la Terminal del Laboratorio selecciona `WSL (Ubuntu/Bash)` y conecta.

Notas

- El workspace de ARKAIOS (carpeta `data/workspace`) es accesible desde WSL montado bajo `/mnt/c/...` según tu ruta.
- Si necesitas privilegios de root: selecciona `WSL (root)` si está disponible o usa `sudo` dentro de la sesión.