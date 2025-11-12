"""
Multi-domain detection module.
Detects primary and secondary domains with mixture ratio.

v2.0+: Enhanced with lexicon-based keyword dominance, avoids 50/50 splits.
"""
from typing import Dict, Tuple, Optional
import re
from enrich.lexicons import get_domain_keywords

# Load lexicon-based domain keywords
DOMAIN_KEYWORDS_LEXICON = get_domain_keywords()

# v1.0 Hardcoded keywords (keep as fallback)
DOMAIN_KEYWORDS_V1 = {
    'work': [
        'work', 'job', 'boss', 'colleague', 'coworker', 'office', 'meeting',
        'deadline', 'project', 'presentation', 'client', 'salary', 'promotion',
        'task', 'assignment', 'performance', 'team', 'manager', 'employee'
    ],
    'relationship': [
        'relationship', 'partner', 'girlfriend', 'boyfriend', 'spouse', 'wife',
        'husband', 'dating', 'love', 'romance', 'breakup', 'together', 'couple',
        'commitment', 'trust', 'intimacy'
    ],
    'family': [
        'family', 'mom', 'dad', 'mother', 'father', 'parent', 'sibling', 'brother',
        'sister', 'child', 'son', 'daughter', 'grandparent', 'relative', 'uncle',
        'aunt', 'cousin', 'home', 'household'
    ],
    'health': [
        'health', 'sick', 'illness', 'disease', 'doctor', 'hospital', 'medical',
        'medicine', 'treatment', 'pain', 'injury', 'surgery', 'therapy', 'symptom',
        'diagnosis', 'recovery', 'exercise', 'fitness', 'diet'
    ],
    'money': [
        'money', 'financial', 'finance', 'debt', 'loan', 'payment', 'bill',
        'expense', 'budget', 'savings', 'salary', 'income', 'rent', 'mortgage',
        'investment', 'bank', 'credit', 'afford'
    ],
    'study': [
        'study', 'exam', 'test', 'assignment', 'homework', 'class', 'course',
        'lecture', 'professor', 'teacher', 'grade', 'school', 'college', 'university',
        'education', 'learning', 'student', 'degree', 'thesis'
    ],
    'social': [
        'friend', 'friends', 'social', 'party', 'hangout', 'gathering', 'event',
        'community', 'group', 'circle', 'acquaintance', 'peer', 'networking',
        'invitation', 'celebration'
    ],
    'self': [
        'myself', 'i am', 'personal', 'identity', 'self', 'who i am', 'purpose',
        'meaning', 'growth', 'development', 'confidence', 'self-worth', 'values',
        'beliefs', 'goals', 'dreams', 'aspirations'
    ]
}

# Merge lexicon and v1.0 keywords
DOMAIN_KEYWORDS = {}
for domain in DOMAIN_KEYWORDS_V1.keys():
    # Map v1.0 names to v2.0+ lexicon names
    lexicon_domain = domain
    if domain == 'money':
        lexicon_domain = 'finance'
    elif domain == 'study':
        lexicon_domain = 'education'
    elif domain == 'self':
        lexicon_domain = 'personal'
    
    # Merge keywords
    combined = set(DOMAIN_KEYWORDS_V1[domain])
    if lexicon_domain in DOMAIN_KEYWORDS_LEXICON:
        combined.update(DOMAIN_KEYWORDS_LEXICON[lexicon_domain])
    
    DOMAIN_KEYWORDS[domain] = list(combined)

# Add any new domains from lexicon
for lexicon_domain, keywords in DOMAIN_KEYWORDS_LEXICON.items():
    if lexicon_domain == 'finance' and 'money' not in DOMAIN_KEYWORDS:
        DOMAIN_KEYWORDS['money'] = keywords
    elif lexicon_domain == 'education' and 'study' not in DOMAIN_KEYWORDS:
        DOMAIN_KEYWORDS['study'] = keywords
    elif lexicon_domain == 'personal' and 'self' not in DOMAIN_KEYWORDS:
        DOMAIN_KEYWORDS['self'] = keywords
    elif lexicon_domain not in ['relationships', 'finance', 'education', 'personal']:
        # Map relationships → relationship
        if lexicon_domain == 'relationships':
            if 'relationship' in DOMAIN_KEYWORDS:
                DOMAIN_KEYWORDS['relationship'].extend(keywords)
        else:
            DOMAIN_KEYWORDS[lexicon_domain] = keywords


