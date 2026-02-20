# Check if python is available
if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Host "Python is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# Activate virtual environment
if (Test-Path ".venv") {
    $env:VIRTUAL_ENV = "$PWD\.venv"
    $env:PATH = "$env:VIRTUAL_ENV\Scripts;$env:PATH"
} else {
    Write-Host "Virtual environment not found. Please run setup_env.ps1 first." -ForegroundColor Red
    exit 1
}

# Run the application
Write-Host "Starting Backend Server..."
cd backend
python -m uvicorn app:app --reload
