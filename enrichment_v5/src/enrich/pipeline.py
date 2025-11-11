"""
Enrichment pipeline integration module.
Orchestrates all components for emotion detection and scoring.
"""
from typing import Dict, Optional, Tuple
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from enrich import (
    negation, sarcasm, profanity, event_valence, control, polarity, domain, va, 
    rerank, confidence as conf_module, secondary as secondary_module, neutral_detection
    # tertiary_extraction  # TODO: Fix imports
)


def preprocess_text(text: str) -> str:
    """
    Basic text preprocessing.
    """
    return text.strip().lower()


def extract_all_cues(text: str) -> Dict:
    """
    Extract all linguistic cues from text.
    
    Returns:
        Combined cues dictionary
    """
    return {
        'negation': negation.extract_negation_cues(text),
        'sarcasm': sarcasm.extract_sarcasm_cues(text),
        'profanity': profanity.extract_profanity_cues(text),
        'event_valence_meta': event_valence.extract_event_valence_metadata(text),
        'control_meta': control.extract_control_metadata(text),
        'polarity_meta': polarity.extract_polarity_metadata(text),
        'domain_meta': domain.extract_domain_metadata(text)
    }


def enrich(
    text: str,
    p_hf: Dict[str, float],
    secondary_similarity: Dict[str, float],
    driver_scores: Optional[Dict[str, float]] = None,
    history: Optional[Dict] = None,
    user_priors: Optional[Dict] = None,
    use_none_gate: bool = True
) -> Dict:
    """
    Main enrichment pipeline.
    
    Args:
        text: Input text (already in English)
        p_hf: HF model probabilities {emotion: prob}
        secondary_similarity: Embedding similarity scores {secondary: score}
        driver_scores: Optional driver signals {driver: score}
        history: Optional previous VA values
        user_priors: Optional user-specific domain/control priors
        use_none_gate: If True, returns None for low-density moments. If False, fallback to Neutral/Calm
        
    Returns:
        Complete enrichment result with emotions, VA, context, and confidence
    """
    # 1. Preprocess
    processed_text = preprocess_text(text)
    
    # 2. Extract all cues
    cues = extract_all_cues(processed_text)
    
    # 3. Extract context
    domain_primary = cues['domain_meta']['primary']
    domain_secondary = cues['domain_meta']['secondary']
    domain_mixture = cues['domain_meta']['mixture_ratio']
    domain_confidence = cues['domain_meta']['confidence']
    
    control_level = cues['control_meta']['control']
    control_confidence = cues['control_meta']['confidence']
    
    polarity_state = cues['polarity_meta']['polarity']
    polarity_confidence = cues['polarity_meta']['confidence']
    
    event_val = cues['event_valence_meta']['event_valence']
    
    # 4. Apply negation reversal
    p_hf_neg, negation_flag = negation.apply_negation_flip(processed_text, p_hf)
    
    # 5. Apply sarcasm heuristics
    p_hf_sarc, event_val_sarc, sarcasm_flag = sarcasm.apply_sarcasm_heuristics(
        processed_text, p_hf_neg, event_val
    )
    
    # 6. Rerank emotions
    best_primary, rerank_scores = rerank.rerank_emotions(
        p_hf=p_hf_sarc,
        similarity_scores=secondary_similarity,
        domain_primary=domain_primary,
        domain_secondary=domain_secondary,
        domain_mixture=domain_mixture,
        control=control_level,
        polarity=polarity_state,
        event_valence=event_val_sarc,
        user_priors=user_priors
    )
    
    # 7. Choose secondary with hierarchy validation and context awareness
    best_secondary, secondary_sim_score = secondary_module.select_secondary(
        primary=best_primary,
        secondary_similarity=secondary_similarity,
        event_valence=event_val_sarc,
        control_level=control_level,
        polarity=polarity_state
    )
    
    # 8. Select tertiary emotion using embeddings
    try:
        from enrich import tertiary as tertiary_module
        best_tertiary, tertiary_sim_score = tertiary_module.select_tertiary_batch(
            primary=best_primary,
            secondary=best_secondary,
            text=text
        )
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"[tertiary selection failed] {e}, using fallback")
        best_tertiary = None
        tertiary_sim_score = 0.0
    
    # 9. Detect neutral state (null | subtle | explicit)
    # Get features for neutral detection
    from enrich.features import extract_features
    feature_set = extract_features(text)
    
    # Use approximate emotion valence (0.5 = neutral baseline)
    # This is just for neutral detection thresholds, actual VA computed later
    emotion_valence_approx = 0.5
    
    # Run neutral detection (pass domain for enhanced detection)
    neutral_result = neutral_detection.detect_neutral_states(
        text=text,
        features=feature_set,
        emotion_valence=emotion_valence_approx,
        event_valence=event_val_sarc,
        domain=domain_primary  # For domain-aware emotion evidence
    )
    
    # Map values: "none" → None, "routine" → "subtle", "specific" → "explicit"
    emotion_presence_map = {
        "none": None,
        "subtle": "subtle",
        "explicit": "explicit"
    }
    event_presence_map = {
        "none": None,
        "routine": "subtle",
        "specific": "explicit"
    }
    
    emotion_presence = emotion_presence_map.get(neutral_result.emotion_presence, "explicit")
    event_presence = event_presence_map.get(neutral_result.event_presence, "explicit")
    is_neutral = neutral_result.is_emotion_neutral and neutral_result.is_event_neutral
    
    # If emotion_presence is None, handle based on use_none_gate flag
    if emotion_presence is None:
        if use_none_gate:
            # Gate is ON: Return None emotions (original behavior)
            best_primary = None
            best_secondary = None
            best_tertiary = None
            print("[pipeline] emotion_presence is None + use_none_gate=True -> setting all emotions to None")
        else:
            # Gate is OFF: Fallback to Neutral/Calm instead of None
            best_primary = "Peaceful"  # Neutral primary
            best_secondary = "Serene"  # Calm secondary
            best_tertiary = "soft"     # Gentle tertiary
            print("[pipeline] emotion_presence is None + use_none_gate=False -> fallback to Peaceful/Serene/soft")
    
    # 10. Compute overall confidence
    overall_confidence, conf_components = conf_module.compute_overall_confidence(
        p_hf=p_hf_sarc,
        rerank_scores=rerank_scores,
        winner=best_primary,
        negation_cues=cues['negation'],
        sarcasm_cues=cues['sarcasm'],
        control_confidence=control_confidence,
        polarity_confidence=polarity_confidence,
        domain_confidence=domain_confidence,
        secondary_similarity=secondary_sim_score
    )
    
    # 11. Compute valence/arousal
    if driver_scores is None:
        driver_scores = {}
    
    valence, arousal = va.compute_valence_arousal(
        text=processed_text,
        primary=best_primary,
        secondary=best_secondary,
        driver_scores=driver_scores,
        event_valence=event_val_sarc,
        confidence=overall_confidence,
        history=history
    )
    
    # 10. Apply profanity arousal boost (after VA calculation)
    p_hf_prof, arousal_prof, profanity_kind = profanity.apply_profanity_sentiment(
        text=processed_text,
        p_hf=p_hf_sarc,
        domain=domain_primary,
        control=control_level,
        base_arousal=arousal
    )
    
    # 13. Assemble result
    result = {
        # Emotions (structured as wheel for frontend compatibility)
        'wheel': {
            'primary': best_primary,
            'secondary': best_secondary,
            'tertiary': best_tertiary
        },
        'primary': best_primary,  # Keep for backwards compatibility
        'secondary': best_secondary,
        'tertiary': best_tertiary,
        
        # Valence/Arousal
        'valence': round(valence, 3),
        'arousal': round(arousal_prof, 3),
        'event_valence': round(event_val_sarc, 3),
        
        # Neutral detection
        'emotion_presence': emotion_presence,
        'event_presence': event_presence,
        'is_neutral': is_neutral,
        
        # Context
        'domain': {
            'primary': domain_primary,
            'secondary': domain_secondary,
            'mixture_ratio': round(domain_mixture, 3) if domain_secondary else 1.0
        },
        'control': control_level,
        'polarity': polarity_state,
        
        # Confidence
        'confidence': round(overall_confidence, 3),
        'confidence_category': conf_module.get_confidence_category(overall_confidence),
        'confidence_components': {k: round(v, 3) for k, v in conf_components.items()},
        
        # Flags
        'flags': {
            'negation': negation_flag,
            'sarcasm': sarcasm_flag,
            'profanity': profanity_kind
        },
        
        # Scores (for debugging)
        'scores': {
            'rerank': {k: round(v, 3) for k, v in rerank_scores.items()},
            'hf_original': {k: round(v, 3) for k, v in p_hf.items()},
            'hf_adjusted': {k: round(v, 3) for k, v in p_hf_sarc.items()}
        }
    }
    
    # 14. Append playful dialogue (poems + tips) from Excel (Guide to Urban Loneliness)
    try:
        from dialogue.excel_dialogue_fetcher import build_dialogue_from_excel
        poems, tips, dialogue_meta = build_dialogue_from_excel(result)
        result['poems'] = poems
        result['tips'] = tips
        result['_dialogue_meta'] = dialogue_meta
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"[dialogue append skipped] {e}")
    
    # 15. Compute signifiers (MSP/SMS/SOM-WC) - non-blocking, feature-gated
    try:
        from config.settings import settings
        
        if settings.FEATURE_SIGNIFIERS_ENABLED:
            from analytics.signifiers import compute_signifiers
            from analytics.som_wc import compute_som_wc
            
            # Compute signifiers
            signifiers = compute_signifiers(result, text)
            som = compute_som_wc(result, signifiers)
            
            # Merge into result
            result['signifiers'] = {**signifiers, **som}
            
            # Persist to Upstash if configured
            if settings.upstash_configured:
                from storage.upstash_client import store_signifiers
                rid = result.get('rid')
                if rid:
                    store_signifiers(rid, result['signifiers'], settings.SIGNIFIERS_TTL_SECONDS)
    
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.exception(
            "[signifiers] Failed to compute/store signifiers",
            extra={"rid": result.get("rid"), "sid": result.get("sid")}
        )
        # Continue without signifiers - non-blocking
    
    # 16. Append safety risk assessment - append-only, non-breaking
    try:
        from safety.detector import detect_safety_risk
        from safety.merge import append_only_update, prepare_safety_additions
        
        # Detect safety risk
        risk_assessment = detect_safety_risk(
            normalized_text=text,
            domain_secondary=domain_secondary
        )
        
        # EMOTION PRESENCE OVERRIDE: Crisis inputs MUST have emotion presence
        if risk_assessment.get("overall_band") in ["high", "concern"]:
            if is_neutral or emotion_presence is None:
                # Force emotion presence for crisis
                result['is_neutral'] = False
                result['emotion_presence'] = "present"
            
            # Force primary emotion for crisis based on signals (override existing emotion)
            sh_signals = risk_assessment.get("vectors", {}).get("self_harm", {}).get("signals", {})
            if sh_signals:
                # Attempt/ideation/history → Sad (despair, hopelessness)
                if sh_signals.get("history", 0) > 0 or sh_signals.get("ideation", 0) > 0.5:
                    result['wheel']['primary'] = "Sad"
                    result['primary'] = "Sad"
                    # Add secondary emotion based on context
                    if sh_signals.get("intent", 0) > 0:
                        result['wheel']['secondary'] = "Despair"
                        result['secondary'] = "Despair"
                # Planning/intent without history → Fearful (panic, dread)
                elif sh_signals.get("planning", 0) > 0 or sh_signals.get("intent", 0) > 0:
                    result['wheel']['primary'] = "Fearful"
                    result['primary'] = "Fearful"
                    result['wheel']['secondary'] = "Hurt"
                    result['secondary'] = "Hurt"
        
        # Prepare additions (append-only)
        safety_additions = prepare_safety_additions(
            risk_assessment,
            risk_assessment["overall_band"]
        )
        
        # Merge append-only (no modifications to existing fields)
        result = append_only_update(
            result,
            safety_additions,
            allowed_modifications=["final.post_enrichment.mode"]
        )
        
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.warning(
            f"[safety] Failed to append safety risk assessment: {e}",
            extra={"rid": result.get("rid"), "sid": result.get("sid")}
        )
        # Continue without safety - non-blocking
    
    return result


# Convenience function matching user's pseudocode
def enrich_from_scratch(
    text: str,
    get_hf_probs,  # Function to get HF probabilities
    get_embeddings,  # Function to get embedding similarities
    driver_scores: Optional[Dict] = None,
    history: Optional[Dict] = None,
    user_priors: Optional[Dict] = None
) -> Dict:
    """
    Full pipeline from text to enrichment.
    
    Args:
        text: Input text
        get_hf_probs: Callable that returns {emotion: prob}
        get_embeddings: Callable that returns {secondary: similarity}
        driver_scores: Optional driver signals
        history: Optional previous enrichment
        user_priors: Optional user-specific priors
    """
    # Get model outputs
    p_hf = get_hf_probs(text)
    secondary_sim = get_embeddings(text)
    
    # Run enrichment
    return enrich(text, p_hf, secondary_sim, driver_scores, history, user_priors)
