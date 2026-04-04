FROM python:3.12-slim

# Install system dependencies for Prophet (CmdStan) and scientific packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install CmdStan for Prophet (done after pip install to cache layer)
RUN python -c "import cmdstanpy; cmdstanpy.install_cmdstan()" 2>/dev/null || true

COPY app/ ./app/

EXPOSE 8000

# Uvicorn with 2 workers for handling concurrent requests
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
