from flask import Flask, request, jsonify
from flask_cors import CORS
from transformers import pipeline
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)
# Configure CORS to be more specific, allowing requests from any origin.
# For production, you would want to restrict this to your frontend's domain.
CORS(app, resources={r"/*": {"origins": "*"}})


# Load Hugging Face speech emotion recognition model
# This will download the model on the first run, which might take a few minutes.
speech_model = None
try:
    logging.info("Loading speech emotion recognition model...")
    # FIX: Removed the invalid 'revision' parameter
    speech_model = pipeline("audio-classification", model="superb/wav2vec2-base-superb-er")
    logging.info("Model loaded successfully.")
except Exception as e:
    logging.error(f"Error loading model: {e}", exc_info=True)
    # The app will still run, but the endpoint will return an error.


@app.route('/analyze_voice', methods=['POST', 'OPTIONS'])
def analyze_voice():
    """
    Analyzes the emotion from an uploaded audio file.
    Handles POST for the actual request and OPTIONS for CORS preflight.
    """
    if request.method == 'OPTIONS':
        # Preflight request. Reply successfully:
        return "", 200

    if speech_model is None:
        logging.error("Request received but model is not available.")
        return jsonify({"error": "Speech analysis model failed to load on the server."}), 500
        
    try:
        if 'audio' not in request.files:
            logging.warning("Request received without audio file part.")
            return jsonify({"error": "No audio file part in the request"}), 400

        audio_file = request.files['audio']

        if audio_file.filename == '':
            logging.warning("Request received with an empty audio filename.")
            return jsonify({"error": "No selected audio file"}), 400

        # Create a temporary path to save the audio file
        path = "temp_audio.wav"
        audio_file.save(path)

        # Run prediction on the saved audio file
        logging.info(f"Analyzing audio file: {path}")
        result = speech_model(path)
        logging.info(f"Analysis result: {result}")

        # Clean up the temporary file
        os.remove(path)

        return jsonify(result)

    except Exception as e:
        logging.error(f"An error occurred during voice analysis: {e}", exc_info=True)
        return jsonify({"error": "An internal server error occurred during analysis."}), 500


if __name__ == '__main__':
    # Using port 5000 and making it accessible on the network
    app.run(host='0.0.0.0', port=5000, debug=True)
