# Image Captioning Service - Docker
FROM python:3.11-slim

# Install Ollama
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://ollama.com/install.sh | sh

# Set working directory
WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy app code
COPY app.py .

# Expose port
EXPOSE 5050

# Start Ollama server and Flask app
CMD ollama serve & sleep 5 && ollama pull llava:latest && python app.py
