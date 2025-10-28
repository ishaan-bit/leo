"""
Hybrid Scorer v4 - Willcox Feelings Wheel (Canonical JSON)
===========================================================
Drop-in replacement for OllamaClient using Gloria Willcox Feelings Wheel.
Fuses HF zero-shot + sentence embeddings + Ollama rerank.

CRITICAL: Output schema MUST exactly match ollama_client.enrich() return value.

Architecture:
1. HF Zero-Shot (0.4 weight) - Willcox primary classification (6 emotions)
2. Sentence Embeddings (0.3 weight) - Similarity against Willcox secondary/tertiary + driver/surface lexicons
3. Ollama Phi3 (0.3 weight) - Rerank and propose primary/secondary/tertiary
4. Deterministic Correction - Validate hierarchy, reject contradictory events, reconcile valence/arousal
5. Serialize to EXACT schema worker.py expects

Emotion Taxonomy (Willcox Feelings Wheel - CANONICAL):
  ✅ Loaded from src/data/willcox_wheel.json (single source of truth)
  Primary (6): Sad, Angry, Fearful, Happy, Peaceful, Strong
  Secondary (6 per primary): e.g., Happy → [optimistic, trusting, peaceful, powerful, accepted, proud]
  Tertiary (6 per secondary): e.g., proud → [successful, confident, accomplished, important, valuable, worthy]
  Total: 6×6×6 = 216 emotions

Legacy Mapping (for backwards compatibility):
  Joyful   → Happy
  Powerful → Strong
  Peaceful → Peaceful (unchanged)
  Sad      → Sad (unchanged)
  Mad      → Angry
  Scared   → Fearful

Output Schema (MUST MATCH ollama_client + add tertiary):
{
  "invoked": str,                    # e.g., "motivation"
  "expressed": str | list[str],      # e.g., ["reflective", "proud"]
  "wheel": {
    "primary": str,                  # Willcox primary: Sad|Angry|Fearful|Happy|Peaceful|Strong
    "secondary": str | null,         # Willcox secondary or null
    "tertiary": str | null           # Willcox tertiary or null
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
import re
from typing import Optional, Dict, List, Tuple
import numpy as np
from datetime import datetime, timezone
from pathlib import Path


class HybridScorer:
    """
    Hybrid enrichment scorer using HF + Embeddings + Ollama
    Preserves exact output schema compatibility
    Loads canonical Willcox Wheel from JSON
    """
    
    def __init__(self, hf_token: str, ollama_base_url: str = "http://localhost:11434", use_ollama: bool = True):
        """
        Initialize HybridScorer with canonical Willcox Wheel
        
        Args:
            hf_token: Hugging Face API token for embeddings + zero-shot
            ollama_base_url: Ollama server URL (default: http://localhost:11434)
            use_ollama: Whether to use Ollama for reranking (default: True)
        """
        self.hf_token = hf_token
        self.ollama_base_url = ollama_base_url
        self.use_ollama = use_ollama
        
        # Load canonical Willcox Wheel from JSON
        wheel_path = Path(__file__).parent.parent / "data" / "willcox_wheel.json"
        with open(wheel_path, 'r', encoding='utf-8') as f:
            wheel_data = json.load(f)
            self.WILLCOX_HIERARCHY = wheel_data['wheel']
            self.wheel_metadata = wheel_data['metadata']
        
        # Extract primaries from wheel (preserves order from JSON)
        self.WILLCOX_PRIMARY = list(self.WILLCOX_HIERARCHY.keys())
        
        print(f"[OK] Loaded Willcox Wheel v{self.wheel_metadata['version']} ({self.wheel_metadata['total_emotions']} emotions)")
        print(f"   Primaries: {', '.join(self.WILLCOX_PRIMARY)}")
        
        # Legacy mapping for backwards compatibility (old → new)
        # This ensures old references like "Joyful" still work
        self.LEGACY_MAPPING = {
            'Joyful': 'Happy',
            'Powerful': 'Strong',
            'Peaceful': 'Peaceful',  # unchanged
            'Sad': 'Sad',            # unchanged
            'Mad': 'Angry',
            'Scared': 'Fearful'
        }
        
        # Reverse mapping (new → old) for lookups
        self.REVERSE_LEGACY = {v: k for k, v in self.LEGACY_MAPPING.items()}
    
        # Valence & Arousal ranges per Willcox primary (updated for new names)
        self.WILLCOX_VA_MAP = {
            'Happy': {'valence': (0.8, 0.9), 'arousal': (0.5, 0.65)},      # was Joyful
            'Strong': {'valence': (0.7, 0.85), 'arousal': (0.55, 0.7)},    # was Powerful
            'Peaceful': {'valence': (0.75, 0.85), 'arousal': (0.3, 0.5)},  # unchanged
            'Sad': {'valence': (0.2, 0.4), 'arousal': (0.3, 0.5)},         # unchanged
            'Angry': {'valence': (0.2, 0.4), 'arousal': (0.6, 0.8)},       # was Mad
            'Fearful': {'valence': (0.2, 0.45), 'arousal': (0.65, 0.8)}    # was Scared
        }
    
        # Driver lexicon (for invoked) - emotion drivers/causes
        self.DRIVER_LEXICON = [
            'motivation', 'agency', 'progress', 'achievement', 'recognition', 'self_acceptance',
            'connection', 'belonging', 'pride', 'relief', 'hope', 'contentment', 'awe', 'serenity',
            'fatigue', 'overwhelm', 'pressure', 'irritation', 'hurt', 'withdrawal', 'loss', 'longing',
            'self_assertion', 'exhaustion', 'frustration', 'learning', 'change', 'renewal',
            'uncertainty', 'complexity', 'gratitude', 'low_progress', 'worry', 'tension'
        ]
        
        # Surface tone lexicon (for expressed) - how emotion appears
        self.SURFACE_LEXICON = [
            'proud', 'reflective', 'playful', 'content', 'peaceful', 'calm', 'light', 'enthusiastic',
            'relieved', 'confident', 'motivated', 'inspired', 'grateful', 'hopeful', 'determined',
            'tense', 'confused', 'deflated', 'guarded', 'wistful', 'shaky', 'defeated', 'irritated',
            'tired', 'exhausted', 'annoyed', 'matter-of-fact', 'resigned', 'flat', 'stressed',
            'anxious', 'overwhelmed', 'withdrawn', 'vulnerable'
        ]
        
        # Contradictory event pairs (for validation)
        self.CONTRADICTORY_EVENTS = {
            'pride': ['low_progress', 'failure', 'inadequacy'],
            'progress': ['low_progress', 'stuck', 'stagnation'],
            'achievement': ['low_progress', 'failure'],
            'relief': ['pressure', 'overwhelm', 'tension'],
            'calm': ['anxiety', 'tension', 'overwhelm'],
            'low_progress': ['progress', 'achievement', 'pride'],
            'overwhelm': ['relief', 'calm', 'peace']
        }
        
        # Initialize API endpoints and weights
        self.ollama_base_url = ollama_base_url.rstrip('/')
        self.ollama_model = "phi3:latest"
        self.timeout = 120
        self.use_ollama = use_ollama
        
        # Fusion weights (HF 0.5 + Embedding 0.35 + Ollama 0.15 = 1.0)
        self.hf_weight = 0.5
        self.emb_weight = 0.35
        self.ollama_weight = 0.15
        
        # HF API endpoints
        self.hf_zeroshot_url = "https://api-inference.huggingface.co/models/facebook/bart-large-mnli"
        self.hf_embed_url = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"
        
        print(f"[*] HybridScorer initialized with canonical Willcox Wheel")
        print(f"   Fusion weights - HF: {self.hf_weight:.2f}, Embedding: {self.emb_weight:.2f}, Ollama: {self.ollama_weight:.2f}")
    
    def is_available(self) -> bool:
        """Check if Ollama is reachable (HF check skipped for speed)"""
        try:
            # Check Ollama only (HF will be checked on first actual use)
            ollama_resp = requests.get(f"{self.ollama_base_url}/api/tags", timeout=5)
            return ollama_resp.status_code == 200
        except Exception as e:
            print(f"[!] Ollama health check failed: {e}")
            return False
    
    def enrich(self, normalized_text: str, history: list = None, timestamp: str = None) -> Optional[Dict]:
        """
        Full hybrid enrichment pipeline using HF + Embeddings + Ollama
        
        Computes: wheel, invoked, expressed, valence, arousal, confidence, events,
        willingness_cues, congruence, temporal analytics, recursiveness, risk signals, quality
        
        Args:
            normalized_text: Normalized reflection text
            history: User's past reflections for temporal/recursion analysis (optional)
            timestamp: ISO timestamp for circadian/temporal analysis (optional)
        
        Returns:
            Dict matching full enriched schema or None if failed
        """
        start_time = time.time()
        history = history or []
        
        try:
            print(f"\n[*] Willcox Hybrid Enrichment Pipeline")
            print(f"   Text: {normalized_text[:80]}...")
            
            # Step 1: HF Zero-Shot for Willcox primary emotions
            print(f"   [1/9] HF Zero-Shot...")
            hf_scores = self._hf_zero_shot(normalized_text)
            if not hf_scores:
                print("[!]  HF zero-shot failed, using fallback")
                hf_scores = {e: 1.0/6 for e in self.WILLCOX_PRIMARY}  # Uniform fallback
            
            # Step 2: Embedding similarity for secondary/tertiary
            print(f"   [2/9] Computing secondary/tertiary...")
            secondary_tertiary_scores = self._compute_secondary_tertiary_scores(normalized_text, hf_scores)
            
            # Step 3: Embedding similarity for drivers and surface tones
            print(f"   [3/9] Computing drivers/surface...")
            driver_scores = self._embedding_similarity(normalized_text, self.DRIVER_LEXICON)
            surface_scores = self._embedding_similarity(normalized_text, self.SURFACE_LEXICON)
            
            # Step 4: Ollama rerank
            print(f"   [4/9] Ollama rerank...")
            ollama_result = self._ollama_rerank(normalized_text)
            
            # Step 4.5: Extract circadian phase early for A1 priors
            circadian_phase = None
            if timestamp:
                try:
                    from datetime import datetime
                    import pytz
                    dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    ist = pytz.timezone('Asia/Kolkata')
                    local_dt = dt.astimezone(ist)
                    hour = local_dt.hour + local_dt.minute / 60.0
                    
                    if hour < 6:
                        circadian_phase = 'night'
                    elif hour < 12:
                        circadian_phase = 'morning'
                    elif hour < 17:
                        circadian_phase = 'afternoon'
                    elif hour < 21:
                        circadian_phase = 'evening'
                    else:
                        circadian_phase = 'night'
                    
                    print(f"   [A1] Circadian phase: {circadian_phase} (hour: {hour:.1f})")
                except Exception as e:
                    print(f"   [A1] Circadian extraction failed: {e}")
            
            # Step 5: Fuse scores (with circadian priors)
            fused = self._fuse_scores(hf_scores, secondary_tertiary_scores, driver_scores, surface_scores, ollama_result, normalized_text, circadian_phase)
            
            # Step 6: Deterministic correction
            corrected = self._correct_output(fused, normalized_text)
            
            # Step 7: Extract willingness cues
            willingness_cues = self._extract_willingness_cues(normalized_text)
            
            # Merge with Ollama cues if available
            if ollama_result and ollama_result.get('willingness_cues'):
                ollama_cues = ollama_result['willingness_cues']
                willingness_cues = {
                    'hedges': list(set(willingness_cues['hedges'] + ollama_cues.get('hedges', []))),
                    'intensifiers': list(set(willingness_cues['intensifiers'] + ollama_cues.get('intensifiers', []))),
                    'negations': list(set(willingness_cues['negations'] + ollama_cues.get('negations', []))),
                    'self_reference': list(set(willingness_cues['self_reference'] + ollama_cues.get('self_reference', []))),
                }
            
            # Step 8: Compute all analytics
            valence = corrected.get('valence', 0.5)
            arousal = corrected.get('arousal', 0.5)
            confidence_score = corrected.get('confidence', 0.75)
            invoked_list = corrected.get('invoked', [])
            expressed_list = corrected.get('expressed', [])
            
            # Step 8.5: A2 - Apply EMA drift with adaptive alpha (smooth valence/arousal with history)
            if history:
                valence, arousal, ema_meta = self._apply_adaptive_ema_smoothing(
                    valence, arousal, history, confidence_score, timestamp
                )
                # Store EMA metadata for transparency
                ema_alpha_used = ema_meta['alpha']
                print(f"   [A2 EMA Drift] Alpha: {ema_alpha_used:.2f}, V: {ema_meta['raw_v']:.2f}→{valence:.2f}, A: {ema_meta['raw_a']:.2f}→{arousal:.2f}")
            else:
                ema_alpha_used = 1.0  # No smoothing if no history
            
            # Map invoked to specific events (not just copying invoked)
            events = self._map_to_events(invoked_list, valence, arousal)
            
            congruence = self._compute_congruence(invoked_list, expressed_list, valence, arousal)
            temporal = self._compute_temporal_analytics(valence, arousal, history, timestamp)
            willingness_score = self._compute_willingness_score(invoked_list, expressed_list, willingness_cues, valence)
            comparator = self._compute_comparator(events, invoked_list, expressed_list, valence, arousal)
            recursion = self._detect_recursion(normalized_text, events, history)
            state = self._compute_state(valence, arousal, history)
            quality = self._compute_quality(normalized_text, confidence_score)
            risk_signals = self._detect_risk_signals(normalized_text, events, history)
            
            # Step 9: Serialize to exact schema format (without willingness_cues - we'll add it separately)
            serialized = self._serialize_output(corrected, events, risk_signals.get('warnings', []), normalized_text)
            
            # Add all analytics fields (no redundancy)
            serialized['willingness_cues'] = willingness_cues
            serialized['congruence'] = congruence
            serialized['temporal'] = temporal
            serialized['willingness'] = willingness_score
            serialized['comparator'] = comparator
            serialized['recursion'] = recursion
            serialized['state'] = state
            serialized['quality'] = quality
            serialized['risk_signals_weak'] = risk_signals.get('signals', [])
            
            # Add provenance and meta
            serialized['provenance'] = {
                'baseline_version': 'hybrid@v3',
                'ollama_model': self.ollama_model
            }
            
            latency_ms = int((time.time() - start_time) * 1000)
            serialized['meta'] = {
                'mode': 'hybrid-hf-ollama',
                'model': self.ollama_model,
                'blend': f"HF:{self.hf_weight}/Emb:{self.emb_weight}/Ollama:{self.ollama_weight}",
                'revision': 3,
                'enriched_at': timestamp or datetime.now(timezone.utc).isoformat(),
                'ollama_latency_ms': 0,  # Tracked separately
                'warnings': []
            }
            serialized['_latency_ms'] = latency_ms
            
            print(f"[OK] Willcox hybrid enrichment complete in {latency_ms}ms")
            print(f"   Wheel: {serialized['wheel']['primary']} -> {serialized['wheel'].get('secondary')} -> {serialized['wheel'].get('tertiary')}")
            print(f"   Invoked: {serialized['invoked']}")
            print(f"   Expressed: {serialized['expressed']}")
            print(f"   Congruence: {congruence}")
            
            return serialized
            
        except Exception as e:
            print(f"[X] Hybrid enrichment error: {type(e).__name__}: {e}")
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
                print(f"[!]  HF API error {response.status_code}")
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
            print(f"[!]  HF zero-shot error: {e}")
            return None
    
    def _compute_secondary_tertiary_scores(self, text: str, primary_scores: Dict[str, float]) -> Dict:
        """
        Compute secondary and tertiary scores for top primary emotions using embeddings
        
        Args:
            text: Input text
            primary_scores: Dict of primary -> score
        
        Returns:
            Dict with {primary: {secondary: score, tertiaries: {tertiary: score}}}
        """
        # Get top 2 primaries
        top_primaries = sorted(primary_scores.items(), key=lambda x: -x[1])[:2]
        
        result = {}
        
        for primary, _ in top_primaries:
            if primary not in self.WILLCOX_HIERARCHY:
                continue
            
            # Get all secondaries for this primary
            secondaries = list(self.WILLCOX_HIERARCHY[primary].keys())
            secondary_scores = self._embedding_similarity(text, secondaries)
            
            # Get top secondary
            top_secondary = max(secondary_scores.items(), key=lambda x: x[1])
            
            # Get tertiaries for top secondary
            tertiaries = self.WILLCOX_HIERARCHY[primary][top_secondary[0]]
            tertiary_scores = self._embedding_similarity(text, tertiaries)
            
            result[primary] = {
                'secondary': top_secondary[0],
                'secondary_score': top_secondary[1],
                'tertiaries': tertiary_scores
            }
        
        return result
    
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
                print(f"[!]  HF embedding API error {response.status_code}")
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
            print(f"[!]  Embedding similarity error: {e}")
            return {c: 0.0 for c in candidates}
    
    def _extract_willingness_cues(self, text: str) -> Dict:
        """
        Extract willingness cues using pattern matching
        
        Returns:
            Dict with hedges, intensifiers, negations, self_reference lists
        """
        cues = {
            'hedges': [],
            'intensifiers': [],
            'negations': [],
            'self_reference': []
        }
        
        text_lower = text.lower()
        words = text.split()
        
        # Hedge patterns (uncertainty)
        hedge_patterns = ['maybe', 'perhaps', 'kind of', 'sort of', 'somewhat', 'guess', 'think', 'probably', 'might', 'could be', 'possibly', 'seems']
        for h in hedge_patterns:
            if h in text_lower:
                cues['hedges'].append(h)
        
        # Intensifier patterns (emphasis) - expanded list
        intensifier_patterns = ['very', 'really', 'so', 'extremely', 'incredibly', 'absolutely', 'totally', 'completely', 'entirely', 'genuinely', 'truly', 'deeply', 'quite', 'rather', 'fairly']
        for i in intensifier_patterns:
            if i in text_lower:
                cues['intensifiers'].append(i)
        
        # Negation patterns
        negation_patterns = ['not', "n't", 'no', 'never', 'nothing', 'nowhere', 'nobody', 'none', 'neither', 'nor']
        for n in negation_patterns:
            if n in text_lower:
                cues['negations'].append(n)
        
        # Self-reference patterns - look for word boundaries
        self_ref_patterns = [r'\bI\b', r'\bme\b', r'\bmy\b', r'\bmyself\b', r'\bmine\b', r"I'm", r"I've", r"I'll", r"I'd"]
        for pattern in self_ref_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            cues['self_reference'].extend(matches)
        
        # Deduplicate
        cues['hedges'] = list(set(cues['hedges']))
        cues['intensifiers'] = list(set(cues['intensifiers']))
        cues['negations'] = list(set(cues['negations']))
        cues['self_reference'] = list(set(cues['self_reference']))
        
        return cues
    
    def _map_to_events(self, invoked: list, valence: float, arousal: float) -> list:
        """
        Map invoked drivers to specific event labels based on valence/arousal
        
        Returns:
            List of event dicts with label and confidence
        """
        if not invoked:
            return []
        
        events = []
        for inv in invoked[:3]:
            # Map driver to event with confidence based on valence/arousal alignment
            confidence = 0.85  # Base confidence
            
            # Adjust confidence based on valence/arousal fit
            if inv in ['pride', 'achievement'] and valence > 0.6:
                confidence = 0.9
            elif inv in ['fatigue', 'exhaustion'] and valence < 0.4:
                confidence = 0.9
            elif inv in ['anxiety', 'worry'] and arousal > 0.6:
                confidence = 0.9
            
            events.append({
                'label': inv,
                'confidence': confidence
            })
        
        return events
    
    def _compute_congruence(self, invoked: list, expressed: list, valence: float, arousal: float) -> float:
        """
        Compute congruence between invoked (drivers) and expressed (surface)
        
        Returns:
            Congruence score [0, 1] where 1 = perfect alignment
        """
        if not invoked or not expressed:
            return 0.5
        
        # Semantic alignment patterns (high congruence = 0.8-0.9)
        aligned_pairs = {
            'fatigue': ['tired', 'exhausted', 'drained', 'deflated'],
            'frustration': ['irritated', 'annoyed', 'tense', 'stressed'],
            'pride': ['proud', 'accomplished', 'confident', 'successful'],
            'anxiety': ['anxious', 'worried', 'tense', 'nervous'],
            'connection': ['warm', 'grateful', 'loved', 'content'],
            'grief': ['sad', 'heavy', 'numb', 'withdrawn'],
            'longing': ['wistful', 'nostalgic', 'yearning'],
            'nostalgia': ['wistful', 'reflective', 'sentimental'],
        }
        
        # Check for direct alignment
        max_congruence = 0.5  # Default
        for inv in invoked:
            for exp in expressed:
                if exp in aligned_pairs.get(inv, []):
                    max_congruence = max(max_congruence, 0.9)
                elif inv.lower() in exp.lower() or exp.lower() in inv.lower():
                    # Lexical overlap (e.g., "proud" in both)
                    max_congruence = max(max_congruence, 0.85)
        
        # Suppression patterns (moderate congruence = 0.6)
        suppression = {
            'overwhelm': ['calm', 'fine', 'okay', 'matter-of-fact'],
            'grief': ['fine', 'okay', 'resigned'],
            'anxiety': ['calm', 'relaxed', 'flat'],
        }
        
        for inv in invoked:
            for exp in expressed:
                if exp in suppression.get(inv, []):
                    max_congruence = max(max_congruence, 0.6)
        
        return round(max_congruence, 2)
    
    def _compute_temporal_analytics(self, valence: float, arousal: float, history: list, timestamp: str = None) -> Dict:
        """
        Compute temporal analytics (EMAs, z-scores, WoW, streaks) using history
        
        Returns:
            Dict with ema, zscore, wow_change, streaks, last_marks, circadian
        """
        from datetime import datetime, timezone
        import pytz
        
        # EMAs (exponential moving averages)
        def compute_ema(current_val, history, window_days):
            if not history:
                return current_val
            
            alpha = 2 / (window_days + 1)
            recent = [h.get('final', {}).get('valence', 0.5) for h in history[-window_days:]]
            if recent:
                ema = recent[0]
                for val in recent[1:]:
                    ema = alpha * val + (1 - alpha) * ema
                return round(ema, 2)
            return current_val
        
        ema_v_1d = compute_ema(valence, history, 1)
        ema_v_7d = compute_ema(valence, history, 7)
        ema_v_28d = compute_ema(valence, history, 28)
        
        ema_a_1d = compute_ema(arousal, history, 1)
        ema_a_7d = compute_ema(arousal, history, 7)
        ema_a_28d = compute_ema(arousal, history, 28)
        
        # Z-scores (requires 90 days of data)
        zscore_v = None
        zscore_a = None
        if len(history) >= 90:
            valences = [h.get('final', {}).get('valence', 0.5) for h in history[-90:]]
            arousals = [h.get('final', {}).get('arousal', 0.5) for h in history[-90:]]
            
            import statistics
            mean_v = statistics.mean(valences)
            stdev_v = statistics.stdev(valences) if len(valences) > 1 else 0.1
            zscore_v = round((valence - mean_v) / stdev_v, 2) if stdev_v > 0 else 0
            
            mean_a = statistics.mean(arousals)
            stdev_a = statistics.stdev(arousals) if len(arousals) > 1 else 0.1
            zscore_a = round((arousal - mean_a) / stdev_a, 2) if stdev_a > 0 else 0
        
        # WoW (Week-over-Week change)
        wow_v = None
        wow_a = None
        if len(history) >= 14:
            last_week = [h.get('final', {}).get('valence', 0.5) for h in history[-7:]]
            prev_week = [h.get('final', {}).get('valence', 0.5) for h in history[-14:-7]]
            if last_week and prev_week:
                wow_v = round(sum(last_week)/len(last_week) - sum(prev_week)/len(prev_week), 2)
            
            last_week_a = [h.get('final', {}).get('arousal', 0.5) for h in history[-7:]]
            prev_week_a = [h.get('final', {}).get('arousal', 0.5) for h in history[-14:-7]]
            if last_week_a and prev_week_a:
                wow_a = round(sum(last_week_a)/len(last_week_a) - sum(prev_week_a)/len(prev_week_a), 2)
        
        # Streaks
        positive_days = 1 if valence >= 0.5 else 0
        negative_days = 1 if valence < 0.5 else 0
        for h in reversed(history):
            h_val = h.get('final', {}).get('valence', 0.5)
            if valence >= 0.5 and h_val >= 0.5:
                positive_days += 1
            elif valence < 0.5 and h_val < 0.5:
                negative_days += 1
            else:
                break
        
        # Circadian
        circadian = {'hour_local': 12, 'phase': 'afternoon', 'sleep_adjacent': False, 'timezone_used': 'Asia/Kolkata'}
        if timestamp:
            try:
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                ist = pytz.timezone('Asia/Kolkata')
                local_dt = dt.astimezone(ist)
                hour = local_dt.hour + local_dt.minute / 60.0
                
                if hour < 6:
                    phase = 'night'
                elif hour < 12:
                    phase = 'morning'
                elif hour < 17:
                    phase = 'afternoon'
                elif hour < 21:
                    phase = 'evening'
                else:
                    phase = 'night'
                
                sleep_adjacent = hour < 6 or hour >= 22
                circadian = {
                    'hour_local': round(hour, 1), 
                    'phase': phase, 
                    'sleep_adjacent': sleep_adjacent,
                    'timezone_used': 'Asia/Kolkata'
                }
            except:
                pass
        
        return {
            'ema': {
                'v_1d': ema_v_1d,
                'v_7d': ema_v_7d,
                'v_28d': ema_v_28d,
                'a_1d': ema_a_1d,
                'a_7d': ema_a_7d,
                'a_28d': ema_a_28d,
            },
            'zscore': {
                'valence': zscore_v,
                'arousal': zscore_a,
                'window_days': 90
            },
            'wow_change': {
                'valence': wow_v,
                'arousal': wow_a
            },
            'streaks': {
                'positive_valence_days': positive_days,
                'negative_valence_days': negative_days
            },
            'last_marks': {
                'last_positive_at': None,
                'last_negative_at': None,
                'last_risk_at': None
            },
            'circadian': circadian
        }
    
    def _compute_willingness_score(self, invoked: list, expressed: list, cues: Dict, valence: float) -> Dict:
        """
        Compute willingness to express using hybrid approach
        
        Returns:
            Dict with willingness_to_express, inhibition, amplification, dissociation, social_desirability
        """
        # Base willingness from congruence between invoked and expressed
        base_willingness = 0.5
        
        if invoked and expressed:
            # High willingness if they align
            overlap = set(invoked) & set(expressed)
            base_willingness = len(overlap) / max(len(invoked), len(expressed)) if invoked or expressed else 0.5
        
        # Adjust based on cues
        inhibition = len(cues.get('hedges', [])) * 0.05
        amplification = len(cues.get('intensifiers', [])) * 0.05
        
        # Dissociation: low self-reference + low valence
        self_ref_count = len(cues.get('self_reference', []))
        dissociation = 0.1 if self_ref_count < 2 and valence < 0.4 else 0
        
        # Social desirability: positive valence but hedging
        social_desirability = 0.1 if valence > 0.6 and len(cues.get('hedges', [])) > 0 else 0
        
        willingness = base_willingness - inhibition + amplification
        willingness = max(0, min(1, willingness))
        
        return {
            'willingness_to_express': round(willingness, 2),
            'inhibition': round(inhibition, 2),
            'amplification': round(amplification, 2),
            'dissociation': round(dissociation, 2),
            'social_desirability': round(social_desirability, 2)
        }
    
    def _compute_comparator(self, events: list, invoked_list: list, expressed_list: list, valence: float, arousal: float) -> Dict:
        """
        Compute expected vs actual valence/arousal using event-based model
        
        Returns:
            Dict with expected, deviation, note
        """
        # Expected valence/arousal per event
        event_va_map = {
            'fatigue': (0.25, 0.3),
            'exhaustion': (0.2, 0.25),
            'frustration': (0.3, 0.7),
            'pride': (0.8, 0.6),
            'achievement': (0.85, 0.65),
            'progress': (0.75, 0.55),
            'anxiety': (0.3, 0.8),
            'worry': (0.35, 0.75),
            'grief': (0.2, 0.3),
            'connection': (0.75, 0.5),
            'overwhelm': (0.25, 0.75),
            'motivation': (0.7, 0.6),
        }
        
        # Expected expressed emotions per invoked driver
        expected_expressed_map = {
            'fatigue': ['tired', 'exhausted', 'drained'],
            'exhaustion': ['depleted', 'worn out', 'spent'],
            'frustration': ['irritated', 'annoyed', 'tense'],
            'pride': ['proud', 'accomplished', 'satisfied'],
            'achievement': ['successful', 'fulfilled', 'confident'],
            'progress': ['motivated', 'encouraged', 'hopeful'],
            'anxiety': ['anxious', 'worried', 'nervous'],
            'grief': ['sad', 'heavy', 'withdrawn'],
            'connection': ['warm', 'grateful', 'content'],
            'overwhelm': ['stressed', 'tense', 'frazzled'],
        }
        
        if not events:
            return {
                'expected': {'invoked': None, 'expressed': [], 'valence': 0.5, 'arousal': 0.5},
                'deviation': {'valence': 0, 'arousal': 0},
                'note': 'No events to compare'
            }
        
        # Extract event labels from event dicts
        event_labels = [e['label'] if isinstance(e, dict) else e for e in events]
        
        # Average expected valence/arousal across events
        expected_v = sum([event_va_map.get(e, (0.5, 0.5))[0] for e in event_labels]) / len(event_labels)
        expected_a = sum([event_va_map.get(e, (0.5, 0.5))[1] for e in event_labels]) / len(event_labels)
        
        # Expected expressed based on top invoked
        expected_expressed = []
        if invoked_list:
            top_invoked = invoked_list[0]
            expected_expressed = expected_expressed_map.get(top_invoked, [])
        
        deviation_v = round(valence - expected_v, 2)
        deviation_a = round(arousal - expected_a, 2)
        
        # Generate note
        if abs(deviation_v) < 0.1 and abs(deviation_a) < 0.1:
            note = "As expected"
        else:
            v_note = "more positive" if deviation_v > 0 else "more negative"
            a_note = "more activated" if deviation_a > 0 else "less activated"
            note = f"{v_note} than expected, {a_note}. Events: {', '.join(event_labels[:3])}"
        
        return {
            'expected': {
                'invoked': event_labels[0] if event_labels else None,
                'expressed': expected_expressed,
                'valence': round(expected_v, 2),
                'arousal': round(expected_a, 2)
            },
            'deviation': {
                'valence': deviation_v,
                'arousal': deviation_a
            },
            'note': note
        }
    
    def _detect_recursion(self, text: str, events: list, history: list) -> Dict:
        """
        Detect semantic links to past reflections using embeddings
        
        Returns:
            Dict with method, links, thread_summary, thread_state
        """
        if not history or len(history) < 2:
            return {
                'method': 'hybrid(semantic+lexical+time)',
                'links': [],
                'thread_summary': '',
                'thread_state': 'new'
            }
        
        # Simple lexical overlap for now (embeddings would be too slow for interactive test)
        text_words = set(text.lower().split())
        links = []
        
        for h in history[-10:]:  # Check last 10 reflections
            h_text = h.get('normalized_text', '')
            h_words = set(h_text.lower().split())
            overlap = len(text_words & h_words)
            
            if overlap >= 3:  # At least 3 word overlap
                links.append({
                    'rid': h.get('rid'),
                    'similarity': round(overlap / max(len(text_words), len(h_words)), 2),
                    'reason': 'lexical_overlap'
                })
        
        thread_state = 'continuing' if len(links) > 0 else 'new'
        
        return {
            'method': 'hybrid(semantic+lexical+time)',
            'links': links[:3],  # Top 3
            'thread_summary': f"Linked to {len(links)} past reflections" if links else "",
            'thread_state': thread_state
        }
    
    def _compute_state(self, valence: float, arousal: float, history: list) -> Dict:
        """
        Compute latent emotional state using Bayesian-like tracking
        
        Returns:
            Dict with valence_mu, arousal_mu, energy_mu, fatigue_mu, sigma, confidence
        """
        # Use EMAs as state estimates
        alpha = 0.3  # Smoothing factor
        
        if history:
            last_valence = history[-1].get('final', {}).get('valence', 0.5)
            last_arousal = history[-1].get('final', {}).get('arousal', 0.5)
            
            valence_mu = alpha * valence + (1 - alpha) * last_valence
            arousal_mu = alpha * arousal + (1 - alpha) * last_arousal
        else:
            valence_mu = valence
            arousal_mu = arousal
        
        energy_mu = (valence_mu + arousal_mu) / 2.0
        fatigue_mu = 1 - energy_mu
        
        sigma = 0.3  # Uncertainty
        confidence = 0.5 + 0.3 * (len(history) / 100.0) if history else 0.5
        
        return {
            'valence_mu': round(valence_mu, 2),
            'arousal_mu': round(arousal_mu, 2),
            'energy_mu': round(energy_mu, 3),
            'fatigue_mu': round(fatigue_mu, 3),
            'sigma': sigma,
            'confidence': round(min(confidence, 0.9), 2)
        }
    
    def _compute_quality(self, text: str, confidence: float) -> Dict:
        """
        Compute reflection quality metrics
        
        Returns:
            Dict with text_len, uncertainty
        """
        return {
            'text_len': len(text),
            'uncertainty': round(1 - confidence, 2)
        }
    
    def _detect_risk_signals(self, text: str, events: list, history: list) -> Dict:
        """
        Detect risk signals using keyword patterns
        
        Returns:
            Dict with signals list and warnings list
        """
        risk_keywords = {
            'self_harm': ['hurt myself', 'end it', 'give up', 'no point'],
            'crisis': ['can\'t take', 'too much', 'breaking down', 'falling apart'],
            'chronic_distress': ['always', 'never get better', 'hopeless', 'worthless']
        }
        
        text_lower = text.lower()
        signals = []
        warnings = []
        
        for risk_type, keywords in risk_keywords.items():
            if any(kw in text_lower for kw in keywords):
                signals.append(risk_type)
                warnings.append(f"Risk signal detected: {risk_type}")
        
        return {
            'signals': signals,
            'warnings': warnings
        }
    
    def _ollama_rerank(self, text: str) -> Optional[Dict]:
        """
        Ollama rerank with minimal deterministic prompt
        
        Returns:
            Dict with primary, secondary, invoked, expressed or None
        """
        prompt = f"""You are a precise emotion classifier. Return ONLY valid JSON, no extra text.

Text: "{text}"

Identify the PRIMARY EMOTION being felt (not the activity). Ask: "What is this person feeling?"

Examples:
- "felt calm after meditation" → Peaceful (the feeling is calm)
- "proud I finished the project" → Powerful (the feeling is proud)
- "worried about tomorrow" → Scared (the feeling is worried)
- "frustrated by delays" → Mad (the feeling is frustrated)

Return JSON:
{{
  "primary": "Peaceful",
  "secondary": "relaxed",
  "tertiary": "calm",
  "invoked": ["relief", "serenity"],
  "expressed": ["calm", "peaceful"]
}}

Rules:
- primary: ONE of [Joyful, Powerful, Peaceful, Sad, Mad, Scared]
- Distinguish: 
  * Peaceful = calm, relaxed, serene, tranquil, content, meditative
  * Joyful = happy, cheerful, playful, optimistic, interested, accepted
  * Powerful = proud, accomplished, confident, strong, creative, loving, capable
  * Sad = lonely, disappointed, guilty, bored, empty
  * Mad = angry, frustrated, bitter, critical, hostile
  * Scared = anxious, worried, insecure, helpless, confused
- secondary/tertiary: specific emotion labels or null
- invoked: 1-3 emotional drivers (what caused it)
- expressed: 1-3 surface emotions (how it shows)

JSON:"""
        
        payload = {
            "model": self.ollama_model,
            "prompt": prompt,
            "stream": False,
            "keep_alive": "30m",  # Keep model loaded for 30 minutes
            "options": {
                "temperature": 0.1,
                "num_predict": 120,
                "stop": ["\n\n", "```", "Note:", "Explanation:"]
            }
        }
        
        try:
            response = requests.post(
                f"{self.ollama_base_url}/api/generate",
                json=payload,
                timeout=self.timeout
            )
            
            if response.status_code != 200:
                print(f"[!]  Ollama API error {response.status_code}")
                return None
            
            result = response.json()
            raw_response = result.get('response', '')
            
            # Parse JSON
            parsed = self._parse_json(raw_response)
            
            if parsed:
                print(f"   Ollama rerank: primary={parsed.get('primary')}, secondary={parsed.get('secondary')}")
                return parsed
            else:
                print(f"[!]  Failed to parse Ollama JSON. Raw response:\n{raw_response[:200]}")
                return None
                
        except Exception as e:
            print(f"[!]  Ollama rerank error: {e}")
            return None
    
    def _parse_json(self, raw_text: str) -> Optional[Dict]:
        """Parse JSON from LLM response with aggressive cleanup"""
        cleaned = raw_text.strip()
        
        # Remove markdown code blocks
        if cleaned.startswith('```json'):
            cleaned = cleaned[7:]
        elif cleaned.startswith('```'):
            cleaned = cleaned[3:]
        
        if cleaned.endswith('```'):
            cleaned = cleaned[:-3]
        
        # Remove common LLM artifacts
        cleaned = cleaned.replace('JSON:', '').replace('json:', '')
        cleaned = cleaned.strip()
        
        # Find JSON boundaries
        start_idx = cleaned.find('{')
        end_idx = cleaned.rfind('}')
        
        if start_idx == -1 or end_idx == -1:
            return None
        
        json_str = cleaned[start_idx:end_idx+1]
        
        # Fix common JSON errors
        # Remove trailing text after closing brace
        if '}' in json_str:
            json_str = json_str[:json_str.rfind('}')+1]
        
        # Try parsing
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            # Try to fix incomplete JSON
            # If missing closing brace for arrays/objects
            if json_str.count('{') > json_str.count('}'):
                json_str += '}'
            if json_str.count('[') > json_str.count(']'):
                json_str += ']'
            
            try:
                return json.loads(json_str)
            except:
                # Last resort: try to extract key-value pairs manually
                print(f"   JSON parse failed: {e}")
                print(f"   Attempted: {json_str[:100]}")
                return None
    
    def _fuse_scores(
        self, 
        hf_scores: Dict[str, float],
        secondary_tertiary_scores: Dict,
        driver_scores: Dict[str, float],
        surface_scores: Dict[str, float],
        ollama_result: Optional[Dict],
        normalized_text: str,
        circadian_phase: Optional[str] = None
    ) -> Dict:
        """
        Fuse HF + Embeddings + Ollama into final Willcox labels
        
        Args:
            circadian_phase: Time of day phase for circadian priors (A1)
        
        Returns:
            Dict with primary, secondary, tertiary, invoked, expressed, valence, arousal, confidence
        """
        # Primary emotion: weighted fusion
        fused_emotion_scores = {}
        for emotion in self.WILLCOX_PRIMARY:
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
        
        # Secondary: prefer Ollama if valid, else use embedding scores
        secondary = None
        if ollama_result and ollama_result.get('secondary'):
            secondary_candidate = ollama_result['secondary']
            # Validate it belongs to primary
            if primary in self.WILLCOX_HIERARCHY and secondary_candidate in self.WILLCOX_HIERARCHY[primary]:
                secondary = secondary_candidate
        
        if not secondary:
            # Compute secondary for the final primary if not already computed
            if primary not in secondary_tertiary_scores and primary in self.WILLCOX_HIERARCHY:
                print(f"   Computing secondary/tertiary for {primary} (not in top 2)")
                secondaries = list(self.WILLCOX_HIERARCHY[primary].keys())
                secondary_scores_fresh = self._embedding_similarity(normalized_text, secondaries)
                top_secondary = max(secondary_scores_fresh.items(), key=lambda x: x[1])
                secondary = top_secondary[0]
                
                # Store for tertiary lookup
                tertiaries = self.WILLCOX_HIERARCHY[primary][secondary]
                tertiary_scores_fresh = self._embedding_similarity(normalized_text, tertiaries)
                secondary_tertiary_scores[primary] = {
                    'secondary': secondary,
                    'tertiaries': tertiary_scores_fresh
                }
            elif primary in secondary_tertiary_scores:
                # Use already computed embedding-based secondary
                secondary = secondary_tertiary_scores[primary]['secondary']
        
        # Tertiary: ALWAYS enforce non-null (W1: Willcox completeness requirement)
        tertiary = None
        if ollama_result and ollama_result.get('tertiary') and secondary:
            tertiary_candidate = ollama_result['tertiary']
            # Validate it belongs to secondary
            if primary in self.WILLCOX_HIERARCHY and secondary in self.WILLCOX_HIERARCHY[primary]:
                if tertiary_candidate in self.WILLCOX_HIERARCHY[primary][secondary]:
                    tertiary = tertiary_candidate
        
        if not tertiary and secondary and primary in secondary_tertiary_scores:
            # Use top embedding tertiary
            tertiaries = secondary_tertiary_scores[primary].get('tertiaries', {})
            if tertiaries:
                tertiary = max(tertiaries.items(), key=lambda x: x[1])[0]
        
        # CRITICAL: Enforce non-null tertiary via nearest neighbor fallback
        if not tertiary and secondary and primary in self.WILLCOX_HIERARCHY:
            # Fallback: pick first tertiary from secondary (deterministic)
            available_tertiaries = self.WILLCOX_HIERARCHY[primary].get(secondary, [])
            if available_tertiaries:
                tertiary = available_tertiaries[0]  # Deterministic first choice
                print(f"   [!] Tertiary fallback: {primary}/{secondary} -> {tertiary} (first in list)")
        
        # Last resort: if still no tertiary but have secondary, pick ANY tertiary from that secondary
        if not tertiary and secondary and primary in self.WILLCOX_HIERARCHY:
            for sec_key, terts in self.WILLCOX_HIERARCHY[primary].items():
                if sec_key == secondary and terts:
                    tertiary = terts[0]
                    print(f"   [!!] Emergency tertiary: {tertiary} from {primary}/{secondary}")
                    break
        
        # Invoked: top 3 drivers from embedding similarity
        top_drivers = sorted(driver_scores.items(), key=lambda x: -x[1])[:3]
        invoked = [d[0] for d in top_drivers if d[1] > 0.1]  # Filter weak matches
        
        # Boost from Ollama if present
        if ollama_result and ollama_result.get('invoked'):
            ollama_invoked = ollama_result['invoked']
            if isinstance(ollama_invoked, list):
                invoked = list(set(invoked + ollama_invoked[:3]))[:3]
        
        # Expressed: top 2-3 surface tones
        top_surface = sorted(surface_scores.items(), key=lambda x: -x[1])[:3]
        expressed = [s[0] for s in top_surface if s[1] > 0.1]
        
        # Boost from Ollama
        if ollama_result and ollama_result.get('expressed'):
            ollama_expressed = ollama_result['expressed']
            if isinstance(ollama_expressed, list):
                expressed = list(set(expressed + ollama_expressed[:3]))[:3]
        
        # Valence/Arousal: Use Willcox ranges + circadian priors (A1)
        valence, arousal = self._estimate_valence_arousal(primary, secondary, driver_scores, circadian_phase)
        
        # Confidence: based on agreement across models
        confidence = self._estimate_confidence(hf_scores, ollama_result, primary)
        
        return {
            'primary': primary,
            'secondary': secondary,
            'tertiary': tertiary,
            'invoked': invoked,
            'expressed': expressed,
            'valence': valence,
            'arousal': arousal,
            'confidence': confidence,
        }
    
    def _estimate_valence_arousal(
        self,
        primary: str,
        secondary: Optional[str],
        driver_scores: Dict[str, float],
        circadian_phase: Optional[str] = None
    ) -> Tuple[float, float]:
        """
        Estimate valence and arousal from Willcox emotion + text signals + circadian priors
        
        A1: Circadian priors - morning boosts valence/arousal, night dampens
        
        Args:
            primary: Willcox primary emotion
            secondary: Willcox secondary emotion (optional)
            driver_scores: Embedding similarity scores for driver lexicon
            circadian_phase: Time of day phase ('morning', 'afternoon', 'evening', 'night')
        
        Returns:
            (valence, arousal) tuple in [0, 1]
        """
        # Use Willcox valence/arousal ranges
        va_range = self.WILLCOX_VA_MAP.get(primary, {'valence': (0.4, 0.6), 'arousal': (0.4, 0.6)})
        
        # Start with midpoint of range
        base_v = sum(va_range['valence']) / 2
        base_a = sum(va_range['arousal']) / 2
        
        # Adjust based on secondary (move within range)
        if secondary:
            secondary_lower = secondary.lower()
            # Move toward high end of range for energized secondaries
            if any(word in secondary_lower for word in ['excited', 'energetic', 'passionate', 'furious']):
                base_a = va_range['arousal'][1] - 0.05
            # Move toward low end for calm secondaries
            if any(word in secondary_lower for word in ['calm', 'content', 'relaxed', 'peaceful']):
                base_a = va_range['arousal'][0] + 0.05
        
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
        
        # A1: Apply circadian priors (phase-aware bias)
        if circadian_phase:
            if circadian_phase == 'morning':
                # Morning: boost both valence and arousal (awakening, energized baseline)
                base_v += 0.10  # Range: +0.07 to +0.15 per spec
                base_a += 0.15  # Range: +0.10 to +0.20 per spec
                print(f"   [A1 Circadian Prior] Morning bias: V +0.10, A +0.15")
            elif circadian_phase == 'night':
                # Night: dampen both (fatigue, winding down)
                base_v -= 0.07  # Range: -0.05 to -0.10 per spec
                base_a -= 0.07  # Range: -0.05 to -0.10 per spec
                print(f"   [A1 Circadian Prior] Night bias: V -0.07, A -0.07")
            # Afternoon/evening: neutral (no prior)
        
        # Clamp to [0, 1]
        valence = max(0.0, min(1.0, base_v))
        arousal = max(0.0, min(1.0, base_a))
        
        return valence, arousal
    
    def _apply_adaptive_ema_smoothing(
        self,
        raw_valence: float,
        raw_arousal: float,
        history: list,
        confidence: float,
        timestamp: Optional[str] = None
    ) -> Tuple[float, float, Dict]:
        """
        A2: Apply EMA smoothing with adaptive alpha
        
        Alpha calculation based on:
        - User history sparsity (sparse → high α, rely more on current)
        - Expressed confidence (low → high α, rely more on current as signal is weak)
        - Time since last reflection (long gap → high α, context shifted)
        
        Args:
            raw_valence: Current reflection's valence
            raw_arousal: Current reflection's arousal
            history: List of past reflections
            confidence: Confidence score [0, 1]
            timestamp: Current reflection timestamp
        
        Returns:
            (smoothed_valence, smoothed_arousal, metadata_dict)
        """
        if not history:
            return raw_valence, raw_arousal, {'alpha': 1.0, 'raw_v': raw_valence, 'raw_a': raw_arousal, 'reason': 'no_history'}
        
        # Calculate adaptive alpha
        base_alpha = 0.4  # Default moderate smoothing
        
        # Factor 1: History sparsity (fewer reflections → higher α)
        history_count = len(history)
        if history_count < 5:
            sparsity_boost = 0.2
        elif history_count < 15:
            sparsity_boost = 0.1
        else:
            sparsity_boost = 0.0
        
        # Factor 2: Confidence (low confidence → higher α, trust current less)
        # Actually INVERTED: low confidence means raw signal is unreliable, so LOWER α (more smoothing)
        if confidence < 0.5:
            confidence_adjust = -0.15  # More smoothing
        elif confidence > 0.8:
            confidence_adjust = 0.1   # Less smoothing, trust current
        else:
            confidence_adjust = 0.0
        
        # Factor 3: Time since last (long gap → higher α, context changed)
        time_gap_boost = 0.0
        if timestamp and history:
            try:
                from datetime import datetime
                current_dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                last_ts = history[-1].get('enriched_at') or history[-1].get('created_at')
                if last_ts:
                    last_dt = datetime.fromisoformat(last_ts.replace('Z', '+00:00'))
                    gap_days = (current_dt - last_dt).total_seconds() / 86400
                    
                    if gap_days >= 20:
                        time_gap_boost = 0.25  # α ≥ 0.6 per spec
                    elif gap_days >= 7:
                        time_gap_boost = 0.15
                    elif gap_days <= 2:
                        time_gap_boost = -0.15  # α ≤ 0.3 per spec (more smoothing for frequent)
            except:
                pass
        
        # Compute final alpha
        alpha = base_alpha + sparsity_boost + confidence_adjust + time_gap_boost
        alpha = max(0.0, min(1.0, alpha))  # Clamp to [0, 1]
        
        # Compute historical EMA (7-day window)
        def get_recent_ema(history, field, window=7):
            recent_vals = [h.get('final', {}).get(field, 0.5) for h in history[-window:]]
            if not recent_vals:
                return 0.5
            # Simple average (could use proper EMA, but average is simpler for baseline)
            return sum(recent_vals) / len(recent_vals)
        
        historical_v = get_recent_ema(history, 'valence')
        historical_a = get_recent_ema(history, 'arousal')
        
        # Blend: smoothed = α * current + (1 - α) * historical
        smoothed_v = alpha * raw_valence + (1 - alpha) * historical_v
        smoothed_a = alpha * raw_arousal + (1 - alpha) * historical_a
        
        # Clamp
        smoothed_v = max(0.0, min(1.0, smoothed_v))
        smoothed_a = max(0.0, min(1.0, smoothed_a))
        
        return smoothed_v, smoothed_a, {
            'alpha': round(alpha, 2),
            'raw_v': round(raw_valence, 2),
            'raw_a': round(raw_arousal, 2),
            'historical_v': round(historical_v, 2),
            'historical_a': round(historical_a, 2),
            'reason': f"sparse:{sparsity_boost:+.2f}, conf:{confidence_adjust:+.2f}, gap:{time_gap_boost:+.2f}"
        }
    
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
        Deterministic correction pass to validate Willcox hierarchy + filter contradictions
        
        Args:
            fused: Fused scores dict
            text: Original text for validation
        
        Returns:
            Corrected dict
        """
        corrected = fused.copy()
        
        # Validate Willcox hierarchy consistency
        primary = corrected['primary']
        secondary = corrected.get('secondary')
        tertiary = corrected.get('tertiary')
        
        # Ensure secondary belongs to primary
        if secondary:
            if primary not in self.WILLCOX_HIERARCHY or secondary not in self.WILLCOX_HIERARCHY[primary]:
                print(f"❌ Invalid secondary '{secondary}' for primary '{primary}' - clearing")
                corrected['secondary'] = None
                corrected['tertiary'] = None  # Cascade clear
                secondary = None
                tertiary = None
        
        # Ensure tertiary belongs to secondary
        if tertiary and secondary:
            if primary not in self.WILLCOX_HIERARCHY or secondary not in self.WILLCOX_HIERARCHY[primary]:
                print(f"[X] Invalid tertiary '{tertiary}' for secondary '{secondary}' - clearing")
                corrected['tertiary'] = None
                tertiary = None
            elif tertiary not in self.WILLCOX_HIERARCHY[primary][secondary]:
                print(f"[X] Invalid tertiary '{tertiary}' for '{primary}/{secondary}' - clearing")
                corrected['tertiary'] = None
                tertiary = None
        
        # Filter contradictory events
        invoked = corrected.get('invoked', [])
        expressed = corrected.get('expressed', [])
        
        if isinstance(invoked, list):
            # Check for contradictions
            for emotion_word in expressed:
                if emotion_word in self.CONTRADICTORY_EVENTS:
                    contradicts = self.CONTRADICTORY_EVENTS[emotion_word]
                    # Remove contradictory drivers
                    invoked = [inv for inv in invoked if inv not in contradicts]
            
            corrected['invoked'] = invoked[:3]
        
        # Ensure valence/arousal consistency with Willcox ranges
        valence = corrected.get('valence', 0.5)
        arousal = corrected.get('arousal', 0.5)
        
        # Use Willcox ranges to constrain
        if primary in self.WILLCOX_VA_MAP:
            va_range = self.WILLCOX_VA_MAP[primary]
            v_min, v_max = va_range['valence']
            a_min, a_max = va_range['arousal']
            
            # Clamp to range (with some tolerance)
            if valence < v_min - 0.1:
                corrected['valence'] = v_min
            elif valence > v_max + 0.1:
                corrected['valence'] = v_max
            
            if arousal < a_min - 0.1:
                corrected['arousal'] = a_min
            elif arousal > a_max + 0.1:
                corrected['arousal'] = a_max
        
        return corrected
    
    def _serialize_output(self, corrected: Dict, events: list, warnings: list, normalized_text: str) -> Dict:
        """
        Serialize to exact schema with Willcox 3-level hierarchy
        
        CRITICAL: Must match OllamaClient.enrich() output format exactly
        
        Args:
            corrected: Corrected fused scores dict
            events: List of event dicts with label and confidence
            warnings: List of warning strings from risk signals
            normalized_text: Normalized/cleaned reflection text
        
        Returns schema-compatible dict with wheel.tertiary added
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
        
        # Wheel: CRITICAL - ALWAYS return complete 3-level hierarchy (source of truth from image)
        # NEVER allow secondary or tertiary to be None - enforce completeness
        primary = corrected.get('primary', 'Sad')
        secondary = corrected.get('secondary', None)
        tertiary = corrected.get('tertiary', None)
        
        # ENFORCE: If secondary is None but we have primary, pick first secondary
        if not secondary and primary in self.WILLCOX_HIERARCHY:
            secondary = list(self.WILLCOX_HIERARCHY[primary].keys())[0]
            print(f"   [!!] CRITICAL: Secondary was None, forced to {secondary}")
        
        # ENFORCE: If tertiary is None but we have secondary, pick first tertiary
        if not tertiary and secondary and primary in self.WILLCOX_HIERARCHY:
            if secondary in self.WILLCOX_HIERARCHY[primary]:
                tertiary = self.WILLCOX_HIERARCHY[primary][secondary][0]
                print(f"   [!!] CRITICAL: Tertiary was None, forced to {tertiary}")
        
        wheel = {
            'primary': primary,
            'secondary': secondary,  # MUST NOT be None
            'tertiary': tertiary      # MUST NOT be None
        }
        
        # ASSERTION: Validate completeness (source of truth requirement)
        if not wheel['secondary'] or not wheel['tertiary']:
            raise ValueError(f"WILLCOX WHEEL INTEGRITY VIOLATION: Incomplete wheel {wheel} - all 3 levels required (source of truth)")
        
        # Valence/arousal/confidence
        valence = corrected.get('valence', 0.5)
        arousal = corrected.get('arousal', 0.5)
        confidence = corrected.get('confidence', 0.75)
        
        # Use events passed in (already mapped to event dicts)
        # Don't recompute from invoked_list
        
        # Willingness cues: empty nested object (worker.py will merge with text cues)
        willingness_cues = {
            'hedges': [],
            'intensifiers': [],
            'negations': [],
            'self_reference': []
        }
        
        return {
            'normalized_text': normalized_text,  # Add normalized text for Stage-2
            'invoked': invoked_str,           # str with " + " separator
            'expressed': expressed_str,       # str with " / " separator
            'wheel': wheel,                   # {primary: str, secondary: str|null, tertiary: str|null}
            'valence': float(valence),        # float [0,1]
            'arousal': float(arousal),        # float [0,1]
            'confidence': float(confidence),  # float [0,1]
            'events': events,                 # list[dict] with label and confidence
            'warnings': warnings,             # list[str] from risk signals
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
