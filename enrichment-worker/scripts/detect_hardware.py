"""
Hardware detection and OpenVINO configuration for Intel Ultra 7 CPU + Arc GPU + NPU.

Detects available execution providers and configures optimal device priority:
1. GPU (Intel Arc - 8.9 GB VRAM) for transformer fine-tuning, inference
2. NPU for background inference, GRU/EMA updates, lightweight scoring
3. CPU fallback for unsupported ops

Memory management:
- Auto-limit batch sizes to keep VRAM < 80%
- Enable INT8/FP16 for transformers
- BF16 for LGBM + meta-blender
"""

import os
import sys
import json
import platform
import subprocess
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import psutil


def detect_cpu_info() -> Dict:
    """Detect CPU information."""
    info = {
        "name": platform.processor(),
        "physical_cores": psutil.cpu_count(logical=False),
        "logical_cores": psutil.cpu_count(logical=True),
        "frequency_mhz": psutil.cpu_freq().current if psutil.cpu_freq() else None,
        "architecture": platform.machine(),
    }
    
    # Try to get more detailed CPU info (Intel-specific)
    try:
        if platform.system() == "Windows":
            result = subprocess.run(
                ["wmic", "cpu", "get", "name"],
                capture_output=True,
                text=True,
                timeout=5
            )
            cpu_name = result.stdout.split('\n')[1].strip()
            info["detailed_name"] = cpu_name
            
            # Check for Intel Ultra 7
            if "ultra" in cpu_name.lower() and "7" in cpu_name:
                info["is_ultra7"] = True
                info["has_npu"] = True  # Intel Ultra 7 includes NPU
    except Exception as e:
        print(f"[WARN] Could not get detailed CPU info: {e}")
    
    return info


def detect_gpu_openvino() -> List[Dict]:
    """Detect GPU devices via OpenVINO."""
    try:
        import openvino as ov
        core = ov.Core()
        devices = core.available_devices
        
        gpu_devices = []
        for device in devices:
            if "GPU" in device:
                try:
                    # Get device properties
                    props = core.get_property(device, "FULL_DEVICE_NAME")
                    gpu_devices.append({
                        "device": device,
                        "name": props,
                        "backend": "openvino"
                    })
                except Exception as e:
                    gpu_devices.append({
                        "device": device,
                        "name": "Unknown GPU",
                        "backend": "openvino",
                        "error": str(e)
                    })
        
        return gpu_devices
    except ImportError:
        print("[WARN] OpenVINO not installed, cannot detect GPU via OpenVINO")
        return []
    except Exception as e:
        print(f"[ERROR] OpenVINO GPU detection failed: {e}")
        return []


def detect_gpu_pytorch() -> Optional[Dict]:
    """Detect GPU via PyTorch (Intel Extension for PyTorch - IPEX)."""
    try:
        import torch
        
        gpu_info = {
            "cuda_available": torch.cuda.is_available(),
            "cuda_device_count": torch.cuda.device_count() if torch.cuda.is_available() else 0,
        }
        
        # Try Intel Extension for PyTorch (XPU for Arc GPU)
        try:
            import intel_extension_for_pytorch as ipex
            gpu_info["ipex_available"] = True
            gpu_info["xpu_available"] = hasattr(torch, 'xpu') and torch.xpu.is_available()
            
            if gpu_info["xpu_available"]:
                gpu_info["xpu_device_count"] = torch.xpu.device_count()
                gpu_info["xpu_devices"] = []
                
                for i in range(torch.xpu.device_count()):
                    props = torch.xpu.get_device_properties(i)
                    gpu_info["xpu_devices"].append({
                        "id": i,
                        "name": props.name,
                        "total_memory_gb": props.total_memory / (1024**3),
                        "platform_version": props.platform_version,
                    })
        except ImportError:
            gpu_info["ipex_available"] = False
            gpu_info["xpu_available"] = False
        
        return gpu_info
    except ImportError:
        print("[WARN] PyTorch not installed, cannot detect GPU via PyTorch")
        return None
    except Exception as e:
        print(f"[ERROR] PyTorch GPU detection failed: {e}")
        return None


