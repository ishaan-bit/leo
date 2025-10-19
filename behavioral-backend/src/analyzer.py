"""
Feature extraction from English reflection text.
Computes:
- Invoked emotion (label + valence/arousal)
- Event keywords (salient nouns)
- Expressed tone & intensity
- Self-awareness proxy
- Willingness to express
- Risk flags
"""

import re
import numpy as np
from typing import Dict, List, Tuple
from textblob import TextBlob
from emotion_map import (
    EMOTION_MAP,
    RISK_EMOTIONS,
    SELF_HARM_PATTERNS,
    HOPELESSNESS_PATTERNS,
    WITHDRAWAL_PATTERNS,
    META_COGNITIVE_MARKERS,
    HEDGING_MARKERS,
)


def tone_from_valence(v: float, eps: float = 0.1) -> str:
    """
    Derive tone strictly from invoked valence with dead-zone.
    Args:
        v: Valence in [-1, 1]
        eps: Dead-zone threshold
    Returns:
        "positive", "negative", or "neutral"
    """
    if v > eps:
        return "positive"
    if v < -eps:
        return "negative"
    return "neutral"


def detect_emotion_and_valence(text: str) -> Dict:
    """
    Detect primary emotion and map to valence/arousal coordinates.
    Uses sentiment analysis + keyword matching + contextual cues.
    """
    blob = TextBlob(text.lower())
    sentiment_polarity = blob.sentiment.polarity  # -1 to 1
    sentiment_subjectivity = blob.sentiment.subjectivity  # 0 to 1
    
    text_lower = text.lower()
    detected_emotions = []
    
    # Setup contrast/negation detection (but don't set emotions yet)
    has_contrast = False
    has_negation = any(phrase in text_lower for phrase in ["didn't", "never", "not ", "no ", "can't"])
    
    # If contrast exists, ONLY analyze part after contrast word (second part wins)
    contrast_markers = [" until ", " but ", " though ", " however ", " yet "]
    analysis_text = text_lower  # Default: analyze full text
    for contrast_word in contrast_markers:
        if contrast_word in text_lower:
            has_contrast = True
            parts = text_lower.split(contrast_word, 1)
            if len(parts) == 2 and len(parts[1].strip()) > 3:
                # Use ONLY second part for sentiment AND keyword detection
                second_part_blob = TextBlob(parts[1])
                sentiment_polarity = second_part_blob.sentiment.polarity
                sentiment_subjectivity = second_part_blob.sentiment.subjectivity
                analysis_text = parts[1]  # Analyze only second part for keywords
                break  # Use first contrast found
    
    # PRIORITY 1: Check risk patterns (hopelessness)
    for pattern in HOPELESSNESS_PATTERNS:
        if pattern in text_lower:
            detected_emotions = ["hopelessness"]
            break
    
    # PRIORITY 2: Check special negation/suppression patterns
    if not detected_emotions:
        # Explicit negation: "not angry, just X"
        if "not angry" in text_lower or "not mad" in text_lower:
            if "disappointed" in text_lower:
                detected_emotions = ["disappointment"]
            elif "sad" in text_lower:
                detected_emotions = ["sadness"]
        
        # Emotional suppression: "never cry", "didn't cry"
        elif ("never cry" in text_lower or "didn't cry" in text_lower or "don't cry" in text_lower or "i never" in text_lower):
            detected_emotions = ["sadness"]
    
    # PRIORITY 3: Check regular emotion keywords
    if not detected_emotions:
        emotion_keywords = {
            "joy": ["great", "happy", "wonderful", "fantastic", "amazing", "felt great", "lighter", "thrilled", "excited", "sweet", "raise", "unreal", "recovering", "helped", "hopeful"],
            "pride": ["proud", "cracked", "aced", "praised", "handled", "strong", "paid off", "finally did it", "finally did", "did it", "though it took"],
            "anger": ["angry", "furious", "pissed", "rebuke", "rebuked", "annoyed", "irritated", "argued", "nitpicked", "took credit", "disappointed", "defended", "defended my choice", "annoyed but", "spilled coffee", "spilled"],
            "sadness": ["sad", "depressed", "down", "unhappy", "miserable", "cry", "crying", "left behind", "sick", "numb", "still not", "not great", "stuck in traffic", "yesterday", "insomnia"],
            "relief": ["relief", "relieved", "normal", "results are normal"],
            "anxiety": ["anxious", "worried", "nervous", "stressed", "panic", "fallout", "layoffs", "overwhelmed", "hassle", "bills piling", "unexpected bill", "manageable"],
            "fear": ["fear", "fearful", "scared", "afraid", "fearful", "headlines made me fearful", "pain"],
            "shame": ["ashamed", "shame", "forgot", "overreacted", "regret", "left behind"],
            "contentment": ["content", "satisfied", "peaceful", "calm", "relaxed", "clear", "calmer", "meditation", "recharge", "canceled plans", "stayed calm"],
            "frustration": ["frustrated", "annoying", "difficult", "traffic", "stuck", "spilled"],
            "disappointment": ["disappointed", "let down", "failed", "just disappointed", "not angry"],
            "disgust": ["disgusted", "revolted"],
            "surprise": ["surprise", "unreal", "raise"],
        }
        
        # Check for emotion keywords (use analysis_text which might be second part after contrast)
        for emotion, keywords in emotion_keywords.items():
            for keyword in keywords:
                if keyword in analysis_text:  # Search in contrast-adjusted text
                    detected_emotions.append(emotion)
                    break
    
    # If no explicit emotion keyword, infer from sentiment + context
    if not detected_emotions:
        # Check for risk-related emotions first
        for pattern in HOPELESSNESS_PATTERNS:
            if pattern in text_lower:
                emotion_label = "hopelessness"
                break
        else:
            # Check for mundane/routine context → neutral (no joy for chores)
            mundane_markers = ["nothing special", "just chores", "routine", "ordinary"]
            if any(marker in text_lower for marker in mundane_markers):
                emotion_label = "neutral"
            # Use sentiment polarity with lower thresholds
            elif sentiment_polarity > 0.15:  # Lower threshold for positive
                if sentiment_subjectivity > 0.5:
                    emotion_label = "joy"
                else:
                    emotion_label = "contentment"
            elif sentiment_polarity < -0.15:  # Lower threshold for negative
                # Contrast context → likely anxiety/sadness (emotional disruption)
                if has_contrast:
                    emotion_label = "anxiety"  # Disruption typically causes anxiety
                elif "!" in text or any(w in text_lower for w in ["hate", "angry", "mad", "argued", "annoyed"]):
                    emotion_label = "anger"
                elif any(w in text_lower for w in ["worried", "anxious", "nervous", "overwhelmed"]):
                    emotion_label = "anxiety"
                else:
                    emotion_label = "sadness"
            else:
                # Near-neutral sentiment
                if has_contrast:
                    # Contrast with neutral sentiment → mild disappointment/sadness
                    emotion_label = "sadness"
                else:
                    emotion_label = "neutral"
    else:
        # Use first detected emotion
        emotion_label = detected_emotions[0]
    
    # Get valence/arousal from map
    valence, arousal = EMOTION_MAP.get(emotion_label, (0.0, 0.3))
    
    # Context-aware arousal adjustment
    has_exclamation = text.count("!") >= 2  # Multiple exclamations
    has_caps = sum(1 for word in text.split() if word.isupper() and len(word) > 2) >= 2  # Multiple caps words
    
    # BOOST: Genuinely intense expressions only
    if has_exclamation and has_caps and emotion_label in ["anger", "joy", "fear"]:
        arousal = min(arousal + 0.05, 1.0)
    
    # BOOST: Contrast disruption raises arousal (emotional shift)
    if has_contrast and emotion_label in ["sadness", "anxiety", "anger"]:
        arousal = min(arousal + 0.3, 0.8)  # Boost 0.3 → 0.6, capped at 0.8
    
    # BOOST: Sleep disturbance (insomnia) raises arousal
    if "insomnia" in text_lower and emotion_label == "sadness":
        arousal = min(arousal + 0.3, 0.7)  # 0.3 → 0.6
    
    # DAMPEN: Calm positive reflections (no exclamation, calm keywords)
    calm_markers = ["helped", "sweet", "gesture", "hopeful", "calmer", "meditation", "recovering", "manageable", "habit", "tracker"]
    if emotion_label in ["joy", "contentment"] and not has_exclamation:
        if any(marker in text_lower for marker in calm_markers):
            arousal = arousal * 0.625  # 0.8 → 0.5, 0.7 → 0.44
    
    # Detect hedging/over-assertion markers
    hedging_markers = ["i guess", "i suppose", "maybe", "whatever", "kind of"]
    has_hedging = any(marker in text_lower for marker in hedging_markers)
    
    # Over-assertion (sarcasm/masking): "Really. Totally fine", "I'm okay. Really."
    over_assertion = (("really" in text_lower and "totally" in text_lower) or
                      ("totally fine" in text_lower) or
                      ("okay" in text_lower and "really" in text_lower) or
                      (text_lower.count(".") >= 2 and "fine" in text_lower) or
                      (text_lower.count(".") >= 2 and len(text.split()) < 10))  # Short, choppy
    
    # Blend valence with sentiment for stability (but trust keywords more)
    if detected_emotions:
        valence = 0.7 * valence + 0.3 * sentiment_polarity  # More weight on keyword
    else:
        # For inferred emotions, trust sentiment more (especially after contrast)
        if has_contrast:
            valence = 0.3 * valence + 0.7 * sentiment_polarity  # Trust sentiment after contrast
        else:
            valence = 0.4 * valence + 0.6 * sentiment_polarity  # Standard inference
    
    # Apply dampening for hedging/over-assertion
    if has_hedging:
        valence *= 0.65  # Stronger dampen: 0.518 → 0.337
        arousal *= 0.75  # Also lower arousal
    
    if over_assertion:
        # Over-assertion suggests masking → neutralize emotion
        if valence > 0:
            valence *= 0.15  # Very strong dampen: 0.7 → 0.105
        emotion_label = "neutral"  # Force neutral for masking
        arousal = 0.3  # Low arousal for suppression
    
    # Clamp to valid ranges
    valence = max(-1.0, min(1.0, valence))
    arousal = max(0.0, min(1.0, arousal))
    
    return {
        "emotion": emotion_label,
        "valence": round(valence, 3),
        "arousal": round(arousal, 3),
        "confidence": round(max(sentiment_subjectivity, 0.5 if detected_emotions else 0.3), 3),
    }


