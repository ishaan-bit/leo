"""
Polarity Backend Abstraction

Provides pluggable sentiment analysis backends for computing text polarity.
Supports multiple implementations (VADER, TextBlob) with unified interface.

Default: VADER (faster, no additional dependencies)
Optional: TextBlob (alternative implementation)
"""

from abc import ABC, abstractmethod
from typing import Dict, Optional
import re


class PolarityBackend(ABC):
    """
    Abstract base class for polarity computation backends.
    
    All backends must implement compute_polarity() returning a score in [-1, 1].
    """
    
    @abstractmethod
    def compute_polarity(self, text: str) -> float:
        """
        Compute polarity score for text.
        
        Args:
            text: Input text
            
        Returns:
            Polarity score in [-1, 1]
            -1.0 = very negative
             0.0 = neutral
            +1.0 = very positive
        """
        pass
    
    @abstractmethod
    def get_backend_info(self) -> Dict[str, str]:
        """
        Get backend metadata.
        
        Returns:
            Dict with 'name', 'version', 'library' keys
        """
        pass


class VADERBackend(PolarityBackend):
    """
    VADER (Valence Aware Dictionary and sEntiment Reasoner) backend.
    
    Advantages:
    - Fast, lexicon-based (no ML required)
    - Good for social media text
    - Handles emojis, slang, intensifiers
    - No external dependencies beyond vaderSentiment
    
    Default backend for production.
    """
    
    def __init__(self):
        """Initialize VADER backend"""
        try:
            from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
            self.analyzer = SentimentIntensityAnalyzer()
            self._available = True
        except ImportError:
            self.analyzer = None
            self._available = False
            print("[VADERBackend] Warning: vaderSentiment not installed. Install with: pip install vaderSentiment")
    
    def compute_polarity(self, text: str) -> float:
        """
        Compute VADER compound polarity score.
        
        Args:
            text: Input text
            
        Returns:
            Compound score in [-1, 1]
        """
        if not self._available or not self.analyzer:
            # Fallback to simple heuristic if VADER unavailable
            return self._simple_polarity_fallback(text)
        
        scores = self.analyzer.polarity_scores(text)
        return scores['compound']  # Already in [-1, 1]
    
    def get_backend_info(self) -> Dict[str, str]:
        """Get VADER backend info"""
        if self._available:
            try:
                import vaderSentiment
                version = getattr(vaderSentiment, '__version__', 'unknown')
            except:
                version = 'unknown'
        else:
            version = 'not installed'
        
        return {
            'name': 'VADER',
            'library': 'vaderSentiment',
            'version': version,
            'available': str(self._available)
        }
    
    def _simple_polarity_fallback(self, text: str) -> float:
        """
        Simple polarity heuristic when VADER unavailable.
        Not accurate, but better than crashing.
        """
        positive_words = ['good', 'great', 'happy', 'love', 'excellent', 'wonderful', 
                         'amazing', 'best', 'fantastic', 'awesome', 'perfect']
        negative_words = ['bad', 'hate', 'terrible', 'awful', 'worst', 'horrible',
                         'sad', 'angry', 'disappointed', 'frustrated', 'upset']
        
        text_lower = text.lower()
        pos_count = sum(1 for word in positive_words if word in text_lower)
        neg_count = sum(1 for word in negative_words if word in text_lower)
        
        total = pos_count + neg_count
        if total == 0:
            return 0.0
        
        # Normalize to [-1, 1]
        polarity = (pos_count - neg_count) / total
        return max(-1.0, min(1.0, polarity))


