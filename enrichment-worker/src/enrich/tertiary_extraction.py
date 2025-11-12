"""
Tertiary Motif Extraction

Detects fine-grain emotional states using:
1. Direct motif matching (regex patterns for specific tertiaries)
2. Metaphor mapping (neg_metaphor → tertiary)
3. Appraisal alignment (control/social/uncertainty cues)

Scoring:
- Motif hit: +1.0
- Metaphor hit: +0.5
- Appraisal alignment: +0.3
- Clause weighting applied (2× after contrast)
"""

import re
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass

from .features import FeatureSet
from .clauses import Clause
from .tertiary_wheel import (
    WHEEL, 
    get_tertiaries_for_secondary, 
    get_primary_and_secondary,
    TertiaryCandidate
)


# Tertiary-specific motif patterns
# Maps regex patterns to specific tertiary emotions
TERTIARY_MOTIFS: Dict[str, Tuple[str, str, str]] = {
    # Format: pattern → (primary, secondary, tertiary)
    
    # Sad → Lonely tertiaries
    r'\b(homesick|miss(ing)? (home|family))\b': ('Sad', 'Lonely', 'Homesick'),
    r'\b(abandoned|left (behind|alone)|nobody cares)\b': ('Sad', 'Lonely', 'Abandoned'),
    r'\b(isolated|cut off|shut out)\b': ('Sad', 'Lonely', 'Isolated'),
    r'\b(forsaken|betrayed|cast (aside|away))\b': ('Sad', 'Lonely', 'Forsaken'),
    r'\b(forgotten|invisible|ignored)\b': ('Sad', 'Lonely', 'Forgotten'),
    r'\b(distant|detached|disconnected)\b': ('Sad', 'Lonely', 'Distant'),
    r'\b(all alone|by myself|on my own)\b': ('Sad', 'Lonely', 'Alone'),
    
    # Sad → Vulnerable tertiaries
    r'\b(exposed|laid bare|out there)\b': ('Sad', 'Vulnerable', 'Exposed'),
    r'\b(fragile|brittle|delicate)\b': ('Sad', 'Vulnerable', 'Fragile'),
    r'\b(unsafe|at risk|in danger)\b': ('Sad', 'Vulnerable', 'Unsafe'),
    r'\b(sensitive|raw|tender)\b': ('Sad', 'Vulnerable', 'Sensitive'),
    r'\b(helpless|powerless|defenseless)\b': ('Sad', 'Vulnerable', 'Helpless'),
    r'\b(unprotected|open to attack)\b': ('Sad', 'Vulnerable', 'Unprotected'),
    
    # Sad → Hurt tertiaries
    r'\b(wounded|injured emotionally)\b': ('Sad', 'Hurt', 'Wounded'),
    r'\b(offended|slighted|insulted)\b': ('Sad', 'Hurt', 'Offended'),
    r'\b(pained|aching|hurting)\b': ('Sad', 'Hurt', 'Pained'),
    
    # Sad → Depressed tertiaries
    r'\b(hopeless|no hope|lost hope)\b': ('Sad', 'Depressed', 'Hopeless'),
    r'\b(empty inside|hollow|void)\b': ('Sad', 'Depressed', 'Empty'),
    r'\b((feeling )?low|down in the dumps)\b': ('Sad', 'Depressed', 'Low'),
    r'\b(drained|spent|burnt out)\b': ('Sad', 'Depressed', 'Exhausted'),
    r'\b(melanchol(ic|y)|wistful)\b': ('Sad', 'Depressed', 'Melancholic'),
    r'\b(despair(ing)?|without hope)\b': ('Sad', 'Depressed', 'Despairing'),
    
    # Sad → Guilty tertiaries
    r'\b(ashamed|full of shame)\b': ('Sad', 'Guilty', 'Ashamed'),
    r'\b(regret(ful)?|wish I (hadn\'t|could undo))\b': ('Sad', 'Guilty', 'Regretful'),
    r'\b((my|the) fault|to blame)\b': ('Sad', 'Guilty', 'Responsible'),
    r'\b(remorse(ful)?|deeply sorry)\b': ('Sad', 'Guilty', 'Remorseful'),
    r'\b(embarrassed|humiliated)\b': ('Sad', 'Guilty', 'Embarrassed'),
    
    # Sad → Grief tertiaries
    r'\b(mourning|in grief)\b': ('Sad', 'Grief', 'Mourning'),
    r'\b(bereaved|lost (someone|them))\b': ('Sad', 'Grief', 'Bereaved'),
    r'\b(heartbroken|heart(- )?broken)\b': ('Sad', 'Grief', 'Heartbroken'),
    r'\b(weeping|crying|in tears)\b': ('Sad', 'Grief', 'Weeping'),
    
    # Fearful → Anxious tertiaries
    r'\b(nervous|on edge|jittery)\b': ('Fearful', 'Anxious', 'Nervous'),
    r'\b(uneasy|unsettled|uncomfortable)\b': ('Fearful', 'Anxious', 'Uneasy'),
    r'\b(tense|tight|wound up)\b': ('Fearful', 'Anxious', 'Tense'),
    r'\b(worried|worrying about)\b': ('Fearful', 'Anxious', 'Worried'),
    r'\b(restless|can\'t sit still)\b': ('Fearful', 'Anxious', 'Restless'),
    r'\b(alarmed|startled)\b': ('Fearful', 'Anxious', 'Alarmed'),
    
    # Fearful → Overwhelmed tertiaries
    r'\b(drowning|sinking|going under)\b': ('Fearful', 'Overwhelmed', 'Flooded'),
    r'\b(stressed out|under pressure)\b': ('Fearful', 'Overwhelmed', 'Stressed'),
    r'\b(exhausted|worn out|burnt out)\b': ('Fearful', 'Overwhelmed', 'Exhausted'),
    r'\b(burdened|weighed down)\b': ('Fearful', 'Overwhelmed', 'Burdened'),
    r'\b(distracted|can\'t focus)\b': ('Fearful', 'Overwhelmed', 'Distracted'),
    
    # Fearful → Insecure tertiaries
    r'\b(uncertain|not sure|unsure)\b': ('Fearful', 'Insecure', 'Uncertain'),
    r'\b(doubt(ing)? myself|self-doubt)\b': ('Fearful', 'Insecure', 'Self-doubting'),
    r'\b(hesitant|holding back)\b': ('Fearful', 'Insecure', 'Hesitant'),
    r'\b(guarded|defensive)\b': ('Fearful', 'Insecure', 'Guarded'),
    r'\b(timid|shy|meek)\b': ('Fearful', 'Insecure', 'Timid'),
    
    # Fearful → Helpless tertiaries
    r'\b(worthless|no value|useless)\b': ('Fearful', 'Helpless', 'Worthless'),
    r'\b(defeated|beaten|crushed)\b': ('Fearful', 'Helpless', 'Defeated'),
    r'\b(stuck|trapped|can\'t move)\b': ('Fearful', 'Helpless', 'Stuck'),
    r'\b(lost|don\'t know where to go)\b': ('Fearful', 'Helpless', 'Lost'),
    r'\b(paralyzed|frozen|can\'t act)\b': ('Fearful', 'Helpless', 'Paralyzed'),
    
    # Angry → Disappointed tertiaries
    r'\b(betrayed|stabbed in the back)\b': ('Angry', 'Disappointed', 'Betrayed'),
    r'\b(jealous|envious)\b': ('Angry', 'Disappointed', 'Jealous'),
    r'\b(let down|disappointed)\b': ('Angry', 'Disappointed', 'Let-down'),
    r'\b(resentful|bitter)\b': ('Angry', 'Disappointed', 'Resentful'),
    
    # Angry → Frustrated tertiaries
    r'\b(annoyed|irritated)\b': ('Angry', 'Frustrated', 'Annoyed'),
    r'\b(impatient|can\'t wait)\b': ('Angry', 'Frustrated', 'Impatient'),
    r'\b(blocked|stuck|hitting a wall)\b': ('Angry', 'Frustrated', 'Blocked'),
    
    # Angry → Critical tertiaries
    r'\b(dismissive|brush(ing)? off)\b': ('Angry', 'Critical', 'Dismissive'),
    r'\b(judgmental|judging)\b': ('Angry', 'Critical', 'Judgmental'),
    r'\b(sarcastic|snide)\b': ('Angry', 'Critical', 'Sarcastic'),
    
    # Happy → Excited tertiaries
    r'\b(energetic|full of energy)\b': ('Happy', 'Excited', 'Energetic'),
    r'\b(curious|wondering)\b': ('Happy', 'Excited', 'Curious'),
    r'\b(playful|having fun)\b': ('Happy', 'Excited', 'Playful'),
    r'\b(inspired|sparked)\b': ('Happy', 'Excited', 'Inspired'),
    r'\b(cheerful|chipper)\b': ('Happy', 'Excited', 'Cheerful'),
    
    # Happy → Optimistic tertiaries
    r'\b(hopeful|looking forward)\b': ('Happy', 'Optimistic', 'Hopeful'),
    r'\b(upbeat|positive)\b': ('Happy', 'Optimistic', 'Upbeat'),
    r'\b(expectant|anticipating)\b': ('Happy', 'Optimistic', 'Expectant'),
    
    # Strong → Confident tertiaries
    r'\b(assured|certain)\b': ('Strong', 'Confident', 'Assured'),
    r'\b(secure|safe)\b': ('Strong', 'Confident', 'Secure'),
    r'\b(capable|competent)\b': ('Strong', 'Confident', 'Capable'),
    r'\b(bold|daring)\b': ('Strong', 'Confident', 'Bold'),
    
    # Strong → Proud tertiaries
    r'\b(accomplished|achieved)\b': ('Strong', 'Proud', 'Accomplished'),
    r'\b(honored|privileged)\b': ('Strong', 'Proud', 'Honored'),
    r'\b(worthy|deserve)\b': ('Strong', 'Proud', 'Worthy'),
    
    # Strong → Courageous tertiaries
    r'\b(brave|courageous)\b': ('Strong', 'Courageous', 'Brave'),
    r'\b(adventurous|daring)\b': ('Strong', 'Courageous', 'Adventurous'),
    r'\b(determined|resolved)\b': ('Strong', 'Courageous', 'Determined'),
    
    # Peaceful → Loving tertiaries
    r'\b(caring|compassionate)\b': ('Peaceful', 'Loving', 'Caring'),
    r'\b(affectionate|tender)\b': ('Peaceful', 'Loving', 'Affectionate'),
    r'\b(warm|warmth)\b': ('Peaceful', 'Loving', 'Warm'),
    r'\b(kind|gentle)\b': ('Peaceful', 'Loving', 'Kind'),
    
    # Peaceful → Grateful tertiaries
    r'\b(thankful|thank(ing)?)\b': ('Peaceful', 'Grateful', 'Thankful'),
    r'\b(appreciative|appreciate)\b': ('Peaceful', 'Grateful', 'Appreciative'),
    r'\b(blessed|fortunate)\b': ('Peaceful', 'Grateful', 'Blessed'),
    r'\b(relieved|relief)\b': ('Peaceful', 'Grateful', 'Relieved'),
    
    # Peaceful → Content tertiaries
    r'\b(comfortable|at ease)\b': ('Peaceful', 'Content', 'Comfortable'),
    r'\b(satisfied|content)\b': ('Peaceful', 'Content', 'Satisfied'),
    r'\b(settled|stable)\b': ('Peaceful', 'Content', 'Settled'),
    
    # Peaceful → Serene tertiaries
    r'\b(tranquil|peaceful)\b': ('Peaceful', 'Serene', 'Tranquil'),
    r'\b(still|quiet)\b': ('Peaceful', 'Serene', 'Still'),
    r'\b(harmonious|balanced)\b': ('Peaceful', 'Serene', 'Harmonious'),
    r'\b(relaxed|calm)\b': ('Peaceful', 'Serene', 'Relaxed'),
}

