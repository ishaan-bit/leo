"""
Baseline Enricher (Rules-Based)
No LLM calls - pure lexicon + heuristics
"""

import re
from typing import Dict, List, Tuple
import math


class BaselineEnricher:
    """Rules-based enrichment using lexicons and heuristics"""
    
    def __init__(self, config: Dict = None):
        """
        Initialize with tunable hyperparameters
        
        Args:
            config: Dict with weights, thresholds, etc.
        """
        self.config = config or self.get_default_config()
        
        # Emotion lexicons (word -> (valence_delta, arousal_delta, events))
        self.lexicon = self.build_lexicon()
        
        # Plutchik wheel mapping
        self.wheel_map = self.build_wheel_map()
    
    @staticmethod
    def get_default_config() -> Dict:
        """Default hyperparameters"""
        return {
            # Lexicon weights
            'fatigue_weight': 1.0,
            'irritation_weight': 1.2,
            'progress_weight': 0.9,
            'joy_weight': 1.1,
            'anxiety_weight': 1.3,
            
            # Hedge/intensifier multipliers
            'hedge_penalty': 0.15,
            'intensifier_boost': 0.20,
            'negation_flip': 0.40,
            
            # Event detection thresholds
            'fatigue_threshold': 0.25,
            'irritation_threshold': 0.30,
            'anxiety_threshold': 0.35,
            'joy_threshold': 0.60,
            
            # Baseline valence/arousal
            'baseline_valence': 0.50,
            'baseline_arousal': 0.50,
            
            # Clamp ranges
            'min_valence': 0.05,
            'max_valence': 0.95,
            'min_arousal': 0.05,
            'max_arousal': 0.95,
        }
    
    def build_lexicon(self) -> Dict:
        """Build emotion word lexicon with valence/arousal/events"""
        return {
            # Fatigue
            'tired': (-0.25, -0.10, ['fatigue']),
            'exhausted': (-0.30, -0.15, ['fatigue']),
            'drained': (-0.28, -0.12, ['fatigue']),
            'weary': (-0.25, -0.10, ['fatigue']),
            'fatigued': (-0.27, -0.12, ['fatigue']),
            
            # Irritation/Anger
            'irritated': (-0.20, 0.30, ['irritation']),
            'annoyed': (-0.18, 0.25, ['irritation']),
            'frustrated': (-0.22, 0.28, ['frustration']),
            'angry': (-0.30, 0.40, ['anger']),
            'furious': (-0.35, 0.50, ['anger']),
            'resentful': (-0.25, 0.30, ['resentment']),
            'bitter': (-0.28, 0.25, ['resentment']),
            
            # Progress/Productivity
            'stuck': (-0.15, 0.15, ['low_progress']),
            'unproductive': (-0.20, 0.10, ['low_progress']),
            'progress': (0.15, 0.10, ['progress']),
            'accomplished': (0.30, 0.15, ['accomplishment']),
            'productive': (0.25, 0.12, ['accomplishment']),
            
            # Joy/Happiness
            'happy': (0.30, 0.20, ['joy']),
            'joyful': (0.35, 0.25, ['joy']),
            'content': (0.25, -0.05, ['contentment']),
            'satisfied': (0.28, 0.05, ['contentment']),
            'peaceful': (0.30, -0.15, ['contentment']),
            'grateful': (0.32, 0.10, ['gratitude']),
            'excited': (0.35, 0.40, ['excitement']),
            'enthusiastic': (0.33, 0.38, ['enthusiasm']),
            'proud': (0.30, 0.20, ['pride']),
            'ecstatic': (0.45, 0.50, ['ecstasy']),
            
            # Anxiety/Fear
            'worried': (-0.22, 0.35, ['anxiety']),
            'anxious': (-0.25, 0.40, ['anxiety']),
            'nervous': (-0.20, 0.38, ['nervousness']),
            'overwhelmed': (-0.28, 0.42, ['stress']),
            'stressed': (-0.25, 0.40, ['stress']),
            'scared': (-0.30, 0.45, ['fear']),
            'fearful': (-0.28, 0.43, ['fear']),
            'terrified': (-0.40, 0.55, ['terror']),
            'panicked': (-0.38, 0.60, ['panic']),
            
            # Sadness
            'sad': (-0.30, -0.05, ['sadness']),
            'lonely': (-0.28, -0.08, ['loneliness']),
            'melancholic': (-0.25, -0.10, ['melancholy']),
            'disappointed': (-0.22, 0.08, ['disappointment']),
            
            # Disgust
            'disgusted': (-0.28, 0.20, ['disgust']),
            'bored': (-0.15, -0.20, ['boredom']),
            'indifferent': (0.00, -0.15, ['indifference']),
            'numb': (-0.20, -0.25, ['apathy']),
            'ashamed': (-0.30, 0.15, ['shame']),
            
            # Trust
            'trusting': (0.20, 0.05, ['trust']),
            'hopeful': (0.25, 0.15, ['hope']),
            'compassionate': (0.22, 0.10, ['compassion']),
            
            # Surprise
            'surprised': (0.05, 0.35, ['surprise']),
            'confused': (-0.10, 0.25, ['confusion']),
            'conflicted': (-0.05, 0.20, ['ambivalence']),
            
            # Anticipation
            'anticipating': (0.15, 0.25, ['anticipation']),
            'inspired': (0.30, 0.30, ['inspiration']),
            
            # Other
            'calm': (0.20, -0.15, ['calm']),
            'relaxed': (0.25, -0.20, ['relaxation']),
            'energized': (0.28, 0.35, ['vitality']),
            'relieved': (0.25, -0.10, ['relief']),
            'jealous': (-0.20, 0.30, ['jealousy']),
            'serene': (0.30, -0.25, ['serenity']),
        }
    
    def build_wheel_map(self) -> Dict:
        """Map events to Plutchik primary emotions"""
        return {
            'joy': ['joy', 'happiness', 'contentment', 'satisfaction', 'gratitude', 'excitement', 'pride', 'ecstasy', 'accomplishment', 'progress'],
            'sadness': ['sadness', 'loneliness', 'melancholy', 'disappointment', 'fatigue', 'low_progress', 'frustration'],
            'anger': ['anger', 'irritation', 'frustration', 'resentment', 'annoyance', 'jealousy'],
            'fear': ['fear', 'anxiety', 'nervousness', 'stress', 'worry', 'terror', 'panic'],
            'disgust': ['disgust', 'shame', 'boredom', 'apathy', 'indifference'],
            'surprise': ['surprise', 'confusion', 'ambivalence'],
            'trust': ['trust', 'compassion', 'hope', 'calm', 'focus'],
            'anticipation': ['anticipation', 'inspiration', 'enthusiasm', 'motivation', 'optimism'],
        }
    
    def enrich(self, normalized_text: str) -> Dict:
        """
        Run baseline enrichment
        
        Args:
            normalized_text: Normalized reflection text
        
        Returns:
            Enriched dict with events, wheel, valence, arousal, etc.
        """
        text_lower = normalized_text.lower()
        
        # Initialize
        valence = self.config['baseline_valence']
        arousal = self.config['baseline_arousal']
        events_detected = set()
        word_scores = []
        
        # Detect hedges, intensifiers, negations
        hedges = self.detect_hedges(text_lower)
        intensifiers = self.detect_intensifiers(text_lower)
        negations = self.detect_negations(text_lower)
        
        # Scan lexicon
        for word, (v_delta, a_delta, events) in self.lexicon.items():
            if word in text_lower:
                # Apply weight
                weight = self.get_weight(events[0])
                
                # Apply modifiers
                if any(hedge in text_lower for hedge in hedges):
                    v_delta *= (1 - self.config['hedge_penalty'])
                    a_delta *= (1 - self.config['hedge_penalty'])
                
                if any(intensifier in text_lower for intensifier in intensifiers):
                    v_delta *= (1 + self.config['intensifier_boost'])
                    a_delta *= (1 + self.config['intensifier_boost'])
                
                # Check for negation nearby
                if self.is_negated(text_lower, word, negations):
                    v_delta *= -self.config['negation_flip']
                    a_delta *= self.config['negation_flip']
                
                # Apply weight
                v_delta *= weight
                a_delta *= weight
                
                # Update scores
                valence += v_delta
                arousal += a_delta
                events_detected.update(events)
                word_scores.append((word, v_delta, a_delta))
        
        # Clamp
        valence = max(self.config['min_valence'], min(self.config['max_valence'], valence))
        arousal = max(self.config['min_arousal'], min(self.config['max_arousal'], arousal))
        
        # Detect events from thresholds
        events_list = self.finalize_events(events_detected, valence, arousal)
        
        # Map to wheel
        wheel_primary, wheel_secondary = self.map_to_wheel(events_list)
        
        # Build invoked/expressed labels
        invoked = self.infer_invoked(events_list, valence, arousal)
        expressed = self.infer_expressed(events_list, valence, arousal)
        
        # Confidence based on word matches
        confidence = min(0.95, 0.60 + len(word_scores) * 0.05)
        
        return {
            'invoked': invoked,
            'expressed': expressed,
            'wheel': {
                'primary': wheel_primary,
                'secondary': wheel_secondary
            },
            'valence': round(valence, 2),
            'arousal': round(arousal, 2),
            'confidence': round(confidence, 2),
            'events': [{'label': e, 'confidence': round(confidence, 2)} for e in events_list],
            'warnings': [],
            'willingness_cues': {
                'hedges': hedges,
                'intensifiers': intensifiers,
                'negations': negations,
                'self_reference': self.detect_self_reference(text_lower)
            },
            '_baseline_only': True,
            '_word_scores': word_scores,
        }
    
    def get_weight(self, event: str) -> float:
        """Get weight for event type"""
        if event in ['fatigue']:
            return self.config['fatigue_weight']
        elif event in ['irritation', 'anger']:
            return self.config['irritation_weight']
        elif event in ['low_progress', 'progress']:
            return self.config['progress_weight']
        elif event in ['joy', 'happiness']:
            return self.config['joy_weight']
        elif event in ['anxiety', 'fear']:
            return self.config['anxiety_weight']
        return 1.0
    
    def detect_hedges(self, text: str) -> List[str]:
        """Detect hedge words"""
        hedges = ['maybe', 'perhaps', 'somewhat', 'kind of', 'sort of', 'a bit', 'a little', 'slightly']
        return [h for h in hedges if h in text]
    
    def detect_intensifiers(self, text: str) -> List[str]:
        """Detect intensifier words"""
        intensifiers = ['very', 'really', 'extremely', 'so', 'incredibly', 'absolutely', 'totally', 'completely']
        return [i for i in intensifiers if i in text]
    
    def detect_negations(self, text: str) -> List[str]:
        """Detect negation words"""
        negations = ["not", "no", "never", "nothing", "nobody", "neither", "n't"]
        return [n for n in negations if n in text]
    
    def detect_self_reference(self, text: str) -> List[str]:
        """Detect self-reference pronouns"""
        self_refs = ['i', 'me', 'my', 'mine', 'myself']
        return [s for s in self_refs if re.search(r'\b' + s + r'\b', text)]
    
    def is_negated(self, text: str, word: str, negations: List[str]) -> bool:
        """Check if word is preceded by negation within 3 words"""
        pattern = r'\b(' + '|'.join(re.escape(n) for n in negations) + r')\s+\w+\s+\w+\s+' + re.escape(word)
        return bool(re.search(pattern, text))
    
    def finalize_events(self, events_detected: set, valence: float, arousal: float) -> List[str]:
        """Finalize event list from detection + thresholds"""
        events = list(events_detected)
        
        # Add threshold-based events
        if valence < 0.30 and arousal < 0.40 and 'fatigue' not in events:
            if valence < self.config['fatigue_threshold']:
                events.append('fatigue')
        
        if valence < 0.40 and arousal > 0.50 and 'irritation' not in events:
            if arousal > self.config['irritation_threshold'] * 2:
                events.append('irritation')
        
        if arousal > 0.60 and valence < 0.45 and 'anxiety' not in events:
            if arousal > self.config['anxiety_threshold'] * 2:
                events.append('anxiety')
        
        # Deduplicate and limit
        events = list(set(events))[:5]
        
        return events if events else ['neutral']
    
    def map_to_wheel(self, events: List[str]) -> Tuple[str, str]:
        """Map events to Plutchik wheel (primary, secondary)"""
        wheel_counts = {emotion: 0 for emotion in self.wheel_map.keys()}
        
        for event in events:
            for emotion, event_list in self.wheel_map.items():
                if event in event_list:
                    wheel_counts[emotion] += 1
        
        # Sort by count
        sorted_emotions = sorted(wheel_counts.items(), key=lambda x: x[1], reverse=True)
        
        primary = sorted_emotions[0][0] if sorted_emotions[0][1] > 0 else 'surprise'
        
        # Always provide secondary - use second highest or default to opposite of primary
        if len(sorted_emotions) > 1 and sorted_emotions[1][1] > 0:
            secondary = sorted_emotions[1][0]
        else:
            # Default secondary opposites on Plutchik wheel
            opposites = {
                'joy': 'sadness',
                'sadness': 'joy',
                'anger': 'fear',
                'fear': 'anger',
                'trust': 'disgust',
                'disgust': 'trust',
                'surprise': 'anticipation',
                'anticipation': 'surprise'
            }
            secondary = opposites.get(primary, 'surprise')
        
        return primary, secondary
    
    def infer_invoked(self, events: List[str], valence: float, arousal: float) -> str:
        """Infer invoked (internal feeling) label"""
        if not events or events == ['neutral']:
            return 'neutral'
        
        # Combine top events
        primary_events = events[:2]
        return ' + '.join(primary_events)
    
    def infer_expressed(self, events: List[str], valence: float, arousal: float) -> str:
        """Infer expressed (outward tone) label"""
        if valence < 0.30 and arousal < 0.40:
            return 'deflated / resigned'
        elif valence < 0.35 and arousal > 0.55:
            return 'irritated / tense'
        elif valence > 0.70 and arousal > 0.60:
            return 'enthusiastic / animated'
        elif valence > 0.65 and arousal < 0.40:
            return 'calm / content'
        elif arousal > 0.70:
            return 'agitated / activated'
        elif arousal < 0.30:
            return 'subdued / quiet'
        else:
            return 'matter-of-fact'


if __name__ == '__main__':
    # Test
    enricher = BaselineEnricher()
    
    test_cases = [
        "very tired and irritated, didn't make much progress today",
        "really happy with how things went",
        "worried about tomorrow"
    ]
    
    for text in test_cases:
        result = enricher.enrich(text)
        print(f"\nText: {text}")
        print(f"Invoked: {result['invoked']}")
        print(f"Expressed: {result['expressed']}")
        print(f"Wheel: {result['wheel']['primary']} / {result['wheel']['secondary']}")
        print(f"Valence: {result['valence']}, Arousal: {result['arousal']}")
        print(f"Events: {[e['label'] for e in result['events']]}")