def detect_npu_openvino() -> List[Dict]:
    """Detect NPU (Neural Processing Unit) via OpenVINO."""
    try:
        import openvino as ov
        core = ov.Core()
        devices = core.available_devices
        
        npu_devices = []
        for device in devices:
            if "NPU" in device:
                try:
                    props = core.get_property(device, "FULL_DEVICE_NAME")
                    npu_devices.append({
                        "device": device,
                        "name": props,
                        "backend": "openvino"
                    })
                except Exception as e:
                    npu_devices.append({
                        "device": device,
                        "name": "Intel NPU",
                        "backend": "openvino",
                        "error": str(e)
                    })
        
        return npu_devices
    except ImportError:
        print("[WARN] OpenVINO not installed, cannot detect NPU")
        return []
    except Exception as e:
        print(f"[ERROR] NPU detection failed: {e}")
        return []


def estimate_vram_headroom(total_vram_gb: float, target_util: float = 0.8) -> Dict:
    """
    Estimate safe VRAM usage and batch size limits.
    
    Args:
        total_vram_gb: Total GPU VRAM in GB
        target_util: Target utilization (default 0.8 = 80%)
    
    Returns:
        Dict with recommended batch sizes and memory limits
    """
    available_gb = total_vram_gb * target_util
    
    # Rough estimates for different model types
    # Based on FP16 precision (2 bytes per param)
    estimates = {
        "total_vram_gb": total_vram_gb,
        "target_utilization": target_util,
        "safe_vram_gb": available_gb,
        
        # Transformer inference (e.g., RoBERTa-base 110M params)
        "transformer_small_batch_size": max(1, int(available_gb / 0.5)),  # ~0.5 GB per sample
        
        # Sentence embeddings (e.g., all-MiniLM-L6-v2 22M params)
        "embedding_batch_size": max(8, int(available_gb / 0.1)),  # ~0.1 GB per batch of 8
        
        # Fine-tuning (higher memory - gradients + optimizer states)
        "finetune_batch_size": max(1, int(available_gb / 2.0)),  # ~2 GB per sample for small models
        
        # QLoRA (much lower - only trains adapters)
        "qlora_batch_size": max(2, int(available_gb / 1.0)),  # ~1 GB per sample
    }
    
    return estimates


def get_openvino_config(gpu_available: bool, npu_available: bool) -> Dict:
    """
    Generate OpenVINO execution config.
    
    Priority: GPU → NPU → CPU
    """
    config = {
        "device_priority": [],
        "inference_precision": {},
        "performance_hints": {},
    }
    
    if gpu_available:
        config["device_priority"].append("GPU")
        config["inference_precision"]["GPU"] = "FP16"  # FP16 for GPU
        config["performance_hints"]["GPU"] = {
            "PERFORMANCE_HINT": "THROUGHPUT",  # For batch processing
            "INFERENCE_PRECISION_HINT": "f16",
        }
    
    if npu_available:
        config["device_priority"].append("NPU")
        config["inference_precision"]["NPU"] = "INT8"  # INT8 for NPU efficiency
        config["performance_hints"]["NPU"] = {
            "PERFORMANCE_HINT": "LATENCY",  # For real-time inference
            "INFERENCE_PRECISION_HINT": "u8",
        }
    
    # CPU fallback always available
    config["device_priority"].append("CPU")
    config["inference_precision"]["CPU"] = "FP32"
    config["performance_hints"]["CPU"] = {
        "PERFORMANCE_HINT": "LATENCY",
        "INFERENCE_NUM_STREAMS": 4,  # Parallel streams on CPU
    }
    
    return config


