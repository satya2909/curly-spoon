# Check if python is available
if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
    Write-Host "Python is not installed or not in PATH." -ForegroundColor Red
    exit 1
}

# Create virtual environment if it doesn't exist
if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment..."
    python -m venv .venv
} else {
    Write-Host "Virtual environment already exists."
}

# Activate virtual environment
$env:VIRTUAL_ENV = "$PWD\.venv"
$env:PATH = "$env:VIRTUAL_ENV\Scripts;$env:PATH"

# Upgrade pip
Write-Host "Upgrading pip..."
python -m pip install --upgrade pip

# Install dependencies
if (Test-Path "backend\requirements.txt") {
    Write-Host "Installing dependencies from backend\requirements.txt..."
    pip install -r backend\requirements.txt
} else {
    Write-Host "backend\requirements.txt not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Dependency installation complete." -ForegroundColor Green