class TextBlobBackend(PolarityBackend):
    """
    TextBlob sentiment analysis backend.
    
    Advantages:
    - Pattern-based approach
    - Good for general text
    - Simple API
    
    Disadvantages:
    - Slower than VADER
    - Additional dependencies (textblob + nltk data)
    - Less tuned for social media
    
    Optional backend for comparison/testing.
    """
    
    def __init__(self):
        """Initialize TextBlob backend"""
        try:
            from textblob import TextBlob
            self.TextBlob = TextBlob
            self._available = True
        except ImportError:
            self.TextBlob = None
            self._available = False
            print("[TextBlobBackend] Warning: textblob not installed. Install with: pip install textblob")
    
    def compute_polarity(self, text: str) -> float:
        """
        Compute TextBlob polarity score.
        
        Args:
            text: Input text
            
        Returns:
            Polarity score in [-1, 1]
        """
        if not self._available or not self.TextBlob:
            # Fallback to simple heuristic
            return self._simple_polarity_fallback(text)
        
        try:
            blob = self.TextBlob(text)
            return blob.sentiment.polarity  # Already in [-1, 1]
        except Exception as e:
            print(f"[TextBlobBackend] Error computing polarity: {e}")
            return 0.0
    
    def get_backend_info(self) -> Dict[str, str]:
        """Get TextBlob backend info"""
        if self._available:
            try:
                import textblob
                version = getattr(textblob, '__version__', 'unknown')
            except:
                version = 'unknown'
        else:
            version = 'not installed'
        
        return {
            'name': 'TextBlob',
            'library': 'textblob',
            'version': version,
            'available': str(self._available)
        }
    
    def _simple_polarity_fallback(self, text: str) -> float:
        """Simple polarity fallback (same as VADER)"""
        positive_words = ['good', 'great', 'happy', 'love', 'excellent', 'wonderful', 
                         'amazing', 'best', 'fantastic', 'awesome', 'perfect']
        negative_words = ['bad', 'hate', 'terrible', 'awful', 'worst', 'horrible',
                         'sad', 'angry', 'disappointed', 'frustrated', 'upset']
        
        text_lower = text.lower()
        pos_count = sum(1 for word in positive_words if word in text_lower)
        neg_count = sum(1 for word in negative_words if word in text_lower)
        
        total = pos_count + neg_count
        if total == 0:
            return 0.0
        
        polarity = (pos_count - neg_count) / total
        return max(-1.0, min(1.0, polarity))


# Backend factory
_backend_registry = {
    'vader': VADERBackend,
    'textblob': TextBlobBackend
}

_default_backend_instance: Optional[PolarityBackend] = None


def get_polarity_backend(backend_name: str = 'vader') -> PolarityBackend:
    """
    Get polarity backend instance by name.
    
    Args:
        backend_name: 'vader' (default) or 'textblob'
        
    Returns:
        PolarityBackend instance
        
    Raises:
        ValueError: If backend_name not recognized
    """
    backend_name_lower = backend_name.lower()
    
    if backend_name_lower not in _backend_registry:
        available = ', '.join(_backend_registry.keys())
        raise ValueError(f"Unknown polarity backend: '{backend_name}'. Available: {available}")
    
    backend_class = _backend_registry[backend_name_lower]
    return backend_class()


def set_default_backend(backend: PolarityBackend):
    """
    Set the default backend instance for all subsequent calls.
    
    Args:
        backend: PolarityBackend instance
    """
    global _default_backend_instance
    _default_backend_instance = backend


def get_default_backend() -> PolarityBackend:
    """
    Get the default backend instance.
    Creates VADER backend if none set.
    
    Returns:
        PolarityBackend instance
    """
    global _default_backend_instance
    
    if _default_backend_instance is None:
        _default_backend_instance = VADERBackend()
    
    return _default_backend_instance


def compute_polarity(text: str, backend: Optional[PolarityBackend] = None) -> float:
    """
    Convenience function to compute polarity using specified or default backend.
    
    Args:
        text: Input text
        backend: Optional specific backend to use. If None, uses default.
        
    Returns:
        Polarity score in [-1, 1]
    """
    if backend is None:
        backend = get_default_backend()
    
    return backend.compute_polarity(text)


__all__ = [
    'PolarityBackend',
    'VADERBackend',
    'TextBlobBackend',
    'get_polarity_backend',
    'set_default_backend',
    'get_default_backend',
    'compute_polarity'
]
