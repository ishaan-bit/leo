"""
Hybrid Scorer v3 - Willcox Feelings Wheel (JSON-locked)
========================================================
Drop-in replacement for OllamaClient using Gloria Willcox Feelings Wheel.
Fuses HF zero-shot + sentence embeddings + Ollama rerank.

CRITICAL: Output schema MUST exactly match ollama_client.enrich() return value.

Architecture:
1. HF Zero-Shot (0.4 weight) - Willcox primary classification (6 emotions)
2. Sentence Embeddings (0.3 weight) - Similarity against Willcox secondary/tertiary + driver/surface lexicons
3. Ollama Phi3 (0.3 weight) - Rerank and propose primary/secondary/tertiary
4. Deterministic Correction - Validate hierarchy, reject contradictory events, reconcile valence/arousal
5. Serialize to EXACT schema worker.py expects

Emotion Taxonomy (Willcox Feelings Wheel):
  Primary (6): Joyful, Powerful, Peaceful, Sad, Mad, Scared
  Secondary (6 per primary): e.g., Joyful → [optimistic, proud, content, playful, interested, accepted]
  Tertiary (6 per secondary): e.g., proud → [confident, fulfilled, satisfied, amused, curious, respected]

Output Schema (MUST MATCH ollama_client + add tertiary):
{
  "invoked": str,                    # e.g., "motivation"
  "expressed": str | list[str],      # e.g., ["reflective", "proud"]
  "wheel": {
    "primary": str,                  # Willcox primary: Joyful|Powerful|Peaceful|Sad|Mad|Scared
    "secondary": str | null,         # Willcox secondary or null
    "tertiary": str | null           # *** NEW *** Willcox tertiary or null
  },
  "valence": float,                  # [0, 1], mapped from Willcox ranges
  "arousal": float,                  # [0, 1], mapped from Willcox ranges
  "confidence": float,               # [0, 1]
  "events": list[dict],              # e.g., [{"label": "progress", "confidence": 0.9}]
  "warnings": list[str],             # e.g., []
  "willingness_cues": {              # Nested dict
    "hedges": list[str],
    "intensifiers": list[str],
    "negations": list[str],
    "self_reference": list[str]
  }
}

Usage (drop-in replacement):
  # hybrid_scorer = HybridScorer(hf_token=..., ollama_base_url=...)
  # result = hybrid_scorer.enrich(normalized_text)
  # result = hybrid_scorer.validate_and_clamp(result)  # Same API
"""

import requests
import json
import time
from typing import Optional, Dict, List, Tuple
import numpy as np


