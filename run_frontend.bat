@echo off
title Hotel Food Predictor - Frontend (Port 5173)
cd /d "%~dp0frontend"
echo ===================================================
echo Starting Frontend UI on http://localhost:5173
echo ===================================================
npx vite --port 5173 --host
pause
