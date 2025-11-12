"""
Acceptance tests with regression suite.
Tests the full pipeline with real examples.
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / 'src'))

import pytest
from enrich.pipeline import enrich


# Mock HF model and embeddings for testing
def mock_hf_probs(text: str) -> dict:
    """Mock HF probabilities based on keywords."""
    text_lower = text.lower()
    
    if 'happy' in text_lower or 'great' in text_lower or 'awesome' in text_lower:
        return {'Happy': 0.6, 'Strong': 0.15, 'Peaceful': 0.1, 'Sad': 0.07, 'Angry': 0.05, 'Fearful': 0.03}
    elif 'angry' in text_lower or 'furious' in text_lower or 'annoyed' in text_lower:
        return {'Angry': 0.55, 'Fearful': 0.2, 'Sad': 0.1, 'Happy': 0.08, 'Strong': 0.05, 'Peaceful': 0.02}
    elif 'afraid' in text_lower or 'scared' in text_lower or 'anxious' in text_lower or 'terrified' in text_lower:
        return {'Fearful': 0.6, 'Sad': 0.2, 'Angry': 0.1, 'Happy': 0.05, 'Strong': 0.03, 'Peaceful': 0.02}
    elif 'sad' in text_lower or 'depressed' in text_lower or 'down' in text_lower:
        return {'Sad': 0.6, 'Fearful': 0.2, 'Angry': 0.1, 'Happy': 0.05, 'Peaceful': 0.03, 'Strong': 0.02}
    elif 'strong' in text_lower or 'confident' in text_lower or 'proud' in text_lower or 'powerful' in text_lower:
        return {'Strong': 0.6, 'Happy': 0.2, 'Peaceful': 0.1, 'Fearful': 0.05, 'Sad': 0.03, 'Angry': 0.02}
    else:
        return {'Happy': 0.3, 'Strong': 0.2, 'Peaceful': 0.2, 'Sad': 0.15, 'Angry': 0.1, 'Fearful': 0.05}


def mock_embeddings(text: str) -> dict:
    """Mock embedding similarities."""
    return {
        'Joyful': 0.75, 'Overwhelmed': 0.65, 'Proud': 0.7, 'Relieved': 0.6,
        'Frustrated': 0.55, 'Anxious': 0.5
    }


class TestNegationAcceptance:
    """Negation handling acceptance tests."""
    
    def test_not_happy_delay(self):
        """I'm not happy about the delay → should NOT be Happy."""
        text = "I'm not happy about the delay"
        
        p_hf = mock_hf_probs(text)
        sim = mock_embeddings(text)
        
        result = enrich(text, p_hf, sim)
        
        assert result['primary'] != 'Happy', f"Should not be Happy, got {result['primary']}"
        assert result['primary'] in ['Sad', 'Peaceful', 'Fearful'], "Should be negative emotion"
        assert result['flags']['negation'] == True
        assert result['event_valence'] < 0.5, "Event valence should be negative (delay)"
    
    def test_not_angry_anymore(self):
        """I'm not angry anymore → should be Peaceful or Happy."""
        text = "I'm not angry anymore, things are better"
        
        p_hf = mock_hf_probs(text)
        sim = mock_embeddings(text)
        
        result = enrich(text, p_hf, sim)
        
        assert result['primary'] in ['Peaceful', 'Happy'], f"Should be Peaceful/Happy, got {result['primary']}"
        assert result['flags']['negation'] == True


