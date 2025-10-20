"""
Comparator Module
Well-composed reference norms for event classes with deviation detection
"""

from typing import Dict, Optional


class EventComparator:
    """
    Compare current emotions against normative expectations for event classes
    """
    
    # Event class norms: {invoked, expressed, valence, arousal}
    EVENT_NORMS = {
        'fatigue': {
            'invoked': 'tired',
            'expressed': 'exhausted',
            'valence': 0.25,
            'arousal': 0.30,
        },
        'irritation': {
            'invoked': 'frustrated',
            'expressed': 'annoyed',
            'valence': 0.35,
            'arousal': 0.65,
        },
        'low_progress': {
            'invoked': 'mild fatigue',
            'expressed': 'matter-of-fact',
            'valence': 0.35,
            'arousal': 0.40,
        },
        'disappointment': {
            'invoked': 'let down',
            'expressed': 'resigned',
            'valence': 0.30,
            'arousal': 0.35,
        },
        'anxiety': {
            'invoked': 'worried',
            'expressed': 'tense',
            'valence': 0.30,
            'arousal': 0.75,
        },
        'contentment': {
            'invoked': 'satisfied',
            'expressed': 'calm',
            'valence': 0.70,
            'arousal': 0.35,
        },
        'excitement': {
            'invoked': 'energized',
            'expressed': 'enthusiastic',
            'valence': 0.80,
            'arousal': 0.80,
        },
        'boredom': {
            'invoked': 'unstimulated',
            'expressed': 'flat',
            'valence': 0.40,
            'arousal': 0.20,
        },
        'overwhelm': {
            'invoked': 'overloaded',
            'expressed': 'stressed',
            'valence': 0.25,
            'arousal': 0.85,
        },
        'relief': {
            'invoked': 'unburdened',
            'expressed': 'lighter',
            'valence': 0.65,
            'arousal': 0.45,
        },
        'gratitude': {
            'invoked': 'appreciative',
            'expressed': 'thankful',
            'valence': 0.75,
            'arousal': 0.50,
        },
        'loneliness': {
            'invoked': 'isolated',
            'expressed': 'withdrawn',
            'valence': 0.25,
            'arousal': 0.40,
        },
        'pride': {
            'invoked': 'accomplished',
            'expressed': 'confident',
            'valence': 0.80,
            'arousal': 0.60,
        },
        'shame': {
            'invoked': 'inadequate',
            'expressed': 'hidden',
            'valence': 0.20,
            'arousal': 0.55,
        },
        'anger': {
            'invoked': 'provoked',
            'expressed': 'aggressive',
            'valence': 0.20,
            'arousal': 0.90,
        },
        'sadness': {
            'invoked': 'loss',
            'expressed': 'tearful',
            'valence': 0.20,
            'arousal': 0.30,
        },
        'joy': {
            'invoked': 'uplifted',
            'expressed': 'smiling',
            'valence': 0.85,
            'arousal': 0.70,
        },
        'confusion': {
            'invoked': 'uncertain',
            'expressed': 'hesitant',
            'valence': 0.45,
            'arousal': 0.55,
        },
        'curiosity': {
            'invoked': 'intrigued',
            'expressed': 'engaged',
            'valence': 0.65,
            'arousal': 0.60,
        },
        'determination': {
            'invoked': 'committed',
            'expressed': 'focused',
            'valence': 0.60,
            'arousal': 0.70,
        },
    }
    
    def compare(
        self, 
        events: list[str], 
        current_valence: float, 
        current_arousal: float
    ) -> Dict:
        """
        Compare current state against expected norms
        
        Args:
            events: Event labels (e.g., ['fatigue', 'irritation'])
            current_valence: Current valence score
            current_arousal: Current arousal score
        
        Returns:
            {expected: {invoked, expressed, valence, arousal}, 
             deviation: {valence, arousal}, 
             note}
        """
        if not events:
            return {
                'expected': None,
                'deviation': None,
                'note': 'No events to compare',
            }
        
        # Use first event as primary
        primary_event = events[0]
        
        if primary_event not in self.EVENT_NORMS:
            return {
                'expected': None,
                'deviation': None,
                'note': f'No norms available for event: {primary_event}',
            }
        
        expected = self.EVENT_NORMS[primary_event]
        
        # Compute deviations
        valence_deviation = round(current_valence - expected['valence'], 2)
        arousal_deviation = round(current_arousal - expected['arousal'], 2)
        
        # Generate contextual note
        note = self._generate_note(
            primary_event, 
            valence_deviation, 
            arousal_deviation,
            events
        )
        
        return {
            'expected': {
                'invoked': expected['invoked'],
                'expressed': expected['expressed'],
                'valence': expected['valence'],
                'arousal': expected['arousal'],
            },
            'deviation': {
                'valence': valence_deviation,
                'arousal': arousal_deviation,
            },
            'note': note,
        }
    
    def _generate_note(
        self, 
        primary_event: str, 
        v_dev: float, 
        a_dev: float,
        all_events: list[str]
    ) -> str:
        """
        Generate human-readable comparison note
        
        Args:
            primary_event: Primary event label
            v_dev: Valence deviation
            a_dev: Arousal deviation
            all_events: All event labels
        
        Returns:
            Contextual note string
        """
        notes = []
        
        # Valence interpretation
        if abs(v_dev) < 0.1:
            notes.append("valence typical")
        elif v_dev < -0.15:
            notes.append("more negative than usual")
        elif v_dev > 0.15:
            notes.append("more positive than usual")
        
        # Arousal interpretation
        if abs(a_dev) < 0.1:
            notes.append("arousal typical")
        elif a_dev < -0.15:
            notes.append("calmer than expected")
        elif a_dev > 0.15:
            notes.append("more activated than expected")
        
        # Multi-event note
        if len(all_events) > 1:
            notes.append(f"mixed state ({', '.join(all_events[:3])})")
        
        # Construct note
        if not notes:
            return f"Typical response for {primary_event}."
        
        return f"{primary_event.capitalize()}: {', '.join(notes)}."
    
    def get_congruence_score(self, valence_deviation: float, arousal_deviation: float) -> float:
        """
        Compute congruence score (1.0 = perfect match, 0.0 = max deviation)
        
        Args:
            valence_deviation: Deviation in valence
            arousal_deviation: Deviation in arousal
        
        Returns:
            Congruence score [0, 1]
        """
        # Euclidean distance in 2D space
        distance = (valence_deviation**2 + arousal_deviation**2)**0.5
        
        # Max possible distance is ~1.4 (corner to corner)
        # Normalize to [0, 1], then invert
        congruence = max(0, 1 - (distance / 1.4))
        
        return round(congruence, 2)
    
    def compute_invoked_expressed_congruence(self, invoked: str, expressed: str) -> float:
        """
        Compute congruence between invoked (internal) and expressed (outward) labels
        Rule-based mapping: high congruence when they align semantically
        
        Args:
            invoked: Internal feeling label(s)
            expressed: Outward tone label(s)
        
        Returns:
            Congruence score [0, 1]
        """
        # Normalize to lowercase
        inv_lower = invoked.lower()
        exp_lower = expressed.lower()
        
        # Perfect match
        if inv_lower == exp_lower:
            return 1.0
        
        # Semantic alignment pairs (high congruence)
        alignments = {
            ('tired', 'exhausted'): 0.90,
            ('fatigue', 'exhausted'): 0.90,
            ('frustrated', 'annoyed'): 0.85,
            ('frustrated', 'irritated'): 0.85,
            ('anxiety', 'tense'): 0.90,
            ('worried', 'tense'): 0.85,
            ('sad', 'deflated'): 0.85,
            ('disappointment', 'resigned'): 0.85,
            ('content', 'calm'): 0.90,
            ('joy', 'excited'): 0.90,
        }
        
        # Check for alignment
        for (inv_key, exp_key), score in alignments.items():
            if inv_key in inv_lower and exp_key in exp_lower:
                return score
            if exp_key in inv_lower and inv_key in exp_lower:
                return score
        
        # Suppression patterns (moderate congruence - hiding feelings)
        suppressions = [
            ('frustrated', 'matter-of-fact'),
            ('anxious', 'calm'),
            ('sad', 'neutral'),
            ('irritated', 'composed'),
        ]
        
        for inv_key, exp_key in suppressions:
            if inv_key in inv_lower and exp_key in exp_lower:
                return 0.60  # Moderate suppression
        
        # Amplification patterns (moderate congruence - exaggerating)
        amplifications = [
            ('tired', 'devastated'),
            ('annoyed', 'furious'),
            ('worried', 'panicked'),
        ]
        
        for inv_key, exp_key in amplifications:
            if inv_key in inv_lower and exp_key in exp_lower:
                return 0.65  # Moderate amplification
        
        # Default: semantic overlap check
        inv_words = set(inv_lower.replace('+', ' ').replace('/', ' ').split())
        exp_words = set(exp_lower.replace('+', ' ').replace('/', ' ').split())
        
        overlap = len(inv_words & exp_words)
        total = len(inv_words | exp_words)
        
        if total == 0:
            return 0.50  # Unknown
        
        # Jaccard similarity
        jaccard = overlap / total
        
        # Map to congruence (0.5 base + 0.5 * jaccard)
        return round(0.5 + 0.5 * jaccard, 2)
