"""
Generate 216-cell taxonomy with tier assignments and quotas.

Creates taxonomy_216.csv with columns:
- cell_id: Unique identifier (1-216)
- core: Primary emotion (6 options)
- nuance: Secondary emotion (36 options)
- micro: Tertiary emotion (216 options)
- tier: A/B/C priority
- quota_perception: Target count for perception labels
- quota_sft: Target count for SFT generation
- quota_dpo: Target count for DPO pairs
- clinical_priority: HIGH/MEDIUM/LOW
- edge_case_category: Optional (sarcasm, profanity, high_risk, etc.)
"""

import csv
import os
from pathlib import Path

# Import EES-1 schema
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.utils.emotion_schema import CORES, NUANCES, MICROS

def assign_tier(core, nuance, micro):
    """
    Assign tier (A/B/C) based on clinical priority and commonality.
    
    Tier A (60 cells): Most common in urban India women 25-35
    Tier B (100 cells): Moderately common
    Tier C (56 cells): Rare or extreme states
    """
    
    # TIER A (60 cells) - High Priority
    tier_a_patterns = [
        # Sad branch (most common)
        ("Sad", "Lonely", ["Abandoned", "Isolated", "Forsaken", "Forgotten", "Alone"]),
        ("Sad", "Depressed", ["Hopeless", "Empty", "Low", "Exhausted", "Despairing"]),
        ("Sad", "Hurt", ["Wounded", "Pained", "Aching"]),
        ("Sad", "Vulnerable", ["Exposed", "Fragile", "Unsafe"]),
        ("Sad", "Guilty", ["Ashamed", "Regretful", "Embarrassed"]),
        
        # Fearful branch (anxiety epidemic)
        ("Fearful", "Anxious", ["Nervous", "Uneasy", "Tense", "Worried", "Restless", "Alarmed"]),
        ("Fearful", "Overwhelmed", ["Stressed", "Exhausted", "Flooded", "Pressured", "Burdened"]),
        ("Fearful", "Insecure", ["Uncertain", "Self-doubting", "Hesitant"]),
        ("Fearful", "Rejected", ["Excluded", "Neglected", "Abandoned"]),
        
        # Angry branch (relationship conflicts)
        ("Angry", "Frustrated", ["Annoyed", "Impatient", "Restless", "Defeated", "Irritated"]),
        ("Angry", "Disappointed", ["Betrayed", "Let-down", "Resentful"]),
        ("Angry", "Humiliated", ["Ashamed", "Inferior", "Embarrassed", "Belittled"]),
        
        # Peaceful branch (positive affect)
        ("Peaceful", "Grateful", ["Thankful", "Appreciative", "Blessed", "Content"]),
        ("Peaceful", "Content", ["Comfortable", "Satisfied", "Calm", "At-ease"]),
        ("Peaceful", "Serene", ["Tranquil", "Relaxed", "Balanced"]),
        
        # Happy branch (positive but guarded)
        ("Happy", "Optimistic", ["Hopeful", "Positive"]),
        ("Happy", "Interested", ["Engaged", "Curious"]),
        
        # Strong branch (resilience)
        ("Strong", "Resilient", ["Tough", "Steady", "Enduring", "Adaptable"]),
        ("Strong", "Hopeful", ["Inspired", "Aspiring", "Reassured"]),
        ("Strong", "Confident", ["Assured", "Capable"]),
    ]
    
    # TIER C (56 cells) - Low Priority / Rare
    tier_c_patterns = [
        # Extreme positive (rare in distress-focused journaling)
        ("Happy", "Excited", ["Energetic", "Stimulated", "Inspired", "Cheerful"]),
        ("Happy", "Playful", ["Fun", "Lighthearted", "Amused", "Silly", "Jovial"]),
        ("Happy", "Creative", "Imaginative", "Inventive", "Visionary", "Experimental"),
        
        # Extreme negative / sociopathic
        ("Angry", "Aggressive", ["Provoked", "Violent", "Hostile", "Combative", "Threatening"]),
        ("Angry", "Critical", ["Dismissive", "Judgmental", "Harsh", "Skeptical", "Sarcastic"]),
        ("Sad", "Grief", ["Mourning", "Bereaved", "Sorrowful", "Heartbroken"]),
        ("Fearful", "Weak", ["Powerless", "Fragile", "Small", "Ineffective"]),
        ("Fearful", "Helpless", ["Worthless", "Defeated", "Stuck", "Lost", "Hopeless", "Paralyzed"]),
        
        # Rare strong states
        ("Strong", "Proud", ["Accomplished", "Honored", "Esteemed", "Fulfilled"]),
        ("Strong", "Respected", ["Valued", "Trusted", "Admired", "Recognized"]),
        ("Strong", "Courageous", ["Brave", "Adventurous", "Daring", "Fearless"]),
    ]
    
    # Check Tier A
    for pattern in tier_a_patterns:
        if len(pattern) == 3:
            p_core, p_nuance, p_micros = pattern
            if core == p_core and nuance == p_nuance and micro in p_micros:
                return "A"
    
    # Check Tier C
    for pattern in tier_c_patterns:
        if len(pattern) == 3:
            p_core, p_nuance, p_micros = pattern
            if core == p_core and nuance == p_nuance:
                if isinstance(p_micros, list) and micro in p_micros:
                    return "C"
                elif isinstance(p_micros, str) and micro == p_micros:
                    return "C"
    
    # Default: Tier B (everything else)
    return "B"


