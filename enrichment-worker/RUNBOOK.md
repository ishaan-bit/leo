# Enrichment Pipeline v2.2 - Operations Runbook

## Overview

This runbook provides operational procedures, failure modes, debugging steps, and monitoring guidance for the Leo Enrichment Pipeline v2.2.

## System Health Monitoring

### Key Performance Indicators (KPIs)

**Latency Targets:**
- P50 latency: < 50ms
- P95 latency: < 100ms
- P99 latency: < 200ms

**Quality Targets:**
- Primary Emotion F1: ≥ 0.78
- Secondary Emotion F1: ≥ 0.70
- Tertiary Emotion F1: ≥ 0.60
- Domain Accuracy: ≥ 0.85
- Expected Calibration Error (ECE): ≤ 0.08

**Availability:**
- Uptime: ≥ 99.5%
- Queue processing rate: > 10 reflections/sec
- Ollama availability: ≥ 99%

### Health Check Endpoints

**Worker Status:**
```bash
# Check Redis worker status
curl http://localhost:8001/healthz
```

Expected response:
```json
{
  "ollama": "ok",
  "redis": "ok",
  "status": "healthy",
  "model": "phi3:latest",
  "queue_length": 0,
  "processed_count": 42
}
```

**Redis Worker Status Key:**
```bash
# Get worker status from Redis
redis-cli GET worker:status
```

Expected format:
```json
{
  "status": "healthy|degraded|down",
  "timestamp": "2025-10-20T12:00:00Z",
  "details": {
    "processed_count": 42,
    "queue_length": 0,
    "last_processed": "2025-10-20T11:59:30Z"
  }
}
```

## Common Failure Modes

### 1. Negation Not Detected

**Symptoms:**
- "I'm not happy" → Returns Happy instead of Sad
- Negation flag is always `false`
- Valence scores are inverted

**Root Causes:**
- Negation module not integrated into pipeline
- Negation patterns not matching input text
- Valence adjustment not applied

**Debugging Steps:**
```python
# Test negation detection directly
from src.enrich.negation import analyze_negation

text = "I'm not happy"
result = analyze_negation(text)
print(result)
# Expected: NegationResult(present=True, strength=0.40, ...)
```

**Resolution:**
1. Check `pipeline_v2_2.py` imports `analyze_negation`
2. Verify negation detection is called before emotion scoring
3. Ensure `apply_negation_to_valence()` is applied to emotion_valence
4. Review negation patterns in `negation.py` for coverage

**Prevention:**
- Add negation test cases to Golden Set
- Monitor negation flag rate (expect ~15-20% of reflections)
- Alert if negation flag rate drops below 10%

---

### 2. Neutral Emotion Over-Predicted

**Symptoms:**
- 50%+ of reflections return Neutral as primary emotion
- Clear emotional content is misclassified as Neutral
- "I'm excited" → Returns Neutral

**Root Causes:**
- Neutral detection threshold too low
- Emotion keyword detection not working
- Missing arousal/valence checks

**Debugging Steps:**
```python
# Test neutral detection
from src.enrich.neutral_detection import is_neutral_emotion

text = "I'm excited about tomorrow"
is_neutral, reason = is_neutral_emotion(
    text=text,
    emotion_valence=0.75,
    arousal=0.85,
    emotion_presence="moderate"
)
print(f"Neutral: {is_neutral}, Reason: {reason}")
# Expected: False (should detect Happy/Excited, not Neutral)
```

**Resolution:**
1. Review neutral detection criteria in `neutral_detection.py`
2. Ensure emotion keyword detection is enabled
3. Set stricter neutral threshold: only return if emotion_presence="none"
4. Add arousal check: high arousal (> 0.6) should not be Neutral

**Prevention:**
- Monitor Neutral prediction rate (expect ~5-10%)
- Alert if Neutral rate exceeds 20%
- Add diverse emotion examples to Golden Set

---

### 3. Litotes Not Detected