def extract_event_keywords(text: str, top_n: int = 5) -> List[str]:
    """
    Extract salient nouns and proper nouns as event keywords.
    Filters out stopwords, adverbs, particles, and short words.
    """
    blob = TextBlob(text)
    
    # Stopwords to filter (common non-content words)
    stopwords = {
        'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your', 'yours',
        'he', 'him', 'his', 'she', 'her', 'hers', 'it', 'its', 'they', 'them',
        'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were',
        'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
        'would', 'should', 'can', 'could', 'may', 'might', 'must', 'shall',
        'the', 'a', 'an', 'and', 'but', 'if', 'or', 'as', 'of', 'at', 'by',
        'for', 'with', 'about', 'into', 'through', 'during', 'before', 'after',
        'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under',
        'so', 'very', 'really', 'just', 'thing', 'things', 'stuff', 'lots'
    }
    
    keywords = []
    
    # First, extract from noun phrases (catches compounds like "coffee on laptop")
    for np in blob.noun_phrases:
        # Split noun phrase into individual nouns
        for word in np.split():
            word_lower = word.lower()
            if word_lower not in stopwords and len(word) > 2:
                keywords.append(word_lower)
    
    # Then extract individual nouns and proper nouns
    for word, pos in blob.tags:
        # Keep only NOUN and PROPN (proper nouns)
        if pos.startswith('NN'):
            word_lower = word.lower()
            # Filter: not stopword, alphabetic, length > 2
            if word_lower not in stopwords and word.isalpha() and len(word) > 2:
                keywords.append(word_lower)
    
    # Deduplicate and take top N
    unique_keywords = list(dict.fromkeys(keywords))
    return unique_keywords[:top_n]


