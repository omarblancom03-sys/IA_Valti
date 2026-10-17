@echo off
title IA monotona vs IA no-monotona
cd /d "%~dp0"
where node >nul 2>nul || (echo Necesitas instalar Node.js 18 o superior: https://nodejs.org & pause & exit /b 1)
node server.js
pause
