"""
Enrichment Correction Agent
Iteratively refines enrichment results based on discrepancy detection and correction rules

Implements 12 discrepancy rules with detection, correction, and convergence logic:
1. Event detection baseline contamination
2. Wheel incoherence
3. Valence/arousal disagreement  
4. Comparator stagnation
5. EMA non-evolution
6. Expressed/invoked type mismatch
7. Over-confidence / under-confidence
8. Congruence flatline
9. Temporal/risk gaps
10. Typing/telemetry nonsense
11. Language label inconsistency
12. Schema integrity

Reference: Enrichment Refinement Spec (Oct 21, 2025)
"""

import re
from typing import Dict, List, Any, Optional, Tuple
from collections import Counter
import math


class CorrectionAgent:
    """
    Iterative enrichment correction agent
    
    Detects discrepancies between current enrichment output and expected gold values,
    applies corrections, and iterates until convergence.
    """
    
    def __init__(self, max_iterations: int = 5, convergence_threshold: float = 0.05):
        """
        Initialize correction agent
        
        Args:
            max_iterations: Maximum correction iterations per reflection
            convergence_threshold: Target diff_score for convergence
        """
        self.max_iterations = max_iterations
        self.convergence_threshold = convergence_threshold
        
        # Plutchik wheel adjacency map for rule #2
        self.wheel_adjacency = {
            'joy': ['trust', 'anticipation'],
            'trust': ['joy', 'fear'],
            'fear': ['trust', 'surprise'],
            'surprise': ['fear', 'sadness'],
            'sadness': ['surprise', 'disgust'],
            'disgust': ['sadness', 'anger'],
            'anger': ['disgust', 'anticipation'],
            'anticipation': ['anger', 'joy']
        }
        
        # Opposing quadrants for incoherence detection
        self.wheel_opposites = {
            'joy': 'sadness',
            'sadness': 'joy',
            'trust': 'disgust',
            'disgust': 'trust',
            'fear': 'anger',
            'anger': 'fear',
            'surprise': 'anticipation',
            'anticipation': 'surprise'
        }
        
        # Withdrawal/self-harm patterns for rule #9
        self.risk_patterns = {
            'withdrawal_intent_low': [
                r'\bwant to disappear\b',
                r'\bwish i could vanish\b',
                r'\bcannot go on\b',
                r'\btoo much\b',
                r'\bcan\'t anymore\b'
            ],
            'self_harm_ideation_weak': [
                r'\bhurt myself\b',
                r'\bend it\b',
                r'\bnot worth\b'
            ]
        }
    
    def correct_batch(self, reflections: List[Dict], expected: Optional[List[Dict]] = None) -> List[Dict]:
        """
        Correct a batch of reflections iteratively
        
        Args:
            reflections: List of enriched reflections to correct
            expected: Optional list of expected gold values for validation
        
        Returns:
            List of corrected reflections
        """
        corrected = []
        
        for i, reflection in enumerate(reflections):
            expected_ref = expected[i] if expected and i < len(expected) else None
            corrected_reflection = self.correct_single(reflection, expected_ref)
            corrected.append(corrected_reflection)
        
        return corrected
    
    def correct_single(self, reflection: Dict, expected: Optional[Dict] = None) -> Dict:
        """
        Correct a single reflection through iterative refinement
        
        Args:
            reflection: Enriched reflection to correct
            expected: Optional expected gold values
        
        Returns:
            Corrected reflection
        """
        current = reflection.copy()
        iteration = 0
        
        while iteration < self.max_iterations:
            # Track changes in this iteration
            changes_made = False
            
            # Apply all 12 discrepancy rules
            current, changed = self._apply_all_rules(current, expected)
            changes_made = changes_made or changed
            
            # Check convergence
            if expected:
                diff_score = self._compute_diff_score(current, expected)
                if diff_score < self.convergence_threshold and not changes_made:
                    break
            elif not changes_made:
                # No expected values, stop when no more changes
                break
            
            iteration += 1
        
        return current
    
    def _apply_all_rules(self, reflection: Dict, expected: Optional[Dict]) -> Tuple[Dict, bool]:
        """Apply all 12 discrepancy rules"""
        changes_made = False
        
        # Rule 1: Event detection baseline contamination
        reflection, changed = self._rule_1_baseline_contamination(reflection)
        changes_made = changes_made or changed
        
        # Rule 2: Wheel incoherence
        reflection, changed = self._rule_2_wheel_incoherence(reflection)
        changes_made = changes_made or changed
        
        # Rule 3: Valence/arousal disagreement
        reflection, changed = self._rule_3_valence_arousal_disagreement(reflection)
        changes_made = changes_made or changed
        
        # Rule 4: Comparator stagnation
        reflection, changed = self._rule_4_comparator_stagnation(reflection, expected)
        changes_made = changes_made or changed
        
        # Rule 5: EMA non-evolution
        reflection, changed = self._rule_5_ema_non_evolution(reflection)
        changes_made = changes_made or changed
        
        # Rule 6: Expressed/invoked type mismatch
        reflection, changed = self._rule_6_type_mismatch(reflection)
        changes_made = changes_made or changed
        
        # Rule 7: Over-confidence / under-confidence
        reflection, changed = self._rule_7_confidence_calibration(reflection)
        changes_made = changes_made or changed
        
        # Rule 8: Congruence flatline
        reflection, changed = self._rule_8_congruence_flatline(reflection)
        changes_made = changes_made or changed
        
        # Rule 9: Temporal/risk gaps
        reflection, changed = self._rule_9_risk_gaps(reflection)
        changes_made = changes_made or changed
        
        # Rule 10: Typing/telemetry nonsense
        reflection, changed = self._rule_10_telemetry_nonsense(reflection)
        changes_made = changes_made or changed
        
        # Rule 11: Language label inconsistency
        reflection, changed = self._rule_11_language_inconsistency(reflection)
        changes_made = changes_made or changed
        
        # Rule 12: Schema integrity
        reflection, changed = self._rule_12_schema_integrity(reflection)
        changes_made = changes_made or changed
        
        return reflection, changes_made
    
    # ====================
    # RULE 1: Event Detection Baseline Contamination
    # ====================
    
    def _rule_1_baseline_contamination(self, reflection: Dict) -> Tuple[Dict, bool]:
        """
        Detect: same 3 events (fatigue, irritation, low_progress) repeated
        Correct: force lexical match or semantic cluster diversity
        Converge: ≥80% reflections have distinct event sets
        """
        final = reflection.get('final', {})
        invoked = final.get('invoked', [])
        
        # Check if it's the baseline contamination trio
        if isinstance(invoked, str):
            invoked = self._parse_stringified_array(invoked)
        
        baseline_trio = {'fatigue', 'irritation', 'low_progress'}
        invoked_set = set(invoked) if isinstance(invoked, list) else set()
        
        # Detect contamination
        if invoked_set == baseline_trio or invoked_set.issubset(baseline_trio):
            # Extract events from raw text using lexical matching
            raw_text = reflection.get('raw', {}).get('text', '')
            new_invoked = self._extract_events_from_text(raw_text)
            
            if new_invoked and set(new_invoked) != invoked_set:
                final['invoked'] = new_invoked
                reflection['final'] = final
                return reflection, True
        
        return reflection, False
    
    def _extract_events_from_text(self, text: str) -> List[str]:
        """Extract emotion-related events from text using lexical matching"""
        text_lower = text.lower()
        
        # Event keyword mapping (simplified)
        event_keywords = {
            'joy': ['laugh', 'happy', 'fun', 'amuse', 'delight', 'enjoy'],
            'relief': ['relief', 'completed', 'finished', 'done with'],
            'progress': ['progress', 'achievement', 'accomplished'],
            'overwhelm': ['overwhelm', 'can\'t keep up', 'too much', 'pressure'],
            'stress': ['stress', 'tense', 'anxious', 'worried'],
            'belonging': ['friends', 'connect', 'together', 'belong'],
            'longing': ['miss', 'wish', 'want back', 'used to'],
            'loss': ['lost', 'gone', 'no longer'],
            'fear': ['fear', 'afraid', 'scared', 'nervous'],
            'self_assertion': ['spoke up', 'said something', 'stand up'],
            'pride': ['proud', 'strong', 'did it'],
            'exhaustion': ['exhaust', 'tired', 'drained', 'worn out'],
            'withdrawal': ['disappear', 'vanish', 'hide', 'alone'],
            'hurt': ['hurt', 'stung', 'wounded', 'pain'],
            'irritation': ['irritat', 'annoy', 'frustrat', 'bother'],
            'awe': ['awe', 'unreal', 'amazing', 'incredible'],
            'serenity': ['calm', 'peace', 'serene', 'tranquil'],
            'frustration': ['frustrat', 'repeating', 'again', 'mistake'],
            'learning': ['learn', 'trying', 'attempt'],
            'change': ['shift', 'change', 'transform'],
            'renewal': ['renew', 'new', 'fresh'],
            'uncertainty': ['weird', 'confus', 'unclear', 'don\'t know'],
            'complexity': ['mix', 'complicated', 'both'],
            'contentment': ['content', 'satisfied', 'enough']
        }
        
        detected_events = []
        for event, keywords in event_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    detected_events.append(event)
                    break
        
        return detected_events[:5]  # Return top 5 matches
    
    # ====================
    # RULE 2: Wheel Incoherence
    # ====================
    
    def _rule_2_wheel_incoherence(self, reflection: Dict) -> Tuple[Dict, bool]:
        """
        Detect: primary & secondary in opposing quadrants with sentiment mismatch
        Correct: re-map secondary using adjacency or nullify
        Converge: no invalid pairings
        """
        final = reflection.get('final', {})
        wheel = final.get('wheel', {})
        primary = wheel.get('primary', '')
        secondary = wheel.get('secondary', '')
        
        if not primary or not secondary:
            return reflection, False
        
        # Check if they're opposites
        if self.wheel_opposites.get(primary) == secondary:
            # Compute sentiment from valence
            valence = final.get('valence', 0)
            
            # If opposing emotions but sentiment doesn't justify, fix secondary
            if abs(valence) < 0.4:  # Mixed sentiment shouldn't have clear opposites
                # Try adjacent emotion
                adjacent = self.wheel_adjacency.get(primary, [])
                if adjacent:
                    wheel['secondary'] = adjacent[0]
                    final['wheel'] = wheel
                    reflection['final'] = final
                    return reflection, True
        
        return reflection, False
    
    # ====================
    # RULE 3: Valence/Arousal Disagreement
    # ====================
    
    def _rule_3_valence_arousal_disagreement(self, reflection: Dict) -> Tuple[Dict, bool]:
        """
        Detect: |valence – final.valence| > 0.15 OR one = 0 while other > 0.5
        Correct: collapse to single canonical pair (use final.*)
        Converge: discrepancy < 0.1
        """
        final = reflection.get('final', {})
        top_level_valence = reflection.get('valence', 0)
        top_level_arousal = reflection.get('arousal', 0)
        final_valence = final.get('valence', 0)
        final_arousal = final.get('arousal', 0)
        
        valence_diff = abs(top_level_valence - final_valence)
        arousal_diff = abs(top_level_arousal - final_arousal)
        
        # Detect disagreement
        if valence_diff > 0.15 or arousal_diff > 0.15:
            # Collapse to final.* values (more reliable)
            reflection['valence'] = final_valence
            reflection['arousal'] = final_arousal
            return reflection, True
        
        # Check for zero mismatch
        if (top_level_valence == 0 and final_valence > 0.5) or \
           (final_valence == 0 and top_level_valence > 0.5):
            reflection['valence'] = final_valence
            return reflection, True
        
        if (top_level_arousal == 0 and final_arousal > 0.5) or \
           (final_arousal == 0 and top_level_arousal > 0.5):
            reflection['arousal'] = final_arousal
            return reflection, True
        
        return reflection, False
    
    # ====================
    # RULE 4: Comparator Stagnation
    # ====================
    
    def _rule_4_comparator_stagnation(self, reflection: Dict, expected: Optional[Dict]) -> Tuple[Dict, bool]:
        """
        Detect: identical expected values across all entries
        Correct: recompute baseline as rolling mean
        Converge: expected.valence variance > 0.02
        """
        # This rule requires batch context, handled at batch level
        # For now, skip in single-reflection mode
        return reflection, False
    
    # ====================
    # RULE 5: EMA Non-Evolution
    # ====================
    
    def _rule_5_ema_non_evolution(self, reflection: Dict) -> Tuple[Dict, bool]:
        """
        Detect: identical ema.v_* for all windows
        Correct: ensure monotonic smoothing
        Converge: 1-day, 7-day, 28-day EMAs show progression
        """
        ema = reflection.get('ema', {})
        v_1d = ema.get('v_1d', 0)
        v_7d = ema.get('v_7d', 0)
        v_28d = ema.get('v_28d', 0)
        
        # Detect if all are identical (unlikely in real EMA)
        if v_1d == v_7d == v_28d and v_1d != 0:
            # This suggests EMA wasn't computed properly
            # For now, set to None to flag for recomputation
            ema['v_1d'] = None
            ema['v_7d'] = None
            ema['v_28d'] = None
            reflection['ema'] = ema
            return reflection, True
        
        return reflection, False
    
    # ====================
    # RULE 6: Expressed/Invoked Type Mismatch
    # ====================
    
    def _rule_6_type_mismatch(self, reflection: Dict) -> Tuple[Dict, bool]:
        """
        Detect: final.invoked is stringified array OR expressed not proper array
        Correct: parse and re-cast to arrays
        Converge: schema validation passes
        """
        final = reflection.get('final', {})
        invoked = final.get('invoked', [])
        expressed = final.get('expressed', [])
        
        changed = False
        
        # Fix invoked if stringified
        if isinstance(invoked, str):
            final['invoked'] = self._parse_stringified_array(invoked)
            changed = True
        
        # Fix expressed if stringified
        if isinstance(expressed, str):
            final['expressed'] = self._parse_stringified_array(expressed)
            changed = True
        
        if changed:
            reflection['final'] = final
        
        return reflection, changed
    
    def _parse_stringified_array(self, value: str) -> List[str]:
        """Parse Python-style stringified array"""
        if not value or value == '[]':
            return []
        
        # Remove brackets and quotes, split by comma
        cleaned = value.strip('[]').replace("'", '').replace('"', '')
        if not cleaned:
            return []
        
        return [item.strip() for item in cleaned.split(',')]
    
    # ====================
    # RULE 7: Over-Confidence / Under-Confidence
    # ====================
    
    def _rule_7_confidence_calibration(self, reflection: Dict) -> Tuple[Dict, bool]:
        """
        Detect: confidence < 0.05 top-level AND final.confidence > 0.75
        Correct: recalibrate with dynamic scaling
        Converge: confidence within 0.1 of empirical accuracy
        """
        top_confidence = reflection.get('confidence', 0)
        final = reflection.get('final', {})
        final_confidence = final.get('confidence', 0)
        
        # Detect mismatch
        if top_confidence < 0.05 and final_confidence > 0.75:
            # Recalibrate using mid-point weighted towards final
            new_confidence = 0.5 + 0.5 * (final_confidence - 0.5)
            reflection['confidence'] = new_confidence
            final['confidence'] = new_confidence
            reflection['final'] = final
            return reflection, True
        
        return reflection, False
    
    # ====================
    # RULE 8: Congruence Flatline
    # ====================
    
    def _rule_8_congruence_flatline(self, reflection: Dict) -> Tuple[Dict, bool]:
        """
        Detect: constant 0.5 for all reflections
        Correct: compute correlation between expressed and invoked sentiment
        Converge: dynamic spread 0.3–0.8
        """
        congruence = reflection.get('congruence', 0.5)
        
        # Detect flatline (exactly 0.5)
        if congruence == 0.5:
            # Compute from invoked/expressed similarity
            final = reflection.get('final', {})
            invoked = final.get('invoked', [])
            expressed = final.get('expressed', [])
            
            if isinstance(invoked, str):
                invoked = self._parse_stringified_array(invoked)
            if isinstance(expressed, str):
                expressed = self._parse_stringified_array(expressed)
            
            # Compute overlap
            if invoked and expressed:
                overlap = len(set(invoked) & set(expressed))
                total = len(set(invoked) | set(expressed))
                new_congruence = overlap / total if total > 0 else 0.5
            elif invoked and not expressed:
                new_congruence = 0.3  # Low congruence - not expressing
            else:
                new_congruence = 0.5  # Default
            
            if new_congruence != congruence:
                reflection['congruence'] = new_congruence
                return reflection, True
        
        return reflection, False
    
    # ====================
    # RULE 9: Temporal/Risk Gaps
    # ====================
    
    def _rule_9_risk_gaps(self, reflection: Dict) -> Tuple[Dict, bool]:
        """
        Detect: all risk_signals_weak == []
        Correct: run lightweight regex for withdrawal/self-harm language
        Converge: at least 1 flagged for withdrawal text
        """
        risk_signals = reflection.get('risk_signals_weak', [])
        
        # If already has signals, skip
        if risk_signals:
            return reflection, False
        
        # Check text for risk patterns
        raw_text = reflection.get('raw', {}).get('text', '')
        detected_signals = []
        
        for signal_type, patterns in self.risk_patterns.items():
            for pattern in patterns:
                if re.search(pattern, raw_text, re.IGNORECASE):
                    detected_signals.append(signal_type)
                    break
        
        if detected_signals:
            reflection['risk_signals_weak'] = detected_signals
            return reflection, True
        
        return reflection, False
    
    # ====================
    # RULE 10: Typing/Telemetry Nonsense
    # ====================
    
    def _rule_10_telemetry_nonsense(self, reflection: Dict) -> Tuple[Dict, bool]:
        """
        Detect: duration_ms == 0 or wpm == 0
        Correct: replace with null
        Converge: no zero-filled telemetry
        """
        typing = reflection.get('typing', {})
        changed = False
        
        if typing.get('duration_ms', None) == 0:
            typing['duration_ms'] = None
            changed = True
        
        if typing.get('wpm', None) == 0:
            typing['wpm'] = None
            changed = True
        
        if changed:
            reflection['typing'] = typing
        
        return reflection, changed
    
    # ====================
    # RULE 11: Language Label Inconsistency
    # ====================
    
    def _rule_11_language_inconsistency(self, reflection: Dict) -> Tuple[Dict, bool]:
        """
        Detect: english text with lang_detected: mixed
        Correct: recompute with 0.9 confidence threshold
        Converge: ≤1 mis-tag out of 12
        """
        lang_detected = reflection.get('lang_detected', 'english')
        raw_text = reflection.get('raw', {}).get('text', '')
        
        # Simple heuristic: if mostly ASCII and no multilingual chars, it's English
        if lang_detected == 'mixed' and raw_text:
            # Count ASCII vs non-ASCII
            ascii_chars = sum(1 for c in raw_text if ord(c) < 128)
            total_chars = len(raw_text)
            
            if ascii_chars / total_chars > 0.9:
                reflection['lang_detected'] = 'english'
                return reflection, True
        
        return reflection, False
    
    # ====================
    # RULE 12: Schema Integrity
    # ====================
    
    def _rule_12_schema_integrity(self, reflection: Dict) -> Tuple[Dict, bool]:
        """
        Detect: inconsistent timezone, null mis-types, missing arrays
        Correct: canonicalize to Asia/Kolkata
        Converge: all JSON pass schema validation
        """
        changed = False
        
        # Canonicalize timezone
        if reflection.get('timezone', '') != 'Asia/Kolkata':
            reflection['timezone'] = 'Asia/Kolkata'
            changed = True
        
        # Ensure arrays exist
        if 'risk_signals_weak' not in reflection:
            reflection['risk_signals_weak'] = []
            changed = True
        
        final = reflection.get('final', {})
        if 'invoked' not in final:
            final['invoked'] = []
            changed = True
        if 'expressed' not in final:
            final['expressed'] = []
            changed = True
        
        if changed and 'final' in reflection:
            reflection['final'] = final
        
        return reflection, changed
    
    # ====================
    # Convergence Metrics
    # ====================
    
    def _compute_diff_score(self, current: Dict, expected: Dict) -> float:
        """
        Compute difference score between current and expected
        
        Returns:
            diff_score = abs(valence_err) + abs(arousal_err) + wheel_mismatch
        """
        current_final = current.get('final', {})
        expected_final = expected.get('final', {})
        
        # Valence error
        valence_err = abs(
            current_final.get('valence', 0) - expected_final.get('valence', 0)
        )
        
        # Arousal error
        arousal_err = abs(
            current_final.get('arousal', 0) - expected_final.get('arousal', 0)
        )
        
        # Wheel mismatch (binary: 1 if wrong, 0 if correct)
        current_wheel = current_final.get('wheel', {})
        expected_wheel = expected_final.get('wheel', {})
        wheel_mismatch = 1.0 if current_wheel.get('primary') != expected_wheel.get('primary') else 0.0
        
        return valence_err + arousal_err + wheel_mismatch
    
    def validate_batch(self, reflections: List[Dict], expected: List[Dict]) -> Dict[str, Any]:
        """
        Validate a batch of reflections against expected values
        
        Returns:
            Validation report with metrics and pass/fail status
        """
        total = len(reflections)
        errors = {
            'valence': [],
            'arousal': [],
            'wheel_primary': [],
            'diff_scores': []
        }
        
        for i, (current, exp) in enumerate(zip(reflections, expected)):
            diff_score = self._compute_diff_score(current, exp)
            errors['diff_scores'].append(diff_score)
            
            current_final = current.get('final', {})
            exp_final = exp.get('final', {})
            
            valence_err = abs(current_final.get('valence', 0) - exp_final.get('valence', 0))
            arousal_err = abs(current_final.get('arousal', 0) - exp_final.get('arousal', 0))
            
            errors['valence'].append(valence_err)
            errors['arousal'].append(arousal_err)
            
            if current_final.get('wheel', {}).get('primary') != exp_final.get('wheel', {}).get('primary'):
                errors['wheel_primary'].append(i)
        
        mean_diff = sum(errors['diff_scores']) / total
        mean_valence_err = sum(errors['valence']) / total
        mean_arousal_err = sum(errors['arousal']) / total
        wheel_accuracy = 1 - (len(errors['wheel_primary']) / total)
        
        passed = mean_diff < self.convergence_threshold and wheel_accuracy >= 0.9
        
        return {
            'passed': passed,
            'mean_diff_score': mean_diff,
            'mean_valence_error': mean_valence_err,
            'mean_arousal_error': mean_arousal_err,
            'wheel_accuracy': wheel_accuracy,
            'total_reflections': total,
            'threshold': self.convergence_threshold
        }