def assign_quotas(tier):
    """
    Assign target quotas per tier.
    
    Tier A: 200 perception, 60 SFT, 55 DPO
    Tier B: 150 perception, 45 SFT, 40 DPO
    Tier C: 100 perception, 20 SFT, 20 DPO
    """
    quotas = {
        "A": {"perception": 200, "sft": 60, "dpo": 55},
        "B": {"perception": 150, "sft": 45, "dpo": 40},
        "C": {"perception": 100, "sft": 20, "dpo": 20}
    }
    return quotas[tier]


def assign_clinical_priority(core, nuance, micro):
    """
    Assign clinical priority for flagging high-risk states.
    """
    high_priority = [
        ("Sad", "Depressed", "Hopeless"),
        ("Sad", "Depressed", "Despairing"),
        ("Fearful", "Helpless", "Hopeless"),
        ("Fearful", "Helpless", "Worthless"),
        ("Fearful", "Helpless", "Paralyzed"),
        ("Angry", "Aggressive", "Violent"),
        ("Angry", "Aggressive", "Threatening"),
    ]
    
    if (core, nuance, micro) in high_priority:
        return "HIGH"
    elif core in ["Sad", "Fearful", "Angry"]:
        return "MEDIUM"
    else:
        return "LOW"


def assign_edge_case_category(core, nuance, micro):
    """
    Tag cells that commonly appear in edge cases.
    """
    # Sarcasm often appears as fake-positive
    if core == "Happy" and nuance in ["Playful", "Excited"]:
        return "sarcasm_common"
    
    # Profanity/anger
    if core == "Angry" and nuance in ["Mad", "Frustrated"]:
        return "profanity_common"
    
    # High-risk
    if nuance in ["Depressed", "Helpless", "Aggressive"]:
        return "high_risk"
    
    # Sociopathic cues
    if core == "Strong" and nuance == "Proud" and micro in ["Esteemed", "Worthy"]:
        return "sociopathic_potential"
    
    return None


def generate_taxonomy():
    """
    Generate complete 216-cell taxonomy with tier assignments.
    """
    taxonomy = []
    cell_id = 1
    
    tier_counts = {"A": 0, "B": 0, "C": 0}
    
    for core in CORES:
        for nuance in NUANCES[core]:
            for micro in MICROS[nuance]:
                tier = assign_tier(core, nuance, micro)
                quotas = assign_quotas(tier)
                clinical = assign_clinical_priority(core, nuance, micro)
                edge_case = assign_edge_case_category(core, nuance, micro)
                
                taxonomy.append({
                    "cell_id": cell_id,
                    "core": core,
                    "nuance": nuance,
                    "micro": micro,
                    "tier": tier,
                    "quota_perception": quotas["perception"],
                    "quota_sft": quotas["sft"],
                    "quota_dpo": quotas["dpo"],
                    "clinical_priority": clinical,
                    "edge_case_category": edge_case or ""
                })
                
                tier_counts[tier] += 1
                cell_id += 1
    
    # Validate counts
    print(f"[INFO] Tier A: {tier_counts['A']} cells")
    print(f"[INFO] Tier B: {tier_counts['B']} cells")
    print(f"[INFO] Tier C: {tier_counts['C']} cells")
    print(f"[INFO] Total: {sum(tier_counts.values())} cells")
    
    # Calculate total quotas
    total_perception = sum(row["quota_perception"] for row in taxonomy)
    total_sft = sum(row["quota_sft"] for row in taxonomy)
    total_dpo = sum(row["quota_dpo"] for row in taxonomy)
    
    print(f"\n[INFO] Total Perception Quota: {total_perception}")
    print(f"[INFO] Total SFT Quota: {total_sft}")
    print(f"[INFO] Total DPO Quota: {total_dpo}")
    
    # Adjust if needed to hit targets (32.4k perception, 9k SFT, 7.5k DPO)
    if total_perception < 32400:
        print(f"[WARN] Perception quota below target. Need to boost A/B tiers.")
    
    return taxonomy


def save_taxonomy(taxonomy, output_path):
    """
    Save taxonomy to CSV.
    """
    fieldnames = [
        "cell_id", "core", "nuance", "micro", "tier",
        "quota_perception", "quota_sft", "quota_dpo",
        "clinical_priority", "edge_case_category"
    ]
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(taxonomy)
    
    print(f"\n[OK] Taxonomy saved to: {output_path}")


if __name__ == "__main__":
    print("="*60)
    print("Generating 216-Cell Taxonomy (EES-1 with Tiers)")
    print("="*60)
    
    taxonomy = generate_taxonomy()
    
    output_path = Path(__file__).parent.parent / "data" / "curated" / "taxonomy_216.csv"
    save_taxonomy(taxonomy, str(output_path))
    
    print("\n[INFO] Next steps:")
    print("  1. Review tier assignments in taxonomy_216.csv")
    print("  2. Run: python scripts/sampler.py --taxonomy data/curated/taxonomy_216.csv")
    print("  3. Run: python scripts/build_perception.py --enforce-quotas")
