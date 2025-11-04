"""
Lexical feature extraction (Lx) for emotion perception.

Components:
- NRC Emotion Lexicon lookups
- VADER sentiment scoring
- Intensifiers/diminishers detection
- Negation handling (single, double, contrastive)
- Profanity detection
- Hinglish code-mixing features
- Length-aware feature engineering

Output: Per-item lexical features for valence, arousal, emotion categories.
"""

import re
import json
from pathlib import Path
from typing import Dict, List, Set, Tuple
from collections import Counter, defaultdict


class LexicalFeatureExtractor:
    """
    Extract rule-based lexical features from text.
    
    Features:
    - Valence/arousal from NRC/VADER
    - Intensifiers/diminishers (very, really, slightly, etc.)
    - Negations (not, never, no, etc.)
    - Profanity markers
    - Emotion keyword counts
    - Hinglish code-mixing ratio
    """
    
    def __init__(self, lexicon_dir: Path = None):
        """
        Initialize with emotion lexicons.
        
        Args:
            lexicon_dir: Path to lexicons (NRC, VADER, etc.)
        """
        self.lexicon_dir = lexicon_dir or Path(__file__).parent / "lexicons"
        
        # Core emotion keywords (simplified NRC-style)
        self.emotion_keywords = self._load_emotion_keywords()
        
        # Valence/arousal lexicon (simplified)
        self.valence_lexicon = self._load_valence_lexicon()
        self.arousal_lexicon = self._load_arousal_lexicon()
        
        # Intensifiers & diminishers
        self.intensifiers = {
            "very", "really", "so", "extremely", "incredibly", "absolutely",
            "totally", "completely", "utterly", "fucking", "damn", "super"
        }
        self.diminishers = {
            "slightly", "somewhat", "a bit", "little", "barely", "hardly",
            "kind of", "sort of", "kinda", "sorta"
        }
        
        # Negations
        self.negations = {
            "not", "no", "never", "nothing", "nobody", "nowhere", "neither",
            "nor", "none", "n't", "nahi", "nahin", "mat"  # Hinglish
        }
        
        # Profanity (EN + Hinglish)
        self.profanity = {
            # English
            "fuck", "fucking", "fucked", "shit", "damn", "hell", "ass", "asshole",
            "bitch", "bastard", "crap",
            # Hinglish
            "bakwas", "pagal", "saala", "kutte", "harami", "chutiya",
            "madarchod", "bhenchodchod", "mc", "bc"
        }
        
        # Hinglish markers (Hindi chars)
        self.hindi_chars = set("अआइईउऊएऐओऔकखगघचछजझटठडढणतथदधनपफबभमयरलवशषसह")
    
    def _load_emotion_keywords(self) -> Dict[str, Set[str]]:
        """
        Load emotion keyword mapping (simplified NRC).
        
        Returns:
            Dict mapping emotion to set of keywords
        """
        # Simplified version - in production, load from NRC lexicon
        return {
            "joy": {"happy", "joyful", "cheerful", "excited", "delighted", "pleased"},
            "sadness": {"sad", "depressed", "miserable", "unhappy", "lonely", "hurt"},
            "anger": {"angry", "mad", "furious", "frustrated", "annoyed", "irritated"},
            "fear": {"afraid", "scared", "anxious", "worried", "nervous", "terrified"},
            "trust": {"trust", "confident", "secure", "safe", "hopeful"},
            "anticipation": {"excited", "eager", "hopeful", "looking forward"},
            "surprise": {"surprised", "shocked", "amazed", "astonished"},
            "disgust": {"disgusted", "revolted", "sick", "gross"},
        }
    
    def _load_valence_lexicon(self) -> Dict[str, float]:
        """
        Load valence scores (negative → positive).
        
        Returns:
            Dict mapping word to valence score (0-1)
        """
        # Simplified - in production, use VADER/ANEW
        return {
            # Negative
            "terrible": 0.1, "awful": 0.15, "horrible": 0.1, "bad": 0.3,
            "sad": 0.25, "angry": 0.2, "afraid": 0.15, "hurt": 0.2,
            "lonely": 0.2, "depressed": 0.1, "hopeless": 0.05,
            # Neutral
            "okay": 0.5, "fine": 0.5, "alright": 0.5,
            # Positive
            "good": 0.7, "great": 0.8, "amazing": 0.9, "wonderful": 0.9,
            "happy": 0.8, "joyful": 0.85, "excited": 0.8, "love": 0.9,
        }
    
    def _load_arousal_lexicon(self) -> Dict[str, float]:
        """
        Load arousal scores (calm → activated).
        
        Returns:
            Dict mapping word to arousal score (0-1)
        """
        return {
            # Low arousal (calm)
            "calm": 0.2, "peaceful": 0.15, "relaxed": 0.2, "tired": 0.3,
            "bored": 0.25, "content": 0.3,
            # High arousal (activated)
            "excited": 0.9, "angry": 0.85, "anxious": 0.8, "terrified": 0.95,
            "frustrated": 0.75, "energetic": 0.85, "nervous": 0.8,
        }
    
    def extract(self, text: str, lang: str = "EN") -> Dict:
        """
        Extract all lexical features from text.
        
        Args:
            text: Input text (normalized)
            lang: Language (EN, HI, Hinglish)
        
        Returns:
            Dict of lexical features
        """
        tokens = text.lower().split()
        
        features = {
            # Basic counts
            "word_count": len(tokens),
            "char_len": len(text),
            "avg_word_len": len(text) / max(len(tokens), 1),
            
            # Emotion keyword counts
            **self._extract_emotion_keywords(tokens),
            
            # Valence/arousal
            **self._extract_valence_arousal(tokens),
            
            # Modifiers
            **self._extract_modifiers(tokens, text),
            
            # Negations
            **self._extract_negations(tokens),
            
            # Profanity
            "profanity_count": self._count_profanity(tokens),
            "has_profanity": self._count_profanity(tokens) > 0,
            
            # Hinglish features
            **self._extract_hinglish_features(text, lang),
            
            # Punctuation
            **self._extract_punctuation(text),
        }
        
        return features
    
    def _extract_emotion_keywords(self, tokens: List[str]) -> Dict:
        """Count emotion keywords per category."""
        counts = {}
        for emotion, keywords in self.emotion_keywords.items():
            counts[f"emo_{emotion}_count"] = sum(1 for t in tokens if t in keywords)
        return counts
    
    def _extract_valence_arousal(self, tokens: List[str]) -> Dict:
        """
        Compute valence/arousal from lexicon.
        
        Returns average scores weighted by word presence.
        """
        valence_scores = [self.valence_lexicon.get(t, 0.5) for t in tokens if t in self.valence_lexicon]
        arousal_scores = [self.arousal_lexicon.get(t, 0.5) for t in tokens if t in self.arousal_lexicon]
        
        return {
            "lex_valence": sum(valence_scores) / max(len(valence_scores), 1),
            "lex_arousal": sum(arousal_scores) / max(len(arousal_scores), 1),
            "lex_valence_count": len(valence_scores),
            "lex_arousal_count": len(arousal_scores),
        }
    
    def _extract_modifiers(self, tokens: List[str], text: str) -> Dict:
        """Extract intensifiers and diminishers."""
        intensifier_count = sum(1 for t in tokens if t in self.intensifiers)
        diminisher_count = sum(1 for t in tokens if t in self.diminishers)
        
        # Detect patterns like "very bad" (intensifier + negative)
        text_lower = text.lower()
        intensified_negative = any(
            f"{intens} {neg}" in text_lower
            for intens in self.intensifiers
            for neg in ["bad", "sad", "angry", "afraid", "hurt", "awful", "terrible"]
        )
        
        return {
            "intensifier_count": intensifier_count,
            "diminisher_count": diminisher_count,
            "has_intensified_negative": intensified_negative,
        }
    
    def _extract_negations(self, tokens: List[str]) -> Dict:
        """
        Extract negation patterns.
        
        Types:
        - Single: "not happy"
        - Double: "not unhappy" (flips to positive)
        - Contrastive: "good but exhausted"
        """
        negation_count = sum(1 for t in tokens if t in self.negations)
        
        # Detect "but" for contrastive
        has_but = "but" in tokens
        
        return {
            "negation_count": negation_count,
            "has_negation": negation_count > 0,
            "has_contrastive_but": has_but,
        }
    
    def _count_profanity(self, tokens: List[str]) -> int:
        """Count profanity words."""
        return sum(1 for t in tokens if t in self.profanity)
    
    def _extract_hinglish_features(self, text: str, lang: str) -> Dict:
        """
        Extract Hinglish code-mixing features.
        
        Returns:
            Ratio of Hindi characters, code-mixing markers
        """
        if lang not in ["Hinglish", "HI"]:
            return {
                "hinglish_ratio": 0.0,
                "has_hindi_chars": False,
            }
        
        hindi_char_count = sum(1 for c in text if c in self.hindi_chars)
        total_chars = len(text)
        
        return {
            "hinglish_ratio": hindi_char_count / max(total_chars, 1),
            "has_hindi_chars": hindi_char_count > 0,
        }
    
    def _extract_punctuation(self, text: str) -> Dict:
        """Extract punctuation features."""
        return {
            "exclamation_count": text.count("!"),
            "question_count": text.count("?"),
            "ellipsis_count": text.count("..."),
            "caps_ratio": sum(1 for c in text if c.isupper()) / max(len(text), 1),
            "emoji_count": sum(1 for c in text if ord(c) > 0x1F300),  # Rough emoji detection
        }
    
    def extract_batch(self, items: List[Dict]) -> List[Dict]:
        """
        Extract features for batch of items.
        
        Args:
            items: List of perception items with 'normalized_text' and 'lang'
        
        Returns:
            List of items with added 'lex_features' field
        """
        for item in items:
            text = item.get("normalized_text", "")
            lang = item.get("lang", "EN")
            
            item["lex_features"] = self.extract(text, lang)
        
        return items


