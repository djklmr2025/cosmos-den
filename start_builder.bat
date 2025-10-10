@echo off
echo ========================================
echo  ARKAIOS Builder Mode - Starting...
echo ========================================
echo.

REM Activar entorno virtual si existe
if exist .venv\Scripts\activate.bat (
    echo Activando entorno virtual...
    call .venv\Scripts\activate.bat
) else (
    echo ADVERTENCIA: No se encontro entorno virtual en .venv
    echo Ejecuta: python -m venv .venv
    echo          .venv\Scripts\activate.bat
    echo          pip install -r requirements.txt
    pause
    exit /b 1
)

REM Verificar que Flask este instalado
python -c "import flask" 2>nul
if errorlevel 1 (
    echo ERROR: Flask no esta instalado
    echo Ejecuta: pip install -r requirements.txt
    pause
    exit /b 1
)

echo.
echo Iniciando servidor ARKAIOS...
echo.
echo Servidor disponible en: http://localhost:5000
echo Interfaz Builder Mode: http://localhost:5000/arkaios_builder_ui.html
echo.
echo Presiona Ctrl+C para detener el servidor
echo.

python server_arkaios_new.py

pause
