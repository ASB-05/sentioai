import React, { useState, useEffect } from 'react';
import { Music, Video, VideoOff } from 'lucide-react';
import './MoodRecommender.css';
import { useEmotionDetection } from '../../hooks/useEmotionDetection';

const moodPlaylists = {
    happy: { id: '37i9dQZF1DX3rxVfibe1L0', name: 'Happy Hits!' },
    sad: { id: '37i9dQZF1DX7qK8ma5wgG1', name: 'Sad Indie' },
    neutral: { id: '37i9dQZF1DX4sWSpwq3LiO', name: 'Lofi Beats' },
    angry: { id: '37i9dQZF1DWX83zEwxtool', name: 'Rock Anthems' },
    surprised: { id: '37i9dQZF1DX2d2cf3gM7LE', name: 'Pop Rising' },
    fearful: { id: '37i9dQZF1DWZrc3MOf54p6', name: 'Calming Acoustic' },
    disgusted: { id: '37i9dQZF1DWYBO1MoTDLJ3', name: 'Punk Essentials' }
};

const MoodRecommender = () => { 
    const [activePlaylist, setActivePlaylist] = useState(null);
    const {
        videoRef,
        canvasRef,
        modelsLoaded,
        isDetecting,
        detectedEmotion,
        startDetection,
        stopDetection,
        handleVideoPlay,
    } = useEmotionDetection();

    useEffect(() => {
        if (detectedEmotion && moodPlaylists[detectedEmotion.name]) {
            setActivePlaylist(moodPlaylists[detectedEmotion.name]);
        } else {
            setActivePlaylist(null);
        }
    }, [detectedEmotion]); // Effect now depends on the emotion from our hook

    // Cleanup when component unmounts
    useEffect(() => {
        return () => stopDetection();
    }, [stopDetection]);

    const handleToggleDetection = () => {
        if (isDetecting) {
            stopDetection();
        } else {
            startDetection();
        }
    };
    
    return (
        <div className="feature-card mood-recommender">
            <div className="recommender-header">
                <Music size={28} />
                <h1>Mood-Based Song Recommender</h1>
            </div>

            <div className="detection-controls">
                <button onClick={handleToggleDetection} className={`btn ${isDetecting ? 'btn-stop' : 'btn-start'}`} disabled={!modelsLoaded}>
                    {isDetecting ? <VideoOff className="mr-2" /> : <Video className="mr-2" />}
                    {isDetecting ? 'Stop Camera' : 'Start Camera to Detect Mood'}
                </button>
                {!modelsLoaded && <p className="status">Loading AI models, please wait...</p>}
            </div>

            {isDetecting && (
                <div className="video-container-recommender">
                    <video ref={videoRef} onPlay={handleVideoPlay} autoPlay muted playsInline />
                    <canvas ref={canvasRef} />
                </div>
            )}
            
            {detectedEmotion && activePlaylist ? (
                <div className="playlist-container">
                    <p>You seem to be feeling <strong className="emotion-highlight">{detectedEmotion.name}</strong>. We recommend:</p>
                    <h2>{activePlaylist.name}</h2>
                    <div className="spotify-embed">
                        <iframe
                            key={activePlaylist.id} // Add key to force re-render on playlist change
                            title="Spotify Playlist"
                            src={`https://open.spotify.com/embed/playlist/${activePlaylist.id}?utm_source=generator&theme=0`}
                            width="100%"
                            height="352"
                            frameBorder="0"
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                        ></iframe>
                    </div>
                </div>
            ) : isDetecting && (
                <p className="status">Point the camera at your face...</p>
            )}
        </div>
    );
};

export default MoodRecommender;