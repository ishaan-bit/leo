"""
Confidence Calibration Module

Implements Expected Calibration Error (ECE) calculation and calibration methods:
1. Temperature Scaling - Single parameter optimization
2. Platt Scaling - Logistic regression on confidence scores
3. Isotonic Regression - Non-parametric monotonic mapping

Target: ECE ≤ 0.08
"""

import numpy as np
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from scipy.optimize import minimize_scalar


@dataclass
class CalibrationMetrics:
    """Metrics for confidence calibration quality"""
    ece: float  # Expected Calibration Error
    mce: float  # Maximum Calibration Error
    ace: float  # Average Calibration Error
    num_bins: int
    bin_accuracies: List[float]
    bin_confidences: List[float]
    bin_counts: List[int]


class ConfidenceCalibrator:
    """Calibrate confidence scores to match actual accuracy"""
    
    def __init__(self, method: str = "temperature", n_bins: int = 10):
        """
        Args:
            method: Calibration method ("temperature", "platt", "isotonic", or "none")
            n_bins: Number of bins for ECE calculation
        """
        self.method = method
        self.n_bins = n_bins
        self.is_fitted = False
        
        # Calibration parameters
        self.temperature = 1.0  # For temperature scaling
        self.platt_model = None  # For Platt scaling
        self.isotonic_model = None  # For isotonic regression
    
    def calculate_ece(
        self,
        confidences: np.ndarray,
        correctness: np.ndarray,
        n_bins: Optional[int] = None
    ) -> CalibrationMetrics:
        """
        Calculate Expected Calibration Error.
        
        ECE = Σ (|accuracy - confidence|) * (n_samples_in_bin / n_total)
        
        Args:
            confidences: Confidence scores [0, 1]
            correctness: Binary correctness (1 = correct, 0 = incorrect)
            n_bins: Number of bins (default: self.n_bins)
        
        Returns:
            CalibrationMetrics with ECE and bin statistics
        """
        if n_bins is None:
            n_bins = self.n_bins
        
        # Create bins
        bin_boundaries = np.linspace(0, 1, n_bins + 1)
        bin_lowers = bin_boundaries[:-1]
        bin_uppers = bin_boundaries[1:]
        
        bin_accuracies = []
        bin_confidences = []
        bin_counts = []
        
        ece = 0.0
        mce = 0.0  # Maximum calibration error
        total_samples = len(confidences)
        
        for bin_lower, bin_upper in zip(bin_lowers, bin_uppers):
            # Find samples in this bin
            in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
            prop_in_bin = in_bin.sum() / total_samples
            
            if prop_in_bin > 0:
                # Calculate accuracy in this bin
                accuracy_in_bin = correctness[in_bin].mean()
                avg_confidence_in_bin = confidences[in_bin].mean()
                
                # Calibration error for this bin
                bin_error = abs(avg_confidence_in_bin - accuracy_in_bin)
                
                # Add to ECE (weighted by proportion)
                ece += bin_error * prop_in_bin
                
                # Track maximum error
                mce = max(mce, bin_error)
                
                bin_accuracies.append(accuracy_in_bin)
                bin_confidences.append(avg_confidence_in_bin)
                bin_counts.append(in_bin.sum())
            else:
                bin_accuracies.append(0.0)
                bin_confidences.append((bin_lower + bin_upper) / 2)
                bin_counts.append(0)
        
        # Average Calibration Error (unweighted)
        non_empty_bins = [i for i, count in enumerate(bin_counts) if count > 0]
        if non_empty_bins:
            ace = np.mean([
                abs(bin_confidences[i] - bin_accuracies[i])
                for i in non_empty_bins
            ])
        else:
            ace = 0.0
        
        return CalibrationMetrics(
            ece=ece,
            mce=mce,
            ace=ace,
            num_bins=n_bins,
            bin_accuracies=bin_accuracies,
            bin_confidences=bin_confidences,
            bin_counts=bin_counts
        )
    
    def fit(
        self,
        confidences: np.ndarray,
        correctness: np.ndarray
    ) -> 'ConfidenceCalibrator':
        """
        Fit calibration model on training data.
        
        Args:
            confidences: Raw confidence scores [0, 1]
            correctness: Binary correctness (1 = correct, 0 = incorrect)
        
        Returns:
            Self (for chaining)
        """
        confidences = np.array(confidences)
        correctness = np.array(correctness)
        
        if self.method == "temperature":
            # Optimize temperature parameter to minimize ECE
            def objective(temp):
                calibrated = self._apply_temperature_scaling(confidences, temp)
                metrics = self.calculate_ece(calibrated, correctness)
                return metrics.ece
            
            # Search for optimal temperature
            result = minimize_scalar(objective, bounds=(0.1, 5.0), method='bounded')
            self.temperature = result.x
        
        elif self.method == "platt":
            # Fit logistic regression: P(correct | confidence)
            # Transform to logits
            eps = 1e-10
            logits = np.log((confidences + eps) / (1 - confidences + eps))
            
            self.platt_model = LogisticRegression()
            self.platt_model.fit(logits.reshape(-1, 1), correctness)
        
        elif self.method == "isotonic":
            # Fit isotonic regression (non-parametric monotonic)
            self.isotonic_model = IsotonicRegression(out_of_bounds='clip')
            self.isotonic_model.fit(confidences, correctness)
        
        elif self.method == "none":
            # No calibration
            pass
        
        else:
            raise ValueError(f"Unknown calibration method: {self.method}")
        
        self.is_fitted = True
        return self
    
    def calibrate(self, confidences: np.ndarray) -> np.ndarray:
        """
        Apply calibration to confidence scores.
        
        Args:
            confidences: Raw confidence scores [0, 1]
        
        Returns:
            Calibrated confidence scores [0, 1]
        """
        if not self.is_fitted and self.method != "none":
            raise ValueError("Calibrator must be fitted before use")
        
        confidences = np.array(confidences)
        
        if self.method == "temperature":
            return self._apply_temperature_scaling(confidences, self.temperature)
        
        elif self.method == "platt":
            eps = 1e-10
            logits = np.log((confidences + eps) / (1 - confidences + eps))
            return self.platt_model.predict_proba(logits.reshape(-1, 1))[:, 1]
        
        elif self.method == "isotonic":
            return self.isotonic_model.predict(confidences)
        
        elif self.method == "none":
            return confidences
        
        else:
            raise ValueError(f"Unknown calibration method: {self.method}")
    
    def _apply_temperature_scaling(
        self,
        confidences: np.ndarray,
        temperature: float
    ) -> np.ndarray:
        """
        Apply temperature scaling to confidence scores.
        
        Temperature scaling: p' = σ(logit(p) / T)
        where σ is sigmoid function, T is temperature
        
        T > 1: Softens (more uncertain)
        T < 1: Sharpens (more confident)
        T = 1: No change
        """
        eps = 1e-10
        
        # Convert to logits
        logits = np.log((confidences + eps) / (1 - confidences + eps))
        
        # Scale by temperature
        scaled_logits = logits / temperature
        
        # Convert back to probabilities via sigmoid
        calibrated = 1 / (1 + np.exp(-scaled_logits))
        
        return calibrated
    
    def evaluate(
        self,
        confidences: np.ndarray,
        correctness: np.ndarray,
        verbose: bool = False
    ) -> CalibrationMetrics:
        """
        Evaluate calibration quality.
        
        Args:
            confidences: Confidence scores [0, 1]
            correctness: Binary correctness
            verbose: Print detailed metrics
        
        Returns:
            CalibrationMetrics
        """
        metrics = self.calculate_ece(confidences, correctness)
        
        if verbose:
            print(f"Calibration Metrics ({self.method}):")
            print(f"  ECE: {metrics.ece:.4f} (target: ≤0.08)")
            print(f"  MCE: {metrics.mce:.4f}")
            print(f"  ACE: {metrics.ace:.4f}")
            print(f"  Bins: {metrics.num_bins}")
            print(f"  Status: {'✅ PASS' if metrics.ece <= 0.08 else '❌ FAIL'}")
            
            if verbose:
                print("\nPer-bin breakdown:")
                for i, (conf, acc, count) in enumerate(
                    zip(metrics.bin_confidences, metrics.bin_accuracies, metrics.bin_counts)
                ):
                    if count > 0:
                        print(f"  Bin {i+1}: conf={conf:.3f}, acc={acc:.3f}, "
                              f"n={count}, error={abs(conf-acc):.3f}")
        
        return metrics


