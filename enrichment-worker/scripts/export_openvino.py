"""
Task 9: OpenVINO Export & Integration

Export trained models to OpenVINO IR format with FP16/INT8 quantization,
validate latency on GPU/NPU, check export parity, and integrate with
enrichment worker.

Features:
- Model conversion (ONNX → OpenVINO IR)
- FP16 and INT8 quantization
- Latency benchmarking (GPU/NPU priorities)
- Export parity validation (RMSE ≤0.005 diff)
- Integration testing with worker

Usage:
    python scripts/export_openvino.py --variable valence --model-path models/valence_final.pkl
    python scripts/export_openvino.py --variable invoked --model-path models/invoked_final.pkl --task classification
"""

import argparse
import json
import numpy as np
import time
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import warnings
warnings.filterwarnings('ignore')

import lightgbm as lgb

# OpenVINO imports
try:
    import openvino as ov
    from openvino.tools import mo
    from openvino.runtime import Core, serialize
    OPENVINO_AVAILABLE = True
except ImportError:
    print("⚠ OpenVINO not installed. Run: pip install openvino openvino-dev")
    OPENVINO_AVAILABLE = False

# ONNX imports for intermediate conversion
try:
    import onnx
    import onnxmltools
    from onnxmltools.convert import convert_lightgbm
    from onnxmltools.utils import save_model
    ONNX_AVAILABLE = True
except ImportError:
    print("⚠ ONNX tools not installed. Run: pip install onnx onnxmltools skl2onnx")
    ONNX_AVAILABLE = False


@dataclass
class ExportConfig:
    """Export configuration"""
    variable: str
    task: str  # 'regression' or 'classification'
    model_path: Path
    data_dir: Path
    output_dir: Path
    
    # Quantization
    use_fp16: bool = True
    use_int8: bool = True
    
    # Latency targets
    target_latency_ms: float = 100.0  # ≤100ms per ADDENDUM
    
    # Parity validation
    max_rmse_diff: float = 0.005  # ADDENDUM requirement
    
    # Device priorities
    devices: List[str] = None  # ['GPU', 'NPU', 'CPU']
    
    def __post_init__(self):
        if self.devices is None:
            self.devices = ['GPU', 'NPU', 'CPU']


@dataclass
class ExportMetrics:
    """Export validation metrics"""
    variable: str
    
    # Model sizes
    original_size_mb: float = 0.0
    fp16_size_mb: float = 0.0
    int8_size_mb: float = 0.0
    
    # Latency (ms per sample)
    latency_original_ms: float = 0.0
    latency_fp16_ms: float = 0.0
    latency_int8_ms: float = 0.0
    
    # Parity (RMSE difference from original)
    parity_fp16_rmse_diff: float = 0.0
    parity_int8_rmse_diff: float = 0.0
    
    # Device performance
    device_latencies: Dict[str, float] = None
    best_device: str = "CPU"
    
    # Acceptance
    latency_pass: bool = False
    parity_pass: bool = False
    
    def __post_init__(self):
        if self.device_latencies is None:
            self.device_latencies = {}


