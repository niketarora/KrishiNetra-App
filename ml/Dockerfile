# 3.12+ is required, not incidental: numpy and xgboost pinned in
# requirements.txt publish no wheels for 3.11 or older.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# libgomp1 is xgboost's only system dependency (OpenMP runtime); every other
# pinned package ships a manylinux wheel, so no compiler toolchain is needed.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create models directory
RUN mkdir -p models

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import os,requests; requests.get('http://localhost:' + os.getenv('PORT','8000') + '/health')"

# Render injects PORT; fall back to 8000 for local `docker run`.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
