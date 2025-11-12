"""
Unit tests for enrichment pipeline components.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'src'))

import pytest
from enrich import negation, sarcasm, profanity, event_valence, control, polarity, domain


class TestNegationReversal:
    """Test negation detection and emotion flipping."""
    
    def test_negation_flip_happy_to_sad(self):
        text = "I'm not happy about the delay"
        p_hf = {'Happy': 0.6, 'Sad': 0.2, 'Angry': 0.1, 'Fearful': 0.05, 'Strong': 0.03, 'Peaceful': 0.02}
        
        modified, flag = negation.apply_negation_flip(text, p_hf)
        
        assert flag == True, "Negation should be detected"
        assert modified['Sad'] > modified['Happy'], "Sad should have higher probability after negation flip"
    
    def test_no_negation(self):
        text = "I am happy about the promotion"
        p_hf = {'Happy': 0.7, 'Sad': 0.1, 'Angry': 0.1, 'Fearful': 0.05, 'Strong': 0.03, 'Peaceful': 0.02}
        
        modified, flag = negation.apply_negation_flip(text, p_hf)
        
        assert flag == False, "No negation should be detected"
        assert modified == p_hf, "Probabilities should be unchanged"
    
    def test_multiple_negations(self):
        text = "I'm not angry anymore, not at all"
        p_hf = {'Angry': 0.5, 'Peaceful': 0.2, 'Sad': 0.15, 'Happy': 0.1, 'Strong': 0.03, 'Fearful': 0.02}
        
        cues = negation.extract_negation_cues(text)
        
        assert cues['negation_count'] >= 2, "Should detect multiple negations"
        assert cues['negation_flag'] == True


class TestSarcasmDetection:
    """Test sarcasm heuristics."""
    
    def test_pattern_a_positive_negative(self):
        text = "Great, another deadline"
        
        is_sarcastic, pattern = sarcasm.detect_sarcasm(text)
        
        assert is_sarcastic == True, "Should detect sarcasm (positive word + negative context)"
        assert pattern == 'pattern_a_positive_negative'
    
    def test_pattern_c_discourse_marker(self):
        text = "Yeah right, I'll finish this on time"
        
        is_sarcastic, pattern = sarcasm.detect_sarcasm(text)
        
        assert is_sarcastic == True, "Should detect sarcasm (discourse marker)"
        assert pattern == 'pattern_c_discourse'
    
    def test_no_sarcasm(self):
        text = "I'm genuinely happy about this achievement"
        
        is_sarcastic, pattern = sarcasm.detect_sarcasm(text)
        
        assert is_sarcastic == False, "Should not detect sarcasm"
    
    def test_sarcasm_reduces_happy(self):
        text = "Perfect, another traffic jam"
        p_hf = {'Happy': 0.6, 'Sad': 0.2, 'Angry': 0.1, 'Fearful': 0.05, 'Strong': 0.03, 'Peaceful': 0.02}
        event_val = 0.7
        
        modified_probs, modified_ev, flag = sarcasm.apply_sarcasm_heuristics(text, p_hf, event_val)
        
        assert flag == True
        assert modified_probs['Happy'] < p_hf['Happy'], "Happy probability should decrease"
        assert modified_ev < event_val, "Event valence should decrease"


class TestProfanitySentiment:
    """Test profanity detection and sentiment classification."""
    
    def test_positive_hype(self):
        text = "Fuck yeah, I aced it"
        
        sentiment, phrases = profanity.detect_profanity(text)
        
        assert sentiment == 'positive', "Should detect positive hype"
        assert len(phrases) > 0
    
    def test_negative_frustration(self):
        text = "Fuck this traffic"
        
        sentiment, phrases = profanity.detect_profanity(text)
        
        assert sentiment == 'negative', "Should detect negative frustration"
        assert len(phrases) > 0
    
    def test_arousal_boost(self):
        text = "Damn right, let's go"
        base_arousal = 0.5
        
        cues = profanity.extract_profanity_cues(text)
        
        assert cues['arousal_boost'] > 0, "Should boost arousal"
        assert 0.05 <= cues['arousal_boost'] <= 0.12


class TestEventValence:
    """Test event valence calculation."""
    
    def test_positive_event(self):
        text = "Got promoted and received a bonus"
        
        ev = event_valence.compute_event_valence(text)
        
        assert ev > 0.5, "Event valence should be positive"
    
    def test_negative_event(self):
        text = "Missed the deadline and got rejected"
        
        ev = event_valence.compute_event_valence(text)
        
        assert ev < 0.5, "Event valence should be negative"
    
    def test_neutral_event(self):
        text = "I'm thinking about various options"
        
        ev = event_valence.compute_event_valence(text)
        
        assert 0.4 <= ev <= 0.6, "Event valence should be neutral"
    
    def test_negated_positive(self):
        text = "Did not get promoted"
        
        meta = event_valence.extract_event_valence_metadata(text)
        
        assert len(meta['negated_positive']) > 0, "Should detect negated positive anchor"
        assert meta['event_valence'] < 0.5, "Event valence should be negative"


class TestControlDetection:
    """Test control level detection."""
    
    def test_low_control_passive(self):
        text = "Got fired from my job, couldn't do anything"
        
        control_level, confidence = control.detect_control_rule_based(text)
        
        assert control_level == 'low', "Should detect low control"
        assert confidence > 0.5
    
    def test_high_control_volition(self):
        text = "I decided to quit and start my own thing"
        
        control_level, confidence = control.detect_control_rule_based(text)
        
        assert control_level == 'high', "Should detect high control"
        assert confidence > 0.5
    
    def test_medium_control_ongoing(self):
        text = "I'm trying to work on it"
        
        control_level, confidence = control.detect_control_rule_based(text)
        
        assert control_level == 'medium', "Should detect medium control"
    
    def test_no_cues_default_medium(self):
        text = "Something happened today"
        
        control_level, confidence = control.detect_control_rule_based(text)
        
        assert control_level == 'medium', "Should default to medium"
        assert confidence < 0.5, "Confidence should be low for default"


class TestPolarityDetection:
    """Test polarity detection."""
    
    def test_planned_future(self):
        text = "I will finish the project next week"
        
        pol, confidence = polarity.detect_polarity_rule_based(text)
        
        assert pol == 'planned', "Should detect planned event"
        assert confidence > 0.7
    
    def test_did_not_happen_explicit(self):
        text = "I missed the deadline"
        
        pol, confidence = polarity.detect_polarity_rule_based(text)
        
        assert pol == 'did_not_happen', "Should detect did_not_happen"
        assert confidence > 0.7
    
    def test_did_not_happen_counterfactual(self):
        text = "If I had studied harder"
        
        pol, confidence = polarity.detect_polarity_rule_based(text)
        
        assert pol == 'did_not_happen', "Should detect counterfactual"
        assert confidence > 0.7
    
    def test_present_progressive(self):
        text = "I'm working on the presentation"
        
        pol, confidence = polarity.detect_polarity_rule_based(text)
        
        assert pol == 'happened', "Present progressive should be 'happened'"
        assert confidence > 0.5


class TestDomainDetection:
    """Test multi-domain detection."""
    
    def test_work_domain(self):
        text = "Stressful meeting with my boss about the project deadline"
        
        primary, secondary, mixture, confidence = domain.detect_domains_rule_based(text)
        
        assert primary == 'work', "Should detect work domain"
        assert confidence > 0.6
    
    def test_multi_domain(self):
        text = "Family wedding clashing with work deadline"
        
        meta = domain.extract_domain_metadata(text)
        
        assert meta['primary'] in ['work', 'family']
        assert meta['secondary'] in ['work', 'family']
        assert meta['secondary'] is not None, "Should detect secondary domain"
        assert 0.5 < meta['mixture_ratio'] < 1.0
    
    def test_default_self(self):
        text = "Just thinking about things"
        
        primary, secondary, mixture, confidence = domain.detect_domains_rule_based(text)
        
        assert primary == 'self', "Should default to self domain"
        assert confidence < 0.5, "Confidence should be low for default"


class TestIntegration:
    """Integration tests combining multiple components."""
    
    def test_promoted_but_terrified(self):
        """Event valence positive, emotion valence negative."""
        text = "Got promoted but I'm terrified I can't keep up"
        
        # Event valence should be high
        ev = event_valence.compute_event_valence(text)
        assert ev > 0.6, "Event valence should be positive (promotion)"
        
        # Control should be medium-high (got promoted = achievement)
        control_level, _ = control.detect_control_rule_based(text)
        assert control_level in ['medium', 'high']
        
        # Domain should be work
        domain_primary, _, _, _ = domain.detect_domains_rule_based(text)
        assert domain_primary == 'work'
    
    def test_sarcasm_negation_combo(self):
        """Test sarcasm + negation together."""
        text = "Great, I'm not happy about another delay"
        
        # Sarcasm detected
        is_sarcastic, _ = sarcasm.detect_sarcasm(text)
        assert is_sarcastic == True
        
        # Negation detected
        neg_cues = negation.extract_negation_cues(text)
        assert neg_cues['negation_flag'] == True
    
    def test_profanity_with_control(self):
        """Test profanity + control interaction."""
        text = "Fuck this, got forced to work overtime"
        
        # Negative profanity
        sentiment, _ = profanity.detect_profanity(text)
        assert sentiment == 'negative'
        
        # Low control (passive voice)
        control_level, _ = control.detect_control_rule_based(text)
        assert control_level == 'low'


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
