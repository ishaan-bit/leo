FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install
COPY requirements-server.txt .
RUN pip install --no-cache-dir -r requirements-server.txt

# Download TextBlob corpora
RUN python -m textblob.download_corpora

# Copy application code
COPY . .

# Expose the port (Railway sets this via $PORT env var)
EXPOSE 8080

# Run the application (app.py reads PORT from environment)
CMD ["python", "app.py"]
