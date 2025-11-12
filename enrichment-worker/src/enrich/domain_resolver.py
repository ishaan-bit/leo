"""
Domain Resolver with Priority Logic

v2.2 Enhancement: Frozen canonical domain set
- Output locked to exactly 8 domains: work, relationships, social, self, family, health, money, study
- All domain values mapped to closest canonical domain
- Prevents drift and ensures consistent API contract

Explicit token-based prioritization to avoid ambiguity:
1. Money tokens → money domain
2. Work tokens → work domain
3. Ritual tokens → self or health (prefer self unless body/health terms)
4. Praise context disambiguation (social vs work vs self)
"""

import re
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass

from .features import FeatureSet, detect_first_person, detect_plural_third_person


# v2.2: Canonical domain set (FROZEN - do not add/remove without API version bump)
CANONICAL_DOMAINS = frozenset([
    'work',
    'relationships',
    'social',
    'self',
    'family',
    'health',
    'money',
    'study'
])


# v2.2: Domain normalization map
# Maps non-canonical domains to canonical equivalents
DOMAIN_NORMALIZATION_MAP = {
    # Relationship variants
    'relationship': 'relationships',
    'romantic': 'relationships',
    'dating': 'relationships',
    'love': 'relationships',
    
    # Work variants
    'career': 'work',
    'job': 'work',
    'professional': 'work',
    'workplace': 'work',
    
    # Health variants
    'medical': 'health',
    'fitness': 'health',
    'wellness': 'health',
    'physical': 'health',
    'mental': 'health',
    
    # Family variants
    'parents': 'family',
    'children': 'family',
    'siblings': 'family',
    
    # Self variants
    'personal': 'self',
    'identity': 'self',
    'internal': 'self',
    
    # Study variants
    'education': 'study',
    'school': 'study',
    'academic': 'study',
    'learning': 'study',
    
    # Financial variants
    'financial': 'money',
    'finance': 'money',
    'economic': 'money',
    
    # Social variants
    'friends': 'social',
    'community': 'social',
    'peer': 'social',
    'public': 'social'
}


def normalize_domain(domain: str) -> str:
    """
    Normalize any domain value to canonical domain set.
    
    v2.2 Contract Enforcement:
    - Input can be any string (from legacy systems, external APIs, etc.)
    - Output ALWAYS in CANONICAL_DOMAINS
    - Unknown domains map to 'self' (safest default)
    
    Args:
        domain: Any domain string (canonical or non-canonical)
        
    Returns:
        Canonical domain name (guaranteed to be in CANONICAL_DOMAINS)
        
    Examples:
        normalize_domain('work') → 'work'  # Already canonical
        normalize_domain('career') → 'work'  # Mapped
        normalize_domain('relationship') → 'relationships'  # Normalized
        normalize_domain('unknown_xyz') → 'self'  # Default fallback
    """
    domain_lower = domain.lower().strip()
    
    # Already canonical?
    if domain_lower in CANONICAL_DOMAINS:
        return domain_lower
    
    # Check normalization map
    if domain_lower in DOMAIN_NORMALIZATION_MAP:
        return DOMAIN_NORMALIZATION_MAP[domain_lower]
    
    # Unknown domain → default to 'self'
    return 'self'


@dataclass
class DomainScore:
    """Domain classification result"""
    primary: str
    confidence: float
    candidates: Dict[str, float]  # All scored domains
    explanation: str


# Health/body terms for ritual disambiguation
HEALTH_BODY_TERMS = re.compile(
    r'\b(pain|ache|sick|ill(ness)?|doctor|hospital|medical|'
    r'body|physical|injury|symptom|health)\b',
    re.IGNORECASE
)


