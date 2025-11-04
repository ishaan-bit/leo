"""
Synthetic edge case generation to fill quota gaps from taxonomy_216.csv.

Generates synthetic reflections for under-represented categories:
- Sarcasm (≥1,200)
- Suicidal ideation (≥600)
- Self-harm (≥400)
- Abuse/stalking (≥800)
- Profanity (≥1,200)
- Sociopathic cues (≥400)
- Financial coercion (≥600)

All synthetic items tagged with source:"synthetic" and verified:false
until dual review for HIGH-risk items.
"""

import json
import random
from pathlib import Path
from datetime import datetime, timedelta
from typing import Dict, List
import argparse


# Synthetic templates for edge cases
SARCASM_TEMPLATES = [
    "Oh {adjective}, {event}. Best day ever 🙄",
    "Just {adjective}. Totally {adjective2} 😒",
    "*Great*, another {event}",
    "Yeah, {event}. Living the dream 🙄",
    "Oh sure, {event}. Couldn't be better.",
    "Wow, {event}. I'm so \"blessed\" 😒",
]

SARCASM_FILLERS = {
    "adjective": ["great", "perfect", "amazing", "wonderful", "fantastic", "brilliant"],
    "adjective2": ["fine", "okay", "thrilled", "excited", "happy"],
    "event": ["my boss ignored me again", "another deadline moved up", "plans cancelled",
              "got blamed for team mistake", "someone took credit for my work"],
}

SUICIDAL_TEMPLATES = [
    "I want to end it all.",
    "Can't keep going like this anymore. Want to just stop existing.",
    "Everyone would be better off without me. I've been thinking about ending things.",
    "I don't see a way out. Thinking about how to make the pain stop permanently.",
    "Made a plan. Going to end this tonight.",
    "Bought pills. Can't do this anymore.",
]

SELFHARM_TEMPLATES = [
    "Cut myself again last night. It's the only thing that helps.",
    "Can't stop scratching until I bleed. Need the pain.",
    "Burned my arm with cigarette. Feel numb.",
    "Been starving myself for 3 days. Feel some control finally.",
    "Hit the wall until knuckles bled. Deserved it.",
]

ABUSE_TEMPLATES = [
    "He hit me last night. Said it was my fault for talking back.",
    "Scared to go home. Every night walking on eggshells, never know what will set him off.",
    "He controls all my money. Can't leave even if I wanted to. Trapped.",
    "He checks my phone constantly. If I don't respond within 5 minutes he accuses me of cheating. I have no privacy.",
    "He threatened to hurt my family if I leave. I believe him.",
    "Haven't seen my friends in months. He says they're bad influence. I'm so isolated.",
]

PROFANITY_SHORT = [
    "Fucked up day.",
    "This is such bullshit.",
    "Fucking hate this.",
    "What the fuck am I doing.",
    "Shit day. Shit life.",
    "Goddamn nightmare.",
]

PROFANITY_HINGLISH = [
    "Yaar ye sab bakwas hai. Fucking tired.",
    "Kya madarchod situation hai yaar.",
    "Bahut zyada frustrating hai bc. Can't take it.",
    "Saala kuch bhi theek nahi ja raha. Shit luck.",
    "Pagal ho jaungi main. What the fuck yaar.",
]

SOCIOPATHIC_TEMPLATES = [
    "I don't feel bad for what I said to her. She had it coming.",
    "Manipulated him into giving me what I wanted. People are so easy to control.",
    "Lied straight to her face. She believed every word. It's funny how gullible people are.",
    "I don't care if I hurt them. They're not my problem.",
    "Cheated and felt nothing. Rules don't apply to me.",
    "Used them and threw them away. No regrets.",
]

FINANCIAL_COERCION_TEMPLATES = [
    "He took my entire paycheck. Says I can't be trusted with money. I have to ask permission to buy groceries.",
    "In debt because of him. He took loans in my name. Threatened to ruin my credit if I complain.",
    "He won't let me work. Says women shouldn't earn. I'm completely dependent on him.",
    "Forced to give him money every month or he'll tell my family lies about me. Blackmail.",
]


