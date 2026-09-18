# backend/app.py
import os
import sys
import tempfile
import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS

# Ensure we can find other modules in the same directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from isl_nlp import text_to_hamnosys

app = Flask(__name__)
CORS(app)  # Enable cross-origin requests for frontend

# --- Whisper model (lazy load to avoid crash if not installed) ---
whisper_model = None

# --- Translation model (lazy load) ---
translation_pipeline = None

def get_whisper_model():
    global whisper_model
    if whisper_model is None:
        try:
            import whisper
            print("⏳ Loading Whisper model (first time may download ~140MB)...")
            whisper_model = whisper.load_model("base")
            print("✅ Whisper model loaded.")
        except ImportError:
            print("⚠ OpenAI Whisper not installed. Speech recognition disabled.")
            print("  Install with: pip install openai-whisper")
        except Exception as e:
            print(f"⚠ Whisper load error: {e}")
    return whisper_model


def get_translation_pipeline():
    """
    Load translation pipeline for text translation (any language to English)
    Uses facebook/nllb-200-distilled-600M for multilingual support
    """
    global translation_pipeline
    if translation_pipeline is None:
        try:
            from transformers import pipeline
            print("⏳ Loading translation model (first time may download ~600MB)...")
            # Using NLLB (No Language Left Behind) - supports 200+ languages
            translation_pipeline = pipeline(
                "translation",
                model="facebook/nllb-200-distilled-600M",
                device=-1  # Use CPU, set to 0 for GPU
            )
            print("✅ Translation model loaded.")
        except ImportError:
            print("⚠ Transformers library not installed. Text translation disabled.")
            print("  Install with: pip install transformers sentencepiece")
        except Exception as e:
            print(f"⚠ Translation model load error: {e}")
    return translation_pipeline


def convert_audio_to_wav(input_path):
    """
    Convert audio file to WAV format for Whisper compatibility.
    Tries: 1) ffmpeg CLI  2) pydub  3) direct Whisper (it has its own ffmpeg bindings)
    """
    output_path = input_path.rsplit('.', 1)[0] + '.wav'
    
    # Method 1: Try ffmpeg CLI
    try:
        result = subprocess.run(
            ['ffmpeg', '-y', '-i', input_path,
             '-acodec', 'pcm_s16le', '-ar', '16000', '-ac', '1',
             output_path],
            stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            timeout=30
        )
        if result.returncode == 0 and os.path.exists(output_path):
            print(f"✅ Converted audio to WAV via ffmpeg: {output_path}")
            return output_path
        else:
            stderr_text = result.stderr.decode('utf-8', errors='replace')[:200]
            print(f"⚠ ffmpeg conversion failed: {stderr_text}")
    except FileNotFoundError:
        print("⚠ ffmpeg not found in PATH")
    except subprocess.TimeoutExpired:
        print("⚠ ffmpeg conversion timed out")
    except Exception as e:
        print(f"⚠ ffmpeg error: {e}")

    # Method 2: Try pydub
    try:
        from pydub import AudioSegment
        audio = AudioSegment.from_file(input_path)
        audio = audio.set_frame_rate(16000).set_channels(1).set_sample_width(2)
        audio.export(output_path, format="wav")
        print(f"✅ Converted audio to WAV via pydub: {output_path}")
        return output_path
    except ImportError:
        print("⚠ pydub not installed")
    except Exception as e:
        print(f"⚠ pydub conversion error: {e}")

    # Method 3: Let Whisper try to handle it directly
    # Whisper uses its own ffmpeg bindings internally
    print("⚠ No converter available — passing original file to Whisper")
    return input_path



def detect_and_translate_text(text):
    """
    Detect language and translate to English if needed.
    Uses transformers library for text translation.
    """
    # Simple heuristic: if text contains non-ASCII, it's likely non-English
    is_ascii = all(ord(c) < 128 for c in text)
    
    translator = get_translation_pipeline()
    if translator is None:
        # No translator available, return as-is
        print("⚠ No translation model available, using text as-is")
        return text
    
    # Try to detect if it's English
    # Simple check: common English words
    english_words = ['hello', 'hi', 'thank', 'you', 'i', 'me', 'my', 'the', 'a', 'is', 'are', 'yes', 'no']
    lower_text = text.lower()
    is_likely_english = any(word in lower_text for word in english_words)
    
    if is_likely_english or is_ascii:
        # Likely English, no translation needed
        return text
    
    try:
        # Translate to English
        result = translator(text, src_lang="auto", tgt_lang="eng_Latn")
        translated = result[0]['translation_text']
        print(f"🌐 Translated: '{text}' → '{translated}'")
        return translated
    except Exception as e:
        print(f"⚠ Translation error: {e}")
        return text