def resolve_domain(features: FeatureSet, text: str) -> DomainScore:
    """
    Resolve domain using explicit priority logic.
    
    v2.2: Output guaranteed to be in CANONICAL_DOMAINS.
    
    Priority order:
    1. Money tokens → money
    2. Work tokens → work
    3. Family terms → family
    4. Study terms → study
    5. Ritual tokens + no health terms → self
    6. Ritual tokens + health terms → health
    7. Praise disambiguation:
       - With work tokens → work
       - With plural third-person + no work tokens → social
       - Else → self
    8. Default: self
    
    Args:
        features: Extracted features
        text: Original text
        
    Returns:
        DomainScore with primary domain (guaranteed canonical) and confidence
    """
    # Initialize with canonical domains only
    candidates = {domain: 0.0 for domain in CANONICAL_DOMAINS}
    
    explanation_parts = []
    
    # Priority 1: Money tokens
    if features.money_tokens:
        candidates['money'] = 0.8 + (len(features.money_tokens) * 0.05)
        explanation_parts.append(f"money_tokens({len(features.money_tokens)})")
    
    # Priority 2: Work tokens
    if features.work_tokens:
        candidates['work'] = 0.7 + (len(features.work_tokens) * 0.05)
        explanation_parts.append(f"work_tokens({len(features.work_tokens)})")
    
    # Priority 3: Family signals (NEW in v2.2 canonical set)
    family_terms = re.compile(
        r'\b(mom|dad|mother|father|parents?|family|families|sister|brother|'
        r'siblings?|grandma|grandpa|child|children|son|daughter)\b',
        re.IGNORECASE
    )
    if family_terms.search(text):
        candidates['family'] = 0.75
        explanation_parts.append("family_terms→family")
    
    # Priority 4: Study signals (NEW in v2.2 canonical set)
    study_terms = re.compile(
        r'\b(exam|test|class|homework|assignment|professor|teacher|'
        r'student|study|college|university|school|grade|course)\b',
        re.IGNORECASE
    )
    if study_terms.search(text):
        candidates['study'] = 0.75
        explanation_parts.append("study_terms→study")
    
    # Priority 5/6: Ritual tokens
    if features.ritual_tokens:
        has_health_terms = HEALTH_BODY_TERMS.search(text) is not None
        if has_health_terms:
            candidates['health'] = 0.75
            explanation_parts.append("ritual+health_terms→health")
        else:
            candidates['self'] = 0.75
            explanation_parts.append("ritual+no_health→self")
    
    # Priority 7: Praise disambiguation
    if features.praise:
        if features.work_tokens:
            # Praise in work context
            candidates['work'] += 0.2
            explanation_parts.append("praise+work→work")
        elif detect_plural_third_person(text) and not features.work_tokens:
            # "Everyone says..." without org context → social
            candidates['social'] = 0.65
            explanation_parts.append("praise+plural_3rd→social")
        else:
            # Self-directed or ambiguous
            candidates['self'] += 0.3
            explanation_parts.append("praise+first_person→self")
    
    # Relationship signals
    relationship_terms = re.compile(
        r'\b(partner|boyfriend|girlfriend|spouse|relationship|'
        r'dating|love|breakup|broke up|romance|romantic)\b',
        re.IGNORECASE
    )
    if relationship_terms.search(text):
        candidates['relationships'] = 0.7
        explanation_parts.append("relationship_terms→relationships")
    
    # Default: self if no strong signals
    if max(candidates.values()) < 0.3:
        candidates['self'] = 0.55
        explanation_parts.append("default→self")
    
    # Select primary (guaranteed to be canonical)
    primary = max(candidates, key=candidates.get)
    confidence = candidates[primary]
    
    # Normalize confidence to [0, 1]
    confidence = min(1.0, confidence)
    
    # Enforce canonical domain (defensive programming)
    primary = normalize_domain(primary)
    
    explanation = " | ".join(explanation_parts) if explanation_parts else "no_strong_signals"
    
    return DomainScore(
        primary=primary,
        confidence=confidence,
        candidates=candidates,
        explanation=explanation
    )


def get_secondary_domain(domain_score: DomainScore, threshold: float = 0.4) -> Optional[str]:
    """
    Get secondary domain if score is above threshold.
    
    Args:
        domain_score: Primary domain classification
        threshold: Minimum score for secondary
        
    Returns:
        Secondary domain name or None
    """
    sorted_domains = sorted(
        domain_score.candidates.items(),
        key=lambda x: x[1],
        reverse=True
    )
    
    if len(sorted_domains) < 2:
        return None
    
    primary_name, primary_score = sorted_domains[0]
    secondary_name, secondary_score = sorted_domains[1]
    
    # Secondary must be above threshold and not too close to primary
    if secondary_score >= threshold and (primary_score - secondary_score) > 0.1:
        return secondary_name
    
    return None
