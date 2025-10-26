#!/usr/bin/env python3
"""
Image Captioning Service - Standalone Local Service
Converts uploaded images into narrative text descriptions using Ollama vision models.

Usage:
    python app.py

Then visit: http://localhost:5050
"""

from flask import Flask, request, jsonify, render_template_string
import base64
import requests
import os
from datetime import datetime

app = Flask(__name__)

# Configuration
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
VISION_MODEL = os.getenv('VISION_MODEL', 'llava:latest')  # or llava:13b, bakllava, etc.
PORT = int(os.getenv('PORT', 5050))

# Upload folder
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Allowed extensions
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'}

def allowed_file(filename):
    """Check if file extension is allowed."""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def encode_image_to_base64(image_path):
    """Encode image file to base64 string."""
    with open(image_path, 'rb') as img_file:
        return base64.b64encode(img_file.read()).decode('utf-8')

def generate_narrative_from_image(image_base64, custom_prompt=None):
    """
    Generate narrative description from image using Ollama vision model.
    
    Args:
        image_base64: Base64 encoded image
        custom_prompt: Optional custom prompt for narrative style
    
    Returns:
        Narrative text description
    """
    # Default prompt for poetic, story-like descriptions (concise)
    if not custom_prompt:
        custom_prompt = """Write 1-2 brief sentences in first person about this image.
Focus on the emotion or moment, not details. Be poetic and minimal."""
    
    payload = {
        'model': VISION_MODEL,
        'prompt': custom_prompt,
        'images': [image_base64],
        'stream': False,
        'options': {
            'temperature': 0.7,
            'num_predict': 150
        }
    }
    
    try:
        print(f"🖼️  Calling Ollama vision model: {VISION_MODEL}")
        print(f"⏱️  This may take 1-2 minutes on first request (model loading)...")
        response = requests.post(
            f'{OLLAMA_BASE_URL}/api/generate',
            json=payload,
            timeout=180  # Increased to 3 minutes for first-time model loading
        )
        response.raise_for_status()
        
        result = response.json()
        narrative = result.get('response', '').strip()
        
        print(f"✅ Narrative generated successfully")
        return narrative
    
    except requests.exceptions.ReadTimeout:
        error_msg = "Request timed out. The vision model may be loading for the first time. Please try again - subsequent requests will be faster."
        print(f"❌ {error_msg}")
        raise Exception(error_msg)
    except Exception as e:
        print(f"❌ Ollama vision error: {e}")
        raise

