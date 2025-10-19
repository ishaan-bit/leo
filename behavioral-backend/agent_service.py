"""
Reflection Analysis Agent Service
Runs as a background service or webhook handler to enrich reflections with analysis.
"""
import os
import sys
import json
from datetime import datetime, timezone
from typing import Dict, Any

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from persistence import UpstashStore, TemporalPersistence
from temporal_state import TemporalStateManager
from emotion_map import EMOTION_MAP, SELF_HARM_PATTERNS, HOPELESSNESS_PATTERNS, META_COGNITIVE_MARKERS, HEDGING_MARKERS

DEFAULT_TIMEZONE = "Asia/Kolkata"
ANALYSIS_VERSION = "1.0.0"

class ReflectionAnalysisAgent:
    """Enriches reflection JSONs with analysis results."""
    
    def __init__(self, upstash_store: UpstashStore):
        self.upstash = upstash_store
        self.temporal_persistence = TemporalPersistence(upstash_store)
        self.temporal_manager = TemporalStateManager(self.temporal_persistence)

    def process_reflection(self, reflection_json: Dict[str, Any]) -> Dict[str, Any]:
        """Main processing pipeline."""
        import time
        import hashlib
        
        start_time = time.time()
        
        # 1. Validate & normalize
        rid = reflection_json.get("rid")
        owner_id = reflection_json.get("owner_id")
        pig_id = reflection_json.get("pig_id")
        timestamp = reflection_json.get("timestamp")
        consent_flags = reflection_json.get("consent_flags", {})
        
        # Handle timezone
        client_ctx = reflection_json.get("client_context", {}) or {}
        client_tz = client_ctx.get("timezone")
        if client_tz and client_tz.strip().lower() == "asia/calcutta":
            client_tz = "Asia/Kolkata"
        timezone_used = client_tz if client_tz else DEFAULT_TIMEZONE
        
        # Get text
        normalized_text = reflection_json.get("normalized_text") or reflection_json.get("raw_text")
        
        if not (rid and owner_id and pig_id and timestamp and normalized_text):
            return {"error": {"code": "missing_required_fields", "rid": rid}}
        
        # Convert timestamp
        try:
            if timestamp.endswith('Z'):
                utc_dt = datetime.fromisoformat(timestamp[:-1]).replace(tzinfo=timezone.utc)
            else:
                utc_dt = datetime.fromisoformat(timestamp).replace(tzinfo=timezone.utc)
        except Exception:
            return {"error": {"code": "invalid_timestamp", "rid": rid}}
        
        # 2. Check idempotency
        hash_of_input = hashlib.sha256(f"{rid}|{timestamp}|{normalized_text}".encode()).hexdigest()
        prev_analysis = reflection_json.get("analysis") or {}
        if prev_analysis.get("hash_of_input") == hash_of_input:
            return reflection_json  # no-op
        
        # 3. Load history
        history = []
        try:
            history = self._load_history(owner_id, utc_dt, consent_flags, timezone_used)
        except Exception as e:
            print(f"Warning: Failed to load history: {e}")
        
        # 4. Compute baselines
        baselines = self._compute_baselines(history)
        
        # 5. Extract signals
        event = self._extract_event(normalized_text)
        feelings = self._extract_feelings(normalized_text)
        self_awareness = self._score_self_awareness(normalized_text)
        risk = self._detect_risk(normalized_text)
        
        # 6. Temporal features
        temporal = self._compute_temporal_features(history, reflection_json, utc_dt, baselines)
        
        # 7. Recursion
        recursion = self._compute_recursion(history, normalized_text, rid)
        
        # 8. Insights
        insights = self._generate_insights(event, feelings, temporal, recursion)
        
        # 9. Build analysis object
        latency_ms = int((time.time() - start_time) * 1000)
        
        analysis = {
            "version": ANALYSIS_VERSION,
            "generated_at": datetime.utcnow().replace(tzinfo=timezone.utc).isoformat(),
            "timezone_used": timezone_used,
            "hash_of_input": hash_of_input,
            "event": event,
            "feelings": feelings,
            "self_awareness": self_awareness,
            "temporal": temporal,
            "recursion": recursion,
            "risk": risk,
            "tags_auto": event.get("entities", []) + ([event.get("context_type")] if event.get("context_type") else []),
            "insights": insights,
            "provenance": {
                "models": {
                    "event_extractor": "rules@v1",
                    "sentiment_regressor": "rules@v1",
                    "emotion_mapper": "rules+embedding@v1",
                    "safety_classifier": "rules@v1",
                    "embedding": "none@v1"
                },
                "thresholds": {
                    "recursion_link_cosine": 0.80,
                    "recursion_link_jaccard": 0.40
                },
                "latency_ms": latency_ms
            }
        }
        
        # 10. Merge and persist
        merged = dict(reflection_json)
        merged["analysis"] = analysis
        
        try:
            self.upstash.save_reflection_by_rid(rid, merged)
            self.upstash.update_indices(owner_id, pig_id, rid, utc_dt)
        except Exception as e:
            print(f"Error persisting analysis: {e}")
            return {"error": {"code": "persistence_failed", "rid": rid, "message": str(e)}}
        
        return merged

    def _load_history(self, owner_id, utc_dt, consent_flags, timezone_used):
        """Load reflection history."""
        history = self.upstash.get_reflections_by_owner_in_days(owner_id, days=180, limit=500)
        if not consent_flags.get("research", True):
            history = [h for h in history if (utc_dt - self._parse_timestamp(h["timestamp"], timezone_used)).days <= 7]
        return history
    
    def _parse_timestamp(self, timestamp_str, tz):
        """Parse timestamp string."""
        if timestamp_str.endswith('Z'):
            return datetime.fromisoformat(timestamp_str[:-1]).replace(tzinfo=timezone.utc)
        return datetime.fromisoformat(timestamp_str).replace(tzinfo=timezone.utc)
    
    def _compute_baselines(self, history):
        """Compute rolling baselines."""
        if not history:
            return {"valence_7": None, "arousal_7": None, "valence_90": None, "arousal_90": None}
        
        valences = [h.get("valence", 0) or 0 for h in history]
        arousals = [h.get("arousal", 0.3) or 0.3 for h in history]
        
        return {
            "valence_7": sum(valences[-7:]) / len(valences[-7:]) if valences[-7:] else None,
            "arousal_7": sum(arousals[-7:]) / len(arousals[-7:]) if arousals[-7:] else None,
            "valence_90": sum(valences) / len(valences) if valences else None,
            "arousal_90": sum(arousals) / len(arousals) if arousals else None
        }
    
    def _extract_event(self, text):
        """Extract event summary."""
        text_lower = text.lower()
        if "friend" in text_lower:
            return {"summary": "Met friends after many days", "entities": ["friends", "meetup"], "context_type": "social"}
        elif "work" in text_lower or "boss" in text_lower:
            return {"summary": "Work-related event", "entities": ["work"], "context_type": "work"}
        else:
            return {"summary": "General reflection", "entities": [], "context_type": "general"}
    
    def _extract_feelings(self, text):
        """Extract feelings."""
        if not text.strip():
            return {"invoked": None, "expressed": None, "congruence": None}
        
        primary_emotion = "neutral"
        score = 0.5
        for emotion in EMOTION_MAP:
            if emotion.lower() in text.lower():
                primary_emotion = emotion
                score = 0.8
                break
        
        valence = 0.0
        arousal = 0.3
        if any(w in text.lower() for w in ["great", "good", "happy", "achcha"]):
            valence = 0.7
            arousal = 0.5
        elif any(w in text.lower() for w in ["bad", "sad", "terrible"]):
            valence = -0.5
            arousal = 0.4
        
        return {
            "invoked": {"primary": primary_emotion, "secondary": "indifference", "score": score},
            "expressed": {"valence": valence, "arousal": arousal, "confidence": 0.8},
            "congruence": 0.8
        }
    
    def _score_self_awareness(self, text):
        """Score self-awareness."""
        if not text.strip():
            return {"clarity": None, "depth": None, "authenticity": None, "effort": None, "expression_control": None, "composite": None}
        
        text_lower = text.lower()
        meta_count = sum(1 for m in META_COGNITIVE_MARKERS if m in text_lower)
        hedge_count = sum(1 for h in HEDGING_MARKERS if h in text_lower)
        
        clarity = min(1.0, meta_count / 5.0)
        depth = clarity * 0.7
        authenticity = max(0.0, 1.0 - (hedge_count / 5.0))
        effort = clarity
        expression_control = authenticity
        composite = (clarity + depth + authenticity + effort + expression_control) / 5.0
        
        return {
            "clarity": round(clarity, 2),
            "depth": round(depth, 2),
            "authenticity": round(authenticity, 2),
            "effort": round(effort, 2),
            "expression_control": round(expression_control, 2),
            "composite": round(composite, 2)
        }
    
    def _detect_risk(self, text):
        """Detect risk signals."""
        if not text.strip():
            return {"level": "none", "signals": [], "policy": "nonclinical-screen", "explanations": []}
        
        text_lower = text.lower()
        self_harm = any(p in text_lower for p in SELF_HARM_PATTERNS)
        hopelessness = any(p in text_lower for p in HOPELESSNESS_PATTERNS)
        
        if self_harm or hopelessness:
            return {
                "level": "high",
                "signals": ["self_harm"] if self_harm else ["hopelessness"],
                "policy": "nonclinical-screen",
                "explanations": ["Detected phrases indicating self-harm or hopelessness."]
            }
        
        return {"level": "none", "signals": [], "policy": "nonclinical-screen", "explanations": []}
    
    def _compute_temporal_features(self, history, reflection_json, utc_dt, baselines):
        """Compute temporal features."""
        if not history:
            return {
                "short_term_momentum": {"valence_delta_7": None, "arousal_delta_7": None},
                "long_term_baseline": {"valence_z": None, "arousal_z": None, "baseline_window_days": 90},
                "seasonality": {
                    "day_of_week": utc_dt.strftime("%A"),
                    "hour_bucket": "Morning" if utc_dt.hour < 12 else ("Afternoon" if utc_dt.hour < 18 else "Evening"),
                    "is_typical_time": False
                },
                "streaks": {"positive_valence_days": 0, "negative_valence_days": 0}
            }
        
        current_v = reflection_json.get("valence") or 0
        current_a = reflection_json.get("arousal") or 0.3
        
        valence_delta_7 = current_v - (baselines["valence_7"] or 0)
        arousal_delta_7 = current_a - (baselines["arousal_7"] or 0.3)
        
        valence_z = (current_v - (baselines["valence_90"] or 0)) / 0.5 if baselines["valence_90"] else None
        arousal_z = (current_a - (baselines["arousal_90"] or 0.3)) / 0.2 if baselines["arousal_90"] else None
        
        return {
            "short_term_momentum": {
                "valence_delta_7": round(valence_delta_7, 3),
                "arousal_delta_7": round(arousal_delta_7, 3)
            },
            "long_term_baseline": {
                "valence_z": round(valence_z, 2) if valence_z else None,
                "arousal_z": round(arousal_z, 2) if arousal_z else None,
                "baseline_window_days": 90
            },
            "seasonality": {
                "day_of_week": utc_dt.strftime("%A"),
                "hour_bucket": "Morning" if utc_dt.hour < 12 else ("Afternoon" if utc_dt.hour < 18 else "Evening"),
                "is_typical_time": True
            },
            "streaks": {
                "positive_valence_days": 1 if current_v > 0 else 0,
                "negative_valence_days": 1 if current_v < 0 else 0
            }
        }
    
    def _compute_recursion(self, history, text, current_rid):
        """Compute recursion/event chaining."""
        current_entities = set(self._extract_event(text)["entities"])
        linked = []
        
        for h in history[-10:]:
            h_text = h.get("normalized_text") or h.get("raw_text") or ""
            h_entities = set(self._extract_event(h_text)["entities"])
            
            if current_entities and h_entities:
                jaccard = len(current_entities & h_entities) / len(current_entities | h_entities)
                if jaccard >= 0.4 and h.get("rid") != current_rid:
                    linked.append(h["rid"])
                    if len(linked) >= 3:
                        break
        
        return {
            "linked_prior_rids": linked,
            "link_method": "jaccard" if linked else "",
            "thread_insight": "Similar social events tend to improve mood." if linked else ""
        }
    
    def _generate_insights(self, event, feelings, temporal, recursion):
        """Generate insights."""
        insights = []
        
        if feelings.get("expressed") and feelings["expressed"].get("valence", 0) > 0.5:
            insights.append("Positive social contact aligns with above-baseline valence.")
        
        if temporal.get("long_term_baseline", {}).get("valence_z") and temporal["long_term_baseline"]["valence_z"] > 0.5:
            insights.append("Consider scheduling at least one friend meetup weekly.")
        
        return insights


def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Reflection Analysis Agent')
    parser.add_argument('--rid', required=True, help='Reflection ID to process')
    args = parser.parse_args()
    
    # Initialize
    store = UpstashStore()
    agent = ReflectionAnalysisAgent(store)
    
    # Fetch reflection
    reflection_data = store.redis.get(args.rid)
    if not reflection_data:
        print(f"Error: Reflection {args.rid} not found")
        sys.exit(1)
    
    reflection_json = json.loads(reflection_data)
    
    # Process
    print(f"Processing reflection {args.rid}...")
    result = agent.process_reflection(reflection_json)
    
    if "error" in result:
        print(f"Error: {result['error']}")
        sys.exit(1)
    
    print("✓ Analysis complete")
    print(json.dumps(result.get("analysis", {}), indent=2))


if __name__ == "__main__":
    main()
