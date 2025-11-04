# CRITICAL: Ollama NOT WORKING on HF Spaces FREE Tier

## Problem
- Ollama times out (120s) in Stage 1 rerank
- Ollama hangs forever in Stage 2 generation
- HF Space logs show `Read timed out` for localhost:11434
- FREE CPU tier (2 vCPU, 16GB RAM) can't run Ollama reliably

## Evidence
```
[!]  Ollama rerank error: HTTPConnectionPool(host='localhost', port=11434): Read timed out. (read timeout=120)
```

Stage 2 hangs at:
```
[DEBUG] About to call Ollama: http://localhost:11434/api/generate
[DEBUG] Timeout: 360s, Model: phi3:mini
```
Never prints "[DEBUG] Ollama stream started!" - meaning requests.post() hangs before getting response.

## Solution Options

### Option 1: Use HF Inference API for Stage 2 (RECOMMENDED)
- Already using HF API for Stage 1 embeddings (works perfectly)
- Use `Qwen/Qwen2.5-72B-Instruct` or `meta-llama/Meta-Llama-3.1-8B-Instruct`
- Cost: FREE with HF_TOKEN (rate limited but sufficient)
- Latency: 2-5s (vs Ollama's never-finishing)

### Option 2: Upgrade to GPU tier
- Cost: $0.60/hour = $432/month (NOT FREE)
- User explicitly wants $0/month solution

### Option 3: Remove Stage 2 entirely
- Keep Stage 1 only (analytical data)
- No poems/tips/closing_line
- User will not accept this

## Recommendation
Implement HF Inference API fallback in `post_enricher.py`:
1. Try Ollama first (timeout=10s, not 360s)
2. If Ollama fails/timeout → use HF API
3. Use same models as Stage 1 for consistency

This maintains $0/month cost while actually working.