def generate_sarcasm(count: int, lang: str = "EN") -> List[Dict]:
    """Generate sarcasm examples."""
    items = []
    
    for i in range(count):
        template = random.choice(SARCASM_TEMPLATES)
        text = template.format(
            adjective=random.choice(SARCASM_FILLERS["adjective"]),
            adjective2=random.choice(SARCASM_FILLERS["adjective2"]),
            event=random.choice(SARCASM_FILLERS["event"])
        )
        
        items.append({
            "rid": f"synth_sarcasm_{lang}_{i:04d}",
            "source": "synthetic",
            "verified": False,
            "raw_text": text,
            "lang": lang,
            "edge_case_category": "sarcasm_common",
            "risk_level": "LOW",
            "length_bucket": "SHORT",
            "invoked_core": "Angry",
            "invoked_nuance": "Frustrated",
            "sarcasm_detected": True,
        })
    
    return items


def generate_suicidal(count: int, lang: str = "EN") -> List[Dict]:
    """Generate suicidal ideation examples (HIGH RISK)."""
    items = []
    
    for i in range(count):
        text = random.choice(SUICIDAL_TEMPLATES)
        length_bucket = "SHORT" if len(text.split()) < 15 else "MEDIUM"
        
        items.append({
            "rid": f"synth_suicidal_{lang}_{i:04d}",
            "source": "synthetic",
            "verified": False,
            "dual_review_required": True,
            "raw_text": text,
            "lang": lang,
            "edge_case_category": "high_risk",
            "risk_level": "HIGH",
            "length_bucket": length_bucket,
            "invoked_core": "Sad",
            "invoked_nuance": "Depressed",
            "invoked_micro": "Hopeless",
            "risk_flags": {
                "suicidal_ideation": True,
            }
        })
    
    return items


def generate_selfharm(count: int, lang: str = "EN") -> List[Dict]:
    """Generate self-harm examples (HIGH RISK)."""
    items = []
    
    for i in range(count):
        text = random.choice(SELFHARM_TEMPLATES)
        length_bucket = "SHORT" if len(text.split()) < 15 else "MEDIUM"
        
        items.append({
            "rid": f"synth_selfharm_{lang}_{i:04d}",
            "source": "synthetic",
            "verified": False,
            "dual_review_required": True,
            "raw_text": text,
            "lang": lang,
            "edge_case_category": "high_risk",
            "risk_level": "HIGH",
            "length_bucket": length_bucket,
            "invoked_core": "Sad",
            "invoked_nuance": "Hurt",
            "risk_flags": {
                "self_harm": True,
            }
        })
    
    return items


def generate_abuse(count: int, lang: str = "EN") -> List[Dict]:
    """Generate abuse/DV examples (HIGH RISK)."""
    items = []
    
    for i in range(count):
        text = random.choice(ABUSE_TEMPLATES)
        word_count = len(text.split())
        
        if word_count < 15:
            length_bucket = "SHORT"
        elif word_count < 60:
            length_bucket = "MEDIUM"
        else:
            length_bucket = "LONG"
        
        items.append({
            "rid": f"synth_abuse_{lang}_{i:04d}",
            "source": "synthetic",
            "verified": False,
            "dual_review_required": True,
            "raw_text": text,
            "lang": lang,
            "edge_case_category": "high_risk",
            "risk_level": "HIGH",
            "length_bucket": length_bucket,
            "invoked_core": "Fearful",
            "invoked_nuance": "Helpless",
            "invoked_micro": "Stuck",
            "risk_flags": {
                "abuse": True,
                "financial_coercion": "controls all my money" in text.lower(),
            }
        })
    
    return items


def generate_profanity(count: int, lang: str = "EN") -> List[Dict]:
    """Generate profanity examples."""
    items = []
    templates = PROFANITY_HINGLISH if lang == "Hinglish" else PROFANITY_SHORT
    
    for i in range(count):
        text = random.choice(templates)
        
        items.append({
            "rid": f"synth_profanity_{lang}_{i:04d}",
            "source": "synthetic",
            "verified": False,
            "raw_text": text,
            "lang": lang,
            "edge_case_category": "profanity_common",
            "risk_level": "LOW",
            "length_bucket": "SHORT",
            "invoked_core": "Angry",
            "invoked_nuance": "Frustrated",
            "risk_flags": {
                "profanity_present": True,
            }
        })
    
    return items


