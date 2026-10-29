@echo off
title Hotel Food Predictor - Backend API (Port 5000)
cd /d "%~dp0backend"
echo ===================================================
echo Starting Flask Backend API on http://127.0.0.1:5000
echo ===================================================
"C:\Users\aadhe\AppData\Local\Programs\Python\Python312\python.exe" app.py
pause