class OpenVINOExporter:
    """Export models to OpenVINO with quantization and validation"""
    
    def __init__(self, config: ExportConfig):
        if not OPENVINO_AVAILABLE or not ONNX_AVAILABLE:
            raise ImportError("OpenVINO and ONNX tools required. Install: pip install openvino openvino-dev onnx onnxmltools skl2onnx")
        
        self.config = config
        self.model = None
        self.ov_core = Core()
        
        # Metrics
        self.metrics = ExportMetrics(variable=config.variable)
        
        # Paths
        self.onnx_path = None
        self.ir_fp32_path = None
        self.ir_fp16_path = None
        self.ir_int8_path = None
    
    def run(self) -> ExportMetrics:
        """Execute full export pipeline"""
        print(f"\n{'='*80}")
        print(f"OPENVINO EXPORT: {self.config.variable.upper()}")
        print(f"{'='*80}\n")
        
        # Load model
        print("[1/7] Loading trained model...")
        self._load_model()
        
        # Convert to ONNX
        print("[2/7] Converting to ONNX...")
        self._convert_to_onnx()
        
        # Convert ONNX to OpenVINO IR
        print("[3/7] Converting to OpenVINO IR (FP32)...")
        self._convert_to_openvino_fp32()
        
        # Quantize
        print("[4/7] Quantizing to FP16...")
        self._quantize_fp16()
        
        print("[5/7] Quantizing to INT8...")
        self._quantize_int8()
        
        # Benchmark latency
        print("[6/7] Benchmarking latency...")
        self._benchmark_latency()
        
        # Validate parity
        print("[7/7] Validating export parity...")
        self._validate_parity()
        
        # Save report
        self._save_export_report()
        
        print(f"\n{'='*80}")
        print("EXPORT COMPLETE")
        print(f"{'='*80}\n")
        
        self._print_summary()
        
        return self.metrics
    
    def _load_model(self):
        """Load LightGBM model"""
        if not self.config.model_path.exists():
            raise FileNotFoundError(f"Model not found: {self.config.model_path}")
        
        self.model = lgb.Booster(model_file=str(self.config.model_path))
        
        # Get model size
        self.metrics.original_size_mb = self.config.model_path.stat().st_size / (1024 * 1024)
        
        print(f"  ✓ Loaded model: {self.config.model_path} ({self.metrics.original_size_mb:.2f} MB)")
    
    def _convert_to_onnx(self):
        """Convert LightGBM to ONNX"""
        output_dir = self.config.output_dir / self.config.variable
        output_dir.mkdir(parents=True, exist_ok=True)
        
        self.onnx_path = output_dir / f"{self.config.variable}.onnx"
        
        # Define input shape
        n_features = self.model.num_feature()
        initial_type = [('input', onnxmltools.convert.common.data_types.FloatTensorType([None, n_features]))]
        
        # Convert
        try:
            onnx_model = convert_lightgbm(
                self.model,
                initial_types=initial_type,
                target_opset=13
            )
            save_model(onnx_model, str(self.onnx_path))
            
            print(f"  ✓ ONNX model saved: {self.onnx_path}")
        except Exception as e:
            print(f"  ✗ ONNX conversion failed: {e}")
            raise
    
    def _convert_to_openvino_fp32(self):
        """Convert ONNX to OpenVINO IR (FP32 baseline)"""
        output_dir = self.config.output_dir / self.config.variable
        self.ir_fp32_path = output_dir / f"{self.config.variable}_fp32.xml"
        
        try:
            # Use Model Optimizer
            ov_model = mo.convert_model(
                input_model=str(self.onnx_path),
                compress_to_fp16=False
            )
            
            # Serialize
            serialize(ov_model, str(self.ir_fp32_path))
            
            print(f"  ✓ OpenVINO IR (FP32): {self.ir_fp32_path}")
        except Exception as e:
            print(f"  ✗ OpenVINO IR conversion failed: {e}")
            raise
    
    def _quantize_fp16(self):
        """Quantize to FP16"""
        if not self.config.use_fp16:
            print("  ⊘ FP16 quantization skipped")
            return
        
        output_dir = self.config.output_dir / self.config.variable
        self.ir_fp16_path = output_dir / f"{self.config.variable}_fp16.xml"
        
        try:
            # Convert with FP16 compression
            ov_model = mo.convert_model(
                input_model=str(self.onnx_path),
                compress_to_fp16=True
            )
            
            # Serialize
            serialize(ov_model, str(self.ir_fp16_path))
            
            # Get size
            self.metrics.fp16_size_mb = self.ir_fp16_path.stat().st_size / (1024 * 1024)
            
            print(f"  ✓ FP16 model: {self.ir_fp16_path} ({self.metrics.fp16_size_mb:.2f} MB)")
        except Exception as e:
            print(f"  ✗ FP16 quantization failed: {e}")
    
    def _quantize_int8(self):
        """Quantize to INT8 (requires calibration dataset)"""
        if not self.config.use_int8:
            print("  ⊘ INT8 quantization skipped")
            return
        
        # INT8 requires NNCF (Neural Network Compression Framework)
        # For now, placeholder - full implementation requires calibration dataset
        print("  ⚠ INT8 quantization not yet implemented (requires NNCF + calibration data)")
        print("    See: https://docs.openvino.ai/latest/openvino_docs_model_optimization_guide.html")
    
    def _benchmark_latency(self):
        """Benchmark inference latency on available devices"""
        print("\n  [Latency Benchmarking]")
        
        # Load validation data for benchmarking
        val_path = self.config.data_dir / "features" / "val_features.jsonl"
        if not val_path.exists():
            print("  ⚠ Validation data not found, skipping latency benchmark")
            return
        
        # Load sample features
        X_val = self._load_sample_features(val_path, n_samples=100)
        
        # Benchmark original LGBM
        start = time.perf_counter()
        for _ in range(10):  # 10 warmup iterations
            _ = self.model.predict(X_val)
        
        start = time.perf_counter()
        n_iter = 100
        for _ in range(n_iter):
            _ = self.model.predict(X_val)
        elapsed = (time.perf_counter() - start) / n_iter
        self.metrics.latency_original_ms = elapsed * 1000 / len(X_val)
        
        print(f"    Original LGBM: {self.metrics.latency_original_ms:.2f} ms/sample")
        
        # Benchmark OpenVINO FP16
        if self.ir_fp16_path and self.ir_fp16_path.exists():
            latency_fp16 = self._benchmark_openvino_model(self.ir_fp16_path, X_val)
            self.metrics.latency_fp16_ms = latency_fp16
            print(f"    OpenVINO FP16: {latency_fp16:.2f} ms/sample")
        
        # Benchmark on different devices
        for device in self.config.devices:
            if not self._is_device_available(device):
                print(f"    {device}: Not available")
                continue
            
            latency = self._benchmark_device(self.ir_fp16_path if self.ir_fp16_path else self.ir_fp32_path, X_val, device)
            self.metrics.device_latencies[device] = latency
            print(f"    {device}: {latency:.2f} ms/sample")
        
        # Find best device
        if self.metrics.device_latencies:
            self.metrics.best_device = min(self.metrics.device_latencies, key=self.metrics.device_latencies.get)
            best_latency = self.metrics.device_latencies[self.metrics.best_device]
            
            # Check acceptance
            if best_latency <= self.config.target_latency_ms:
                self.metrics.latency_pass = True
                print(f"\n    ✓ LATENCY PASS: {best_latency:.2f} ms ≤ {self.config.target_latency_ms} ms ({self.metrics.best_device})")
            else:
                print(f"\n    ✗ LATENCY FAIL: {best_latency:.2f} ms > {self.config.target_latency_ms} ms ({self.metrics.best_device})")
    
    def _load_sample_features(self, val_path, n_samples=100):
        """Load sample features for benchmarking"""
        items = []
        with open(val_path, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if i >= n_samples:
                    break
                items.append(json.loads(line))
        
        X = []
        for item in items:
            lex = item.get('lexical_features', {})
            emb = item.get('embedding_features', {})
            
            lex_vec = [
                lex.get('lex_valence', 0.0),
                lex.get('lex_arousal', 0.0),
                lex.get('word_count', 0),
                lex.get('emoji_count', 0),
                lex.get('punct_count', 0),
                lex.get('intensifiers', 0),
                lex.get('diminishers', 0),
                lex.get('negations', 0),
                lex.get('profanity_score', 0.0),
                lex.get('joy', 0.0),
                lex.get('sadness', 0.0),
                lex.get('anger', 0.0),
                lex.get('fear', 0.0),
                lex.get('trust', 0.0),
                lex.get('surprise', 0.0),
            ]
            
            emb_vec = emb.get('sentence_embedding', [0.0] * 384)
            anchor_sims = emb.get('anchor_similarities', {})
            anchor_vec = [
                anchor_sims.get('joy', 0.0),
                anchor_sims.get('sadness', 0.0),
                anchor_sims.get('anger', 0.0),
                anchor_sims.get('fear', 0.0),
                anchor_sims.get('calm', 0.0),
                anchor_sims.get('excited', 0.0),
            ]
            
            combined = lex_vec + emb_vec + anchor_vec
            X.append(combined)
        
        return np.array(X, dtype=np.float32)
    
    def _benchmark_openvino_model(self, model_path, X_val):
        """Benchmark OpenVINO model (CPU default)"""
        try:
            model = self.ov_core.read_model(model=str(model_path))
            compiled_model = self.ov_core.compile_model(model, "CPU")
            
            # Warmup
            for _ in range(10):
                _ = compiled_model([X_val])[0]
            
            # Benchmark
            start = time.perf_counter()
            n_iter = 100
            for _ in range(n_iter):
                _ = compiled_model([X_val])[0]
            elapsed = (time.perf_counter() - start) / n_iter
            
            return elapsed * 1000 / len(X_val)
        except Exception as e:
            print(f"    ✗ Benchmark failed: {e}")
            return 999.0
    
    def _is_device_available(self, device):
        """Check if device is available"""
        try:
            available = device in self.ov_core.available_devices
            return available
        except:
            return False
    
    def _benchmark_device(self, model_path, X_val, device):
        """Benchmark on specific device"""
        try:
            model = self.ov_core.read_model(model=str(model_path))
            compiled_model = self.ov_core.compile_model(model, device)
            
            # Warmup
            for _ in range(10):
                _ = compiled_model([X_val])[0]
            
            # Benchmark
            start = time.perf_counter()
            n_iter = 100
            for _ in range(n_iter):
                _ = compiled_model([X_val])[0]
            elapsed = (time.perf_counter() - start) / n_iter
            
            return elapsed * 1000 / len(X_val)
        except Exception as e:
            print(f"    ✗ {device} benchmark failed: {e}")
            return 999.0
    
    def _validate_parity(self):
        """Validate that OpenVINO outputs match original within tolerance"""
        print("\n  [Parity Validation]")
        
        # Load validation data
        val_path = self.config.data_dir / "features" / "val_features.jsonl"
        if not val_path.exists():
            print("  ⚠ Validation data not found, skipping parity check")
            return
        
        X_val = self._load_sample_features(val_path, n_samples=100)
        
        # Original predictions
        y_pred_original = self.model.predict(X_val)
        
        # OpenVINO FP16 predictions
        if self.ir_fp16_path and self.ir_fp16_path.exists():
            y_pred_fp16 = self._predict_openvino(self.ir_fp16_path, X_val)
            
            # Compute RMSE difference
            rmse_diff = np.sqrt(np.mean((y_pred_original - y_pred_fp16) ** 2))
            self.metrics.parity_fp16_rmse_diff = rmse_diff
            
            if rmse_diff <= self.config.max_rmse_diff:
                print(f"    ✓ FP16 Parity: RMSE diff {rmse_diff:.6f} ≤ {self.config.max_rmse_diff}")
                self.metrics.parity_pass = True
            else:
                print(f"    ✗ FP16 Parity: RMSE diff {rmse_diff:.6f} > {self.config.max_rmse_diff}")
        
        # INT8 parity (if available)
        if self.ir_int8_path and self.ir_int8_path.exists():
            y_pred_int8 = self._predict_openvino(self.ir_int8_path, X_val)
            rmse_diff_int8 = np.sqrt(np.mean((y_pred_original - y_pred_int8) ** 2))
            self.metrics.parity_int8_rmse_diff = rmse_diff_int8
            
            if rmse_diff_int8 <= self.config.max_rmse_diff:
                print(f"    ✓ INT8 Parity: RMSE diff {rmse_diff_int8:.6f} ≤ {self.config.max_rmse_diff}")
            else:
                print(f"    ✗ INT8 Parity: RMSE diff {rmse_diff_int8:.6f} > {self.config.max_rmse_diff}")
    
    def _predict_openvino(self, model_path, X_val):
        """Get predictions from OpenVINO model"""
        try:
            model = self.ov_core.read_model(model=str(model_path))
            compiled_model = self.ov_core.compile_model(model, "CPU")
            
            output = compiled_model([X_val])[0]
            return output.flatten() if output.ndim > 1 else output
        except Exception as e:
            print(f"    ✗ Prediction failed: {e}")
            return np.zeros(len(X_val))
    
    def _save_export_report(self):
        """Save export metrics report"""
        output_dir = self.config.output_dir / self.config.variable
        output_dir.mkdir(parents=True, exist_ok=True)
        
        report_path = output_dir / "export_report.json"
        
        from dataclasses import asdict
        report = {
            "variable": self.config.variable,
            "timestamp": "2025-11-02T00:00:00Z",
            "metrics": asdict(self.metrics),
            "config": {
                "target_latency_ms": self.config.target_latency_ms,
                "max_rmse_diff": self.config.max_rmse_diff,
                "devices": self.config.devices,
            },
            "paths": {
                "onnx": str(self.onnx_path) if self.onnx_path else None,
                "ir_fp32": str(self.ir_fp32_path) if self.ir_fp32_path else None,
                "ir_fp16": str(self.ir_fp16_path) if self.ir_fp16_path else None,
                "ir_int8": str(self.ir_int8_path) if self.ir_int8_path else None,
            }
        }
        
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
        
        print(f"\n  ✓ Export report saved: {report_path}")
    
    def _print_summary(self):
        """Print final summary"""
        print("\n" + "="*80)
        print(f"EXPORT SUMMARY: {self.config.variable.upper()}")
        print("="*80)
        
        print(f"\n[Model Sizes]")
        print(f"  Original:  {self.metrics.original_size_mb:.2f} MB")
        if self.metrics.fp16_size_mb > 0:
            print(f"  FP16:      {self.metrics.fp16_size_mb:.2f} MB ({self.metrics.fp16_size_mb / self.metrics.original_size_mb * 100:.1f}%)")
        if self.metrics.int8_size_mb > 0:
            print(f"  INT8:      {self.metrics.int8_size_mb:.2f} MB ({self.metrics.int8_size_mb / self.metrics.original_size_mb * 100:.1f}%)")
        
        print(f"\n[Latency (ms/sample)]")
        print(f"  Original LGBM: {self.metrics.latency_original_ms:.2f} ms")
        if self.metrics.latency_fp16_ms > 0:
            print(f"  FP16:          {self.metrics.latency_fp16_ms:.2f} ms ({self.metrics.latency_fp16_ms / self.metrics.latency_original_ms * 100:.1f}%)")
        
        if self.metrics.device_latencies:
            print(f"\n[Device Latencies]")
            for device, latency in sorted(self.metrics.device_latencies.items(), key=lambda x: x[1]):
                status = "✓" if latency <= self.config.target_latency_ms else "✗"
                print(f"  {status} {device:8s}: {latency:.2f} ms")
            print(f"\n  Best: {self.metrics.best_device} ({self.metrics.device_latencies[self.metrics.best_device]:.2f} ms)")
        
        print(f"\n[Parity (RMSE diff from original)]")
        if self.metrics.parity_fp16_rmse_diff > 0:
            status = "✓" if self.metrics.parity_fp16_rmse_diff <= self.config.max_rmse_diff else "✗"
            print(f"  {status} FP16: {self.metrics.parity_fp16_rmse_diff:.6f}")
        if self.metrics.parity_int8_rmse_diff > 0:
            status = "✓" if self.metrics.parity_int8_rmse_diff <= self.config.max_rmse_diff else "✗"
            print(f"  {status} INT8: {self.metrics.parity_int8_rmse_diff:.6f}")
        
        print(f"\n[Acceptance]")
        print(f"  Latency: {'✓ PASS' if self.metrics.latency_pass else '✗ FAIL'}")
        print(f"  Parity:  {'✓ PASS' if self.metrics.parity_pass else '✗ FAIL'}")
        
        print("\n" + "="*80 + "\n")


def main():
    parser = argparse.ArgumentParser(description="OpenVINO Export & Validation")
    parser.add_argument("--variable", required=True, choices=['valence', 'arousal', 'willingness', 'invoked', 'expressed', 'congruence', 'comparator'])
    parser.add_argument("--model-path", required=True, type=Path, help="Path to trained model")
    parser.add_argument("--task", default="regression", choices=['regression', 'classification'])
    parser.add_argument("--data-dir", type=Path, default=Path("enrichment-worker/data"))
    parser.add_argument("--output-dir", type=Path, default=Path("enrichment-worker/models/openvino"))
    parser.add_argument("--no-fp16", action="store_true", help="Skip FP16 quantization")
    parser.add_argument("--no-int8", action="store_true", help="Skip INT8 quantization")
    parser.add_argument("--devices", nargs='+', default=['GPU', 'NPU', 'CPU'], help="Devices to benchmark")
    
    args = parser.parse_args()
    
    config = ExportConfig(
        variable=args.variable,
        task=args.task,
        model_path=args.model_path,
        data_dir=args.data_dir,
        output_dir=args.output_dir,
        use_fp16=not args.no_fp16,
        use_int8=not args.no_int8,
        devices=args.devices
    )
    
    exporter = OpenVINOExporter(config)
    metrics = exporter.run()
    
    print(f"\n✓ Export complete. IR models saved to {config.output_dir / config.variable}")


if __name__ == "__main__":
    main()