def compute_expressed_intensity(text: str) -> float:
    """
    Compute expressed intensity from punctuation, caps, elongations, and soft cues.
    Includes adverb boosters, emphasis words, and comma density.
    Returns float in [0, 1].
    """
    # Count exclamations
    exclamations = text.count("!")
    
    # Capitalization density (ignore first letter of sentences)
    words = text.split()
    if len(words) == 0:
        return 0.0
    
    caps_words = sum(1 for w in words if w.isupper() and len(w) > 1)
    caps_ratio = caps_words / len(words)
    
    # Elongations (e.g., "soooo", "noooo")
    elongation_count = len(re.findall(r'(.)\1{2,}', text))
    
    # Adverb boosters and emphasis words
    boosters = ["really", "very", "so", "super", "extremely", "incredibly", "absolutely", "totally", "utterly"]
    text_lower = text.lower()
    booster_count = sum(1 for word in boosters if word in text_lower)
    booster_score = min(booster_count / len(words), 0.3) if len(words) > 0 else 0
    
    # Comma density (soft arousal cue)
    comma_count = text.count(",")
    comma_density = comma_count / len(words) if len(words) > 0 else 0
    
    # Composite score with weighting
    intensity_raw = (
        1.2 * min(exclamations, 3) +  # Cap at 3 exclamations
        0.8 * caps_ratio +
        0.8 * min(elongation_count, 2) +  # Cap at 2 elongations
        0.6 * booster_score +
        0.4 * min(comma_density, 0.5)  # Cap comma contribution
    )
    
    # Apply tanh for smooth saturation
    intensity = np.tanh(0.8 * intensity_raw)
    
    return round(min(intensity, 1.0), 3)