# Compile patterns
COMPILED_TERTIARY_MOTIFS = {
    re.compile(pattern, re.IGNORECASE): mapping 
    for pattern, mapping in TERTIARY_MOTIFS.items()
}


def extract_tertiary_motifs(
    text: str,
    features: FeatureSet,
    clauses: List[Clause]
) -> List[TertiaryCandidate]:
    """
    Extract tertiary emotion candidates from text using motif matching.
    
    Args:
        text: Input text
        features: Extracted features
        clauses: Segmented clauses with weights
        
    Returns:
        List of TertiaryCandidate objects with scores
    """
    candidates: Dict[str, TertiaryCandidate] = {}
    
    # 1. Direct motif matching with clause weighting
    total_clause_weight = sum(c.weight for c in clauses)
    if total_clause_weight == 0:
        total_clause_weight = 1.0
    
    for clause in clauses:
        clause_text = clause.text
        clause_weight_factor = clause.weight / total_clause_weight
        
        for pattern, (primary, secondary, tertiary) in COMPILED_TERTIARY_MOTIFS.items():
            if pattern.search(clause_text):
                key = tertiary.lower()
                
                if key not in candidates:
                    candidates[key] = TertiaryCandidate(
                        tertiary=tertiary,
                        secondary=secondary,
                        primary=primary,
                        score=0.0,
                        explanation=""
                    )
                
                # Motif hit: +1.0 * clause_weight
                motif_score = 1.0 * clause_weight_factor
                candidates[key].score += motif_score
                
                if candidates[key].explanation:
                    candidates[key].explanation += f" + motif_hit({clause_weight_factor:.2f}×)"
                else:
                    candidates[key].explanation = f"motif_hit({clause_weight_factor:.2f}×)"
    
    # 2. Metaphor mapping (neg_metaphor → tertiary)
    if features.neg_metaphor:
        metaphor_mappings = {
            'drowning': ('Fearful', 'Overwhelmed', 'Flooded'),
            'sinking': ('Fearful', 'Overwhelmed', 'Flooded'),
            'empty': ('Sad', 'Depressed', 'Empty'),
            'hollow': ('Sad', 'Depressed', 'Empty'),
            'trapped': ('Fearful', 'Helpless', 'Stuck'),
            'stuck': ('Fearful', 'Helpless', 'Stuck'),
            'lost': ('Fearful', 'Helpless', 'Lost'),
            'broken': ('Sad', 'Grief', 'Heartbroken'),
        }
        
        for metaphor_token in features.matched_tokens.get('neg_metaphor', []):
            metaphor_lower = metaphor_token.lower()
            if metaphor_lower in metaphor_mappings:
                primary, secondary, tertiary = metaphor_mappings[metaphor_lower]
                key = tertiary.lower()
                
                if key not in candidates:
                    candidates[key] = TertiaryCandidate(
                        tertiary=tertiary,
                        secondary=secondary,
                        primary=primary,
                        score=0.0,
                        explanation=""
                    )
                
                # Metaphor hit: +0.5
                candidates[key].score += 0.5
                
                if candidates[key].explanation:
                    candidates[key].explanation += f" + metaphor({metaphor_lower})"
                else:
                    candidates[key].explanation = f"metaphor({metaphor_lower})"
    
    # 3. Appraisal alignment (control/uncertainty/social cues)
    appraisal_boosts = _compute_appraisal_alignment(features, text)
    for tertiary_lower, boost_score in appraisal_boosts.items():
        if tertiary_lower in candidates:
            candidates[tertiary_lower].score += boost_score
            candidates[tertiary_lower].explanation += f" + appraisal(+{boost_score:.2f})"
    
    return list(candidates.values())


