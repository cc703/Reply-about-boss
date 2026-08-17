@echo off
setlocal

cd /d "%~dp0backend"

if not exist ".venv\Scripts\python.exe" (
  echo backend\.venv not found. Please create the virtual environment first.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8765
