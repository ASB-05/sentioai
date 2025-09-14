import { useState, useRef, useEffect } from 'react';
import * as faceapi from 'face-api.js';

export const useEmotionDetection = () => {
    const [modelsLoaded, setModelsLoaded] = useState(false);
    const [isDetecting, setIsDetecting] = useState(false);
    const [detectedEmotion, setDetectedEmotion] = useState(null);
    const videoRef = useRef();
    const canvasRef = useRef();
    const intervalRef = useRef();

    // Load face-api models
    useEffect(() => {
        const loadModels = async () => {
            const MODEL_URL = '/models';
            try {
                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
                    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
                    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
                ]);
                setModelsLoaded(true);
                console.log("Models loaded successfully");
            } catch (error) {
                console.error("Error loading models:", error);
            }
        };
        loadModels();
    }, []);

    const startDetection = async () => {
        if (!modelsLoaded) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
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
        setIsDetecting(true);
        intervalRef.current = setInterval(async () => {
            if (canvasRef.current && videoRef.current) {
                canvasRef.current.innerHTML = faceapi.createCanvasFromMedia(videoRef.current);
                const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
                faceapi.matchDimensions(canvasRef.current, displaySize);

                const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions();

                if (detections.length > 0) {
                    const primaryEmotion = detections[0].expressions.asSortedArray()[0].expression;
                    setDetectedEmotion({ name: primaryEmotion });
                } else {
                    setDetectedEmotion(null);
                }
            }
        }, 500);
    };
    
    // Cleanup on unmount
    useEffect(() => {
    return () => {
        const interval = intervalRef.current;
        const video = videoRef.current;

        if (interval) clearInterval(interval);

        if (video && video.srcObject) {
            const stream = video.srcObject;
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
        startDetection,
        stopDetection,
        handleVideoPlay,
    };
};