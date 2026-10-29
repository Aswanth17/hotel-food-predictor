@echo off
echo =========================================================
echo Launching Hotel Food Provision Requirement Predictor...
echo =========================================================
echo.
echo 1. Starting Backend API window...
start "Hotel Food Predictor - Backend" "%~dp0run_backend.bat"

echo 2. Waiting 3 seconds for backend to initialize...
timeout /t 3 /nobreak >nul

echo 3. Starting Frontend UI window...
start "Hotel Food Predictor - Frontend" "%~dp0run_frontend.bat"

echo 4. Waiting 2 seconds and opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:5173

echo.
echo Project running! Keep the backend and frontend command windows open.
echo To stop the application, close both command windows.
