"""
Modal.com Deployment for Leo Enrichment Worker
===============================================

Deploys the 2-stage enrichment worker with:
- HybridScorer (Stage-1 perception)
- EnrichmentDispatcher (Stage-2 creative content)
- Micro-Dream Agent
- 8 Analytics Modules
- Ollama phi3 with GPU acceleration

Usage:
    modal deploy enrichment-worker/modal_deploy.py
"""

import modal

# Create Modal app
app = modal.App("leo-enrichment-worker")

# Define image with Ollama + Python dependencies
image = (
    modal.Image.debian_slim()
    .apt_install("curl")
    .run_commands(
        # Install Ollama
        "curl -fsSL https://ollama.com/install.sh | sh",
    )
    .pip_install_from_requirements("enrichment-worker/requirements.txt")
    # Copy enrichment-worker directory and install as package
    .add_local_dir("enrichment-worker", "/pkg/enrichment-worker", copy=True)
    .run_commands("cd /pkg && pip install enrichment-worker/")
)

# Persistent volume for Ollama models
models_volume = modal.Volume.from_name("ollama-models", create_if_missing=True)

# Deploy as ASGI app to keep it running 24/7
@app.function(
    image=image,
    gpu="A10G",
    volumes={"/root/.ollama": models_volume},
    secrets=[
        modal.Secret.from_name("upstash-redis"),
        modal.Secret.from_name("hf-token"),
    ],
    min_containers=1,  # Always keep 1 container running
    scaledown_window=3600,  # Max 1 hour (3600 seconds)
)
@modal.asgi_app()
def worker_app():
    """
    Enrichment worker as ASGI app (stays running 24/7).
    Starts worker loop in background thread and serves health endpoint.
    """
    import subprocess
    import time
    import os
    import threading
    from fastapi import FastAPI
    
    # Start Ollama
    print("[*] Starting Ollama server...")
    subprocess.Popen(["ollama", "serve"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    time.sleep(10)
    
    # Pull model
    print("[*] Pulling phi3 model...")
    subprocess.run(["ollama", "pull", "phi3:latest"])
    print("[OK] phi3 model ready")
    
    os.environ['OLLAMA_BASE_URL'] = 'http://localhost:11434'
    os.environ['TIMEZONE'] = 'Asia/Kolkata'
    
    # Start worker in background thread
    def run_worker_loop():
        import site
        for path in site.getsitepackages():
            potential = os.path.join(path, 'worker.py')
            if os.path.exists(potential):
                os.chdir(path)
                break
        
        import worker
        print("[OK] Worker loaded, starting main loop...")
        worker.main()  # Runs while True loop
    
    # Start worker thread
    worker_thread = threading.Thread(target=run_worker_loop, daemon=True)
    worker_thread.start()
    print("[OK] Worker thread started")
    
    # Create FastAPI app for health checks
    app = FastAPI()
    
    @app.get("/")
    def root():
        return {
            "status": "running",
            "service": "leo-enrichment-worker",
            "worker_thread": "alive" if worker_thread.is_alive() else "dead"
        }
    
    @app.get("/health")
    def health():
        return {
            "status": "healthy" if worker_thread.is_alive() else "degraded",
            "worker": "running" if worker_thread.is_alive() else "stopped"
        }
    
    return app
