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
from flask import Response, stream_with_context
from dotenv import load_dotenv 

load_dotenv()
# --- CONFIGURATION ---
logging.basicConfig(level=logging.INFO)
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# --- API KEYS (Replace with your actual keys) ---
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")


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

@app.route('/chat_with_emotion', methods=['POST'])
def chat_with_emotion():
    text_emotion_model = get_text_emotion_model()
    if text_emotion_model is None:
        return jsonify({"error": "Text emotion model is not available."}), 500

    data = request.get_json()
    user_message = data.get("message")
    user_emotion = data.get("emotion", None)


    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    try:
        if not user_emotion:
            emotion_results = text_emotion_model(user_message)
            dominant_emotion = emotion_results[0][0]['label'] if emotion_results else 'neutral'
        else:
            dominant_emotion = user_emotion
    except Exception:
        dominant_emotion = 'neutral'

    tone_map = {
        'joy': 'cheerful and uplifting',
        'sadness': 'empathetic and comforting',
        'anger': 'calm and reassuring',
        'optimism': 'encouraging and upbeat',
        'love': 'warm and affectionate',
        'fear': 'soothing and supportive',
        'happy': 'cheerful and uplifting',
        'sad': 'empathetic and comforting',
        'angry': 'calm and reassuring',

    }
    tone = tone_map.get(dominant_emotion, 'neutral')

    system_prompt = f"You are SentioAI, an emotionally intelligent assistant. Your user is currently feeling {dominant_emotion}. Respond in a {tone} tone. Keep your responses concise and helpful. When the user is feeling sad or angry, try to be extra supportive and provide some motivational words."

    try:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            },
            data=json.dumps({
                "model": "google/gemini-flash-1.5",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ]
            })
        )
        response.raise_for_status()
        result = response.json()
        bot_response_text = result['choices'][0]['message']['content']
    except Exception as e:
        logging.error(f"OpenRouter API Error: {e}")
        bot_response_text = "I'm having trouble connecting right now."


    return jsonify({"bot_response": bot_response_text, "detected_emotion": dominant_emotion})


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
    # This function should cache the token, but for a hackathon, this is fine.
    auth_response = requests.post("https://accounts.spotify.com/api/token", {
        'grant_type': 'client_credentials',
        'client_id': SPOTIFY_CLIENT_ID,
        'client_secret': SPOTIFY_CLIENT_SECRET,
    })
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


@app.route('/chat_with_emotion', methods=['POST'])
def chat_with_emotion():
    # ... (the beginning of your function is the same)
    text_emotion_model = get_text_emotion_model()
    if text_emotion_model is None:
        return jsonify({"error": "Text emotion model is not available."}), 500

    data = request.get_json()
    user_message = data.get("message")
    user_emotion = data.get("emotion", None)

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    try:
        if not user_emotion:
            emotion_results = text_emotion_model(user_message)
            dominant_emotion = emotion_results[0][0]['label'] if emotion_results else 'neutral'
        else:
            dominant_emotion = user_emotion
    except Exception:
        dominant_emotion = 'neutral'
    
    # This part remains the same
    tone_map = {
        'joy': 'cheerful and uplifting', 'sadness': 'empathetic and comforting',
        'anger': 'calm and reassuring', 'optimism': 'encouraging and upbeat',
        'love': 'warm and affectionate', 'fear': 'soothing and supportive',
        'happy': 'cheerful and uplifting', 'sad': 'empathetic and comforting',
        'angry': 'calm and reassuring',
    }
    tone = tone_map.get(dominant_emotion, 'neutral')
    system_prompt = f"You are SentioAI, an emotionally intelligent assistant. Your user is currently feeling {dominant_emotion}. Respond in a {tone} tone. Keep your responses concise and helpful. When the user is feeling sad or angry, try to be extra supportive and provide some motivational words."

    # --- THIS IS THE NEW STREAMING LOGIC ---
    def generate():
        try:
            # Note: Added "stream": True
            response = requests.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"},
                stream=True, # Enable streaming
                data=json.dumps({
                    "model": "google/gemini-flash-1.5",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    "stream": True # The API requires this parameter in the body
                })
            )
            response.raise_for_status()
            
            # Process the stream from the API
            for line in response.iter_lines():
                if line:
                    decoded_line = line.decode('utf-8')
                    if decoded_line.startswith('data: '):
                        json_str = decoded_line[6:]
                        if json_str.strip() == '[DONE]':
                            break
                        try:
                            data = json.loads(json_str)
                            if 'choices' in data and len(data['choices']) > 0:
                                delta = data['choices'][0].get('delta', {})
                                content = delta.get('content')
                                if content:
                                    # Send each piece of content to the frontend
                                    yield content
                        except json.JSONDecodeError:
                            continue # Ignore invalid JSON lines
        except Exception as e:
            logging.error(f"Streaming API Error: {e}")
            yield "I'm having trouble connecting right now."

    # Return a streaming response
    return Response(stream_with_context(generate()), mimetype='text/plain')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)