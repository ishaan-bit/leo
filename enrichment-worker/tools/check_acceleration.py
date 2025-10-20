"""
Ollama Hardware Acceleration Detection & Benchmark
"""

import requests
import time
import platform
import subprocess
import json

def detect_platform():
    """Detect OS and hardware"""
    system = platform.system()
    machine = platform.machine()
    processor = platform.processor()
    
    print("=" * 80)
    print("HARDWARE DETECTION")
    print("=" * 80)
    print(f"OS: {system}")
    print(f"Machine: {machine}")
    print(f"Processor: {processor}")
    print()
    
    # Check for GPU/NPU
    gpu_info = "CPU (no GPU detected)"
    
    if system == "Windows":
        # Check for NVIDIA
        try:
            result = subprocess.run(['nvidia-smi', '--query-gpu=name', '--format=csv,noheader'], 
                                   capture_output=True, text=True, timeout=2)
            if result.returncode == 0 and result.stdout.strip():
                gpu_info = f"CUDA ({result.stdout.strip()})"
        except:
            pass
        
        # Check for Intel NPU (Core Ultra series)
        if "Ultra" in processor:
            gpu_info += " + Intel NPU (detection via processor model)"
    
    elif system == "Darwin":  # macOS
        gpu_info = "Metal (Apple Silicon)" if machine == "arm64" else "CPU"
    
    elif system == "Linux":
        # Check for ROCm
        try:
            result = subprocess.run(['rocm-smi'], capture_output=True, text=True, timeout=2)
            if result.returncode == 0:
                gpu_info = "ROCm (AMD)"
        except:
            pass
        
        # Check for CUDA
        try:
            result = subprocess.run(['nvidia-smi', '--query-gpu=name', '--format=csv,noheader'], 
                                   capture_output=True, text=True, timeout=2)
            if result.returncode == 0 and result.stdout.strip():
                gpu_info = f"CUDA ({result.stdout.strip()})"
        except:
            pass
    
    print(f"Acceleration: {gpu_info}")
    print()
    
    return system, gpu_info


def benchmark_ollama(model="phi3:latest", prompt="Generate exactly 100 tokens about anything.", target_tokens=100):
    """Benchmark Ollama inference speed"""
    
    print("=" * 80)
    print("OLLAMA BENCHMARK")
    print("=" * 80)
    print(f"Model: {model}")
    print(f"Prompt: {prompt}")
    print(f"Target tokens: ~{target_tokens}")
    print()
    
    url = "http://localhost:11434/api/generate"
    
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "num_predict": target_tokens,
            "temperature": 0.3
        }
    }
    
    print("Calling Ollama...")
    start_time = time.time()
    
    try:
        response = requests.post(url, json=payload, timeout=60)
        elapsed = time.time() - start_time
        
        if response.status_code == 200:
            data = response.json()
            
            # Extract metrics
            actual_response = data.get('response', '')
            total_duration_ns = data.get('total_duration', 0)
            load_duration_ns = data.get('load_duration', 0)
            prompt_eval_count = data.get('prompt_eval_count', 0)
            prompt_eval_duration_ns = data.get('prompt_eval_duration', 0)
            eval_count = data.get('eval_count', 0)
            eval_duration_ns = data.get('eval_duration', 0)
            
            # Convert to seconds
            total_duration_s = total_duration_ns / 1e9
            eval_duration_s = eval_duration_ns / 1e9
            
            # Calculate tokens/sec
            tokens_per_sec = eval_count / eval_duration_s if eval_duration_s > 0 else 0
            
            print("✅ SUCCESS")
            print()
            print(f"Total time: {elapsed:.2f}s")
            print(f"Tokens generated: {eval_count}")
            print(f"Inference time: {eval_duration_s:.2f}s")
            print(f"🚀 Speed: {tokens_per_sec:.2f} tokens/sec")
            print()
            
            # Response preview
            preview = actual_response[:200] + "..." if len(actual_response) > 200 else actual_response
            print(f"Response preview: {preview}")
            print()
            
            # Performance assessment
            if tokens_per_sec < 5:
                print("⚠️  Warning: Very slow (<5 tok/s). Check if GPU/NPU is being used.")
            elif tokens_per_sec < 15:
                print("⚠️  Warning: Below expected speed (<15 tok/s). May be using CPU.")
            elif tokens_per_sec < 30:
                print("✅ Acceptable speed (15-30 tok/s). Likely using integrated GPU/NPU.")
            else:
                print("✅ Excellent speed (>30 tok/s). Hardware acceleration active!")
            
            return {
                'success': True,
                'tokens_per_sec': tokens_per_sec,
                'total_time': elapsed,
                'tokens_generated': eval_count
            }
        else:
            print(f"❌ Error: {response.status_code}")
            print(response.text)
            return {'success': False}
    
    except Exception as e:
        print(f"❌ Error: {e}")
        return {'success': False}


def check_ollama_health():
    """Check if Ollama is reachable"""
    print("=" * 80)
    print("OLLAMA HEALTH CHECK")
    print("=" * 80)
    
    try:
        response = requests.get("http://localhost:11434/api/tags", timeout=5)
        if response.status_code == 200:
            models = response.json().get('models', [])
            print(f"✅ Ollama is running")
            print(f"Models available: {len(models)}")
            for model in models:
                print(f"   - {model['name']}")
            print()
            return True
        else:
            print("❌ Ollama not responding properly")
            return False
    except Exception as e:
        print(f"❌ Ollama not reachable: {e}")
        print()
        print("To start Ollama, run: ollama serve")
        return False


if __name__ == '__main__':
    # Detect hardware
    system, gpu_info = detect_platform()
    
    # Check Ollama
    ollama_ok = check_ollama_health()
    
    if ollama_ok:
        # Benchmark
        result = benchmark_ollama(
            model="phi3:latest",
            prompt="Write a detailed technical explanation of neural networks in 100 tokens.",
            target_tokens=100
        )
        
        print("=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"Platform: {system}")
        print(f"Acceleration: {gpu_info}")
        if result['success']:
            print(f"Performance: {result['tokens_per_sec']:.2f} tokens/sec")
            print()
            
            # Recommendation
            if "NPU" in gpu_info:
                print("📝 Note: Intel NPU detected. Ollama may use it automatically")
                print("   if compiled with NPU support. Check Ollama logs for confirmation.")
            elif "CUDA" in gpu_info:
                print("✅ CUDA detected. Ollama should use GPU automatically.")
            elif "Metal" in gpu_info:
                print("✅ Metal detected. Ollama uses Apple Silicon GPU.")
            else:
                print("ℹ️  No discrete GPU detected. Using CPU or integrated graphics.")
        print()
