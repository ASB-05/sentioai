from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS
from transformers import pipeline
from deepface import DeepFace
import os
import logging
import requests
import json
import cv2
import numpy as np
import base64
from dotenv import load_dotenv

load_dotenv()
# --- CONFIGURATION ---
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# --- API KEYS (Replace with your actual keys) ---
from flask import Flask, request, jsonify, Response, stream_with_context
import os, logging, requests, json
GEMINI_API_KEY = os.getenv("REACT_APP_GEMINI_API_KEY")
YOUTUBE_API_KEY = os.getenv("REACT_APP_YOUTUBE_API_KEY")
SPOTIFY_CLIENT_ID = os.getenv("REACT_APP_SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("REACT_APP_SPOTIFY_CLIENT_SECRET")

print("Gemini Key Loaded:", GEMINI_API_KEY)

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
    speech_model = get_speech_model()
    if speech_model is None:
        return jsonify({"error": "Speech analysis model is not available."}), 500
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file part"}), 400
    audio_file = request.files['audio']
    path = "temp_audio.wav"
    audio_file.save(path)
    try:
        result = speech_model(path)
    finally:
        if os.path.exists(path):
            os.remove(path)
    return jsonify(result)

@app.route("/chat_with_emotion", methods=["POST"])
def chat_with_emotion():
    data = request.json
    user_message = data.get("message", "")
    emotion = data.get("emotion", "neutral")

    system_prompt = f"You are an emotion-adaptive chatbot. The user is currently feeling {emotion}. Respond with empathy."

    def generate():
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?key={GEMINI_API_KEY}"

            payload = {
                "contents": [
                    {
                        "role": "user",
                        "parts": [{"text": f"{system_prompt}\n\n{user_message}"}]
                    }
                ]
            }

            with requests.post(url, json=payload, stream=True) as r:
                r.raise_for_status()

                for line in r.iter_lines():
                    if not line:
                        continue
                    try:
                        obj = json.loads(line.decode("utf-8"))
                        if "candidates" in obj:
                            parts = obj["candidates"][0]["content"]["parts"]
                            if parts and "text" in parts[0]:
                                yield parts[0]["text"]
                    except Exception as e:
                        logging.error(f"Parse error: {e}")
                        continue
        except Exception as e:
            logging.error(f"Gemini API streaming error: {e}")
            yield "I'm having trouble connecting right now."
        finally:
            yield "[DONE]"

    return Response(stream_with_context(generate()), mimetype="text/plain")


@app.route('/analyze_face', methods=['POST'])
def analyze_face():
    if 'image' not in request.files:
        return jsonify({"error": "No image file part"}), 400
    
    file = request.files['image']
    
    filestr = file.read()
    npimg = np.frombuffer(filestr, np.uint8)
    img = cv2.imdecode(npimg, cv2.IMREAD_COLOR)

    try:
        analysis = DeepFace.analyze(
            img_path=img,
            actions=['emotion'],
            enforce_detection=True,
            detector_backend='retinaface'
        )
        
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
        logging.warning(f"Face detection error: {e}")
        return jsonify({"error": "Could not detect a face in the image. Please try again."}), 400
    except Exception as e:
        logging.error(f"An error occurred during face analysis: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred during face analysis."}), 500


def get_spotify_token():
    auth_string = f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}"
    auth_encoded = base64.b64encode(auth_string.encode()).decode()
    auth_response = requests.post(
        "https://accounts.spotify.com/api/token",
        headers={"Authorization": f"Basic {auth_encoded}"},
        data={"grant_type": "client_credentials"}
    )
    auth_response.raise_for_status()
    auth_response_data = auth_response.json()
    return auth_response_data.get('access_token')

