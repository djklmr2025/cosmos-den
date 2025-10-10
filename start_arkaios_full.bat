@echo off
echo ========================================
echo  ARKAIOS FULL - Servidor Principal + MCP
echo ========================================
echo.

REM Verificar entorno virtual
if not exist .venv\Scripts\python.exe (
    echo ERROR: No se encontro entorno virtual
    echo Ejecuta: python -m venv .venv
    pause
    exit /b 1
)

echo [1/2] Iniciando servidor principal ARKAIOS (puerto 5000)...
start "ARKAIOS Main Server" cmd /k ".venv\Scripts\python.exe server_arkaios_new.py"

timeout /t 3 >nul

echo [2/2] Iniciando servidor MCP para CICI (puerto 5001)...
start "ARKAIOS MCP Server" cmd /k ".venv\Scripts\python.exe arkaios_mcp_server.py"

timeout /t 2 >nul

echo.
echo ========================================
echo  SERVIDORES INICIADOS
echo ========================================
echo.
echo [✓] Servidor Principal: http://localhost:5000
echo     - Interfaz Web: http://localhost:5000/arkaios_builder_ui.html
echo     - API REST: http://localhost:5000/api/*
echo.
echo [✓] Servidor MCP: http://localhost:5001
echo     - Tools List: http://localhost:5001/mcp/tools
echo     - Para CICI: Configurar con cici_tools_config.json
echo.
echo ========================================
echo.
echo Presiona una tecla para abrir la interfaz web...
pause >nul

start http://localhost:5000/arkaios_builder_ui.html

echo.
echo ========================================
echo  INSTRUCCIONES PARA CICI
echo ========================================
echo.
echo 1. Si CICI soporta MCP:
echo    - Importar: cici_tools_config.json
echo    - Server URL: http://localhost:5001
echo.
echo 2. Si CICI usa API REST:
echo    - Base URL: http://localhost:5000/api
echo    - Ver documentacion: README_IA_REAL.md
echo.
echo 3. Si CICI es extensión de navegador:
echo    - Ver: cici_integration.md
echo.
echo ========================================
echo.
echo Servidores corriendo...
echo Cierra esta ventana para detener ambos servidores
echo.
pause