def generate_sociopathic(count: int, lang: str = "EN") -> List[Dict]:
    """Generate sociopathic cue examples (MEDIUM RISK)."""
    items = []
    
    for i in range(count):
        text = random.choice(SOCIOPATHIC_TEMPLATES)
        length_bucket = "SHORT" if len(text.split()) < 15 else "MEDIUM"
        
        items.append({
            "rid": f"synth_sociopathic_{lang}_{i:04d}",
            "source": "synthetic",
            "verified": False,
            "raw_text": text,
            "lang": lang,
            "edge_case_category": "sociopathic_cues",
            "risk_level": "MEDIUM",
            "length_bucket": length_bucket,
            "invoked_core": "Strong",
            "invoked_nuance": "Proud",
            "risk_flags": {
                "sociopathic_cues": True,
            }
        })
    
    return items


def generate_financial_coercion(count: int, lang: str = "EN") -> List[Dict]:
    """Generate financial coercion examples (HIGH RISK)."""
    items = []
    
    for i in range(count):
        text = random.choice(FINANCIAL_COERCION_TEMPLATES)
        word_count = len(text.split())
        
        if word_count < 15:
            length_bucket = "SHORT"
        elif word_count < 60:
            length_bucket = "MEDIUM"
        else:
            length_bucket = "LONG"
        
        items.append({
            "rid": f"synth_fincoer_{lang}_{i:04d}",
            "source": "synthetic",
            "verified": False,
            "dual_review_required": True,
            "raw_text": text,
            "lang": lang,
            "edge_case_category": "high_risk",
            "risk_level": "HIGH",
            "length_bucket": length_bucket,
            "invoked_core": "Fearful",
            "invoked_nuance": "Helpless",
            "risk_flags": {
                "financial_coercion": True,
                "abuse": True,
            }
        })
    
    return items