@app.route('/recommend', methods=['POST'])
def recommend():
    data = request.get_json()
    mood = data.get("mood")
    if not mood:
        return jsonify({"error": "Mood not provided"}), 400

    recommendations = {}

    # YouTube Recommendations
    try:
        yt_query_map = {
            'joy': 'happy uplifting music', 'sadness': 'comforting calming music',
            'anger': 'calming meditation music', 'optimism': 'motivational videos',
            'happy': 'happy uplifting music', 'sad': 'comforting calming music',
            'angry': 'calming meditation music',
        }
        yt_query = yt_query_map.get(mood, 'popular music')
        yt_res = requests.get(
            f"https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q={yt_query}&key={YOUTUBE_API_KEY}"
        ).json()
        video_id = yt_res['items'][0]['id']['videoId']
        recommendations['video'] = {
            "title": yt_res['items'][0]['snippet']['title'],
            "link": f"https://www.youtube.com/watch?v={video_id}",
            "videoId": video_id
        }
    except Exception as e:
        logging.error(f"YouTube API Error: {e}")
        recommendations['video'] = {"title": "Could not fetch video", "link": "#"}

    # Spotify Recommendations
    try:
        token = get_spotify_token()
        headers = {'Authorization': f'Bearer {token}'}
        spotify_query_map = {
            'joy': 'happy', 'sadness': 'sad', 'anger': 'chill', 'optimism': 'empowering',
            'happy': 'happy', 'sad': 'sad', 'angry': 'chill',
        }
        spotify_query = spotify_query_map.get(mood, 'pop')
        spotify_res = requests.get(
            f"https://api.spotify.com/v1/search?q={spotify_query}&type=track&limit=1",
            headers=headers
        ).json()
        track = spotify_res['tracks']['items'][0]
        recommendations['music'] = {
            "title": track['name'],
            "artist": track['artists'][0]['name'],
            "link": track['external_urls']['spotify']
        }
    except Exception as e:
        logging.error(f"Spotify API Error: {e}")
        recommendations['music'] = {"title": "Could not fetch music", "artist": "", "link": "#"}

    # Quote Recommendations (simple, but effective)
    quote_map = {
        'joy': {"text": "The purpose of our lives is to be happy.", "author": "Dalai Lama"},
        'sadness': {"text": "The wound is the place where the Light enters you.", "author": "Rumi"},
        'anger': {"text": "For every minute you remain angry, you give up sixty seconds of peace of mind.", "author": "Ralph Waldo Emerson"},
        'optimism': {"text": "The best way to predict the future is to create it.", "author": "Peter Drucker"},
        'happy': {"text": "The purpose of our lives is to be happy.", "author": "Dalai Lama"},
        'sad': {"text": "The wound is the place where the Light enters you.", "author": "Rumi"},
        'angry': {"text": "For every minute you remain angry, you give up sixty seconds of peace of mind.", "author": "Ralph Waldo Emerson"},
    }
    recommendations['quote'] = quote_map.get(mood, {"text": "Be the change you wish to see in the world.", "author": "Mahatma Gandhi"})


    return jsonify(recommendations)

import gradio as gr

# Emoji map (same as your React app)
emotionEmojiMap = {
    "joy": "😊", "sadness": "😢", "anger": "😠", "optimism": "🙂",
    "love": "❤️", "fear": "😨", "disgust": "🤢", "surprise": "😲", "neutral": "🤖",
    "happy": "😊", "sad": "😢", "angry": "😠",
}

def detect_text_emotion(message):
    """Use HuggingFace model to detect dominant emotion from text"""
    try:
        text_emotion_model = get_text_emotion_model()
        if text_emotion_model:
            results = text_emotion_model(message)
            if results and len(results[0]) > 0:
                return results[0][0]["label"]
    except Exception as e:
        logging.error(f"Emotion detection error: {e}")
    return "neutral"

def gradio_chatbot(message, history=[]):
    # Step 1: Detect emotion
    detected_emotion = detect_text_emotion(message)
    emoji = emotionEmojiMap.get(detected_emotion, "🤖")

    # Step 2: Build system prompt
    system_prompt = f"You are an emotion-adaptive chatbot. The user is currently feeling {detected_emotion}. Respond with empathy."

    try:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"{system_prompt}\n\n{message}"}]
                }
            ]
        }
        r = requests.post(url, json=payload)
        r.raise_for_status()
        obj = r.json()

        reply = obj["candidates"][0]["content"]["parts"][0]["text"]

        # Step 3: Return reply with emotion emoji
        return f"{emoji} {reply}"

    except Exception as e:
        logging.error(f"Gemini API error: {e}")
        return "I'm having trouble connecting right now."

with gr.Blocks() as demo:
    gr.Markdown("## 🌟 Emotion-Adaptive Chatbot (Gradio Demo)")
    chatbot_ui = gr.ChatInterface(fn=gradio_chatbot)

if __name__ == "__main__":
    # Run Flask in one process
    import threading

    def run_flask():
        app.run(host="0.0.0.0", port=5000, debug=True)

    threading.Thread(target=run_flask).start()
    # Run Gradio in another
    demo.launch(server_name="0.0.0.0", server_port=7860)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)