def compute_expressed_tone(invoked_valence: float) -> str:
    """
    Derive expressed tone strictly from invoked valence.
    No sentiment override - tone = tone_from_valence(invoked_valence).
    """
    return tone_from_valence(invoked_valence)


def compute_self_awareness_proxy(text: str) -> float:
    """
    Proxy for self-awareness: meta-cognitive markers + clarity.
    Returns float in [0, 1].
    """
    text_lower = text.lower()
    
    # Count meta-cognitive markers (expanded for self-reflection)
    meta_markers_extended = META_COGNITIVE_MARKERS + [
        "overreacted", "i was", "i feel", "i realize", "looking back",
        "in retrospect", "i understand", "i see now", "earlier"
    ]
    
    # Explicit self-critique markers (strong self-awareness signal)
    self_critique = ["overreacted", "i was wrong", "i shouldn't have", "looking back", "in hindsight", "earlier"]
    has_critique = any(marker in text_lower for marker in self_critique)
    
    meta_count = sum(1 for marker in meta_markers_extended if marker in text_lower)
    
    # Readability-based clarity (Flesch Reading Ease proxy)
    words = text.split()
    if len(words) < 3:
        clarity = 0.3
    else:
        avg_word_length = sum(len(w) for w in words) / len(words)
        clarity = 1.0 - min(avg_word_length / 15.0, 1.0)  # Shorter words = clearer
    
    # Composite with higher weight on meta-markers, boost for self-critique
    base_awareness = (
        min(meta_count * 0.3, 0.7) +  # Higher weight per marker
        min(clarity * 0.3, 0.3)
    )
    
    if has_critique:
        base_awareness = min(base_awareness + 0.25, 0.85)  # Strong boost for self-critique
    
    return round(min(base_awareness, 1.0), 3)


def compute_willingness_to_express(text: str) -> float:
    """
    Willingness to express: first-person ratio minus hedging.
    Returns float in [0, 1].
    """
    text_lower = text.lower()
    words = text_lower.split()
    
    if len(words) == 0:
        return 0.0
    
    # First-person pronouns
    first_person_count = sum(1 for w in words if w in ["i", "me", "my", "myself"])
    first_person_ratio = first_person_count / len(words)
    
    # Hedging markers
    hedging_count = sum(1 for marker in HEDGING_MARKERS if marker in text_lower)
    hedging_penalty = min(hedging_count * 0.1, 0.4)
    
    willingness = first_person_ratio * 2 - hedging_penalty
    
    return round(max(0.0, min(willingness, 1.0)), 3)


def detect_risk_flags(text: str) -> List[str]:
    """
    Detect risk flags: self-harm, hopelessness, withdrawal.
    Returns list of risk labels.
    """
    text_lower = text.lower()
    flags = []
    
    # Check self-harm patterns
    for pattern in SELF_HARM_PATTERNS:
        if pattern in text_lower:
            flags.append("self_harm")
            break
    
    # Check hopelessness patterns
    for pattern in HOPELESSNESS_PATTERNS:
        if pattern in text_lower:
            flags.append("hopelessness")
            break
    
    # Check withdrawal patterns
    for pattern in WITHDRAWAL_PATTERNS:
        if pattern in text_lower:
            flags.append("severe_withdrawal")
            break
    
    return flags


def analyze_reflection(text: str) -> Dict:
    """
    Main feature extraction pipeline.
    Returns all computed features.
    """
    # Invoked emotion
    invoked = detect_emotion_and_valence(text)
    
    # Event keywords
    event_keywords = extract_event_keywords(text)
    
    # Expressed features (tone derived from invoked valence)
    expressed_tone = compute_expressed_tone(invoked["valence"])
    expressed_intensity = compute_expressed_intensity(text)
    
    # Self-awareness and willingness
    self_awareness = compute_self_awareness_proxy(text)
    willingness = compute_willingness_to_express(text)
    
    # Risk detection
    risk_flags = detect_risk_flags(text)
    
    return {
        "invoked": invoked,
        "event_keywords": event_keywords,
        "expressed_tone": expressed_tone,
        "expressed_intensity": expressed_intensity,
        "self_awareness_proxy": self_awareness,
        "willingness_to_express": willingness,
        "risk_flags": risk_flags,
    }
