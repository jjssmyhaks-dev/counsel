# Start the Python AI Service
Set-Location C:\Users\Ashif\.openclaw-autoclaw\agents\counsel\workspace\counsel-platform\services\ai
python -m uvicorn src.main:app --host 127.0.0.1 --port 8000
