"""
Gradio Demo for Enrichment Pipeline v2.0
HuggingFace Spaces deployment
"""
import gradio as gr
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / 'src'))

from enrich.pipeline import enrich


def mock_hf_probs(text: str) -> dict:
    """Mock HF probabilities based on keywords."""
    text_lower = text.lower()
    
    # Emotion keyword detection
    if any(word in text_lower for word in ['happy', 'great', 'awesome', 'excited', 'love']):
        return {'Happy': 0.6, 'Strong': 0.15, 'Peaceful': 0.1, 'Sad': 0.07, 'Angry': 0.05, 'Fearful': 0.03}
    elif any(word in text_lower for word in ['angry', 'furious', 'annoyed', 'frustrated']):
        return {'Angry': 0.55, 'Fearful': 0.2, 'Sad': 0.1, 'Happy': 0.08, 'Strong': 0.05, 'Peaceful': 0.02}
    elif any(word in text_lower for word in ['sad', 'depressed', 'down', 'upset']):
        return {'Sad': 0.6, 'Fearful': 0.15, 'Angry': 0.1, 'Peaceful': 0.08, 'Happy': 0.05, 'Strong': 0.02}
    elif any(word in text_lower for word in ['afraid', 'scared', 'terrified', 'anxious', 'worried', 'fearful']):
        return {'Fearful': 0.6, 'Sad': 0.15, 'Angry': 0.1, 'Peaceful': 0.08, 'Happy': 0.05, 'Strong': 0.02}
    elif any(word in text_lower for word in ['calm', 'peaceful', 'relaxed', 'content']):
        return {'Peaceful': 0.6, 'Happy': 0.15, 'Strong': 0.1, 'Sad': 0.08, 'Angry': 0.05, 'Fearful': 0.02}
    elif any(word in text_lower for word in ['strong', 'confident', 'powerful', 'capable']):
        return {'Strong': 0.6, 'Happy': 0.15, 'Peaceful': 0.1, 'Fearful': 0.08, 'Angry': 0.05, 'Sad': 0.02}
    else:
        # Default neutral distribution
        return {'Peaceful': 0.3, 'Happy': 0.25, 'Strong': 0.2, 'Sad': 0.1, 'Angry': 0.08, 'Fearful': 0.07}


def mock_embeddings(text: str) -> dict:
    """Mock embeddings for secondary emotions."""
    text_lower = text.lower()
    
    # Return secondary emotions based on keywords
    secondaries = {
        'Joyful': 0.8, 'Grateful': 0.6, 'Proud': 0.5,
        'Calm': 0.4, 'Relieved': 0.3, 'Hopeful': 0.3
    }
    
    return secondaries


def enrich_text(text: str) -> str:
    """Process text through enrichment pipeline."""
    if not text.strip():
        return "Please enter some text to analyze."
    
    try:
        # Mock inputs (in production, these would come from actual models)
        p_hf = mock_hf_probs(text)
        secondary_similarity = mock_embeddings(text)
        driver_scores = {}
        history = []
        user_priors = {'domain': {}, 'control': {}}
        
        # Run enrichment
        result = enrich(text, p_hf, secondary_similarity, driver_scores, history, user_priors)
        
        # Format output
        output = f"""
## Enrichment Results

**Text:** {text}

---

### Emotions
- **Primary:** {result['primary']}
- **Secondary:** {result['secondary']}

### Valence & Arousal
- **Emotion Valence:** {result['valence']:.3f} (0=negative, 1=positive)
- **Event Valence:** {result['event_valence']:.3f} (positivity of event itself)
- **Arousal:** {result['arousal']:.3f} (0=calm, 1=energized)

### Context
- **Domain:** {result['domain']['primary']}
  {f"+ {result['domain']['secondary']} ({result['domain']['mixture_ratio']:.0%} mix)" if result['domain']['secondary'] else ''}
- **Control:** {result['control']} (perceived control over situation)
- **Polarity:** {result['polarity']} (temporal framing)

### Confidence
- **Overall:** {result['confidence']:.3f} ({result['confidence_category']})

### Flags
- **Negation:** {'✓' if result['flags']['negation'] else '✗'}
- **Sarcasm:** {'✓' if result['flags']['sarcasm'] else '✗'}
- **Profanity:** {result['flags']['profanity']}

---

### Feature Highlights
This pipeline uses **rules-based enhancements** without additional LLM calls:
- Negation reversal (3-token window)
- Sarcasm detection (3 patterns)
- Profanity sentiment classification
- Event vs emotion valence separation
- 6-term context rerank formula
- 8-component confidence scoring
"""
        
        return output
        
    except Exception as e:
        return f"Error processing text: {str(e)}\n\nPlease try again with different text."


# Example texts
examples = [
    ["I'm not happy about this delay at all"],
    ["Great, another deadline approaching fast"],
    ["Fuck yeah, I aced that presentation!"],
    ["Got promoted to manager but I'm terrified I can't handle it"],
    ["Got fired from my job, couldn't do anything about it"],
    ["I decided to quit my job and start my own business"],
    ["My mind went haywire right before the presentation"],
]

# Create Gradio interface
demo = gr.Interface(
    fn=enrich_text,
    inputs=gr.Textbox(
        lines=3,
        placeholder="Enter a reflection or emotional moment...",
        label="Your Text"
    ),
    outputs=gr.Markdown(label="Enrichment Analysis"),
    examples=examples,
    title="🧠 Emotion Enrichment Pipeline v2.0",
    description="""
    Analyze emotional text with advanced rules-based enrichment.
    
    **Features:**
    - Negation handling (e.g., "not happy" → Sad)
    - Sarcasm detection (e.g., "Great, another deadline...")
    - Profanity sentiment (positive hype vs negative frustration)
    - Event valence separation (event positivity ≠ emotional response)
    - Control & domain extraction
    - 8-component confidence scoring
    
    *No LLM calls required - all rules-based processing!*
    """,
    theme=gr.themes.Soft(),
    allow_flagging="never"
)

if __name__ == "__main__":
    demo.launch()