**Symptoms:**
- "wasn't bad" → Returns negative emotion instead of positive
- "not terrible" → Returns Fearful instead of Peaceful
- Litotes flag is always `false`

**Root Causes:**
- Litotes patterns incomplete (missing "wasn't", "isn't" variations)
- Litotes flip factor not applied
- Pattern matching case-sensitive

**Debugging Steps:**
```python
# Test litotes detection
from src.enrich.negation import analyze_negation

text = "The meeting wasn't bad"
result = analyze_negation(text)
print(result)
# Expected: NegationResult(is_litotes=True, flip_factor=0.40, ...)
```

**Resolution:**
1. Update litotes patterns to include variations:
   - "not bad", "wasn't bad", "isn't bad", "weren't bad"
   - "not terrible", "wasn't terrible", "not a terrible"
2. Ensure flip_factor is positive (0.40 for "bad", 0.45 for "terrible")
3. Apply litotes flip to valence: `valence = valence + flip_factor`

**Prevention:**
- Add litotes test cases: "wasn't bad", "not terrible", "isn't awful"
- Monitor litotes flag rate (expect ~2-5%)
- Alert if litotes rate drops to 0%

---

### 4. Profanity Not Boosting Angry

**Symptoms:**
- "f***ing exhausted" → Returns Sad instead of Angry
- "damn tired" → Returns Fearful instead of Angry
- Profanity flag present but no Angry boost

**Root Causes:**
- Profanity keywords not in Angry scoring logic
- Profanity boost factor too low
- Profanity detection happening after emotion scoring

**Debugging Steps:**
```python
# Test profanity detection
from src.enrich.pipeline_v2_2 import score_primary_emotions_simple

text = "I'm f***ing tired of this"
scores = score_primary_emotions_simple(
    text=text,
    emotion_valence=0.25,
    arousal=0.65,
    emotion_presence="strong"
)
print(scores)
# Expected: Angry should have high score due to profanity
```

**Resolution:**
1. Add profanity keywords to Angry emotion scoring:
   - "f***", "f***ing", "damn", "hell", "shit", "pissed"
2. Set profanity boost factor: +0.30 to Angry score
3. Ensure profanity detection runs before emotion scoring
4. Flag profanity presence in output: `flags.has_profanity = True`

**Prevention:**
- Monitor profanity flag rate (expect ~5-8%)
- Add profanity test cases to Golden Set
- Alert if profanity+Angry correlation drops below 60%

---

### 5. Low Confidence Scores

**Symptoms:**
- Confidence scores consistently < 0.5
- Expected Calibration Error (ECE) > 0.08
- Over-confident predictions (confidence 0.9 but accuracy 0.6)

**Root Causes:**
- Confidence calibration not applied
- Calibration method not fitted on sufficient data
- Temperature parameter suboptimal

**Debugging Steps:**
```python
# Test confidence calibration
from src.enrich.calibration import ConfidenceCalibrator, calculate_ece

# Load historical predictions
confidences = np.array([0.6, 0.7, 0.8, 0.9])
accuracies = np.array([0.5, 0.6, 0.7, 0.8])  # Under-confident

# Fit calibrator
calibrator = ConfidenceCalibrator()
calibrator.fit(confidences, accuracies, method='temperature_scaling')

# Calibrate new predictions
new_conf = np.array([0.75])
calibrated = calibrator.calibrate(new_conf)

# Check ECE
ece = calculate_ece(calibrated, accuracies)
print(f"ECE: {ece:.4f}")  # Target: ≤ 0.08
```

**Resolution:**
1. Choose calibration method:
   - **Temperature Scaling**: Fast, single parameter (recommended)
   - **Platt Scaling**: Logistic regression, 2 parameters
   - **Isotonic Regression**: Non-parametric, for large datasets
2. Fit calibrator on ≥ 200 labeled examples
3. Apply calibration in pipeline: `confidence_calibrated = calibrator.calibrate(confidence_raw)`
4. Monitor ECE: should be ≤ 0.08