@app.route('/')
def index():
    """Serve upload interface."""
    html = """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Image to Moment - Leo Testing</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }
            .container {
                background: white;
                border-radius: 20px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                max-width: 600px;
                width: 100%;
                padding: 40px;
            }
            h1 {
                font-size: 28px;
                margin-bottom: 10px;
                color: #333;
            }
            .subtitle {
                color: #666;
                margin-bottom: 30px;
                font-size: 14px;
            }
            .upload-area {
                border: 2px dashed #ddd;
                border-radius: 12px;
                padding: 40px;
                text-align: center;
                margin-bottom: 20px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .upload-area:hover {
                border-color: #667eea;
                background: #f8f9ff;
            }
            .upload-area.dragging {
                border-color: #667eea;
                background: #f0f2ff;
            }
            input[type="file"] {
                display: none;
            }
            .upload-icon {
                font-size: 48px;
                margin-bottom: 10px;
            }
            .upload-text {
                color: #666;
                font-size: 16px;
            }
            .preview-container {
                margin: 20px 0;
                display: none;
            }
            .preview-container img {
                max-width: 100%;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            .prompt-section {
                margin: 20px 0;
            }
            .prompt-section label {
                display: block;
                margin-bottom: 8px;
                color: #333;
                font-weight: 500;
            }
            .prompt-section textarea {
                width: 100%;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 8px;
                font-family: inherit;
                font-size: 14px;
                resize: vertical;
                min-height: 80px;
            }
            .prompt-section textarea:focus {
                outline: none;
                border-color: #667eea;
            }
            button {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border: none;
                padding: 14px 32px;
                border-radius: 8px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                width: 100%;
                transition: transform 0.2s ease;
            }
            button:hover {
                transform: translateY(-2px);
            }
            button:disabled {
                background: #ccc;
                cursor: not-allowed;
                transform: none;
            }
            .result {
                margin-top: 30px;
                padding: 20px;
                background: #f8f9ff;
                border-radius: 8px;
                border-left: 4px solid #667eea;
                display: none;
            }
            .result h3 {
                margin-bottom: 12px;
                color: #333;
                font-size: 18px;
            }
            .result p {
                color: #555;
                line-height: 1.6;
                font-size: 15px;
            }
            .loading {
                display: none;
                text-align: center;
                margin: 20px 0;
            }
            .spinner {
                border: 3px solid #f3f3f3;
                border-top: 3px solid #667eea;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                animation: spin 1s linear infinite;
                margin: 0 auto 10px;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .error {
                background: #fee;
                border-left-color: #e33;
                color: #c33;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>📸 Image to Moment</h1>
            <p class="subtitle">Upload a photo and turn it into a reflective narrative</p>
            
            <div class="upload-area" id="uploadArea">
                <div class="upload-icon">📤</div>
                <div class="upload-text">Click to upload or drag & drop an image</div>
                <input type="file" id="fileInput" accept="image/*" />
            </div>
            
            <div class="preview-container" id="previewContainer">
                <img id="preview" src="" alt="Preview" />
            </div>
            
            <div class="prompt-section">
                <label for="customPrompt">Custom Prompt (Optional)</label>
                <textarea id="customPrompt" placeholder="Leave empty for default narrative style, or customize how you want the image described..."></textarea>
            </div>
            
            <button id="generateBtn" disabled>Generate Narrative</button>
            
            <div class="loading" id="loading">
                <div class="spinner"></div>
                <p>Generating narrative from image...</p>
            </div>
            
            <div class="result" id="result">
                <h3>✨ Narrative Text</h3>
                <p id="narrativeText"></p>
            </div>
        </div>
        
        <script>
            const uploadArea = document.getElementById('uploadArea');
            const fileInput = document.getElementById('fileInput');
            const previewContainer = document.getElementById('previewContainer');
            const preview = document.getElementById('preview');
            const generateBtn = document.getElementById('generateBtn');
            const loading = document.getElementById('loading');
            const result = document.getElementById('result');
            const narrativeText = document.getElementById('narrativeText');
            const customPrompt = document.getElementById('customPrompt');
            
            let selectedFile = null;
            
            // Click to upload
            uploadArea.addEventListener('click', () => fileInput.click());
            
            // File selection
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) handleFile(file);
            });
            
            // Drag and drop
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragging');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragging');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragging');
                const file = e.dataTransfer.files[0];
                if (file && file.type.startsWith('image/')) {
                    handleFile(file);
                }
            });
            
            function handleFile(file) {
                selectedFile = file;
                
                // Show preview
                const reader = new FileReader();
                reader.onload = (e) => {
                    preview.src = e.target.result;
                    previewContainer.style.display = 'block';
                    generateBtn.disabled = false;
                };
                reader.readAsDataURL(file);
            }
            
            // Generate narrative
            generateBtn.addEventListener('click', async () => {
                if (!selectedFile) return;
                
                const formData = new FormData();
                formData.append('image', selectedFile);
                
                const prompt = customPrompt.value.trim();
                if (prompt) {
                    formData.append('prompt', prompt);
                }
                
                // Show loading
                generateBtn.disabled = true;
                loading.style.display = 'block';
                result.style.display = 'none';
                
                try {
                    const response = await fetch('/caption', {
                        method: 'POST',
                        body: formData
                    });
                    
                    const data = await response.json();
                    
                    if (response.ok) {
                        narrativeText.textContent = data.narrative;
                        result.classList.remove('error');
                        result.style.display = 'block';
                    } else {
                        narrativeText.textContent = data.error || 'Failed to generate narrative';
                        result.classList.add('error');
                        result.style.display = 'block';
                    }
                } catch (error) {
                    narrativeText.textContent = 'Network error: ' + error.message;
                    result.classList.add('error');
                    result.style.display = 'block';
                } finally {
                    loading.style.display = 'none';
                    generateBtn.disabled = false;
                }
            });
        </script>
    </body>
    </html>
    """
    return render_template_string(html)

