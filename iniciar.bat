@echo off
rem ---------------------------------------------------------------------------
rem  ALERTA QUITO - ENCENDER EL SISTEMA (doble clic)
rem  Abre Docker Desktop si hace falta, levanta las bases, el servicio, la web y
rem  el buzon de pruebas, y abre el navegador. La primera vez tarda varios minutos
rem  porque compila todo; las siguientes son mucho mas rapidas.
rem  Uso por consola:  iniciar.bat auto   (sin pausas ni navegador)
rem ---------------------------------------------------------------------------
cd /d "%~dp0"
echo.
echo === ALERTA QUITO: encendiendo el sistema ===
echo.

docker info >nul 2>&1
if not errorlevel 1 goto docker_listo

echo Docker Desktop no esta abierto. Abriendolo...
if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
) else (
    echo No encuentro Docker Desktop. Instalelo desde https://www.docker.com/products/docker-desktop
    if not "%1"=="auto" pause
    exit /b 1
)
echo Esperando a que Docker este listo (puede tardar un minuto)...
:esperar_docker
timeout /t 5 /nobreak >nul
docker info >nul 2>&1
if errorlevel 1 goto esperar_docker

:docker_listo
echo Docker listo. Levantando el sistema...
echo.
docker compose up -d --build --wait --wait-timeout 600
if errorlevel 1 (
    echo.
    echo *** ALGO FALLO al levantar el sistema. Revise los mensajes de arriba. ***
    echo Para ver el detalle:  docker compose logs servicio
    if not "%1"=="auto" pause
    exit /b 1
)

echo.
echo ===========================================================
echo   Sistema encendido
echo     La aplicacion ......... http://localhost:4200
echo     Correos de prueba ..... http://localhost:8025
echo     DBeaver - negocio ..... localhost:5432  (alerta_quito)
echo     DBeaver - seguridad ... localhost:5433  (alerta_quito_seguridad)
echo     Usuario/clave de las bases: postgres / postgres
echo ===========================================================
echo.
if "%1"=="auto" exit /b 0
start "" http://localhost:4200
pause
