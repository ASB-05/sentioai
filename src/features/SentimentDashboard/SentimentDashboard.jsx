import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, addDoc, serverTimestamp, where } from "firebase/firestore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { BarChart2, Book, Plus, Zap } from 'lucide-react';
import './SentimentDashboard.css';

const SentimentDashboard = ({ db, user }) => {
    const [sentimentData, setSentimentData] = useState([]);
    const [dominantMood, setDominantMood] = useState({ mood: 'N/A', emoji: '📊' });
    const [journalEntry, setJournalEntry] = useState('');
    const [journalEntries, setJournalEntries] = useState([]);
    const [burnedEntries, setBurnedEntries] = useState([]);
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF4757'];

    useEffect(() => {
        const q = query(collection(db, "sentio_public_sentiment"), orderBy("createdAt", "desc"), limit(50));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const data = [];
            const moodCounter = {};

            querySnapshot.forEach((doc) => {
                const docData = doc.data();
                const timestamp = docData.createdAt?.toDate().toLocaleTimeString() || 'N/A';
                
                let emotionLabel = 'neutral';
                let score = 0.5;

                if(docData.analysisType === 'voice' && docData.results.length > 0){
                    const topEmotion = docData.results.reduce((max, e) => e.score > max.score ? e : max);
                    emotionLabel = topEmotion.label;
                    score = topEmotion.score;
                } else if (docData.analysisType === 'chat'){
                    emotionLabel = docData.detectedEmotion;
                    score = 1.0;
                } else if (docData.analysisType === 'face'){
                    emotionLabel = docData.dominantEmotion;
                    score = docData.emotionScores[emotionLabel] / 100;
                } else if (docData.analysisType === 'journal') {
                    emotionLabel = docData.mood;
                    score = 1.0;
                }


                data.unshift({ name: timestamp, emotion: emotionLabel, score });
                moodCounter[emotionLabel] = (moodCounter[emotionLabel] || 0) + 1;
            });

            setSentimentData(data);
            
            if (Object.keys(moodCounter).length > 0) {
                const dominant = Object.keys(moodCounter).reduce((a, b) => moodCounter[a] > moodCounter[b] ? a : b);
                const emojiMap = { joy: '⚡', sadness: '😟', anger: '😡', optimism: '🙂', hap: '😊', ang: '😠', sad: '😢', neu: '😐', happy: '😊' };
                setDominantMood({ mood: dominant, emoji: emojiMap[dominant] || '📊' });
            }
        });

        const journalQuery = query(collection(db, "sentio_public_sentiment"), where("userId", "==", user.uid), where("analysisType", "==", "journal"), orderBy("createdAt", "desc"), limit(10));
        const unsubscribeJournal = onSnapshot(journalQuery, (querySnapshot) => {
            const entries = [];
            querySnapshot.forEach((doc) => {
                entries.push({ id: doc.id, ...doc.data() });
            });
            setJournalEntries(entries);
        });


        return () => {
            unsubscribe();
            unsubscribeJournal();
        };
    }, [db, user]);

    const handleJournalSubmit = async (e) => {
        e.preventDefault();
        if (!journalEntry.trim()) return;

        await addDoc(collection(db, "sentio_public_sentiment"), {
            userId: user.uid,
            email: user.email,
            analysisType: 'journal',
            entry: journalEntry,
            mood: 'journal',
            createdAt: serverTimestamp(),
        });

        setJournalEntry('');

    }

    const handleBurn = (id) => {
        setBurnedEntries(prev => [...prev, id]);
    };

    const pieData = Object.entries(
        sentimentData.reduce((acc, curr) => {
            acc[curr.emotion] = (acc[curr.emotion] || 0) + 1;
            return acc;
        }, {})
    ).map(([name, value]) => ({ name, value }));

    return (
        <div className="feature-card sentiment-dashboard">
            <h1><BarChart2 className="inline-block mr-2" /> Group Sentiment Dashboard</h1>
            <p>Real-time emotional state of all users interacting with SentioAI.</p>
            <div className="dominant-mood-indicator">
                <h2>Dominant Group Mood</h2>
                <div className="mood-display">
                    <span className="mood-emoji">{dominantMood.emoji}</span>
                    <span className="mood-text">{dominantMood.mood}</span>
                </div>
            </div>
            <div className="charts-container">
                <div className="chart-wrapper">
                    <h3>Recent Emotion Timeline</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={sentimentData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.2)" />
                            <XAxis dataKey="name" stroke="rgba(255, 255, 255, 0.7)" />
                            <YAxis domain={[0, 1]} hide={true} />
                            <Tooltip contentStyle={{ backgroundColor: 'rgba(20, 30, 50, 0.9)', border: '1px solid rgba(255, 255, 255, 0.2)' }}/>
                            <Legend />
                            <Line type="monotone" dataKey="score" stroke="#8884d8" name="Emotion Intensity" activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="chart-wrapper">
                     <h3>Emotion Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                            </Pie>
                             <Tooltip contentStyle={{ backgroundColor: 'rgba(20, 30, 50, 0.9)', border: '1px solid rgba(255, 255, 255, 0.2)' }}/>
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="journal-section">
                <h2><Book className="inline-block mr-2"/>My Digital Journal</h2>
                <p>Record your thoughts and feelings. They are only visible to you.</p>
                <form onSubmit={handleJournalSubmit} className="journal-form">
                    <textarea
                        value={journalEntry}
                        onChange={(e) => setJournalEntry(e.target.value)}
                        placeholder="How are you feeling today?"
                        rows="3"
                    ></textarea>
                    <button type="submit" className="btn btn-action"><Plus size={16} /> Add Entry</button>
                </form>
                <div className="journal-entries">
                    <h3>Recent Entries:</h3>
                    {journalEntries.map(entry => (
                        <div key={entry.id} className={`journal-entry ${burnedEntries.includes(entry.id) ? 'burned' : ''}`}>
                            <p className="entry-text">"{entry.entry}"</p>
                            <div className="entry-footer">
                                <p className="entry-date">{entry.createdAt?.toDate().toLocaleString()}</p>
                                <button className="burn-btn" onClick={() => handleBurn(entry.id)}>
                                    <Zap size={16}/> Burn
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SentimentDashboard;