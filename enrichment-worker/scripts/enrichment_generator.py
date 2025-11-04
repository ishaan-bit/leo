"""
Empathy Generator - LLM-based Enrichment Content

Generates empathetic responses with:
- Voice/tempo mapping by primary emotion
- Poems (3-4 lines, poetic/liminal style)
- Tips (≤3 practical suggestions)
- Closing line (warm, affirming)

Safety: Neutral tone for risk_flags, no crisis banners in generator
Acceptance: Style-gate ≥90%, human A/B win-rate ≥70%
"""

import json
import random
from typing import Dict, List, Tuple
from pathlib import Path
from dataclasses import dataclass

# Voice/tempo mapping by primary emotion
VOICE_TEMPO_MAP = {
    "Sad": {
        "voice": "gentle",
        "tempo": "slow",
        "tone": "compassionate and reflective"
    },
    "Angry": {
        "voice": "grounded",
        "tempo": "mid",
        "tone": "validating and calm"
    },
    "Fearful": {
        "voice": "reflective",
        "tempo": "slow",
        "tone": "reassuring and steady"
    },
    "Happy": {
        "voice": "playful",
        "tempo": "mid-fast",
        "tone": "celebratory and warm"
    },
    "Peaceful": {
        "voice": "philosophical",
        "tempo": "mid",
        "tone": "serene and contemplative"
    },
    "Strong": {
        "voice": "warm",
        "tempo": "mid",
        "tone": "affirming and encouraging"
    }
}


@dataclass
class EnrichmentContent:
    """Generated enrichment content"""
    poems: List[str]  # 3 poems, 3-4 lines each
    tips: List[str]   # ≤3 tips
    closing_line: str
    tags: List[str]
    voice_config: Dict[str, str]


