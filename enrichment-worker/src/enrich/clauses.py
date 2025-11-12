"""
Clause Segmentation and Weighting

Implements contrast-aware text segmentation where later clauses
after contrast markers receive higher weight for emotion scoring.
"""

import re
from typing import List, Tuple
from dataclasses import dataclass


@dataclass
class Clause:
    """Represents a text clause with position and weight"""
    text: str
    position: int  # 0-indexed
    weight: float  # Default 1.0, increased to 2.0 after contrast
    has_contrast_before: bool = False
    has_feels_like: bool = False


# Clause delimiters
CLAUSE_DELIMITERS = re.compile(r'[.;:—\n]+')

# Contrast markers (used both for segmentation and weight boosting)
CONTRAST_MARKERS = re.compile(
    r'\b(but|yet|however|though|even though|although|still|'
    r'nonetheless|nevertheless|despite|in spite of)\b',
    re.IGNORECASE
)

# "Feels like" simile markers
FEELS_LIKE_MARKERS = re.compile(
    r'\b(feels? like|it\'?s like|as if|seems? like|reminds me of)\b',
    re.IGNORECASE
)


def segment_clauses(text: str) -> List[Clause]:
    """
    Segment text into clauses based on punctuation and contrast markers.
    
    Algorithm:
    1. Split on major delimiters (.;:—\n)
    2. Further split on contrast markers (but, yet, however, etc.)
    3. Preserve contrast markers in the clauses for context
    
    Args:
        text: Input text
        
    Returns:
        List of Clause objects with position metadata
    """
    if not text or not text.strip():
        return [Clause(text="", position=0, weight=1.0)]
    
    # First pass: split on major delimiters
    raw_segments = CLAUSE_DELIMITERS.split(text)
    raw_segments = [s.strip() for s in raw_segments if s.strip()]
    
    if not raw_segments:
        return [Clause(text=text.strip(), position=0, weight=1.0)]
    
    # Second pass: split on contrast markers within each segment
    clauses = []
    position = 0
    
    for segment in raw_segments:
        # Find contrast markers in this segment
        contrast_matches = list(CONTRAST_MARKERS.finditer(segment))
        
        if not contrast_matches:
            # No contrast marker, treat as single clause
            clauses.append(Clause(
                text=segment,
                position=position,
                weight=1.0,
                has_contrast_before=False
            ))
            position += 1
        else:
            # Split on contrast markers
            last_end = 0
            for i, match in enumerate(contrast_matches):
                # Text before contrast marker
                before_text = segment[last_end:match.start()].strip()
                if before_text:
                    clauses.append(Clause(
                        text=before_text,
                        position=position,
                        weight=1.0,
                        has_contrast_before=False
                    ))
                    position += 1
                
                # Text including and after contrast marker
                after_start = match.start()
                if i < len(contrast_matches) - 1:
                    # Not the last match, go up to next marker
                    after_end = contrast_matches[i + 1].start()
                else:
                    # Last match, take rest of segment
                    after_end = len(segment)
                
                after_text = segment[after_start:after_end].strip()
                if after_text:
                    clauses.append(Clause(
                        text=after_text,
                        position=position,
                        weight=1.0,  # Will be adjusted by clause_weights()
                        has_contrast_before=True
                    ))
                    position += 1
                
                last_end = after_end
    
    # Apply clause weights before returning
    clauses = clause_weights(clauses)
    return clauses


def clause_weights(clauses: List[Clause]) -> List[Clause]:
    """
    Assign weights to clauses based on structural cues.
    
    Rules:
    1. Clauses after contrast markers get 2.0× weight
    2. "Feels like" similes get 1.5× weight
    3. Default weight is 1.0
    
    Args:
        clauses: List of Clause objects
        
    Returns:
        Same list with updated weights
    """
    if not clauses:
        return clauses
    
    # Track if we've seen a contrast marker
    seen_contrast = False
    
    for clause in clauses:
        # Check for "feels like" simile
        if FEELS_LIKE_MARKERS.search(clause.text):
            clause.has_feels_like = True
            clause.weight *= 1.5
        
        # Apply contrast boost
        if clause.has_contrast_before or seen_contrast:
            clause.weight = 2.0
            seen_contrast = True
    
    # Special case: if LAST clause has contrast, boost it regardless
    # (handles "X, but Y" where Y is the emotional focus)
    if len(clauses) > 1:
        last_clause = clauses[-1]
        if last_clause.has_contrast_before and last_clause.weight < 2.0:
            last_clause.weight = 2.0
    
    return clauses


def get_weighted_text_spans(text: str) -> List[Tuple[str, float]]:
    """
    Convenience function to get text spans with weights.
    
    Returns:
        List of (text, weight) tuples
    """
    clauses = segment_clauses(text)
    clauses = clause_weights(clauses)
    return [(c.text, c.weight) for c in clauses]


def get_dominant_clause(text: str) -> str:
    """
    Get the clause with highest weight (typically the final clause after contrast).
    
    Useful for emotion extraction from contrastive statements.
    
    Returns:
        Text of the dominant clause
    """
    clauses = segment_clauses(text)
    clauses = clause_weights(clauses)
    
    if not clauses:
        return text
    
    # Return clause with max weight
    dominant = max(clauses, key=lambda c: c.weight)
    return dominant.text


def has_contrast_structure(text: str) -> bool:
    """Check if text has contrast markers"""
    return CONTRAST_MARKERS.search(text) is not None


def has_feels_like_structure(text: str) -> bool:
    """Check if text has 'feels like' simile markers"""
    return FEELS_LIKE_MARKERS.search(text) is not None


# Debugging helper
def explain_clause_weighting(text: str) -> str:
    """
    Generate human-readable explanation of clause weighting.
    
    Returns:
        Multi-line string showing each clause with its weight
    """
    clauses = segment_clauses(text)
    clauses = clause_weights(clauses)
    
    lines = ["Clause Weighting Analysis:"]
    for i, clause in enumerate(clauses):
        contrast_mark = " [CONTRAST]" if clause.has_contrast_before else ""
        feels_mark = " [FEELS_LIKE]" if clause.has_feels_like else ""
        lines.append(f"  {i+1}. [{clause.weight:.1f}×] {clause.text}{contrast_mark}{feels_mark}")
    
    return "\n".join(lines)