class TestSarcasmAcceptance:
    """Sarcasm handling acceptance tests."""
    
    def test_great_another_deadline(self):
        """Great, another deadline → negative sarcasm."""
        text = "Great, another deadline approaching"
        
        p_hf = mock_hf_probs(text)
        sim = mock_embeddings(text)
        
        result = enrich(text, p_hf, sim)
        
        assert result['flags']['sarcasm'] == True
        assert result['event_valence'] < 0.5, "Event valence should decrease due to sarcasm"
        # Context should correct toward negative emotions
        assert result['primary'] in ['Sad', 'Angry', 'Fearful'], f"Should detect negative emotion despite 'great', got {result['primary']}"
    
    def test_yeah_right_finish_on_time(self):
        """Yeah right, finish on time → sarcasm with discourse marker."""
        text = "Yeah right, I'll finish this on time"
        
        p_hf = mock_hf_probs(text)
        sim = mock_embeddings(text)
        
        result = enrich(text, p_hf, sim)
        
        assert result['flags']['sarcasm'] == True
        assert result['polarity'] == 'planned'  # Future tense
        assert result['domain']['primary'] in ['work', 'study']


class TestProfanityAcceptance:
    """Profanity sentiment acceptance tests."""
    
    def test_fuck_yeah_positive(self):
        """Fuck yeah, I aced it → positive hype."""
        text = "Fuck yeah, I aced the exam"
        
        p_hf = {'Happy': 0.5, 'Strong': 0.25, 'Peaceful': 0.1, 'Sad': 0.08, 'Angry': 0.05, 'Fearful': 0.02}
        sim = mock_embeddings(text)
        
        result = enrich(text, p_hf, sim)
        
        assert result['flags']['profanity'] == 'positive'
        assert result['arousal'] > 0.55, "Arousal should be boosted"
        assert result['primary'] in ['Happy', 'Strong']
        assert result['event_valence'] > 0.6, "Aced = positive event"
    
    def test_fuck_this_traffic(self):
        """Fuck this traffic → negative frustration."""
        text = "Fuck this traffic, gonna be late"
        
        p_hf = {'Angry': 0.5, 'Fearful': 0.25, 'Sad': 0.1, 'Happy': 0.08, 'Strong': 0.05, 'Peaceful': 0.02}
        sim = mock_embeddings(text)
        
        result = enrich(text, p_hf, sim)
        
        assert result['flags']['profanity'] == 'negative'
        assert result['arousal'] > 0.6, "Arousal should be boosted"
        assert result['primary'] in ['Angry', 'Fearful']
        assert result['control'] == 'low', "Traffic = low control"


class TestControlAcceptance:
    """Control detection acceptance tests."""
    
    def test_got_told_stay_late(self):
        """Got told to stay late → low control."""
        text = "Got told by boss to stay late for the meeting"
        
        p_hf = mock_hf_probs(text)
        sim = mock_embeddings(text)
        
        result = enrich(text, p_hf, sim)
        
        assert result['control'] == 'low', f"Should be low control, got {result['control']}"
        assert result['domain']['primary'] == 'work'
        assert result['primary'] in ['Fearful', 'Angry', 'Sad']
    
    def test_decided_to_quit(self):
        """I decided to quit → high control."""
        text = "I decided to quit my job and start my own business"
        
        p_hf = {'Strong': 0.6, 'Happy': 0.2, 'Fearful': 0.1, 'Peaceful': 0.05, 'Sad': 0.03, 'Angry': 0.02}
        sim = mock_embeddings(text)
        
        result = enrich(text, p_hf, sim)
        
        assert result['control'] == 'high', f"Should be high control, got {result['control']}"
        assert result['primary'] in ['Strong', 'Happy', 'Fearful']  # Could be confident or anxious
        assert result['domain']['primary'] == 'work'


class TestPolarityAcceptance:
    """Polarity detection acceptance tests."""
    
    def test_working_on_deck(self):
        """I'm working on the deck → happened (present progressive)."""
        text = "I'm working on the presentation deck"
        
        p_hf = mock_hf_probs(text)
        sim = mock_embeddings(text)
        
        result = enrich(text, p_hf, sim)
        
        assert result['polarity'] == 'happened', f"Should be 'happened', got {result['polarity']}"
        assert result['domain']['primary'] in ['work', 'study']
    
    def test_if_i_had_studied(self):
        """If I had studied → did_not_happen (counterfactual)."""
        text = "If I had studied harder for the exam"
        
        p_hf = mock_hf_probs(text)
        sim = mock_embeddings(text)
        
        result = enrich(text, p_hf, sim)
        
        assert result['polarity'] == 'did_not_happen', f"Should be 'did_not_happen', got {result['polarity']}"
        assert result['domain']['primary'] == 'study'
        assert result['primary'] in ['Sad', 'Fearful', 'Angry']  # Regret


