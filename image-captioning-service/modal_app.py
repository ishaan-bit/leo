"""
Image Captioning Service - Modal.com Deployment
Serverless Python + Ollama vision model on GPU

Deploy: modal deploy modal_app.py
"""

import modal
import os

# Create Modal app
app = modal.App("image-captioning")

# Docker image with Ollama + llava model
image = (
    modal.Image.debian_slim()
    .apt_install("curl")
    .run_commands(
        # Install Ollama
        "curl -fsSL https://ollama.com/install.sh | sh",
        # Pull llava model (this will be cached in the image)
        "ollama serve & sleep 5 && ollama pull llava:latest"
    )
    .pip_install("flask", "requests")
)

@app.function(
    image=image,
    gpu="T4",  # Use GPU for faster inference
    timeout=300,
    allow_concurrent_inputs=10,
)
@modal.web_endpoint(method="POST")
def caption(image_data: dict):
    """
    Caption endpoint - receives base64 image, returns narrative
    """
    import base64
    import requests
    import subprocess
    import time
    
    # Start Ollama server in background
    subprocess.Popen(["ollama", "serve"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(2)  # Wait for server to start
    
    # Get image from request
    image_base64 = image_data.get("image")
    custom_prompt = image_data.get("prompt")
    
    if not image_base64:
        return {"error": "No image provided"}, 400
    
    # Default prompt
    if not custom_prompt:
        custom_prompt = """Describe this image in first person as a brief journal entry. 
Write 2-3 short sentences maximum. Be poetic but concise. 
Capture the emotion and atmosphere, not detailed descriptions."""
    
    # Call Ollama vision model
    payload = {
        "model": "llava:latest",
        "prompt": custom_prompt,
        "images": [image_base64],
        "stream": False,
        "options": {
            "temperature": 0.7,
            "num_predict": 150
        }
    }
    
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json=payload,
            timeout=180
        )
        response.raise_for_status()
        
        result = response.json()
        narrative = result.get("response", "").strip()
        
        return {
            "success": True,
            "narrative": narrative,
            "model": "llava:latest"
        }
    except Exception as e:
        return {"error": str(e)}, 500

@app.function(image=image)
@modal.web_endpoint(method="GET")
def health():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "image-captioning",
        "model": "llava:latest"
    }
