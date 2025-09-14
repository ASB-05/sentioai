import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, Zap, AlertTriangle, UserX } from 'lucide-react';
import './FaceAnalysis.css';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

const MODEL_URL = '/models';

// This is a helper component to display all emotion scores
const EmotionScores = ({ scores }) => {
    if (!scores) return null;
    const sortedScores = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return (
        <div className="scores-container">
            {sortedScores.map(([emotion, score]) => (
                <div key={emotion} className="score-item">
                    <span className="score-label">{emotion}</span>
                    <div className="score-bar-container">
                        <div className="score-bar" style={{ width: `${score * 100}%` }}></div>
                    </div>
                    <span className="score-value">{(score * 100).toFixed(1)}%</span>
                </div>
            ))}
        </div>
    );
};

const FaceAnalysis = ({ user, db, onEmotionChange }) => {
    const [isModelsLoaded, setIsModelsLoaded] = useState(false);
    const [isCameraOn, setIsCameraOn] = useState(false);
    const [error, setError] = useState(null);
    const [detectedEmotion, setDetectedEmotion] = useState(null);
    const [allExpressions, setAllExpressions] = useState(null);
    const videoRef = useRef(null);
    const intervalRef = useRef(null);

    useEffect(() => {
        const loadModels = async () => {
            try {
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
                ]);
                setIsModelsLoaded(true);
            } catch (e) {
                setError("Failed to load AI models.");
                console.error("Error loading models:", e);
            }
        };
        loadModels();
    }, []);
    
    const startDetection = () => {
        setIsCameraOn(true);
        intervalRef.current = setInterval(async () => {
            if (videoRef.current && !videoRef.current.paused) {
                const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
                
                if (detections.length > 0) {
                    const expressions = detections[0].expressions;
                    setAllExpressions(expressions);
                    const dominantEmotion = Object.keys(expressions).reduce((a, b) => expressions[a] > expressions[b] ? a : b);
                    
                    setDetectedEmotion(dominantEmotion);
                    onEmotionChange(dominantEmotion); // Continuously update parent

                    // For efficiency, you might only want to write to the database on change.
                    // Or remove this check if you want every detection saved.
                    if (dominantEmotion !== detectedEmotion) {
                         const plainEmotionScores = { neutral: expressions.neutral, happy: expressions.happy, sad: expressions.sad, angry: expressions.angry, fearful: expressions.fearful, disgusted: expressions.disgusted, surprised: expressions.surprised };
                        addDoc(collection(db, "sentio_public_sentiment"), {
                            userId: user.uid, email: user.email, analysisType: 'face_in_browser',
                            dominantEmotion: dominantEmotion, emotionScores: plainEmotionScores,
                            createdAt: serverTimestamp(),
                        });
                    }
                } else {
                    // --- THIS IS THE FIX ---
                    // No face was detected, so reset the state.
                    setDetectedEmotion(null);
                    setAllExpressions(null);
                }
            }
        }, 1500);
    };

    const startCamera = async () => {
        setError(null);
        if (!isModelsLoaded) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play().then(startDetection).catch(e => console.error("Video play failed:", e));
                };
            }
        } catch (err) {
            setError("Could not access camera. Please grant permission.");
            console.error("Camera access error:", err);
        }
    };
    
    const stopCamera = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        if (videoRef.current && videoRef.current.srcObject) {
            videoRef.current.srcObject.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsCameraOn(false);
        setDetectedEmotion(null);
        setAllExpressions(null);
    }, []);

    useEffect(() => {
        return () => stopCamera();
    }, [stopCamera]);

    return (
        <div className="feature-card face-analysis-container">
            <h1><Camera className="inline-block mr-2" /> Real-time Emotion Detection</h1>
            <p>Allow camera access to analyze your facial expression. Runs entirely in your browser!</p>

            <div className="camera-container">
                <video ref={videoRef} className={`camera-view ${isCameraOn ? 'active' : ''}`} muted playsInline />
                {!isCameraOn && (
                    <div className="camera-off-overlay">
                        <Camera size={48} />
                        <p>{isModelsLoaded ? "Camera is off" : "Loading AI Models..."}</p>
                    </div>
                )}
            </div>

            <div className="controls">
                <button onClick={isCameraOn ? stopCamera : startCamera} className={`btn ${isCameraOn ? 'btn-stop' : 'btn-start'}`} disabled={!isModelsLoaded}>
                    {isCameraOn ? 'Stop Camera' : 'Start Camera'}
                </button>
            </div>

            {error && <div className="error-box"><AlertTriangle className="inline-block mr-2" />{error}</div>}

            {isCameraOn && (
                <div className="detected-mood-container">
                    {detectedEmotion ? (
                        <>
                            <Zap size={20} className="inline-block mr-2" />
                            Detected Mood: <span className="detected-mood">{detectedEmotion}</span>
                        </>
                    ) : (
                        <span className="no-face-detected">
                            <UserX size={20} className="inline-block mr-2" />
                            Searching for face...
                        </span>
                    )}
                </div>
            )}
            
            {isCameraOn && <EmotionScores scores={allExpressions} />}
        </div>
    );
};

export default FaceAnalysis;