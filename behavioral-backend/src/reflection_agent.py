"""
Reflection Analysis & Sync Agent for Leo Revamp
Implements the spec from the October 2025 prompt.
"""
import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import time

# Imports for existing modules
from persistence import UpstashStore, TemporalPersistence
from temporal_state import TemporalStateManager
from emotion_map import EMOTION_MAP, SELF_HARM_PATTERNS, HOPELESSNESS_PATTERNS, META_COGNITIVE_MARKERS, HEDGING_MARKERS
# Placeholder for other modules
# from .event_extraction import extract_event
# from .risk import detect_risk

DEFAULT_TIMEZONE = "Asia/Kolkata"
ANALYSIS_VERSION = "1.0.0"

DEFAULT_TIMEZONE = "Asia/Kolkata"
ANALYSIS_VERSION = "1.0.0"

class ReflectionAnalysisAgent:
    def __init__(self, upstash_store: UpstashStore):
        self.upstash = upstash_store
        self.temporal_persistence = TemporalPersistence(upstash_store.redis)
        self.temporal_manager = TemporalStateManager(self.temporal_persistence)

    def process_reflection(self, reflection_json: Dict[str, Any]) -> Dict[str, Any]:
        start_time = time.time()
        # 1. Validate & normalize
        rid = reflection_json.get("rid")
        owner_id = reflection_json.get("owner_id")
        pig_id = reflection_json.get("pig_id")
        timestamp = reflection_json.get("timestamp")
        consent_flags = reflection_json.get("consent_flags", {})
        # Handle timezone alias and fallback
        client_ctx = reflection_json.get("client_context", {}) or {}
        client_tz = client_ctx.get("timezone")
        # Normalize timezone: treat Asia/Calcutta as Asia/Kolkata
        if client_tz and client_tz.strip().lower() == "asia/calcutta":
            client_tz = "Asia/Kolkata"
        timezone_used = client_tz if self._is_valid_timezone(client_tz) else DEFAULT_TIMEZONE
        # Use normalized_text or fallback to raw_text
        normalized_text = reflection_json.get("normalized_text")
        if not normalized_text:
            normalized_text = reflection_json.get("raw_text")
        # Required field check
        if not (rid and owner_id and pig_id and timestamp and normalized_text):
            return self._error("missing_required_fields", rid)
        # Convert timestamp to UTC and local
        try:
            utc_dt = self._to_utc(timestamp, timezone_used)
            local_dt = self._to_local(utc_dt, timezone_used)
        except Exception:
            return self._error("invalid_timestamp", rid)
        # 2. Load history
        history = self.upstash.get_reflections_by_owner_in_days(owner_id, days=180, limit=500)
        # Respect consent_flags: if research false, limit to short-term (e.g., last 7 days)
        if not consent_flags.get("research", True):
            history = [h for h in history if (utc_dt - self._to_utc(h["timestamp"], timezone_used)).days <= 7]
        # Compute baselines using temporal manager
        baselines = self._compute_baselines(history, utc_dt, consent_flags)
        # 3. Compute hash for idempotency
        hash_of_input = self._hash_input(rid, timestamp, normalized_text)
        prev_analysis = (reflection_json.get("analysis") or {})
        if prev_analysis.get("hash_of_input") == hash_of_input:
            return reflection_json  # idempotent, no-op
        # 4. Extract signals (placeholders for now)
        event = self._extract_event(normalized_text)
        feelings = self._extract_feelings(normalized_text)
        self_awareness = self._score_self_awareness(normalized_text)
        risk = self._detect_risk(normalized_text)
        # 5. Temporal features
        temporal = self._compute_temporal_features(history, reflection_json, utc_dt, consent_flags, baselines)
        # 6. Recursion/event chaining
        recursion = self._compute_recursion(history, normalized_text, rid)
        # 7. Compose analysis object
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
            "tags_auto": event.get("entities", []) + [event.get("context_type", "")],
            "insights": self._generate_insights(event, feelings, temporal, recursion),
            "provenance": self._provenance_stub(),
        }
        # 8. Merge and persist
        merged = dict(reflection_json)
        merged["analysis"] = analysis
        latency_ms = int((time.time() - start_time) * 1000)
        merged["analysis"]["provenance"]["latency_ms"] = latency_ms
        self.upstash.save_reflection_by_rid(rid, merged)
        self.upstash.update_indices(owner_id, pig_id, rid, utc_dt)
        return merged

    def _is_valid_timezone(self, tz: Optional[str]) -> bool:
        # TODO: Implement robust IANA timezone validation
        return bool(tz and isinstance(tz, str) and tz)

    def _to_utc(self, timestamp: str, tz: str) -> datetime:
        # Parse ISO timestamp, assume it's in UTC if Z, else in tz
        if timestamp.endswith('Z'):
            return datetime.fromisoformat(timestamp[:-1]).replace(tzinfo=timezone.utc)
        else:
            # Assume it's in the given tz
            import pytz
            local_tz = pytz.timezone(tz)
            dt = datetime.fromisoformat(timestamp)
            return local_tz.localize(dt).astimezone(timezone.utc)

    def _to_local(self, utc_dt: datetime, tz: str) -> datetime:
        import pytz
        local_tz = pytz.timezone(tz)
        return utc_dt.astimezone(local_tz)

    def _hash_input(self, rid: str, timestamp: str, normalized_text: str) -> str:
        s = f"{rid}|{timestamp}|{normalized_text}"
        return hashlib.sha256(s.encode("utf-8")).hexdigest()

    def _extract_event(self, text: str) -> Dict[str, Any]:
        # Stub: extract summary, entities, context_type
        if "friends" in text.lower():
            summary = "Met friends after many days"
            entities = ["friends", "meetup"]
            context_type = "social"
        else:
            summary = "General reflection"
            entities = []
            context_type = "general"
        return {"summary": summary, "entities": entities, "context_type": context_type}

    def _extract_feelings(self, text: str) -> Dict[str, Any]:
        if not text.strip():
            return {"invoked": None, "expressed": None, "congruence": None}
        # Invoked: map to Willcox wheel
        primary_emotion = "neutral"
        secondary = "indifference"
        score = 0.5
        for emotion, (v, a) in EMOTION_MAP.items():
            if emotion.lower() in text.lower():
                primary_emotion = emotion
                score = 0.8  # stub
                break
        invoked = {"primary": primary_emotion, "secondary": secondary, "score": score}
        # Expressed: simple sentiment from text (stub)
        valence = 0.0
        arousal = 0.3
        if "great" in text.lower() or "good" in text.lower():
            valence = 0.7
            arousal = 0.5
        elif "bad" in text.lower() or "sad" in text.lower():
            valence = -0.5
            arousal = 0.4
        expressed = {"valence": valence, "arousal": arousal, "confidence": 0.8}
        # Congruence: similarity
        congruence = 0.8  # stub
        return {"invoked": invoked, "expressed": expressed, "congruence": congruence}

    def _score_self_awareness(self, text: str) -> Dict[str, Any]:
        if not text.strip():
            return {"clarity": None, "depth": None, "authenticity": None, "effort": None, "expression_control": None, "composite": None}
        text_lower = text.lower()
        meta_count = sum(1 for m in META_COGNITIVE_MARKERS if m in text_lower)
        hedge_count = sum(1 for h in HEDGING_MARKERS if h in text_lower)
        clarity = min(1.0, meta_count / 5.0)  # stub
        depth = clarity * 0.7
        authenticity = 1.0 - (hedge_count / 5.0)
        effort = clarity
        expression_control = authenticity
        composite = (clarity + depth + authenticity + effort + expression_control) / 5.0
        return {
            "clarity": clarity,
            "depth": depth,
            "authenticity": authenticity,
            "effort": effort,
            "expression_control": expression_control,
            "composite": composite
        }

    def _detect_risk(self, text: str) -> Dict[str, Any]:
        if not text.strip():
            return {"level": "none", "signals": [], "policy": "nonclinical-screen", "explanations": []}
        text_lower = text.lower()
        self_harm = any(p in text_lower for p in SELF_HARM_PATTERNS)
        hopelessness = any(p in text_lower for p in HOPELESSNESS_PATTERNS)
        level = "none"
        signals = []
        explanations = []
        if self_harm or hopelessness:
            level = "high"
            signals = ["self_harm"] if self_harm else ["hopelessness"]
            explanations = ["Detected phrases indicating self-harm or hopelessness."]
        return {"level": level, "signals": signals, "policy": "nonclinical-screen", "explanations": explanations}

    def _compute_baselines(self, history: List[Dict], utc_dt: datetime, consent_flags: Dict) -> Dict[str, Any]:
        # Compute rolling baselines
        if not history:
            return {"valence_7": None, "arousal_7": None, "valence_90": None, "arousal_90": None}
        # Simple averages for now
        valences = [h.get("valence", 0) for h in history]
        arousals = [h.get("arousal", 0.3) for h in history]
        valence_7 = sum(valences[-7:]) / len(valences[-7:]) if valences[-7:] else None
        arousal_7 = sum(arousals[-7:]) / len(arousals[-7:]) if arousals[-7:] else None
        valence_90 = sum(valences) / len(valences) if valences else None
        arousal_90 = sum(arousals) / len(arousals) if arousals else None
        return {"valence_7": valence_7, "arousal_7": arousal_7, "valence_90": valence_90, "arousal_90": arousal_90}

    def _compute_temporal_features(self, history, reflection_json, utc_dt, consent_flags, baselines) -> Dict[str, Any]:
        if not history:
            return {"short_term_momentum": {"valence_delta_7": None, "arousal_delta_7": None}, "long_term_baseline": {"valence_z": None, "arousal_z": None, "baseline_window_days": 90}, "seasonality": {"day_of_week": utc_dt.strftime("%A"), "hour_bucket": "Morning" if utc_dt.hour < 12 else "Afternoon", "is_typical_time": False}, "streaks": {"positive_valence_days": 0, "negative_valence_days": 0}}
        # Compute deltas
        current_v = reflection_json.get("valence", 0)
        current_a = reflection_json.get("arousal", 0.3)
        valence_delta_7 = current_v - (baselines["valence_7"] or 0)
        arousal_delta_7 = current_a - (baselines["arousal_7"] or 0.3)
        # Z-scores
        valence_z = (current_v - (baselines["valence_90"] or 0)) / 0.5 if baselines["valence_90"] else None
        arousal_z = (current_a - (baselines["arousal_90"] or 0.3)) / 0.2 if baselines["arousal_90"] else None
        # Seasonality
        dow = utc_dt.strftime("%A")
        hour_bucket = "Morning" if utc_dt.hour < 12 else "Afternoon" if utc_dt.hour < 18 else "Evening"
        is_typical = True  # stub
        # Streaks: stub
        streaks = {"positive_valence_days": 1 if current_v > 0 else 0, "negative_valence_days": 1 if current_v < 0 else 0}
        return {"short_term_momentum": {"valence_delta_7": valence_delta_7, "arousal_delta_7": arousal_delta_7}, "long_term_baseline": {"valence_z": valence_z, "arousal_z": arousal_z, "baseline_window_days": 90}, "seasonality": {"day_of_week": dow, "hour_bucket": hour_bucket, "is_typical_time": is_typical}, "streaks": streaks}

    def _compute_recursion(self, history, text, current_rid) -> Dict[str, Any]:
        current_entities = set(self._extract_event(text)["entities"])
        linked = []
        for h in history[-10:]:  # last 10 for simplicity
            h_text = h.get("normalized_text", h.get("raw_text", ""))
            h_entities = set(self._extract_event(h_text)["entities"])
            if current_entities and h_entities:
                jaccard = len(current_entities & h_entities) / len(current_entities | h_entities)
                if jaccard >= 0.4:
                    linked.append(h["rid"])
                    if len(linked) >= 3:
                        break
        link_method = "jaccard" if linked else ""
        thread_insight = "Similar social events tend to improve mood." if linked else ""
        return {"linked_prior_rids": linked, "link_method": link_method, "thread_insight": thread_insight}

    def _generate_insights(self, event, feelings, temporal, recursion) -> List[str]:
        insights = []
        if feelings["expressed"]["valence"] > 0.5:
            insights.append("Positive social contact aligns with above-baseline valence.")
        if temporal["long_term_baseline"]["valence_z"] and temporal["long_term_baseline"]["valence_z"] > 0.5:
            insights.append("Consider scheduling at least one friend meetup weekly.")
        return insights

    def _provenance_stub(self) -> Dict[str, Any]:
        # TODO: Fill with actual model/version info
        return {
            "models": {
                "event_extractor": "rules@v1",
                "sentiment_regressor": "rules@v1",
                "emotion_mapper": "rules+embedding@v1",
                "safety_classifier": "rules@v1",
                "embedding": "none@v1"
            },
            "thresholds": {"recursion_link_cosine": 0.80, "recursion_link_jaccard": 0.40},
            "latency_ms": 0  # will be set later
        }

    def _error(self, code, rid=None):
        return {"error": {"code": code, "rid": rid}}

# Example usage (to be replaced with actual wiring)
# persistence = ...
# agent = ReflectionAnalysisAgent(persistence)
# result = agent.process_reflection(reflection_json)
