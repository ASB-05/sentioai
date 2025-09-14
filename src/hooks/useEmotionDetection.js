import { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';

export const useEmotionDetection = () => {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [detectedEmotion, setDetectedEmotion] = useState(null);
    const [loadingError, setLoadingError] = useState(null);
    const videoRef = useRef();
    const canvasRef = useRef();
    const intervalRef = useRef();

    // Load face-api models
    useEffect(() => {
        const loadModels = async () => {
            const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/models';

            try {
                // Check if models exist by trying to load a small file first
                const testLoad = await fetch(`${MODEL_URL}/tiny_face_detector_model-weights_manifest.json`);
                
                if (!testLoad.ok) {
                    throw new Error(`Models not found at ${MODEL_URL}. Please ensure models are in public/models/ directory`);
                }

                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
                ]);
                
                setModelsLoaded(true);
                setLoadingError(null);
                console.log("Models loaded successfully");
            } catch (error) {
                console.error("Error loading models:", error);
                setLoadingError(error.message);
                setModelsLoaded(false);
            }
        };
        
        loadModels();
    }, []);

    const startDetection = async () => {
        if (!modelsLoaded) {
            console.error("Models not loaded yet");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current.play();
                };
            }
        } catch (err) {
            console.error("Error accessing webcam:", err);
        }
    };
    
    const stopDetection = () => {
        setIsDetecting(false);
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    };

    const handleVideoPlay = () => {
        if (!modelsLoaded) return;
        
        setIsDetecting(true);
        intervalRef.current = setInterval(async () => {
            if (canvasRef.current && videoRef.current && videoRef.current.readyState === 4) {
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                context.clearRect(0, 0, canvas.width, canvas.height);
                
                const displaySize = { 
                    width: videoRef.current.videoWidth, 
                    height: videoRef.current.videoHeight 
                };
                
                faceapi.matchDimensions(canvas, displaySize);

                try {
                    const detections = await faceapi
                        .detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
                        .withFaceLandmarks()
                        .withFaceExpressions();

                    if (detections.length > 0) {
                        const primaryEmotion = detections[0].expressions.asSortedArray()[0].expression;
                        setDetectedEmotion({ name: primaryEmotion });
                    } else {
                        setDetectedEmotion(null);
                    }
                } catch (error) {
                    console.error("Detection error:", error);
                }
            }
        }, 500);
    };
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return {
        videoRef,
        canvasRef,
        modelsLoaded,
        isDetecting,
        detectedEmotion,
        loadingError,
        startDetection,
        stopDetection,
        handleVideoPlay,
    };
};