"""
Urban India Emotion Calibration Module
=======================================
Applies context-aware valence/arousal adjustments and Willcox Wheel overrides
for reflections from urban Indian users.

SYSTEM UPDATE — EMOTION CALIBRATION & RITUAL STYLE (URBAN INDIA)
Applied BEFORE hybrid scoring to adjust raw V/A values and force wheel alignment.

Rules:
1. Valence/Arousal Recalibration for urban loneliness cues
2. Willcox Wheel Override for specific token patterns
3. Language Detection refinement (en vs mixed)
4. Congruence recomputation after overrides
5. Enrichment style guardrails (grounded, urban-cool, no therapy clichés)
"""

import re
from typing import Dict, Tuple, Optional, List


class UrbanIndiaCalibrator:
    """
    Calibrates emotion detection for urban India context
    """
    
    def __init__(self):
        # Loneliness/fatigue cues that should lower valence
        self.loneliness_cues = {
            'alone', 'alone again', 'isolated', 'heavy', 'long day',
            'tired', 'traffic', 'dinner alone', 'skyline at night',
            'commute', 'hopping'
        }
        
        # Movement/energy cues that raise arousal slightly
        self.movement_cues = {
            'hopping', 'traffic', 'commute', 'running', 'rushing', 'moving'
        }
        
        # Softening/soothing cues that add back valence and reduce arousal
        self.soothing_cues = {
            'peaceful', 'calm', 'quiet', 'relieved', 'grateful', 
            'content', 'safe', 'comfortable', 'settled'
        }
        
        # Tokens that should force Sad→Lonely→Isolated
        self.force_lonely_tokens = {
            'alone', 'alone again', 'isolated', 'skyline at night', 
            'heavy', 'dinner alone', 'nobody', 'by myself'
        }
        
        # English stopwords for language detection
        self.english_stopwords = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'am', 'are', 'been',
            'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'can', 'i', 'you', 'he', 'she',
            'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
            'this', 'that', 'these', 'those', 'what', 'which', 'who', 'when', 'where'
        }
        
        # Hindi/Urdu/Hinglish code-switch markers
        self.code_switch_markers = {
            'yaar', 'hai', 'nahi', 'kya', 'bas', 'haan', 'na', 'toh', 'par',
            'aur', 'mein', 'mere', 'teri', 'tera', 'sab', 'kuch', 'bhi', 'hi'
        }
    
    def calibrate_valence_arousal(
        self, 
        text: str, 
        initial_valence: float, 
        initial_arousal: float
    ) -> Tuple[float, float, Dict[str, any]]:
        """
        Apply urban India valence/arousal calibration rules
        
        Args:
            text: Normalized reflection text (lowercase)
            initial_valence: Pre-calibration valence [0,1]
            initial_arousal: Pre-calibration arousal [0,1]
        
        Returns:
            (calibrated_valence, calibrated_arousal, calibration_metadata)
        """
        text_lower = text.lower()
        tokens = set(re.findall(r'\b\w+\b', text_lower))
        
        valence = initial_valence
        arousal = initial_arousal
        adjustments = []
        
        # Rule 1: Loneliness/fatigue bias
        loneliness_matches = tokens & self.loneliness_cues
        if loneliness_matches:
            valence -= 0.20
            adjustments.append(f"loneliness_bias: -{0.20} (matched: {', '.join(loneliness_matches)})")
            
            # Sub-rule: Movement cues slightly raise arousal
            movement_matches = tokens & self.movement_cues
            if movement_matches:
                arousal += 0.10
                adjustments.append(f"movement_arousal: +{0.10} (matched: {', '.join(movement_matches)})")
        
        # Rule 2: Softening cues (applied AFTER negatives)
        soothing_matches = tokens & self.soothing_cues
        if soothing_matches:
            valence += 0.10
            arousal -= 0.05
            adjustments.append(f"soothing_cues: V+{0.10}, A-{0.05} (matched: {', '.join(soothing_matches)})")
        
        # Clamp to valid range
        valence = max(0.0, min(1.0, valence))
        arousal = max(0.0, min(1.0, arousal))
        
        # Target clamp for blended-sad-calm: V in [0.40,0.55], A in [0.40,0.55]
        if loneliness_matches and not soothing_matches:
            # If primarily lonely without soothing, nudge into sad-calm zone
            if valence < 0.40:
                valence = 0.40
                adjustments.append("target_clamp: V raised to 0.40 (sad-calm floor)")
            elif valence > 0.55:
                valence = 0.55
                adjustments.append("target_clamp: V lowered to 0.55 (sad-calm ceiling)")
            
            if arousal < 0.40:
                arousal = 0.40
                adjustments.append("target_clamp: A raised to 0.40 (sad-calm floor)")
            elif arousal > 0.55:
                arousal = 0.55
                adjustments.append("target_clamp: A lowered to 0.55 (sad-calm ceiling)")
        
        metadata = {
            'initial_valence': initial_valence,
            'initial_arousal': initial_arousal,
            'calibrated_valence': valence,
            'calibrated_arousal': arousal,
            'adjustments': adjustments,
            'loneliness_cues_matched': list(loneliness_matches),
            'soothing_cues_matched': list(soothing_matches),
            'movement_cues_matched': list(tokens & self.movement_cues)
        }
        
        return (valence, arousal, metadata)
    
    def override_wheel(
        self, 
        text: str, 
        valence: float,
        arousal: float,
        initial_wheel: Dict[str, Optional[str]]
    ) -> Tuple[Dict[str, Optional[str]], Dict[str, any]]:
        """
        Apply Willcox Wheel overrides for specific urban context patterns
        
        Args:
            text: Normalized reflection text (lowercase)
            valence: Calibrated valence [0,1]
            arousal: Calibrated arousal [0,1]
            initial_wheel: Current wheel classification {primary, secondary, tertiary}
        
        Returns:
            (overridden_wheel, override_metadata)
        """
        text_lower = text.lower()
        tokens = set(re.findall(r'\b\w+\b', text_lower))
        
        wheel = dict(initial_wheel)  # Copy to avoid mutation
        override_applied = False
        reason = None
        
        # Rule: Force Sad→Lonely→Isolated for loneliness tokens with low valence
        lonely_matches = tokens & self.force_lonely_tokens
        if lonely_matches and valence <= 0.55:
            wheel['primary'] = 'Sad'
            wheel['secondary'] = 'Lonely'
            wheel['tertiary'] = 'Isolated'
            override_applied = True
            reason = f"Forced Sad→Lonely→Isolated (tokens: {', '.join(lonely_matches)}, V={valence:.2f})"
        
        # Exception: Switch to Peaceful/Comfortable if strong soothing cues present
        soothing_count = len(tokens & self.soothing_cues)
        if soothing_count >= 2 and valence >= 0.65 and arousal <= 0.35:
            wheel['primary'] = 'Peaceful'
            wheel['secondary'] = 'Content'
            wheel['tertiary'] = 'Comfortable'
            override_applied = True
            reason = f"Switched to Peaceful→Content→Comfortable (soothing_count={soothing_count}, V={valence:.2f}, A={arousal:.2f})"
        
        metadata = {
            'initial_wheel': initial_wheel,
            'overridden_wheel': wheel,
            'override_applied': override_applied,
            'reason': reason,
            'lonely_tokens_matched': list(lonely_matches) if lonely_matches else []
        }
        
        return (wheel, metadata)
    
    def detect_language(self, text: str) -> Tuple[str, Dict[str, any]]:
        """
        Refined language detection: en vs mixed (code-switched)
        
        Args:
            text: Normalized reflection text
        
        Returns:
            (lang_code, detection_metadata)
            lang_code: 'en' | 'mixed'
        """
        text_lower = text.lower()
        tokens = re.findall(r'\b\w+\b', text_lower)
        
        if not tokens:
            return ('en', {'reason': 'empty_text', 'ascii_ratio': 0.0, 'stopword_ratio': 0.0})
        
        # Check ASCII ratio (95% threshold)
        ascii_chars = sum(1 for c in text if ord(c) < 128)
        ascii_ratio = ascii_chars / len(text) if len(text) > 0 else 0.0
        
        # Check English stopword coverage (90% threshold)
        token_set = set(tokens)
        stopword_count = len(token_set & self.english_stopwords)
        stopword_ratio = stopword_count / len(token_set) if len(token_set) > 0 else 0.0
        
        # Check code-switch markers
        code_switch_count = len(token_set & self.code_switch_markers)
        
        # Decision logic
        if ascii_ratio >= 0.95 and stopword_ratio >= 0.90:
            lang = 'en'
            reason = f'Pure English (ASCII={ascii_ratio:.2f}, stopwords={stopword_ratio:.2f})'
        elif code_switch_count > 0:
            lang = 'mixed'
            reason = f'Code-switched (markers={code_switch_count}: {", ".join(token_set & self.code_switch_markers)})'
        else:
            # Default to 'en' if no clear code-switching detected
            lang = 'en'
            reason = f'Defaulting to English (no code-switch markers, ASCII={ascii_ratio:.2f})'
        
        metadata = {
            'detected_lang': lang,
            'ascii_ratio': ascii_ratio,
            'stopword_ratio': stopword_ratio,
            'code_switch_count': code_switch_count,
            'code_switch_tokens': list(token_set & self.code_switch_markers) if code_switch_count > 0 else [],
            'reason': reason
        }
        
        return (lang, metadata)
    
    def recompute_congruence(
        self, 
        wheel: Dict[str, Optional[str]], 
        valence: float, 
        arousal: float
    ) -> float:
        """
        Recompute congruence after wheel override and V/A calibration
        
        Congruence = alignment between wheel classification and V/A coordinates
        Expected range after calibration: 0.75–0.85
        
        Args:
            wheel: Calibrated wheel {primary, secondary, tertiary}
            valence: Calibrated valence [0,1]
            arousal: Calibrated arousal [0,1]
        
        Returns:
            congruence: float [0, 1]
        """
        primary = wheel.get('primary')
        
        # Expected V/A ranges for each Willcox primary
        expected_ranges = {
            'Happy': {'v': (0.65, 1.0), 'a': (0.5, 1.0)},      # High V, high A
            'Peaceful': {'v': (0.55, 0.85), 'a': (0.2, 0.5)},  # Mid-high V, low A
            'Strong': {'v': (0.6, 0.9), 'a': (0.6, 1.0)},      # High V, high A
            'Sad': {'v': (0.0, 0.55), 'a': (0.2, 0.6)},        # Low V, low-mid A
            'Angry': {'v': (0.1, 0.5), 'a': (0.6, 1.0)},       # Low V, high A
            'Fearful': {'v': (0.2, 0.5), 'a': (0.6, 1.0)}      # Low-mid V, high A
        }
        
        if primary not in expected_ranges:
            return 0.5  # Default congruence for unknown primary
        
        expected = expected_ranges[primary]
        
        # Calculate alignment (distance from expected range)
        v_in_range = expected['v'][0] <= valence <= expected['v'][1]
        a_in_range = expected['a'][0] <= arousal <= expected['a'][1]
        
        if v_in_range and a_in_range:
            congruence = 0.85  # Perfect alignment
        elif v_in_range or a_in_range:
            congruence = 0.75  # Partial alignment
        else:
            # Calculate distance penalty
            v_dist = min(abs(valence - expected['v'][0]), abs(valence - expected['v'][1]))
            a_dist = min(abs(arousal - expected['a'][0]), abs(arousal - expected['a'][1]))
            avg_dist = (v_dist + a_dist) / 2
            congruence = max(0.5, 0.85 - avg_dist)  # Penalize distance
        
        return round(congruence, 2)


# Singleton instance
_calibrator = None

def get_calibrator() -> UrbanIndiaCalibrator:
    """Get or create singleton calibrator instance"""
    global _calibrator
    if _calibrator is None:
        _calibrator = UrbanIndiaCalibrator()
    return _calibrator