def score_domain_keywords(text: str) -> Dict[str, float]:
    """
    Score each domain based on keyword matches.
    
    Returns:
        {domain: score}
    """
    text_lower = text.lower()
    domain_scores = {domain: 0.0 for domain in DOMAIN_KEYWORDS}
    
    for domain, keywords in DOMAIN_KEYWORDS.items():
        for keyword in keywords:
            if keyword in text_lower:
                # Multi-word keywords get higher weight
                weight = len(keyword.split())
                domain_scores[domain] += weight
    
    return domain_scores


def detect_domains_rule_based(text: str) -> Tuple[str, Optional[str], float, float]:
    """
    Detect primary and optional secondary domain.
    
    v2.0+: Enhanced to avoid 50/50 splits unless scores within 1 point.
    
    Returns:
        (primary_domain, secondary_domain, mixture_ratio, confidence)
        mixture_ratio: proportion of primary (0.5-1.0)
        confidence: overall detection confidence (0-1)
    """
    domain_scores = score_domain_keywords(text)
    
    # Sort domains by score
    sorted_domains = sorted(domain_scores.items(), key=lambda x: x[1], reverse=True)
    
    # If no matches, default to 'self' with low confidence
    if sorted_domains[0][1] == 0:
        return 'self', None, 1.0, 0.3
    
    primary_domain = sorted_domains[0][0]
    primary_score = sorted_domains[0][1]
    
    # v2.0+ Enhancement: Avoid 50/50 splits unless scores very close
    secondary_domain = None
    mixture_ratio = 1.0
    
    if len(sorted_domains) > 1:
        secondary_score = sorted_domains[1][1]
        
        # Only return secondary if:
        # 1. Scores within 1 point (close competition), OR
        # 2. Secondary >= 40% of primary AND absolute difference > 1
        score_diff = abs(primary_score - secondary_score)
        
        if secondary_score > 0:
            if score_diff <= 1.0:
                # Very close scores → return both domains
                secondary_domain = sorted_domains[1][0]
                mixture_ratio = primary_score / (primary_score + secondary_score)
            elif secondary_score >= 0.4 * primary_score and score_diff > 1.0:
                # Moderate secondary but clear primary dominance
                # Only include if truly cross-domain (not just keyword overlap)
                secondary_domain = sorted_domains[1][0]
                mixture_ratio = primary_score / (primary_score + secondary_score)
            else:
                # Primary dominates → single domain
                secondary_domain = None
                mixture_ratio = 1.0
            secondary_domain = sorted_domains[1][0]
            total_score = primary_score + secondary_score
            mixture_ratio = primary_score / total_score  # 0.5-1.0 range
    
    # Calculate confidence based on score strength
    if primary_score >= 3.0:
        confidence = 0.9
    elif primary_score >= 2.0:
        confidence = 0.75
    elif primary_score >= 1.0:
        confidence = 0.6
    else:
        confidence = 0.45
    
    # Reduce confidence if domains are close (ambiguous)
    if secondary_domain:
        confidence *= 0.85  # Slight reduction for mixed domains
    
    return primary_domain, secondary_domain, mixture_ratio, confidence


def extract_domain_metadata(text: str) -> Dict:
    """
    Extract detailed domain detection metadata.
    
    Returns:
        {
            'primary': str,
            'secondary': Optional[str],
            'mixture_ratio': float,
            'confidence': float,
            'all_scores': Dict[str, float],
            'matched_keywords': Dict[str, List[str]]
        }
    """
    primary, secondary, mixture_ratio, confidence = detect_domains_rule_based(text)
    domain_scores = score_domain_keywords(text)
    
    # Collect matched keywords
    text_lower = text.lower()
    matched_keywords = {}
    
    for domain, keywords in DOMAIN_KEYWORDS.items():
        matches = [kw for kw in keywords if kw in text_lower]
        if matches:
            matched_keywords[domain] = matches
    
    return {
        'primary': primary,
        'secondary': secondary,
        'mixture_ratio': mixture_ratio,
        'confidence': confidence,
        'all_scores': domain_scores,
        'matched_keywords': matched_keywords
    }