def main():
    """Demo usage."""
    extractor = LexicalFeatureExtractor()
    
    # Test cases
    test_items = [
        {
            "rid": "test1",
            "normalized_text": "fucked up day",
            "lang": "EN"
        },
        {
            "rid": "test2",
            "normalized_text": "yaar family mein shaadi ki itni bakwas chal rahi hai",
            "lang": "Hinglish"
        },
        {
            "rid": "test3",
            "normalized_text": "not happy but not unhappy either",
            "lang": "EN"
        },
    ]
    
    results = extractor.extract_batch(test_items)
    
    print("="*70)
    print("LEXICAL FEATURE EXTRACTION — Demo")
    print("="*70)
    
    for item in results:
        print(f"\n[{item['rid']}] {item['normalized_text']}")
        print(f"  Lang: {item['lang']}")
        
        lex = item['lex_features']
        print(f"  Valence (lex): {lex['lex_valence']:.2f}")
        print(f"  Arousal (lex): {lex['lex_arousal']:.2f}")
        print(f"  Profanity: {lex['profanity_count']}")
        print(f"  Negations: {lex['negation_count']}")
        print(f"  Intensifiers: {lex['intensifier_count']}")
        if lex.get('hinglish_ratio', 0) > 0:
            print(f"  Hinglish ratio: {lex['hinglish_ratio']:.2f}")


if __name__ == "__main__":
    main()
