import React, { useState, useEffect, useCallback } from 'react';
import { Music, Youtube } from 'lucide-react';
import './MoodRecommender.css';


const YOUTUBE_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;
const SPOTIFY_CLIENT_ID = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.REACT_APP_SPOTIFY_CLIENT_SECRET;

const searchTerms = {
    happy: "happy upbeat music",
    sad: "sad comforting songs",
    neutral: "lofi chillhop music",
    angry: "angry rock metal music",
    surprised: "upbeat pop music",
    fearful: "calming relaxing music",
    disgusted: "energetic punk rock"
};

const MoodRecommender = ({ emotion }) => {
    const [platform, setPlatform] = useState('spotify'); // 'spotify' or 'youtube'
    const [spotifyToken, setSpotifyToken] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- Spotify API Authentication ---
    const getSpotifyToken = useCallback(async () => {
        if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
             setError("Spotify API credentials are not set in the .env file.");
             return;
        }
        try {
            const response = await fetch('https://accounts.spotify.com/api/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + btoa(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET)
                },
                body: 'grant_type=client_credentials'
            });
            const data = await response.json();
            if(data.access_token) {
                 setSpotifyToken(data.access_token);
            } else {
                 setError("Failed to authenticate with Spotify.");
            }
        } catch (err) {
            setError("Error authenticating with Spotify.");
            console.error(err);
        }
    }, []);

    useEffect(() => {
        getSpotifyToken();
    }, [getSpotifyToken]);

    // --- Fetching Logic ---
    useEffect(() => {
        if (!emotion) {
            setRecommendations([]);
            return;
        }

        const fetchRecommendations = async () => {
            setIsLoading(true);
            setError(null);
            setRecommendations([]);
            const searchTerm = searchTerms[emotion] || `${emotion} music`;

            if (platform === 'spotify') {
                if (!spotifyToken) {
                    // Don't set an error here, just wait for the token
                    setIsLoading(false);
                    return;
                }
                try {
                    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchTerm)}&type=playlist&limit=6`, {
                        headers: { 'Authorization': `Bearer ${spotifyToken}` }
                    });
                    const data = await response.json();
                    setRecommendations(data.playlists?.items || []);
                } catch (err) {
                    setError("Could not fetch Spotify recommendations.");
                }
            } else if (platform === 'youtube') {
                 if (!YOUTUBE_API_KEY) {
                    setError("YouTube API Key is not set in the .env file.");
                    setIsLoading(false);
                    return;
                }
                try {
                    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=6&q=${encodeURIComponent(searchTerm)}&type=video&key=${YOUTUBE_API_KEY}`);
                    const data = await response.json();
                     if (data.error) {
                        setError(data.error.message || "An error occurred with the YouTube API.");
                    } else {
                        setRecommendations(data.items || []);
                    }
                } catch (err) {
                    setError("Could not fetch YouTube recommendations.");
                }
            }
            setIsLoading(false);
        };

        fetchRecommendations();

    }, [emotion, platform, spotifyToken]);

    return (
        <div className="feature-card mood-recommender">
            <div className="recommender-header">
                <h1>Mood-Based Recommender</h1>
            </div>
            
             <p className="recommendation-prompt">
                {emotion 
                    ? <>Since you seem to be feeling <strong className="emotion-highlight">{emotion}</strong>, we recommend:</>
                    : "Start the Face Analysis to get recommendations!"
                }
            </p>

            {emotion && (
                <div className="platform-toggle">
                    <button onClick={() => setPlatform('spotify')} className={platform === 'spotify' ? 'active' : ''}>
                        <Music className="mr-2" /> Spotify Playlists
                    </button>
                    <button onClick={() => setPlatform('youtube')} className={platform === 'youtube' ? 'active' : ''}>
                        <Youtube className="mr-2" /> YouTube Videos
                    </button>
                </div>
            )}

            {isLoading && <p className="status">Finding recommendations...</p>}
            {error && <p className="status error">{error}</p>}
            
            {!isLoading && !error && emotion && (
                 <div className="results-grid">
                    {/* THIS IS THE FIX: Added a more robust filter for Spotify items */}
                    {platform === 'spotify' && recommendations
                        .filter(item => item && item.external_urls && item.external_urls.spotify && item.images && item.images.length > 0)
                        .map(item => (
                            <div key={item.id} className="result-item spotify">
                                <a href={item.external_urls.spotify} target="_blank" rel="noopener noreferrer">
                                    <img src={item.images[0]?.url} alt={item.name} />
                                    <p>{item.name}</p>
                                </a>
                            </div>
                    ))}

                    {platform === 'youtube' && recommendations
                        .filter(item => item && item.id && item.id.videoId && item.snippet && item.snippet.thumbnails)
                        .map(item => (
                            <div key={item.id.videoId} className="result-item youtube">
                                <a href={`https://www.youtube.com/watch?v=${item.id.videoId}`} target="_blank" rel="noopener noreferrer">
                                    <img src={item.snippet.thumbnails.medium.url} alt={item.snippet.title} />
                                    <p>{item.snippet.title}</p>
                                </a>
                            </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MoodRecommender;

