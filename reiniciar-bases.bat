@echo off
rem ---------------------------------------------------------------------------
rem  ALERTA QUITO - REINICIAR LAS BASES DE DATOS (doble clic)
rem  BORRA todos los datos (usuarios, reportes, funcionarios, auditoria) y deja las
rem  dos bases como nuevas con los datos iniciales. El sistema debe estar encendido.
rem  Uso por consola:  reiniciar-bases.bat auto   (sin preguntar ni pausar)
rem ---------------------------------------------------------------------------
cd /d "%~dp0"
echo.
echo === ALERTA QUITO: reiniciar las bases de datos ===
echo.
if "%1"=="auto" goto ejecutar
echo ATENCION: se van a BORRAR todos los datos y a volver a cargar los iniciales.
set /p confirmar=Escriba SI para continuar:
if /i not "%confirmar%"=="SI" (
    echo Cancelado. No se borro nada.
    pause
    exit /b 0
)
:ejecutar
python scripts\reiniciar_bases.py
if errorlevel 1 (
    echo.
    echo *** No se pudo reiniciar. Esta encendido el sistema? Use iniciar.bat ***
    if not "%1"=="auto" pause
    exit /b 1
)
echo.
echo Listo. Si tenia la aplicacion abierta en el navegador, cierre sesion (Salir) o abra una ventana nueva.
if not "%1"=="auto" pause