class TestEventValenceAcceptance:
    """Event valence vs emotion valence split."""
    
    def test_promoted_but_terrified(self):
        """Got promoted but terrified → EV high, emotion low."""
        text = "Got promoted to manager but I'm terrified I can't handle the responsibility"
        
        p_hf = {'Fearful': 0.55, 'Strong': 0.2, 'Sad': 0.1, 'Happy': 0.08, 'Angry': 0.05, 'Peaceful': 0.02}
        sim = mock_embeddings(text)
        
        result = enrich(text, p_hf, sim)
        
        assert result['event_valence'] > 0.6, f"Event valence should be high (promotion), got {result['event_valence']}"
        assert result['primary'] == 'Fearful', f"Emotion should be Fearful, got {result['primary']}"
        assert result['valence'] < 0.5, "Emotion valence should be low (fear)"
        assert result['domain']['primary'] == 'work'
        assert result['control'] in ['medium', 'high']  # Promotion = some achievement
    
    def test_failed_but_relieved(self):
        """Failed exam but relieved it's over → EV low, emotion neutral."""
        text = "Failed the exam but honestly just relieved it's finally over"
        
        p_hf = {'Sad': 0.4, 'Peaceful': 0.25, 'Happy': 0.15, 'Fearful': 0.1, 'Strong': 0.05, 'Angry': 0.05}
        sim = mock_embeddings(text)
        
        result = enrich(text, p_hf, sim)
        
        assert result['event_valence'] < 0.4, f"Event valence should be low (failed), got {result['event_valence']}"
        assert result['primary'] in ['Peaceful', 'Sad', 'Happy']  # Relieved despite failure
        assert result['domain']['primary'] == 'study'


class TestMultiDomainAcceptance:
    """Multi-domain handling."""
    
    def test_family_work_conflict(self):
        """Family wedding clashing with work deadline → multi-domain."""
        text = "My sister's wedding is the same day as my project deadline at work"
        
        p_hf = mock_hf_probs(text)
        sim = mock_embeddings(text)
        
        result = enrich(text, p_hf, sim)
        
        domain_meta = result['domain']
        assert domain_meta['primary'] in ['family', 'work']
        assert domain_meta['secondary'] in ['family', 'work']
        assert domain_meta['secondary'] is not None, "Should detect both domains"
        assert 0.5 < domain_meta['mixture_ratio'] < 1.0


class TestConfidenceAcceptance:
    """Confidence scoring."""
    
    def test_uncertain_flag_low_confidence(self):
        """Conflicting signals → low confidence."""
        text = "Something happened today and I feel things"
        
        p_hf = {'Happy': 0.25, 'Sad': 0.22, 'Angry': 0.18, 'Fearful': 0.15, 'Strong': 0.12, 'Peaceful': 0.08}
        sim = {'Generic': 0.3, 'Confused': 0.25}
        
        result = enrich(text, p_hf, sim)
        
        assert result['confidence'] < 0.6, "Confidence should be low for vague text"
        assert result['confidence_category'] in ['low', 'uncertain']
    
    def test_high_confidence_clear_signals(self):
        """Clear signals → high confidence."""
        text = "Boss yelled at me about missing the deadline, feeling overwhelmed and anxious"
        
        p_hf = {'Fearful': 0.7, 'Angry': 0.15, 'Sad': 0.1, 'Happy': 0.03, 'Strong': 0.01, 'Peaceful': 0.01}
        sim = {'Overwhelmed': 0.85, 'Anxious': 0.82}
        
        result = enrich(text, p_hf, sim)
        
        assert result['confidence'] > 0.65, f"Confidence should be high, got {result['confidence']}"
        assert result['confidence_category'] in ['medium', 'high']
        assert result['primary'] in ['Fearful', 'Angry']
        assert result['control'] == 'low'
        assert result['domain']['primary'] == 'work'