def detect_all() -> Dict:
    """Run complete hardware detection."""
    print("="*70)
    print("HARDWARE DETECTION — Intel Ultra 7 + Arc GPU + NPU")
    print("="*70)
    
    results = {
        "timestamp": str(Path(__file__).stat().st_mtime),
        "platform": platform.system(),
        "cpu": {},
        "gpu": {},
        "npu": {},
        "openvino_config": {},
        "memory": {},
    }
    
    # CPU
    print("\n[1/5] Detecting CPU...")
    cpu_info = detect_cpu_info()
    results["cpu"] = cpu_info
    print(f"  ✓ CPU: {cpu_info.get('detailed_name', cpu_info['name'])}")
    print(f"  ✓ Cores: {cpu_info['physical_cores']} physical / {cpu_info['logical_cores']} logical")
    if cpu_info.get("has_npu"):
        print(f"  ✓ NPU: Detected (Intel Ultra 7 series)")
    
    # GPU - OpenVINO
    print("\n[2/5] Detecting GPU (OpenVINO)...")
    gpu_ov = detect_gpu_openvino()
    if gpu_ov:
        for gpu in gpu_ov:
            print(f"  ✓ {gpu['device']}: {gpu['name']}")
        results["gpu"]["openvino"] = gpu_ov
    else:
        print("  ✗ No GPU detected via OpenVINO")
    
    # GPU - PyTorch
    print("\n[3/5] Detecting GPU (PyTorch + IPEX)...")
    gpu_pt = detect_gpu_pytorch()
    if gpu_pt:
        results["gpu"]["pytorch"] = gpu_pt
        if gpu_pt.get("xpu_available"):
            print(f"  ✓ Intel XPU available ({gpu_pt['xpu_device_count']} device(s))")
            for dev in gpu_pt.get("xpu_devices", []):
                print(f"    - {dev['name']}: {dev['total_memory_gb']:.2f} GB VRAM")
                
                # Estimate batch sizes
                vram_est = estimate_vram_headroom(dev['total_memory_gb'])
                results["memory"]["vram_estimates"] = vram_est
                print(f"    - Safe VRAM: {vram_est['safe_vram_gb']:.2f} GB (80% of {dev['total_memory_gb']:.2f} GB)")
                print(f"    - Recommended batch sizes:")
                print(f"      * Transformer inference: {vram_est['transformer_small_batch_size']}")
                print(f"      * Embeddings: {vram_est['embedding_batch_size']}")
                print(f"      * Fine-tuning: {vram_est['finetune_batch_size']}")
                print(f"      * QLoRA: {vram_est['qlora_batch_size']}")
        elif gpu_pt.get("cuda_available"):
            print(f"  ✓ CUDA available ({gpu_pt['cuda_device_count']} device(s))")
        else:
            print("  ✗ No GPU available via PyTorch")
    else:
        print("  ✗ PyTorch not available")
    
    # NPU
    print("\n[4/5] Detecting NPU (OpenVINO)...")
    npu_ov = detect_npu_openvino()
    if npu_ov:
        for npu in npu_ov:
            print(f"  ✓ {npu['device']}: {npu['name']}")
        results["npu"]["openvino"] = npu_ov
    else:
        print("  ✗ No NPU detected via OpenVINO")
    
    # System memory
    print("\n[5/5] Detecting system memory...")
    mem = psutil.virtual_memory()
    results["memory"]["system"] = {
        "total_gb": mem.total / (1024**3),
        "available_gb": mem.available / (1024**3),
        "percent_used": mem.percent,
    }
    print(f"  ✓ RAM: {mem.total / (1024**3):.2f} GB total, {mem.available / (1024**3):.2f} GB available")
    
    # OpenVINO config
    print("\n[6/6] Generating OpenVINO config...")
    gpu_available = len(gpu_ov) > 0
    npu_available = len(npu_ov) > 0
    ov_config = get_openvino_config(gpu_available, npu_available)
    results["openvino_config"] = ov_config
    
    print(f"  ✓ Device priority: {' → '.join(ov_config['device_priority'])}")
    for device in ov_config['device_priority']:
        print(f"    - {device}: {ov_config['inference_precision'][device]}")
    
    return results


def save_config(results: Dict, output_path: Path):
    """Save hardware config to JSON."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n[OK] Hardware config saved to: {output_path}")


if __name__ == "__main__":
    results = detect_all()
    
    output_path = Path(__file__).parent.parent / "models" / "hybrid_v2" / "hardware_config.json"
    save_config(results, output_path)
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    
    print(f"CPU: {results['cpu'].get('detailed_name', results['cpu']['name'])}")
    print(f"GPU (OpenVINO): {len(results['gpu'].get('openvino', []))} device(s)")
    print(f"GPU (PyTorch): {'Yes' if results['gpu'].get('pytorch', {}).get('xpu_available') else 'No'}")
    print(f"NPU: {len(results['npu'].get('openvino', []))} device(s)")
    print(f"Device priority: {' → '.join(results['openvino_config']['device_priority'])}")
    
    if results["memory"].get("vram_estimates"):
        vram = results["memory"]["vram_estimates"]
        print(f"\nVRAM headroom: {vram['safe_vram_gb']:.2f} GB")
        print(f"Recommended batch sizes:")
        print(f"  - Transformer: {vram['transformer_small_batch_size']}")
        print(f"  - QLoRA: {vram['qlora_batch_size']}")
    
    print("\n[INFO] Next: Run synthetic edge case generation")
    print("  python scripts/synth_edge_cases.py")
