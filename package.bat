@echo off
echo Empaquetando aplicación...
cd /d "C:\Users\djklm\Desktop\ARKAIOS"
pnpm run build
xcopy "dist" "ARKAIOS-Package\dist" /E /I /Y
copy "package.json" "ARKAIOS-Package\" /Y
echo ¡Paquete listo en ARKAIOS-Package!
pause