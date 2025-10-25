# Image Captioning Service

Local service for converting images into narrative text descriptions using Ollama vision models.

## Features

- Upload images via web interface or drag & drop
- Generates poetic, first-person narrative descriptions
- Uses Ollama's vision models (llava, bakllava, etc.)
- Displays normalized text in terminal
- Customizable prompts for different narrative styles

## Requirements

- Python 3.8+
- Ollama running locally with a vision model installed
- Flask

## Setup

1. **Install Python dependencies:**
```bash
pip install -r requirements.txt
```

2. **Install Ollama vision model:**
```bash
# Install llava (recommended, ~4.5GB)
ollama pull llava:latest

# Or other options:
ollama pull llava:13b        # Larger, more detailed
ollama pull bakllava         # Alternative model
```

3. **Verify Ollama is running:**
```bash
ollama list
```

## Usage

### Start the service:
```bash
python app.py
```

### Access the web interface:
Open browser to: **http://localhost:5050**

### Upload an image:
1. Click or drag & drop an image
2. (Optional) Customize the prompt
3. Click "Generate Narrative"
4. See the narrative text in the terminal and web interface

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5050` | Service port |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `VISION_MODEL` | `llava:latest` | Vision model to use |

Example:
```bash
PORT=8080 VISION_MODEL=llava:13b python app.py
```

## API Endpoints

### `POST /caption`
Upload image and get narrative text

**Form Data:**
- `image`: Image file (required)
- `prompt`: Custom prompt (optional)

**Response:**
```json
{
  "success": true,
  "narrative": "I'm standing at the edge of a quiet lake...",
  "filename": "20251025_143022_photo.jpg",
  "model": "llava:latest"
}
```

### `GET /health`
Health check

**Response:**
```json
{
  "status": "ok",
  "service": "image-captioning",
  "ollama_url": "http://localhost:11434",
  "vision_model": "llava:latest"
}
```

## Default Narrative Style

The service generates first-person, reflective narratives that sound like journal entries:

> *"I'm sitting by the window, watching the rain trace patterns on the glass. There's something peaceful about this gray afternoon, a quiet moment that feels like time has slowed down just for me."*

## Testing Flow

1. Start service: `python app.py`
2. Upload test image from laptop
3. Watch terminal for normalized text output:
```
============================================================
📸 IMAGE UPLOAD
============================================================
File: 20251025_143022_sunset.jpg
Size: 1024567 bytes

🤖 Generating narrative description...

============================================================
✨ NORMALIZED TEXT (Narrative)
============================================================
I'm watching the sun dip below the horizon, painting the
sky in shades of orange and pink. It's one of those moments
that makes you forget about everything else, just pure wonder
at how beautiful the world can be.
============================================================
```

## Notes

- Images are temporarily saved in `uploads/` folder
- Supports: PNG, JPG, JPEG, GIF, WebP, HEIC
- First request may take longer (model loading)
- Narrative length: 2-3 sentences by default

## Troubleshooting

**"Connection refused" error:**
- Ensure Ollama is running: `ollama serve`

**"Model not found" error:**
- Pull the vision model: `ollama pull llava:latest`

**Slow generation:**
- First request loads the model (one-time cost)
- Larger images take longer to process
- Consider using a smaller model for testing
