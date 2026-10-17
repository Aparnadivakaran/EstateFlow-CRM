# One-command local start (Windows PowerShell):  .\run.ps1
# Needs Python 3.11+ and Node 18+. Builds the React app, then starts the API + site on http://localhost:8000
if (-not (Test-Path .venv)) { python -m venv .venv }
.\.venv\Scripts\python -m pip install -q -r requirements.txt

Push-Location frontend
if (-not (Test-Path node_modules)) { npm install }
npm run build
Pop-Location

Set-Location backend
..\.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