def _compute_appraisal_alignment(
    features: FeatureSet,
    text: str
) -> Dict[str, float]:
    """
    Compute appraisal-based boosts for tertiaries.
    
    Control, uncertainty, and social cues align with specific tertiaries.
    
    Returns:
        Dict of {tertiary_lower: boost_score}
    """
    boosts: Dict[str, float] = {}
    
    # Low control → helpless tertiaries
    if features.agency_low:
        boosts['helpless'] = 0.3
        boosts['powerless'] = 0.3
        boosts['stuck'] = 0.3
    
    # High control → confident tertiaries
    if features.agency_high:
        boosts['confident'] = 0.3
        boosts['capable'] = 0.3
        boosts['bold'] = 0.3
    
    # Hedges → uncertain/insecure tertiaries
    if features.hedge:
        boost = min(0.3, 0.1 * features.hedge_count)
        boosts['uncertain'] = boost
        boosts['unsure'] = boost
        boosts['hesitant'] = boost
    
    # Social loss cues → lonely tertiaries
    social_loss_pattern = re.compile(
        r'\b(miss(ing)? (them|you|home|family)|alone|by myself|nobody)\b',
        re.IGNORECASE
    )
    if social_loss_pattern.search(text):
        boosts['lonely'] = 0.3
        boosts['isolated'] = 0.3
        boosts['abandoned'] = 0.3
    
    # Fatigue → exhausted tertiary
    if features.fatigue:
        boost = min(0.3, 0.15 * features.fatigue_count)
        boosts['exhausted'] = boost
        boosts['drained'] = boost
    
    return boosts


def select_best_tertiary(
    candidates: List[TertiaryCandidate],
    primary: str,
    secondary: str,
    threshold: float = 0.6
) -> Optional[TertiaryCandidate]:
    """
    Select best tertiary candidate within the chosen secondary.
    
    Args:
        candidates: All tertiary candidates
        primary: Chosen primary emotion
        secondary: Chosen secondary emotion
        threshold: Minimum raw score required (not normalized)
        
    Returns:
        Best TertiaryCandidate or None if below threshold
    """
    # Filter candidates matching primary and secondary
    matching = [
        c for c in candidates 
        if c.primary == primary and c.secondary == secondary
    ]
    
    if not matching:
        return None
    
    # Get highest scoring candidate
    best = max(matching, key=lambda c: c.score)
    
    # Apply threshold to raw score
    # Typical scores: motif=1.0, metaphor=0.5, appraisal=0.3
    # Good detections: 1.0+ (single strong signal)
    # Weak detections: <0.6
    if best.score < threshold:
        return None
    
    return best


__all__ = [
    'extract_tertiary_motifs',
    'select_best_tertiary',
    'TERTIARY_MOTIFS',
]