class HybridScorer:
    """
    Hybrid enrichment scorer using HF + Embeddings + Ollama
    Preserves exact output schema compatibility
    """
    
    # Willcox Feelings Wheel - Primary (6 emotions)
    WILLCOX_PRIMARY = [
        'Joyful', 'Powerful', 'Peaceful', 'Sad', 'Mad', 'Scared'
    ]
    
    # Willcox Hierarchy: Primary → Secondary (6 each) → Tertiary (6 each)
    WILLCOX_HIERARCHY = {
        'Joyful': {
            'optimistic': ['hopeful', 'inspired', 'open', 'encouraged', 'confident', 'motivated'],
            'proud': ['successful', 'confident', 'accomplished', 'worthy', 'fulfilled', 'valued'],
            'content': ['pleased', 'satisfied', 'fulfilled', 'happy', 'comfortable', 'peaceful'],
            'playful': ['aroused', 'energetic', 'free', 'amused', 'spontaneous', 'silly'],
            'interested': ['curious', 'engaged', 'fascinated', 'intrigued', 'absorbed', 'inquisitive'],
            'accepted': ['respected', 'valued', 'included', 'appreciated', 'acknowledged', 'welcomed']
        },
        'Powerful': {
            'courageous': ['daring', 'bold', 'brave', 'fearless', 'assertive', 'strong'],
            'creative': ['innovative', 'imaginative', 'inspired', 'resourceful', 'inventive', 'original'],
            'confident': ['secure', 'capable', 'competent', 'assured', 'certain', 'self-reliant'],
            'loving': ['affectionate', 'warm', 'compassionate', 'tender', 'caring', 'devoted'],
            'valued': ['appreciated', 'respected', 'important', 'recognized', 'significant', 'esteemed'],
            'hopeful': ['optimistic', 'encouraged', 'expectant', 'positive', 'trusting', 'faithful']
        },
        'Peaceful': {
            'relaxed': ['calm', 'comfortable', 'rested', 'relieved', 'serene', 'tranquil'],
            'thoughtful': ['reflective', 'contemplative', 'pensive', 'considerate', 'analytical', 'meditative'],
            'intimate': ['connected', 'close', 'vulnerable', 'open', 'trusting', 'loved'],
            'thankful': ['grateful', 'appreciative', 'blessed', 'fortunate', 'content', 'satisfied'],
            'trusting': ['secure', 'safe', 'confident', 'assured', 'comfortable', 'relaxed'],
            'nurturing': ['caring', 'protective', 'supportive', 'maternal', 'loving', 'tender']
        },
        'Sad': {
            'lonely': ['isolated', 'abandoned', 'alone', 'rejected', 'empty', 'disconnected'],
            'disappointed': ['let down', 'discouraged', 'defeated', 'unhappy', 'dissatisfied', 'unfulfilled'],
            'guilty': ['regretful', 'ashamed', 'remorseful', 'sorry', 'responsible', 'blameworthy'],
            'ashamed': ['embarrassed', 'humiliated', 'mortified', 'inferior', 'inadequate', 'unworthy'],
            'abandoned': ['deserted', 'left', 'alone', 'neglected', 'forgotten', 'unwanted'],
            'bored': ['uninterested', 'indifferent', 'apathetic', 'listless', 'unstimulated', 'flat']
        },
        'Mad': {
            'hurt': ['betrayed', 'rejected', 'wounded', 'offended', 'let down', 'mistreated'],
            'hostile': ['aggressive', 'angry', 'vengeful', 'hateful', 'bitter', 'resentful'],
            'angry': ['furious', 'enraged', 'outraged', 'livid', 'irate', 'mad'],
            'selfish': ['inconsiderate', 'thoughtless', 'self-centered', 'uncaring', 'insensitive', 'entitled'],
            'hateful': ['disgusted', 'contemptuous', 'disdainful', 'scornful', 'repulsed', 'revolted'],
            'critical': ['judgmental', 'disapproving', 'cynical', 'harsh', 'demanding', 'fault-finding']
        },
        'Scared': {
            'rejected': ['inadequate', 'unworthy', 'unlovable', 'excluded', 'unwanted', 'inferior'],
            'confused': ['uncertain', 'unclear', 'lost', 'baffled', 'puzzled', 'perplexed'],
            'helpless': ['powerless', 'trapped', 'stuck', 'overwhelmed', 'incapable', 'vulnerable'],
            'anxious': ['worried', 'nervous', 'tense', 'fearful', 'uneasy', 'apprehensive'],
            'insecure': ['inadequate', 'inferior', 'unconfident', 'uncertain', 'vulnerable', 'doubtful'],
            'submissive': ['weak', 'powerless', 'passive', 'compliant', 'obedient', 'worthless']
        }
    }
    
    # Valence & Arousal ranges per Willcox primary
    WILLCOX_VA_MAP = {
        'Joyful': {'valence': (0.8, 0.9), 'arousal': (0.5, 0.65)},
        'Powerful': {'valence': (0.7, 0.85), 'arousal': (0.55, 0.7)},
        'Peaceful': {'valence': (0.75, 0.85), 'arousal': (0.3, 0.5)},
        'Sad': {'valence': (0.2, 0.4), 'arousal': (0.3, 0.5)},
        'Mad': {'valence': (0.2, 0.4), 'arousal': (0.6, 0.8)},
        'Scared': {'valence': (0.2, 0.45), 'arousal': (0.65, 0.8)}
    }
    
    # Driver lexicon (for invoked) - emotion drivers/causes
    DRIVER_LEXICON = [
        'motivation', 'agency', 'progress', 'achievement', 'recognition', 'self_acceptance',
        'connection', 'belonging', 'pride', 'relief', 'hope', 'contentment', 'awe', 'serenity',
        'fatigue', 'overwhelm', 'pressure', 'irritation', 'hurt', 'withdrawal', 'loss', 'longing',
        'self_assertion', 'exhaustion', 'frustration', 'learning', 'change', 'renewal',
        'uncertainty', 'complexity', 'gratitude', 'low_progress', 'worry', 'tension'
    ]
    
    # Surface tone lexicon (for expressed) - how emotion appears
    SURFACE_LEXICON = [
        'proud', 'reflective', 'playful', 'content', 'peaceful', 'calm', 'light', 'enthusiastic',
        'relieved', 'confident', 'motivated', 'inspired', 'grateful', 'hopeful', 'determined',
        'tense', 'confused', 'deflated', 'guarded', 'wistful', 'shaky', 'defeated', 'irritated',
        'tired', 'exhausted', 'annoyed', 'matter-of-fact', 'resigned', 'flat', 'stressed',
        'anxious', 'overwhelmed', 'withdrawn', 'vulnerable'
    ]
    
    # Contradictory event pairs (for validation)
    CONTRADICTORY_EVENTS = {
        'pride': ['low_progress', 'failure', 'inadequacy'],
        'progress': ['low_progress', 'stuck', 'stagnation'],
        'achievement': ['low_progress', 'failure'],
        'relief': ['pressure', 'overwhelm', 'tension'],
        'calm': ['anxiety', 'tension', 'overwhelm'],
        'low_progress': ['progress', 'achievement', 'pride'],
        'overwhelm': ['relief', 'calm', 'peace']
    }
    
    def __init__(
        self,
        hf_token: str,
        ollama_base_url: str = "http://localhost:11434",
        ollama_model: str = "phi3:latest",
        hf_weight: float = 0.4,
        emb_weight: float = 0.3,
        ollama_weight: float = 0.3,
        timeout: int = 30
    ):
        """
        Args:
            hf_token: Hugging Face API token
            ollama_base_url: Ollama server URL
            ollama_model: Model name (phi3:latest)
            hf_weight: Weight for HF zero-shot scores (default 0.4)
            emb_weight: Weight for embedding similarity (default 0.3)
            ollama_weight: Weight for Ollama rerank (default 0.3)
            timeout: Request timeout in seconds
        """
        self.hf_token = hf_token
        self.ollama_base_url = ollama_base_url.rstrip('/')
        self.ollama_model = ollama_model
        self.timeout = timeout
        
        # Fusion weights (must sum to 1.0)
        total = hf_weight + emb_weight + ollama_weight
        self.hf_weight = hf_weight / total
        self.emb_weight = emb_weight / total
        self.ollama_weight = ollama_weight / total
        
        # HF API endpoints
        self.hf_zeroshot_url = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli"
        self.hf_embed_url = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"
        
        print(f"🔧 HybridScorer initialized")
        print(f"   HF weight: {self.hf_weight:.2f}")
        print(f"   Embedding weight: {self.emb_weight:.2f}")
        print(f"   Ollama weight: {self.ollama_weight:.2f}")
    
    def is_available(self) -> bool:
        """Check if all dependencies are reachable"""
        try:
            # Check Ollama
            ollama_resp = requests.get(f"{self.ollama_base_url}/api/tags", timeout=5)
            ollama_ok = ollama_resp.status_code == 200
            
            # Check HF (just test with a dummy call)
            hf_resp = requests.post(
                self.hf_zeroshot_url,
                headers={"Authorization": f"Bearer {self.hf_token}"},
                json={"inputs": "test"},
                timeout=5
            )
            hf_ok = hf_resp.status_code in [200, 503]  # 503 = model loading
            
            return ollama_ok and hf_ok
        except:
            return False
    
    def enrich(self, normalized_text: str) -> Optional[Dict]:
        """
        Main enrichment pipeline - schema-compatible output
        
        Args:
            normalized_text: Normalized reflection text
        
        Returns:
            Dict matching Ollama client output schema or None if failed
        """
        start_time = time.time()
        
        try:
            print(f"\n🧠 Hybrid Enrichment Pipeline")
            print(f"   Text: {normalized_text[:80]}...")
            
            # Step 1: HF Zero-Shot for core emotions
            hf_scores = self._hf_zero_shot(normalized_text)
            if not hf_scores:
                print("⚠️  HF zero-shot failed, using fallback")
                hf_scores = {e: 0.125 for e in self.PLUTCHIK_WHEEL}  # Uniform fallback
            
            # Step 2: Embedding similarity for drivers and surface tones
            driver_scores = self._embedding_similarity(normalized_text, self.DRIVER_LEXICON)
            surface_scores = self._embedding_similarity(normalized_text, self.SURFACE_LEXICON)
            
            # Step 3: Ollama rerank
            ollama_result = self._ollama_rerank(normalized_text)
            
            # Step 4: Fuse scores
            fused = self._fuse_scores(hf_scores, driver_scores, surface_scores, ollama_result)
            
            # Step 5: Deterministic correction
            corrected = self._correct_output(fused, normalized_text)
            
            # Step 6: Serialize to exact schema format
            serialized = self._serialize_output(corrected)
            
            latency_ms = int((time.time() - start_time) * 1000)
            serialized['_latency_ms'] = latency_ms
            
            print(f"✅ Hybrid enrichment complete in {latency_ms}ms")
            print(f"   Primary: {serialized['wheel']['primary']}, Secondary: {serialized['wheel']['secondary']}")
            print(f"   Invoked: {serialized['invoked']}")
            print(f"   Expressed: {serialized['expressed']}")
            
            return serialized
            
        except Exception as e:
            print(f"❌ Hybrid enrichment error: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def _hf_zero_shot(self, text: str) -> Optional[Dict[str, float]]:
        """
        HF Zero-Shot classification for Willcox primary emotions
        
        Returns:
            Dict of emotion -> score or None
        """
        try:
            # Use all secondaries + tertiaries as candidate labels for richer matching
            candidate_labels = []
            label_to_primary = {}
            
            for primary, secondaries in self.WILLCOX_HIERARCHY.items():
                # Add primary itself
                candidate_labels.append(primary.lower())
                label_to_primary[primary.lower()] = primary
                
                # Add all secondaries
                for secondary, tertiaries in secondaries.items():
                    candidate_labels.append(secondary)
                    label_to_primary[secondary] = primary
                    
                    # Add all tertiaries
                    for tertiary in tertiaries:
                        candidate_labels.append(tertiary)
                        label_to_primary[tertiary] = primary
            
            payload = {
                "inputs": text,
                "parameters": {
                    "candidate_labels": candidate_labels,
                    "multi_label": True
                }
            }
            
            response = requests.post(
                self.hf_zeroshot_url,
                headers={"Authorization": f"Bearer {self.hf_token}"},
                json=payload,
                timeout=self.timeout
            )
            
            if response.status_code != 200:
                print(f"⚠️  HF API error {response.status_code}")
                return None
            
            result = response.json()
            
            # Aggregate scores by Willcox primary
            primary_scores = {p: 0.0 for p in self.WILLCOX_PRIMARY}
            for label, score in zip(result['labels'], result['scores']):
                primary = label_to_primary.get(label)
                if primary:
                    # Take max score for each primary
                    primary_scores[primary] = max(primary_scores[primary], score)
            
            # Softmax normalization
            scores_array = np.array(list(primary_scores.values()))
            exp_scores = np.exp(scores_array - np.max(scores_array))  # Numerical stability
            softmax_scores = exp_scores / exp_scores.sum()
            
            normalized = {p: float(s) for p, s in zip(self.WILLCOX_PRIMARY, softmax_scores)}
            
            print(f"   HF scores: {sorted(normalized.items(), key=lambda x: -x[1])[:3]}")
            
            return normalized
            
        except Exception as e:
            print(f"⚠️  HF zero-shot error: {e}")
            return None
    
    def _embedding_similarity(self, text: str, candidates: List[str]) -> Dict[str, float]:
        """
        Compute sentence embedding similarity between text and candidate labels
        
        Args:
            text: Input text
            candidates: List of candidate labels
        
        Returns:
            Dict of candidate -> similarity score
        """
        try:
            payload = {
                "inputs": {
                    "source_sentence": text,
                    "sentences": candidates
                }
            }
            
            response = requests.post(
                self.hf_embed_url,
                headers={"Authorization": f"Bearer {self.hf_token}"},
                json=payload,
                timeout=self.timeout
            )
            
            if response.status_code != 200:
                print(f"⚠️  HF embedding API error {response.status_code}")
                return {c: 0.0 for c in candidates}
            
            similarities = response.json()
            
            # Normalize to [0, 1]
            scores = np.array(similarities)
            scores = (scores - scores.min()) / (scores.max() - scores.min() + 1e-8)
            
            result = {c: float(s) for c, s in zip(candidates, scores)}
            
            # Sort and show top 3
            top_3 = sorted(result.items(), key=lambda x: -x[1])[:3]
            print(f"   Embedding top 3: {top_3}")
            
            return result
            
        except Exception as e:
            print(f"⚠️  Embedding similarity error: {e}")
            return {c: 0.0 for c in candidates}
    
    def _ollama_rerank(self, text: str) -> Optional[Dict]:
        """
        Ollama rerank with minimal deterministic prompt
        
        Returns:
            Dict with primary, secondary, invoked, expressed or None
        """
        prompt = f"""Classify the reflection into our existing wheel + drivers. Return JSON with:
primary, secondary (or null), invoked (≤3), expressed (≤3).
Rules:
- primary from {{joy,sadness,anger,fear,surprise,disgust,trust,anticipation}}
- secondary must be adjacent to primary (never choose 'disgust' unless disgust words appear)
- invoked are underlying drivers (e.g., overwhelm,fatigue,connection,progress,hurt,withdrawal)
- expressed are surface tones (e.g., tense,playful,proud,confused,deflated,guarded)
No explanations.
TEXT: \"\"\" {text}\"\"\"
Return ONLY valid JSON."""
        
        payload = {
            "model": self.ollama_model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": 200,
            }
        }
        
        try:
            response = requests.post(
                f"{self.ollama_base_url}/api/generate",
                json=payload,
                timeout=self.timeout
            )
            
            if response.status_code != 200:
                print(f"⚠️  Ollama API error {response.status_code}")
                return None
            
            result = response.json()
            raw_response = result.get('response', '')
            
            # Parse JSON
            parsed = self._parse_json(raw_response)
            
            if parsed:
                print(f"   Ollama rerank: primary={parsed.get('primary')}, secondary={parsed.get('secondary')}")
                return parsed
            else:
                print("⚠️  Failed to parse Ollama JSON")
                return None
                
        except Exception as e:
            print(f"⚠️  Ollama rerank error: {e}")
            return None
    
    def _parse_json(self, raw_text: str) -> Optional[Dict]:
        """Parse JSON from LLM response"""
        cleaned = raw_text.strip()
        
        if cleaned.startswith('```json'):
            cleaned = cleaned[7:]
        elif cleaned.startswith('```'):
            cleaned = cleaned[3:]
        
        if cleaned.endswith('```'):
            cleaned = cleaned[:-3]
        
        cleaned = cleaned.strip()
        
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            start_idx = cleaned.find('{')
            end_idx = cleaned.rfind('}')
            
            if start_idx != -1 and end_idx != -1:
                json_str = cleaned[start_idx:end_idx+1]
                try:
                    return json.loads(json_str)
                except:
                    pass
        
        return None
    
    def _fuse_scores(
        self, 
        hf_scores: Dict[str, float],
        driver_scores: Dict[str, float],
        surface_scores: Dict[str, float],
        ollama_result: Optional[Dict]
    ) -> Dict:
        """
        Fuse HF + Embeddings + Ollama into final labels
        
        Returns:
            Dict with primary, secondary, invoked, expressed, valence, arousal, confidence
        """
        # Primary emotion: weighted fusion
        fused_emotion_scores = {}
        for emotion in self.PLUTCHIK_WHEEL:
            hf_score = hf_scores.get(emotion, 0.0)
            
            # Ollama boost if it matches
            ollama_boost = 0.0
            if ollama_result and ollama_result.get('primary') == emotion:
                ollama_boost = 1.0
            
            fused_emotion_scores[emotion] = (
                self.hf_weight * hf_score + 
                self.ollama_weight * ollama_boost
            )
        
        # Pick top primary
        primary = max(fused_emotion_scores.items(), key=lambda x: x[1])[0]
        
        # Secondary: prefer Ollama if valid, else use adjacency
        secondary = None
        if ollama_result and ollama_result.get('secondary'):
            secondary_candidate = ollama_result['secondary']
            if secondary_candidate in self.ADJACENCY.get(primary, []):
                secondary = secondary_candidate
        
        if not secondary:
            # Use adjacent emotion with highest HF score
            adjacent_emotions = self.ADJACENCY.get(primary, [])
            if adjacent_emotions:
                secondary = max(adjacent_emotions, key=lambda e: hf_scores.get(e, 0.0))
        
        # Invoked: top 3 drivers from embedding similarity
        top_drivers = sorted(driver_scores.items(), key=lambda x: -x[1])[:3]
        invoked = [d[0] for d in top_drivers if d[1] > 0.1]  # Filter weak matches
        
        # Boost from Ollama if present
        if ollama_result and ollama_result.get('invoked'):
            ollama_invoked = ollama_result['invoked']
            if isinstance(ollama_invoked, list):
                invoked = list(set(invoked + ollama_invoked[:3]))[:3]
        
        # Expressed: top 2 surface tones
        top_surface = sorted(surface_scores.items(), key=lambda x: -x[1])[:2]
        expressed = [s[0] for s in top_surface if s[1] > 0.1]
        
        # Boost from Ollama
        if ollama_result and ollama_result.get('expressed'):
            ollama_expressed = ollama_result['expressed']
            if isinstance(ollama_expressed, list):
                expressed = list(set(expressed + ollama_expressed[:2]))[:2]
        
        # Valence/Arousal: Heuristic mapping from primary + text signals
        valence, arousal = self._estimate_valence_arousal(primary, hf_scores, driver_scores)
        
        # Confidence: based on agreement across models
        confidence = self._estimate_confidence(hf_scores, ollama_result, primary)
        
        return {
            'primary': primary,
            'secondary': secondary,
            'invoked': invoked,
            'expressed': expressed,
            'valence': valence,
            'arousal': arousal,
            'confidence': confidence,
        }
    
    def _estimate_valence_arousal(
        self,
        primary: str,
        hf_scores: Dict[str, float],
        driver_scores: Dict[str, float]
    ) -> Tuple[float, float]:
        """
        Estimate valence and arousal from emotion + text signals
        
        Returns:
            (valence, arousal) tuple in [0, 1]
        """
        # Base valence/arousal map for Plutchik emotions
        VA_MAP = {
            'joy': (0.8, 0.7),
            'trust': (0.7, 0.4),
            'fear': (0.3, 0.8),
            'surprise': (0.6, 0.8),
            'sadness': (0.2, 0.3),
            'disgust': (0.3, 0.5),
            'anger': (0.25, 0.75),
            'anticipation': (0.65, 0.6),
        }
        
        base_v, base_a = VA_MAP.get(primary, (0.5, 0.5))
        
        # Adjust based on driver signals
        if driver_scores.get('overwhelm', 0) > 0.3:
            base_v -= 0.15
            base_a += 0.1
        if driver_scores.get('fatigue', 0) > 0.3:
            base_v -= 0.1
            base_a -= 0.2
        if driver_scores.get('relief', 0) > 0.3:
            base_v += 0.15
        if driver_scores.get('connection', 0) > 0.3:
            base_v += 0.1
        if driver_scores.get('withdrawal', 0) > 0.3:
            base_v -= 0.2
            base_a -= 0.1
        
        # Clamp to [0, 1]
        valence = max(0.0, min(1.0, base_v))
        arousal = max(0.0, min(1.0, base_a))
        
        return valence, arousal
    
    def _estimate_confidence(
        self,
        hf_scores: Dict[str, float],
        ollama_result: Optional[Dict],
        primary: str
    ) -> float:
        """
        Estimate confidence based on model agreement
        
        Returns:
            Confidence score in [0, 1]
        """
        # HF confidence: how much stronger is top vs second?
        sorted_hf = sorted(hf_scores.values(), reverse=True)
        hf_gap = sorted_hf[0] - sorted_hf[1] if len(sorted_hf) > 1 else 0.5
        
        # Ollama agreement: does it match our primary?
        ollama_agreement = 0.0
        if ollama_result and ollama_result.get('primary') == primary:
            ollama_agreement = 1.0
        
        # Weighted average
        confidence = 0.6 * hf_gap + 0.4 * ollama_agreement
        
        # Scale to [0.5, 0.9] range (avoid extremes)
        confidence = 0.5 + 0.4 * confidence
        
        return max(0.0, min(1.0, confidence))
    
    def _correct_output(self, fused: Dict, text: str) -> Dict:
        """
        Deterministic correction pass to fix illegal values
        
        Args:
            fused: Fused scores dict
            text: Original text for validation
        
        Returns:
            Corrected dict
        """
        corrected = fused.copy()
        
        # Fix illegal primary/secondary pairs
        primary = corrected['primary']
        secondary = corrected.get('secondary')
        
        if secondary and secondary not in self.ADJACENCY.get(primary, []):
            # If secondary is opposite, check if text supports it
            if secondary == self.OPPOSITES.get(primary):
                # Check for disgust/opposite keywords in text
                opposite_keywords = {
                    'disgust': ['disgusted', 'revolting', 'repulsive', 'awful'],
                    'fear': ['afraid', 'scared', 'anxious', 'worried'],
                    'anger': ['angry', 'furious', 'mad', 'rage'],
                }
                
                if not any(kw in text.lower() for kw in opposite_keywords.get(secondary, [])):
                    # No text support - use adjacent instead
                    adjacent = self.ADJACENCY.get(primary, [])
                    corrected['secondary'] = adjacent[0] if adjacent else None
        
        # Ensure invoked/expressed are text-supported (lexical check)
        invoked = corrected.get('invoked', [])
        if isinstance(invoked, list):
            # Keep only if word appears in text
            corrected['invoked'] = [
                inv for inv in invoked 
                if any(word in text.lower() for word in inv.split('_'))
            ][:3]
        
        # Ensure valence/arousal are consistent with each other
        valence = corrected.get('valence', 0.5)
        arousal = corrected.get('arousal', 0.5)
        
        # If joy/awe/pride -> high valence
        if primary in ['joy', 'trust'] and valence < 0.5:
            corrected['valence'] = 0.6
        
        # If overwhelm/withdrawal -> low valence
        if any(d in corrected.get('invoked', []) for d in ['overwhelm', 'withdrawal', 'exhaustion']):
            if valence > 0.5:
                corrected['valence'] = 0.35
        
        # Reconcile arousal with primary
        if primary in ['sadness', 'trust'] and arousal > 0.7:
            corrected['arousal'] = 0.5  # Calm down
        if primary in ['fear', 'anger', 'surprise'] and arousal < 0.5:
            corrected['arousal'] = 0.65  # Amp up
        
        return corrected
    
    def _serialize_output(self, corrected: Dict) -> Dict:
        """
        Serialize to exact schema that ollama_client returns
        
        CRITICAL: Must match OllamaClient.enrich() output format exactly
        
        Based on ollama_client.py, the format is:
        - invoked: str (label format like "fatigue + frustration")
        - expressed: str (label format like "irritated / deflated")
        - wheel: {primary: str, secondary: str}
        - valence/arousal/confidence: float [0,1]
        - events: list[str] (list of driver labels)
        - warnings: list[str]
        - willingness_cues: {hedges: [], intensifiers: [], negations: [], self_reference: []}
        
        Returns:
            Schema-compatible dict
        """
        # Invoked: Join with " + " (NOT stringified array)
        invoked_list = corrected.get('invoked', [])
        if invoked_list:
            invoked_str = ' + '.join(invoked_list)  # "fatigue + frustration"
        else:
            invoked_str = "unknown"
        
        # Expressed: Join with " / " (NOT stringified array)
        expressed_list = corrected.get('expressed', [])
        if expressed_list:
            expressed_str = ' / '.join(expressed_list)  # "irritated / deflated"
        else:
            expressed_str = "unknown"
        
        # Wheel
        wheel = {
            'primary': corrected.get('primary', 'sadness'),
            'secondary': corrected.get('secondary', 'joy')
        }
        
        # Valence/arousal/confidence
        valence = corrected.get('valence', 0.5)
        arousal = corrected.get('arousal', 0.5)
        confidence = corrected.get('confidence', 0.75)
        
        # Events: list of driver labels (same as invoked_list)
        events = invoked_list[:3] if invoked_list else ['fatigue', 'irritation', 'low_progress']
        
        # Warnings: empty for now (can be populated by correction pass)
        warnings = corrected.get('warnings', [])
        
        # Willingness cues: empty nested object (worker.py will merge with text cues)
        willingness_cues = {
            'hedges': [],
            'intensifiers': [],
            'negations': [],
            'self_reference': []
        }
        
        return {
            'invoked': invoked_str,           # str with " + " separator
            'expressed': expressed_str,       # str with " / " separator
            'wheel': wheel,                   # {primary: str, secondary: str}
            'valence': float(valence),        # float [0,1]
            'arousal': float(arousal),        # float [0,1]
            'confidence': float(confidence),  # float [0,1]
            'events': events,                 # list[str]
            'warnings': warnings,             # list[str]
            'willingness_cues': willingness_cues,  # nested dict
        }
    
    def validate_and_clamp(self, data: Dict) -> Dict:
        """
        Legacy method for compatibility - just pass through since we already corrected
        
        Args:
            data: Enriched data dict
        
        Returns:
            Same dict (no-op)
        """
        return data
