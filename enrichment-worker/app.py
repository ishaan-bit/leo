"""
HF Space wrapper for enrichment worker
Runs worker in background thread and serves health endpoint
"""
from fastapi import FastAPI
import threading
import subprocess
import time
import os
import sys

app = FastAPI()

worker_thread = None
worker_status = {"status": "starting", "message": "Initializing..."}

def run_enrichment_worker():
    """Run enrichment worker in background"""
    global worker_status
    
    print("\n" + "=" * 60)
    print("[WORKER] run_enrichment_worker() ENTERED")
    print(f"[WORKER] Thread ID: {threading.current_thread().ident}")
    print(f"[WORKER] Thread Name: {threading.current_thread().name}")
    print("=" * 60 + "\n")
    
    try:
        # Start Ollama server (let output go to stdout/stderr so we can see errors)
        worker_status["message"] = "Starting Ollama server..."
        print("[STARTUP] Starting Ollama server...")
        ollama_process = subprocess.Popen(
            ["ollama", "serve"],
            stdout=sys.stdout,  # Show Ollama logs
            stderr=sys.stderr
        )
        print(f"[STARTUP] Ollama process started (PID: {ollama_process.pid})")
        
        # Wait for Ollama to be ready
        print("[STARTUP] Waiting for Ollama to start (max 30s)...")
        import requests as req
        for i in range(30):
            try:
                r = req.get("http://localhost:11434/api/tags", timeout=1)
                if r.status_code == 200:
                    print(f"[STARTUP] ✓ Ollama is responding after {i+1}s")
                    break
            except:
                pass
            time.sleep(1)
        else:
            print("[STARTUP] WARNING: Ollama didn't respond after 30s, continuing anyway...")
        
        # Check if model exists, only pull if needed
        worker_status["message"] = "Checking for phi3 model..."
        print("[STARTUP] Checking if phi3:mini is already downloaded...")
        try:
            result = subprocess.run(["ollama", "list"], capture_output=True, text=True, timeout=10)
            print(f"[STARTUP] Ollama list output:\n{result.stdout}")
            if "phi3:mini" not in result.stdout:
                worker_status["message"] = "Pulling phi3:mini model (this may take 5-10 minutes on first run)..."
                print("[STARTUP] Model not found. Pulling phi3:mini (2GB download, ~5-10 min on HF Spaces)...")
                pull_result = subprocess.run(
                    ["ollama", "pull", "phi3:mini"],
                    capture_output=True,
                    text=True,
                    timeout=1800  # 30 minutes - HF Spaces has slow network
                )
                print(f"[STARTUP] Pull output: {pull_result.stdout}")
                if pull_result.returncode != 0:
                    print(f"[STARTUP] Pull stderr: {pull_result.stderr}")
                    print("[STARTUP] WARNING: Pull may have failed, but continuing (worker will retry)...")
                else:
                    print("[STARTUP] ✓ Model pull complete!")
            else:
                print("[STARTUP] ✓ Model already exists, skipping download")
        except subprocess.TimeoutExpired:
            print("[STARTUP] WARNING: Model pull timed out after 30 minutes.")
            print("[STARTUP] The model may still be downloading in the background.")
            print("[STARTUP] Worker will start anyway and retry Ollama calls as model becomes available.")
        except Exception as e:
            print(f"[STARTUP] WARNING: Model check/pull failed: {e}")
            print("[STARTUP] Worker will start anyway with fallback to HF API.")
        
        # Verify Ollama is still responding
        print("[STARTUP] Final Ollama health check...")
        try:
            check = req.get("http://localhost:11434/api/tags", timeout=2)
            print(f"[STARTUP] Ollama status: {check.status_code}")
        except Exception as e:
            print(f"[STARTUP] WARNING: Ollama not responding: {e}")
            print("[STARTUP] Worker will use HF API fallback for all LLM calls.")
        
        # Set environment
        os.environ['OLLAMA_BASE_URL'] = 'http://localhost:11434'
        os.environ['TIMEZONE'] = 'Asia/Kolkata'
        
        # Import and run worker
        worker_status["message"] = "Starting worker main loop..."
        print("[STARTUP] Importing worker module...")
        import worker
        worker_status["status"] = "running"
        worker_status["message"] = "Worker polling Redis..."
        print("[STARTUP] Worker started! Now polling reflections:normalized...")
        worker.main()  # Blocking call
        
    except Exception as e:
        worker_status["status"] = "error"
        worker_status["message"] = str(e)
        print(f"Worker error: {e}")

@app.on_event("startup")
async def startup_event():
    """Start worker thread on startup"""
    global worker_thread
    print("=" * 60)
    print("[APP] FastAPI startup event triggered")
    print("[APP] Starting enrichment worker thread...")
    print("=" * 60)
    worker_thread = threading.Thread(target=run_enrichment_worker, daemon=True)
    worker_thread.start()
    print(f"[APP] Worker thread started: {worker_thread.is_alive()}")
    print("=" * 60)

@app.get("/")
@app.get("/health")
def health():
    """Health check endpoint"""
    import requests as req
    
    # Check if Ollama is responding
    ollama_status = "unknown"
    ollama_models = []
    try:
        r = req.get("http://localhost:11434/api/tags", timeout=2)
        if r.status_code == 200:
            ollama_status = "running"
            ollama_models = [m['name'] for m in r.json().get('models', [])]
        else:
            ollama_status = f"error_{r.status_code}"
    except Exception as e:
        ollama_status = f"failed: {type(e).__name__}"
    
    return {
        "service": "leo-enrichment-worker",
        "status": worker_status["status"],
        "message": worker_status["message"],
        "worker_alive": worker_thread.is_alive() if worker_thread else False,
        "ollama_status": ollama_status,
        "ollama_models": ollama_models
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
