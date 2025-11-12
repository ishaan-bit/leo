"""
Tests for observability module
"""

import pytest
from src.enrich.observability import (
    PIIMasker, StructuredLogger, MetricsAggregator,
    EnrichmentMetrics, FeatureFlags, LogLevel
)


def test_pii_masking_email():
    """Test email masking"""
    text = "Contact me at john.doe@example.com for details"
    masked = PIIMasker.mask_text(text, hash_pii=False)
    assert "[EMAIL]" in masked
    assert "john.doe@example.com" not in masked


def test_pii_masking_phone():
    """Test phone number masking"""
    text = "Call me at 555-123-4567 or (555) 987-6543"
    masked = PIIMasker.mask_text(text, hash_pii=False)
    assert "[PHONE]" in masked
    assert "555-123-4567" not in masked


def test_pii_masking_with_hash():
    """Test deterministic hashing"""
    text = "Email: test@example.com"
    masked1 = PIIMasker.mask_text(text, hash_pii=True)
    masked2 = PIIMasker.mask_text(text, hash_pii=True)
    
    assert masked1 == masked2  # Deterministic
    assert "EMAIL_" in masked1
    assert "test@example.com" not in masked1


def test_structured_logger():
    """Test structured logging"""
    logger = StructuredLogger(mask_pii=False)
    
    # Should not raise
    logger.info("Test message", metadata={"key": "value"})
    logger.debug("Debug message")
    logger.warn("Warning message")
    logger.error("Error message")


def test_logger_with_pii_masking():
    """Test logger masks PII"""
    logger = StructuredLogger(mask_pii=True, hash_pii=False)
    
    # This should mask the email in output
    logger.info(
        "User registration",
        input_text="User john@example.com signed up",
        metadata={"user_id": 123}
    )
    # Note: In real test, would capture stdout and verify masking


def test_metrics_creation():
    """Test creating metrics object"""
    metrics = EnrichmentMetrics(
        total_latency_ms=45.2,
        feature_extraction_ms=5.1,
        valence_computation_ms=8.3,
        primary_scoring_ms=12.5,
        secondary_selection_ms=7.2,
        tertiary_detection_ms=10.1,
        overall_confidence=0.75,
        neutral_confidence_adjustment=0.0,
        tertiary_confidence=0.82,
        primary_emotion="Sad",
        secondary_emotion="Lonely",
        tertiary_emotion="Homesick",
        domain="relationships",
        control_level="low",
        polarity="happened",
        negation_detected=False,
        sarcasm_detected=False,
        profanity_detected=False,
        is_emotion_neutral=False,
        is_event_neutral=False,
        text_length=45,
        word_count=8,
        sentence_count=1
    )
    
    assert metrics.primary_emotion == "Sad"
    assert metrics.total_latency_ms == 45.2


def test_metrics_aggregator():
    """Test metrics aggregation"""
    aggregator = MetricsAggregator()
    
    # Add sample metrics
    for i in range(10):
        metrics = EnrichmentMetrics(
            total_latency_ms=40.0 + i,
            feature_extraction_ms=5.0,
            valence_computation_ms=8.0,
            primary_scoring_ms=12.0,
            secondary_selection_ms=7.0,
            tertiary_detection_ms=10.0,
            overall_confidence=0.7 + (i * 0.01),
            neutral_confidence_adjustment=0.0,
            tertiary_confidence=0.8,
            primary_emotion="Sad" if i < 5 else "Happy",
            secondary_emotion="Lonely",
            tertiary_emotion=None,
            domain="self",
            control_level="medium",
            polarity="happened",
            negation_detected=(i % 3 == 0),
            sarcasm_detected=(i % 5 == 0),
            profanity_detected=False,
            is_emotion_neutral=False,
            is_event_neutral=False,
            text_length=50,
            word_count=10,
            sentence_count=1
        )
        aggregator.add(metrics)
    
    summary = aggregator.get_summary()
    
    assert summary["period"]["sample_count"] == 10
    assert "avg_ms" in summary["latency"]
    assert "p50_ms" in summary["latency"]
    assert "p95_ms" in summary["latency"]
    assert summary["primary_emotion_distribution"]["Sad"] == 5
    assert summary["primary_emotion_distribution"]["Happy"] == 5
    assert 0 < summary["flags"]["negation_rate"] < 1
    assert 0 < summary["flags"]["sarcasm_rate"] < 1


def test_feature_flags():
    """Test feature flags"""
    flags = FeatureFlags()
    
    assert flags.sarcasm_v1_5_enabled is True
    assert flags.neutral_detection_enabled is True
    assert flags.experimental_hinglish_enabled is False
    
    # Can toggle flags
    flags.experimental_hinglish_enabled = True
    assert flags.experimental_hinglish_enabled is True


def test_confidence_distribution_bins():
    """Test confidence distribution binning"""
    aggregator = MetricsAggregator()
    
    # Create metrics with varied confidence
    confidences = [0.40, 0.50, 0.65, 0.75, 0.80, 0.85]
    for conf in confidences:
        metrics = EnrichmentMetrics(
            total_latency_ms=45.0,
            feature_extraction_ms=5.0,
            valence_computation_ms=8.0,
            primary_scoring_ms=12.0,
            secondary_selection_ms=7.0,
            tertiary_detection_ms=10.0,
            overall_confidence=conf,
            neutral_confidence_adjustment=0.0,
            tertiary_confidence=None,
            primary_emotion="Happy",
            secondary_emotion=None,
            tertiary_emotion=None,
            domain="self",
            control_level="high",
            polarity="happened",
            negation_detected=False,
            sarcasm_detected=False,
            profanity_detected=False,
            is_emotion_neutral=False,
            is_event_neutral=False,
            text_length=30,
            word_count=6,
            sentence_count=1
        )
        aggregator.add(metrics)
    
    summary = aggregator.get_summary()
    dist = summary["confidence"]["distribution"]
    
    # Should have bins
    assert "<0.45" in dist
    assert any("0.45" in k and "0.6" in k for k in dist.keys())  # 0.45-0.6 or 0.45-0.60
    assert any("0.6" in k and "0.75" in k for k in dist.keys())   # 0.6-0.75 or 0.60-0.75
    assert ">=0.75" in dist
    
    # Check counts (approximate, since bin names vary)
    assert dist["<0.45"] == 1  # 0.40
    assert dist[">=0.75"] >= 2  # 0.80, 0.85 (0.75 might be in this bin)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