**Prevention:**
- Re-fit calibrator weekly with new labeled data
- Monitor ECE daily
- Alert if ECE > 0.10
- Compare all 3 calibration methods, use best performer

---

### 6. Ollama Timeout / Unavailable

**Symptoms:**
- Worker logs show "Ollama timeout" errors
- Health endpoint returns `"ollama": "error"`
- Queue length growing rapidly

**Root Causes:**
- Ollama service not running
- Ollama model not pulled
- GPU out of memory
- Network issues

**Debugging Steps:**
```bash
# Check Ollama service
ollama list

# Test Ollama inference
ollama run phi3 "Test message"

# Check GPU memory (if using GPU)
nvidia-smi

# Test from Python
python -c "from src.modules.ollama_client import OllamaClient; c = OllamaClient(); print(c.is_available())"
```

**Resolution:**
1. Restart Ollama service:
   ```bash
   ollama serve
   ```
2. Pull model if missing:
   ```bash
   ollama pull phi3
   ```
3. Clear GPU memory:
   ```bash
   # Restart Ollama to free GPU
   pkill ollama
   ollama serve
   ```
4. Increase timeout in `.env`:
   ```
   OLLAMA_TIMEOUT=30000  # 30 seconds
   ```

**Prevention:**
- Monitor Ollama availability every 60 seconds
- Alert if Ollama down for > 2 minutes
- Set up Ollama auto-restart on failure
- Consider fallback to CPU if GPU fails

---

### 7. Redis Connection Lost

**Symptoms:**
- Worker logs show "Redis connection failed"
- Health endpoint returns `"redis": "error"`
- Queue not processing

**Root Causes:**
- Upstash Redis service down
- Network connectivity issues
- Invalid credentials in `.env`
- Rate limit exceeded

**Debugging Steps:**
```bash
# Test Redis connection
python -c "from src.modules.redis_client import get_redis; r = get_redis(); print(r.ping())"

# Check credentials
cat .env | grep UPSTASH

# Test manually
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://YOUR_REDIS_URL.upstash.io/ping
```

**Resolution:**
1. Verify credentials in `.env`:
   - `UPSTASH_REDIS_REST_URL` is correct
   - `UPSTASH_REDIS_REST_TOKEN` is valid
2. Check Upstash dashboard for service status
3. Implement retry logic with exponential backoff
4. Consider Redis connection pooling

**Prevention:**
- Monitor Redis availability every 60 seconds
- Alert if Redis down for > 1 minute
- Set up Redis failover (if available)
- Cache recent reflections locally for resilience

---

### 8. Slow Processing / Queue Backlog

**Symptoms:**
- Queue length growing (> 100 reflections)
- Latency P95 > 200ms
- Worker processing < 5 reflections/sec

**Root Causes:**
- Ollama inference slow (CPU-only mode)
- Analytics computations too heavy
- Redis round-trip latency high
- Worker polling interval too high

**Debugging Steps:**
```python
# Profile enrichment pipeline
import time
from src.enrich.pipeline_v2_2 import enrich_v2_2

text = "I'm feeling tired today"
start = time.time()
result = enrich_v2_2(
    text=text,
    user_history=[],  # Empty for speed test
    include_tertiary=True,
    include_neutral=True
)
elapsed = (time.time() - start) * 1000
print(f"Latency: {elapsed:.2f}ms")
```

**Resolution:**
1. **Use GPU for Ollama**: 5-10x speedup
   ```bash
   # Check GPU available
   nvidia-smi
   
   # Restart Ollama with GPU
   OLLAMA_GPU=1 ollama serve
   ```
2. **Reduce analytics window**:
   - Lower `ZSCORE_WINDOW_DAYS` from 90 to 30
   - Reduce EMA windows from [1, 7, 28] to [1, 7]