def compare_calibration_methods(
    confidences: np.ndarray,
    correctness: np.ndarray,
    train_size: float = 0.8,
    verbose: bool = True
) -> Dict[str, CalibrationMetrics]:
    """
    Compare different calibration methods.
    
    Args:
        confidences: Confidence scores
        correctness: Binary correctness
        train_size: Proportion for training (rest for testing)
        verbose: Print comparison
    
    Returns:
        Dictionary mapping method name to CalibrationMetrics
    """
    n = len(confidences)
    split_idx = int(n * train_size)
    
    # Split train/test
    train_conf = confidences[:split_idx]
    train_correct = correctness[:split_idx]
    test_conf = confidences[split_idx:]
    test_correct = correctness[split_idx:]
    
    methods = ["none", "temperature", "platt", "isotonic"]
    results = {}
    
    for method in methods:
        calibrator = ConfidenceCalibrator(method=method)
        
        if method != "none":
            calibrator.fit(train_conf, train_correct)
            calibrated_conf = calibrator.calibrate(test_conf)
        else:
            calibrated_conf = test_conf
        
        metrics = calibrator.calculate_ece(calibrated_conf, test_correct)
        results[method] = metrics
        
        if verbose:
            status = "✅" if metrics.ece <= 0.08 else "❌"
            print(f"{status} {method:12s}: ECE={metrics.ece:.4f}, "
                  f"MCE={metrics.mce:.4f}, ACE={metrics.ace:.4f}")
    
    if verbose:
        best_method = min(results.keys(), key=lambda m: results[m].ece)
        print(f"\nBest method: {best_method} (ECE={results[best_method].ece:.4f})")
    
    return results


__all__ = [
    'CalibrationMetrics',
    'ConfidenceCalibrator',
    'compare_calibration_methods'
]
