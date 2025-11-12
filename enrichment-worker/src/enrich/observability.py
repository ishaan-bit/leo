"""
Observability Module for Enrichment Pipeline v2.2

Provides:
1. Structured JSON logging with PII masking
2. Metrics collection (latency, confidence, distributions)
3. Feature flags for A/B testing
4. Dashboard-ready output schema
"""

import json
import re
import time
import hashlib
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum


class LogLevel(Enum):
    """Log severity levels"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"


@dataclass
class EnrichmentMetrics:
    """Metrics captured during enrichment"""
    # Timing
    total_latency_ms: float
    feature_extraction_ms: float
    valence_computation_ms: float
    primary_scoring_ms: float
    secondary_selection_ms: float
    tertiary_detection_ms: float
    
    # Confidence
    overall_confidence: float
    neutral_confidence_adjustment: float
    tertiary_confidence: Optional[float]
    
    # Outputs
    primary_emotion: str
    secondary_emotion: Optional[str]
    tertiary_emotion: Optional[str]
    domain: str
    control_level: str
    polarity: str
    
    # Flags
    negation_detected: bool
    sarcasm_detected: bool
    profanity_detected: bool
    is_emotion_neutral: bool
    is_event_neutral: bool
    
    # Input characteristics
    text_length: int
    word_count: int
    sentence_count: int


@dataclass
class FeatureFlags:
    """Feature flags for A/B testing and gradual rollouts"""
    # v1.5 Features
    sarcasm_v1_5_enabled: bool = True
    va_consolidation_v1_5_enabled: bool = True
    
    # v2.0 Features
    negation_graded_enabled: bool = True
    polarity_vader_enabled: bool = True
    
    # v2.2 Features
    neutral_detection_enabled: bool = True
    tertiary_detection_enabled: bool = True
    
    # Experimental
    experimental_hinglish_enabled: bool = False
    experimental_multimodal_enabled: bool = False


class PIIMasker:
    """Masks personally identifiable information in text"""
    
    # Regex patterns for PII
    EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
    PHONE_PATTERN = re.compile(r'\b(?:\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}\b')
    SSN_PATTERN = re.compile(r'\b\d{3}-\d{2}-\d{4}\b')
    CREDIT_CARD_PATTERN = re.compile(r'\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b')
    
    @staticmethod
    def mask_text(text: str, hash_pii: bool = False) -> str:
        """
        Mask PII in text.
        
        Args:
            text: Input text potentially containing PII
            hash_pii: If True, replace with deterministic hash. If False, use generic placeholder.
        
        Returns:
            Masked text
        """
        if hash_pii:
            # Replace with deterministic hash (useful for tracking same user)
            text = PIIMasker.EMAIL_PATTERN.sub(
                lambda m: f"EMAIL_{PIIMasker._hash(m.group())[:8]}", text
            )
            text = PIIMasker.PHONE_PATTERN.sub(
                lambda m: f"PHONE_{PIIMasker._hash(m.group())[:8]}", text
            )
        else:
            # Replace with generic placeholder
            text = PIIMasker.EMAIL_PATTERN.sub("[EMAIL]", text)
            text = PIIMasker.PHONE_PATTERN.sub("[PHONE]", text)
        
        text = PIIMasker.SSN_PATTERN.sub("[SSN]", text)
        text = PIIMasker.CREDIT_CARD_PATTERN.sub("[CREDIT_CARD]", text)
        
        return text
    
    @staticmethod
    def _hash(value: str) -> str:
        """Create deterministic hash of PII"""
        return hashlib.sha256(value.encode()).hexdigest()


class StructuredLogger:
    """Structured JSON logger for enrichment pipeline"""
    
    def __init__(
        self,
        service_name: str = "enrichment-v2.2",
        mask_pii: bool = True,
        hash_pii: bool = False
    ):
        self.service_name = service_name
        self.mask_pii = mask_pii
        self.hash_pii = hash_pii
        self.masker = PIIMasker()
    
    def log(
        self,
        level: LogLevel,
        message: str,
        metrics: Optional[EnrichmentMetrics] = None,
        metadata: Optional[Dict[str, Any]] = None,
        input_text: Optional[str] = None
    ) -> None:
        """
        Log structured JSON event.
        
        Args:
            level: Log severity
            message: Human-readable message
            metrics: Optional enrichment metrics
            metadata: Optional additional context
            input_text: Optional input text (will be masked if mask_pii=True)
        """
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "service": self.service_name,
            "level": level.value,
            "message": message,
        }
        
        if input_text and self.mask_pii:
            log_entry["input_text"] = self.masker.mask_text(input_text, self.hash_pii)
        elif input_text:
            log_entry["input_text"] = input_text
        
        if metrics:
            log_entry["metrics"] = asdict(metrics)
        
        if metadata:
            log_entry["metadata"] = metadata
        
        # Print as JSON (in production, send to logging service)
        print(json.dumps(log_entry))
    
    def debug(self, message: str, **kwargs):
        """Log DEBUG level"""
        self.log(LogLevel.DEBUG, message, **kwargs)
    
    def info(self, message: str, **kwargs):
        """Log INFO level"""
        self.log(LogLevel.INFO, message, **kwargs)
    
    def warn(self, message: str, **kwargs):
        """Log WARN level"""
        self.log(LogLevel.WARN, message, **kwargs)
    
    def error(self, message: str, **kwargs):
        """Log ERROR level"""
        self.log(LogLevel.ERROR, message, **kwargs)


class MetricsAggregator:
    """Aggregates metrics for dashboard/monitoring"""
    
    def __init__(self):
        self.metrics_buffer: List[EnrichmentMetrics] = []
        self.start_time = time.time()
    
    def add(self, metrics: EnrichmentMetrics) -> None:
        """Add metrics to buffer"""
        self.metrics_buffer.append(metrics)
    
    def get_summary(self) -> Dict[str, Any]:
        """
        Get aggregated metrics summary.
        
        Returns:
            Dictionary with aggregated statistics
        """
        if not self.metrics_buffer:
            return {"error": "No metrics collected"}
        
        n = len(self.metrics_buffer)
        
        # Latency statistics
        latencies = [m.total_latency_ms for m in self.metrics_buffer]
        avg_latency = sum(latencies) / n
        p50_latency = sorted(latencies)[n // 2]
        p95_latency = sorted(latencies)[int(n * 0.95)]
        p99_latency = sorted(latencies)[int(n * 0.99)]
        
        # Confidence statistics
        confidences = [m.overall_confidence for m in self.metrics_buffer]
        avg_confidence = sum(confidences) / n
        
        # Primary emotion distribution
        primary_dist = {}
        for m in self.metrics_buffer:
            primary_dist[m.primary_emotion] = primary_dist.get(m.primary_emotion, 0) + 1
        
        # Domain distribution
        domain_dist = {}
        for m in self.metrics_buffer:
            domain_dist[m.domain] = domain_dist.get(m.domain, 0) + 1
        
        # Flag statistics
        negation_rate = sum(1 for m in self.metrics_buffer if m.negation_detected) / n
        sarcasm_rate = sum(1 for m in self.metrics_buffer if m.sarcasm_detected) / n
        profanity_rate = sum(1 for m in self.metrics_buffer if m.profanity_detected) / n
        neutral_emotion_rate = sum(1 for m in self.metrics_buffer if m.is_emotion_neutral) / n
        neutral_event_rate = sum(1 for m in self.metrics_buffer if m.is_event_neutral) / n
        
        return {
            "period": {
                "start": datetime.fromtimestamp(self.start_time).isoformat(),
                "end": datetime.utcnow().isoformat(),
                "sample_count": n
            },
            "latency": {
                "avg_ms": round(avg_latency, 2),
                "p50_ms": round(p50_latency, 2),
                "p95_ms": round(p95_latency, 2),
                "p99_ms": round(p99_latency, 2)
            },
            "confidence": {
                "avg": round(avg_confidence, 3),
                "distribution": self._get_distribution_bins(confidences, [0.45, 0.60, 0.75])
            },
            "primary_emotion_distribution": primary_dist,
            "domain_distribution": domain_dist,
            "flags": {
                "negation_rate": round(negation_rate, 3),
                "sarcasm_rate": round(sarcasm_rate, 3),
                "profanity_rate": round(profanity_rate, 3),
                "neutral_emotion_rate": round(neutral_emotion_rate, 3),
                "neutral_event_rate": round(neutral_event_rate, 3)
            }
        }
    
    @staticmethod
    def _get_distribution_bins(values: List[float], thresholds: List[float]) -> Dict[str, int]:
        """Bin values by thresholds"""
        bins = {f"<{thresholds[0]}": 0}
        for i in range(len(thresholds) - 1):
            bins[f"{thresholds[i]}-{thresholds[i+1]}"] = 0
        bins[f">={thresholds[-1]}"] = 0
        
        for v in values:
            if v < thresholds[0]:
                bins[f"<{thresholds[0]}"] += 1
            elif v >= thresholds[-1]:
                bins[f">={thresholds[-1]}"] += 1
            else:
                for i in range(len(thresholds) - 1):
                    if thresholds[i] <= v < thresholds[i+1]:
                        bins[f"{thresholds[i]}-{thresholds[i+1]}"] += 1
                        break
        
        return bins
    
    def reset(self) -> None:
        """Clear metrics buffer"""
        self.metrics_buffer = []
        self.start_time = time.time()


# Singleton instances
logger = StructuredLogger()
metrics_aggregator = MetricsAggregator()
feature_flags = FeatureFlags()


def get_logger() -> StructuredLogger:
    """Get global logger instance"""
    return logger


def get_metrics_aggregator() -> MetricsAggregator:
    """Get global metrics aggregator"""
    return metrics_aggregator


def get_feature_flags() -> FeatureFlags:
    """Get global feature flags"""
    return feature_flags


__all__ = [
    'LogLevel',
    'EnrichmentMetrics',
    'FeatureFlags',
    'PIIMasker',
    'StructuredLogger',
    'MetricsAggregator',
    'get_logger',
    'get_metrics_aggregator',
    'get_feature_flags'
]
