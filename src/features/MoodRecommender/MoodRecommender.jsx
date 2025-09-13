import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Music, Youtube, Quote } from 'lucide-react';
import './MoodRecommender.css';

const FLASK_API_URL = 'http://127.0.0.1:5000';

const MoodRecommender = () => {
    const [mood, setMood] = useState('joy');
    const [recommendations, setRecommendations] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchRecommendations = async () => {
            setIsLoading(true);
            try {
                const res = await axios.post(`${FLASK_API_URL}/recommend`, { mood });
                setRecommendations(res.data);
            } catch (error) {
                console.error("Error fetching recommendations:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchRecommendations();
    }, [mood]);

    return (
        <div className="feature-card">
             <h1><Music className="inline-block mr-2" /> Mood-Driven Recommender</h1>
             <p>Select your current mood to get curated content recommendations.</p>
             <div className="mood-selector">
                <select value={mood} onChange={e => setMood(e.target.value)}>
                    <option value="joy">😊 Joyful</option>
                    <option value="sadness">😢 Sad</option>
                    <option value="anger">😠 Angry</option>
                    <option value="optimism">🙂 Optimistic</option>
                </select>
             </div>
             {isLoading ? <p>Loading recommendations...</p> : recommendations && (
                 <div className="recommendations-grid">
                    <div className="rec-card">
                        <h3><Music size={20} className="inline-block mr-2" /> Music</h3>
                        <p><strong>{recommendations.music.title}</strong> by {recommendations.music.artist}</p>
                        <a href={recommendations.music.link} target="_blank" rel="noopener noreferrer" className="btn btn-rec">Listen</a>
                    </div>
                    <div className="rec-card">
                        <h3><Youtube size={20} className="inline-block mr-2" /> Video</h3>
                        <p><strong>{recommendations.video.title}</strong></p>
                        <a href={recommendations.video.link} target="_blank" rel="noopener noreferrer" className="btn btn-rec">Watch</a>
                    </div>
                    <div className="rec-card">
                        <h3><Quote size={20} className="inline-block mr-2" /> Quote</h3>
                        <p>"{recommendations.quote.text}"</p>
                        <footer>- {recommendations.quote.author}</footer>
                    </div>
                 </div>
             )}
        </div>
    );
};

export default MoodRecommender;