class TestRegressionSuite:
    """Regression tests from prior examples."""
    
    def test_haywire_before_presentation(self):
        """Mind went haywire before presentation → Fearful/Anxious, not Strong."""
        text = "My mind went haywire right before the presentation"
        
        p_hf = {'Strong': 0.4, 'Fearful': 0.3, 'Angry': 0.15, 'Sad': 0.08, 'Happy': 0.05, 'Peaceful': 0.02}
        sim = {'Overwhelmed': 0.8, 'Anxious': 0.75}
        
        result = enrich(text, p_hf, sim)
        
        # Context should override HF model's Strong preference
        assert result['primary'] in ['Fearful', 'Angry'], f"Should be Fearful/Angry, got {result['primary']}"
        assert result['domain']['primary'] == 'work'
        assert result['control'] == 'low'
        assert result['event_valence'] < 0.5
    
    def test_cant_believe_finished(self):
        """I can't believe I finished → Strong/Proud, relief."""
        text = "I can't believe I still managed to finish this project on time"
        
        p_hf = {'Strong': 0.5, 'Happy': 0.25, 'Fearful': 0.1, 'Sad': 0.08, 'Peaceful': 0.05, 'Angry': 0.02}
        sim = {'Proud': 0.85, 'Relieved': 0.8}
        
        result = enrich(text, p_hf, sim)
        
        assert result['primary'] in ['Strong', 'Happy']
        assert result['event_valence'] > 0.6, "Finishing on time = positive event"
        assert result['control'] == 'high', "Managed to finish = high control"
        assert result['polarity'] == 'happened'
    
    def test_submitted_on_time(self):
        """Finally submitted on time → Happy/Relieved."""
        text = "Finally submitted the assignment on time, such a relief"
        
        p_hf = {'Happy': 0.6, 'Peaceful': 0.2, 'Strong': 0.1, 'Sad': 0.05, 'Fearful': 0.03, 'Angry': 0.02}
        sim = {'Relieved': 0.9, 'Joyful': 0.7}
        
        result = enrich(text, p_hf, sim)
        
        assert result['primary'] in ['Happy', 'Peaceful']
        assert result['event_valence'] > 0.6
        assert result['polarity'] == 'happened'
        assert result['domain']['primary'] in ['study', 'work']


def print_detailed_result(text: str, result: dict):
    """Helper to print detailed enrichment results."""
    print(f"\n{'='*80}")
    print(f"TEXT: {text}")
    print(f"{'='*80}")
    print(f"Primary: {result['primary']}")
    print(f"Secondary: {result['secondary']}")
    print(f"Valence: {result['valence']:.3f} | Arousal: {result['arousal']:.3f} | Event Valence: {result['event_valence']:.3f}")
    print(f"Domain: {result['domain']['primary']}" + (f" + {result['domain']['secondary']} ({result['domain']['mixture_ratio']:.2f})" if result['domain']['secondary'] else ""))
    print(f"Control: {result['control']} | Polarity: {result['polarity']}")
    print(f"Confidence: {result['confidence']:.3f} ({result['confidence_category']})")
    print(f"Flags: Negation={result['flags']['negation']}, Sarcasm={result['flags']['sarcasm']}, Profanity={result['flags']['profanity']}")
    print(f"Rerank Scores: {result['scores']['rerank']}")
    print(f"{'='*80}\n")


if __name__ == '__main__':
    # Run tests with verbose output
    pytest.main([__file__, '-v', '-s'])
