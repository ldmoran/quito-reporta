@echo off
rem ---------------------------------------------------------------------------
rem  ALERTA QUITO - APAGAR EL SISTEMA (doble clic)
rem  Detiene los contenedores y CONSERVA los datos (usuarios, reportes, fotos).
rem  Para borrar tambien los datos use reiniciar-bases.bat.
rem  Uso por consola:  detener.bat auto   (sin pausa)
rem ---------------------------------------------------------------------------
cd /d "%~dp0"
echo.
echo === ALERTA QUITO: apagando el sistema ===
echo.
docker compose stop
echo.
echo Sistema apagado. Sus datos se conservaron: al encenderlo de nuevo todo sigue ahi.
echo (Si quiere liberar memoria, tambien puede cerrar Docker Desktop.)
echo.
if not "%1"=="auto" pause