3. **Optimize Redis calls**:
   - Batch fetch user history (MGET instead of multiple GETs)
   - Use pipeline for multiple writes
4. **Increase worker polling interval**:
   ```
   WORKER_POLL_MS=1000  # Increase from 500ms to 1000ms
   ```
5. **Disable heavy features temporarily**:
   - Set `include_tertiary=False` (saves ~20ms)
   - Disable recursion detection if not needed

**Prevention:**
- Monitor P95 latency continuously
- Alert if P95 > 150ms for > 5 minutes
- Scale horizontally: run multiple workers
- Profile pipeline regularly to identify bottlenecks

---

## Monitoring & Alerting

### Metrics to Track

**Throughput:**
- Reflections processed per minute
- Queue depth (target: < 10)
- Processing success rate (target: > 99%)

**Latency:**
- P50, P95, P99 enrichment latency
- Ollama inference time
- Redis read/write time

**Quality:**
- Emotion prediction accuracy (Golden Set)
- ECE (Expected Calibration Error)
- Neutral prediction rate
- Negation detection rate
- Litotes detection rate
- Profanity detection rate

**Availability:**
- Ollama uptime
- Redis uptime
- Worker uptime

### Alert Thresholds

**Critical (Page immediately):**
- Worker down for > 5 minutes
- Ollama down for > 2 minutes
- Redis down for > 1 minute
- Queue depth > 500
- Processing success rate < 90%

**Warning (Investigate within 1 hour):**
- P95 latency > 150ms for > 10 minutes
- ECE > 0.10
- Neutral rate > 25%
- Negation rate < 10%
- Processing success rate < 98%

**Info (Review daily):**
- P95 latency > 100ms
- Neutral rate outside [5%, 15%]
- Profanity rate outside [3%, 10%]

### Logging Best Practices

**Structured JSON Logging:**
```python
from src.enrich.observability import StructuredLogger

logger = StructuredLogger(service_name="enrichment-worker")
logger.info("Processing reflection", extra={
    "rid": "refl_123",
    "sid": "sess_456",
    "latency_ms": 85.3,
    "primary_emotion": "Happy",
    "confidence": 0.78
})
```

**PII Masking:**
```python
from src.enrich.observability import PIIMasker

masker = PIIMasker()
masked_text = masker.mask(user_text)  # Emails, phones, SSN masked
logger.info("User input", extra={"text": masked_text})
```

**Request Tracing:**
- Include `request_id` in all logs
- Track request through entire pipeline
- Log start/end of each stage

---

## Performance Tuning

### Latency Optimization

**Target: P95 < 100ms**

1. **Ollama GPU**: 5-10x speedup
2. **Batch processing**: Process 10 reflections at once
3. **Cache common patterns**: Cache emotion scores for frequent phrases
4. **Reduce analytics**: Disable non-critical features
5. **Connection pooling**: Reuse Redis connections

### Memory Optimization

**Target: < 1GB per worker**

1. **Limit user history**: Only load last 30 reflections (not 90)
2. **Clear caches**: Periodically clear emotion scoring caches
3. **Reduce model size**: Use smaller Ollama model (phi3-mini)

### Accuracy Optimization

**Target: Primary F1 ≥ 0.78**

1. **Expand Golden Set**: Add 200+ labeled examples
2. **Tune emotion thresholds**: Adjust primary emotion thresholds
3. **Improve keyword detection**: Add domain-specific keywords
4. **Re-train calibrator**: Fit on larger labeled dataset

---

## Disaster Recovery

### Worker Crash

**Scenario:** Worker process crashes unexpectedly

**Recovery Steps:**
1. Check worker logs for error:
   ```bash
   tail -n 100 worker.log
   ```
2. Restart worker:
   ```bash
   python worker.py
   ```
3. Verify health:
   ```bash
   curl http://localhost:8001/healthz
   ```
4. Check queue for backlog:
   ```bash
   redis-cli LLEN reflections:normalized
   ```
