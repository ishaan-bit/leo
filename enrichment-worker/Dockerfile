# Hugging Face Space Dockerfile for Leo Enrichment Worker
FROM nvidia/cuda:12.1.0-base-ubuntu22.04

# Set timezone non-interactively
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Asia/Kolkata

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    software-properties-common \
    tzdata \
    && ln -snf /usr/share/zoneinfo/$TZ /etc/localtime \
    && echo $TZ > /etc/timezone \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update \
    && apt-get install -y python3.11 python3.11-distutils python3-pip \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Create Ollama directory with proper permissions and set HOME
RUN mkdir -p /app/.ollama && chmod 777 /app/.ollama
ENV HOME=/app
ENV OLLAMA_MODELS=/app/.ollama

WORKDIR /app
COPY . /app/

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt
RUN pip3 install -e .
RUN pip3 install uvicorn fastapi

# Expose HF Spaces port
EXPOSE 7860

CMD ["python3", "app.py"]
