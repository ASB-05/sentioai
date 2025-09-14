import React, { useState, useEffect } from 'react';
import { Music } from 'lucide-react';
import './MoodRecommender.css';

const moodPlaylists = {
    happy: { id: '37i9dQZF1DX3rxVfibe1L0', name: 'Happy Hits!' },
    sad: { id: '37i9dQZF1DX7qK8ma5wgG1', name: 'Sad Indie' },
    neutral: { id: '37i9dQZF1DX4sWSpwq3LiO', name: 'Lofi Beats' },
    angry: { id: '37i9dQZF1DWX83zEwxtool', name: 'Rock Anthems' },
    surprised: { id: '37i9dQZF1DX2d2cf3gM7LE', name: 'Pop Rising' },
    fearful: { id: '37i9dQZF1DWZrc3MOf54p6', name: 'Calming Acoustic' },
    disgusted: { id: '37i9dQZF1DWYBO1MoTDLJ3', name: 'Punk Essentials' }
};

const MoodRecommender = ({ emotion }) => {
    const [activePlaylist, setActivePlaylist] = useState(null);

    useEffect(() => {
        if (emotion && moodPlaylists[emotion]) {
            setActivePlaylist(moodPlaylists[emotion]);
        } else {
            setActivePlaylist(null);
        }
    }, [emotion]);

    return (
        <div className="feature-card mood-recommender">
            <div className="recommender-header">
                <Music size={28} />
                <h1>Mood-Based Song Recommender</h1>
            </div>

            {emotion && activePlaylist ? (
                <div className="playlist-container">
                    <p>Since you seem to be feeling <strong className="emotion-highlight">{emotion}</strong>, we recommend:</p>
                    <h2>{activePlaylist.name}</h2>
                    <div className="spotify-embed">
                        <iframe
                            key={activePlaylist.id}
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
            ) : (
                <p className="status">Start the Face Analysis to get a song recommendation based on your mood!</p>
            )}
        </div>
    );
};

export default MoodRecommender;