5. Process backlog (worker auto-processes on restart)

**Prevention:**
- Set up process monitor (systemd, supervisor, Docker restart policy)
- Add worker auto-restart on crash

### Ollama Crash

**Scenario:** Ollama service crashes or becomes unresponsive

**Recovery Steps:**
1. Kill Ollama process:
   ```bash
   pkill ollama
   ```
2. Clear GPU memory:
   ```bash
   nvidia-smi --gpu-reset
   ```
3. Restart Ollama:
   ```bash
   ollama serve
   ```
4. Pull model again if needed:
   ```bash
   ollama pull phi3
   ```
5. Test inference:
   ```bash
   ollama run phi3 "Test"
   ```

**Prevention:**
- Monitor Ollama availability every 60 seconds
- Set up Ollama auto-restart
- Consider CPU fallback if GPU fails

### Redis Connection Lost

**Scenario:** Upstash Redis service is down or unreachable

**Recovery Steps:**
1. Check Upstash status page
2. Verify credentials in `.env`
3. Test connection manually:
   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" \
     https://YOUR_REDIS_URL.upstash.io/ping
   ```
4. If credentials expired, regenerate in Upstash dashboard
5. Update `.env` with new credentials
6. Restart worker

**Prevention:**
- Set up Redis failover (if available)
- Cache recent reflections locally
- Implement retry logic with exponential backoff

---

## Operational Procedures

### Daily Checklist

- [ ] Check worker health: `curl http://localhost:8001/healthz`
- [ ] Review queue depth: `redis-cli LLEN reflections:normalized`
- [ ] Check P95 latency in logs
- [ ] Verify ECE ≤ 0.08
- [ ] Review error rate in logs
- [ ] Check Ollama/Redis availability

### Weekly Checklist

- [ ] Re-fit confidence calibrator with new labeled data
- [ ] Review Golden Set performance
- [ ] Update emotion keywords based on user feedback
- [ ] Profile pipeline for performance bottlenecks
- [ ] Review and update alert thresholds
- [ ] Check disk space / log rotation

### Monthly Checklist

- [ ] Expand Golden Set with new examples
- [ ] Benchmark against quality targets (F1 scores)
- [ ] Review and update documentation
- [ ] Test disaster recovery procedures
- [ ] Update dependencies (pip, Ollama model)
- [ ] Conduct operational review meeting

---

## Troubleshooting Commands

```bash
# Check worker process
ps aux | grep worker.py

# Check worker logs
tail -f worker.log

# Test Ollama
ollama run phi3 "I'm feeling happy"

# Test Redis
redis-cli PING

# Check queue length
redis-cli LLEN reflections:normalized

# Process one reflection manually
redis-cli RPOP reflections:normalized

# Get worker status from Redis
redis-cli GET worker:status

# Check GPU usage
nvidia-smi

# Test Python imports
python -c "from src.enrich.pipeline_v2_2 import enrich_v2_2; print('OK')"

# Run tests
pytest tests/ -v

# Profile latency
python -m cProfile -s cumtime worker.py

# Check disk space
df -h

# Check memory usage
free -h
```

---

## Contact & Escalation

**Primary On-Call:** DevOps Team  
**Secondary On-Call:** ML Engineering Team  
**Escalation Path:** Engineering Lead → CTO

**Documentation:**
- README.md - Setup and overview
- API_CONTRACT.md - Schema documentation
- MIGRATION_v2.0_to_v2.2.md - Upgrade guide

**Support Channels:**
- Slack: #enrichment-worker
- Email: devops@example.com
- Incident Management: PagerDuty

---

## Version History

- **v2.2** (Current): Added confidence calibration, observability, PII masking
- **v2.1**: Added tertiary emotions, graded negation, litotes
- **v2.0**: Dual valence, neutral detection, domain taxonomy
- **v1.5**: Sarcasm detection, profanity coupling
- **v1.0**: Initial release with 6 primary emotions