@app.route("/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "whisper": whisper_model is not None,
        "translation": translation_pipeline is not None
    })


@app.route("/speech", methods=["POST"])
def speech():
    """
    Endpoint for speech-to-HamNoSys or text-to-HamNoSys with multilingual support.
    
    Flow:
    1. Audio: any language → Whisper (auto-translates to English) → HamNoSys
    2. Text: any language → Translation model → English → HamNoSys

    Accepts:
      - Audio file: form-data key 'audio'
      - Text: form-data key 'text'

    Returns JSON:
      { "text": "...", "hamnosys": "...", "original": "...", "detected_language": "..." }
    """
    try:
        # 1. Handle text input directly
        if "text" in request.form:
            text = request.form["text"].strip()
            if not text:
                return jsonify({"error": "Text input is empty"}), 400
            
            original_text = text
            
            # Translate to English if needed
            english_text = detect_and_translate_text(text)
            
            # Convert to HamNoSys - ensure lowercase for dictionary matching
            text_lower = english_text.lower().strip()
            hamnosys = text_to_hamnosys(text_lower)
            
            print(f"📝 Text: '{original_text}' → English: '{english_text}' → HamNoSys: '{hamnosys}'")
            
            return jsonify({
                "text": text_lower,
                "hamnosys": hamnosys,
                "original": original_text if original_text != english_text else None
            })

        # 2. Handle audio input
        if "audio" in request.files:
            model = get_whisper_model()
            if model is None:
                return jsonify({"error": "Whisper model not available"}), 503

            audio_file = request.files["audio"]
            
            # Validate audio file
            if not audio_file or audio_file.filename == '':
                return jsonify({"error": "No audio file provided"}), 400
            
            # Save to a temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
                tmp_path = tmp.name
                audio_file.save(tmp_path)

            try:
                # Convert audio to WAV for better compatibility
                audio_path = convert_audio_to_wav(tmp_path)
                
                # Transcribe with language detection and automatic translation to English
                # Whisper's 'task' parameter can be 'transcribe' (same language) or 'translate' (to English)
                print(f"🎙 Processing audio file: {audio_path}")
                result = model.transcribe(
                    audio_path, 
                    task="translate",  # Auto-translate to English
                    language=None,     # Auto-detect language
                    fp16=False         # Disable FP16 for CPU compatibility
                )
                
                # Whisper automatically translates to English when task="translate"
                text = result["text"].strip()
                detected_lang = result.get("language", "unknown")
                
                if not text:
                    return jsonify({
                        "text": "",
                        "hamnosys": "",
                        "warning": "No speech detected",
                        "detected_language": detected_lang
                    }), 200
                
                # Convert to HamNoSys - ensure lowercase
                text_lower = text.lower().strip()
                hamnosys = text_to_hamnosys(text_lower)
                
                print(f"🎙 Speech ({detected_lang}): '{text}' → HamNoSys: '{hamnosys}'")
                
                return jsonify({
                    "text": text_lower,
                    "hamnosys": hamnosys,
                    "detected_language": detected_lang
                })
            except Exception as e:
                print(f"❌ Transcription error: {e}")
                import traceback
                traceback.print_exc()
                return jsonify({"error": f"Transcription failed: {str(e)}"}), 500
            finally:
                # Clean up temp files
                try:
                    os.unlink(tmp_path)
                    if audio_path != tmp_path and os.path.exists(audio_path):
                        os.unlink(audio_path)
                except OSError as e:
                    print(f"⚠ Could not delete temp file: {e}")

        # 3. No input
        return jsonify({"error": "No input provided. Send 'text' or 'audio'."}), 400
    
    except Exception as e:
        print(f"❌ Unexpected error in /speech endpoint: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Server error: {str(e)}"}), 500


if __name__ == "__main__":
    print("=" * 50)
    print("  Speech-to-ISL Backend Server (Multilingual)")
    print("=" * 50)
    print(f"  Serving at: http://127.0.0.1:5000")
    print(f"  Features:")
    print(f"    - Whisper: Auto-detect & translate any language → English")
    print(f"    - Transformers: Text translation (200+ languages)")
    print(f"    - HamNoSys: English → ISL sign notation")
    print(f"    - Audio: WebM/WAV support with ffmpeg conversion")
    print(f"  Endpoints:")
    print(f"    POST /speech  (text or audio)")
    print(f"    GET  /health  (health check)")
    print("=" * 50)
    app.run(host="127.0.0.1", port=5000, debug=True)