class EmpathyGenerator:
    """
    Empathy generator with "stranger on flight" voice
    
    Urban India context, minimal/poetic style, no therapy speak
    """
    
    def __init__(self, taxonomy_path: Path = Path("enrichment-worker/data/curated/taxonomy_216.json")):
        with open(taxonomy_path, 'r') as f:
            self.taxonomy = json.load(f)
        
        self.cores = self.taxonomy['cores']
        self.nuances = self.taxonomy['nuances']
    
    def generate_prompt(self, reflection_data: Dict) -> str:
        """
        Generate LLM prompt for enrichment content
        
        Args:
            reflection_data: {
                'text': str,
                'primary': str,  # Core emotion
                'secondary': str,  # Nuance emotion
                'valence': float,
                'arousal': float,
                'risk_flag': int
            }
        
        Returns:
            Prompt string for LLM
        """
        primary = reflection_data['primary']
        secondary = reflection_data.get('secondary', '')
        text = reflection_data['text']
        risk_flag = reflection_data.get('risk_flag', 0)
        
        # Get voice config
        voice_config = VOICE_TEMPO_MAP.get(primary, VOICE_TEMPO_MAP["Peaceful"])
        
        # Adjust tone for risk
        tone_modifier = ""
        if risk_flag > 0:
            tone_modifier = "\n**IMPORTANT**: This reflection contains risk indicators. Use neutral, non-judgmental tone. DO NOT include crisis banners or emergency language. Acknowledge feelings without alarm."
        
        prompt = f"""You are a warm, empathetic stranger on a long flight who happens to sit next to someone journaling. They share their reflection with you. Your voice is {voice_config['voice']}, tempo {voice_config['tempo']}, tone {voice_config['tone']}.

Context: Urban India, mindfulness/wellbeing space, poetic/liminal aesthetic.

Their reflection:
"{text}"

Emotion identified: {primary} → {secondary}
{tone_modifier}

Generate enrichment content:

1. **Three poetic reflections** (3-4 lines each, no titles):
   - Use imagery, metaphor, breathing room
   - Minimal, liminal, alive language
   - Avoid therapy speak or clichés
   - Each poem explores a different facet of the emotion

2. **Practical tips** (1-3 suggestions):
   - Grounded, actionable, culturally aware
   - No patronizing language
   - Brief (1 sentence each)

3. **Closing line** (1 sentence):
   - Affirming, warm, non-prescriptive
   - Leaves space for their own meaning

4. **Tags** (3-5 keywords):
   - For categorization/discovery
   - Lowercase, single words

Output as JSON:
{{
  "poems": ["poem1", "poem2", "poem3"],
  "tips": ["tip1", "tip2", "tip3"],
  "closing_line": "...",
  "tags": ["tag1", "tag2", ...]
}}
"""
        return prompt
    
    def generate_mock(self, reflection_data: Dict) -> EnrichmentContent:
        """
        Generate mock enrichment content (for testing without LLM)
        
        In production, this would call an LLM API with generate_prompt()
        """
        primary = reflection_data['primary']
        secondary = reflection_data.get('secondary', '')
        
        voice_config = VOICE_TEMPO_MAP.get(primary, VOICE_TEMPO_MAP["Peaceful"])
        
        # Mock poems by emotion
        poem_templates = {
            "Sad": [
                "The weight settles like dusk,\nheavy and familiar.\nYou've carried it before;\nyou can carry it again.",
                "Between the ache and the quiet,\nthere's a sliver of light—\nnot bright, but yours.\nIt's enough for now.",
                "Loss makes its own landscape.\nYou're learning its contours,\nslowly, in the dark.\nThis too is a kind of knowing."
            ],
            "Angry": [
                "The heat in your chest\nis a voice that needs hearing.\nListen first, then speak.\nYour fury is data.",
                "Boundaries are built from frustration.\nYou're allowed to say no.\nYou're allowed to say enough.\nThis is how you grow.",
                "The thing that made you boil\nis showing you where you care.\nAnger is just love\nwearing its armor."
            ],
            "Fearful": [
                "The uncertain path ahead\nfeels wider than your legs.\nBut you've walked through fog before.\nYour feet remember.",
                "Anxiety is your body\ntrying to protect you.\nThank it, then breathe.\nYou're safer than you think.",
                "What if it goes wrong?\nWhat if it goes right?\nBoth futures are just stories.\nThis moment is real."
            ],
            "Happy": [
                "Joy is a bird\nthat doesn't ask permission.\nIt lands, it sings,\nit leaves you changed.",
                "This lightness in your chest—\ndon't rush it, don't analyze.\nJust let it shimmer.\nYou earned this.",
                "Happiness isn't constant,\nbut neither is sorrow.\nYou're allowed to bloom\nwithout explaining why."
            ],
            "Peaceful": [
                "In the space between breaths,\nthere's a stillness\nthat asks for nothing.\nYou're allowed to rest here.",
                "The world spins loud and fast,\nbut here, in this moment,\nyou're exactly where you are.\nThat's enough.",
                "Peace isn't the absence of noise.\nIt's the presence of acceptance.\nYou're learning to hold both."
            ],
            "Strong": [
                "You bend but don't break.\nThat's not weakness—\nthat's resilience.\nThat's how trees survive storms.",
                "Strength isn't always loud.\nSometimes it's just waking up,\nshowing up, breathing.\nYou're doing it.",
                "The power you seek\nis already in you.\nNot someday, not later.\nNow. This. You."
            ]
        }
        
        # Mock tips by emotion
        tip_templates = {
            "Sad": [
                "Let yourself feel it without rushing to fix it.",
                "Reach out to one person who gets it.",
                "Do something small that grounds you—tea, a walk, music."
            ],
            "Angry": [
                "Name what you need that you're not getting.",
                "Move your body—walk, dance, punch a pillow.",
                "Write it out without filtering, then decide what to say."
            ],
            "Fearful": [
                "Break the worry into one small, doable step.",
                "Ground yourself: name 5 things you can see, 4 you can touch.",
                "Talk to someone who won't dismiss it."
            ],
            "Happy": [
                "Share it with someone who'll celebrate with you.",
                "Write down what sparked this—you'll want to remember.",
                "Let yourself bask without guilt or analysis."
            ],
            "Peaceful": [
                "Protect this feeling—say no to what disrupts it.",
                "Spend a few minutes just breathing, no agenda.",
                "Notice what brought you here so you can return."
            ],
            "Strong": [
                "Celebrate what you did, not just what's left to do.",
                "Share your win with someone who lifts you up.",
                "Rest isn't weakness—it's how you stay strong."
            ]
        }
        
        # Mock closing lines by emotion
        closing_templates = {
            "Sad": "Your tenderness is not a flaw. It's what makes you whole.",
            "Angry": "Your boundaries matter. Your voice matters. You matter.",
            "Fearful": "Courage isn't fearlessness. It's acting despite the fear. You're already doing it.",
            "Happy": "You deserve this lightness. Don't explain it away.",
            "Peaceful": "You found a moment of calm in a chaotic world. That's a victory.",
            "Strong": "You're already stronger than you were yesterday. That counts."
        }
        
        poems = poem_templates.get(primary, poem_templates["Peaceful"])
        tips = tip_templates.get(primary, tip_templates["Peaceful"])
        closing = closing_templates.get(primary, "You're exactly where you need to be.")
        
        # Generate tags
        tags = [primary.lower(), secondary.lower() if secondary else "reflection", "mindfulness"]
        if reflection_data.get('risk_flag', 0) > 0:
            tags.append("support")
        
        return EnrichmentContent(
            poems=poems[:3],
            tips=tips[:3],
            closing_line=closing,
            tags=tags[:5],
            voice_config=voice_config
        )
    
    def generate_with_llm(self, reflection_data: Dict, llm_client) -> EnrichmentContent:
        """
        Generate enrichment content using LLM
        
        Args:
            reflection_data: Reflection data dict
            llm_client: LLM client (OpenAI, Anthropic, etc.)
        
        Returns:
            EnrichmentContent object
        """
        prompt = self.generate_prompt(reflection_data)
        
        # Call LLM (pseudo-code, replace with actual API)
        # response = llm_client.generate(prompt, temperature=0.7, max_tokens=800)
        # content = json.loads(response)
        
        # For now, return mock
        return self.generate_mock(reflection_data)
    
    def validate_style(self, content: EnrichmentContent) -> Tuple[bool, float, List[str]]:
        """
        Validate generated content against style guidelines
        
        Returns:
            (passes_gate, score, violations)
        """
        violations = []
        score = 100.0
        
        # Check poem count
        if len(content.poems) != 3:
            violations.append(f"Expected 3 poems, got {len(content.poems)}")
            score -= 20
        
        # Check poem length (3-4 lines)
        for i, poem in enumerate(content.poems):
            line_count = poem.count('\n') + 1
            if line_count < 3 or line_count > 4:
                violations.append(f"Poem {i+1}: Expected 3-4 lines, got {line_count}")
                score -= 10
        
        # Check tips count (≤3)
        if len(content.tips) > 3:
            violations.append(f"Too many tips: {len(content.tips)} (max 3)")
            score -= 15
        
        # Check for therapy speak / banned phrases
        banned_phrases = [
            "self-care", "journey", "healing process", "toxic",
            "trigger warning", "safe space", "mental health professional",
            "crisis hotline", "emergency services", "seek immediate help"
        ]
        
        all_text = ' '.join(content.poems + content.tips + [content.closing_line]).lower()
        
        for phrase in banned_phrases:
            if phrase in all_text:
                violations.append(f"Contains banned phrase: '{phrase}'")
                score -= 15
        
        # Check tags count (3-5)
        if len(content.tags) < 3 or len(content.tags) > 5:
            violations.append(f"Expected 3-5 tags, got {len(content.tags)}")
            score -= 10
        
        passes_gate = score >= 90.0
        
        return passes_gate, score, violations


