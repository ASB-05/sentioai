from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline
from deepface import DeepFace
import os
import logging
import requests
import json
import cv2
import numpy as np

# --- CONFIGURATION ---
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# IMPORTANT: Set your Gemini API Key here if you are not using a free model.
GEMINI_API_KEY = "" 
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key={GEMINI_API_KEY}"

# --- MODEL LOADING (Lazy Loading) ---
models = {}

def get_speech_model():
    if "speech" not in models:
        try:
            logging.info("Loading speech emotion recognition model...")
            models["speech"] = pipeline("audio-classification", model="superb/wav2vec2-base-superb-er")
            logging.info("Speech model loaded successfully.")
        except Exception as e:
            logging.error(f"Error loading speech model: {e}", exc_info=True)
            models["speech"] = None
    return models["speech"]

def get_text_emotion_model():
    if "text_emotion" not in models:
        try:
            logging.info("Loading text emotion classification model...")
            models["text_emotion"] = pipeline("text-classification", model="cardiffnlp/twitter-roberta-base-emotion-latest", top_k=None)
            logging.info("Text emotion model loaded successfully.")
        except Exception as e:
            logging.error(f"Error loading text emotion model: {e}", exc_info=True)
            models["text_emotion"] = None
    return models["text_emotion"]

# --- API ENDPOINTS ---

@app.route('/analyze_voice', methods=['POST'])
def analyze_voice():
    # ... (Endpoint remains the same as previous version)
    speech_model = get_speech_model()
    if speech_model is None:
        return jsonify({"error": "Speech analysis model is not available."}), 500
    if 'audio' not in request.files: return jsonify({"error": "No audio file part"}), 400
    audio_file = request.files['audio']
    path = "temp_audio.wav"
    audio_file.save(path)
    try:
        result = speech_model(path)
    finally:
        os.remove(path)
    return jsonify(result)

@app.route('/chat_with_emotion', methods=['POST'])
def chat_with_emotion():
    # ... (Endpoint remains the same as previous version)
    text_emotion_model = get_text_emotion_model()
    if text_emotion_model is None:
        return jsonify({"error": "Text emotion model is not available."}), 500
    data = request.get_json()
    user_message = data.get("message")
    if not user_message: return jsonify({"error": "No message provided"}), 400
    try:
        emotion_results = text_emotion_model(user_message)
        dominant_emotion = emotion_results[0][0]['label'] if emotion_results else 'neutral'
    except Exception:
        dominant_emotion = 'neutral'
    tone_map = {'joy': 'cheerful', 'sadness': 'empathetic', 'anger': 'calming', 'optimism': 'upbeat', 'love': 'warm', 'fear': 'reassuring'}
    tone = tone_map.get(dominant_emotion, 'neutral')
    system_prompt = f"You are SentioAI, an emotionally intelligent assistant. Your user feels {dominant_emotion}. Respond in a {tone} tone. Be concise."
    payload = {"contents": [{"parts": [{"text": user_message}]}], "systemInstruction": {"parts": [{"text": system_prompt}]}}
    try:
        response = requests.post(GEMINI_API_URL, headers={'Content-Type': 'application/json'}, data=json.dumps(payload))
        response.raise_for_status()
        result = response.json()
        bot_response_text = result.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "I'm not sure how to respond.")
    except Exception as e:
        logging.error(f"Gemini API Error: {e}")
        bot_response_text = "I'm having trouble connecting right now."
    return jsonify({"bot_response": bot_response_text, "detected_emotion": dominant_emotion})

@app.route('/analyze_face', methods=['POST'])
def analyze_face():
    if 'image' not in request.files:
        return jsonify({"error": "No image file part"}), 400
    
    file = request.files['image']
    
    # Read image file in memory
    filestr = file.read()
    npimg = np.frombuffer(filestr, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    try:
        # DeepFace analysis
        analysis = DeepFace.analyze(
            img_path=img,
            actions=['emotion'],
            enforce_detection=True # Fails if no face is found
        )
        
        # DeepFace returns a list if multiple faces are found
        if isinstance(analysis, list):
            analysis = analysis[0]

        dominant_emotion = analysis.get("dominant_emotion")
        emotion_scores = analysis.get("emotion")

        logging.info(f"Facial analysis result: {dominant_emotion}")
        
        return jsonify({
            "dominant_emotion": dominant_emotion,
            "emotion_scores": emotion_scores
        })

    except ValueError as e:
        # This error is often raised by DeepFace if no face is detected
        logging.warning(f"Face detection error: {e}")
        return jsonify({"error": "Could not detect a face in the image. Please try again."}), 400
    except Exception as e:
        logging.error(f"An error occurred during face analysis: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred during face analysis."}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

