@echo off
chcp 65001 >nul
cd /d "%~dp0"
node server\scripts\setup-local.js
if errorlevel 1 goto failed
call npm.cmd run build
if errorlevel 1 goto failed
echo.
echo Cuando aparezca "Brisa disponible", abre http://localhost:3001 en tu navegador.
call npm.cmd start
if errorlevel 1 goto failed
exit /b 0
:failed
echo.
echo No se pudo iniciar Brisa. Revisa el mensaje anterior.
pause
exit /b 1

