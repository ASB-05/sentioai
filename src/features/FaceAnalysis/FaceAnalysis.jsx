import React, { useState, useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Camera, Zap, AlertTriangle } from 'lucide-react';
import './FaceAnalysis.css';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

const FLASK_API_URL = 'http://127.0.0.1:5000';

const FaceAnalysis = ({ user, db, onEmotionChange }) => {
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [error, setError] = useState(null);
    const [lastDetected, setLastDetected] = useState(null);
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const intervalRef = useRef(null);

    const startCamera = async () => {
        setError(null);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
                setIsCameraOn(true);
            }
        } catch (err) {
            setError("Could not access the camera. Please ensure permissions are granted.");
            console.error("Camera access error:", err);
        }
    };

    const stopCamera = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraOn(false);
    }, []);

    const captureAndAnalyze = useCallback(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            const formData = new FormData();
            formData.append('image', blob, 'capture.jpg');

            try {
                const res = await axios.post(`${FLASK_API_URL}/analyze_face`, formData);
                const { dominant_emotion, emotion_scores } = res.data;
                setLastDetected(dominant_emotion);
                if (onEmotionChange) {
                    onEmotionChange(dominant_emotion);
                }

                await addDoc(collection(db, "sentio_public_sentiment"), {
                    userId: user.uid,
                    email: user.email,
                    analysisType: 'face',
                    dominantEmotion: dominant_emotion,
                    emotionScores: emotion_scores,
                    createdAt: serverTimestamp(),
                });

            } catch (err) {
                if (err.response && err.response.status === 400) {
                    setError("No face detected. Please position yourself in front of the camera.");
                } else {
                    console.error("Face analysis error:", err);
                }
            }
        }, 'image/jpeg');
    }, [user, db, onEmotionChange]);

    useEffect(() => {
        if (isCameraOn) {
            intervalRef.current = setInterval(captureAndAnalyze, 3000); // Analyze every 3 seconds
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            stopCamera();
        };
    }, [isCameraOn, captureAndAnalyze, stopCamera]);


    return (
        <div className="feature-card face-analysis-container">
            <h1><Camera className="inline-block mr-2" /> Real-time Emotion Detection</h1>
            <p>Allow camera access to analyze your facial expression and detect your current mood.</p>

            <div className="camera-container">
                <video ref={videoRef} className={`camera-view ${isCameraOn ? 'active' : ''}`} />
                {!isCameraOn && (
                    <div className="camera-off-overlay">
                        <Camera size={48} />
                        <p>Camera is off</p>
                    </div>
                )}
            </div>

            <div className="controls">
                <button onClick={isCameraOn ? stopCamera : startCamera} className={`btn ${isCameraOn ? 'btn-stop' : 'btn-start'}`}>
                    {isCameraOn ? 'Stop Camera' : 'Start Camera'}
                </button>
            </div>

            {error && <div className="error-box"><AlertTriangle className="inline-block mr-2" />{error}</div>}

            {lastDetected && isCameraOn && (
                <div className="detected-mood-container">
                    <Zap size={20} className="inline-block mr-2" />
                    Detected Mood: <span className="detected-mood">{lastDetected}</span>
                </div>
            )}
        </div>
    );
};

export default FaceAnalysis;