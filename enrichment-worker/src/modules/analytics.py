"""
Baseline Analytics Module
Computes temporal EMAs, z-scores, circadian patterns, streaks, 
willingness-to-express, and latent state tracking
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import pytz
import re


class TemporalAnalyzer:
    """Compute EMAs, z-scores, WoW changes, and streaks"""
    
    def __init__(self, windows: List[int] = [1, 7, 28], zscore_window_days: int = 90):
        self.windows = windows
        self.zscore_window_days = zscore_window_days
    
    def compute_ema(self, current_value: float, history: List[Dict], window_days: int) -> float:
        """
        Compute exponential moving average
        
        Args:
            current_value: Current valence or arousal
            history: List of past reflections with {timestamp, valence, arousal}
            window_days: EMA window in days (1, 7, 28)
        
        Returns:
            EMA value
        """
        if not history:
            return current_value
        
        # Decay factor: alpha = 2 / (N + 1) where N is window
        alpha = 2 / (window_days + 1)
        
        # Start with current value
        ema = current_value
        
        # Weighted sum of recent history (most recent = highest weight)
        for item in history[-window_days:]:
            prev_value = item.get('valence', 0.5)  # Assume we're computing for valence
            ema = alpha * prev_value + (1 - alpha) * ema
        
        return round(ema, 3)
    
    def compute_zscore(self, current_value: float, history: List[Dict], field: str = 'valence') -> float:
        """
        Compute z-score against personal baseline
        
        Args:
            current_value: Current valence/arousal
            history: Past reflections
            field: 'valence' or 'arousal'
        
        Returns:
            Z-score (standard deviations from mean)
        """
        if len(history) < 5:
            return 0.0
        
        # Get values from history
        values = [item.get(field, 0.5) for item in history[-self.zscore_window_days:]]
        values.append(current_value)
        
        mean = np.mean(values)
        std = np.std(values)
        
        if std < 0.01:  # Avoid division by zero
            return 0.0
        
        zscore = (current_value - mean) / std
        return round(zscore, 2)
    
    def compute_wow_change(self, history: List[Dict], field: str = 'valence') -> float:
        """
        Week-over-week change: current 7d avg vs prior 7d avg
        
        Args:
            history: Past reflections
            field: 'valence' or 'arousal'
        
        Returns:
            WoW change (e.g., -0.3 means 0.3 drop)
        """
        if len(history) < 14:
            return 0.0
        
        # Current week (last 7 days)
        current_week = [item.get(field, 0.5) for item in history[-7:]]
        
        # Prior week (days 8-14 ago)
        prior_week = [item.get(field, 0.5) for item in history[-14:-7]]
        
        current_avg = np.mean(current_week)
        prior_avg = np.mean(prior_week)
        
        return round(current_avg - prior_avg, 3)
    
    def compute_streaks(self, history: List[Dict], current_valence: float) -> Dict:
        """
        Compute positive/negative streaks
        
        Args:
            history: Past reflections
            current_valence: Current valence
        
        Returns:
            {positive_valence_days, negative_valence_days}
        """
        positive_streak = 0
        negative_streak = 0
        
        # Add current day
        recent = history[-30:] + [{'valence': current_valence}]
        
        # Count backward from most recent
        for item in reversed(recent):
            v = item.get('valence', 0.5)
            if v >= 0.5:
                if negative_streak == 0:
                    positive_streak += 1
                else:
                    break
            else:
                if positive_streak == 0:
                    negative_streak += 1
                else:
                    break
        
        return {
            'positive_valence_days': positive_streak if current_valence >= 0.5 else 0,
            'negative_valence_days': negative_streak if current_valence < 0.5 else 0,
        }
    
    def get_last_marks(self, history: List[Dict]) -> Dict:
        """
        Find timestamps of last positive, negative, and risk events
        
        Args:
            history: Past reflections
        
        Returns:
            {last_positive_at, last_negative_at, last_risk_at}
        """
        last_positive = None
        last_negative = None
        last_risk = None
        
        for item in reversed(history[-30:]):
            if item.get('valence', 0.5) >= 0.5 and not last_positive:
                last_positive = item.get('timestamp')
            if item.get('valence', 0.5) < 0.5 and not last_negative:
                last_negative = item.get('timestamp')
            if item.get('warnings') and not last_risk:
                last_risk = item.get('timestamp')
        
        return {
            'last_positive_at': last_positive,
            'last_negative_at': last_negative,
            'last_risk_at': last_risk,
        }


class CircadianAnalyzer:
    """Analyze time-of-day patterns"""
    
    def __init__(self, timezone: str = 'Asia/Kolkata'):
        self.tz = pytz.timezone(timezone)
    
    def analyze(self, timestamp: str) -> Dict:
        """
        Compute circadian info
        
        Args:
            timestamp: ISO 8601 timestamp
        
        Returns:
            {hour_local, phase, sleep_adjacent}
        """
        dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        local_dt = dt.astimezone(self.tz)
        
        hour = local_dt.hour + local_dt.minute / 60.0
        
        # Determine phase
        if 5 <= hour < 12:
            phase = 'morning'
        elif 12 <= hour < 17:
            phase = 'afternoon'
        elif 17 <= hour < 21:
            phase = 'evening'
        else:
            phase = 'night'
        
        # Sleep adjacent: 11pm-6am or 12pm-2pm (nap)
        sleep_adjacent = (23 <= hour or hour < 6) or (12 <= hour < 14)
        
        return {
            'hour_local': round(hour, 1),
            'phase': phase,
            'sleep_adjacent': sleep_adjacent,
        }


class WillingnessAnalyzer:
    """Compute willingness-to-express from linguistic cues"""
    
    # Lexical patterns
    HEDGES = r'\b(maybe|perhaps|kind of|sort of|somewhat|possibly|probably|might|could be)\b'
    INTENSIFIERS = r'\b(very|extremely|really|so|totally|absolutely|completely|utterly)\b'
    NEGATIONS = r'\b(not|no|never|nothing|none|nowhere|neither)\b'
    SELF_REFS = r'\b(I|me|my|mine|myself)\b'
    TABOO = r'\b(hate|angry|furious|depressed|anxious|scared|terrified)\b'
    
    def extract_cues(self, text: str) -> Dict:
        """
        Extract linguistic cues from text
        
        Args:
            text: Normalized text
        
        Returns:
            {hedges, intensifiers, negations, self_reference, taboo_terms}
        """
        text_lower = text.lower()
        
        hedges = re.findall(self.HEDGES, text_lower)
        intensifiers = re.findall(self.INTENSIFIERS, text_lower)
        negations = re.findall(self.NEGATIONS, text_lower)
        self_refs = re.findall(self.SELF_REFS, text_lower)
        taboo_terms = re.findall(self.TABOO, text_lower)
        
        return {
            'hedges': list(set(hedges)),
            'intensifiers': list(set(intensifiers)),
            'negations': list(set(negations)),
            'self_reference': list(set(self_refs)),
            'taboo_terms': list(set(taboo_terms)),
        }
    
    def compute_willingness(
        self, 
        invoked: str, 
        expressed: str, 
        cues: Dict,
        valence_invoked: float,
        valence_expressed: float
    ) -> Dict:
        """
        Compute willingness-to-express and decomposition
        
        Args:
            invoked: Felt emotion label
            expressed: Expressed emotion label
            cues: Linguistic cues dict
            valence_invoked: Invoked valence (from comparator or LLM)
            valence_expressed: Expressed valence
        
        Returns:
            {willingness_to_express, inhibition, amplification, dissociation, social_desirability}
        """
        # Gap between felt and expressed
        emotion_gap = abs(valence_invoked - valence_expressed)
        
        # Hedge count
        hedge_score = min(len(cues.get('hedges', [])) / 3.0, 1.0)
        
        # Negation count
        negation_score = min(len(cues.get('negations', [])) / 3.0, 1.0)
        
        # Self-reference (high = more direct expression)
        self_ref_score = min(len(cues.get('self_reference', [])) / 5.0, 1.0)
        
        # Intensifiers (amplification)
        intensifier_score = min(len(cues.get('intensifiers', [])) / 3.0, 1.0)
        
        # Taboo terms (willingness to express negative)
        taboo_score = min(len(cues.get('taboo_terms', [])) / 2.0, 1.0)
        
        # Inhibition: hedging + negation - self_ref
        inhibition = (hedge_score + negation_score) / 2.0
        inhibition = max(0, min(1, inhibition - self_ref_score * 0.5))
        
        # Amplification: intensifiers
        amplification = intensifier_score
        
        # Dissociation: large gap between invoked/expressed
        dissociation = emotion_gap
        
        # Social desirability: low taboo + high hedge
        social_desirability = (1 - taboo_score) * hedge_score
        
        # Overall willingness: self-ref + taboo - inhibition
        willingness = self_ref_score * 0.4 + taboo_score * 0.3 + (1 - inhibition) * 0.3
        willingness = max(0, min(1, willingness))
        
        # COHERENCE RULE: If amplification > 0.5, then willingness >= 0.5 (±0.2 tolerance)
        # Amplification signals strong expression, so willingness should be high
        if amplification > 0.5 and willingness < 0.3:
            # Adjust willingness upward to maintain coherence
            willingness = max(willingness, 0.5)
        elif amplification > 0.6 and willingness < 0.4:
            willingness = max(willingness, 0.55)
        
        return {
            'willingness_to_express': round(willingness, 2),
            'inhibition': round(inhibition, 2),
            'amplification': round(amplification, 2),
            'dissociation': round(dissociation, 2),
            'social_desirability': round(social_desirability, 2),
        }


class LatentStateTracker:
    """Track latent emotional state using simple EMA"""
    
    def __init__(self, alpha: float = 0.3):
        self.alpha = alpha  # Learning rate
    
    def update_state(
        self, 
        current_valence: float, 
        current_arousal: float,
        history: List[Dict],
        current_energy: float = 0.5,
        current_fatigue: float = 0.5
    ) -> Dict:
        """
        Update latent state with new observation
        
        Args:
            current_valence: Current valence
            current_arousal: Current arousal
            history: Past reflections
            current_energy: Estimated energy (derived from arousal + valence)
            current_fatigue: Estimated fatigue (inverse of energy)
        
        Returns:
            {valence_mu, arousal_mu, energy_mu, fatigue_mu, sigma, confidence}
        """
        if not history:
            return {
                'valence_mu': current_valence,
                'arousal_mu': current_arousal,
                'energy_mu': current_energy,
                'fatigue_mu': current_fatigue,
                'sigma': 0.3,
                'confidence': 0.5,
            }
        
        # Get last state
        last_item = history[-1] if history else {}
        last_state = last_item.get('state', {})
        
        prev_valence_mu = last_state.get('valence_mu', 0.5)
        prev_arousal_mu = last_state.get('arousal_mu', 0.5)
        prev_energy_mu = last_state.get('energy_mu', 0.5)
        prev_fatigue_mu = last_state.get('fatigue_mu', 0.5)
        
        # EMA update
        valence_mu = self.alpha * current_valence + (1 - self.alpha) * prev_valence_mu
        arousal_mu = self.alpha * current_arousal + (1 - self.alpha) * prev_arousal_mu
        energy_mu = self.alpha * current_energy + (1 - self.alpha) * prev_energy_mu
        fatigue_mu = self.alpha * current_fatigue + (1 - self.alpha) * prev_fatigue_mu
        
        # Compute variance (simplified)
        recent_valences = [item.get('valence', 0.5) for item in history[-10:]]
        recent_valences.append(current_valence)
        sigma = float(np.std(recent_valences))
        
        # Confidence: higher when sigma is low and history is rich
        confidence = min(len(history) / 30.0, 1.0) * (1 - sigma)
        
        return {
            'valence_mu': round(valence_mu, 2),
            'arousal_mu': round(arousal_mu, 2),
            'energy_mu': round(energy_mu, 2),
            'fatigue_mu': round(fatigue_mu, 2),
            'sigma': round(sigma, 2),
            'confidence': round(confidence, 2),
        }


class QualityAnalyzer:
    """Assess input quality"""
    
    def analyze(self, text: str, confidence: float) -> Dict:
        """
        Compute input quality metrics
        
        Args:
            text: Normalized text
            confidence: LLM confidence score
        
        Returns:
            {text_len, uncertainty}
        """
        text_len = len(text)
        uncertainty = 1 - confidence
        
        return {
            'text_len': text_len,
            'uncertainty': round(uncertainty, 2),
        }


class RiskSignalDetector:
    """Detect weak risk signals from patterns INCLUDING early warning for suicidal ideation and health hazards"""
    
    def __init__(
        self, 
        anergy_threshold: int = 3, 
        irritation_threshold: int = 3,
        window_days: int = 5
    ):
        self.anergy_threshold = anergy_threshold
        self.irritation_threshold = irritation_threshold
        self.window_days = window_days
        
        # Critical keywords for mental health risks
        self.SUICIDE_KEYWORDS = [
            'suicide', 'suicidal', 'kill myself', 'end it all', 'no reason to live',
            'better off dead', 'want to die', 'ending my life', 'not worth living',
            'no point in living', 'dont want to be here', "don't want to be here"
        ]
        
        self.SELF_HARM_KEYWORDS = [
            'self harm', 'self-harm', 'cut myself', 'hurt myself', 'harm myself',
            'cutting', 'burning myself'
        ]
        
        self.HEALTH_CRISIS_KEYWORDS = [
            'chest pain', 'cant breathe', "can't breathe", 'difficulty breathing',
            'severe pain', 'extreme pain', 'unbearable pain', 'heart racing',
            'dizzy', 'faint', 'fainting', 'collapsed', 'emergency', 'urgent care',
            'hospital', 'ambulance', 'overdose', 'poisoning'
        ]
        
        self.HOPELESSNESS_KEYWORDS = [
            'hopeless', 'no hope', 'pointless', 'meaningless', 'worthless',
            'no future', 'nothing matters', 'give up', 'giving up', 'cant go on',
            "can't go on", 'no way out', 'trapped', 'stuck forever'
        ]
        
        self.ISOLATION_KEYWORDS = [
            'nobody cares', 'alone', 'lonely', 'isolated', 'no one understands',
            'all alone', 'abandoned', 'nobody would notice', 'burden to everyone',
            'better without me'
        ]
    
    def detect(self, history: List[Dict], current_events: List[str], normalized_text: str = '') -> List[str]:
        """
        Detect weak risk signals INCLUDING critical mental health and physical health risks
        
        Args:
            history: Past reflections
            current_events: Current event labels
            normalized_text: The actual reflection text for keyword matching
        
        Returns:
            List of risk signal strings (e.g., ["anergy_trend", "CRITICAL_SUICIDE_RISK"])
        """
        signals = []
        text_lower = normalized_text.lower()
        
        # ========== CRITICAL RISK DETECTION (IMMEDIATE) ==========
        
        # Check for suicidal ideation
        if any(keyword in text_lower for keyword in self.SUICIDE_KEYWORDS):
            signals.append('CRITICAL_SUICIDE_RISK')
        
        # Check for self-harm
        if any(keyword in text_lower for keyword in self.SELF_HARM_KEYWORDS):
            signals.append('CRITICAL_SELF_HARM_RISK')
        
        # Check for health crisis
        if any(keyword in text_lower for keyword in self.HEALTH_CRISIS_KEYWORDS):
            signals.append('CRITICAL_HEALTH_EMERGENCY')
        
        # ========== ELEVATED RISK DETECTION (WARNING SIGNS) ==========
        
        # Severe hopelessness
        hopelessness_count = sum(1 for keyword in self.HOPELESSNESS_KEYWORDS if keyword in text_lower)
        if hopelessness_count >= 2:
            signals.append('ELEVATED_HOPELESSNESS')
        
        # Social isolation combined with negative affect
        isolation_count = sum(1 for keyword in self.ISOLATION_KEYWORDS if keyword in text_lower)
        if isolation_count >= 2:
            signals.append('ELEVATED_ISOLATION')
        
        # ========== TREND-BASED RISK DETECTION (PATTERNS) ==========
        
        # Get recent history (last N days)
        recent = history[-self.window_days:] + [{'events': current_events}]
        
        # Count occurrences
        fatigue_count = sum(1 for item in recent if 'fatigue' in item.get('events', []))
        irritation_count = sum(1 for item in recent if 'irritation' in item.get('events', []))
        low_progress_count = sum(1 for item in recent if 'low_progress' in item.get('events', []))
        
        # Anergy trend: fatigue + low_progress for multiple days
        if fatigue_count >= self.anergy_threshold or low_progress_count >= self.anergy_threshold:
            signals.append('anergy_trend')
        
        # Persistent irritation
        if irritation_count >= self.irritation_threshold:
            signals.append('persistent_irritation')
        
        # Declining valence trend (sustained negative mood)
        if len(recent) >= 3:
            recent_valences = [item.get('valence', 0.5) for item in recent[-3:]]
            if all(recent_valences[i] > recent_valences[i+1] for i in range(len(recent_valences)-1)):
                signals.append('declining_valence_trend')
        
        # Severe prolonged low valence (depression indicator)
        if len(recent) >= 5:
            recent_valences = [item.get('valence', 0.5) for item in recent[-5:]]
            if all(v < 0.3 for v in recent_valences):
                signals.append('ELEVATED_PROLONGED_LOW_MOOD')
        
        # Emotional volatility (rapid swings)
        if len(history) >= 3:
            last_3_valences = [item.get('valence', 0.5) for item in history[-3:]]
            valence_std = np.std(last_3_valences)
            if valence_std > 0.3:  # High volatility
                signals.append('emotional_volatility')
        
        return signals