def main(args):
    """Generate all synthetic edge cases."""
    print("="*70)
    print("SYNTHETIC EDGE CASE GENERATION")
    print("="*70)
    
    all_items = []
    
    # Sarcasm (≥1,200) - split across EN/Hinglish
    print("\n[1/7] Generating sarcasm examples...")
    sarcasm_en = generate_sarcasm(800, "EN")
    sarcasm_hi = generate_sarcasm(400, "Hinglish")
    all_items.extend(sarcasm_en)
    all_items.extend(sarcasm_hi)
    print(f"  ✓ Generated {len(sarcasm_en) + len(sarcasm_hi)} sarcasm items")
    
    # Suicidal ideation (≥600) - HIGH RISK
    print("\n[2/7] Generating suicidal ideation examples (HIGH RISK)...")
    suicidal_en = generate_suicidal(450, "EN")
    suicidal_hi = generate_suicidal(150, "Hinglish")
    all_items.extend(suicidal_en)
    all_items.extend(suicidal_hi)
    print(f"  ✓ Generated {len(suicidal_en) + len(suicidal_hi)} suicidal ideation items")
    print(f"  ⚠️  All items require DUAL REVIEW before use")
    
    # Self-harm (≥400) - HIGH RISK
    print("\n[3/7] Generating self-harm examples (HIGH RISK)...")
    selfharm_en = generate_selfharm(300, "EN")
    selfharm_hi = generate_selfharm(100, "Hinglish")
    all_items.extend(selfharm_en)
    all_items.extend(selfharm_hi)
    print(f"  ✓ Generated {len(selfharm_en) + len(selfharm_hi)} self-harm items")
    print(f"  ⚠️  All items require DUAL REVIEW before use")
    
    # Abuse/DV (≥800) - HIGH RISK
    print("\n[4/7] Generating abuse/DV examples (HIGH RISK)...")
    abuse_en = generate_abuse(600, "EN")
    abuse_hi = generate_abuse(200, "Hinglish")
    all_items.extend(abuse_en)
    all_items.extend(abuse_hi)
    print(f"  ✓ Generated {len(abuse_en) + len(abuse_hi)} abuse items")
    print(f"  ⚠️  All items require DUAL REVIEW before use")
    
    # Profanity (≥1,200)
    print("\n[5/7] Generating profanity examples...")
    profanity_en = generate_profanity(700, "EN")
    profanity_hi = generate_profanity(500, "Hinglish")
    all_items.extend(profanity_en)
    all_items.extend(profanity_hi)
    print(f"  ✓ Generated {len(profanity_en) + len(profanity_hi)} profanity items")
    
    # Sociopathic cues (≥400)
    print("\n[6/7] Generating sociopathic cue examples...")
    sociopathic = generate_sociopathic(400, "EN")
    all_items.extend(sociopathic)
    print(f"  ✓ Generated {len(sociopathic)} sociopathic cue items")
    
    # Financial coercion (≥600) - HIGH RISK
    print("\n[7/7] Generating financial coercion examples (HIGH RISK)...")
    fincoer_en = generate_financial_coercion(450, "EN")
    fincoer_hi = generate_financial_coercion(150, "Hinglish")
    all_items.extend(fincoer_en)
    all_items.extend(fincoer_hi)
    print(f"  ✓ Generated {len(fincoer_en) + len(fincoer_hi)} financial coercion items")
    print(f"  ⚠️  All items require DUAL REVIEW before use")
    
    # Add metadata (user_id, timestamps)
    base_ts = datetime.now() - timedelta(days=90)  # Start 90 days ago
    
    for i, item in enumerate(all_items):
        # Assign mock user_id (simulate ~800 users)
        item["owner_id"] = f"synth_user_{i % 800:04d}"
        
        # Assign timestamp (spread over 90 days)
        ts_offset = timedelta(days=random.randint(0, 90), hours=random.randint(0, 23))
        item["ts"] = (base_ts + ts_offset).isoformat() + "Z"
        
        item["generated_at"] = datetime.now().isoformat()
        item["char_len"] = len(item["raw_text"])
        item["word_count"] = len(item["raw_text"].split())
    
    # Save to JSONL
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        for item in all_items:
            f.write(json.dumps(item, ensure_ascii=False) + '\n')
    
    print(f"\n[OK] Saved {len(all_items)} synthetic items to: {output_path}")
    
    # Summary stats
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    
    by_category = {}
    by_risk = {}
    by_lang = {}
    by_length = {}
    high_risk_count = 0
    
    for item in all_items:
        cat = item.get("edge_case_category", "unknown")
        by_category[cat] = by_category.get(cat, 0) + 1
        
        risk = item.get("risk_level", "NONE")
        by_risk[risk] = by_risk.get(risk, 0) + 1
        
        lang = item.get("lang", "EN")
        by_lang[lang] = by_lang.get(lang, 0) + 1
        
        length = item.get("length_bucket", "MEDIUM")
        by_length[length] = by_length.get(length, 0) + 1
        
        if item.get("dual_review_required"):
            high_risk_count += 1
    
    print(f"\nTotal items: {len(all_items)}")
    print(f"HIGH risk items requiring dual review: {high_risk_count}")
    
    print(f"\nBy category:")
    for cat, count in sorted(by_category.items()):
        print(f"  - {cat}: {count}")
    
    print(f"\nBy risk level:")
    for risk, count in sorted(by_risk.items()):
        print(f"  - {risk}: {count}")
    
    print(f"\nBy language:")
    for lang, count in sorted(by_lang.items()):
        print(f"  - {lang}: {count}")
    
    print(f"\nBy length bucket:")
    for length, count in sorted(by_length.items()):
        print(f"  - {length}: {count}")
    
    print(f"\n⚠️  IMPORTANT:")
    print(f"  - All HIGH risk items (n={high_risk_count}) must undergo dual review")
    print(f"  - Do NOT use synthetic HIGH risk items for training until verified")
    print(f"  - Set trainable:false for crisis patterns in generation targets")
    
    print(f"\n[INFO] Next steps:")
    print(f"  1. Review HIGH risk items manually (dual annotators)")
    print(f"  2. Run: python scripts/ingest.py --merge-synthetic")
    print(f"  3. Run: python scripts/qa_dataset.py --risk-audit")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic edge cases")
    parser.add_argument(
        "--output",
        type=str,
        default="data/curated/perception_synth.jsonl",
        help="Output path for synthetic items"
    )
    
    args = parser.parse_args()
    main(args)
