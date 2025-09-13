import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { Mic } from 'lucide-react';
import './VoiceAnalysis.css';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const FLASK_API_URL = 'http://127.0.0.1:5000';

const VoiceAnalysis = ({ user, db, storage }) => {
    const [results, setResults] = useState([]);
    const [error, setError] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState('Idle. Press Start to Record.');

    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const audioContextRef = useRef(null);
    const analyserRef = useRef(null);
    const canvasRef = useRef(null);
    const animationFrameRef = useRef(null);

    const drawVisualization = useCallback(() => {
        if (!analyserRef.current || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const draw = () => {
            animationFrameRef.current = requestAnimationFrame(draw);
            analyserRef.current.getByteTimeDomainData(dataArray);

            ctx.fillStyle = 'rgba(10, 20, 40, 0.8)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#3498db';
            ctx.beginPath();

            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
            }
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
        };
        draw();
    }, []);

    const startRecording = async () => {
        setStatus('Requesting microphone permission...');
        setError(null);
        setResults([]);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            analyserRef.current = audioContextRef.current.createAnalyser();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            source.connect(analyserRef.current);
            drawVisualization();

            mediaRecorderRef.current = new MediaRecorder(stream);
            audioChunksRef.current = [];
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) audioChunksRef.current.push(event.data);
            };
            mediaRecorderRef.current.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                handleStop(audioBlob);
                stream.getTracks().forEach(track => track.stop());
                if (audioContextRef.current) audioContextRef.current.close();
                if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
            };
            mediaRecorderRef.current.start();
            setIsRecording(true);
            setStatus('Recording... Press Stop when finished.');
        } catch (err) {
            setStatus(`Error: ${err.message}. Please allow microphone access.`);
            setError(`Microphone access denied. Please enable it in your browser settings.`);
            setIsRecording(false);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            setStatus('Processing your voice...');
        }
    };

    const handleStop = async (audioBlob) => {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.wav');
        try {
            const res = await axios.post(`${FLASK_API_URL}/analyze_voice`, formData);
            setResults(res.data);
            setStatus('Analysis complete!');

            const fileName = `recordings/${user.uid}/${Date.now()}.wav`;
            const storageRef = ref(storage, fileName);
            await uploadBytes(storageRef, audioBlob);
            const audioUrl = await getDownloadURL(storageRef);
            await addDoc(collection(db, "sentio_public_sentiment"), {
                userId: user.uid,
                email: user.email,
                analysisType: 'voice',
                results: res.data,
                audioUrl: audioUrl,
                createdAt: serverTimestamp(),
            });
        } catch (err) {
            setError(err.response?.data?.error || 'An error occurred during analysis.');
            setStatus('Error during processing.');
        }
    };

    return (
        <div className="feature-card">
            <h1><Mic className="inline-block mr-2"/> Voice Emotion Analysis</h1>
            <p>Analyze the emotion in your voice in real-time. Your voice pitch and energy are visualized below.</p>

            <canvas ref={canvasRef} className="voice-visualizer" width="600" height="100"></canvas>

            <div className="status">{status}</div>
            <div className="controls">
                <button onClick={startRecording} disabled={isRecording} className="btn btn-start">Start Recording</button>
                <button onClick={stopRecording} disabled={!isRecording} className="btn btn-stop">Stop Recording</button>
            </div>
            {error && <div className="error-box">{error}</div>}
            {results.length > 0 && (
                <div className="results-container">
                    <h2>Detailed Analysis:</h2>
                    <div className="results-grid">
                        {results.sort((a, b) => b.score - a.score).map((result) => (
                            <div key={result.label} className="result-item">
                                <div className="label">{result.label}</div>
                                <div className="score-bar-container"><div className="score-bar" style={{ width: `${result.score * 100}%` }}></div></div>
                                <div className="score">{(result.score * 100).toFixed(1)}%</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VoiceAnalysis;