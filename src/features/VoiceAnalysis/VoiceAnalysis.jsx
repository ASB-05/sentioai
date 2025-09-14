import React, { useState, useRef } from 'react';
import './VoiceAnalysis.css';

// Helper to make labels more readable
const formatEmotionLabel = (label) => {
    const emotionMap = {
        'ang': 'Anger',
        'hap': 'Happy',
        'neu': 'Neutral',
        'sad': 'Sad',
    };
    return emotionMap[label] || label;
};


const VoiceAnalysis = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [audioBlob, setAudioBlob] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);

    const handleStartRecording = () => {
        setAudioBlob(null);
        setAnalysisResult(null);
        setError(null);

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                mediaRecorderRef.current = new MediaRecorder(stream);
                mediaRecorderRef.current.ondataavailable = (event) => {
                    audioChunksRef.current.push(event.data);
                };
                mediaRecorderRef.current.onstop = () => {
                    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
                    setAudioBlob(audioBlob);
                    audioChunksRef.current = [];
                    stream.getTracks().forEach(track => track.stop());
                };
                mediaRecorderRef.current.start();
                setIsRecording(true);
            })
            .catch(err => {
                console.error("Error accessing microphone:", err);
                setError("Could not access the microphone. Please check your browser permissions.");
            });
    };

    const handleStopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
        }
        setIsRecording(false);
    };

    const handleAnalyze = async () => {
        if (!audioBlob) return;

        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.wav");

        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);

        try {
            const response = await fetch('http://localhost:5000/analyze_voice', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to analyze audio.');
            }

            const data = await response.json();
            // The model returns a list of predictions, save the whole list
            if (data && data.length > 0) {
                setAnalysisResult(data);
            } else {
                throw new Error("Analysis returned an empty result.");
            }

        } catch (err) {
            console.error("Error analyzing voice:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="voice-analysis-container">
            <div className="card-header">
                <h2>Voice Emotion Analysis</h2>
                <p>Record your voice to detect the underlying emotions.</p>
            </div>
            <div className="controls">
                <button onClick={handleStartRecording} disabled={isRecording} className="control-button start">
                    {isRecording ? 'Recording...' : 'Start Recording'}
                </button>
                <button onClick={handleStopRecording} disabled={!isRecording} className="control-button stop">
                    Stop Recording
                </button>
                <button onClick={handleAnalyze} disabled={!audioBlob || isLoading} className="control-button analyze">
                    {isLoading ? 'Analyzing...' : 'Analyze Voice'}
                </button>
            </div>
            {audioBlob && !isLoading && (
                <div className="audio-player-container">
                    <audio src={URL.createObjectURL(audioBlob)} controls />
                </div>
            )}
            {error && <p className="error-message">{error}</p>}
            {analysisResult && (
                <div className="analysis-result">
                    <h3>Analysis Result</h3>
                    <p className="dominant-emotion">
                        Dominant Emotion: <strong>{formatEmotionLabel(analysisResult[0].label)}</strong>
                    </p>
                    <div className="emotion-scores-container">
                        {analysisResult.map((emotion) => (
                            <div key={emotion.label} className="emotion-score-item">
                                <span className="emotion-label">{formatEmotionLabel(emotion.label)}</span>
                                <div className="score-bar-container">
                                    <div
                                        className={`score-bar emotion-${emotion.label}`}
                                        style={{ width: `${(emotion.score * 100).toFixed(2)}%` }}
                                    ></div>
                                </div>
                                <span className="emotion-percentage">
                                    {(emotion.score * 100).toFixed(2)}%
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VoiceAnalysis;