def main():
    """Demo/test the empathy generator"""
    
    generator = EmpathyGenerator()
    
    # Test reflection
    reflection = {
        'text': "Today was overwhelming. Felt like I was drowning in tasks and expectations.",
        'primary': 'Fearful',
        'secondary': 'Overwhelmed',
        'valence': 0.25,
        'arousal': 0.75,
        'risk_flag': 0
    }
    
    print("="*60)
    print("EMPATHY GENERATOR TEST")
    print("="*60)
    
    print(f"\nReflection: {reflection['text']}")
    print(f"Emotion: {reflection['primary']} → {reflection['secondary']}")
    
    # Generate content
    content = generator.generate_mock(reflection)
    
    print(f"\n--- GENERATED CONTENT ---")
    print(f"\nVoice: {content.voice_config['voice']}, Tempo: {content.voice_config['tempo']}")
    
    print(f"\nPoems:")
    for i, poem in enumerate(content.poems, 1):
        print(f"\n{i}.")
        print(poem)
    
    print(f"\nTips:")
    for i, tip in enumerate(content.tips, 1):
        print(f"{i}. {tip}")
    
    print(f"\nClosing: {content.closing_line}")
    print(f"\nTags: {', '.join(content.tags)}")
    
    # Validate
    passes, score, violations = generator.validate_style(content)
    
    print(f"\n--- STYLE VALIDATION ---")
    print(f"Score: {score:.1f}/100")
    print(f"Gate: {'PASS ✓' if passes else 'FAIL ✗'}")
    
    if violations:
        print(f"\nViolations:")
        for v in violations:
            print(f"  - {v}")
    
    # Show LLM prompt
    print(f"\n--- LLM PROMPT (for production) ---")
    prompt = generator.generate_prompt(reflection)
    print(prompt)


if __name__ == "__main__":
    main()