@app.route('/caption', methods=['POST'])
def caption_image():
    """
    Upload image and generate narrative description.
    
    Form fields:
        - image: Image file
        - prompt: Optional custom prompt
    
    Returns:
        JSON with narrative text
    """
    try:
        # Validate request
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': f'Invalid file type. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'}), 400
        
        # Save file temporarily
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"{timestamp}_{file.filename}"
        filepath = os.path.join(UPLOAD_FOLDER, filename)
        file.save(filepath)
        
        print(f"\n{'='*60}")
        print(f"📸 IMAGE UPLOAD")
        print(f"{'='*60}")
        print(f"File: {filename}")
        print(f"Size: {os.path.getsize(filepath)} bytes")
        
        # Encode image to base64
        image_base64 = encode_image_to_base64(filepath)
        
        # Get custom prompt if provided
        custom_prompt = request.form.get('prompt', None)
        
        # Generate narrative
        print(f"\n🤖 Generating narrative description...")
        narrative = generate_narrative_from_image(image_base64, custom_prompt)
        
        print(f"\n{'='*60}")
        print(f"✨ NORMALIZED TEXT (Narrative)")
        print(f"{'='*60}")
        print(f"{narrative}")
        print(f"{'='*60}\n")
        
        # Optional: Clean up uploaded file
        # os.remove(filepath)
        
        return jsonify({
            'success': True,
            'narrative': narrative,
            'filename': filename,
            'model': VISION_MODEL
        })
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/caption-base64', methods=['POST'])
def caption_base64():
    """
    Generate narrative from base64 image (for worker).
    Expects JSON: { "image_base64": "..." }
    """
    try:
        data = request.get_json()
        
        if not data or 'image_base64' not in data:
            return jsonify({'error': 'Missing image_base64 in request body'}), 400
        
        image_base64 = data['image_base64']
        custom_prompt = data.get('prompt', None)
        
        print(f"\n{'='*60}")
        print(f"📸 BASE64 IMAGE CAPTION REQUEST")
        print(f"{'='*60}")
        print(f"Base64 length: {len(image_base64)} chars")
        
        # Generate narrative
        print(f"\n🤖 Generating narrative description...")
        narrative = generate_narrative_from_image(image_base64, custom_prompt)
        
        print(f"\n{'='*60}")
        print(f"✨ NARRATIVE GENERATED")
        print(f"{'='*60}")
        print(f"{narrative}")
        print(f"{'='*60}\n")
        
        return jsonify({
            'success': True,
            'narrative': narrative,
            'model': VISION_MODEL
        })
    
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'ok',
        'service': 'image-captioning',
        'ollama_url': OLLAMA_BASE_URL,
        'vision_model': VISION_MODEL
    })

if __name__ == '__main__':
    print(f"\n{'='*60}")
    print(f"🚀 IMAGE CAPTIONING SERVICE")
    print(f"{'='*60}")
    print(f"Port: {PORT}")
    print(f"Ollama: {OLLAMA_BASE_URL}")
    print(f"Model: {VISION_MODEL}")
    print(f"\n📍 Visit: http://localhost:{PORT}")
    print(f"{'='*60}\n")
    
    app.run(host='0.0.0.0', port=PORT, debug=True)
